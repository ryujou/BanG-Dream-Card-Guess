package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func fixtureCards(t *testing.T, theme string) *Cards {
	t.Helper()
	root := t.TempDir()
	resource, cache := filepath.Join(root, "resource"), filepath.Join(root, "cache")
	if err := os.MkdirAll(resource, 0755); err != nil {
		t.Fatal(err)
	}
	img := image.NewNRGBA(image.Rect(0, 0, 420, 360))
	for y := 0; y < 360; y++ {
		for x := 0; x < 420; x++ {
			img.SetNRGBA(x, y, color.NRGBA{uint8(x * 7), uint8(y * 13), uint8((x + y) * 3), 255})
		}
	}
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, img); err != nil {
		t.Fatal(err)
	}
	pool, names, images := Obj{}, Obj{}, Obj{}
	for i := 1; i <= 3; i++ {
		id := strconv.Itoa(i)
		pool[id] = Obj{"resourceSetName": "test" + id, "characterId": i, "rarity": 4, "attribute": "cool"}
		names[id] = []string{"answer" + id, "别名" + id, "a", "b", "c", "d", "e", "秘密答案" + id}
		relative := "test" + id + "_rip/card_normal.png"
		if theme == "sekai" {
			relative = strings.ReplaceAll(relative, ".png", ".webp")
		}
		local := filepath.Join(cache, filepath.FromSlash(relative))
		if err := os.MkdirAll(filepath.Dir(local), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(local, encoded.Bytes(), 0644); err != nil {
			t.Fatal(err)
		}
		faces := []Obj{}
		for j := 0; j < i; j++ {
			faces = append(faces, Obj{"x": 30 + j*50, "y": 40, "w": 20, "h": 30, "conf": 1, "label": "face"})
		}
		images[relative] = Obj{"width": 420, "height": 360, "faces": faces}
	}
	for name, value := range map[string]any{"all5_2.json": pool, "nickname.json": names, "face-boxes.json": Obj{"images": images}} {
		data, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		if err = os.WriteFile(filepath.Join(resource, name), data, 0644); err != nil {
			t.Fatal(err)
		}
	}
	cards, err := NewCards(resource, cache, theme)
	if err != nil {
		t.Fatal(err)
	}
	return cards
}
func TestCardsRealCropFilteringAndRecentAvoidance(t *testing.T) {
	cards := fixtureCards(t, "bangdream")
	s := DefaultSettings()
	if cards.Count() != 3 || cards.FaceBoxImages() != 3 {
		t.Fatal("card metadata incomplete")
	}
	first, err := cards.Round(s, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	second, err := cards.Round(s, []string{first.CardID}, []int{first.CharacterID})
	if err != nil {
		t.Fatal(err)
	}
	if first.CardID == second.CardID {
		t.Fatal("recent card repeated despite alternatives")
	}
	encoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(first.Crop.Image, "data:image/jpeg;base64,"))
	if err != nil {
		t.Fatal(err)
	}
	cropped, _, err := image.Decode(bytes.NewReader(encoded))
	if err != nil {
		t.Fatal(err)
	}
	if cropped.Bounds().Dx() != 180 || cropped.Bounds().Dy() != 180 {
		t.Fatalf("unexpected crop bounds %v", cropped.Bounds())
	}
	if !strings.HasPrefix(first.DisplayName, "秘密答案") || len(first.AcceptedAnswers) != 8 {
		t.Fatal("display name or aliases were lost")
	}
	s = NormalizeSettings(s, Obj{"cardCharacterLimits": []string{"single"}}, "bangdream")
	single, err := cards.Round(s, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if single.CardID != "1" {
		t.Fatalf("single-face filter selected %s", single.CardID)
	}
	s = NormalizeSettings(s, Obj{"cardRarities": []int{1}}, "bangdream")
	if _, err = cards.Round(s, nil, nil); err == nil {
		t.Fatal("empty filtered pool must fail")
	}
}
func TestCardsSekaiWebPAndMetadata(t *testing.T) {
	cards := fixtureCards(t, "sekai")
	asset, err := os.ReadFile(filepath.Join("..", "public", "brand", "miku-sekai.webp"))
	if err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 3; i++ {
		if err = os.WriteFile(filepath.Join(cards.cacheDir, "test"+strconv.Itoa(i)+"_rip", "card_normal.webp"), asset, 0644); err != nil {
			t.Fatal(err)
		}
	}
	round, err := cards.Round(ThemeSettings(DefaultSettings(), "sekai"), nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(round.ImageURL, "/cards/sekai/") || !strings.HasSuffix(round.ImageURL, ".webp") || !strings.HasPrefix(round.DisplayName, "answer") {
		t.Fatalf("wrong sekai round: %s %s", round.ImageURL, round.DisplayName)
	}
	if round.ImageWidth < 100 || round.ImageHeight < 100 || round.Crop.Image == "" {
		t.Fatal("real WebP not decoded and cropped")
	}
}

func TestCardsLoadsBothRealResourceLibraries(t *testing.T) {
	for _, theme := range []string{"bangdream", "sekai"} {
		resource := filepath.Join("..", "resource")
		if theme == "sekai" {
			resource = filepath.Join(resource, "sekai")
		}
		cards, err := NewCards(resource, t.TempDir(), theme)
		if err != nil {
			t.Fatalf("%s resources: %v", theme, err)
		}
		if cards.Count() == 0 {
			t.Fatalf("%s real card pool is empty", theme)
		}
		if theme == "bangdream" && cards.names["17"][12] != "17" {
			t.Fatal("numeric nickname was not normalized")
		}
	}
}

func TestCardsRejectOversizedImageBeforeDecodingOrCaching(t *testing.T) {
	var encoded bytes.Buffer
	if err := jpeg.Encode(&encoded, image.NewRGBA(image.Rect(0, 0, 8, 8)), nil); err != nil {
		t.Fatal(err)
	}
	data := encoded.Bytes()
	frame := bytes.Index(data, []byte{0xff, 0xc0})
	if frame < 0 {
		t.Fatal("JPEG fixture has no baseline frame")
	}
	for _, offset := range []int{5, 6, 7, 8} {
		data[frame+offset] = 0xff
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width != 65535 || config.Height != 65535 {
		t.Fatal("oversized fixture must have a valid dimension header")
	}
	cards := fixtureCards(t, "bangdream")
	local := filepath.Join(cards.cacheDir, "oversized.jpg")
	if err = os.WriteFile(local, data, 0644); err != nil {
		t.Fatal(err)
	}
	if _, err = cards.loadImage("oversized.jpg", "https://unused.invalid"); err == nil || !strings.Contains(err.Error(), "尺寸超过限制") {
		t.Fatalf("cached image dimension limit failed: %v", err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/jpeg")
		_, _ = w.Write(data)
	}))
	defer server.Close()
	if _, err = cards.loadImage("downloaded.jpg", server.URL); err == nil || !strings.Contains(err.Error(), "尺寸超过限制") {
		t.Fatalf("download dimension limit failed: %v", err)
	}
	if _, err = os.Stat(filepath.Join(cards.cacheDir, "downloaded.jpg")); !os.IsNotExist(err) {
		t.Fatal("oversized image was cached")
	}
}
