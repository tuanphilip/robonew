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

type VbeeVoiceInfo struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Region      string `json:"region"`
	Gender      string `json:"gender"`
	Description string `json:"description"`
}

var defaultVbeeVoices = []VbeeVoiceInfo{
	{Code: "hn_female_thutrang_phrase_48k-fhg", Name: "Thu Trang", Region: "Miền Bắc", Gender: "Nữ", Description: "Giọng đọc truyền cảm, chuẩn Hà Nội"},
	{Code: "hn_male_manhdung_phrase_48k-fhg", Name: "Mạnh Dũng", Region: "Miền Bắc", Gender: "Nam", Description: "Trầm ấm, thời sự, tin tức"},
	{Code: "sg_female_huonggiang_phrase_48k-fhg", Name: "Hương Giang", Region: "Miền Nam", Gender: "Nữ", Description: "Ngọt ngào, nhẹ nhàng Sài Gòn"},
	{Code: "sg_male_minhhoang_phrase_48k-fhg", Name: "Minh Hoàng", Region: "Miền Nam", Gender: "Nam", Description: "Tự nhiên, hoạt bát"},
	{Code: "hue_female_huongthao_phrase_48k-fhg", Name: "Hương Thảo", Region: "Miền Trung", Gender: "Nữ", Description: "Dịu dàng xứ Huế"},
}

func ListVbeeVoices() []VbeeVoiceInfo {
	return defaultVbeeVoices
}

func SynthesizeVbee(ctx context.Context, text string, voiceCode string, speed float64, appID string, token string, outputFile string) error {
	text = strings.TrimSpace(text)
	if text == "" {
		return fmt.Errorf("văn bản trống")
	}
	if voiceCode == "" {
		voiceCode = "hn_female_ngochuyen_full_48k-fhg"
	}
	if speed <= 0 {
		speed = 1.05
	}

	url := "https://vbee.vn/api/v1/tts"
	payload := map[string]interface{}{
		"app_id":        appID,
		"voice_code":    voiceCode,
		"input_text":    text,
		"response_type": "indirect",
		"callback_url":  "https://example.com/callback",
		"audio_type":    "mp3",
		"bitrate":       128,
		"speed_rate":    speed,
	}

	b, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("lỗi kết nối Vbee: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("lỗi đọc phản hồi Vbee: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Vbee API lỗi (%d): %s", resp.StatusCode, string(respBytes))
	}

	// Parse response
	var vbeeResp struct {
		Status int `json:"status"`
		Result struct {
			RequestID string `json:"request_id"`
			AudioLink string `json:"audio_link"`
		} `json:"result"`
		AudioLink string `json:"audio_link"`
		Error     string `json:"error"`
		Message   string `json:"message"`
	}

	if err := json.Unmarshal(respBytes, &vbeeResp); err != nil {
		return fmt.Errorf("phản hồi Vbee không phải JSON hợp lệ: %w", err)
	}

	link := vbeeResp.Result.AudioLink
	if link == "" {
		link = vbeeResp.AudioLink
	}

	// If indirect response, poll by request_id
	if link == "" && vbeeResp.Result.RequestID != "" {
		reqID := vbeeResp.Result.RequestID
		deadline := time.Now().Add(45 * time.Second)
		for time.Now().Before(deadline) {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(1200 * time.Millisecond):
			}

			pollReq, err := http.NewRequestWithContext(ctx, "GET", "https://vbee.vn/api/v1/tts/"+reqID, nil)
			if err != nil {
				continue
			}
			pollReq.Header.Set("Authorization", "Bearer "+token)
			pResp, pErr := client.Do(pollReq)
			if pErr != nil {
				continue
			}
			pBytes, _ := io.ReadAll(pResp.Body)
			pResp.Body.Close()

			var pData struct {
				Status int `json:"status"`
				Result struct {
					Status    string `json:"status"`
					AudioLink string `json:"audio_link"`
				} `json:"result"`
				AudioLink string `json:"audio_link"`
			}
			if json.Unmarshal(pBytes, &pData) == nil {
				pLink := pData.Result.AudioLink
				if pLink == "" {
					pLink = pData.AudioLink
				}
				if pLink != "" {
					link = pLink
					break
				}
			}
		}
	}

	if link == "" {
		msg := vbeeResp.Message
		if msg == "" {
			msg = vbeeResp.Error
		}
		if msg == "" {
			msg = string(respBytes)
		}
		return fmt.Errorf("không nhận được liên kết âm thanh từ Vbee: %s", msg)
	}

	// Download audio file
	dlReq, err := http.NewRequestWithContext(ctx, "GET", link, nil)
	if err != nil {
		return err
	}
	dlResp, err := client.Do(dlReq)
	if err != nil {
		return fmt.Errorf("không tải được file âm thanh từ %s: %w", link, err)
	}
	defer dlResp.Body.Close()

	if dlResp.StatusCode != http.StatusOK {
		return fmt.Errorf("tải audio thất bại (%d)", dlResp.StatusCode)
	}

	out, err := os.Create(outputFile)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, dlResp.Body)
	return err
}
