'use strict';
/**
 * SÂN KHẤU — khung xem trước của deck, nằm THƯỜNG TRÚ giữa trang dựng video.
 *
 * Trước 15/09/2026 deck chỉ xem được trong một LỚP PHỦ toàn màn hình
 * (`slide-viewer.js`): bấm "Xem" → lớp phủ đè lên tất cả → đóng lại mới quay về
 * chỗ dựng video. Tức sửa và dựng là hai chế độ, không nhìn thấy nhau. Nay deck
 * nằm ngay giữa màn hình, bảng sửa bên phải, danh sách dự án bên trái.
 *
 * ⚠ **KHÔNG bỏ `slide-viewer.js`.** Nó chặn mọi đường `/slide/…` còn sót của
 * bản web (thẻ `<a>`, `window.open`) — bỏ nó là mấy đường đó lại ra cửa sổ
 * trắng — và giữ cầu `/api/` cho khung con. Video thành phẩm thì từ 16/09/2026
 * xem THẲNG ở đây (`moVideo` bên dưới, nút ▶ của thanh điều khiển gọi tới);
 * lớp phủ video của nó chỉ còn là lưới an toàn cho mấy liên kết cũ.
 *
 * ⚠ **Khung này ở ORIGIN RIÊNG** (`bee-deck://`, src/main/khungDeck.js — từ 10/10/2026;
 * trước đó cùng origin `file://` và mã deck với được cả API của app). Mọi thao tác đi qua
 * `deckCau` (postMessage), không sờ được `iframe.contentWindow.document` nữa.
 */
(function () {
  const api = window.beeknoee;
  if (!api || !api.preview) return;
  const RP = (window.__renderPage = window.__renderPage || {});

  const $ = (s, g) => (g || document).querySelector(s);

  let hop = null;         // .sk-khung — chỗ chứa iframe
  let daiSlide = null;    // .sk-dai — dải slide dưới đáy
  let deckDangMo = '';
  let dangNap = false;

  /** Gỡ vỏ mà ipcRenderer.invoke bọc quanh lỗi, để câu báo đọc được. */
  const sach = (m) => String(m || '')
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');
  /* ⚠ THOÁT trước khi nhét chữ NGOÀI vào `innerHTML`: chữ của slide (AI hay
     người dùng viết) và câu lỗi từ main đều không phải HTML của mình. Khung app
     là `file://` và có `window.beeknoee`, nên một slide bài giảng HTML chứa
     nguyên văn `<img onerror=…>` làm ví dụ là chạy được mã trong app. */
  const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /**
   * Hiện một dòng thông báo giữa khung (đang dựng / lỗi / chưa chọn deck).
   *
   * ⚠ GỠ RỒI THÊM, đừng `hop.innerHTML = …`. Trong `.sk-khung` còn NÚT LÀM MỚI
   * ở góc trên bên phải; ghi đè cả ruột là nút biến mất ngay lần đổi deck đầu
   * tiên, mà không có lỗi nào báo — đã dính đúng vậy 16/09/2026.
   */
  function bao(chu, loi) {
    if (!hop) return;
    // ⚠ CHỈ gỡ khung deck và ô thông báo cũ — nút làm mới và cụm thu/phóng
    //    cũng nằm trong `.sk-khung`, quét sạch là mất luôn chúng.
    [].slice.call(hop.querySelectorAll('.sk-vung, .sk-bao')).forEach((x) => x.remove());
    const d = document.createElement('div');
    d.className = 'sk-bao' + (loi ? ' sk-loi' : '');
    d.innerHTML = chu;
    hop.appendChild(d);
  }

  /* ── Ảnh thu nhỏ cho dải slide — TỰ ĐỘNG, không còn nút bấm ─────────────
     Bản trước phải bấm "Chụp đủ ảnh": Electron chụp CỬA SỔ chứ không chụp
     riêng iframe, nên vùng khung phải đang hiện và mỗi lượt là màn hình nhảy
     qua hết slide trước mắt người dùng. Nay việc đó chuyển hẳn sang tiến trình
     chính, chạy trong một CỬA SỔ ẨN (`main/anhSlide.js`) — không có gì nhấp
     nháy, nên bỏ được nút bấm tay.

     ⚠ Bên kia nhớ theo CHỮ KÝ của deck (mốc sửa `index.html` · `style.css` ·
     `app.js` · `preview-settings.json`), nên gọi thoải mái: deck chưa đổi thì
     trả ngay bản đã có, đổi rồi mới chụp lại. Đo trên deck 6 slide: lượt chụp
     mới 4,2 giây, lượt lấy từ bộ nhớ 1 ms. Vì vậy chỗ này chỉ cần
     gọi ở BA nhịp — mở deck · watcher nạp lại deck · bảng sửa vừa lưu. */
  const khoAnh = new Map();    // '<tên deck>' -> [data URL, theo số slide]
  let dangTaoAnh = false;
  let henAnh = null;
  /* Bật khi người dùng bấm nút làm mới: lượt chụp kế tiếp bỏ qua bộ nhớ bên
     tiến trình chính. Dùng cờ chứ không thêm tham số cho `mo()` — `mo()` cũng
     chạy khi watcher nạp lại deck, mà lượt đó thì không cần ép. */
  let epChup = false;

  /**
   * Xin ảnh thu nhỏ cho deck đang mở.
   * @param {boolean} ngay true = vừa mở deck (đợi ngắn); false = vừa sửa gì đó.
   */
  function capNhatAnh(ngay) {
    clearTimeout(henAnh);
    /* Giãn nhịp khi vừa sửa: kéo một thanh trượt là bảng sửa lưu vài lượt liền
       nhau, mà mỗi lượt lưu đổi mốc `preview-settings.json` — tức đổi chữ ký. */
    henAnh = setTimeout(async () => {
      const deck = RP.deckCau.deck();
      if (!deck) return;
      dangTaoAnh = true;
      veDaiSlide();
      const ep = epChup;
      epChup = false;
      const r = await api.preview.anhSlide(deck, ep).catch(() => null);
      dangTaoAnh = false;
      if (r && r.anh && r.anh.length) khoAnh.set(deck, r.anh);
      veDaiSlide();
    }, ngay ? 200 : 1400);
  }

  /* ── Lớp VIDEO đè lên sân khấu ──────────────────────────────────────────
     Nút chạy ở thanh điều khiển mở CHÍNH tệp mp4 đã dựng, ngay tại chỗ deck
     đang hiện — không mở cửa sổ mới. Người dùng so được bản dựng với bản sửa
     mà không rời mắt khỏi trang.

     ⚠ Lớp này nằm TRONG `.sk-khung` (`position: relative`), không phải lớp phủ
     toàn màn hình: dải slide và bảng sửa vẫn dùng được trong lúc xem. */
  /** @param {string|null} url  @param {{ nenDen?: boolean }} [o] nenDen + không url = khung xem bản dựng trên NỀN ĐEN
   *  (dự án video — không có video slide, GĐ3.4): trả `<div>` đứng chỗ thẻ video. */
  function moVideo(url, o = {}) {
    if (!hop || (!url && !o.nenDen)) return null;
    dongVideo();
    /* ⚠ Gắn vào `.sk-vung`, KHÔNG gắn vào `.sk-khung`.
       `.sk-vung` là thẻ bọc mang ĐÚNG khổ của deck sau khi thu/phóng (xem
       `vuaKhung()`), còn `.sk-khung` là cả ô giữa trang. Gắn vào ô giữa thì
       `max-height: 100%` tính theo chiều cao ô, nên video 16:9 phình to hơn hẳn
       khung slide và đè ra ngoài — chủ dự án chỉ ra đúng chỗ này. Gắn vào
       `.sk-vung` thì `inset: 0` cho ra ĐÚNG khung deck, không phải tính gì. */
    const vung = hop.querySelector('.sk-vung') || hop;
    const lop = document.createElement('div');
    lop.className = 'sk-video';
    /* Hai lối thoát và MỘT dòng chữ.
       Nút × ở góc phải là lối quen thuộc; nút "Quay lại" ở góc TRÁI là lối mà
       mắt tìm tới đầu tiên khi một thứ vừa đè lên màn hình đang làm việc. Dòng
       "Đang phát video" kèm chấm nhấp nháy để không ai tưởng khung deck hỏng
       hay đứng hình — hai thứ này trông na ná nhau vì cùng khổ, cùng chỗ. */
    /* Nền đen (dự án VIDEO — khung xem timeline, 23/10/2026): KHÔNG có "Quay lại" / "×" / "Đang phát video…".
       Không có khung sửa slide nào để quay về, bấm × chỉ tắt khung xem; ba thứ đó lại đè lên mọi ảnh chụp / video
       hướng dẫn của dự án video. Chúng chỉ có nghĩa khi đang xem bản mp4 đã dựng của DECK. */
    lop.innerHTML = url
      ? '<video class="sk-video-v" playsinline></video>'
        + '<button class="sk-video-lui" type="button" title="Quay lại khung sửa slide (Esc)">'
        + '<span class="btn-icon" data-icon="trai"></span><span>Quay lại</span></button>'
        + '<span class="sk-video-nhan"><i class="sk-video-cham"></i>Đang phát video…</span>'
        + '<button class="sk-video-dong" type="button" title="Đóng video (Esc)"'
        + ' aria-label="Đóng video">×</button>'
      : '<div class="sk-video-v sk-nen-den"></div>';
    const v = lop.querySelector('.sk-video-v');
    const dong = () => {
      if (RP.thanhPhat && RP.thanhPhat.dongVideo) RP.thanhPhat.dongVideo();
      else dongVideo();
    };
    if (url) {
      lop.querySelector('.sk-video-dong').onclick = dong;
      lop.querySelector('.sk-video-lui').onclick = dong;
    }
    // ⚠ Icon chỉ là `data-icon` cho tới khi gọi lại bộ icon — xem `veDaiSlide`.
    if (window.__beeIcons) window.__beeIcons.apply(lop);
    vung.appendChild(lop);
    if (url) v.src = url;
    /* Câm deck bên dưới. Lớp này che HÌNH chứ không che TIẾNG: engine của deck
       có nhạc nền và tiếng chuyển slide riêng, để nguyên là hai đường tiếng
       chồng lên nhau. */
    RP.deckCau.dungMedia();
    return v;
  }

  function dongVideo() {
    const lop = hop && hop.querySelector('.sk-video');
    if (!lop) return false;
    const v = lop.querySelector('video');
    if (v) {
      /* Gỡ `src` rồi `load()`: chỉ `pause()` thì Chromium vẫn giữ tệp mp4 mở,
         mà đổi tên dự án lại cần nhả hết tay cầm vào thư mục deck. */
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch { /* đã gỡ */ }
    }
    lop.remove();
    slideEp = null;
    return true;
  }

  function coVideo() { return !!(hop && hop.querySelector('.sk-video')); }

  /**
   * Ô nào đang sáng trên dải — ÉP theo số này thay vì hỏi khung deck.
   *
   * Dùng khi ĐANG XEM VIDEO: deck bên dưới đứng im, còn dải phải sáng theo
   * chương đang phát (xem `thanh-phat.js`). `null` = trả về hỏi khung deck.
   *
   * ⚠ Chỉ ĐỔI LỚP, không dựng lại dải: dựng lại là thay cả chục thẻ `<img>`
   * data-URL mỗi lần sang chương, dải nháy một cái ngay dưới video đang chạy.
   */
  let slideEp = null;
  function datSlideEp(i) {
    slideEp = i == null ? null : (i | 0);
    if (!daiSlide) return;
    daiSlide.querySelectorAll('[data-slide]').forEach((b) => {
      b.classList.toggle('dang-o', slideEp != null && Number(b.dataset.slide) === slideEp);
    });
  }

  function veDaiSlide() {
    /* Timeline (render/timeline.js) vẽ cùng nguồn — ảnh thu nhỏ, slide đang
       xem — nên mọi nhịp vẽ lại dải cũng là nhịp báo cho nó. Nó tự gom nhịp. */
    if (RP.timeline && RP.timeline.veLai) RP.timeline.veLai();
    if (!daiSlide) return;
    // Chữ từng slide đến qua bản chụp trạng thái của khung (khung ở origin riêng — deck-cau.js).
    const ds = RP.deckCau.chuSlide().slice(0, RP.deckCau.soSlide());
    if (!ds.length) { daiSlide.innerHTML = ''; daiSlide.hidden = true; return; }
    const dang = RP.deckCau.slideHienTai();
    const chiSo = slideEp == null ? (dang ? dang.chiSo : 0) : slideEp;
    daiSlide.hidden = false;
    const deck = RP.deckCau.deck();
    const bo = khoAnh.get(deck) || [];
    daiSlide.innerHTML = `
      <div class="sk-dai-tren">
        <span class="sk-dai-nhan">Danh sách slide <b>(${ds.length})</b></span>
        ${dangTaoAnh ? '<span class="sk-dai-chu">Đang tạo ảnh…</span>' : ''}
        <span class="sk-dai-dieu">
          <button class="sk-dai-nut" type="button" data-buoc="-1" title="Slide trước"
                  aria-label="Slide trước" ${chiSo <= 0 ? 'disabled' : ''}>
            <span class="btn-icon" data-icon="trai"></span></button>
          <button class="sk-dai-nut" type="button" data-buoc="1" title="Slide sau"
                  aria-label="Slide sau" ${chiSo >= ds.length - 1 ? 'disabled' : ''}>
            <span class="btn-icon" data-icon="phai"></span></button>
        </span>
      </div>
      <div class="sk-dai-cuon">${ds.map((s2, i) => {
        const chu = esc(String(s2 || '').slice(0, 42));
        const anh = bo[i];
        return `<button class=\"sk-o${i === chiSo ? ' dang-o' : ''}${anh ? ' co-anh' : ''}\" type=\"button\" data-slide=\"${i}\"
                  title=\"${chu}\"><span class=\"sk-o-so\">${i + 1}</span>
                  ${anh ? `<img class=\"sk-o-anh\" src=\"${anh}\" alt=\"\">` : `<span class=\"sk-o-chu\">${chu || '—'}</span>`}</button>`;
      }).join('')}</div>`;
    /* ⚠ PHẢI gọi lại `apply()`: `data-icon` chỉ là chỗ đánh dấu, bộ icon chạy
       MỘT lượt lúc nạp trang. Dải này dựng lại bằng `innerHTML` mỗi lần đổi
       slide, nên quên là hai nút < > rỗng không — đo được `coSvg: false`, mà
       không có lỗi nào báo. Lần thứ tư dẫm phải bẫy này. */
    if (window.__beeIcons) window.__beeIcons.apply(daiSlide);

    /* Hai nút < > — đi tới/lui MỘT slide. Dùng lại đúng đường của việc bấm vào
       một ô: đang xem video thì TUA video, không thì chuyển deck. */
    daiSlide.querySelectorAll('[data-buoc]').forEach((b) => {
      b.onclick = () => {
        const i = chiSo + Number(b.dataset.buoc);
        if (i < 0 || i >= ds.length) return;
        if (RP.thanhPhat && RP.thanhPhat.tuaToiSlide && RP.thanhPhat.tuaToiSlide(i)) return;
        RP.deckCau.toiSlide(i);
        setTimeout(() => {
          veDaiSlide();
          if (RP.bangSua && RP.bangSua.doiSlide) RP.bangSua.doiSlide();
        }, 120);
      };
    });
    daiSlide.querySelectorAll('[data-slide]').forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.slide);
        /* ĐANG XEM VIDEO thì dải là danh sách CHƯƠNG: bấm = tua video tới đầu
           slide đó. Không đụng vào deck bên dưới — nó đang bị che. */
        if (RP.thanhPhat && RP.thanhPhat.tuaToiSlide && RP.thanhPhat.tuaToiSlide(i)) return;
        RP.deckCau.toiSlide(i);
        // Đợi engine đổi lớp `.active` rồi mới tô lại, không thì tô theo số cũ.
        setTimeout(() => {
          veDaiSlide();
          // Bảng sửa có thứ theo từng slide (lời thoại, tiếng chuyển) — báo nó.
          if (RP.bangSua && RP.bangSua.doiSlide) RP.bangSua.doiSlide();
        }, 120);
      };
    });
  }

  /**
   * Thu/phóng khung cho VỪA sân khấu — CHỈ khi deck cần.
   *
   * ⚠ ĐO XONG MỚI QUYẾT, và phải trả khung về “đầy ô” TRƯỚC khi đo. Có hai
   * loại deck, đã đo cả hai (15/09/2026):
   *
   *   · **Deck lỏng** (21 mẫu dọc): `.slide-container` rộng 100% khung nhìn,
   *     tức nó BÁM THEO cỡ iframe. Đo lúc iframe còn 300×150 mặc định thì ra
   *     đúng 300×150 — một phép đo vòng tròn, đo lại chính thứ mình vừa đặt.
   *     Loại này KHÔNG được phóng: cứ để 100% là deck tự vừa.
   *   · **Deck ghim cứng** (mẫu ngang GD-03): 1232×693 bất kể khung nhìn. Loại
   *     này nhét vào cột giữa ~660px là mọc thanh cuộn, phải thu nhỏ lại.
   *
   * Phân biệt bằng CHÍNH phép đo: trả iframe về 100%, đo `.slide-container`;
   * nhỏ hơn hoặc bằng ô thì thôi, lớn hơn mới thu.
   *
   * ⚠ `transform-origin: top left` + một thẻ BỌC mang cỡ SAU khi thu. Phóng
   * quanh tâm rồi để lưới canh giữa thì hộp chưa thu vẫn tràn ô, và canh giữa
   * một phần tử tràn ô cho ra vị trí lệch hẳn — đã đo: x=313 thay vì x=14.
   */
  /* Hệ số phóng do người dùng đặt. `null` = tự vừa ô (nút "Phù hợp").
     Giữ riêng khỏi phép đo: đổi deck hay đổi cỡ cửa sổ thì phép đo chạy lại,
     còn mức phóng người dùng chọn phải ở nguyên. */
  let zoomTay = null;
  const zoom = () => (zoomTay == null ? 1 : zoomTay);
  function datZoom(z) {
    zoomTay = z == null ? null : Math.max(0.4, Math.min(2.5, z));
    vuaKhung();
  }

  /* ── CANH KHUNG ───────────────────────────────────────────────────────────
     Khung deck ở ORIGIN RIÊNG và là tiến trình riêng: đổi cỡ iframe tới khung KHÔNG đồng bộ,
     và số đo khung slide đến qua bản chụp trạng thái (deck-cau.js) — kèm CỠ KHUNG NHÌN lúc đo.
     Nên thay vì "đặt cỡ rồi đo ngay" như hồi cùng origin, mỗi bước đặt cỡ rồi CHỜ một bản chụp
     đo đúng ở cỡ đó (`theoKhung`, deck-cau gọi mỗi khi có bản chụp):

       1. "đầy ô" — iframe 100% vùng, đo `.slide-container`. Deck LỎNG (21 mẫu dọc) có khung
          slide rộng 100% khung nhìn, tức BÁM THEO cỡ iframe — đo lúc iframe còn 300×150 mặc
          định thì ra đúng 300×150, một phép đo vòng tròn. Số đo này NHỚ theo (khung, cỡ vùng):
          phóng tay / gọi lại khi vùng không đổi thì khỏi đo lại — không nháy.
       2. Ép iframe về ĐÚNG khổ của khung slide (không chừa mép — chừa thì vầng sáng của deck
          hắt ra ngoài thành một mảng sáng lạ giữa nền trang), đo lại.
       3. Deck GHIM CỨNG (mẫu ngang GD-03: 1232×693) không tự co ⇒ `scale()`; phóng TAY thì
          luôn qua bước này. `transform-origin: top left` + thẻ bọc mang cỡ SAU khi thu (phóng
          quanh tâm rồi để lưới canh giữa ra vị trí lệch hẳn — đo được x=313 thay vì x=14). */
  let dangVua = null;   // { f, buoc: 'day' | 'khop', bw, bh, W, H }
  let doDay = null;     // { f, bw, bh, w0, h0 } — số đo "đầy ô" gần nhất

  function vuaKhung() {
    const f = hop && hop.querySelector('iframe');
    const vung = hop && hop.querySelector('.sk-vung');
    if (!f || !vung) return;
    vung.style.width = '100%';
    vung.style.height = '100%';
    const b = vung.getBoundingClientRect();
    if (!b.width || !b.height) return;
    if (doDay && doDay.f === f && Math.abs(doDay.bw - b.width) < 1 && Math.abs(doDay.bh - b.height) < 1) {
      datTheoKho(f, vung, doDay.w0, doDay.h0, b.width, b.height);
    } else {
      f.style.width = '100%';
      f.style.height = '100%';
      f.style.transform = '';
      dangVua = { f, buoc: 'day', bw: b.width, bh: b.height };
    }
    theoKhung();
  }

  function datTheoKho(f, vung, w0, h0, bw, bh) {
    const k0 = Math.min(bw / w0, bh / h0) * zoom();
    const W = Math.round(w0 * k0);
    const H = Math.round(h0 * k0);
    vung.style.width = W + 'px';
    vung.style.height = H + 'px';
    f.style.width = W + 'px';
    f.style.height = H + 'px';
    f.style.transform = '';
    dangVua = { f, buoc: 'khop', W, H };
  }

  /** Gọi mỗi khi khung gửi bản chụp mới (deck-cau.js) — đi tiếp phép canh đang chờ. */
  function theoKhung() {
    const v = dangVua;
    if (!v) return;
    const f = hop && hop.querySelector('iframe');
    const vung = hop && hop.querySelector('.sk-vung');
    if (!f || !vung || f !== v.f) { dangVua = null; return; }
    const vp = RP.deckCau.khungNhin();
    const o = RP.deckCau.kichThuoc();
    if (!vp || !o) return;
    // Bản chụp phải đo ĐÚNG ở cỡ iframe hiện tại — cỡ mới chưa tới khung thì chờ bản sau.
    if (Math.abs(vp.w - f.clientWidth) > 2 || Math.abs(vp.h - f.clientHeight) > 2) return;
    if (v.buoc === 'day') {
      doDay = { f, bw: v.bw, bh: v.bh, w0: o.w, h0: o.h };
      datTheoKho(f, vung, o.w, o.h, v.bw, v.bh);
      theoKhung();   // cỡ không đổi thì bản chụp đang có dùng được luôn
      return;
    }
    dangVua = null;
    f.style.visibility = '';
    const W = v.W;
    const H = v.H;
    const w1 = o.w;
    const h1 = o.h;
    if (zoomTay == null && w1 <= W + 1 && h1 <= H + 1) return;
    const k = Math.min(W / w1, H / h1);
    f.style.width = w1 + 'px';
    f.style.height = h1 + 'px';
    f.style.transformOrigin = 'top left';
    f.style.transform = 'scale(' + k.toFixed(4) + ')';
    vung.style.width = Math.round(w1 * k) + 'px';
    vung.style.height = Math.round(h1 * k) + 'px';
  }
  /**
   * Mở deck vào sân khấu.
   *
   * Dựng khung MỚI ở dưới rồi mới bỏ khung cũ — y hệt `slide-viewer.js#load`:
   * xoá trước là cả vùng giữa chớp trắng một nhịp mỗi lần đổi dự án.
   */
  async function mo(ten) {
    if (!hop || !ten) return;
    if (dangNap) return;
    dangNap = true;
    try {
      if (deckDangMo !== ten) bao('<span class="sk-vong"></span>Đang dựng bản xem trước…');
      const r = await api.preview.build(ten);
      if (r.engineMissing) {
        bao(`Không thấy engine dùng chung:<br><code>${esc(r.engineMissing)}</code>`, true);
        return;
      }
      const f = document.createElement('iframe');
      f.className = 'sk-frame';
      const theme = document.body.classList.contains('theme-light') ? 'light' : 'dark';
      f.src = `${r.url}?t=${Date.now()}&theme=${theme}`;
      // Thẻ bọc mang cỡ SAU khi thu — xem `vuaKhung()`.
      const vung = document.createElement('div');
      vung.className = 'sk-vung';
      vung.appendChild(f);
      hop.appendChild(vung);
      if (RP.dangKyKhungApi) RP.dangKyKhungApi(f, ten);
      /* Ẩn tới khi canh xong lần đầu (theoKhung hiện lại) — không thì iframe hiện "đầy ô" một
         nhịp rồi mới co lại. Deck hỏng không gửi bản chụp nào thì 2 giây sau vẫn hiện. */
      f.style.visibility = 'hidden';
      setTimeout(() => { f.style.visibility = ''; }, 2000);
      await new Promise((ok) => {
        f.addEventListener('load', ok, { once: true });
        setTimeout(ok, 6000);   // khung hỏng thì vẫn phải bỏ khung cũ
      });
      [].slice.call(hop.querySelectorAll('.sk-vung')).forEach((x) => {
        if (x === vung) return;
        const cu = x.querySelector('iframe');
        if (cu && RP.boKhungApi) RP.boKhungApi(cu);
        x.remove();
      });
      [].slice.call(hop.querySelectorAll('.sk-bao')).forEach((x) => x.remove());
      const deckCu = deckDangMo;
      deckDangMo = ten;
      RP.deckCau.dat(f, ten);
      // Dọn `_preview.html` của deck TRƯỚC đó — nó là tệp sinh ra, để lại là rác
      // trong thư mục deck của người dùng.
      if (deckCu && deckCu !== ten) api.preview.cleanup(deckCu).catch(() => {});
      theoDoi(ten);
      vuaKhung();
      /* Xin ảnh thu nhỏ NGAY khi mở deck — và cả khi watcher nạp lại deck, vì
         `mo()` chính là chỗ cả hai đường đi qua. */
      capNhatAnh(true);
      veNutLamMoi();
      nhipChayLaiPhuDe();
      /* Gọi LẦN HAI sau một nhịp: `load` bắn khi tài nguyên xong, nhưng engine
         còn dựng `.slide-container` sau đó, nên lượt đo đầu có thể ra 0 và khung
         giữ nguyên cỡ mặc định 300×150 của iframe. */
      setTimeout(vuaKhung, 250);
      veDaiSlide();
    } catch (e) {
      bao(`Không mở được bản xem trước:<br>${esc(sach(e.message || e))}`, true);
    } finally {
      dangNap = false;
    }
  }

  /**
   * Theo dõi thư mục deck: AI sửa xong là thấy ngay, không phải bấm Tải lại.
   *
   * ⚠ Đăng ký `onChanged` ĐÚNG MỘT LẦN cho cả mô-đun rồi trỏ vào deck đang mở.
   * Đăng ký lại mỗi lần mở là chồng listener: mở deck thứ ba thì một thay đổi
   * gọi nạp lại ba lần, hai trong đó trỏ tới khung đã bị gỡ. (Bẫy này chép
   * nguyên từ lớp phủ cũ ở `slide-viewer.js` — chỗ đó đã gỡ.)
   */
  let daDangKyTheoDoi = false;
  function theoDoi(ten) {
    api.preview.watch(ten).catch(() => { /* không theo dõi được thì vẫn còn nút Tải lại */ });
    if (daDangKyTheoDoi || !api.preview.onChanged) return;
    daDangKyTheoDoi = true;
    api.preview.onChanged(() => {
      if (!deckDangMo) return;
      const t = deckDangMo;
      deckDangMo = '';        // ép `mo()` dựng lại chứ không bỏ qua
      mo(t);
    });
  }

  function dong() {
    dongVideo();
    if (deckDangMo) api.preview.cleanup(deckDangMo).catch(() => {});
    if (api.preview.unwatch) api.preview.unwatch().catch(() => {});
    deckDangMo = '';
    RP.deckCau.dat(null, '');
    // `bao()` giữ lại nút làm mới, chỉ thay ô thông báo — xem chú thích ở đó.
    bao('Bấm "Dự án" trên thanh trên cùng để chọn dự án.');
    veNutLamMoi();
    if (daiSlide) { daiSlide.innerHTML = ''; daiSlide.hidden = true; }
  }

  function dung() {
    const neo = $('#sanKhau');
    if (!neo) return;
    /* KHÔNG còn hàng tiêu đề riêng ở đây (15/09/2026). Tên deck đã nằm trên
       thanh trên cùng; lặp lại lần hai ngay dưới nó là thừa. Nút tắt tiếng
       chuyển lên thanh trên. Nút "Dựng lại" bỏ hẳn: thư mục deck có bộ theo
       dõi, AI sửa xong là khung tự nạp lại (xem `theoDoi`). */
    neo.innerHTML = `
      <div class="sk-khung" id="skKhung">
        <div class="sk-bao">Bấm "Dự án" trên thanh trên cùng để chọn dự án.</div>
        <!-- Cum THU/PHONG nam o GOC DUOI BEN TRAI cua chinh khung slide, khong
             o thanh dieu khien: no tac dong len khung, nen de canh khung thi
             mat noi duoc nguyen nhan voi ket qua. Trinh xu ly van o
             thanh-phat.js (tra theo id) - dung dung lai o day.
             KHONG DUNG DAU HUYEN O DAY - no nam trong template literal. -->
        <div class="sk-zoom" id="skZoom" hidden>
          <button class="sk-zoom-nut" type="button" id="tpZoomCong" title="Phong to"
                  aria-label="Phong to">+</button>
          <input class="sk-zoom-truot" type="range" id="tpZoom" min="0.4" max="2.5" step="0.05" value="1"
                 aria-label="Phong to khung xem truoc">
          <button class="sk-zoom-nut" type="button" id="tpZoomTru" title="Thu nho"
                  aria-label="Thu nho">-</button>
          <button class="sk-zoom-nut" type="button" id="tpVua"
                  title="Vua khung" aria-label="Vua khung">
            <span class="btn-icon" data-icon="vuakhung"></span></button>
          <span class="sk-zoom-so" id="tpZoomSo">100%</span>
        </div>
        <button class="sk-cong-cu" type="button" id="skLamMoi" hidden
                title="Làm mới: quét lại danh sách dự án, dựng lại bản xem trước và chụp lại ảnh slide"
                aria-label="Làm mới bản xem trước">
          <span class="btn-icon" data-icon="refresh"></span></button>
      </div>
      <div class="tp-thanh-phat" id="thanhPhat"></div>
      <div class="sk-dai" id="skDai" hidden></div>`;
    hop = $('#skKhung');
    daiSlide = $('#skDai');
    const nutMoi = $('#skLamMoi');
    if (nutMoi) nutMoi.onclick = lamMoi;
    if (window.__beeIcons) window.__beeIcons.apply(neo);
  }

  /**
   * Làm mới bản xem trước — nút ở góc trên bên phải khung.
   *
   * Nút "quét lại thư mục" ở cột danh sách CHỈ quét lại danh sách dự án; nó
   * không đụng tới khung đang xem. Bình thường khung tự nạp lại nhờ bộ theo dõi
   * thư mục deck, nhưng bộ đó chỉ bắt thay đổi TRONG thư mục deck — sửa engine
   * dùng chung, đổi phông, hay watcher lỡ nhịp thì không ai báo. Nút này là
   * đường tay: dựng lại `_preview.html`, nạp lại khung, và ÉP chụp lại ảnh
   * slide (bỏ qua bộ nhớ theo chữ ký).
   */
  async function lamMoi() {
    const nut = $('#skLamMoi');
    if (nut) nut.classList.add('dang-quay');
    /* Quét lại CẢ DANH SÁCH DỰ ÁN. Nút "Làm mới" ở cột trái đã ẩn (16/09/2026,
       theo yêu cầu: "có nút ở slide rồi"), nên nút này phải gánh luôn việc đó —
       không thì đường quét lại thư mục nguồn mất hẳn.
       ⚠ BẤM HỘ `#refreshList`, đừng gọi thẳng `lamMoiDanhSach()`: trình xử lý
       của nút đó còn lo khoá nút, vòng quay, câu báo trạng thái, và `don-rac.js`
       bám vào cùng sự kiện click để tính lại dung lượng. Ẩn bằng CSS nên `click()`
       vẫn chạy. */
    const nutDS = document.getElementById('refreshList');
    if (nutDS) nutDS.click();

    const ten = deckDangMo;
    if (!ten || dangNap) {
      if (nut) setTimeout(() => nut.classList.remove('dang-quay'), 600);
      return;
    }
    epChup = true;
    deckDangMo = '';          // ép `mo()` dựng lại chứ không bỏ qua
    try { await mo(ten); } finally {
      if (nut) nut.classList.remove('dang-quay');
    }
  }

  /** Hiện nút làm mới khi có deck, giấu khi không. */
  function veNutLamMoi() {
    const nut = $('#skLamMoi');
    if (nut) nut.hidden = !deckDangMo;
    const z = $('#skZoom');
    if (z) z.hidden = !deckDangMo;
  }

  /* ── PHỤ ĐỀ CHẠY LẠI trong bản xem trước ────────────────────────────────
   *
   * Engine chạy phụ đề của slide ĐÚNG MỘT LƯỢT rồi thôi (`startPreviewSubtitles`
   * đặt mốc thời gian, `renderPreviewSubtitles` gỡ lớp `visible` khi hết chữ).
   * Đứng lại ở một slide để ngắm thì chỉ xem được một lần, muốn xem lại phải
   * sang slide khác rồi quay về.
   *
   * ⚠ KHÔNG sửa `engine.js` — nó dùng chung cho 61 deck và nằm trên đường dựng
   * video. Ở đây chỉ GỌI LẠI hàm sẵn có của nó từ cửa sổ app, đúng cách mà
   * `deck-cau.js` vẫn làm. Đường DỰNG VIDEO không đụng tới: nó chạy
   * `_recording.html` với bộ phụ đề riêng (`__startScriptSubtitles`), không
   * qua mã này.
   *
   * ⚠ Chỉ chạy lại khi: khung sẵn sàng · không có lớp video đang che · phụ đề
   * đã tắt hẳn · và đã nghỉ đủ `NGHI_GIAY`.
   */
  const NGHI_GIAY = 3;
  let nghi = 0;
  let nhipPhuDe = null;

  function nhipChayLaiPhuDe() {
    clearInterval(nhipPhuDe);
    nhipPhuDe = setInterval(() => {
      if (!deckDangMo || coVideo()) { nghi = 0; return; }
      const pd = RP.deckCau.phuDe();
      if (!RP.deckCau.sanSang() || !pd.co) { nghi = 0; return; }
      /* ⚠ Lớp phủ phụ đề CHỈ RA ĐỜI khi `startPreviewSubtitles()` chạy lần đầu
         (engine dựng nó trong `ensurePreviewSubtitleOverlay`). Deck vừa nạp,
         đứng yên ở slide 0 thì chưa có nút nào — bỏ qua ca đó là phụ đề không
         bao giờ tự chạy. Coi "chưa có" cũng như "đã tắt": đếm giờ rồi gọi. */
      if (pd.chay) { nghi = 0; return; }   // đang chạy dở
      nghi += 1;
      if (nghi < NGHI_GIAY) return;
      nghi = 0;
      const dang = RP.deckCau.slideHienTai();
      RP.deckCau.batPhuDe(dang ? dang.chiSo : 0);
    }, 1000);
  }

  /** Gọi từ `setSelectedProject` — đổi dự án là đổi luôn deck trên sân khấu. */
  function chonDeck(ten, khung) {
    /* Đóng video NGAY, đừng đợi khung mới nạp xong: `thanh-phat` chỉ nghe được
       tin đổi deck khi `deckCau.dat()` chạy — mà chỗ đó nằm CUỐI `mo()`, sau cả
       lượt dựng lại bản xem trước. Không đóng ở đây thì video của deck cũ còn
       chạy đè lên trong lúc deck mới đang nạp. */
    /* Chọn lại CHÍNH dự án video đang mở (lamMoiDanhSach sau khi xuất): nền đen là khung xem timeline của nó,
       không phải "video của deck cũ" — đóng là không còn gì mở lại (23/10/2026). Dự án deck vẫn đóng như cũ. */
    const cungVideo = !!ten && ten === deckDangMo && RP.dung && RP.dung.laVideo && RP.dung.laVideo();
    if (!cungVideo && RP.thanhPhat && RP.thanhPhat.dongVideo) RP.thanhPhat.dongVideo();
    // Tên deck và nhãn khổ nay do thanh trên cùng hiện (xem `thanh-tren.js`).
    if (RP.thanhTren) RP.thanhTren.veTen(ten, khung);
    if (!ten) { dong(); return; }
    if (ten === deckDangMo) return;
    mo(ten);
  }

  window.addEventListener('resize', () => {
    clearTimeout(vuaKhung._t);
    vuaKhung._t = setTimeout(vuaKhung, 120);
  });

  Object.assign(RP, { sanKhau: {
    dung, chonDeck, mo, dong, lamMoi, veDaiSlide, datSlideEp, vuaKhung, theoKhung, zoom, datZoom, capNhatAnh, moVideo, dongVideo, coVideo,
    // Cho timeline: ảnh thu nhỏ đã có (data URL theo số slide) + đang chụp dở hay không.
    anh: (deck) => khoAnh.get(deck) || [],
    dangTaoAnh: () => dangTaoAnh,
  } });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', dung);
  } else {
    dung();
  }
})();
