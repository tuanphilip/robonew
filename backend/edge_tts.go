package backend

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const (
	trustedClientToken  = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
	chromiumFullVersion = "143.0.3650.75"
	secMsGecVersion     = "1-" + chromiumFullVersion
	winEpoch            = int64(11644473600)
)

type WordTiming struct {
	Word       string `json:"word"`
	OffsetMs   int64  `json:"offsetMs"`
	DurationMs int64  `json:"durationMs"`
}

type TTSResult struct {
	AudioData  []byte       `json:"-"`
	Words      []WordTiming `json:"words"`
	DurationMs int64        `json:"durationMs"`
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func generateSecMsGec() string {
	nowUnix := time.Now().UTC().Unix()
	ticks := nowUnix + winEpoch
	ticks -= ticks % 300
	ticks100ns := float64(ticks) * 1e7
	strToHash := fmt.Sprintf("%.0f%s", ticks100ns, trustedClientToken)
	hash := sha256.Sum256([]byte(strToHash))
	return strings.ToUpper(hex.EncodeToString(hash[:]))
}

func SynthesizeEdge(text string, voice string, rate string) (*TTSResult, error) {
	if voice == "" {
		voice = "vi-VN-HoaiMyNeural"
	}
	if rate == "" {
		rate = "+0%"
	}

	connID := randomHex(16)
	secGec := generateSecMsGec()

	url := fmt.Sprintf("wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=%s&ConnectionId=%s&Sec-MS-GEC=%s&Sec-MS-GEC-Version=%s",
		trustedClientToken, connID, secGec, secMsGecVersion)

	headers := http.Header{}
	headers.Set("Pragma", "no-cache")
	headers.Set("Cache-Control", "no-cache")
	headers.Set("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
	headers.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0")

	dialer := websocket.DefaultDialer
	conn, resp, err := dialer.Dial(url, headers)
	if err != nil {
		if resp != nil {
			return nil, fmt.Errorf("websocket dial failed (status %d): %w", resp.StatusCode, err)
		}
		return nil, fmt.Errorf("websocket dial failed: %w", err)
	}
	defer conn.Close()

	// 1. Send speech.config
	now := time.Now().UTC().Format("Mon Jan 02 2006 15:04:05 GMT+0000 (Coordinated Universal Time)")
	cfgMsg := fmt.Sprintf("X-Timestamp:%s\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"true\"},\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}", now)
	if err := conn.WriteMessage(websocket.TextMessage, []byte(cfgMsg)); err != nil {
		return nil, fmt.Errorf("send config failed: %w", err)
	}

	// 2. Send SSML
	reqID := randomHex(16)
	escapedText := strings.ReplaceAll(text, "&", "&amp;")
	escapedText = strings.ReplaceAll(escapedText, "<", "&lt;")
	escapedText = strings.ReplaceAll(escapedText, ">", "&gt;")
	ssml := fmt.Sprintf("<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'><voice name='%s'><prosody pitch='+0Hz' rate='%s' volume='+0%%'>%s</prosody></voice></speak>", voice, rate, escapedText)
	ssmlMsg := fmt.Sprintf("X-RequestId:%s\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:%s\r\nPath:ssml\r\n\r\n%s", reqID, now, ssml)
	if err := conn.WriteMessage(websocket.TextMessage, []byte(ssmlMsg)); err != nil {
		return nil, fmt.Errorf("send ssml failed: %w", err)
	}

	var audioBuffer bytes.Buffer
	var words []WordTiming

	for {
		msgType, p, err := conn.ReadMessage()
		if err != nil {
			break
		}

		if msgType == websocket.BinaryMessage {
			if len(p) >= 2 {
				headerLen := int(p[0])<<8 | int(p[1])
				if len(p) >= 2+headerLen {
					header := string(p[2 : 2+headerLen])
					if strings.Contains(header, "Path:audio") {
						audioData := p[2+headerLen:]
						audioBuffer.Write(audioData)
					}
				}
			}
		} else if msgType == websocket.TextMessage {
			textMsg := string(p)
			if strings.Contains(textMsg, "Path:audio.metadata") {
				idx := strings.Index(textMsg, "\r\n\r\n")
				if idx != -1 {
					body := textMsg[idx+4:]
					var meta struct {
						Metadata []struct {
							Type string `json:"Type"`
							Data struct {
								Offset   int64 `json:"Offset"`
								Duration int64 `json:"Duration"`
								Text     struct {
									Text string `json:"Text"`
								} `json:"text"`
							} `json:"Data"`
						} `json:"Metadata"`
					}
					if err := json.Unmarshal([]byte(body), &meta); err == nil {
						for _, m := range meta.Metadata {
							if m.Type == "WordBoundary" {
								words = append(words, WordTiming{
									Word:       m.Data.Text.Text,
									OffsetMs:   m.Data.Offset / 10000,
									DurationMs: m.Data.Duration / 10000,
								})
							}
						}
					}
				}
			} else if strings.Contains(textMsg, "Path:turn.end") {
				break
			}
		}
	}

	totalMs := int64(0)
	if len(words) > 0 {
		last := words[len(words)-1]
		totalMs = last.OffsetMs + last.DurationMs
	}

	return &TTSResult{
		AudioData:  audioBuffer.Bytes(),
		Words:      words,
		DurationMs: totalMs,
	}, nil
}
