};
'use strict';
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const config = require('../config');
const { PythonSidecar } = require('../sidecar/rpcClient');

/**
 * Tiến trình Python (JSON-RPC): khởi động một lần, dọn khi chết, chuyển tiếp log/tiến độ.
 *
 * Tách từ main.js (02/09/2026, audit Phase 2.4/2.5). Cơ chế: main.js dựng `ctx`
 * (app, send, mainWindow(), sidecar()…) rồi gọi dangKy(ctx) từng module theo thứ
 * tự; hàm/hằng module này trả về được gộp vào ctx để module khác gọi qua
 * `ctx.tên`. Handler IPC đăng ký ngay trong dangKy — main.js gọi trước whenReady.
 */
function dangKy(ctx) {
  let sidecar = null;
  let sidecarReady = null;

  async function ensureSidecar() {
    if (sidecarReady) return sidecarReady;
    sidecar = new PythonSidecar({
      pythonPath: config.pythonPath(),
      scriptPath: config.pythonScript(),
      env: config.sidecarEnv(),
    });
    /* ⚠ MỌI listener đụng vào `sidecarReady` phải kiểm `sidecar === banNay`.
       Listener gắn vào TỪNG instance nhưng biến thì DÙNG CHUNG: tiến trình cũ
       bị kill chết muộn — sau khi bản mới đã lên — mà exit của nó null mất
       promise của bản mới, thì lần gọi sau spawn thêm một tiến trình nữa và
       bản đang khoẻ thành mồ côi ôm nguyên model Whisper trong RAM. */
    const banNay = sidecar;
    sidecar.on('log', (line) => ctx.send('sidecar:log', line));
    sidecar.on('notify', (m, p) => {
      if (m !== 'progress') return;
      // Tiến độ tải model đi kênh RIÊNG: nó xảy ra ở màn hình cài đặt lần đầu,
      // lúc chưa có job render nào. Nhét chung 'render:step' thì giao diện render
      // hiện tiến trình của việc không phải render.
      if (p.phase === 'model') {
        ctx.send('models:progress', p);
        return;
      }
      // Tải mô hình giọng TRÊN MÁY (python/tts/vieneu.py) — kênh riêng, không lái màn hình Whisper.
      if (p.phase === 'giong-may') {
        ctx.send('vieneu:progress', p);
        return;
      }
      if (p.message) ctx.send('render:step', { phase: p.phase || 'py', message: p.message });
    });
    sidecar.on('exit', () => {
      if (sidecar === banNay) sidecarReady = null;
      ctx.send('sidecar:exit', {});
    });
    /* ⚠ BẮT BUỘC phải nghe 'error'. EventEmitter phát 'error' mà không có
       listener thì NÉM thẳng thành ngoại lệ chưa bắt — bẫy uncaughtException
       nuốt nó, app chạy tiếp với trạng thái hỏng, và người bấm Tạo video chỉ
       thấy "Đang chờ tới lượt…" đứng im vĩnh viễn. Đã xảy ra thật trên Mac M1
       của khách khi tiến trình Python không khởi động được. */
    sidecar.on('error', (err) => {
      if (sidecar === banNay) sidecarReady = null;
      ctx.send('sidecar:log', `[LỖI] Không khởi động được bộ dựng video: ${err.message}`);
    });
    /* start() có thể NÉM ĐỒNG BỘ (Windows: spawn tệp hỏng ném ngay tại chỗ,
       không qua sự kiện 'error' như POSIX). Bọc lại để cả hai đường cùng ra một
       câu người dùng đọc được, thay vì "spawn UNKNOWN" trần trụi. */
    try {
      sidecarReady = sidecar.start();
    } catch (e) {
      throw new Error(`Không khởi động được bộ dựng video: ${e.message}`);
    }
    /* ⚠ Khởi động HỎNG thì phải cho lượt bấm sau THỬ LẠI.
       Thiếu nhánh này, `sidecarReady` giữ mãi một promise đã reject — mọi lần
       bấm Tạo video về sau đều nhận đúng lỗi cũ tức thì, dù nguyên nhân (như
       Gatekeeper quét bộ Python ở lần chạy đầu trên máy Mac) đã qua từ lâu.
       Giết luôn tiến trình dở dang: nó mà "tỉnh" muộn thì thành mồ côi, chiếm
       cổng và RAM mà không ai còn nói chuyện với nó. */
    sidecarReady.catch(() => {
      if (sidecar === banNay) sidecarReady = null;
      try { if (banNay.proc && !banNay.exited) banNay.proc.kill(); } catch { /* đã chết sẵn */ }
    });
    return sidecarReady;
  }

  return { ensureSidecar, sidecar: () => sidecar };
}

module.exports = { dangKy 