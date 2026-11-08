package backend

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

var nonChatFilter = regexp.MustCompile(`(?i)(^|[/-])(tts|stt|whisper|transcribe|embedding|rerank|moderation)|image|dall-e|flux|seedream|seedance|sora|veo|kling|wan-|imagine|web-search`)

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
	Temperature float64       `json:"temperature,omitempty"`
	Stream      bool          `json:"stream"`
}

type ModelInfo struct {
	ID      string `json:"id"`
	Created int64  `json:"created,omitempty"`
	OwnedBy string `json:"owned_by,omitempty"`
}

type ModelsResponse struct {
	Data []ModelInfo `json:"data"`
}

func normalizeBaseURL(u string) string {
	u = strings.TrimSpace(u)
	u = strings.TrimRight(u, "/")
	if u == "" {
		u = "https://api.openai.com/v1"
	}
	return u
}

func ListAIModels(ctx context.Context, baseURL string, apiKey string) ([]string, error) {
	baseURL = normalizeBaseURL(baseURL)
	url := baseURL + "/models"

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("không kết nối được tới %s: %w", baseURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("lỗi máy chủ (%d): %s", resp.StatusCode, string(b))
	}

	var mResp ModelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&mResp); err != nil {
		return nil, fmt.Errorf("phản hồi JSON không hợp lệ: %w", err)
	}

	var chatModels []string
	for _, m := range mResp.Data {
		if !nonChatFilter.MatchString(m.ID) {
			chatModels = append(chatModels, m.ID)
		}
	}

	// Fallback if filter filtered everything
	if len(chatModels) == 0 && len(mResp.Data) > 0 {
		for _, m := range mResp.Data {
			chatModels = append(chatModels, m.ID)
		}
	}

	return chatModels, nil
}

func TestAIConnection(ctx context.Context, baseURL string, apiKey string, model string) (map[string]interface{}, error) {
	baseURL = normalizeBaseURL(baseURL)
	url := baseURL + "/chat/completions"

	startTime := time.Now()
	chatReq := ChatRequest{
		Model: model,
		Messages: []ChatMessage{
			{Role: "user", Content: "Trả lời đúng hai chữ: OK Bee"},
		},
		MaxTokens:   256,
		Temperature: 0.7,
		Stream:      false,
	}

	b, _ := json.Marshal(chatReq)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(b))
	if err != nil {
		return nil, err
	}
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("lỗi kết nối: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("lỗi đọc phản hồi: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API lỗi (%d): %s", resp.StatusCode, string(respBytes))
	}

	latency := time.Since(startTime).Milliseconds()

	var chatResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	text := ""
	if err := json.Unmarshal(respBytes, &chatResp); err == nil && len(chatResp.Choices) > 0 {
		text = strings.TrimSpace(chatResp.Choices[0].Message.Content)
	}

	return map[string]interface{}{
		"ok":         true,
		"model":      model,
		"traLoi":     text,
		"treNhipDau": latency,
		"luong":      false,
	}, nil
}

func StreamChatCompletion(ctx context.Context, baseURL string, apiKey string, req ChatRequest, onChunk func(string)) error {
	baseURL = normalizeBaseURL(baseURL)
	url := baseURL + "/chat/completions"
	req.Stream = true

	b, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(b))
	if err != nil {
		return err
	}
	if apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("lỗi stream (%d): %s", resp.StatusCode, string(errBytes))
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")
			if strings.TrimSpace(data) == "[DONE]" {
				break
			}
			var chunk struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
				} `json:"choices"`
			}
			if err := json.Unmarshal([]byte(data), &chunk); err == nil && len(chunk.Choices) > 0 {
				delta := chunk.Choices[0].Delta.Content
				if delta != "" && onChunk != nil {
					onChunk(delta)
				}
			}
		}
	}
	return scanner.Err()
}
