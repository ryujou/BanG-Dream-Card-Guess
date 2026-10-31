package main

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/draw"
	"image/jpeg"
	"math"
	"math/rand/v2"
	"sort"
	"strings"
)

type Point struct{ X, Y int }
type Crop struct {
	X     int    `json:"x"`
	Y     int    `json:"y"`
	Size  int    `json:"size"`
	Image string `json:"image"`
}
type Rect struct{ X, Y, W, H float64 }
type FaceBox struct {
	Rect
	Conf  float64
	Label string
}
type scoredCrop struct {
	Point
	Score float64
}

func faceBoxesFor(store Obj, relative string) []FaceBox {
	images, _ := store["images"].(map[string]any)
	entry, _ := images[strings.ReplaceAll(relative, "\\", "/")].(map[string]any)
	faces, _ := entry["faces"].([]any)
	area := math.Max(1, gameNumber(entry["width"])*gameNumber(entry["height"]))
	result := []FaceBox{}
	for _, value := range faces {
		face, ok := value.(map[string]any)
		if !ok {
			continue
		}
		x, xOK := settingNumber(face["x"])
		y, yOK := settingNumber(face["y"])
		w, wOK := settingNumber(face["w"])
		h, hOK := settingNumber(face["h"])
		if !xOK || !yOK || !wOK || !hOK || w <= 0 || h <= 0 {
			continue
		}
		label := strings.ToLower(gameString(face["label"]))
		if label == "" {
			class, valid := settingNumber(face["cls"])
			if !valid {
				class = 1
			}
			switch class {
			case 0:
				label = "eyes"
			case 2:
				label = "mouth"
			default:
				label = "face"
			}
		}
		if strings.Contains(label, "eye") {
			label = "eyes"
		} else if strings.Contains(label, "mouth") {
			label = "mouth"
		} else {
			label = "face"
		}
		conf := gameNumber(face["conf"])
		if label == "face" && w*h/area > .22 && conf < .9 {
			continue
		}
		result = append(result, FaceBox{Rect{x, y, w, h}, conf, label})
	}
	return result
}

func expandedFaceZone(face FaceBox) Rect {
	sx, sy, offset := 1.85, 1.95, .08
	if face.Label == "eyes" {
		sx, sy, offset = 4.6, 5.4, 1.25
	} else if face.Label == "mouth" {
		sx, sy, offset = 4, 4.8, -1.15
	}
	w, h := face.W*sx, face.H*sy
	return Rect{face.X + face.W/2 - w/2, face.Y + face.H/2 + face.H*offset - h/2, w, h}
}
func overlapArea(a, b Rect) float64 {
	return math.Max(0, math.Min(a.X+a.W, b.X+b.W)-math.Max(a.X, b.X)) * math.Max(0, math.Min(a.Y+a.H, b.Y+b.H)-math.Max(a.Y, b.Y))
}
func scoreFacePolicy(crop Rect, faces []FaceBox, mode string) float64 {
	score := 0.0
	for _, face := range faces {
		zone := expandedFaceZone(face)
		ratio := overlapArea(crop, zone) / math.Min(zone.W*zone.H, crop.W*crop.H)
		switch mode {
		case "avoid":
			if ratio > 0 {
				score -= ratio * 800
			}
		case "prefer":
			if ratio > .1 {
				score += ratio * 600
			}
		case "only":
			if ratio > .3 {
				score += ratio * 500
			} else {
				score -= 200
			}
		}
	}
	return score
}
func randomCropPoint(img *image.NRGBA, size int) Point {
	maxX, maxY := max(0, img.Bounds().Dx()-size), max(0, img.Bounds().Dy()-size)
	mx, my := min(maxX, int(float64(img.Bounds().Dx())*.08)), min(maxY, int(float64(img.Bounds().Dy())*.08))
	return Point{min(maxX, mx+rand.IntN(max(1, maxX-mx*2))), min(maxY, my+rand.IntN(max(1, maxY-my*2)))}
}
func faceCropPoints(img *image.NRGBA, size int, faces []FaceBox) []Point {
	points := []Point{}
	offsets := [][2]float64{{0, 0}, {-.28, 0}, {.28, 0}, {0, -.28}, {0, .28}, {-.28, -.28}, {.28, -.28}, {.28, .28}, {-.28, .28}}
	for _, face := range faces[:min(8, len(faces))] {
		for _, offset := range offsets {
			points = append(points, Point{max(0, min(img.Bounds().Dx()-size, int(math.Round(face.X+face.W*.5-float64(size)*.5+offset[0]*float64(size))))), max(0, min(img.Bounds().Dy()-size, int(math.Round(face.Y+face.H*.5-float64(size)*.5+offset[1]*float64(size)))))})
		}
	}
	return points
}
func scoreCrop(img *image.NRGBA, x, y, size int, faces []FaceBox, mode string) float64 {
	if x < 0 || y < 0 || x+size > img.Bounds().Dx() || y+size > img.Bounds().Dy() {
		return 0
	}
	step := max(2, size/25)
	variance, saturation, edges, count := 0.0, 0.0, 0.0, 0.0
	luma := func(x, y int) float64 {
		p := img.NRGBAAt(x, y)
		return .299*float64(p.R) + .587*float64(p.G) + .114*float64(p.B)
	}
	for row := y; row < y+size; row += step {
		for col := x; col < x+size; col += step {
			p := img.NRGBAAt(col, row)
			q := p
			if col+step < x+size {
				q = img.NRGBAAt(col+step, row)
				if math.Abs(luma(col, row)-luma(col+step, row)) > 30 {
					edges++
				}
			}
			if row+step < y+size && math.Abs(luma(col, row)-luma(col, row+step)) > 30 {
				edges++
			}
			variance += math.Abs(float64(p.R)-float64(q.R)) + math.Abs(float64(p.G)-float64(q.G)) + math.Abs(float64(p.B)-float64(q.B))
			hi, lo := max(p.R, p.G, p.B), min(p.R, p.G, p.B)
			if hi > 0 {
				saturation += float64(hi-lo) / float64(hi)
			}
			count++
		}
	}
	avg := variance / math.Max(1, count)
	score := avg*.5 + saturation/math.Max(1, count)*300 + edges/math.Max(1, count)*400
	if avg < 12 || edges < 3 {
		score = 0
	}
	if mode != "none" && len(faces) > 0 {
		score += scoreFacePolicy(Rect{float64(x), float64(y), float64(size), float64(size)}, faces, mode)
	}
	return score
}
func pickCrop(candidates []scoredCrop, size int, history []Point) Point {
	for _, distance := range []float64{float64(size) * 1.85, float64(size) * 1.2, 0} {
		for _, crop := range candidates {
			valid := true
			for _, old := range history {
				if math.Hypot(float64(old.X-crop.X), float64(old.Y-crop.Y)) < distance {
					valid = false
					break
				}
			}
			if valid {
				return crop.Point
			}
		}
	}
	return candidates[0].Point
}
func smartCrop(source image.Image, size int, s Obj, history []Point, faces []FaceBox) (Crop, error) {
	bounds := source.Bounds()
	img, ok := source.(*image.NRGBA)
	if !ok || bounds.Min != (image.Point{}) {
		img = image.NewNRGBA(image.Rect(0, 0, bounds.Dx(), bounds.Dy()))
		draw.Draw(img, img.Bounds(), source, bounds.Min, draw.Src)
	}
	size = min(max(60, min(260, size)), bounds.Dx(), bounds.Dy())
	mode := effectiveFaceMode(s)
	points := []Point{}
	for i := 0; i < max(30, int(gameNumber(s["candidateCount"]))); i++ {
		points = append(points, randomCropPoint(img, size))
	}
	if mode == "prefer" || mode == "only" {
		points = append(points, faceCropPoints(img, size, faces)...)
	}
	all := make([]scoredCrop, 0, len(points))
	for _, p := range points {
		all = append(all, scoredCrop{p, scoreCrop(img, p.X, p.Y, size, faces, mode)})
	}
	sort.SliceStable(all, func(i, j int) bool { return all[i].Score > all[j].Score })
	positive := []scoredCrop{}
	for _, p := range all {
		if p.Score > 0 {
			positive = append(positive, p)
		}
	}
	if len(positive) > 0 {
		all = positive
	}
	p := pickCrop(all, size, history)
	var encoded bytes.Buffer
	if err := jpeg.Encode(&encoded, img.SubImage(image.Rect(p.X, p.Y, p.X+size, p.Y+size)), &jpeg.Options{Quality: 90}); err != nil {
		return Crop{}, err
	}
	return Crop{p.X, p.Y, size, "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(encoded.Bytes())}, nil
}
