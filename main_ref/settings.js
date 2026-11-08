};
'use strict';
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const config = require('../config');

/**
 * Đường dẫn app, settings.json, thư mục làm việc.
 *
 * Tách từ main.js (02/09/2026, audit Phase 2.4/2.5). Cơ chế: main.js dựng `ctx`
 * (app, send, mainWindow(), sidecar()…) rồi gọi dangKy(ctx) từng module theo thứ
 * tự; hàm/hằng module này trả về được gộp vào ctx để module khác gọi qua
 * `ctx.tên`. Handler IPC đăng ký ngay trong dangKy — main.js gọi trước whenReady.
 */
function dangKy(ctx) {
  const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

  /* Từng có hai hàm kéo `settings.json` và model Whisper từ thư mục userData
     của tên sản phẩm cũ (trước bản 1.0.0) sang tên hiện tại. Gỡ 24/09/2026 cùng
     đợt xoá tên cũ: sau 18 lần phát hành không còn ai nâng cấp thẳng từ đó, và
     đợt đổi chữ hàng loạt đã biến danh sách thư mục cũ thành chính tên hiện tại
     — chạy với thư mục dữ liệu khác (dev, `BEE_USER_DATA`) là nó dời nhầm model
     của bản đã cài sang. Đổi tên sản phẩm lần nữa thì viết lại có chủ đích. */

  /**
   * Đoán thư mục làm việc khi thiết lập chưa có `sourceRoot`.
   *
   * Người dùng không phải đi tìm hay chọn thư mục nữa: cứ có
   * `<đâu đó>/Beeknoee Studio/slide` là app tự trỏ vào.
   *
   * Chỉ nhận thư mục CÓ THẬT — trả về đường dẫn không tồn tại thì danh sách rỗng
   * mà chẳng báo gì, đúng kiểu hỏng im lặng đã gặp với BOM và với việc đổi tên app.
   */
  /**
   * Thư mục app = thư mục gốc để làm việc.
   *
   * `workflow.md`, `template/`, `script-writing/` được đóng gói ra NGAY CẠNH file
   * .exe (xem `extraFiles` trong electron-builder.yml), và `slide/` cũng nằm ở đó.
   * Nên cài xong chỉ cần trỏ AI vào thư mục app rồi gõ "Đọc kỹ workflow.md..." —
   * không phải đi tìm hay chọn thư mục nào khác.
   *
   * Lúc chạy từ mã nguồn thì không có .exe, dùng `desktop/` làm gốc để thử được.
   */
  function appRootDir() {
    /* ⚠ DÙNG app.getAppPath(), KHÔNG phải path.resolve(__dirname, '..').
       Bản gốc viết resolve(__dirname, '..') hồi hàm này còn nằm ở src/main.js —
       lúc đó đúng. Đợt tách main.js thành 8 module (5c05ea2, 02/09/2026) dời nó
       xuống src/main/settings.js mà quên sửa số cấp, nên từ đó bản chạy từ mã
       nguồn trả về "desktop/src" thay vì "desktop".
       Hỏng IM LẶNG và hỏng NHIỀU CHỖ cùng lúc:
         · không thấy config/google.json ⇒ bấm đăng nhập Google báo "bản này chưa
           cấu hình Client ID" (bản đã cài vẫn tốt vì nhánh dưới dùng dirname(exe))
         · template/ và slide/ trỏ vào thư mục không có thật
         · đường dẫn thư mục app kèm trong câu lệnh Copy prompt cũng sai
       getAppPath() là thư mục chứa package.json — đúng "desktop/" và KHÔNG phụ
       thuộc file này nằm sâu mấy cấp, nên lần tách module sau không gãy lại. */
    if (!app.isPackaged) return app.getAppPath();
    const thuMucExe = path.dirname(app.getPath('exe'));
    /* ⚠ macOS PHẢI LÙI THÊM MỘT CẤP.
       Windows: .exe và `extraFiles` cùng nằm ở gốc thư mục cài → dirname(exe) đúng.
       macOS  : file thực thi ở `<App>.app/Contents/MacOS/`, còn `extraFiles` thì
                electron-builder đặt ở `<App>.app/Contents/` — LỆCH một cấp.
       Không lùi thì `templateRoots()` trỏ vào `Contents/MacOS/template` (không tồn
       tại) ⇒ trang Template rỗng trơn, và `config/google.json` cũng không thấy ⇒
       bấm đăng nhập Google báo "chưa cấu hình". Cả hai đều im lặng, không lỗi.
       Đã kiểm trên bản dựng arm64 thật: `Contents/` có template/ docs/ config/. */
    return process.platform === 'darwin' ? path.dirname(thuMucExe) : thuMucExe;
  }

  function guessWorkspaceSlideDir() {
    const roots = [
      process.env.BEE_WORKSPACE,
      // Thư mục app — CHỈ khi đã đóng gói. Lúc chạy từ mã nguồn thì `appRootDir()`
      // là chính thư mục `desktop/`, và nếu lỡ tạo `slide/` rỗng ở đó thì app sẽ
      // chọn nó trước và báo "0 dự án" trong khi deck thật vẫn còn nguyên chỗ cũ.
      // Đã dính đúng như vậy ngay lần chạy đầu.
      app.isPackaged ? appRootDir() : null,
      'D:/Beeknoee/Beeknoee Studio',                  // workspace đã dựng trước đó
      path.join(app.getPath('documents'), 'Beeknoee Studio'),
      path.join(app.getPath('home'), 'Beeknoee Studio'),
    ].filter(Boolean);
    for (const r of roots) {
      const slide = path.join(r, 'slide');
      if (fs.existsSync(slide) && fs.statSync(slide).isDirectory()) return slide;
    }
    return '';
  }

  /**
   * Tạo `slide/` cạnh .exe nếu chưa có, để lần chạy đầu đã có chỗ đặt deck.
   *
   * ⚠ PHẢI kiểm bản cập nhật có xoá thư mục này không trước khi tin dùng — bộ
   * gỡ cài NSIS chạy lúc cập nhật, mà `RMDir /r $INSTDIR` sẽ cuốn theo cả deck
   * của người dùng. Có phép kiểm riêng: scripts/check-update-preserves.mjs
   */
  /**
   * Bung 6 deck mẫu vào `slide/` — CHỈ những deck chưa có.
   *
   * ⚠ VÌ SAO KHÔNG ĐỂ BỘ CÀI CHÉP: NSIS bung `extraFiles` bằng `CopyFiles
   * /SILENT`, tức GHI ĐÈ không hỏi. Người dùng sửa nội dung deck mẫu (đúng đường
   * mà app mời gọi) rồi bấm cập nhật là 58 file lùi về nguyên bản, im lặng.
   * `build/installer.nsh` chỉ chừa `slide` khỏi bước XOÁ lúc gỡ cài — không chặn
   * được bước GHI lúc cài đè.
   *
   * Nay `electron-builder.yml` lọc `!slide/**` khỏi `extraFiles`, còn bản gốc
   * nằm trong app tại `resources/authoring/slide`. Hàm này chép ra ngoài, và
   * BỎ QUA mọi deck đã tồn tại — kể cả deck rỗng, vì thư mục trống cũng có thể
   * là người dùng vừa xoá sạch nội dung có chủ ý.
   *
   * Người dùng xoá hẳn một deck mẫu thì lần cập nhật sau nó quay lại. Chấp nhận:
   * thà thừa một thư mục còn hơn nuốt mất bản sửa của người ta.
   */
  function bungDeckMauNeuThieu(dichSlide) {
    const nguon = path.join(config.resourcesRoot(), 'authoring', 'slide');
    if (!fs.existsSync(nguon)) return;
    let them = 0;
    for (const ten of fs.readdirSync(nguon)) {
      const tu = path.join(nguon, ten);
      const den = path.join(dichSlide, ten);
      try {
        if (!fs.statSync(tu).isDirectory()) continue;
        if (fs.existsSync(den)) continue; // ĐÃ CÓ → không đụng
        fs.cpSync(tu, den, { recursive: true });
        them += 1;
      } catch (e) {
        console.error(`[workspace] không bung được deck mẫu ${ten}:`, e.message);
      }
    }
    if (them) console.log(`[workspace] bung ${them} deck mẫu vào slide/`);
  }

  function ensureAppSlideDir() {
    // Chỉ ở bản đóng gói. Chạy từ mã nguồn mà tạo `desktop/slide` thì vừa bẩn
    // kho mã, vừa làm app tự trỏ vào thư mục rỗng đó.
    if (!app.isPackaged) return '';
    try {
      const dir = path.join(appRootDir(), 'slide');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      bungDeckMauNeuThieu(dir);
      return dir;
    } catch (e) {
      // Cài vào Program Files thì không ghi được — không sao, người dùng vẫn
      // chọn được thư mục khác. Không làm app chết vì việc này.
      console.error('[workspace] không tạo được slide/ cạnh app:', e.message);
      return '';
    }
  }

  function loadSettings() {
    try {
      // Cắt BOM trước khi parse. JSON.parse ném lỗi nếu chuỗi mở đầu bằng U+FEFF,
      // mà loadSettings() nuốt lỗi rồi trả {} — hậu quả là **mất sạch thiết lập
      // trong im lặng**: app mở lên, danh sách dự án rỗng, không báo gì.
      // Đã dính thật khi ghi file này bằng PowerShell (`Out-File -Encoding utf8`
      // của PS 5.1 kèm BOM). Người dùng sửa tay bằng editor cũ cũng dính y hệt.
      const s = JSON.parse(fs.readFileSync(settingsPath(), 'utf8').replace(/^﻿/, ''));
      // Chưa chọn thư mục, hoặc thư mục đã chọn không còn (đổi máy, chuyển deck)
      // thì tự tìm workspace. Không ghi vào settings ở đây — chỉ trả về cho lần
      // đọc này, để lần sau người dùng đổi chỗ thì vẫn tự tìm lại.
      if (!s.sourceRoot || !fs.existsSync(s.sourceRoot)) {
        const guess = guessWorkspaceSlideDir();
        if (guess) return { ...s, sourceRoot: guess };
      }
      return s;
    } catch {
      const guess = guessWorkspaceSlideDir();
      return guess ? { sourceRoot: guess } : {};
    }
  }
  function saveSettings(patch) {
    const next = { ...loadSettings(), ...patch };
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf8');
    return next;
  }

  return { appRootDir, bungDeckMauNeuThieu, ensureAppSlideDir, guessWorkspaceSlideDir, loadSettings, saveSettings, settingsPath };
}

module.exports = { dangKy 