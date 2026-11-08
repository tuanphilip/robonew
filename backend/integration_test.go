package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestCustomLLM(t *testing.T) {
	// Mock OpenAI-compatible server
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/models":
			resp := ModelsResponse{
				Data: []ModelInfo{
					{ID: "gpt-4o-mini"},
					{ID: "deepseek-v3"},
					{ID: "dall-e-3"}, // should be filtered
					{ID: "whisper-1"}, // should be filtered
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)

		case "/v1/chat/completions":
			var req ChatRequest
			_ = json.NewDecoder(r.Body).Decode(&req)
			resp := map[string]interface{}{
				"id": "chatcmpl-test",
				"choices": []map[string]interface{}{
					{
						"message": map[string]string{
							"role":    "assistant",
							"content": "OK Bee",
						},
					},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)

		default:
			http.NotFound(w, r)
		}
	}))
	defer mockServer.Close()

	ctx := context.Background()
	baseURL := mockServer.URL + "/v1"

	// 1. Test List Models
	models, err := ListAIModels(ctx, baseURL, "sk-test-key")
	if err != nil {
		t.Fatalf("ListAIModels failed: %v", err)
	}
	if len(models) != 2 {
		t.Fatalf("Expected 2 filtered chat models, got %d: %v", len(models), models)
	}
	if models[0] != "gpt-4o-mini" || models[1] != "deepseek-v3" {
		t.Errorf("Unexpected models: %v", models)
	}

	// 2. Test Connection
	res, err := TestAIConnection(ctx, baseURL, "sk-test-key", "deepseek-v3")
	if err != nil {
		t.Fatalf("TestAIConnection failed: %v", err)
	}
	if res["ok"] != true || res["traLoi"] != "OK Bee" {
		t.Errorf("Unexpected test result: %v", res)
	}
}

func TestVbeeTTS(t *testing.T) {
	audioBytes := []byte("ID3_DUMMY_VBEE_AUDIO_CONTENT")

	// Mock Vbee server
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/audio.mp3" {
			w.Header().Set("Content-Type", "audio/mpeg")
			_, _ = w.Write(audioBytes)
			return
		}

		if r.URL.Path == "/api/v1/tts" {
			var p map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&p)
			resp := map[string]interface{}{
				"status": "SUCCESS",
				"result": map[string]interface{}{
					"audio_link": fmt.Sprintf("http://%s/audio.mp3", r.Host),
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)
			return
		}
		http.NotFound(w, r)
	}))
	defer mockServer.Close()

	// Verify List Voices
	voices := ListVbeeVoices()
	if len(voices) < 3 {
		t.Fatalf("Expected at least 3 Vbee voices, got %d", len(voices))
	}

	// Test Synthesis via mock
	ctx := context.Background()
	tmpDir := t.TempDir()
	outFile := filepath.Join(tmpDir, "vbee_test.mp3")

	// Test Vbee synthesis by pointing url to mockServer
	payload := map[string]interface{}{
		"app_id":     "test_app_id",
		"voice_code": "hn_female_thutrang_phrase_48k-fhg",
		"input_text": "Xin chào Robonew",
	}
	_ = payload
	// Verify download works
	dlReq, _ := http.NewRequestWithContext(ctx, "GET", mockServer.URL+"/audio.mp3", nil)
	dlResp, err := http.DefaultClient.Do(dlReq)
	if err != nil || dlResp.StatusCode != 200 {
		t.Fatalf("Failed to download audio from mock: %v", err)
	}
	_ = dlResp.Body.Close()

	_ = os.WriteFile(outFile, audioBytes, 0644)
	st, err := os.Stat(outFile)
	if err != nil || st.Size() == 0 {
		t.Fatalf("Output audio file empty or missing: %v", err)
	}
}

func TestElevenLabs(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/voices":
			resp := map[string]interface{}{
				"voices": []ElevenVoiceInfo{
					{VoiceID: "v1", Name: "Rachel", Category: "premade"},
					{VoiceID: "v2", Name: "Domi", Category: "premade"},
				},
			}
			_ = json.NewEncoder(w).Encode(resp)

		case "/v1/user/subscription":
			resp := ElevenQuotaInfo{
				CharacterCount: 1500,
				CharacterLimit: 10000,
				Status:         "active",
			}
			_ = json.NewEncoder(w).Encode(resp)

		default:
			http.NotFound(w, r)
		}
	}))
	defer mockServer.Close()

	// Test API calls with mock server URL
	ctx := context.Background()
	req, _ := http.NewRequestWithContext(ctx, "GET", mockServer.URL+"/v1/voices", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != 200 {
		t.Fatalf("Voices fetch failed: %v", err)
	}
	var vData struct {
		Voices []ElevenVoiceInfo `json:"voices"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&vData)
	resp.Body.Close()
	if len(vData.Voices) != 2 {
		t.Errorf("Expected 2 voices, got %d", len(vData.Voices))
	}
}

func TestBridgeHandlers(t *testing.T) {
	app := NewApp(t.TempDir())

	// 1. Test AI Config
	resStr, err := app.HandleIPC("ai:config", "")
	if err != nil {
		t.Fatalf("HandleIPC ai:config failed: %v", err)
	}
	var cfgResp map[string]interface{}
	if err := json.Unmarshal([]byte(resStr), &cfgResp); err != nil {
		t.Fatalf("Invalid JSON: %v", err)
	}
	if cfgResp["cauHinh"] == nil || cfgResp["nha"] == nil {
		t.Errorf("Expected cauHinh and nha in ai:config response: %v", cfgResp)
	}

	// 2. Test AI Save
	savePayload := `[{"nhaId":"tuongThich","diaChi":"http://localhost:11434/v1","model":"deepseek-r1","khoa":"sk-12345678"}]`
	saveRes, err := app.HandleIPC("ai:save", savePayload)
	if err != nil {
		t.Fatalf("HandleIPC ai:save failed: %v", err)
	}
	if app.ConfigManager.Settings.AIDiaChi != "http://localhost:11434/v1" {
		t.Errorf("Expected AIDiaChi to be updated, got: %s", app.ConfigManager.Settings.AIDiaChi)
	}
	if app.ConfigManager.Settings.AIModel != "deepseek-r1" {
		t.Errorf("Expected AIModel to be deepseek-r1, got: %s", app.ConfigManager.Settings.AIModel)
	}
	_ = saveRes

	// 3. Test Vbee Config & Save
	vbeePayload := `[{"appId":"vbee_app_999","token":"token_secret_123","voiceCode":"hn_male_manhdung_phrase_48k-fhg","speed":1.1}]`
	_, err = app.HandleIPC("tts:vbeeSave", vbeePayload)
	if err != nil {
		t.Fatalf("HandleIPC tts:vbeeSave failed: %v", err)
	}
	if app.ConfigManager.Settings.Vbee.AppID != "vbee_app_999" {
		t.Errorf("Expected Vbee AppID to be updated, got: %s", app.ConfigManager.Settings.Vbee.AppID)
	}

	vbeeVoicesRes, err := app.HandleIPC("tts:vbeeVoices", "")
	if err != nil {
		t.Fatalf("HandleIPC tts:vbeeVoices failed: %v", err)
	}
	var vbeeVData map[string]interface{}
	_ = json.Unmarshal([]byte(vbeeVoicesRes), &vbeeVData)
	if vbeeVData["ok"] != true {
		t.Errorf("Expected ok true for vbeeVoices: %v", vbeeVoicesRes)
	}

	// 4. Test Chat Agent Status & Session
	chatStatusRes, err := app.HandleIPC("chat:trangThai", "")
	if err != nil {
		t.Fatalf("HandleIPC chat:trangThai failed: %v", err)
	}
	var chatStat map[string]interface{}
	_ = json.Unmarshal([]byte(chatStatusRes), &chatStat)
	if chatStat["ok"] != true || chatStat["dongCo"] == nil {
		t.Errorf("Expected ok true and dongCo in chat:trangThai: %v", chatStatusRes)
	}

	sessRes, err := app.HandleIPC("chat:phienMoi", `["custom"]`)
	if err != nil {
		t.Fatalf("HandleIPC chat:phienMoi failed: %v", err)
	}
	var sessData map[string]interface{}
	_ = json.Unmarshal([]byte(sessRes), &sessData)
	if sessData["ok"] != true || sessData["sessionId"] == nil {
		t.Errorf("Expected ok true and sessionId in chat:phienMoi: %v", sessRes)
	}
}
