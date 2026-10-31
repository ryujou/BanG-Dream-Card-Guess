package main

import (
	"image"
	"math"
	"testing"
)

func TestCropFacePolicyAndHistory(t *testing.T) {
	face := FaceBox{Rect: Rect{X: 100, Y: 100, W: 30, H: 40}, Conf: 1, Label: "face"}
	crop := Rect{X: 80, Y: 80, W: 100, H: 100}
	if scoreFacePolicy(crop, []FaceBox{face}, "avoid") >= 0 || scoreFacePolicy(crop, []FaceBox{face}, "prefer") <= 0 {
		t.Fatal("face modes do not prefer/avoid faces")
	}
	candidates := []scoredCrop{{Point{0, 0}, 999}, {Point{350, 0}, 100}, {Point{350, 350}, 50}}
	chosen := pickCrop(candidates, 180, []Point{{0, 0}})
	if math.Hypot(float64(chosen.X), float64(chosen.Y)) < 333 {
		t.Fatal("recrop ignored available distant candidate")
	}
	img := image.NewNRGBA(image.Rect(0, 0, 420, 360))
	for i := 0; i < 100; i++ {
		p := randomCropPoint(img, 180)
		if p.X < 0 || p.Y < 0 || p.X+180 > 420 || p.Y+180 > 360 {
			t.Fatal("random crop outside source")
		}
	}
	if scoreCrop(img, -1, 0, 180, nil, "none") != 0 || scoreCrop(img, 0, 0, 180, nil, "none") != 0 {
		t.Fatal("out of bounds or blank image should have no information score")
	}
}
func TestFaceBoxesRejectMalformedAndUncertainLargeFaces(t *testing.T) {
	store := Obj{"images": Obj{"card.png": Obj{"width": 100, "height": 100, "faces": []any{Obj{"x": 0, "y": 0, "w": 90, "h": 90, "conf": .2, "label": "face"}, Obj{"x": 20, "y": 30, "w": 10, "h": 8, "conf": .8, "cls": 0}, Obj{"x": "invalid", "y": 0, "w": 10, "h": 10}}}}}
	faces := faceBoxesFor(store, "card.png")
	if len(faces) != 1 || faces[0].Label != "eyes" {
		t.Fatalf("incorrect normalized faces: %#v", faces)
	}
	plain := faceBoxesFor(Obj{"images": Obj{"plain.png": Obj{"width": 100, "height": 100, "faces": []any{Obj{"x": 1, "y": 2, "w": 10, "h": 10, "conf": 1}}}}}, "plain.png")
	if len(plain) != 1 || plain[0].Label != "face" {
		t.Fatal("unlabelled legacy face box must remain a face")
	}
}
