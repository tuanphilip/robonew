package backend

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

type RenderJobState struct {
	ID         string  `json:"id"`
	Running    bool    `json:"running"`
	Progress   float64 `json:"progress"` // 0.0 - 1.0
	Step       string  `json:"step"`     // "Khởi tạo...", "Render khung hình...", "Mux âm thanh..."
	Error      string  `json:"error,omitempty"`
	ProjectDir string  `json:"projectDir"`
	OutputFile string  `json:"outputFile,omitempty"`
	StartTime  int64   `json:"startTime"`
}

type RenderManager struct {
	mu       sync.Mutex
	jobState RenderJobState
	cancelFn context.CancelFunc
}

func NewRenderManager() *RenderManager {
	return &RenderManager{
		jobState: RenderJobState{
			ID:      "idle",
			Running: false,
		},
	}
}

func (rm *RenderManager) GetStatus() RenderJobState {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	return rm.jobState
}

func (rm *RenderManager) Cancel() {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	if rm.cancelFn != nil {
		rm.cancelFn()
		rm.cancelFn = nil
	}
	rm.jobState.Running = false
	rm.jobState.Step = "Đã hủy"
}

func (rm *RenderManager) StartRender(projectDir string, outputName string, onProgress func(step string, pct float64)) error {
	rm.mu.Lock()
	if rm.jobState.Running {
		rm.mu.Unlock()
		return fmt.Errorf("một lượt dựng đang chạy")
	}

	ctx, cancel := context.WithCancel(context.Background())
	rm.cancelFn = cancel

	projectDir = filepath.Clean(projectDir)
	deckName := filepath.Base(projectDir)
	if outputName == "" {
		outputName = deckName + ".mp4"
	}
	outDir := filepath.Join(projectDir, "output")
	_ = os.MkdirAll(outDir, 0755)
	finalVideoPath := filepath.Join(outDir, outputName)

	rm.jobState = RenderJobState{
		ID:         deckName,
		Running:    true,
		Progress:   0.0,
		Step:       "Chuẩn bị tài nguyên...",
		ProjectDir: projectDir,
		OutputFile: finalVideoPath,
		StartTime:  time.Now().UnixMilli(),
	}
	rm.mu.Unlock()

	go func() {
		defer func() {
			rm.mu.Lock()
			rm.jobState.Running = false
			rm.mu.Unlock()
		}()

		err := rm.executeRender(ctx, projectDir, finalVideoPath, onProgress)
		rm.mu.Lock()
		if err != nil {
			rm.jobState.Error = err.Error()
			rm.jobState.Step = "Lỗi dựng: " + err.Error()
		} else {
			rm.jobState.Progress = 1.0
			rm.jobState.Step = "Hoàn tất!"
		}
		rm.mu.Unlock()
	}()

	return nil
}

func (rm *RenderManager) executeRender(ctx context.Context, projectDir string, outputPath string, onProgress func(step string, pct float64)) error {
	// 1. Setup local HTTP file server for slide assets
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return fmt.Errorf("failed to start local server: %w", err)
	}
	defer listener.Close()

	port := listener.Addr().(*net.TCPAddr).Port
	server := &http.Server{
		Handler: http.FileServer(http.Dir(projectDir)),
	}
	go func() {
		_ = server.Serve(listener)
	}()
	defer func() {
		_ = server.Shutdown(context.Background())
	}()

	// 2. Measure slide or audio duration
	audioFile := ""
	for _, cand := range []string{
		filepath.Join(projectDir, "output", "voiceover_concat_render.mp3"),
		filepath.Join(projectDir, "output", "full_voiceover.mp3"),
		filepath.Join(projectDir, "voiceover.mp3"),
		filepath.Join(projectDir, "meta.mp3"),
	} {
		if _, err := os.Stat(cand); err == nil {
			audioFile = cand
			break
		}
	}

	totalDurationSec := 24.0 // fallback duration nếu không có audio
	if audioFile != "" {
		if info, err := ProbeMedia(audioFile); err == nil && info.Duration > 0 {
			totalDurationSec = info.Duration + 1.2 // Thêm 1.2s padding dứt câu tự nhiên
		}
	}

	fps := 20
	totalFrames := int(totalDurationSec * float64(fps))
	if totalFrames < 20 {
		totalFrames = 20
	}

	// Read frame format
	isVertical := true
	if data, err := os.ReadFile(filepath.Join(projectDir, "index.html")); err == nil {
		if strings.Contains(string(data), `name="bee-khung" content="ngang"`) {
			isVertical = false
		}
	}

	captureW := 540
	captureH := 960
	if !isVertical {
		captureW = 960
		captureH = 540
	}

	renderW := 1080
	renderH := 1920
	if !isVertical {
		renderW = 1920
		renderH = 1080
	}

	// 2. Build Subtitles and Prepare _recording.html
	var subData *SubtitleData
	scriptPath := filepath.Join(projectDir, "script-90s.txt")
	if sBytes, err := os.ReadFile(scriptPath); err == nil {
		lines := strings.Split(string(sBytes), "\n")
		var validLines []string
		for _, l := range lines {
			t := strings.TrimSpace(l)
			if t != "" {
				validLines = append(validLines, t)
			}
		}
		if len(validLines) > 0 {
			subData = &SubtitleData{}

			// Tính thời lượng chính xác của từng dòng theo tỷ lệ số ký tự/từ
			totalWords := 0
			for _, lineText := range validLines {
				totalWords += len(strings.Fields(lineText))
			}
			if totalWords == 0 {
				totalWords = 1
			}

			curStart := 0.1
			for idx, lineText := range validLines {
				words := strings.Fields(lineText)
				wCount := len(words)
				lineRatio := float64(wCount) / float64(totalWords)
				lineDur := lineRatio * (totalDurationSec - 0.5)
				if lineDur < 2.0 {
					lineDur = 2.0
				}
				start := curStart
				end := start + lineDur - 0.15
				curStart = end + 0.15

				wDur := (end - start) / float64(wCount)
				var wList []struct {
					Text  string  `json:"text"`
					Start float64 `json:"start"`
					End   float64 `json:"end"`
				}
				for wIdx, wText := range words {
					wStart := start + float64(wIdx)*wDur
					wEnd := wStart + wDur
					wList = append(wList, struct {
						Text  string  `json:"text"`
						Start float64 `json:"start"`
						End   float64 `json:"end"`
					}{
						Text:  wText,
						Start: wStart,
						End:   wEnd,
					})
				}
				subData.Captions = append(subData.Captions, SubtitleCaption{
					Index: idx,
					Start: start,
					End:   end,
					Text:  lineText,
					Words: wList,
				})
			}
		}
	}

	// Generate recording HTML with animations and subtitles
	recHtmlPath, err := PrepareRecordingHtml(projectDir, captureW, captureH, isVertical, subData)
	if err != nil {
		return fmt.Errorf("failed to prepare recording HTML: %w", err)
	}
	defer os.Remove(recHtmlPath)

	if onProgress != nil {
		onProgress("Khởi chạy Chromium headless...", 0.05)
	}

	// 3. Setup Chromedp options
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.NoFirstRun,
		chromedp.NoDefaultBrowserCheck,
		chromedp.Headless,
		chromedp.DisableGPU,
		chromedp.WindowSize(captureW, captureH),
		chromedp.Flag("disable-web-security", true),
	)
	allocCtx, allocCancel := chromedp.NewExecAllocator(ctx, opts...)
	defer allocCancel()

	chromeCtx, chromeCancel := chromedp.NewContext(allocCtx)
	defer chromeCancel()

	slideURL := fmt.Sprintf("http://127.0.0.1:%d/_recording.html", port)

	// Load page and reveal slide 0 elements immediately
	err = chromedp.Do(chromeCtx,
		chromedp.Navigate(slideURL),
		chromedp.WaitReady("body"),
		chromedp.Evaluate[chromedp.Void](`
			(function() {
				var s0 = document.querySelector('.slide[data-slide="0"]');
				if (s0) {
					s0.classList.add('active');
					s0.querySelectorAll('.slide-element').forEach(function(el) { el.classList.add('visible'); });
				}
			})();
		`),
	)
	if err != nil {
		return fmt.Errorf("chromedp navigate failed: %w", err)
	}

	// 4. Determine timeline slide changes
	numSlides := 6
	if subData != nil && len(subData.Captions) > 0 {
		numSlides = len(subData.Captions)
	}

	var clickTimes []float64
	if subData != nil && len(subData.Captions) == numSlides {
		for s := 1; s < numSlides; s++ {
			// Chuyển slide khi câu trước đó vừa đọc xong
			clickTimes = append(clickTimes, subData.Captions[s].Start-0.08)
		}
	} else {
		slideInterval := totalDurationSec / float64(numSlides)
		for s := 1; s < numSlides; s++ {
			baseT := float64(s) * slideInterval
			clickTimes = append(clickTimes, baseT)
		}
	}

	// 5. Setup audio and FFmpeg
	bgmFile := ""
	for _, cand := range []string{
		filepath.Join(projectDir, "preview-assets", "bgm", "meta.mp3"),
		filepath.Join(projectDir, "meta.mp3"),
	} {
		if _, err := os.Stat(cand); err == nil {
			bgmFile = cand
			break
		}
	}

	ffmpeg := FindFFmpeg()
	args := []string{
		"-y",
		"-f", "image2pipe",
		"-vcodec", "mjpeg",
		"-framerate", strconv.Itoa(fps),
		"-i", "-",
	}

	hasAudio := false
	if audioFile != "" && bgmFile != "" && audioFile != bgmFile {
		hasAudio = true
		args = append(args,
			"-i", audioFile,
			"-stream_loop", "-1", "-i", bgmFile,
			"-filter_complex", fmt.Sprintf("[2:a]volume=0.18,atrim=0:%.2f[bgm];[1:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]", totalDurationSec),
			"-map", "0:v:0",
			"-map", "[aout]",
		)
	} else if audioFile != "" {
		hasAudio = true
		args = append(args, "-i", audioFile, "-t", fmt.Sprintf("%.2f", totalDurationSec))
	} else if bgmFile != "" {
		hasAudio = true
		args = append(args, "-stream_loop", "-1", "-i", bgmFile, "-t", fmt.Sprintf("%.2f", totalDurationSec))
	}

	args = append(args,
		"-vf", fmt.Sprintf("scale=%d:%d:flags=lanczos,pad=%d:%d:(ow-iw)/2:(oh-ih)/2,setsar=1", renderW, renderH, renderW, renderH),
		"-c:v", "libx264",
		"-pix_fmt", "yuv420p",
		"-b:v", "2500k",
		"-maxrate", "3500k",
		"-bufsize", "5000k",
		"-preset", "veryfast",
	)
	if hasAudio {
		args = append(args, "-c:a", "aac", "-b:a", "192k")
	}
	args = append(args,
		"-t", fmt.Sprintf("%.2f", totalDurationSec),
		"-movflags", "+faststart",
		outputPath,
	)

	cmd := exec.CommandContext(ctx, ffmpeg, args...)
	var stderrBuf bytes.Buffer
	cmd.Stderr = &stderrBuf
	ffmpegIn, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("ffmpeg stdin pipe failed: %w", err)
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("ffmpeg start failed: %w", err)
	}

	// 6. Render frames loop with Snappy Animations & Click Dispatching
	dtSec := 1.0 / float64(fps)
	clickIdx := 0
	shotQuality := int64(92)
	shotSpeed := true

	for i := 0; i < totalFrames; i++ {
		select {
		case <-ctx.Done():
			_ = ffmpegIn.Close()
			_ = cmd.Process.Kill()
			return fmt.Errorf("quá trình dựng bị hủy")
		default:
		}

		currentTimeSec := float64(i) * dtSec

		// Check if we need to dispatch slide change animation
		targetSlideIdx := -1
		if clickIdx < len(clickTimes) && currentTimeSec >= clickTimes[clickIdx] {
			targetSlideIdx = clickIdx + 1
			clickIdx++
		}

		dispatchScript := fmt.Sprintf(`
			(function() {
				if (window.__syncSubtitleTime) {
					window.__syncSubtitleTime(%f);
				}
				if (%d >= 0 && window.__renderGoToSlide) {
					window.__renderGoToSlide(%d);
				}
			})();
		`, currentTimeSec, targetSlideIdx, targetSlideIdx)

		_ = chromedp.Do(chromeCtx,
			chromedp.Evaluate[chromedp.Void](dispatchScript),
		)

		buf, err := chromedp.Run(chromeCtx, func(ctx context.Context, t *chromedp.Target) ([]byte, error) {
			r, err := cdp.Call(ctx, t, page.CaptureScreenshot, page.CaptureScreenshotParams{
				Format:           page.CaptureScreenshotFormatJpeg,
				Quality:          &shotQuality,
				OptimizeForSpeed: &shotSpeed,
			})
			return r.Data, err
		})
		if err == nil && len(buf) > 0 {
			_, _ = ffmpegIn.Write(buf)
		}

		pct := 0.05 + float64(i)/float64(totalFrames)*0.90
		if onProgress != nil && i%15 == 0 {
			onProgress(fmt.Sprintf("Khung hình %d/%d (%.1fs)", i+1, totalFrames, currentTimeSec), pct)
		}
	}

	_ = ffmpegIn.Close()
	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("ffmpeg error: %v | stderr: %s", err, stderrBuf.String())
	}

	// Write info file (<video>.info.json)
	infoData := map[string]interface{}{
		"width":    renderW,
		"height":   renderH,
		"fps":      fps,
		"duration": totalDurationSec,
	}
	infoBytes, _ := json.MarshalIndent(infoData, "", "  ")
	_ = os.WriteFile(strings.TrimSuffix(outputPath, filepath.Ext(outputPath))+".info.json", infoBytes, 0644)

	return nil
}
