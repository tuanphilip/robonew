package backend

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type AITheoNha struct {
	Model  string `json:"model"`
	DiaChi string `json:"diaChi"`
	Khoa   string `json:"khoa"`
}

type VbeeConfig struct {
	AppID     string  `json:"appId"`
	Token     string  `json:"token"`
	VoiceCode string  `json:"voiceCode"`
	Speed     float64 `json:"speed"`
}

type ElevenConfig struct {
	ApiKey  string `json:"apiKey"`
	VoiceID string `json:"voiceId"`
	ModelID string `json:"modelId"`
}

type Settings struct {
	SourceRoot   string               `json:"sourceRoot"`
	Theme        string               `json:"theme"`
	Zoom         float64              `json:"zoom"`
	Language     string               `json:"language"`
	AutoSave     bool                 `json:"autoSave"`
	DefaultVoice string               `json:"defaultVoice"`
	ElevenApiKey string               `json:"elevenApiKey"`
	Vbee         VbeeConfig           `json:"vbee"`
	Eleven       ElevenConfig         `json:"eleven"`
	AINhaID      string               `json:"aiNhaId"`
	AIModel      string               `json:"aiModel"`
	AIDiaChi     string               `json:"aiDiaChi"`
	AITheoNha    map[string]AITheoNha `json:"aiTheoNha"`
	AIMaxTokens  int                  `json:"aiMaxTokens"`
	AITemp       float64              `json:"aiTemp"`
}

type ConfigManager struct {
	DataDir      string
	SettingsPath string
	Settings     Settings
}

func NewConfigManager() *ConfigManager {
	userHome, err := os.UserHomeDir()
	if err != nil {
		userHome = "."
	}
	dataDir := filepath.Join(userHome, "robonew")
	projectsDir := filepath.Join(dataDir, "projects")
	settingsPath := filepath.Join(dataDir, "settings.json")
	if _, err := os.Stat("settings.json"); err == nil {
		if abs, err := filepath.Abs("settings.json"); err == nil {
			settingsPath = abs
		}
	}

	_ = os.MkdirAll(projectsDir, 0755)

	cm := &ConfigManager{
		DataDir:      dataDir,
		SettingsPath: settingsPath,
		Settings: Settings{
			SourceRoot:   projectsDir,
			Theme:        "dark",
			Zoom:         1.0,
			Language:     "vi",
			AutoSave:     true,
			DefaultVoice: "vi-VN-HoaiMyNeural",
			AINhaID:      "tuongThich",
			AIDiaChi:     "https://api.openai.com/v1",
			AIModel:      "gpt-4o-mini",
			AITheoNha: map[string]AITheoNha{
				"tuongThich": {
					Model:  "gpt-4o-mini",
					DiaChi: "https://api.openai.com/v1",
				},
				"openai": {
					Model:  "gpt-4o-mini",
					DiaChi: "https://api.openai.com/v1",
				},
				"anthropic": {
					Model:  "claude-3-5-sonnet-latest",
					DiaChi: "https://api.anthropic.com/v1",
				},
			},
			Vbee: VbeeConfig{
				VoiceCode: "hn_female_thutrang_phrase_48k-fhg",
				Speed:     1.0,
			},
			Eleven: ElevenConfig{
				ModelID: "eleven_multilingual_v2",
			},
		},
	}
	cm.Load()
	return cm
}

func (cm *ConfigManager) Load() {
	data, err := os.ReadFile(cm.SettingsPath)
	if err == nil {
		_ = json.Unmarshal(data, &cm.Settings)
	}
	if cm.Settings.SourceRoot == "" {
		cm.Settings.SourceRoot = filepath.Join(cm.DataDir, "projects")
	}
	if cm.Settings.AINhaID == "" {
		cm.Settings.AINhaID = "tuongThich"
	}
	if cm.Settings.AITheoNha == nil {
		cm.Settings.AITheoNha = make(map[string]AITheoNha)
	}
}

func (cm *ConfigManager) Save(patch map[string]interface{}) error {
	data, err := json.Marshal(patch)
	if err == nil {
		_ = json.Unmarshal(data, &cm.Settings)
	}
	out, err := json.MarshalIndent(cm.Settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(cm.SettingsPath, out, 0644)
}
