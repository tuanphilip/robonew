};
'use strict';
/**
 * Kiểm BỐ CỤC deck (safezone) bằng CỬA SỔ ẨN CỦA CHÍNH APP.
 *
 * ⚠ THAY CHO CÁI GÌ: `resources/authoring/validate_slide.py` đo phần này bằng
 * **Playwright**. Đo 16/09/2026: `resources/pysrc/requirements.lock.txt` khớp
 * **0** dòng playwright ⇒ trong bản đã cài, phép kiểm safezone không chạy được;
 * cả "Bước 7 — Validate bắt buộc" của `workflow.md` vì thế không tồn tại với
 * người dùng bản cài, chỉ chạy được trên máy có bộ kit + venv riêng.
 *
 * Ba đường đã cân nhắc:
 *   A. (chọn) Dùng cửa sổ ẩn của app — app đã có sẵn hạ tầng này cho ảnh thu nhỏ
 *      (`anhSlide.js`) và cho bộ ghi hình (`render/offscreen.js`).
 *   B. Đóng gói Playwright + Chromium: +~150 MB bộ cài, mà đường dẫn Windows đã
 *      vượt trần 260 ký tự (CONTEXT §7).
 *   C. Bỏ qua safezone: `workflow.md` CẤM bàn giao kiểu đó.
 *
 * ⚠ ĐOẠN JS ĐO BÊN DƯỚI LÀ BẢN CHÉP NGUYÊN VĂN từ hai khối `page.evaluate` của
 * `validate_slide.py` (dòng 318–400). Cố ý không "viết lại cho gọn": lệch một
 * phép tính là app và bộ kit chấm cùng một deck ra hai kết quả, mà chẳng có gì
 * báo. Sửa một bên thì chép sang bên kia.
 *
 * ⚠ Nạp `index.html` CHỨ KHÔNG PHẢI `_preview.html`. Bản xem trước có chèn thêm
 * CSS/JS của app (thanh công cụ, biến phụ đề…) — đo trên đó là đo một trang
 * khác với trang bộ kit đo.
 */
const path = require('node:path');
const fs = require('node:fs');
const { BrowserWindow } = require('electron');
const { pathToFileURL } = require('node:url');

/* Cùng khung với bộ kit: 1280×900, tỉ lệ 1. KHÔNG đổi sang khổ dọc thật
   (1080×1920) — mọi ngưỡng safezone (top 100px, bottom gap 200px) đều được đặt
   ra khi đo ở khung này; đổi khung là mọi con số ngưỡng sai theo. */
const KHUNG_W = 1280;
const KHUNG_H = 900;
const SAFE_TOP = 100;
const SAFE_BOTTOM = 200;
/** Ngưỡng bỏ qua sai số làm tròn của trình duyệt — đúng bằng bản kit. */
const BO_QUA_PX = 0.5;

/** Bày hết mọi thứ ra: slide active, element visible, tắt animation. */
const JS_BAY_RA = `
(() => {
  const style = document.createElement('style');
  style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
  document.head.appendChild(style);
  document.querySelectorAll('.slide').forEach((slide) => {
    slide.classList.add('active');
    slide.style.opacity = '1';
    slide.style.transform = 'none';
    slide.style.pointerEvents = 'none';
  });
  document.querySelectorAll('.slide-element, .highlightable, .lightable').forEach((el) => {
    el.classList.add('visible');
    el.classList.add('active');
    el.classList.add('lit-red');
    el.classList.add('lit-yellow');
    el.classList.add('lit-green');
  });
  document.querySelectorAll('video').forEach((v) => { v.pause(); });
  return true;
})()`;

const jsDo = (safeTop, safeBottom) => `
(() => {
  const safeTop = ${safeTop}, safeBottom = ${safeBottom};
  const container = document.querySelector('.slide-container');
  if (!container) throw new Error('Thiếu .slide-container');
  const c = container.getBoundingClientRect();
  const safeBottomY = c.height - safeBottom;
  function relRect(el) {
    const r = el.getBoundingClientRect();
    return {
      top: r.top - c.top, bottom: r.bottom - c.top,
      left: r.left - c.left, right: r.right - c.left,
      width: r.width, height: r.height,
    };
  }
  function union(rects) {
    if (!rects.length) return null;
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    return { top, bottom, left, right, height: bottom - top };
  }
  return {
    width: c.width, height: c.height, safeTop, safeBottom, safeBottomY,
    slides: Array.from(document.querySelectorAll('.slide')).map((slide, index) => {
      const content = slide.querySelector('.slide-content');
      const cs = content ? getComputedStyle(content) : null;
      const elements = Array.from(slide.querySelectorAll('.slide-element'));
      const rect = union(elements.map(relRect));
      return {
        slide: index + 1,
        mode: slide.getAttribute('data-mode') || 'normal',
        paddingTop: cs ? parseFloat(cs.paddingTop) : null,
        paddingBottom: cs ? parseFloat(cs.paddingBottom) : null,
        top: rect ? rect.top : null,
        bottom: rect ? rect.bottom : null,
        bottomGap: rect ? c.height - rect.bottom : null,
        topViolation: rect ? Math.max(0, safeTop - rect.top) : 0,
        bottomViolation: rect ? Math.max(0, rect.bottom - safeBottomY) : 0,
      };
    }),
  };
})()`;

const doi = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Đo safezone của một deck.
 *
 * @param {string} deckDir thư mục deck (phải có `index.html`)
 * @returns {Promise<{ok:boolean, loi:string[], bo:object|null}>}
 */
async function doBoCuc(deckDir) {
  const html = path.join(deckDir, 'index.html');
  if (!fs.existsSync(html)) return { ok: false, loi: ['Thiếu index.html'], bo: null };

  const kq = { thieuFont: false, hetHanNap: false };
  let win = null;
  try {
    win = new BrowserWindow({
      show: false,
      width: KHUNG_W,
      height: KHUNG_H,
      frame: false,
      enableLargerThanScreen: true,
      webPreferences: {
        offscreen: true,
        backgroundThrottling: false,
        nodeIntegration: false,
        contextIsolation: true,
        autoplayPolicy: 'no-user-gesture-required',
        /* ⚠ PHIÊN RIÊNG, bắt buộc — cùng lý do đã ghi dài ở `anhSlide.js`: dùng
           chung phiên với cửa sổ chính thì việc chặn mạng bên dưới sẽ chặn luôn
           font/ảnh của giao diện app. */
        partition: 'kiem-deck',
      },
    });
    win.setContentSize(KHUNG_W, KHUNG_H);

    const wc = win.webContents;
    wc.setAudioMuted(true);
    /* ⚠ KHÔNG CHẶN MẠNG. Đã thử hai mức chặn, cả hai đều SAI SỐ:
         · chặn hết        → lệch tới 39,65px so với Playwright
         · chỉ cho font    → vẫn lệch 23,00px
       Truy ra: deck còn nạp **Font Awesome từ cdnjs**. Thiếu bộ icon đó thì thẻ
       `<i class="fa-...">` co lại, phần tử chứa nó thấp đi 23px, và chấm
       safezone lệch theo. Đo tận nơi: phông chữ hai bên GIỐNG HỆT (cùng Inter,
       cùng đo ra 294,3px cho một chuỗi thử) — thủ phạm là icon, không phải font.

       Nguyên tắc đúng ở đây là CÙNG ĐẦU VÀO THÌ CÙNG KẾT QUẢ: bản kit chờ
       `networkidle`, tức nạp mọi thứ; muốn hai bên chấm giống nhau thì đây cũng
       phải nạp mọi thứ. Đổi lại phải tự lo chuyện treo — xem trần thời gian ở
       `loadURL` và ở `document.fonts.ready` bên dưới. */
    /* ⚠ Mạng thì mở, nhưng `file://` thì RÀO (24/10/2026): trang này chạy `app.js` của deck —
       agent ghi được — mà trang `file://` đọc được mọi tệp trên máy. Chỉ thư mục deck + engine /
       phông của app (xem `raoCuaSoAn.js`). Bản kit cũng chỉ nạp những thứ đó, nên số đo không đổi. */
    require('./raoCuaSoAn').rao(wc, { deckDir, chanMang: false });
    /* ⚠ TRẦN 20 GIÂY cho lượt nạp. Không chặn mạng nữa nên một CDN chết là
       `loadURL` treo vô hạn — mà kiểm deck thì không được phép treo cả app.
       Hết hạn thì ĐI TIẾP chứ không bỏ cuộc: đo bằng thứ đã nạp được, rồi báo
       cảnh báo "thiếu tài nguyên mạng". */
    let hetHanNap = false;
    await Promise.race([
      wc.loadURL(pathToFileURL(html).href).catch(() => { hetHanNap = true; }),
      doi(20000).then(() => { hetHanNap = true; }),
    ]);
    kq.hetHanNap = hetHanNap;
    /* Chờ deck tự chạy xong lượt dựng đầu. `did-finish-load` chỉ nói HTML đã
       xong; `app.js` của deck còn dựng DOM và đặt lớp sau đó. 600ms là mức đã
       dùng ở `anhSlide.js` cho cùng loại deck. */
    await doi(600);
    /* ⚠ ĐỢI FONT TẢI XONG rồi mới đo. `document.fonts.ready` là chỗ trình duyệt
       nói "đã xong mọi phông đang chờ"; đo trước đó là đo bằng font thay thế và
       lệch tới 39px (xem chú thích chặn mạng bên trên).
       Có TRẦN 6 giây: mất mạng thì `ready` vẫn giải quyết sớm với font thay
       thế, nhưng máy chủ font trả lời chậm thì không được treo cả lượt kiểm. */
    kq.thieuFont = !(await wc.executeJavaScript(`
      Promise.race([
        document.fonts.ready.then(() => true),
        new Promise((r) => setTimeout(() => r(false), 6000)),
      ])`, true).catch(() => false));
    /* ⚠ ĐO TỚI KHI HAI LƯỢT LIÊN TIẾP TRÙNG NHAU, không đo một phát.
       Đối chiếu với Playwright: `top` khớp tuyệt đối mọi slide, nhưng `bottom`
       lệch tới 23px ở MỘT SỐ slide — dấu hiệu của phần tử do `app.js` của deck
       dựng SAU lúc bơm script bày ra, nên không có lớp `.visible` và bị tính
       thiếu vào hộp nội dung. Bản kit không gặp vì `networkidle` của nó chờ lâu
       hơn nhiều so với một mốc 600ms cố định.
       Nên: bơm lại script bày ra TRƯỚC MỖI LƯỢT đo, và chỉ nhận kết quả khi hai
       lượt liền nhau ra đúng một con số. Cùng lối với `anhSlide.js` (chụp khi
       hai khung hình liên tiếp giống hệt nhau) — chờ theo BẰNG CHỨNG, không
       chờ theo đồng hồ. */
    let bo = null;
    let truoc = '';
    for (let lan = 0; lan < 8; lan += 1) {
      await wc.executeJavaScript(JS_BAY_RA, true);
      await doi(300);   // đúng bằng `page.wait_for_timeout(300)` của bản kit
      bo = await wc.executeJavaScript(jsDo(SAFE_TOP, SAFE_BOTTOM), true);
      const nay = JSON.stringify(bo.slides);
      if (lan >= 1 && nay === truoc) break;
      truoc = nay;
    }

    const loi = [];
    for (const s of (bo.slides || [])) {
      const tren = Number(s.topViolation || 0);
      const duoi = Number(s.bottomViolation || 0);
      if (tren > BO_QUA_PX) loi.push(`Slide ${s.slide}: nội dung vượt lên trên vùng an toàn ${tren.toFixed(2)}px`);
      if (duoi > BO_QUA_PX) loi.push(`Slide ${s.slide}: nội dung lấn xuống vùng an toàn đáy ${duoi.toFixed(2)}px`);
    }
    /* Không đủ font thì bố cục đo được có thể lệch so với lúc dựng video thật.
       Báo là CẢNH BÁO chứ không phải lỗi: deck vẫn dựng được, chỉ là con số
       safezone không chắc chắn. */
    const canhBao = [];
    if (kq.thieuFont || kq.hetHanNap) {
      canhBao.push('Chưa tải đủ tài nguyên mạng (phông chữ / bộ icon) — số đo bố cục'
        + ' có thể lệch so với lúc dựng video. Kiểm lại khi mạng ổn định.');
    }
    return { ok: !loi.length, loi, canhBao, bo };
  } catch (e) {
    return { ok: false, loi: [`Không đo được bố cục: ${(e && e.message) || e}`], canhBao: [], bo: null };
  } finally {
    try { if (win && !win.isDestroyed()) win.destroy(); } catch { /* đã đóng */ }
  }
}

module.exports = { doBoCuc, KHUNG_W, KHUNG_H, SAFE_TOP, SAFE_BOTTOM }