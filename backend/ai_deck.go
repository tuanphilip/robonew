package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type GeneratedDeck struct {
	Topic       string   `json:"topic"`
	ScriptLines []string `json:"scriptLines"`
	Slide0      struct {
		TitleMain   string   `json:"titleMain"`
		HeroCaption string   `json:"heroCaption"`
		Tags        []string `json:"tags"`
	} `json:"slide0"`
	Slide1 struct {
		Title   string `json:"title"`
		Fact1   string `json:"fact1"`
		Fact2   string `json:"fact2"`
		Fact3   string `json:"fact3"`
		FlowOld string `json:"flowOld"`
		FlowNew string `json:"flowNew"`
	} `json:"slide1"`
	Slide2 struct {
		Title         string `json:"title"`
		CorePoint     string `json:"corePoint"`
		CoreDesc      string `json:"coreDesc"`
		TakeawayTitle string `json:"takeawayTitle"`
	} `json:"slide2"`
	Slide3 struct {
		Title       string `json:"title"`
		PointA_Head string `json:"pointA_Head"`
		PointA_Desc string `json:"pointA_Desc"`
		PointB_Head string `json:"pointB_Head"`
		PointB_Desc string `json:"pointB_Desc"`
	} `json:"slide3"`
	Slide4 struct {
		Title      string `json:"title"`
		RedDesc    string `json:"redDesc"`
		YellowDesc string `json:"yellowDesc"`
		GreenDesc  string `json:"greenDesc"`
	} `json:"slide4"`
	Slide5 struct {
		Title       string `json:"title"`
		Verdict     string `json:"verdict"`
		Thesis      string `json:"thesis"`
		SourceLabel string `json:"sourceLabel"`
	} `json:"slide5"`
}

func GenerateDeckContent(ctx context.Context, cm *ConfigManager, topic string) (*GeneratedDeck, error) {
	if topic == "" {
		topic = "Tại sao AI Agent đang thay thế lập trình viên truyền thống"
	}

	s := cm.Settings
	nhaId := s.AINhaID
	if nhaId == "" {
		nhaId = "tuongThich"
	}
	baseURL := s.AIDiaChi
	if baseURL == "" {
		baseURL = s.AITheoNha["tuongThich"].DiaChi
	}
	apiKey := s.AITheoNha[nhaId].Khoa
	if apiKey == "" {
		apiKey = s.AITheoNha["tuongThich"].Khoa
	}
	model := s.AIModel
	if model == "" {
		model = "ag/gemini-3.8-flash-medium"
	}

	prompt := fmt.Sprintf(`Tạo nội dung kịch bản và slide video ngắn dọc 9:16 về chủ đề: "%s".
Trả về ĐÚNG MỘT JSON thuần không bọc markdown code fence, cấu trúc:
{
  "topic": "%s",
  "scriptLines": [
    "câu 1 (hook punchy dưới 20 từ)",
    "câu 2 (dẫn chứng hoặc demo)",
    "câu 3 (cơ chế hoặc quy trình)",
    "câu 4 (2 điểm so sánh hoặc highlight)",
    "câu 5 (rủi ro và cơ hội)",
    "câu 6 (kết luận hành động đắt giá)"
  ],
  "slide0": {
    "titleMain": "tiêu đề ngắn 3-4 từ",
    "heroCaption": "mô tả ngắn",
    "tags": ["tag1", "tag2", "tag3"]
  },
  "slide1": {
    "title": "tiêu đề slide 1",
    "fact1": "số liệu 1",
    "fact2": "số liệu 2",
    "fact3": "số liệu 3",
    "flowOld": "cách cũ",
    "flowNew": "cách mới"
  },
  "slide2": {
    "title": "cơ chế hoặc quy trình",
    "corePoint": "ý cốt lõi",
    "coreDesc": "giải thích ngắn gọn",
    "takeawayTitle": "điểm chốt"
  },
  "slide3": {
    "title": "hai điểm chính",
    "pointA_Head": "tiêu đề điểm A",
    "pointA_Desc": "mô tả ngắn A",
    "pointB_Head": "tiêu đề điểm B",
    "pointB_Desc": "mô tả ngắn B"
  },
  "slide4": {
    "title": "rủi ro và cơ hội",
    "redDesc": "rủi ro cần tránh",
    "yellowDesc": "điểm cần kiểm chứng",
    "greenDesc": "tín hiệu tích cực"
  },
  "slide5": {
    "title": "kết luận",
    "verdict": "verdict đắt giá",
    "thesis": "hành động cần làm ngay hôm nay",
    "sourceLabel": "Robonew Studio"
  }
}`, topic, topic)

	req := ChatRequest{
		Model: model,
		Messages: []ChatMessage{
			{Role: "system", Content: "Bạn là chuyên gia biên kịch video ngắn TikTok/Reels triệu view. Chỉ trả về JSON thuần, không giải thích."},
			{Role: "user", Content: prompt},
		},
		Temperature: 0.7,
	}

	rawResponse := ""
	err := StreamChatCompletion(ctx, baseURL, apiKey, req, func(chunk string) {
		rawResponse += chunk
	})
	if err != nil {
		return nil, fmt.Errorf("lỗi gọi LLM (%s): %w", model, err)
	}

	cleanJSON := strings.TrimSpace(rawResponse)
	if strings.HasPrefix(cleanJSON, "```") {
		idx := strings.Index(cleanJSON, "\n")
		if idx != -1 {
			cleanJSON = cleanJSON[idx+1:]
		}
		cleanJSON = strings.TrimSuffix(cleanJSON, "```")
		cleanJSON = strings.TrimSpace(cleanJSON)
	}

	var deck GeneratedDeck
	if err := json.Unmarshal([]byte(cleanJSON), &deck); err != nil {
		return nil, fmt.Errorf("lỗi parse JSON từ LLM: %w | Raw: %s", err, cleanJSON)
	}

	if len(deck.ScriptLines) < 6 {
		for len(deck.ScriptLines) < 6 {
			deck.ScriptLines = append(deck.ScriptLines, "Thông tin đang được cập nhật.")
		}
	}

	return &deck, nil
}

func ApplyGeneratedDeck(deckDir string, gen *GeneratedDeck) error {
	// 1. Write script-90s.txt
	scriptContent := strings.Join(gen.ScriptLines, "\n") + "\n"
	if err := os.WriteFile(filepath.Join(deckDir, "script-90s.txt"), []byte(scriptContent), 0644); err != nil {
		return err
	}

	// 2. Update app.js slideScripts
	appJsPath := filepath.Join(deckDir, "app.js")
	if appBytes, err := os.ReadFile(appJsPath); err == nil {
		appStr := string(appBytes)
		idxStart := strings.Index(appStr, "const slideScripts = [")
		if idxStart != -1 {
			idxEnd := strings.Index(appStr[idxStart:], "];")
			if idxEnd != -1 {
				linesJSON, _ := json.MarshalIndent(gen.ScriptLines, "  ", "  ")
				replacement := fmt.Sprintf("const slideScripts = %s;", string(linesJSON))
				appStr = appStr[:idxStart] + replacement + appStr[idxStart+idxEnd+2:]
				_ = os.WriteFile(appJsPath, []byte(appStr), 0644)
			}
		}
	}

	// 3. Update index.html with generated content
	indexPath := filepath.Join(deckDir, "index.html")
	indexBytes, err := os.ReadFile(indexPath)
	if err != nil {
		return err
	}
	html := string(indexBytes)

	// Slide 0 replacements
	if gen.Slide0.TitleMain != "" {
		html = replaceTagContent(html, `class="gradient-text hero-version-text">`, "</span>", gen.Slide0.TitleMain)
	}
	if gen.Slide0.HeroCaption != "" {
		html = replaceTagContent(html, `class="hero-caption">`, "</p>", gen.Slide0.HeroCaption)
	}
	if len(gen.Slide0.Tags) >= 3 {
		statsBlock := fmt.Sprintf(`<span><i class="fa-solid fa-bolt"></i> %s</span><span>%s</span><span>%s</span>`,
			gen.Slide0.Tags[0], gen.Slide0.Tags[1], gen.Slide0.Tags[2])
		html = replaceTagContent(html, `class="repo-stats">`, "</div>", statsBlock)
	}

	// Slide 1 replacements
	if gen.Slide1.Title != "" {
		html = replaceTagContent(html, `<h2 class="slide-title">Slide nguồn hoặc demo<br/><span class="gradient-text">`, "</span></h2>", `<span class="gradient-text">`+gen.Slide1.Title)
		html = strings.Replace(html, `Slide nguồn hoặc demo<br/>`, "", 1)
	}
	if gen.Slide1.FlowOld != "" {
		html = replaceTagContent(html, `class="flow-node flow-old"><i class="fa-solid fa-file-lines"></i><span>`, "</span>", gen.Slide1.FlowOld)
	}
	if gen.Slide1.FlowNew != "" {
		html = replaceTagContent(html, `class="flow-node flow-new"><i class="fa-solid fa-video"></i><span>`, "</span>", gen.Slide1.FlowNew)
	}

	// Slide 2 replacements
	if gen.Slide2.Title != "" {
		html = replaceTagContent(html, `<h2 class="slide-title">Workflow hoặc cơ chế<br/><span class="gradient-text-2">`, "</span></h2>", `<span class="gradient-text-2">`+gen.Slide2.Title)
		html = strings.Replace(html, `Workflow hoặc cơ chế<br/>`, "", 1)
	}
	if gen.Slide2.CorePoint != "" {
		html = replaceTagContent(html, `class="chip-core"><i class="fa-solid fa-bolt"></i><span>`, "</span>", gen.Slide2.CorePoint)
	}
	if gen.Slide2.CoreDesc != "" {
		html = replaceTagContent(html, `<p class="chip-label">Mỗi reveal chỉ gánh <strong>`, "</strong></p>", gen.Slide2.CoreDesc)
		html = strings.Replace(html, `Mỗi reveal chỉ gánh <strong>`, "<strong>", 1)
	}
	if gen.Slide2.TakeawayTitle != "" {
		html = replaceTagContent(html, `<p class="stream-caption">Chốt bằng <strong>`, "</strong></p>", gen.Slide2.TakeawayTitle)
		html = strings.Replace(html, `Chốt bằng <strong>`, "<strong>", 1)
	}

	// Slide 3 replacements
	if gen.Slide3.Title != "" {
		html = replaceTagContent(html, `<h2 class="slide-title">Highlight mode<br/><span class="gradient-text">`, "</span></h2>", `<span class="gradient-text">`+gen.Slide3.Title)
		html = strings.Replace(html, `Highlight mode<br/>`, "", 1)
	}
	if gen.Slide3.PointA_Head != "" {
		html = replaceTagContent(html, `class="workflow-step highlightable"><b>`, "</b>", gen.Slide3.PointA_Head)
	}
	if gen.Slide3.PointA_Desc != "" {
		html = replaceTagContent(html, `class="workflow-step highlightable"><b>`+gen.Slide3.PointA_Head+`</b><i class="fa-solid fa-lightbulb"></i><span>`, "</span>", gen.Slide3.PointA_Desc)
	}
	if gen.Slide3.PointB_Head != "" {
		html = replaceTagContent(html, `<i class="fa-solid fa-shield-halved"></i><span>Card highlight thứ hai</span></div>`, "",
			fmt.Sprintf(`<b>%s</b><i class="fa-solid fa-shield-halved"></i><span>%s</span></div>`, gen.Slide3.PointB_Head, gen.Slide3.PointB_Desc))
	}

	// Slide 4 replacements
	if gen.Slide4.Title != "" {
		html = replaceTagContent(html, `<h2 class="slide-title">Traffic-light mode<br/><span class="gradient-text">`, "</span></h2>", `<span class="gradient-text">`+gen.Slide4.Title)
		html = strings.Replace(html, `Traffic-light mode<br/>`, "", 1)
	}
	if gen.Slide4.RedDesc != "" {
		html = replaceTagContent(html, `data-light-color="red"><div class="risk-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="risk-text"><strong>Đỏ</strong><span>`, "</span>", gen.Slide4.RedDesc)
	}
	if gen.Slide4.YellowDesc != "" {
		html = replaceTagContent(html, `data-light-color="yellow"><div class="risk-icon"><i class="fa-solid fa-circle-question"></i></div><div class="risk-text"><strong>Vàng</strong><span>`, "</span>", gen.Slide4.YellowDesc)
	}
	if gen.Slide4.GreenDesc != "" {
		html = replaceTagContent(html, `data-light-color="green"><div class="risk-icon"><i class="fa-solid fa-circle-check"></i></div><div class="risk-text"><strong>Xanh</strong><span>`, "</span>", gen.Slide4.GreenDesc)
	}

	// Slide 5 replacements
	if gen.Slide5.Verdict != "" {
		html = replaceTagContent(html, `class="conclusion-text"><strong class="gradient-text">`, "</strong>", gen.Slide5.Verdict)
	}
	if gen.Slide5.Thesis != "" {
		html = replaceTagContent(html, `class="split-panel active cursor-verdict-panel"><span>Thesis</span><strong>`, "</strong>", gen.Slide5.Thesis)
	}
	if gen.Slide5.SourceLabel != "" {
		html = replaceTagContent(html, `class="source-tag"><i class="fa-solid fa-link"></i> Nguồn: `, "</div>", gen.Slide5.SourceLabel)
	}

	return os.WriteFile(indexPath, []byte(html), 0644)
}

func replaceTagContent(html, prefix, suffix, replacement string) string {
	idx := strings.Index(html, prefix)
	if idx == -1 {
		return html
	}
	start := idx + len(prefix)
	end := strings.Index(html[start:], suffix)
	if end == -1 {
		return html
	}
	return html[:start] + replacement + html[start+end:]
}
