'use strict';
/**
 * THANH ĐIỀU KHIỂN dưới khung xem trước, trên dải slide.
 *
 *   [▶] 00:00 / 03:34 ──────────  [🔊]  │  [−] ── [+]  [Phù hợp]  │  [📁]
 *
 * ── Nút ▶ mở VIDEO ĐÃ DỰNG, ngay tại chỗ deck đang hiện ─────────────────
 *
 * Bản trước nút này "chạy thử" deck theo `output/timing.json`: bấm sang slide
 * kế tiếp khi hết thời lượng của slide đang xem. Nó trung thực, nhưng chỉ là
 * BẢN MÔ PHỎNG — không có giọng đọc, không có nhạc, không có hiệu ứng video.
 * Mà tệp mp4 thật thì đã nằm sẵn trong `output/`. Nay nút này mở chính tệp đó,
 * ĐÈ LÊN khung deck (`sanKhau.moVideo`), không mở cửa sổ mới.
 *
 * ⚠ **Đồng hồ và thanh tiến độ đọc từ CHÍNH thẻ `<video>`**, không phải từ
 * `timing.json`: `duration` của tệp mới là thời lượng thật của thứ đang phát.
 * Trước khi mở video thì lấy tạm `duration` trong hồ sơ `.info.json` (đường
 * `video:info`) để hiện đúng tổng thời lượng mà không phải nạp cả tệp.
 *
 * ⚠ **`timing.json` vẫn dùng — cho DẢI SLIDE.** Nó là thứ duy nhất nối được
 * giây thứ mấy của video với slide thứ mấy, nên lúc video chạy, dải slide sáng
 * theo chương đang phát và bấm một ô là TUA tới đầu slide đó. Deck chưa dựng
 * lần nào thì không có tệp này — khi ấy dải chỉ đứng im, không bịa gì cả.
 *
 * ── Nút thư mục ─────────────────────────────────────────────────────────
 * Đã CHUYỂN LÊN THANH TRÊN cạnh nút đổi tên (11/10/2026, render/thanh-tren.js
 * `#tbThuMuc`). Ở đây chỉ còn `coVideo()` + `veNutPhai()` gọi thanh trên vẽ lại
 * sau khi đọc xong `video:info` — nguồn sự thật "deck có video chưa" vẫn một chỗ.
 */
(function () {
  const api = window.beeknoee;
  if (!api || !api.preview) return;
  const RP = (window.__renderPage = window.__renderPage || {});
  const $ = (s, g) => (g || document).querySelector(s);

  let moc = null;        // { tong, moc: [{slide, tu, den}] } — chỉ để nối giây ↔ slide
  let tinVideo = null;   // { file, path, duration } — null khi deck chưa có video
  let vid = null;        // thẻ <video> đang mở; null khi chưa mở
  let slideCu = -1;      // chương đang sáng trên dải, tránh vẽ lại mỗi nhịp

  /* NGƯỜI NGHE cho timeline (render/timeline.js): mở/đóng video, chạy/dừng,
     tua, đổi deck. Timeline tự đọc `vid.currentTime` mỗi khung hình khi đang
     chạy — `timeupdate` chỉ ~4 nhịp/giây, đầu phát sẽ nhảy cóc. */
  const nguoiNghe = new Set();
  function bao(loai) {
    nguoiNghe.forEach((f) => { try { f(loai); } catch { /* một người nghe hỏng không kéo cả hội */ } });
  }

  const mmss = (g) => {
    const t = Math.max(0, Math.round(g || 0));
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  };

  /* ── ĐỒNG HỒ TIMELINE (GĐ3.0 lộ trình gộp, 16/10/2026) ────────────────────
     Đầu phát KHÔNG còn là `currentTime` của thẻ video slide: một đồng hồ riêng (performance.now) có
     chạy / dừng / tua / tốc độ / hết ở cuối TIMELINE. Video slide chỉ là một phần tử được đồng bộ
     theo đồng hồ như các khối (dung-xem.js) — kể cả nhảy giữa các đoạn V1 đã cắt / đổi chỗ, và đi tiếp
     qua cuối video slide (khối đặt sau, nền đen). Video slide đang tua / chưa đủ dữ liệu thì đồng hồ
     ĐỨNG chờ (dungXem.dangCho) — không bỏ xa rồi tua giật mãi.
     Sự kiện cho người nghe: 'chay' 'dung' 'tua' 'nhip' (mỗi khung hình khi chạy). */
  const dh = { g: 0, chay: false, toc: 1, moc: 0, nhipCuoi: 0, raf: 0 };
  const bayGio = () => performance.now();
  /** Giây timeline hiện tại. */
  function gio() { return dh.chay ? Math.max(0, dh.g + ((bayGio() - dh.moc) / 1000) * dh.toc) : dh.g; }
  /** Cuối timeline (giây) — theo timeline.js (gồm khối đặt sau cuối video); chưa có thì độ dài video. */
  function tongTl() {
    const t = RP.timeline && RP.timeline.tongGiay ? RP.timeline.tongGiay() : 0;
    return t > 0 ? t : tongGiay();
  }
  function nhipDh() {
    if (!dh.chay) { dh.raf = 0; return; }
    const now = bayGio();
    // Chờ phần tử chính: dời gốc tính giờ lên đúng bằng khoảng chờ ⇒ đồng hồ đứng yên.
    if (RP.dungXem && RP.dungXem.dangCho && RP.dungXem.dangCho()) dh.moc += now - dh.nhipCuoi;
    dh.nhipCuoi = now;
    const het = tongTl();
    if (het > 0 && gio() >= het) {
      dh.g = het;
      dh.chay = false;
      dh.raf = 0;
      veNutChay();
      bao('dung');
      return;
    }
    veThoiGian();
    theoDai();
    bao('nhip');
    dh.raf = requestAnimationFrame(nhipDh);
  }
  function phatDh() {
    if (dh.chay) return;
    dh.moc = bayGio();
    dh.nhipCuoi = dh.moc;
    dh.chay = true;
    veNutChay();
    bao('chay');
    cancelAnimationFrame(dh.raf);
    dh.raf = requestAnimationFrame(nhipDh);
  }
  function dungDh() {
    if (!dh.chay) return;
    dh.g = gio();
    dh.chay = false;
    cancelAnimationFrame(dh.raf);
    dh.raf = 0;
    veNutChay();
    bao('dung');
  }
  function tuaDh(g) {
    const het = tongTl();
    dh.g = Math.max(0, Math.min(Number(g) || 0, het > 0 ? het : Infinity));
    dh.moc = bayGio();
    dh.nhipCuoi = dh.moc;
    veThoiGian();
    theoDai();
    bao('tua');
  }
  /** Tốc độ (J/K/L): đổi giữa chừng không nhảy giờ. */
  function datToc(t) {
    dh.g = gio();
    dh.moc = bayGio();
    dh.toc = Math.max(0.0625, Math.min(16, Number(t) || 1));
  }

  /** Tổng thời lượng: của thẻ video nếu đã mở, không thì của hồ sơ .info.json. */
  function tongGiay() {
    // Dự án VIDEO TRỐNG: nền đen dài hơn nội dung — tổng là độ dài SẼ XUẤT (khối cuối).
    if (RP.dung && RP.dung.laVideo && RP.dung.laVideo() && RP.dung.msXuat && RP.dung.msXuat() > 0) return RP.dung.msXuat() / 1000;
    if (vid && vid.tagName === 'VIDEO' && isFinite(vid.duration) && vid.duration > 0) return vid.duration;
    const d = tinVideo && Number(tinVideo.duration);
    return isFinite(d) && d > 0 ? d : 0;
  }

  function veThoiGian() {
    const el = $('#tpThoiGian');
    const th = $('#tpThanh');
    const tong = tongTl();
    const g = Math.min(gio(), tong || Infinity);
    if (el) el.textContent = `${mmss(g)} / ${mmss(tong)}`;
    if (th) th.style.setProperty('--tp-phan', tong ? `${(g / tong) * 100}%` : '0%');
  }

  /** Slide ứng với giây `g` — cần `timing.json`; không có thì trả -1. */
  function slideTaiGiay(g) {
    if (!moc) return -1;
    for (const m of moc.moc) if (g < m.den) return m.slide;
    return moc.moc.length - 1;
  }

  /* ── mở / đóng video ────────────────────────────────────────────────────
     ⚠ Đường dẫn lấy qua `preview.video(deck, tệp)`, ĐỪNG tự ghép `file://`:
     tên tệp mp4 khác nhau theo thời kỳ (`final_video.mp4` với deck cũ, `<tên
     deck>.mp4` với deck mới) và chính handler đó dò lại khi tên gợi ý sai. */
  /** Dự án video trống: không có video slide — khung xem bản dựng là NỀN ĐEN (GĐ3.4). */
  const laDuAnVideo = () => !!(RP.dung && RP.dung.laVideo && RP.dung.laVideo());
  async function moVideo() {
    if (vid) return vid;
    const deck = RP.deckCau && RP.deckCau.deck();
    if (deck && laDuAnVideo() && RP.sanKhau && RP.sanKhau.moVideo) {
      const den = RP.sanKhau.moVideo(null, { nenDen: true });
      if (!den) return null;
      vid = den;
      veThoiGian(); veNutChay(); veNutTieng();
      bao('mo');
      return vid;
    }
    if (!deck || !tinVideo || !tinVideo.file) return null;
    /* Trình dựng đã SỬA PHỤ ĐỀ (phụ đề tách lớp): mở bản KHÔNG phụ đề, dung-xem.js vẽ phụ đề đã
       sửa lên trên. Không thì video thường (phụ đề đốt sẵn). */
    const thay = RP.dung && RP.dung.videoXem ? RP.dung.videoXem() : null;
    const r = await api.preview.video(deck, thay || tinVideo.file).catch(() => null);
    if (!r || !r.url) {
      if (RP.setStatus) RP.setStatus('Không mở được video đã dựng.', 'bad');
      return null;
    }
    const v = RP.sanKhau && RP.sanKhau.moVideo ? RP.sanKhau.moVideo(r.url) : null;
    if (!v) return null;
    vid = v;
    /* Video slide là phần tử BỊ ĐỒNG BỘ (dung-xem.js) — không nghe play/pause/timeupdate của nó nữa:
       trạng thái chạy/dừng + giờ là của đồng hồ timeline. */
    // Đợi `duration` có thật rồi mới vẽ đồng hồ — trước `loadedmetadata` nó là NaN.
    await new Promise((ok) => {
      if (v.readyState >= 1) { ok(); return; }
      v.addEventListener('loadedmetadata', ok, { once: true });
      setTimeout(ok, 5000);
    });
    v.muted = dangTat;
    veThoiGian(); veNutChay(); veNutTieng();
    bao('mo');
    return vid;
  }

  function dongVideo() {
    if (!vid) return false;
    dungDh();   // đóng khung xem bản dựng = dừng đồng hồ (giữ giờ — mở lại đúng chỗ)
    vid = null;
    slideCu = -1;
    if (RP.sanKhau) {
      RP.sanKhau.dongVideo();
      // Trả dải slide về ô của DECK: nó vừa sáng theo chương của video.
      if (RP.sanKhau.datSlideEp) RP.sanKhau.datSlideEp(null);
      if (RP.sanKhau.veDaiSlide) RP.sanKhau.veDaiSlide();
    }
    veThoiGian(); veNutChay(); veNutTieng();
    bao('dong');
    return true;
  }

  /** Chương đang sáng trên dải slide — theo giây GỐC của video ứng với đầu phát (V1 đã sửa thì quy đổi). */
  function theoDai() {
    if (!vid) return;
    const noi = RP.timeline && RP.timeline.noi;
    const g = noi && noi.dich2goc ? noi.dich2goc(gio()) : gio();
    const i = slideTaiGiay(g);
    if (i < 0 || i === slideCu) return;
    slideCu = i;
    if (RP.sanKhau && RP.sanKhau.datSlideEp) RP.sanKhau.datSlideEp(i);
  }

  async function batTat() {
    /* Video CHƯA mở (đang xem deck): chạy từ ĐẦU PHÁT của timeline. Lấy TRƯỚC moVideo — sự kiện 'mo' kéo đầu phát
       về giờ cũ của đồng hồ (lần xem trước / 0); thiếu dòng này ▶ chạy lại từ 0 dù đã bấm ›, bấm khối slide (audit 23/10). */
    const noi = RP.timeline && RP.timeline.noi;
    const dau = !vid && noi && noi.tDau ? noi.tDau() : null;
    const g0 = gio();
    const v = await moVideo();
    if (!v) return;
    if (dh.chay) { dungDh(); return; }
    // Tua trong lúc chờ mở video (tới 5 s): đồng hồ đã đổi ⇒ lần tua đó thắng, không kéo về đầu phát lúc bấm.
    if (dau != null && Math.abs(gio() - g0) < 1e-6) tuaDh(dau);
    // Xem hết rồi bấm lại = xem lại từ đầu (cuối = cuối TIMELINE: dự án video tới khối cuối, deck gồm cả khối đặt sau).
    const het = tongTl();
    if (het > 0 && gio() >= het - 0.05) tuaDh(0);
    phatDh();
  }

  /**
   * Tua tới đầu slide thứ `i` — dải slide gọi khi đang xem video.
   * @returns {boolean} true = đã nhận việc (đang xem video), dải khỏi đụng deck.
   */
  function tuaToiSlide(i) {
    if (!vid || !moc) return false;
    const m = moc.moc[i];
    if (!m) return false;
    const noi = RP.timeline && RP.timeline.noi;
    tuaDh(noi && noi.goc2dich ? noi.goc2dich(m.tu) : m.tu);
    slideCu = i;
    if (RP.sanKhau && RP.sanKhau.datSlideEp) RP.sanKhau.datSlideEp(i);
    veThoiGian();
    return true;
  }

  function veNutChay() {
    const n = $('#tpChay');
    if (!n) return;
    // Chỉ VẼ — sự kiện 'chay'/'dung' do đồng hồ phát đúng một lần khi đổi trạng thái (trước: mỗi lần vẽ).
    const chay = dh.chay;
    n.classList.toggle('dang-chay', chay);
    const o = n.querySelector('[data-icon]');
    const ten = chay ? 'stop' : 'play';
    if (o && o.dataset.icon !== ten) {
      o.dataset.icon = ten;
      o.innerHTML = '';
      if (window.__beeIcons) window.__beeIcons.apply(n);
    }
    veThoiGian();
  }

  /** Bật/tắt cả thanh theo việc deck đã có video chưa. */
  function veSanSang() {
    const co = coVideo();
    const n = $('#tpChay');
    const th = $('#tpThanh');
    if (n) {
      n.disabled = !co;
      n.title = co
        ? 'Xem video đã dựng ngay trên khung này'
        : 'Chưa có video — bấm "Tạo video" rồi mới xem được';
    }
    if (th) th.classList.toggle('tp-tat', !co);
    veThoiGian();
  }

  /* ── Dự án VIDEO: nền đen LUÔN mở khi dự án đang hiện (23/10/2026) ────────
     Nền đen là khung xem timeline duy nhất của dự án video — đóng nó là chỉ còn khung deck đen trơn, các khối
     không được ghép tới khi tua / bấm thước / chọn khối. Bị đóng ở hai chỗ: napDeck (nạp lại CÙNG deck — bắt đầu
     xuất, sửa tệp) và đổi deck. Mở lại ngay tại giờ đồng hồ (dongVideo giữ dh.g). Dự án deck KHÔNG đụng tới:
     đóng lớp mp4 ở đó là chủ ý. */
  function giuNenDen() {
    const deck = RP.deckCau && RP.deckCau.deck();
    if (vid || !deck || !laDuAnVideo() || (RP.dung.deck && RP.dung.deck() !== deck)) return;
    moVideo();
  }

  let deckVideo = '';   // tinVideo đang là của deck nào — thanh trên hỏi trước khi tin coVideo()
  let deckDh = '';      // đồng hồ đang là của deck nào
  async function napDeck(ten) {
    dongVideo();
    // Deck khác = timeline khác. Dự án video nạp lại CÙNG deck (xuất, sửa tệp) thì giữ đầu phát.
    if (!ten || ten !== deckDh || !laDuAnVideo()) {
      dh.g = 0;
      dh.toc = 1;
    }
    deckDh = ten || '';
    deckVideo = '';
    moc = ten ? await api.preview.timing(ten).catch(() => null) : null;
    tinVideo = ten ? await api.preview.videoInfo(ten).catch(() => null) : null;
    deckVideo = ten || '';
    veSanSang();
    veNutTieng();
    veNutPhai();
    bao('deck');
    // Deck MỚI thì kho dựng chưa nạp xong (laVideo() còn false) — 'nap' bên dưới lo.
    if (ten && RP.deckCau && RP.deckCau.deck() === ten) giuNenDen();
  }

  /**
   * Tua tới giây `g` — timeline gọi khi bấm/kéo trên thước hay trên track.
   * Chưa mở video thì MỞ (giống bấm vào thanh tiến độ), giữ nguyên trạng thái
   * chạy/dừng. Deck chưa có video thì trả false để timeline tự chuyển slide.
   */
  async function tuaToiGiay(g) {
    if (!coVideo()) return false;
    const v = await moVideo();
    if (!v) return false;
    tuaDh(g);
    return true;
  }

  /* ── tắt tiếng ──────────────────────────────────────────────────────────
     ĐANG XEM VIDEO thì tắt tiếng CHÍNH thẻ video. Chưa mở video thì bấm hộ
     `#muteBtn` trong khung deck — engine của deck có nhạc nền và tiếng chuyển
     slide riêng, chỉ nút của nó mới tắt được hết.

     Tự giữ cờ: `toggleMute()` của engine đổi ruột `#muteBtn`, nhưng `quetFA()`
     của editor.js đổi cả hai trạng thái về CÙNG một SVG nên DOM không nói gì.
     ⚠ Engine đặt lại `isMuted = false` mỗi lần nạp deck ⇒ reset theo. */
  let dangTat = false;
  function veNutTieng() {
    const n = $('#tpTieng');
    if (!n) return;
    n.classList.toggle('dang-tat', dangTat);
    n.title = dangTat
      ? (vid ? 'Bật tiếng video' : 'Bật tiếng bản xem trước')
      : (vid ? 'Tắt tiếng video' : 'Tắt tiếng bản xem trước');
    const o = n.querySelector('[data-icon]');
    const ten = dangTat ? 'loatat' : 'loa';
    if (o && o.dataset.icon !== ten) {
      o.dataset.icon = ten;
      o.innerHTML = '';
      if (window.__beeIcons) window.__beeIcons.apply(n);
    }
  }

  /**
   * Nút mở thư mục: CÓ video thì bật (màu nhấn), không thì mờ và chặn hẳn.
   *
   * ⚠ Trạng thái đọc từ `videoInfo(deck)` chứ không soi nút `#revealOutput`
   * trong form: nút đó có thể đang hiện mà thư mục chưa có gì.
   */
  /** Deck đang xem ĐÃ có tệp video trong thư mục ra chưa. */
  function coVideo() { return !!(tinVideo && tinVideo.file) || laDuAnVideo(); }

  function veNutPhai() {
    if (RP.thanhTren && RP.thanhTren.veNutVideo) RP.thanhTren.veNutVideo();
  }

  function veZoom() {
    const o = $('#tpZoom');
    const nhan = $('#tpZoomSo');
    const z = RP.sanKhau && RP.sanKhau.zoom ? RP.sanKhau.zoom() : 1;
    if (o) o.value = String(z);
    if (nhan) nhan.textContent = `${Math.round(z * 100)}%`;
  }

  function dungThanh() {
    const neo = $('#thanhPhat');
    if (!neo) return;
    neo.innerHTML = `
      <button class="tp-chay" type="button" id="tpChay" disabled>
        <span class="btn-icon" data-icon="play"></span></button>
      <span class="tp-gio" id="tpThoiGian">00:00 / 00:00</span>
      <div class="tp-thanh tp-tat" id="tpThanh"><span class="tp-da"></span></div>
      <button class="tp-nut" type="button" id="tpTieng" title="Tắt tiếng bản xem trước">
        <span class="btn-icon" data-icon="loa"></span></button>
      <!-- CUM THU/PHONG DA CHUYEN xuong goc duoi ben trai cua khung slide
           (san-khau.js#dung). Trinh xu ly van o day vi no tra theo id, khong
           theo vi tri - dung dung lai mot bo thu hai.
           KHONG DUNG DAU HUYEN O DAY - no nam trong template literal. -->
`;

    $('#tpChay').onclick = batTat;
    $('#tpTieng').onclick = () => {
      dangTat = !dangTat;
      if (vid) {
        if (vid.tagName === 'VIDEO') vid.muted = dangTat;   // khối + tiếng gốc: dung-xem đọc nút này mỗi nhịp
      } else {
        // Bấm hộ nút tắt tiếng của deck (khung ở origin riêng — đi qua deck-cau).
        if (!(RP.deckCau && RP.deckCau.bamTieng())) dangTat = !dangTat;   // không bấm được thì trả cờ về
      }
      veNutTieng();
    };
    const datZoom = (z) => {
      if (RP.sanKhau && RP.sanKhau.datZoom) RP.sanKhau.datZoom(z);
      veZoom();
    };
    $('#tpZoomTru').onclick = () => datZoom((RP.sanKhau.zoom() || 1) - 0.1);
    $('#tpZoomCong').onclick = () => datZoom((RP.sanKhau.zoom() || 1) + 0.1);
    $('#tpZoom').oninput = () => datZoom(Number($('#tpZoom').value));
    $('#tpVua').onclick = () => { if (RP.sanKhau) RP.sanKhau.datZoom(null); veZoom(); };
    // Kéo trên thanh tiến độ = tua tới giây đó. Chưa mở video thì mở luôn.
    $('#tpThanh').onclick = async (e) => {
      if (!coVideo()) return;
      const b = e.currentTarget.getBoundingClientRect();
      const phan = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width));
      const v = await moVideo();
      if (!v) return;
      tuaDh(phan * tongTl());
    };

    document.addEventListener('keydown', (e) => {
      /* Esc đang gõ số ở bảng Khối, hay đang có hộp xác nhận / thực đơn mở, là để thoát
         CHỖ ĐÓ — không được đóng luôn video + lớp xem trước bản dựng (audit 10/10/2026). */
      if (e.key !== 'Escape' || !vid || e.defaultPrevented) return;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], dialog, [role="dialog"], [role="menu"]')) return;
      // Hộp thoại ĐANG HIỆN (có hộp nằm sẵn trong DOM mà ẩn bằng lớp cha — đo bằng getClientRects).
      if ([...document.querySelectorAll('dialog[open], [aria-modal="true"]')].some((x) => x.getClientRects().length > 0)) return;
      // Dự án VIDEO: lớp nền đen CHÍNH LÀ khung xem timeline — Esc (bỏ chọn khối) không được tắt nó (23/10/2026).
      if (document.querySelector('.sk-video .sk-nen-den')) return;
      dongVideo();
    });

    if (window.__beeIcons) window.__beeIcons.apply(neo);
    if (RP.deckCau) RP.deckCau.nghe((x) => { dangTat = false; napDeck(x.deck); });
    /* Dự án video (GĐ3.4): "có xem được không" phụ thuộc kho dựng ĐÃ NẠP xong loại dự án — nạp sau thanh phát. */
    const ganKho = () => {
      if (RP.dung && RP.dung.nghe) RP.dung.nghe((l) => {
        if (l !== 'nap') return;
        veSanSang(); veNutPhai();
        /* Dự án video vừa nạp: mở nền đen. Một nhịp sau — dung-xem cũng nghe 'nap' và gỡ lớp ghép (dongLop);
           mở trước nó là lớp vừa gắn bị gỡ theo. Nền đen đang mở sẵn (nap lại cùng deck) thì báo 'mo' để
           dung-xem gắn lại lớp ghép vào khung đó. */
        setTimeout(() => {
          if (!laDuAnVideo()) return;
          if (vid) bao('mo');
          else giuNenDen();
        }, 0);
      });
      else setTimeout(ganKho, 300);
    };
    ganKho();
    veZoom();
  }

  Object.assign(RP, {
    /* `coVideo()` mở ra cho hộp "Tạo video" hỏi nhờ — nó cần đúng trạng thái
       này cho nút thư mục trên thanh tiêu đề, mà `tinVideo` thì đóng kín trong
       tệp này. Một nguồn sự thật, hai chỗ dùng. */
    thanhPhat: {
      dungThanh, napDeck, veNutPhai, veZoom, dongVideo, tuaToiSlide, coVideo,
      /** Có video VÀ thông tin video đúng là của `ten` (đang đổi deck thì còn là của deck trước). */
      coVideoCua: (ten) => !!ten && deckVideo === ten && coVideo(),
      // Cho timeline (render/timeline.js):
      batTat, tuaToiGiay, tongGiay,
      // Đồng hồ timeline (GĐ3.0): giây timeline, chạy/dừng/tua/tốc độ.
      gio, dangChay: () => dh.chay, phat: phatDh, dung: dungDh, tua: tuaDh, toc: () => dh.toc, datToc,
      video: () => vid,
      mocThoiGian: () => moc,
      tinVideo: () => tinVideo,
      nghe: (f) => { nguoiNghe.add(f); return () => nguoiNghe.delete(f); },
    },
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dungThanh);
  else dungThanh();
})();
