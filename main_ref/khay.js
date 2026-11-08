;
'use strict';
/**
 * Khay hệ thống — đóng cửa sổ KHÔNG còn là thoát app.
 *
 * ⚠ VÌ SAO CẦN. Dựng một video mất vài phút và chạy hết ở tiến trình chính
 * (sidecar Python + cửa sổ ghi hình ẩn + ffmpeg). Trước đây bấm dấu X là
 * `window-all-closed` bắn ra và app thoát ngay giữa chừng: lượt đang dựng mất
 * trắng, mà người dùng chỉ định cất cửa sổ đi cho đỡ vướng màn hình. Không có
 * đường nào để "ẩn đi mà vẫn chạy".
 *
 * Nay theo đúng nếp của ChatGPT / Claude trên desktop:
 *   · bấm X            → cửa sổ ẩn, app vẫn chạy, biểu tượng nằm ở khay
 *   · bấm biểu tượng   → cửa sổ hiện lại
 *   · "Thoát hẳn"      → mới thật sự thoát (và hỏi lại nếu đang dựng video)
 *
 * ⚠ `thoatHan` là cái chốt duy nhất phân biệt hai việc đó. Mọi đường thoát
 * THẬT đều đi qua `before-quit` (app.quit, Cmd+Q, cập nhật rồi khởi động lại),
 * nên bật cờ ở đó là đủ cho tất cả — đừng rải thêm cờ ở từng chỗ gọi.
 */
const fs = require('node:fs');
const path = require('node:path');
const { app, dialog, Menu, nativeImage, Tray } = require('electron');

/** Nhịp làm mới nhãn khay TRONG LÚC cửa sổ đang ẩn. */
const NHIP_MS = 2000;

function dangKy(ctx) {
  let tray = null;
  let thoatHan = false;
  let dongHo = null;

  // Mọi đường thoát thật đều qua đây — kể cả `quitAndInstall` của bộ cập nhật.
  app.on('before-quit', () => { thoatHan = true; });

  /**
   * Ảnh cho khay.
   *
   * Dùng PNG + `createFromBuffer` chứ KHÔNG `createFromPath` tới file .ico:
   * bản đóng gói nằm trong `app.asar`, mà đường đọc ảnh gốc của Electron không
   * phải lúc nào cũng đi qua lớp asar. `fs.readFileSync` thì chắc chắn đọc được
   * trong asar, còn PNG thì `createFromBuffer` chắc chắn giải mã được (.ico
   * KHÔNG — nó chỉ nhận PNG/JPEG).
   */
  function anhKhay() {
    try {
      const f = path.join(__dirname, '..', 'ui-classic', 'assets', 'khay.png');
      const anh = nativeImage.createFromBuffer(fs.readFileSync(f));
      if (!anh.isEmpty()) return anh;
    } catch { /* rơi xuống dưới */ }
    return nativeImage.createEmpty();
  }

  /** Tên deck đang dựng, hoặc null nếu máy đang rảnh. */
  function dangDung() {
    const j = ctx.jobState;
    if (!j || !j.running) return null;
    return j.projectDir ? path.basename(j.projectDir) : 'một dự án';
  }

  function hienCuaSo() {
    const w = ctx.mainWindow();
    if (!w || w.isDestroyed()) return;
    if (w.isMinimized()) w.restore();
    w.show();
    w.focus();
  }

  /**
   * Thoát THẬT.
   *
   * Hỏi lại khi đang dựng video: đây là nút duy nhất giết được một lượt đã chạy
   * vài phút, mà nó lại nằm ngay cạnh "Mở cửa sổ" trong một menu bé xíu.
   */
  function thoatThat() {
    const deck = dangDung();
    if (deck) {
      const chon = dialog.showMessageBoxSync({
        type: 'warning',
        buttons: ['Cứ thoát', 'Để chạy tiếp'],
        defaultId: 1,
        cancelId: 1,
        title: 'Đang dựng video',
        message: `Đang dựng video cho "${deck}".`,
        detail: 'Thoát bây giờ là huỷ lượt này, phần đã làm không giữ lại được.',
      });
      if (chon !== 0) return;
    }
    thoatHan = true;
    app.quit();
  }

  function dungMenu() {
    const deck = dangDung();
    return Menu.buildFromTemplate([
      { label: deck ? `Đang dựng: ${deck}` : 'Không có việc nào đang chạy', enabled: false },
      { type: 'separator' },
      { label: 'Mở cửa sổ', click: hienCuaSo },
      /* Công tắc kết nối AI agent (MCP). Tra `ctx.mucKhayMcp` LÚC DỰNG MENU chứ
         không lúc đăng ký: module `mcp` đăng ký SAU khay (xem main.js). */
      ...(typeof ctx.mucKhayMcp === 'function' ? [{ type: 'separator' }, ...ctx.mucKhayMcp()] : []),
      { type: 'separator' },
      { label: 'Thoát hẳn', click: thoatThat },
    ]);
  }

  function veLaiKhay() {
    if (!tray || tray.isDestroyed()) return;
    const deck = dangDung();
    tray.setToolTip(deck ? `Beeknoee Studio — đang dựng ${deck}` : 'Beeknoee Studio');
    tray.setContextMenu(dungMenu());
  }

  /* Chỉ chạy nhịp làm mới KHI CỬA SỔ ĐANG ẨN: lúc đó cái khay là thứ duy nhất
     nói được tình hình. Cửa sổ hiện thì bảng tiến trình trong app đã nói rồi,
     giữ thêm một đồng hồ chạy suốt đời app là tốn vô cớ. */
  function batNhip() {
    if (dongHo) return;
    dongHo = setInterval(veLaiKhay, NHIP_MS);
  }

  function tatNhip() {
    if (!dongHo) return;
    clearInterval(dongHo);
    dongHo = null;
  }

  /**
   * Báo MỘT LẦN rằng app chưa tắt.
   *
   * Không báo thì lần đầu bấm X người dùng tưởng đã đóng app, và sẽ rất khó
   * hiểu khi thấy tiến trình vẫn nằm trong Task Manager. Chỉ báo một lần —
   * nhớ trong settings.json, không phải trong bộ nhớ, vì mỗi lần mở app lại là
   * một lần "lần đầu".
   */
  function baoLanDau() {
    try {
      if (ctx.loadSettings().daBaoKhay) return;
      ctx.saveSettings({ daBaoKhay: true });
      if (tray && !tray.isDestroyed() && process.platform === 'win32') {
        tray.displayBalloon({
          title: 'Beeknoee Studio vẫn đang chạy',
          content: 'Cửa sổ đã ẩn xuống khay để video đang dựng không bị huỷ. '
            + 'Bấm biểu tượng ở khay để mở lại, hoặc chuột phải → Thoát hẳn.',
        });
      }
    } catch { /* không báo được thì thôi, không cản việc ẩn cửa sổ */ }
  }

  /**
   * Gắn khay + đổi hành vi nút X cho cửa sổ chính. Gọi trong `createWindow()`.
   */
  function batKhay(win) {
    if (!win) return;

    win.on('close', (e) => {
      if (thoatHan) return;          // thoát thật — để cửa sổ đóng bình thường
      e.preventDefault();
      win.hide();
      batNhip();
      veLaiKhay();
      baoLanDau();
    });
    win.on('show', tatNhip);

    if (tray && !tray.isDestroyed()) return;   // nạp lại trang không dựng khay mới
    try {
      tray = new Tray(anhKhay());
      /* Bấm trái = mở cửa sổ, không phải mở menu. Đúng nếp Windows, và là việc
         người dùng muốn làm 9/10 lần khi nhìn vào cái biểu tượng đó. */
      tray.on('click', hienCuaSo);
      tray.on('double-click', hienCuaSo);
      veLaiKhay();
    } catch (e) {
      /* Không dựng được khay (máy ảo không có vùng thông báo, phiên RDP…) thì
         PHẢI trả nút X về nghĩa cũ — ẩn cửa sổ mà không có chỗ nào mở lại là
         app biến mất hẳn khỏi tầm với của người dùng. */
      tray = null;
      thoatHan = true;
      console.error('[khay] không dựng được biểu tượng khay:', e.message);
    }
  }

  return { batKhay, dangThoatHan: () => thoatHan, hienCuaSo, veLaiKhay };
}

module.exports = { dangKy 