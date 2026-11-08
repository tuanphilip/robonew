;
'use strict';
const { app, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

/**
 * Theo dõi thư mục nguồn và deck đang xem; dấu 'app vừa ghi' để không tự kích hoạt.
 *
 * Tách từ main.js (02/09/2026, audit Phase 2.4/2.5). Cơ chế: main.js dựng `ctx`
 * (app, send, mainWindow(), sidecar()…) rồi gọi dangKy(ctx) từng module theo thứ
 * tự; hàm/hằng module này trả về được gộp vào ctx để module khác gọi qua
 * `ctx.tên`. Handler IPC đăng ký ngay trong dangKy — main.js gọi trước whenReady.
 */
function dangKy(ctx) {
  /**
   * Theo dõi thư mục deck để bản xem trước tự nạp lại khi AI sửa file.
   *
   * Chỉ MỘT deck được theo dõi tại một thời điểm — mở deck khác thì bỏ deck cũ.
   * Nuôi nhiều watcher là nuôi luôn rủi ro giữ handle vào thư mục người dùng đã
   * xoá, mà cũng chẳng ai xem hai deck cùng lúc.
   *
   * ⚠ GỘP theo 400ms. Một lần AI ghi file là hàng chục sự kiện (index.html,
   * app.js, style.css, file tạm của trình soạn thảo); báo từng cái là bản xem
   * trước nạp lại hàng chục lần liên tiếp.
   *
   * ⚠ BỎ QUA `output/` và `_preview.html`: render ghi vào output liên tục, còn
   * `_preview.html` do CHÍNH việc nạp lại sinh ra — không loại thì thành vòng lặp
   * tự kích hoạt.
   */
  let deckWatcher = null;
  let deckWatchTimer = null;

  /**
   * File mà CHÍNH APP vừa ghi — watcher phải bỏ qua.
   *
   * Preview Editor tự lưu `preview-settings.json` mỗi lần đổi thiết lập và
   * `script-90s.txt` sau mỗi 0,9 giây gõ. Không lọc thì mỗi lần chỉnh một ô là
   * bản xem trước nạp lại, và đang gõ script thì nó nạp lại giữa chừng — mà deck
   * đã áp mọi thay đổi đó ngay tại chỗ rồi, nạp lại chẳng thêm được gì. Lỗi này
   * đã đo được: đổi hiệu ứng video xong thì phần tử đang cầm rơi vào tài liệu cũ,
   * getComputedStyle trả về rỗng.
   *
   * Vẫn giữ được cái đáng giữ: AI sửa file từ bên ngoài không đi qua đây nên
   * không có dấu, watcher vẫn bắt.
   */
  const vuaGhi = new Map();
  const BO_QUA_MS = 2000;

  function danhDauVuaGhi(file) {
    vuaGhi.set(path.resolve(file), Date.now());
  }

  function laDoAppGhi(file) {
    const k = path.resolve(file);
    const t = vuaGhi.get(k);
    if (t == null) return false;
    if (Date.now() - t > BO_QUA_MS) { vuaGhi.delete(k); return false; }
    return true;
  }

  function stopDeckWatch() {
    if (deckWatchTimer) { clearTimeout(deckWatchTimer); deckWatchTimer = null; }
    if (deckWatcher) { try { deckWatcher.close(); } catch { /* đã đóng */ } deckWatcher = null; }
  }

  /* ══ Theo dõi THƯ MỤC NGUỒN để danh sách dự án tự cập nhật ══════════════
   *
   * Trước đây AI dựng xong một deck thì phải bấm "Làm mới" mới thấy. Nay theo
   * dõi cả thư mục nguồn và tự đẩy xuống giao diện.
   *
   * ⚠ BA BỘ LỌC DƯỚI ĐÂY LÀ THỨ GIỮ CHO NÓ KHÔNG CHẠY LOẠN — chép đúng nếp của
   * `preview:watch`, đừng bỏ cái nào:
   *
   *   1. Bỏ `output/` — lúc render, pipeline ghi hàng nghìn file vào đó (từng
   *      khung hình, từng đoạn tiếng). Không lọc là watcher bắn liên tục suốt
   *      mấy phút render, và mỗi lần bắn lại quét lại toàn bộ thư mục nguồn.
   *   2. Bỏ file do CHÍNH APP vừa ghi (`laDoAppGhi`) — không thì app ghi rồi tự
   *      kích hoạt mình, thành vòng lặp.
   *   3. Bỏ đuôi media/tạm — file .mp4 đang ghi bắn sự kiện mỗi vài chục ms.
   *
   * Gộp sự kiện 800ms: quét lại danh sách nặng hơn nạp lại một deck, mà một lần
   * AI ghi xong deck thì bắn hàng chục sự kiện liền nhau.
   */
  let duAnWatcher = null;
  let duAnXongTimer = null;
  // Mốc lần đẩy gần nhất — dùng cho phần hãm ở mép trước.
  let duAnLanCuoi = 0;

  function dungTheoDoiDuAn() {
    if (duAnXongTimer) { clearTimeout(duAnXongTimer); duAnXongTimer = null; }
    duAnLanCuoi = 0;
    if (duAnWatcher) { try { duAnWatcher.close(); } catch { /* đã đóng */ } duAnWatcher = null; }
  }

  function theoDoiThuMucNguon() {
    dungTheoDoiDuAn();
    const root = ctx.loadSettings().sourceRoot;
    if (!root || !fs.existsSync(root)) return false;
    try {
      duAnWatcher = fs.watch(root, { recursive: true }, (_type, file) => {
        const f = String(file || '').split(path.sep).join('/');
        if (!f) return;
        const ten = f.split('/')[0];
        if (!ten) return;
        /* ⚠ Phải chặn CẢ hai dạng đường dẫn.
           `fs.watch` đệ quy trên Windows không phải lúc nào cũng báo tên file —
           khi một thư mục có nhiều file đổi liên tiếp, nó báo CHÍNH THƯ MỤC đó
           ("deck/output", không có dấu / ở cuối). Chỉ lọc "/output/" thì dạng
           này lọt qua, và lúc render sẽ nạp lại danh sách mỗi 800ms suốt vài
           phút. Đã đo được: ghi 60 file vào output/ mà vẫn kích hoạt. */
        if (f.includes('/output/') || /(^|\/)output$/.test(f)) return;
        /* `dung/` của trình dựng (dự án tự lưu, media đang chép, ảnh/sóng/proxy sinh
           ngầm) KHÔNG phải "deck đang được thiết kế" — không chặn ở đây thì chép một
           video vài GB là danh sách dự án nạp lại mỗi 1,5 giây suốt mấy phút và deck
           kẹt nhãn "Đang thiết kế". Cùng hai dạng đường dẫn như output/ ở trên. */
        if (f.split('/')[1] === 'dung') return;
        if (f.endsWith('_preview.html') || f.endsWith('_bia.html') || f.endsWith('_phude-dung.html')) return;
        if (/\.(mp4|mp3|wav|webm|tmp|swp|part|crdownload)$/i.test(f)) return;
        if (laDoAppGhi(path.join(root, file))) return;

        // Ghi mốc để `dangThietKe()` phân biệt "AI đang làm" với "deck cũ thiếu script".
        ctx.deckDangGhi.set(ten, Date.now());

        /* MÉP TRƯỚC: bắn ngay lần đầu, rồi hãm lại tối đa 1 lần / 1,5 giây.
           Chỉ gộp ở mép sau là sai: AI ghi liên tục 12 giây thì bộ đếm bị đặt lại
           liên tục và KHÔNG bắn lần nào cho tới lúc xong — đo được đúng như vậy.
           Hậu quả: deck mới không hiện ra trong lúc đang dựng, tức mất hẳn trạng
           thái "Đang thiết kế", là thứ chính cần có. */
        const gio = Date.now();
        if (gio - duAnLanCuoi >= 1500) {
          duAnLanCuoi = gio;
          console.log(`[watch] "${ten}" đổi → nạp lại danh sách`);
          ctx.send('du-an:doi', { deck: ten });
        }

        /* MÉP SAU: một lần duy nhất sau khi thư mục im hẳn.
           Lúc đó deck đã chuyển từ "Đang thiết kế" sang trạng thái thật, mà không
           còn sự kiện file nào để kích hoạt — thiếu nhịp này thì nó kẹt ở "Đang
           thiết kế" cho tới khi người dùng tự bấm Làm mới.
           Clear mỗi lần, không đặt setTimeout trần: ghi liên tục 60 giây mà mỗi
           sự kiện đẻ thêm một hẹn giờ không ai dọn là hàng chục lần nạp lại thừa. */
        if (duAnXongTimer) clearTimeout(duAnXongTimer);
        duAnXongTimer = setTimeout(() => {
          duAnXongTimer = null;
          console.log(`[watch] "${ten}" đã im → nạp lại lần cuối`);
          ctx.send('du-an:doi', { deck: ten, xong: true });
        }, ctx.IM_LANG_MS + 200);
      });
    } catch (err) {
      console.error('[watch] không theo dõi được thư mục nguồn:', err.message);
      return false;
    }
    return true;
  }

  ipcMain.handle('preview:watch', async (e, nameOrDir) => {
    stopDeckWatch();
    if (!nameOrDir) return { watching: false };
    const dir = ctx.resolveDeckDir(nameOrDir);
    if (!dir) return { watching: false };
    try {
      deckWatcher = fs.watch(dir, { recursive: true }, (_type, file) => {
        const f = String(file || '').split(path.sep).join('/');
        if (!f) return;
        // `_phude-dung.html`: trang tạm vẽ lại phụ đề khi xuất bản dựng (dung/xuat.js).
        if (f.startsWith('output/') || f === '_preview.html' || f === '_bia.html' || f === '_phude-dung.html') return;
        // Trình dựng ghi `dung/` liên tục (tự lưu, cache) — không phải sửa deck, đừng nạp lại khung.
        if (f === 'dung' || f.startsWith('dung/')) return;
        // Bộ slide phụ (GĐ3.7) là deck RIÊNG (có watcher riêng khi mở nó) — sửa / dựng nó không đổi khung của deck mẹ.
        if (f === 'bo-slide' || f.startsWith('bo-slide/')) return;
        if (laDoAppGhi(path.join(dir, file))) return;
        if (/\.(mp4|mp3|wav|webm|tmp|swp)$/i.test(f)) return;
        if (deckWatchTimer) clearTimeout(deckWatchTimer);
        deckWatchTimer = setTimeout(() => {
          deckWatchTimer = null;
          if (!e.sender.isDestroyed()) e.sender.send('preview:changed', { dir, file: f });
        }, 400);
      });
    } catch (err) {
      return { watching: false, error: err.message };
    }
    return { watching: true, dir };
  });

  ipcMain.handle('preview:unwatch', async () => { stopDeckWatch(); return { watching: false }; });

  return { BO_QUA_MS, danhDauVuaGhi, dungTheoDoiDuAn, laDoAppGhi, stopDeckWatch, theoDoiThuMucNguon, vuaGhi };
}

module.exports = { dangKy }