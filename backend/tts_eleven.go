package backend

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type ElevenVoiceInfo struct {
	VoiceID   string                 `json:"voice_id"`
	Name      string                 `json:"name"`
	Category  string                 `json:"category"`
	PreviewURL string                `json:"preview_url"`
	Labels    map[string]interface{} `json:"labels"`
}

type ElevenQuotaInfo struct {
	CharacterCount int64 `json:"character_count"`
	CharacterLimit int64 `json:"character_limit"`
	Status         string `json:"status"`
}

func ListVoicesEleven(ctx context.Context, apiKey string) ([]ElevenVoiceInfo, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("chưa có API key ElevenLabs")
	}
	url := "https://api.elevenlabs.io/v1/voices"

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("xi-api-key", apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("lỗi kết nối ElevenLabs: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ElevenLabs API lỗi (%d): %s", resp.StatusCode, string(b))
	}

	var data struct {
		Voices []ElevenVoiceInfo `json:"voices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	return data.Voices, nil
}

func GetQuotaEleven(ctx context.Context, apiKey string) (*ElevenQuotaInfo, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("chưa có API key ElevenLabs")
	}
	url := "https://api.elevenlabs.io/v1/user/subscription"

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("xi-api-key", apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("lỗi kết nối ElevenLabs: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ElevenLabs API lỗi (%d): %s", resp.StatusCode, string(b))
	}

	var quota ElevenQuotaInfo
	if err := json.NewDecoder(resp.Body).Decode(&quota); err != nil {
		return nil, err
	}
	return &quota, nil
}

func SynthesizeEleven(ctx context.Context, text string, voiceID string, modelID string, apiKey string, outputFilePath string) error {
	text = strings.TrimSpace(text)
	if text == "" {
		return fmt.Errorf("văn bản trống")
	}
	if voiceID == "" {
		voiceID = "21m00Tcm4TlvDq8ikWAM" // Default Rachel
	}
	if modelID == "" {
		modelID = "eleven_multilingual_v2"
	}
	if apiKey == "" {
		return fmt.Errorf("chưa có API key ElevenLabs")
	}

	url := fmt.Sprintf("https://api.elevenlabs.io/v1/text-to-speech/%s", voiceID)
	body := map[string]interface{}{
		"text":     text,
		"model_id": modelID,
		"voice_settings": map[string]interface{}{
			"stability":        0.5,
			"similarity_boost": 0.8,
		},
	}
	jsonBody, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return err
	}
	req.Header.Set("xi-api-key", apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("ElevenLabs error (%d): %s", resp.StatusCode, string(respBytes))
	}

	outFile, err := os.Create(outputFilePath)
	if err != nil {
		return err
	}
	defer outFile.Close()
	_, err = io.Copy(outFile, resp.Body)
	return err
}
