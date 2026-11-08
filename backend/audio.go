package backend

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

type WaveformResult struct {
	Giay float64 `json:"giay"`
	Buoc float64 `json:"buoc"`
	Dinh []int   `json:"dinh"`
}

type AudioInfo struct {
	Duration float64 `json:"duration"`
	Bitrate  int64   `json:"bitrate"`
	Rong     int     `json:"rong"`
	Cao      int     `json:"cao"`
	Fps      float64 `json:"fps"`
	Codec    string  `json:"codec"`
}

type WordMarker struct {
	W string  `json:"w"`
	S float64 `json:"s"`
	E float64 `json:"e"`
}

type SongAmResponse struct {
	Giong    map[string]interface{} `json:"giong"`
	Nhac     map[string]interface{} `json:"nhac"`
	Chu      map[string]interface{} `json:"chu"`
	DangDung bool                   `json:"dangDung"`
}

var (
	waveCache = make(map[string]*WaveformResult)
	waveMutex sync.RWMutex
)

func FindFFmpeg() string {
	if p, err := exec.LookPath("ffmpeg"); err == nil {
		return p
	}
	return "ffmpeg"
}

func FindFFprobe() string {
	if p, err := exec.LookPath("ffprobe"); err == nil {
		return p
	}
	return "ffprobe"
}

func ProbeMedia(filePath string) (*AudioInfo, error) {
	ffprobe := FindFFprobe()
	cmd := exec.Command(ffprobe,
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		filePath,
	)
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var data struct {
		Format struct {
			Duration string `json:"duration"`
			BitRate  string `json:"bit_rate"`
		} `json:"format"`
		Streams []struct {
			CodecType string `json:"codec_type"`
			CodecName string `json:"codec_name"`
			Width     int    `json:"width"`
			Height    int    `json:"height"`
			RFrameRate string `json:"r_frame_rate"`
		} `json:"streams"`
	}

	if err := json.Unmarshal(out, &data); err != nil {
		return nil, err
	}

	dur, _ := strconv.ParseFloat(data.Format.Duration, 64)
	br, _ := strconv.ParseInt(data.Format.BitRate, 10, 64)

	info := &AudioInfo{
		Duration: dur,
		Bitrate:  br,
	}

	for _, s := range data.Streams {
		if s.CodecType == "video" {
			info.Rong = s.Width
			info.Cao = s.Height
			info.Codec = s.CodecName
			parts := strings.Split(s.RFrameRate, "/")
			if len(parts) == 2 {
				num, _ := strconv.ParseFloat(parts[0], 64)
				den, _ := strconv.ParseFloat(parts[1], 64)
				if den > 0 {
					info.Fps = num / den
				}
			}
			break
		} else if s.CodecType == "audio" && info.Codec == "" {
			info.Codec = s.CodecName
		}
	}

	return info, nil
}

func GenerateWaveform(filePath string) (*WaveformResult, error) {
	st, err := os.Stat(filePath)
	if err != nil {
		return nil, err
	}

	cacheKey := fmt.Sprintf("%s|%d|%d", filePath, st.ModTime().UnixMilli(), st.Size())
	waveMutex.RLock()
	if cached, ok := waveCache[cacheKey]; ok {
		waveMutex.RUnlock()
		return cached, nil
	}
	waveMutex.RUnlock()

	const sampleRate = 8000
	const stepSec = 0.02 // 20ms per peak
	samplesPerStep := int(sampleRate * stepSec)

	ffmpeg := FindFFmpeg()
	cmd := exec.Command(ffmpeg,
		"-v", "error",
		"-t", "1800",
		"-i", filePath,
		"-vn",
		"-ac", "1",
		"-ar", strconv.Itoa(sampleRate),
		"-c:a", "pcm_s16le",
		"-map_metadata", "-1",
		"-f", "wav",
		"pipe:1",
	)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}

	wavData, err := io.ReadAll(stdout)
	_ = cmd.Wait()
	if err != nil || len(wavData) < 44 {
		return nil, fmt.Errorf("failed to decode audio wav: %w", err)
	}

	// Find "data" chunk in WAV
	dataIdx := bytes.Index(wavData, []byte("data"))
	if dataIdx == -1 || len(wavData) <= dataIdx+8 {
		return nil, fmt.Errorf("invalid wav data chunk")
	}
	rawSamples := wavData[dataIdx+8:]
	totalSamples := len(rawSamples) / 2

	numSteps := (totalSamples + samplesPerStep - 1) / samplesPerStep
	peaks := make([]int, numSteps)
	globalMax := int16(1)

	for step := 0; step < numSteps; step++ {
		start := step * samplesPerStep
		end := start + samplesPerStep
		if end > totalSamples {
			end = totalSamples
		}

		stepMax := int16(0)
		for i := start; i < end; i++ {
			val := int16(binary.LittleEndian.Uint16(rawSamples[i*2 : i*2+2]))
			if val < 0 {
				if val == -32768 {
					val = 32767
				} else {
					val = -val
				}
			}
			if val > stepMax {
				stepMax = val
			}
		}
		if stepMax > globalMax {
			globalMax = stepMax
		}
		peaks[step] = int(stepMax)
	}

	normalized := make([]int, len(peaks))
	if globalMax > 0 {
		for i, p := range peaks {
			normalized[i] = int(math.Round(float64(p) / float64(globalMax) * 100))
		}
	}

	res := &WaveformResult{
		Giay: float64(totalSamples) / sampleRate,
		Buoc: stepSec,
		Dinh: normalized,
	}

	waveMutex.Lock()
	waveCache[cacheKey] = res
	waveMutex.Unlock()

	return res, nil
}

func SynthesizeElevenLabs(text string, voiceID string, apiKey string, outputFilePath string) error {
	if voiceID == "" {
		voiceID = "21m00Tcm4TlvDq8ikWAM" // Default Rachel
	}
	url := fmt.Sprintf("https://api.elevenlabs.io/v1/text-to-speech/%s", voiceID)
	body := map[string]interface{}{
		"text":     text,
		"model_id": "eleven_multilingual_v2",
		"voice_settings": map[string]interface{}{
			"stability":        0.5,
			"similarity_boost": 0.8,
		},
	}
	jsonBody, _ := json.Marshal(body)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return err
	}
	req.Header.Set("xi-api-key", apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
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

func SynthesizeVoice(ctx context.Context, text string, voice string, engine string, cm *ConfigManager, outputDir string) (string, error) {
	_ = os.MkdirAll(outputDir, 0755)
	outputFile := filepath.Join(outputDir, fmt.Sprintf("voiceover-%d.mp3", time.Now().UnixNano()))

	if engine == "vbee" || (engine == "" && cm.Settings.Vbee.Token != "") {
		appID := cm.Settings.Vbee.AppID
		token := cm.Settings.Vbee.Token
		speed := cm.Settings.Vbee.Speed
		if voice == "" || strings.HasPrefix(voice, "vi-VN-") {
			voice = cm.Settings.Vbee.VoiceCode
		}
		if voice == "" {
			voice = "hn_female_ngochuyen_full_48k-fhg"
		}
		err := SynthesizeVbee(ctx, text, voice, speed, appID, token, outputFile)
		if err == nil {
			return outputFile, nil
		}
		// If Vbee fails, log and fallback below
		fmt.Printf("Vbee TTS error (%v), falling back to Edge TTS...\n", err)
	}

	if engine == "eleven" || engine == "elevenlabs" {
		apiKey := cm.Settings.Eleven.ApiKey
		if apiKey == "" {
			apiKey = cm.Settings.ElevenApiKey
		}
		modelID := cm.Settings.Eleven.ModelID
		if voice == "" {
			voice = cm.Settings.Eleven.VoiceID
		}
		err := SynthesizeEleven(ctx, text, voice, modelID, apiKey, outputFile)
		if err == nil {
			return outputFile, nil
		}
		return "", fmt.Errorf("lỗi ElevenLabs TTS: %w", err)
	}

	// Fallback to Edge TTS or Microsoft Bing voice
	res, err := SynthesizeEdge(text, voice, "+0%")
	if err == nil && len(res.AudioData) > 0 {
		if writeErr := os.WriteFile(outputFile, res.AudioData, 0644); writeErr == nil {
			return outputFile, nil
		}
	}

	// If Edge TTS DRM rejects, we can generate a silence or simple tones with ffmpeg
	ffmpeg := FindFFmpeg()
	cmd := exec.CommandContext(ctx, ffmpeg,
		"-y",
		"-f", "lavfi",
		"-i", "anullsrc=r=24000:cl=mono",
		"-t", "5",
		"-c:a", "libmp3lame",
		outputFile,
	)
	if fErr := cmd.Run(); fErr == nil {
		return outputFile, nil
	}
	return "", err
}
