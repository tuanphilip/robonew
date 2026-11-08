package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx           context.Context
	ConfigManager *ConfigManager
	RenderManager *RenderManager
	MCPServer     *MCPServer
	TemplatesDir  string
}

func NewApp(templatesDir string) *App {
	cm := NewConfigManager()
	rm := NewRenderManager()
	mcp := NewMCPServer(cm, rm, templatesDir)

	return &App{
		ConfigManager: cm,
		RenderManager: rm,
		MCPServer:     mcp,
		TemplatesDir:  templatesDir,
	}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) HandleIPC(channel string, payloadStr string) (string, error) {
	var args []interface{}
	if payloadStr != "" {
		_ = json.Unmarshal([]byte(payloadStr), &args)
	}

	res, err := a.dispatch(channel, args)
	if err != nil {
		errResp := map[string]string{"__error": err.Error()}
		b, _ := json.Marshal(errResp)
		return string(b), nil
	}
	if res == nil {
		return "null", nil
	}
	out, err := json.Marshal(res)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func (a *App) dispatch(channel string, args []interface{}) (interface{}, error) {
	root := a.ConfigManager.Settings.SourceRoot

	switch channel {
	case "app:info":
		return map[string]interface{}{
			"name":     "robonew",
			"version":  "1.0.0",
			"platform": "windows",
		}, nil

	case "settings:get":
		return a.ConfigManager.Settings, nil

	case "settings:set":
		if len(args) > 0 {
			if patch, ok := args[0].(map[string]interface{}); ok {
				_ = a.ConfigManager.Save(patch)
			}
		}
		return a.ConfigManager.Settings, nil

	case "projects:list":
		pRoot := root
		if len(args) > 0 {
			if r, ok := args[0].(string); ok && r != "" {
				pRoot = r
			}
		}
		return ListProjects(pRoot)

	case "project:read":
		if len(args) == 0 {
			return nil, fmt.Errorf("missing projectDir")
		}
		dir := fmt.Sprintf("%v", args[0])
		if !filepath.IsAbs(dir) {
			dir = filepath.Join(root, dir)
		}
		return ReadProject(dir)

	case "project:createVideo":
		name := ""
		khung := "doc"
		if len(args) > 0 {
			if m, ok := args[0].(map[string]interface{}); ok {
				if n, ok := m["ten"].(string); ok {
					name = n
				}
				if k, ok := m["khung"].(string); ok {
					khung = k
				}
			}
		}
		dir, err := CreateVideoProject(root, name, khung)
		if err != nil {
			return map[string]interface{}{"ok": false, "loi": err.Error()}, nil
		}
		return map[string]interface{}{"ok": true, "name": filepath.Base(dir), "dir": dir}, nil

	case "project:createFromTemplate":
		tplID := "beeknoee-slide-starter"
		name := ""
		if len(args) > 0 {
			if m, ok := args[0].(map[string]interface{}); ok {
				if t, ok := m["mauId"].(string); ok {
					tplID = t
				}
				if n, ok := m["ten"].(string); ok {
					name = n
				}
			}
		}
		dir, err := CreateFromTemplate(root, tplID, name, a.TemplatesDir)
		if err != nil {
			return map[string]interface{}{"ok": false, "loi": err.Error()}, nil
		}
		return map[string]interface{}{"ok": true, "name": filepath.Base(dir), "dir": dir}, nil

	case "project:generateAI":
		topic := "Tại sao AI Agent đang thay đổi hoàn toàn cách lập trình"
		if len(args) > 0 {
			if t, ok := args[0].(string); ok && strings.TrimSpace(t) != "" {
				topic = strings.TrimSpace(t)
			}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		deck, err := GenerateDeckContent(ctx, a.ConfigManager, topic)
		if err != nil {
			return map[string]interface{}{"ok": false, "loi": err.Error()}, nil
		}

		slug := fmt.Sprintf("deck-ai-%d", time.Now().Unix()%100000)
		dir, err := CreateFromTemplate(root, "beeknoee-slide-starter", slug, a.TemplatesDir)
		if err != nil {
			return map[string]interface{}{"ok": false, "loi": err.Error()}, nil
		}

		if err := ApplyGeneratedDeck(dir, deck); err != nil {
			return map[string]interface{}{"ok": false, "loi": err.Error()}, nil
		}

		// Synthesize voiceover for all 6 lines into output/full_voiceover.mp3
		fullText := strings.Join(deck.ScriptLines, " ")
		outDir := filepath.Join(dir, "output")
		_ = os.MkdirAll(outDir, 0755)
		targetVoiceover := filepath.Join(outDir, "full_voiceover.mp3")
		voicePath, err := SynthesizeVoice(ctx, fullText, "", "vbee", a.ConfigManager, outDir)
		if err != nil || voicePath == "" {
			voicePath, err = SynthesizeVoice(ctx, fullText, "", "edge", a.ConfigManager, outDir)
		}
		if err == nil && voicePath != "" {
			_ = os.Remove(targetVoiceover)
			_ = os.Rename(voicePath, targetVoiceover)
		}

		return map[string]interface{}{
			"ok":   true,
			"name": filepath.Base(dir),
			"dir":  dir,
			"deck": deck,
		}, nil

	case "project:delete":
		if len(args) > 0 {
			dir := fmt.Sprintf("%v", args[0])
			if !filepath.IsAbs(dir) {
				dir = filepath.Join(root, dir)
			}
			_ = os.RemoveAll(dir)
		}
		return map[string]interface{}{"ok": true}, nil

	case "script:write":
		if len(args) >= 2 {
			dir := fmt.Sprintf("%v", args[0])
			if !filepath.IsAbs(dir) {
				dir = filepath.Join(root, dir)
			}
			var lines []string
			if rawLines, ok := args[1].([]interface{}); ok {
				for _, rl := range rawLines {
					lines = append(lines, fmt.Sprintf("%v", rl))
				}
			}
			content := strings.Join(lines, "\n") + "\n"
			_ = os.WriteFile(filepath.Join(dir, "script-90s.txt"), []byte(content), 0644)
		}
		return map[string]interface{}{"ok": true}, nil

	case "previewSettings:write":
		if len(args) >= 2 {
			dir := fmt.Sprintf("%v", args[0])
			if !filepath.IsAbs(dir) {
				dir = filepath.Join(root, dir)
			}
			if s, ok := args[1].(map[string]interface{}); ok {
				_ = WritePreviewSettings(dir, s)
			}
		}
		return map[string]interface{}{"ok": true}, nil

	case "dung:doc":
		if len(args) == 0 {
			return nil, fmt.Errorf("missing deck name")
		}
		name := fmt.Sprintf("%v", args[0])
		dir := filepath.Join(root, name)
		proj, err := ReadTimelineProject(dir)
		if err != nil {
			proj = DefaultTimelineProject(true)
		}
		return map[string]interface{}{
			"ok":        true,
			"duAn":      proj,
			"moi":       false,
			"chiDoc":    false,
			"loiDoc":    []string{},
			"daCatHong": false,
			"moc":       []interface{}{},
			"video":     "",
		}, nil

	case "dung:ghi":
		if len(args) >= 2 {
			name := fmt.Sprintf("%v", args[0])
			dir := filepath.Join(root, name)
			var proj TimelineProject
			b, _ := json.Marshal(args[1])
			if err := json.Unmarshal(b, &proj); err == nil {
				_ = WriteTimelineProject(dir, &proj)
				return map[string]interface{}{"ok": true}, nil
			}
		}
		return map[string]interface{}{"ok": false, "loi": "Invalid timeline project data"}, nil

	case "dung:taoGiong":
		if len(args) >= 2 {
			name := fmt.Sprintf("%v", args[0])
			dir := filepath.Join(root, name)
			var o map[string]interface{}
			b, _ := json.Marshal(args[1])
			_ = json.Unmarshal(b, &o)

			chu, _ := o["chu"].(string)
			voice, _ := o["voice"].(string)
			engine, _ := o["engine"].(string)

			thuMuc := filepath.Join(dir, "dung", "media")
			ctx := context.Background()
			audioPath, err := SynthesizeVoice(ctx, chu, voice, engine, a.ConfigManager, thuMuc)
			if err != nil {
				return map[string]interface{}{"ok": false, "loi": []string{err.Error()}}, nil
			}

			info, _ := ProbeMedia(audioPath)
			durMs := int64(3000)
			if info != nil && info.Duration > 0 {
				durMs = int64(info.Duration * 1000)
			}
			st, _ := os.Stat(audioPath)
			fSize := int64(0)
			if st != nil {
				fSize = st.Size()
			}

			mediaID := fmt.Sprintf("m%d", time.Now().UnixNano()%1000000000)
			mediaObj := map[string]interface{}{
				"id":         mediaID,
				"loai":       "tieng",
				"tep":        filepath.Join("dung", "media", filepath.Base(audioPath)),
				"ten":        fmt.Sprintf("Giọng: %s", chu),
				"ms":         durMs,
				"coTieng":    true,
				"byte":       fSize,
				"codec":      "mp3",
				"codecTieng": "mp3",
				"tts":        o,
			}

			return map[string]interface{}{
				"ok":    true,
				"daCo":  false,
				"media": mediaObj,
			}, nil
		}
		return map[string]interface{}{"ok": false, "loi": []string{"thiếu tham số"}}, nil

	case "timeline:songAm":
		if len(args) == 0 {
			return nil, nil
		}
		name := fmt.Sprintf("%v", args[0])
		dir := filepath.Join(root, name)

		candAudio := filepath.Join(dir, "output", "full_voiceover.mp3")
		if _, err := os.Stat(candAudio); err != nil {
			candAudio = filepath.Join(dir, "meta.mp3")
		}

		var giongWave *WaveformResult
		if _, err := os.Stat(candAudio); err == nil {
			giongWave, _ = GenerateWaveform(candAudio)
		}

		var giongMap map[string]interface{}
		if giongWave != nil {
			giongMap = map[string]interface{}{
				"giay":  giongWave.Giay,
				"buoc":  giongWave.Buoc,
				"dinh":  giongWave.Dinh,
				"nguon": filepath.Base(candAudio),
				"tron":  false,
			}
		}

		return map[string]interface{}{
			"giong":    giongMap,
			"nhac":     nil,
			"chu":      nil,
			"dangDung": false,
		}, nil

	case "render:status":
		return a.RenderManager.GetStatus(), nil

	case "render:start":
		if len(args) > 0 {
			opts, _ := args[0].(map[string]interface{})
			projectDir, _ := opts["projectDir"].(string)
			if !filepath.IsAbs(projectDir) {
				projectDir = filepath.Join(root, projectDir)
			}
			err := a.RenderManager.StartRender(projectDir, "", func(step string, pct float64) {
				if a.ctx != nil {
					runtime.EventsEmit(a.ctx, "render:step", map[string]interface{}{
						"step":     step,
						"progress": pct,
					})
				}
			})
			if err != nil {
				return map[string]interface{}{"ok": false, "error": err.Error()}, nil
			}
			return map[string]interface{}{"ok": true}, nil
		}
		return map[string]interface{}{"ok": false, "error": "missing options"}, nil

	case "render:cancel":
		a.RenderManager.Cancel()
		return map[string]interface{}{"ok": true}, nil

	case "templates:list":
		tplFile := filepath.Join(a.TemplatesDir, "_templates.json")
		if data, err := os.ReadFile(tplFile); err == nil {
			var tpls interface{}
			if err := json.Unmarshal(data, &tpls); err == nil {
				return tpls, nil
			}
		}
		return []interface{}{}, nil

	case "zoom:get":
		return a.ConfigManager.Settings.Zoom, nil

	case "zoom:set":
		if len(args) > 0 {
			if z, ok := args[0].(float64); ok {
				a.ConfigManager.Settings.Zoom = z
				_ = a.ConfigManager.Save(map[string]interface{}{"zoom": z})
			}
		}
		return a.ConfigManager.Settings.Zoom, nil

	// ── AI CONFIG & MODELS ──────────────────────────────────────────────
	case "ai:config":
		s := a.ConfigManager.Settings
		theoNhaMap := make(map[string]interface{})
		for k, v := range s.AITheoNha {
			theoNhaMap[k] = map[string]interface{}{
				"model":  v.Model,
				"diaChi": v.DiaChi,
			}
		}

		cauHinh := map[string]interface{}{
			"nhaId":       s.AINhaID,
			"model":       s.AIModel,
			"diaChi":      s.AIDiaChi,
			"theoNha":     theoNhaMap,
			"temperature": s.AITemp,
			"maxTokens":   s.AIMaxTokens,
			"hanMs":       0,
			"luong":       true,
		}

		nhaList := []map[string]interface{}{
			{
				"id":            "tuongThich",
				"ten":           "OpenAI-compatible (Custom)",
				"diaChiMacDinh": "https://api.openai.com/v1",
				"coKhoa":        s.AITheoNha["tuongThich"].Khoa != "",
			},
			{
				"id":            "openai",
				"ten":           "OpenAI",
				"diaChiMacDinh": "https://api.openai.com/v1",
				"coKhoa":        s.AITheoNha["openai"].Khoa != "",
			},
			{
				"id":            "anthropic",
				"ten":           "Anthropic",
				"diaChiMacDinh": "https://api.anthropic.com/v1",
				"coKhoa":        s.AITheoNha["anthropic"].Khoa != "",
			},
		}

		return map[string]interface{}{
			"cauHinh": cauHinh,
			"nha":     nhaList,
		}, nil

	case "ai:save":
		if len(args) > 0 {
			patch, _ := args[0].(map[string]interface{})
			nhaId, _ := patch["nhaId"].(string)
			if nhaId == "" {
				nhaId = a.ConfigManager.Settings.AINhaID
			}
			if nhaId == "" {
				nhaId = "tuongThich"
			}

			diaChi, _ := patch["diaChi"].(string)
			model, _ := patch["model"].(string)
			khoa, _ := patch["khoa"].(string)
			xoaKhoa, _ := patch["xoaKhoa"].(bool)

			curNha := a.ConfigManager.Settings.AITheoNha[nhaId]
			if diaChi != "" {
				curNha.DiaChi = diaChi
			}
			if model != "" {
				curNha.Model = model
			}
			if xoaKhoa {
				curNha.Khoa = ""
			} else if khoa != "" {
				curNha.Khoa = khoa
			}
			a.ConfigManager.Settings.AITheoNha[nhaId] = curNha

			a.ConfigManager.Settings.AINhaID = nhaId
			a.ConfigManager.Settings.AIDiaChi = curNha.DiaChi
			a.ConfigManager.Settings.AIModel = curNha.Model

			_ = a.ConfigManager.Save(nil)
		}
		// Return updated config
		return a.dispatch("ai:config", nil)

	case "ai:models":
		nhaId := a.ConfigManager.Settings.AINhaID
		diaChi := a.ConfigManager.Settings.AIDiaChi
		khoa := a.ConfigManager.Settings.AITheoNha[nhaId].Khoa

		if len(args) > 0 {
			if patch, ok := args[0].(map[string]interface{}); ok {
				if n, ok := patch["nhaId"].(string); ok && n != "" {
					nhaId = n
					if tn, exists := a.ConfigManager.Settings.AITheoNha[n]; exists {
						diaChi = tn.DiaChi
						khoa = tn.Khoa
					}
				}
				if d, ok := patch["diaChi"].(string); ok && d != "" {
					diaChi = d
				}
				if k, ok := patch["khoa"].(string); ok && k != "" {
					khoa = k
				}
			}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		models, err := ListAIModels(ctx, diaChi, khoa)
		if err != nil {
			return map[string]interface{}{"ok": false, "loi": err.Error()}, nil
		}
		return map[string]interface{}{"ok": true, "model": models}, nil

	case "ai:test":
		nhaId := a.ConfigManager.Settings.AINhaID
		diaChi := a.ConfigManager.Settings.AIDiaChi
		model := a.ConfigManager.Settings.AIModel
		khoa := a.ConfigManager.Settings.AITheoNha[nhaId].Khoa

		if len(args) > 0 {
			if patch, ok := args[0].(map[string]interface{}); ok {
				if n, ok := patch["nhaId"].(string); ok && n != "" {
					nhaId = n
					if tn, exists := a.ConfigManager.Settings.AITheoNha[n]; exists {
						diaChi = tn.DiaChi
						khoa = tn.Khoa
						model = tn.Model
					}
				}
				if d, ok := patch["diaChi"].(string); ok && d != "" {
					diaChi = d
				}
				if m, ok := patch["model"].(string); ok && m != "" {
					model = m
				}
				if k, ok := patch["khoa"].(string); ok && k != "" {
					khoa = k
				}
			}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		res, err := TestAIConnection(ctx, diaChi, khoa, model)
		if err != nil {
			return map[string]interface{}{"ok": false, "loi": err.Error()}, nil
		}
		res["nha"] = nhaId
		return res, nil

	// ── ELEVENLABS TTS ──────────────────────────────────────────────────
	case "tts:elevenConfig":
		s := a.ConfigManager.Settings.Eleven
		hasKey := s.ApiKey != "" || a.ConfigManager.Settings.ElevenApiKey != ""
		return map[string]interface{}{
			"apiKey":  hasKey,
			"voiceId": s.VoiceID,
			"modelId": s.ModelID,
		}, nil

	case "tts:elevenSave":
		if len(args) > 0 {
			if patch, ok := args[0].(map[string]interface{}); ok {
				if k, ok := patch["apiKey"].(string); ok {
					a.ConfigManager.Settings.Eleven.ApiKey = k
					a.ConfigManager.Settings.ElevenApiKey = k
				}
				if v, ok := patch["voiceId"].(string); ok {
					a.ConfigManager.Settings.Eleven.VoiceID = v
				}
				if m, ok := patch["modelId"].(string); ok {
					a.ConfigManager.Settings.Eleven.ModelID = m
				}
				_ = a.ConfigManager.Save(nil)
			}
		}
		return map[string]interface{}{"ok": true}, nil

	case "tts:elevenVoices":
		apiKey := a.ConfigManager.Settings.Eleven.ApiKey
		if apiKey == "" {
			apiKey = a.ConfigManager.Settings.ElevenApiKey
		}
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		voices, err := ListVoicesEleven(ctx, apiKey)
		if err != nil {
			return map[string]interface{}{"ok": false, "loi": err.Error()}, nil
		}
		return map[string]interface{}{"ok": true, "voices": voices}, nil

	case "tts:elevenQuota":
		apiKey := a.ConfigManager.Settings.Eleven.ApiKey
		if apiKey == "" {
			apiKey = a.ConfigManager.Settings.ElevenApiKey
		}
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		quota, err := GetQuotaEleven(ctx, apiKey)
		if err != nil {
			return map[string]interface{}{"ok": false, "loi": err.Error()}, nil
		}
		return quota, nil

	// ── VBEE TTS ────────────────────────────────────────────────────────
	case "tts:vbeeConfig":
		return a.ConfigManager.Settings.Vbee, nil

	case "tts:vbeeSave":
		if len(args) > 0 {
			if patch, ok := args[0].(map[string]interface{}); ok {
				if aId, ok := patch["appId"].(string); ok {
					a.ConfigManager.Settings.Vbee.AppID = aId
				}
				if tok, ok := patch["token"].(string); ok {
					a.ConfigManager.Settings.Vbee.Token = tok
				}
				if vc, ok := patch["voiceCode"].(string); ok {
					a.ConfigManager.Settings.Vbee.VoiceCode = vc
				}
				if sp, ok := patch["speed"].(float64); ok && sp > 0 {
					a.ConfigManager.Settings.Vbee.Speed = sp
				}
				_ = a.ConfigManager.Save(nil)
			}
		}
		return map[string]interface{}{"ok": true}, nil

	case "tts:vbeeVoices":
		return map[string]interface{}{
			"ok":     true,
			"voices": ListVbeeVoices(),
		}, nil

	// ── AGENT CHAT ──────────────────────────────────────────────────────
	case "chat:trangThai":
		s := a.ConfigManager.Settings
		nhaId := s.AINhaID
		if nhaId == "" {
			nhaId = "tuongThich"
		}
		coKhoa := s.AITheoNha[nhaId].Khoa != "" || s.AITheoNha["tuongThich"].Khoa != ""

		return map[string]interface{}{
			"ok": true,
			"dongCo": []map[string]interface{}{
				{
					"id":          "custom",
					"ten":         "Robonew AI (Custom LLM)",
					"moTa":        "Dùng Custom LLM endpoint đã cấu hình",
					"coNhiPhan":   true,
					"canDangNhap": false,
					"coKhoa":      true,
					"dangChay":    false,
				},
				{
					"id":          "codex",
					"ten":         "OpenAI · ChatGPT",
					"moTa":        "GPT-4o / GPT-4o-mini",
					"coNhiPhan":   true,
					"canDangNhap": false,
					"coKhoa":      coKhoa,
					"dangChay":    false,
				},
			},
		}, nil

	case "chat:phienMoi":
		sessionId := fmt.Sprintf("sess_%d", time.Now().UnixNano())
		return map[string]interface{}{
			"ok":        true,
			"sessionId": sessionId,
			"cauHinh":   []interface{}{},
		}, nil

	case "chat:gui":
		if len(args) < 2 {
			return map[string]interface{}{"ok": false, "loi": "thiếu tham số"}, nil
		}
		sessId := fmt.Sprintf("%v", args[0])
		userMsg := fmt.Sprintf("%v", args[1])

		go func() {
			s := a.ConfigManager.Settings
			nhaId := s.AINhaID
			diaChi := s.AIDiaChi
			khoa := s.AITheoNha[nhaId].Khoa
			if khoa == "" && s.AITheoNha["tuongThich"].Khoa != "" {
				khoa = s.AITheoNha["tuongThich"].Khoa
			}
			model := s.AIModel
			if model == "" {
				model = "gpt-4o-mini"
			}

			if diaChi == "" {
				if a.ctx != nil {
					runtime.EventsEmit(a.ctx, "chat:capNhat", map[string]interface{}{
						"sessionId": sessId,
						"update": map[string]interface{}{
							"sessionUpdate": "agent_message_chunk",
							"content": map[string]interface{}{
								"type": "text",
								"text": "Chưa cấu hình API endpoint. Vui lòng bấm nút **'Cài đặt AI'** trên thanh menu trên cùng để điền Base URL, API Key và Model.",
							},
						},
					})
				}
				return
			}

			// Stream chunk callback
			err := StreamChatCompletion(context.Background(), diaChi, khoa, ChatRequest{
				Model: model,
				Messages: []ChatMessage{
					{Role: "system", Content: "Bạn là trợ lý AI dựng video của Robonew Studio. Hãy trả lời ngắn gọn, chuyên nghiệp bằng tiếng Việt."},
					{Role: "user", Content: userMsg},
				},
			}, func(chunk string) {
				if a.ctx != nil {
					runtime.EventsEmit(a.ctx, "chat:capNhat", map[string]interface{}{
						"sessionId": sessId,
						"update": map[string]interface{}{
							"sessionUpdate": "agent_message_chunk",
							"content": map[string]interface{}{
								"type": "text",
								"text": chunk,
							},
						},
					})
				}
			})
			if err != nil && a.ctx != nil {
				runtime.EventsEmit(a.ctx, "chat:capNhat", map[string]interface{}{
					"sessionId": sessId,
					"update": map[string]interface{}{
						"sessionUpdate": "agent_message_chunk",
						"content": map[string]interface{}{
							"type": "text",
							"text": "\n[Lỗi kết nối AI: " + err.Error() + ". Vui lòng kiểm tra lại Base URL và Token trong Cài đặt AI.]",
						},
					},
				})
			}
		}()

		return map[string]interface{}{
			"ok":         true,
			"stopReason": "end_turn",
		}, nil

	case "chat:dung":
		return map[string]interface{}{"ok": true}, nil

	case "chat:dangNhap":
		return map[string]interface{}{"ok": true}, nil

	case "chat:dangXuat":
		return map[string]interface{}{"ok": true}, nil

	case "chat:traLoiQuyen":
		return map[string]interface{}{"ok": true}, nil

	case "chat:datCauHinh":
		return map[string]interface{}{"ok": true}, nil
	}

	return nil, nil
}
