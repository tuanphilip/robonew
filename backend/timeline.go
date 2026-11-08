package backend

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type Khung struct {
	Rong int `json:"rong"`
	Cao  int `json:"cao"`
	Fps  int `json:"fps"`
}

type MediaItem struct {
	ID         string                 `json:"id"`
	Loai       string                 `json:"loai"` // video | anh | tieng
	Tep        string                 `json:"tep"`  // relative path inside deck
	Ten        string                 `json:"ten"`
	Ms         int64                  `json:"ms"`
	Rong       int                    `json:"rong,omitempty"`
	Cao        int                    `json:"cao,omitempty"`
	Fps        float64                `json:"fps,omitempty"`
	Xoay       int                    `json:"xoay,omitempty"`
	CoTieng    bool                   `json:"coTieng"`
	Byte       int64                  `json:"byte"`
	Codec      string                 `json:"codec,omitempty"`
	PixFmt     string                 `json:"pixFmt,omitempty"`
	CodecTieng string                 `json:"codecTieng,omitempty"`
	LopPhu     string                 `json:"lopPhu,omitempty"`
	Chu        map[string]interface{} `json:"chu,omitempty"`
	TTS        map[string]interface{} `json:"tts,omitempty"`
}

type TrackItem struct {
	ID       string  `json:"id"`   // V1, V2, A1, A2...
	Loai     string  `json:"loai"` // hinh | tieng
	Ten      string  `json:"ten"`
	Khoa     bool    `json:"khoa"`
	An       bool    `json:"an"`
	TatTieng bool    `json:"tatTieng"`
	AmLuong  float64 `json:"amLuong"`
}

type KeyframePoint struct {
	T    int64   `json:"t"`
	V    float64 `json:"v"`
	Muot bool    `json:"muot,omitempty"`
}

type KhoiItem struct {
	ID       string                 `json:"id"`
	Track    string                 `json:"track"`
	Media    string                 `json:"media"`
	Neo      map[string]interface{} `json:"neo,omitempty"`
	BatDauMs int64                  `json:"batDauMs"`
	VaoMs    int64                  `json:"vaoMs"`
	RaMs     int64                  `json:"raMs"`
	TocDo    float64                `json:"tocDo"`
	BienDoi  map[string]interface{} `json:"bienDoi,omitempty"`
	AmLuong  float64                `json:"amLuong"`
	Mo       map[string]interface{} `json:"mo,omitempty"`
	KF       map[string][]KeyframePoint `json:"kf,omitempty"`
	Cat      map[string]float64     `json:"cat,omitempty"`
	Lat      map[string]bool        `json:"lat,omitempty"`
	Lap      bool                   `json:"lap,omitempty"`
	OCho     map[string]interface{} `json:"oCho,omitempty"`
}

type TimelineProject struct {
	PhienBan int                    `json:"phienBan"`
	Khung    Khung                  `json:"khung"`
	Goc      map[string]interface{} `json:"goc"`
	AmGoc    map[string]interface{} `json:"amGoc"`
	Xuat     map[string]interface{} `json:"xuat"`
	Media    []MediaItem            `json:"media"`
	Track    []TrackItem            `json:"track"`
	Khoi     []KhoiItem             `json:"khoi"`
	DanhDau  []interface{}          `json:"danhDau"`
	Slide    interface{}            `json:"slide"`
	PhuDe    interface{}            `json:"phuDe"`
}

func DefaultTimelineProject(vertical bool) *TimelineProject {
	rong := 1080
	cao := 1920
	if !vertical {
		rong = 1920
		cao = 1080
	}
	return &TimelineProject{
		PhienBan: 2,
		Khung: Khung{
			Rong: rong,
			Cao:  cao,
			Fps:  30,
		},
		Goc: map[string]interface{}{
			"video": "",
		},
		AmGoc: map[string]interface{}{
			"giong":    1.0,
			"deck":     1.0,
			"tatGiong": false,
			"tatDeck":  false,
			"haNhac": map[string]interface{}{
				"bat":   true,
				"mucDb": 12,
			},
		},
		Xuat: map[string]interface{}{
			"khung": "goc",
			"nen":   "mo",
			"mau": map[string]interface{}{
				"sang":       1.0,
				"tuongPhan": 1.0,
				"baoHoa":    1.0,
			},
		},
		Media: []MediaItem{},
		Track: []TrackItem{
			{ID: "V2", Loai: "hinh", Ten: "Phụ đề", Khoa: false, An: false, TatTieng: false, AmLuong: 1.0},
			{ID: "V1", Loai: "hinh", Ten: "Slide", Khoa: false, An: false, TatTieng: false, AmLuong: 1.0},
			{ID: "A1", Loai: "tieng", Ten: "Giọng đọc", Khoa: false, An: false, TatTieng: false, AmLuong: 1.0},
			{ID: "A2", Loai: "tieng", Ten: "Nhạc nền", Khoa: false, An: false, TatTieng: false, AmLuong: 0.8},
			{ID: "A3", Loai: "tieng", Ten: "Hiệu ứng âm", Khoa: false, An: false, TatTieng: false, AmLuong: 1.0},
		},
		Khoi:    []KhoiItem{},
		DanhDau: []interface{}{},
		Slide:   nil,
		PhuDe:   nil,
	}
}

func ReadTimelineProject(deckDir string) (*TimelineProject, error) {
	duAnPath := filepath.Join(deckDir, "dung", "du-an.json")
	data, err := os.ReadFile(duAnPath)
	if err != nil {
		return nil, err
	}
	var proj TimelineProject
	if err := json.Unmarshal(data, &proj); err != nil {
		return nil, fmt.Errorf("JSON parse error: %w", err)
	}
	return &proj, nil
}

func WriteTimelineProject(deckDir string, proj *TimelineProject) error {
	dungDir := filepath.Join(deckDir, "dung")
	_ = os.MkdirAll(dungDir, 0755)
	duAnPath := filepath.Join(dungDir, "du-an.json")

	// Rotate backups (.bak-1, .bak-2, .bak-3)
	if _, err := os.Stat(duAnPath); err == nil {
		bak2 := filepath.Join(dungDir, "du-an.json.bak-2")
		bak3 := filepath.Join(dungDir, "du-an.json.bak-3")
		_ = os.Rename(bak2, bak3)
		bak1 := filepath.Join(dungDir, "du-an.json.bak-1")
		_ = os.Rename(bak1, bak2)
		_ = os.Rename(duAnPath, bak1)
	}

	data, err := json.MarshalIndent(proj, "", " ")
	if err != nil {
		return err
	}
	return os.WriteFile(duAnPath, data, 0644)
}

func ReadPreviewSettings(deckDir string) (map[string]interface{}, error) {
	p := filepath.Join(deckDir, "preview-settings.json")
	data, err := os.ReadFile(p)
	if err != nil {
		return map[string]interface{}{
			"subtitles": map[string]interface{}{
				"enabled":  true,
				"fontSize": 18,
				"bottom":   100,
				"maxLines": 1,
			},
		}, nil
	}
	var res map[string]interface{}
	if err := json.Unmarshal(data, &res); err != nil {
		return nil, err
	}
	return res, nil
}

func WritePreviewSettings(deckDir string, settings map[string]interface{}) error {
	p := filepath.Join(deckDir, "preview-settings.json")
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p, data, 0644)
}

func FormatTimestampNow() string {
	return time.Now().UTC().Format(time.RFC3339)
}
