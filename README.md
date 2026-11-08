# Robonew Studio

> **High-Performance Desktop Motion Slide Video Engine — Built with Go, Wails v2, Webview2, Chromedp & Native FFmpeg**

Robonew Studio là ứng dụng desktop thế hệ mới chuyên sản xuất video ngắn dạng slide chuyển động tỷ lệ 9:16 (TikTok, Reels, YouTube Shorts) từ HTML/CSS. Ứng dụng được viết lại hoàn toàn từ Beeknoee Studio bằng Go + Wails v2 để tối ưu hóa triệt để hiệu năng: dung lượng siêu nhẹ (~21MB), tiêu tốn cực ít RAM (~33MB so với >500MB của Electron), và render mượt mà bằng Chromedp + FFmpeg pipe.

---

## 🚀 Tính năng nổi bật

1. **Custom LLM Endpoint (OpenAI-Compatible)**:
   - Tự do kết nối với bất kỳ proxy / self-hosted AI nào (9Router, Ollama, DeepSeek, OpenAI, OpenRouter, vLLM...).
   - Hỗ trợ chọn model, kiểm tra độ trễ (latency ping), stream SSE và sinh kịch bản 6 câu chuẩn hook short-form.

2. **Giọng đọc AI đa kênh (TTS Engine)**:
   - **Vbee AIVoice Studio**: Giọng đọc MC chuẩn tiếng Việt truyền cảm (Ngọc Huyền, Mạnh Dũng, Thu Trang...).
   - **Microsoft Edge-TTS**: Fallback tốc độ cao với giao thức WebSocket Cognitive Services mới nhất.
   - **ElevenLabs**: Đọc đa ngôn ngữ chất lượng cao.

3. **Typography & Font Lexend Chuẩn Tiếng Việt**:
   - Tích hợp sẵn font **Lexend** offline cho toàn bộ slide và phụ đề.
   - Xử lý hoàn hảo các ký tự có dấu thanh tiếng Việt, không bị lỗi font hay vỡ dấu trên thiết bị di động.

4. **Phụ đề Karaoke Đồng bộ**:
   - Phụ đề dạng capsule/pill mờ viền sáng chuẩn safezone TikTok/Reels.
   - Hiệu ứng highlight từ đang đọc theo thời gian thực đồng bộ cùng voiceover.

5. **Render Video 1080x1920 Chuẩn Mạng Xã Hội**:
   - Xuất video H.264 High Profile, audio AAC chất lượng cao.
   - Tự động đo thời lượng audio để căn chỉnh nhịp chuyển cảnh mượt mà, không bị tua nhanh.

---

## 🛠 Tech Stack

- **Desktop Framework**: [Wails v2](https://wails.io/) + Microsoft Webview2
- **Backend**: Go 1.24+ (stdlib first, `chromedp`, `gorilla/websocket`, native `exec.Command`)
- **Frontend**: Vanilla HTML5, CSS3 Tokens, ES Modules
- **Compositing**: Native FFmpeg FilterGraph + Libx264

---

## 📦 Cài đặt & Chạy ứng dụng

### 1. Yêu cầu hệ thống
- Windows 10/11 x64
- [Go 1.23+](https://go.dev/)
- [Wails CLI v2](https://wails.io/docs/gettingstarted/installation) (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- FFmpeg (có trong PATH hệ thống)

### 2. Cấu hình
Sao chép `settings.example.json` thành `settings.json` và điền khóa API của bạn:
```bash
cp settings.example.json settings.json
```

### 3. Build file thực thi
```bash
wails build -s
```
File thực thi nằm tại `build/bin/robonew.exe`.
