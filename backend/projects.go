package backend

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type ProjectItem struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Loai        string `json:"loai"` // "deck" | "video"
	ScriptLines int    `json:"scriptLines"`
	HasScript   bool   `json:"hasScript"`
	HasVideo    bool   `json:"hasVideo"`
	VideoPath   string `json:"videoPath,omitempty"`
	VideoName   string `json:"videoName,omitempty"`
	Migrated    bool   `json:"migrated"`
	Khung       string `json:"khung"` // "doc" | "ngang"
	VideoCu     bool   `json:"videoCu"`
	DangThietKe bool   `json:"dangThietKe"`
	UpdatedAt   int64  `json:"updatedAt"`
}

type ProjectDetail struct {
	ProjectPath     string                 `json:"projectPath"`
	Name            string                 `json:"name"`
	Lines           []string               `json:"lines"`
	SentenceCounts  []int                  `json:"sentenceCounts"`
	PreviewSettings map[string]interface{} `json:"previewSettings"`
	PreDelays       map[string]interface{} `json:"preDelays"`
	HasIndexHtml    bool                   `json:"hasIndexHtml"`
	Khung           string                 `json:"khung"`
}

func CopyDir(src string, dst string) error {
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	_ = os.MkdirAll(dst, 0755)

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			if err := CopyDir(srcPath, dstPath); err != nil {
				return err
			}
		} else {
			srcFile, err := os.Open(srcPath)
			if err != nil {
				return err
			}
			dstFile, err := os.Create(dstPath)
			if err != nil {
				srcFile.Close()
				return err
			}
			_, err = io.Copy(dstFile, srcFile)
			srcFile.Close()
			dstFile.Close()
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func ListProjects(root string) ([]ProjectItem, error) {
	if root == "" {
		return []ProjectItem{}, nil
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		return []ProjectItem{}, nil
	}

	var results []ProjectItem
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		dir := filepath.Join(root, entry.Name())
		indexPath := filepath.Join(dir, "index.html")
		if _, err := os.Stat(indexPath); err != nil {
			continue
		}

		isVid := false
		if _, err := os.Stat(filepath.Join(dir, "du-an-video.json")); err == nil {
			isVid = true
		}

		scriptPath := filepath.Join(dir, "script-90s.txt")
		hasScript := false
		scriptLines := 0
		if data, err := os.ReadFile(scriptPath); err == nil {
			hasScript = true
			lines := strings.Split(string(data), "\n")
			for _, l := range lines {
				if strings.TrimSpace(l) != "" {
					scriptLines++
				}
			}
		}

		videoName := ""
		videoPath := ""
		hasVideo := false
		videoMtime := int64(0)

		// Check for output video: <deck-name>.mp4 or output/<deck-name>.mp4 or <deck-name>-dung.mp4
		candVideos := []string{
			filepath.Join(dir, entry.Name()+".mp4"),
			filepath.Join(dir, "output", entry.Name()+".mp4"),
			filepath.Join(dir, entry.Name()+"-dung.mp4"),
			filepath.Join(dir, "output", entry.Name()+"-dung.mp4"),
		}
		for _, cand := range candVideos {
			if st, err := os.Stat(cand); err == nil {
				hasVideo = true
				videoPath = cand
				videoName = filepath.Base(cand)
				videoMtime = st.ModTime().UnixMilli()
				break
			}
		}

		updatedAt := int64(0)
		for _, f := range []string{"index.html", "script-90s.txt", "style.css", "app.js", "preview-settings.json", "dung/du-an.json"} {
			if st, err := os.Stat(filepath.Join(dir, f)); err == nil {
				if st.ModTime().UnixMilli() > updatedAt {
					updatedAt = st.ModTime().UnixMilli()
				}
			}
		}
		if updatedAt == 0 {
			if st, err := os.Stat(dir); err == nil {
				updatedAt = st.ModTime().UnixMilli()
			}
		}

		videoCu := false
		if hasVideo {
			sourceCheck := scriptPath
			if isVid {
				sourceCheck = filepath.Join(dir, "dung", "du-an.json")
			}
			if st, err := os.Stat(sourceCheck); err == nil {
				if st.ModTime().UnixMilli() > videoMtime {
					videoCu = true
				}
			}
		}

		khung := "doc"
		if data, err := os.ReadFile(indexPath); err == nil {
			if strings.Contains(string(data), `name="bee-khung" content="ngang"`) {
				khung = "ngang"
			}
		}

		loai := "deck"
		if isVid {
			loai = "video"
		}

		results = append(results, ProjectItem{
			Name:        entry.Name(),
			Path:        dir,
			Loai:        loai,
			ScriptLines: scriptLines,
			HasScript:   hasScript,
			HasVideo:    hasVideo,
			VideoPath:   videoPath,
			VideoName:   videoName,
			Migrated:    false,
			Khung:       khung,
			VideoCu:     videoCu,
			DangThietKe: false,
			UpdatedAt:   updatedAt,
		})
	}
	return results, nil
}

func ReadProject(projectDir string) (*ProjectDetail, error) {
	dir := filepath.Clean(projectDir)
	name := filepath.Base(dir)
	indexPath := filepath.Join(dir, "index.html")
	hasIndexHtml := false
	if _, err := os.Stat(indexPath); err == nil {
		hasIndexHtml = true
	}

	khung := "doc"
	if hasIndexHtml {
		if data, err := os.ReadFile(indexPath); err == nil {
			if strings.Contains(string(data), `name="bee-khung" content="ngang"`) {
				khung = "ngang"
			}
		}
	}

	scriptPath := filepath.Join(dir, "script-90s.txt")
	var lines []string
	if data, err := os.ReadFile(scriptPath); err == nil {
		rawLines := strings.Split(string(data), "\n")
		for _, l := range rawLines {
			t := strings.TrimSpace(l)
			if t != "" {
				lines = append(lines, t)
			}
		}
	}

	prevSettings, _ := ReadPreviewSettings(dir)

	// Estimate sentence counts per slide: by default, 1 hook for slide 1, then roughly 3-4 sentences per slide
	sentenceCounts := []int{}
	if len(lines) > 0 {
		for range lines {
			sentenceCounts = append(sentenceCounts, 1)
		}
	}

	return &ProjectDetail{
		ProjectPath:     dir,
		Name:            name,
		Lines:           lines,
		SentenceCounts:  sentenceCounts,
		PreviewSettings: prevSettings,
		PreDelays:       map[string]interface{}{},
		HasIndexHtml:    hasIndexHtml,
		Khung:           khung,
	}, nil
}

func CreateVideoProject(root string, name string, khung string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		name = fmt.Sprintf("video-%d", time.Now().Unix())
	}
	deckDir := filepath.Join(root, name)
	if err := os.MkdirAll(deckDir, 0755); err != nil {
		return "", err
	}

	metaKhung := "doc"
	if khung == "ngang" {
		metaKhung = "ngang"
	}

	// du-an-video.json
	dv := map[string]interface{}{
		"loai":     "video",
		"phienBan": 1,
		"khung":    metaKhung,
		"taoLuc":   FormatTimestampNow(),
	}
	dvBytes, _ := json.MarshalIndent(dv, "", "  ")
	_ = os.WriteFile(filepath.Join(deckDir, "du-an-video.json"), dvBytes, 0644)

	// index.html
	indexHtml := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="bee-khung" content="%s">
  <title>%s</title>
</head>
<body style="margin:0; background:#000; overflow:hidden;">
  <div id="deck" class="deck"></div>
</body>
</html>`, metaKhung, name)
	_ = os.WriteFile(filepath.Join(deckDir, "index.html"), []byte(indexHtml), 0644)

	// du-an.json
	timeline := DefaultTimelineProject(metaKhung == "doc")
	_ = WriteTimelineProject(deckDir, timeline)

	// preview-settings.json
	_ = WritePreviewSettings(deckDir, map[string]interface{}{
		"subtitles": map[string]interface{}{
			"enabled":  true,
			"fontSize": 18,
			"bottom":   100,
			"maxLines": 1,
		},
	})

	return deckDir, nil
}

func CreateFromTemplate(root string, templateID string, name string, templateRootDir string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		name = fmt.Sprintf("deck-%d", time.Now().Unix())
	}
	deckDir := filepath.Join(root, name)
	if err := os.MkdirAll(deckDir, 0755); err != nil {
		return "", err
	}

	srcTemplateDir := filepath.Join(templateRootDir, templateID)
	if _, err := os.Stat(srcTemplateDir); err != nil {
		// fallback to beeknoee-slide-starter
		srcTemplateDir = filepath.Join(templateRootDir, "beeknoee-slide-starter")
	}

	if err := CopyDir(srcTemplateDir, deckDir); err != nil {
		return "", err
	}

	return deckDir, nil
}
