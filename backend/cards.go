package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"math/rand/v2"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "golang.org/x/image/webp"
)

type Card struct {
	ID              string `json:"-"`
	ResourceSetName string `json:"resourceSetName"`
	CharacterID     int    `json:"characterId"`
	Rarity          int    `json:"rarity"`
	Attribute       string `json:"attribute"`
	Stat            struct {
		Training json.RawMessage `json:"training"`
	} `json:"stat"`
}
type Round struct {
	CardID                  string
	CharacterID             int
	DisplayName             string
	AcceptedAnswers         []string
	ImageURL                string
	ImageWidth, ImageHeight int
	Source                  image.Image
	Crop                    Crop
	FaceBoxes               []FaceBox
}
type Cards struct {
	Theme                 string
	resourceDir, cacheDir string
	pool                  []Card
	names                 map[string][]string
	faces                 Obj
	bandByCharacter       map[int]string
	cacheMu               sync.Mutex
	client                *http.Client
}

func NewCards(resourceDir, cacheDir, theme string) (*Cards, error) {
	c := &Cards{Theme: theme, resourceDir: resourceDir, cacheDir: cacheDir, names: map[string][]string{}, faces: Obj{}, bandByCharacter: map[int]string{}, client: &http.Client{Timeout: 20 * time.Second}}
	data, err := os.ReadFile(filepath.Join(resourceDir, "all5_2.json"))
	if err != nil {
		return nil, err
	}
	var raw map[string]Card
	if err = json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	data, err = os.ReadFile(filepath.Join(resourceDir, "nickname.json"))
	if err != nil {
		return nil, err
	}
	var rawNames map[string][]any
	if err = json.Unmarshal(data, &rawNames); err != nil {
		return nil, err
	}
	for id, aliases := range rawNames {
		c.names[id] = make([]string, len(aliases))
		for i, alias := range aliases {
			c.names[id][i] = gameString(alias)
		}
	}
	data, err = os.ReadFile(filepath.Join(resourceDir, "face-boxes.json"))
	if err == nil {
		if err = json.Unmarshal(data, &c.faces); err != nil {
			return nil, err
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	for id, card := range raw {
		if card.ResourceSetName != "" && len(c.names[strconv.Itoa(card.CharacterID)]) > 0 {
			card.ID = id
			c.pool = append(c.pool, card)
		}
	}
	bands := bandOptions
	if theme == "sekai" {
		bands = sekaiBands
	} else if theme == "bluearchive" {
		bands = blueArchiveBands
	}
	for _, band := range bands {
		for _, id := range band["characters"].([]int) {
			c.bandByCharacter[id] = band["id"].(string)
		}
	}
	return c, nil
}
func (c *Cards) Count() int { return len(c.pool) }
func (c *Cards) FaceBoxImages() int {
	images, _ := c.faces["images"].(map[string]any)
	return len(images)
}
func (c *Cards) matchesFaces(card Card, file string, s Obj) bool {
	count := 0
	for _, face := range faceBoxesFor(c.faces, card.ResourceSetName+"_rip/"+file) {
		if face.Label == "face" {
			count++
		}
	}
	limits := gameStrings(s["cardCharacterLimits"])
	return containsString(limits, "single") && count == 1 || containsString(limits, "multiple") && count > 1
}
func (c *Cards) variants(card Card, s Obj, filterFaces bool) []string {
	variants := []string{}
	allowed := gameStrings(s["cardVariants"])
	if containsString(allowed, "normal") {
		variants = append(variants, "card_normal.png")
	}
	if containsString(allowed, "trained") && len(card.Stat.Training) > 0 && string(card.Stat.Training) != "null" && string(card.Stat.Training) != "false" {
		variants = append(variants, "card_after_training.png")
	}
	if filterFaces && len(gameStrings(s["cardCharacterLimits"])) < 2 {
		filtered := []string{}
		for _, file := range variants {
			if c.matchesFaces(card, file, s) {
				filtered = append(filtered, file)
			}
		}
		return filtered
	}
	return variants
}
func (c *Cards) filtered(s Obj) []Card {
	result := []Card{}
	bands, rarities, attributes := gameStrings(s["cardBands"]), gameStrings(s["cardRarities"]), gameStrings(s["cardAttributes"])
	for _, card := range c.pool {
		if len(bands) > 0 && !containsString(bands, c.bandByCharacter[card.CharacterID]) || len(rarities) > 0 && !containsString(rarities, strconv.Itoa(card.Rarity)) || len(attributes) > 0 && !containsString(attributes, card.Attribute) {
			continue
		}
		if len(c.variants(card, s, true)) > 0 {
			result = append(result, card)
		}
	}
	return result
}
func (c *Cards) loadImage(relative, url string) (image.Image, error) {
	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()
	local := filepath.Join(c.cacheDir, filepath.FromSlash(relative))
	data, err := os.ReadFile(local)
	if errors.Is(err, os.ErrNotExist) {
		if url == "" {
			return nil, errors.New("本地记忆大厅图片不存在")
		}
		response, requestErr := c.client.Get(url)
		if requestErr != nil {
			return nil, requestErr
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusOK || !strings.HasPrefix(response.Header.Get("Content-Type"), "image/") {
			return nil, fmt.Errorf("资源响应 %d", response.StatusCode)
		}
		data, err = io.ReadAll(io.LimitReader(response.Body, 32*1024*1024+1))
		if err != nil {
			return nil, err
		}
		if len(data) > 32*1024*1024 {
			return nil, errors.New("卡面资源超过大小限制")
		}
		img, decodeErr := decodeCardImage(data)
		if decodeErr != nil {
			return nil, decodeErr
		}
		if err = os.MkdirAll(filepath.Dir(local), 0755); err != nil {
			return nil, err
		}
		if err = os.WriteFile(local, data, 0644); err != nil {
			return nil, err
		}
		return img, nil
	}
	if err != nil {
		return nil, err
	}
	return decodeCardImage(data)
}

func decodeCardImage(data []byte) (image.Image, error) {
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	if config.Width <= 0 || config.Height <= 0 || config.Width > 16_777_216/config.Height {
		return nil, errors.New("卡面尺寸超过限制")
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	return img, err
}
func (c *Cards) Round(s Obj, recentCards []string, recentCharacters []int) (*Round, error) {
	pool := c.filtered(s)
	if len(pool) == 0 {
		if len(gameStrings(s["cardCharacterLimits"])) < 2 {
			return nil, errors.New("所选人数与卡池条件没有匹配卡面，请检查筛选条件或脸框资源")
		}
		return nil, errors.New("所选筛选条件没有匹配卡面")
	}
	recentCards = recentCards[:min(len(recentCards), int(gameNumber(s["avoidRecentCards"])))]
	recentCharacters = recentCharacters[:min(len(recentCharacters), int(gameNumber(s["avoidRecentCharacters"])))]
	var candidates []Card
	for pass := 0; pass < 3; pass++ {
		candidates = nil
		for _, card := range pool {
			excluded := false
			if pass < 2 && containsString(recentCards, card.ID) {
				excluded = true
			}
			if pass == 0 {
				for _, id := range recentCharacters {
					if id == card.CharacterID {
						excluded = true
					}
				}
			}
			if !excluded {
				candidates = append(candidates, card)
			}
		}
		if len(candidates) > 0 {
			break
		}
	}
	card := candidates[rand.IntN(len(candidates))]
	variants := c.variants(card, s, true)
	if len(variants) > 1 && rand.Float64() > .5 {
		variants[0], variants[1] = variants[1], variants[0]
	}
	var source image.Image
	var relative string
	var err error
	for _, file := range variants {
		relative = card.ResourceSetName + "_rip/" + file
		url := "https://bestdori.com/assets/jp/characters/resourceset/" + relative
		if c.Theme == "sekai" {
			relative = strings.ReplaceAll(relative, ".png", ".webp")
			url = "https://storage.sekai.best/sekai-jp-assets/character/member/" + card.ResourceSetName + "/" + strings.ReplaceAll(file, ".png", ".webp")
		} else if c.Theme == "bluearchive" {
			relative = card.ResourceSetName + "_rip/memorial.jpg"
			url = ""
		}
		source, err = c.loadImage(relative, url)
		if err == nil {
			break
		}
	}
	if source == nil {
		if c.Theme == "bluearchive" {
			return nil, fmt.Errorf("读取记忆大厅失败: %w", err)
		}
		return nil, fmt.Errorf("下载卡面失败: %w", err)
	}
	faces := faceBoxesFor(c.faces, relative)
	crop, err := smartCrop(source, int(gameNumber(s["cropSize"])), s, nil, faces)
	if err != nil {
		return nil, err
	}
	names := c.names[strconv.Itoa(card.CharacterID)]
	name := names[0]
	if c.Theme == "bangdream" && len(names) > 7 && names[7] != "" {
		name = names[7]
	}
	prefix := "/cards/"
	if c.Theme == "sekai" {
		prefix = "/cards/sekai/"
	} else if c.Theme == "bluearchive" {
		prefix = "/cards/bluearchive/"
	}
	return &Round{card.ID, card.CharacterID, name, append([]string{}, names...), prefix + relative, source.Bounds().Dx(), source.Bounds().Dy(), source, crop, faces}, nil
}
func (c *Cards) Recrop(round *Round, s Obj, history []Point) (Crop, error) {
	return smartCrop(round.Source, int(gameNumber(s["cropSize"])), s, history, round.FaceBoxes)
}
