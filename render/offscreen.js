};
'use strict';
/**
 * Lõi POC: BrowserWindow offscreen -> sự kiện `paint` -> framebuffer -> pacer 30fps
 * -> stdin của FFmpeg (rawvideo bgra).
 *
 * Trả lời POC-1 (frame đúng?), POC-4 (băng thông?), POC-5 (đứng yên có đủ frame?).
 * Xem DESKTOP_ARCHITECTURE.md §3.5.
 */
const { BrowserWindow, session } = require('electron');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const config = require('../config');

function resolveTool(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  const dir = config.ffmpegDir();
  return dir ? path.join(dir, exe) : exe;
}

/**
 * Tỉ lệ điểm ảnh sẽ áp lên bitmap paint của cửa sổ offscreen.
 *
 * ⚠ VÌ SAO KHÔNG TIN `force-device-scale-factor=1`. Đo 02/09/2026 trên
 * MacBook M3 Retina (macOS 26.6, Electron 33): cờ đã đặt ở dòng lệnh mà mỗi
 * bitmap paint về vẫn 2160×3840 — đúng 4 lần số byte của khung 1080×1920 —
 * nên bộ ghi coi tất cả là "khung hụt", không ghi được khung nào và video ra
 * rỗng. `enableDeviceEmulation` thì sập SIGSEGV (gọi trước loadURL) hoặc treo
 * (gọi sau). Cách chắc: tạo cửa sổ ở kích thước CSS = đích ÷ tỉ lệ, để
 * Chromium raster ở tỉ lệ thật ra đúng số điểm ảnh — chữ còn nét hơn.
 *
 * Chỉ áp trên macOS: trên Windows cờ dòng lệnh có tác dụng (mọi khách Windows
 * đang render bình thường), đổi đường ở đó là rước rủi ro vô cớ.
 * Chỉ áp khi chia HẾT (1080/2, 1920/2, 720/2, 1280/2…) — lẻ thì giữ 1 như cũ.
 */
function tiLeDiemAnh(width, height) {
  if (process.platform !== 'darwin') return 1;
  try {
    const { screen } = require('electron');
    const k = Number(screen.getPrimaryDisplay().scaleFactor) || 1;
    if (k > 1 && Number.isInteger(width / k) && Number.isInteger(height / k)) return k;
  } catch { /* screen chưa sẵn sàng — giữ 1 */ }
  return 1;
}

/* ══ Sổ recorder đang ghi (audit Phase 4.4, 02/09/2026) ═══════════════════════
 *
 * Đóng app giữa lúc quay (đóng cửa sổ, Cmd+Q) thì tiến trình ffmpeg con thành
 * mồ côi: nó chờ khung hình trên stdin mãi, chiếm CPU/RAM và giữ tệp .mp4 dở.
 * `will-quit` trước đây chỉ dọn preview. Nay mọi recorder mở đều ghi vào sổ
 * này; `dungTatCa()` dừng êm (ffmpeg viết nốt moov rồi thoát), quá hạn thì
 * SIGKILL; `dangKyDungKhiThoat(app)` móc vào `before-quit` của Electron. */
const DANG_GHI = new Set();

/** Dừng mọi recorder đang mở. Trả về số recorder đã xử lý. */
async function dungTatCa(hanMs = 3000) {
  const ds = [...DANG_GHI];
  for (const r of ds) {
    const ff = r.ffmpeg;
    await Promise.race([
      r.stop().catch(() => { /* lỗi lúc đóng không quan trọng nữa, đang thoát */ }),
      new Promise((res) => setTimeout(res, hanMs)),
    ]);
    if (ff && ff.exitCode === null && !ff.signalCode) {
      try { ff.kill('SIGKILL'); } catch { /* đã chết sẵn */ }
    }
    DANG_GHI.delete(r);
  }
  return ds.length;
}

/**
 * Móc vào vòng đời app: `before-quit` có recorder đang chạy thì hoãn thoát,
 * dừng xong mới `app.quit()` lại (lần hai đi thẳng — cờ `daDung`). Không dùng
 * `app.exit()` ở đây vì nó bỏ qua `will-quit` (dọn _preview.html).
 */
function dangKyDungKhiThoat(app) {
  let dangDung = null;   // promise dừng đang chạy; .xong = true khi đã dừng hết
  app.on('before-quit', (e) => {
    if (dangDung && dangDung.xong) return;     // đã dừng xong → cho thoát (kể cả quit bị ai đó hoãn rồi gọi lại)
    if (!dangDung && !DANG_GHI.size) return;   // không có gì đang ghi → cho thoát
    e.preventDefault();                        // đang dừng, hoặc cần dừng: hoãn — kể cả bấm Thoát lần hai
    if (!dangDung) {
      const p = dungTatCa().catch(() => {}).then(() => { p.xong = true; app.quit(); });
      p.xong = false;
      dangDung = p;
    }
  });
}

class OffscreenRecorder {
  constructor(opts) {
    this.width = opts.width || 1080;
    this.height = opts.height || 1920;
    /* Tỉ lệ điểm ảnh của màn hình (Retina = 2). Cửa sổ offscreen được tạo ở
       kích thước CSS = đích ÷ tỉ lệ, để bitmap paint ra ĐÚNG width×height.
       Xem OffscreenRecorder.tiLeDiemAnh() vì sao không dùng cờ dòng lệnh. */
    this.cssScale = Number(opts.cssScale) > 0 ? Number(opts.cssScale) : 1;
    this.cssWidth = Math.round(this.width / this.cssScale);
    this.cssHeight = Math.round(this.height / this.cssScale);
    this.fps = opts.fps || 30;
    this.htmlPath = opts.htmlPath;
    this.outFile = opts.outFile;
    this.muteAudio = opts.muteAudio !== false;
    this.encodeArgs = opts.encodeArgs || [
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '14', '-pix_fmt', 'yuv420p',
    ];

    this.win = null;
    this.ffmpeg = null;
    this.pacer = null;
    // Trần buffer stdin của FFmpeg: 8 frame (~66 MB ở 1080x1920).
    this.maxPendingBytesCap = opts.maxPendingBytesCap || this.width * this.height * 4 * 8;
    // Chặn mọi request ra ngoài khi render: chứng minh không còn phụ thuộc CDN
    // và không rò rỉ IP người dùng. Font đã bundle nên không cần mạng.
    this.blockNetwork = opts.blockNetwork !== false;
    this.blockedRequests = [];
    this.latestFrame = null;
    this.latestFrameSeq = 0;
    this.lastWrittenSeq = -1;

    this.stats = {
      paintCount: 0,
      firstPaintAt: null,
      lastPaintAt: null,
      imageSizes: new Set(),
      dirtyRects: [],
      fullFrameBytes: this.width * this.height * 4,
      bitmapBytesTotal: 0,
      bitmapCopyMs: 0,
      pacerTicks: 0,
      framesWritten: 0,
      framesRepeated: 0,
      maxPendingBytes: 0,
      pendingBytesSum: 0,
      pendingSamples: 0,
      lateTicks: 0,
      maxTickGapMs: 0,
      startedAt: null,
      stoppedAt: null,
      ffmpegStderrTail: [],
    };
  }

  async open() {
    DANG_GHI.add(this);
    this.win = new BrowserWindow({
      show: false,
      width: this.cssWidth,
      height: this.cssHeight,
      frame: false,
      // BẮT BUỘC trên Windows: không có cờ này Electron kẹp chiều cao cửa sổ
      // xuống work area của màn hình (đo được: 1528px) nên không bao giờ lấy
      // được frame 1920px. Tài liệu Electron ghi đây là tuỳ chọn "macOS" nhưng
      // thực nghiệm cho thấy Windows cũng cần. Xem DIAG-2.
      enableLargerThanScreen: true,
      webPreferences: {
        offscreen: true,
        backgroundThrottling: false,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        autoplayPolicy: 'no-user-gesture-required',
        /* Phiên mạng RIÊNG (trong bộ nhớ). `onBeforeRequest` bên dưới chỉ có MỘT bộ lọc mỗi
           phiên và không tự gỡ khi cửa sổ đóng — cài trên phiên mặc định là sau mỗi lượt
           "Tạo video", cửa sổ chính (khung deck…) bị chặn mọi http/https tới khi tắt app
           (đo 10/10/2026). Cùng bẫy với cửa sổ chụp bìa (CONTEXT.md, `partition: 'bia-tam'`).
           Trang quay chỉ dùng `file://` (engine, phông, tài nguyên deck) nên phiên nào cũng nạp
           được; kho localStorage rỗng mỗi lần — ở chế độ quay engine không đọc kho đó. */
        partition: 'quay-video',
      },
    });
    // Phải gọi lại sau khi tạo: kích thước lúc khởi tạo vẫn bị kẹp.
    this.win.setContentSize(this.cssWidth, this.cssHeight);

    const wc = this.win.webContents;
    /* Chặn mạng (tuỳ `blockNetwork`) + RÀO `file://` (24/10/2026, LUÔN bật): trang quay chạy
       `app.js` của deck — agent ghi được — và trang `file://` đọc được mọi tệp trên máy rồi in
       lên video. Chỉ cho thư mục deck (nơi `_recording.html` nằm) + engine / phông của app — xem
       `main/raoCuaSoAn.js`. Đi qua MỘT bộ lọc của cả phiên: gọi `onBeforeRequest` riêng ở đây là
       thay mất rào. */
    require('../main/raoCuaSoAn').rao(wc, {
      deckDir: path.dirname(path.resolve(this.htmlPath)),
      chanMang: this.blockNetwork,
      khiChan: (url, loai) => {
        if (this.blockedRequests.length < 50) this.blockedRequests.push(`${loai === 'mang' ? '' : `${loai}: `}${url.slice(0, 160)}`);
      },
    });
    wc.setFrameRate(this.fps);
    if (this.muteAudio) wc.setAudioMuted(true);

    wc.on('paint', (_event, dirty, image) => {
      const s = this.stats;
      const now = performance.now();
      if (s.firstPaintAt === null) s.firstPaintAt = now;
      s.lastPaintAt = now;
      s.paintCount += 1;

      try {
        const size = image.getSize();
        s.imageSizes.add(`${size.width}x${size.height}`);
      } catch { /* bỏ qua */ }

      if (dirty && s.dirtyRects.length < 40) {
        s.dirtyRects.push(`${dirty.width}x${dirty.height}@${dirty.x},${dirty.y}`);
      }

      // Chỉ copy bitmap khi đang ghi — copy là chi phí CPU thật, cần đo.
      if (this.ffmpeg) {
        const t0 = performance.now();
        const buf = image.getBitmap();
        s.bitmapCopyMs += performance.now() - t0;
        s.bitmapBytesTotal += buf.length;
        if (buf.length === s.fullFrameBytes) {
          this.latestFrame = buf;
          this.latestFrameSeq += 1;
        } else {
          // Ảnh không đủ khung hình đầy đủ -> ghi nhận, đây là phát hiện quan trọng.
          s.partialFrameBytes = buf.length;
        }
      }
    });

    /* ⚠ ÉP TỈ LỆ ĐIỂM ẢNH = 1 NGAY TRÊN CỬA SỔ NÀY.
       `force-device-scale-factor=1` ở dòng lệnh KHÔNG đủ: đo 02/09 trên
       MacBook M3 Retina (macOS 26, Electron 33) mỗi bitmap paint về là
       2160×3840 — đúng 4 lần số byte mong đợi — nên nhánh dưới coi tất cả là
       "khung hụt", latestFrame không bao giờ được đặt và video ra 0 khung
       (hỏng ở bước ghép với một câu lỗi ffmpeg vô nghĩa). Emulation thiết bị
       gắn theo webContents nên hệ điều hành/màn hình không đè được. */
    await wc.loadURL(pathToFileURL(this.htmlPath).href);
    await new Promise((r) => setTimeout(r, 300));
    return this;
  }

  startEncoder() {
    const args = [
      '-hide_banner', '-loglevel', 'warning', '-y',
      '-f', 'rawvideo',
      '-pix_fmt', 'bgra',
      '-s', `${this.width}x${this.height}`,
      '-r', String(this.fps),
      '-i', 'pipe:0',
      ...this.encodeArgs,
      this.outFile,
    ];
    this.ffmpeg = spawn(resolveTool('ffmpeg'), args, { stdio: ['pipe', 'ignore', 'pipe'] });
    /* ⚠ BẮT BUỘC nghe 'error' — cùng bài học với sidecar Python: ChildProcess
       phát 'error' (không chạy được vì thiếu tệp / bị phần mềm an toàn chặn)
       mà không ai nghe là NÉM thẳng thành ngoại lệ chưa bắt, render treo câm.
       Ghi lại để stop() ném ra một câu nói đúng bệnh. */
    this.encoderLoi = null;
    this.ffmpeg.on('error', (e) => {
      this.encoderLoi = e;
      this.stats.ffmpegStderrTail.push(`spawn: ${e.message}`.slice(0, 300));
    });
    this.ffmpeg.stderr.on('data', (d) => {
      const line = d.toString().trim();
      if (line) this.stats.ffmpegStderrTail.push(line.slice(0, 300));
      if (this.stats.ffmpegStderrTail.length > 20) this.stats.ffmpegStderrTail.shift();
    });
    this.ffmpeg.stdin.on('error', () => { /* EPIPE khi ffmpeg thoát sớm */ });
    return this;
  }

  /**
   * Pacer kiểu "bắt kịp theo đồng hồ" (catch-up), KHÔNG phải setInterval 1-tick-1-frame.
   *
   * Lượt chạy đầu cho thấy setInterval mất 24% tick khi máy bận (444/585, gap
   * lớn nhất 4.7s) -> video sẽ thiếu frame và sai độ dài. Cách này tính số frame
   * ĐÁNG LẼ phải có tại thời điểm hiện tại rồi ghi bù cho đủ, nên tổng số frame
   * luôn đúng dù timer trễ.
   */
  startPacer() {
    const frameDur = 1000 / this.fps;
    const s = this.stats;
    s.startedAt = performance.now();
    let lastTickAt = s.startedAt;

    const tick = () => {
      if (!this.pacerRunning) return;
      const now = performance.now();
      s.pacerTicks += 1;

      const gap = now - lastTickAt;
      if (gap > frameDur * 1.5) s.lateTicks += 1;
      if (gap - frameDur > s.maxTickGapMs) s.maxTickGapMs = gap - frameDur;
      lastTickAt = now;

      if (this.latestFrame && this.ffmpeg && !this.ffmpeg.killed) {
        const targetFrames = Math.floor((now - s.startedAt) / frameDur);
        let need = targetFrames - s.framesWritten;
        if (need > 0) {
          // Chặn burst quá lớn để không ngốn RAM khi máy khựng dài.
          if (need > this.fps) {
            s.catchUpTruncated = (s.catchUpTruncated || 0) + (need - this.fps);
            need = this.fps;
          }
          for (let i = 0; i < need; i += 1) {
            // Giới hạn RAM: nếu FFmpeg chưa tiêu thụ kịp, DỪNG ghi ở lượt này.
            // Không mất frame — pacer tính mục tiêu theo đồng hồ nên lượt sau sẽ
            // ghi bù. Không có chặn này, buffer phình theo độ dài video: đo được
            // 15.8 MB ở clip 19.5s nhưng 158 MB ở clip 48s.
            const pendingNow = this.ffmpeg.stdin.writableLength || 0;
            if (pendingNow > this.maxPendingBytesCap) {
              s.throttledTicks = (s.throttledTicks || 0) + 1;
              break;
            }

            if (this.latestFrameSeq === this.lastWrittenSeq) s.framesRepeated += 1;
            this.lastWrittenSeq = this.latestFrameSeq;
            // write() luôn trả false với chunk 8 MB (lớn hơn highWaterMark) nên
            // giá trị đó vô nghĩa. Chỉ số đúng là lượng byte đang tồn trong
            // buffer của stdin: nếu nó phình dần thì FFmpeg mới thực sự không kịp.
            this.ffmpeg.stdin.write(this.latestFrame);
            const pending = this.ffmpeg.stdin.writableLength || 0;
            if (pending > s.maxPendingBytes) s.maxPendingBytes = pending;
            s.pendingSamples += 1;
            s.pendingBytesSum += pending;
            s.framesWritten += 1;
          }
        }
      }

      /* ⚠ ÉP VẼ LẠI khi cửa sổ thôi phát `paint` (đo 16/10/2026, MacBook M3 macOS 26, màn hình
         đang tắt): cả lượt quay 63 s chỉ có ĐÚNG 1 paint lúc nạp trang — click hé lộ, hoạt ảnh CSS
         đều không làm Chromium phát khung ⇒ 0 khung, lượt dựng hỏng. Trước đây vòng karaoke DOM
         (requestAnimationFrame) vô tình giữ cho paint chảy; phụ đề tách lớp tắt vòng đó nên đường
         này thành mặc định. Quá 2 khung không có paint ⇒ `invalidate()` (vẽ lại cả trang). Trang
         đang tự vẽ đều thì không bao giờ chạm tới — không tốn gì thêm. */
      if (now - (s.lastPaintAt || 0) > frameDur * 2 && this.win && !this.win.isDestroyed()) {
        s.epVe = (s.epVe || 0) + 1;
        try { this.win.webContents.invalidate(); } catch { /* cửa sổ vừa đóng */ }
      }

      this.pacerTimer = setTimeout(tick, Math.max(1, frameDur / 2));
    };

    this.pacerRunning = true;
    this.pacerTimer = setTimeout(tick, frameDur);
    return this;
  }

  async stop() {
    DANG_GHI.delete(this);
    this.pacerRunning = false;
    if (this.pacerTimer) clearTimeout(this.pacerTimer);
    this.pacerTimer = null;
    this.stats.stoppedAt = performance.now();

    // Ghi bù nốt phần frame còn thiếu tới đúng thời điểm dừng, để độ dài video
    // khớp thời gian thực đã quay.
    if (this.latestFrame && this.ffmpeg && !this.ffmpeg.killed) {
      const frameDur = 1000 / this.fps;
      const target = Math.floor((this.stats.stoppedAt - this.stats.startedAt) / frameDur);
      let need = Math.min(target - this.stats.framesWritten, this.fps * 3);
      while (need > 0) {
        this.ffmpeg.stdin.write(this.latestFrame);
        this.stats.framesWritten += 1;
        this.stats.framesRepeated += 1;
        need -= 1;
      }
    }

    /* ⚠ PHẢI CHỜ FFMPEG ĐÓNG TỆP THẬT, không phải chờ-tối-đa-20-giây.
     *
     * MP4 chỉ đọc được khi ffmpeg viết xong moov atom LÚC THOÁT. Bản cũ
     * `setTimeout(resolve, 20000)`: máy chậm còn tồn hàng trăm MB khung hình
     * trong ống (riêng phần bù lúc dừng đã tới 90 khung ≈ 700 MB) — 20 giây
     * chưa xả hết thì mã cứ thế đi tiếp, bước ghép mở một tệp đang viết dở và
     * chết với "moov atom not found". Khách Mac mini dính đúng cảnh này ở
     * "gần xong". Tiến trình ffmpeg mồ côi thì vẫn chạy tiếp, thành ra tệp
     * SAU ĐÓ lại lành — càng khó hiểu vì sao lúc ghép thì hỏng.
     *
     * Nay chờ theo TIẾN ĐỘ: ống còn xả là còn chờ (máy chậm chỉ chậm, không
     * hỏng); đứng im 30 giây liền mới coi là treo — giết ffmpeg và báo lỗi
     * RÕ RÀNG, còn hơn để bước sau đọc tệp rác. */
    let ketThuc = null;
    if (this.ffmpeg) {
      const ff = this.ffmpeg;
      ketThuc = await new Promise((resolve) => {
        let daXong = false;
        let dem = null;   // khai báo TRƯỚC: nhánh chết-sẵn gọi xong() khi chưa kịp đặt đồng hồ
        const xong = (kq) => { if (!daXong) { daXong = true; if (dem) clearInterval(dem); resolve(kq); } };
        ff.on('close', (code) => xong({ dong: true, ma: code }));
        /* ⚠ Tiến trình có thể ĐÃ chết từ trước khi vào đây (bị hệ điều hành
           giết lúc máy quá tải) — sự kiện close đã bắn mất, gắn tai nghe giờ
           là chờ suông 30 giây rồi mới ném. Đo thật trên Mac M1: đúng cảnh đó.
           Chết sẵn thì trả lời ngay. */
        if (ff.exitCode !== null || ff.signalCode) {
          xong({ dong: true, ma: ff.signalCode ? null : ff.exitCode });
        }
        try { ff.stdin.end(); } catch { /* ống đã đứt thì close sẽ tới ngay */ }
        if (daXong) return;
        let conLai = ff.stdin.writableLength || 0;
        let imLang = 0;
        dem = setInterval(() => {
          const bayGio = ff.stdin.writableLength || 0;
          if (bayGio < conLai) { imLang = 0; conLai = bayGio; }
          else imLang += 1;
          if (imLang >= 30) {
            try { ff.kill('SIGKILL'); } catch { /* đã chết sẵn */ }
            xong({ dong: false });
          }
        }, 1000);
      });
      this.ffmpeg = null;
    }
    // Dọn cửa sổ TRƯỚC khi ném lỗi — ném trước là rò cửa sổ offscreen mỗi lượt hỏng.
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
    this.win = null;
    if (this.encoderLoi) {
      throw new Error(`Không khởi động được bộ nén video: ${this.encoderLoi.message}`);
    }
    if (ketThuc && !ketThuc.dong) {
      throw new Error('Bộ nén video không phản hồi khi đóng tệp ghi hình — hãy bấm tạo lại video.');
    }
    /* `ma === null` = chết vì TÍN HIỆU (bị hệ điều hành / phần mềm khác giết)
       — tệp gần như chắc chắn thiếu moov, phải ném chứ đừng lọt qua như xong. */
    if (ketThuc && ketThuc.ma !== 0) {
      const duoi = this.stats.ffmpegStderrTail.slice(-3).join(' · ');
      const ly = ketThuc.ma === null ? 'bị dừng bởi tín hiệu hệ thống' : `thoát với mã ${ketThuc.ma}`;
      throw new Error(`Bộ nén video ${ly}${duoi ? ` — ${duoi}` : ''}`);
    }
    return this.summary();
  }

  /** Click vào giữa slide — thay page.click("#slideContainer") của Playwright. */
  click() {
    const wc = this.win.webContents;
    const x = Math.floor(this.width / 2);
    const y = Math.floor(this.height / 2);
    wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
    wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
  }

  js(code) {
    return this.win.webContents.executeJavaScript(code, true);
  }

  /* ⚠ `anhKhungMoiNhat()` ĐÃ GỠ 13/09/2026 — nó chỉ phục vụ lượt chụp ảnh bìa
     deck, mà ảnh đại diện đã bỏ khỏi bảng danh sách dự án (CONTEXT §6.5E).
     `this.latestFrame` thì GIỮ NGUYÊN: đó là khung mà bộ mã hoá bơm vào ffmpeg,
     không phải thứ sinh ra vì ảnh bìa. Cần lại thì nó là
     `nativeImage.createFromBitmap(this.latestFrame, {width, height})` — bitmap
     của Chromium là BGRA, đúng dạng hàm đó mong đợi, và chỉ có sau
     `startEncoder()` vì handler `paint` cố ý chỉ copy khi đang ghi. */

  summary() {
    const s = this.stats;
    const durationMs = (s.stoppedAt || performance.now()) - (s.startedAt || 0);
    const durationS = durationMs / 1000;
    return {
      durationS: +durationS.toFixed(2),
      paintCount: s.paintCount,
      paintFps: +(s.paintCount / durationS).toFixed(2),
      // Số lần phải ép vẽ lại vì cửa sổ thôi phát paint (xem startPacer) — 0 là bình thường.
      epVe: s.epVe || 0,
      imageSizes: [...s.imageSizes],
      dirtyRectSample: s.dirtyRects.slice(0, 8),
      partialFrameBytes: s.partialFrameBytes || null,
      pacerTicks: s.pacerTicks,
      expectedTicks: Math.round(durationS * this.fps),
      framesWritten: s.framesWritten,
      framesRepeated: s.framesRepeated,
      uniqueFrames: s.framesWritten - s.framesRepeated,
      lateTicks: s.lateTicks,
      maxTickGapMs: +s.maxTickGapMs.toFixed(1),
      catchUpTruncated: s.catchUpTruncated || 0,
      maxPendingMB: +(s.maxPendingBytes / 1024 / 1024).toFixed(1),
      capMB: +(this.maxPendingBytesCap / 1024 / 1024).toFixed(1),
      throttledTicks: s.throttledTicks || 0,
      blockedRequests: this.blockedRequests.length,
      blockedSample: this.blockedRequests.slice(0, 5),
      avgPendingMB: s.pendingSamples ? +(s.pendingBytesSum / s.pendingSamples / 1024 / 1024).toFixed(2) : 0,
      throughputMBs: +((s.framesWritten * s.fullFrameBytes) / 1024 / 1024 / durationS).toFixed(1),
      bitmapCopyMsTotal: +s.bitmapCopyMs.toFixed(0),
      bitmapCopyMsPerFrame: s.paintCount ? +(s.bitmapCopyMs / s.paintCount).toFixed(2) : 0,
      ffmpegStderrTail: s.ffmpegStderrTail,
    };
  }
}

module.exports = { OffscreenRecorder, tiLeDiemAnh, dungTatCa, dangKyDungKhiThoat, DANG_GHI 