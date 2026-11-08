'use strict';
/**
 * XEM TRƯỚC BẢN DỰNG trên sân khấu — "Program Monitor" của trình dựng (KE-HOACH.md §6).
 *
 * Khi video slide đang mở (thanh-phat.js), lớp `.dx-lop` nằm ĐÈ đúng vùng KHUNG XUẤT
 * (= vùng hình của video, hoặc khung 16:9/1:1… đã chọn — video slide khi đó đặt giữa,
 * nền nhoè/đen như bản xuất) và vẽ các khối người dùng đang ở dưới đầu phát: `<video>` /
 * `<img>` đặt bằng CSS theo `moHinh.hinhTai` — CHÍNH các mảnh toán mà bản xuất
 * (src/dung/xuat.js) dựng biểu thức ffmpeg, nên vị trí / cỡ / xoay / keyframe / chuyển
 * cảnh / cắt khung khớp nhau. Tiếng:
 *   · giọng + nhạc/hiệu ứng deck phát từ hai tệp TÁCH SẴN (`tachTieng`) theo âm lượng
 *     của bảng Khối, video slide bị câm; không có tệp tách thì để tiếng video như cũ;
 *   · khối tiếng / tiếng của khối video phát bằng phần tử riêng (keyframe âm lượng);
 *   · hạ nhạc khi có giọng: CÙNG đường cong `moHinh.btHaNhac` với bản xuất.
 * Khối đang chọn có khung + 4 góc: kéo thân = dời, kéo góc = co giãn (một bước hoàn tác);
 * thuộc tính đang có keyframe thì kéo là đặt keyframe tại đầu phát.
 *
 * ⚠ GIỚI HẠN ĐÃ BIẾT: `<video>` tua không chuẩn từng khung — xem trước có thể lệch vài
 * khung khi kéo nhanh; âm lượng > 100% nghe như 100% (bản xuất vẫn đúng). Xem trước
 * chuẩn khung là việc của Giai đoạn 3 (WebCodecs).
 */
(function () {
  const RP = window.__renderPage || {};
  const M = window.__beeDung && window.__beeDung.moHinh;
  if (!M) return;

  const LECH_TUA = 0.25;      // ĐANG CHẠY: lệch quá 0,25 s so với đầu phát thì tua phần tử con lại
  const LECH_TUA_DUNG = 0.02; // ĐANG DỪNG (bước từng khung): lệch quá nửa khung là tua — khớp bản xuất
  const NAP_TRUOC_MS = 1500;  // tạo phần tử trước khi khối bắt đầu 1,5 s cho kịp nạp
  const KHUNG_MS = 34;
  let lop = null;             // .dx-lop đè lên vùng khung xuất
  let nen = null;             // <canvas> nền nhoè / đen khi khung xuất khác khổ video
  let master = null;          // <video> slide đang mở
  const pt = new Map();       // id khối → { el, kieu, src }
  let goc = { giong: null, deck: null };   // <audio> hai lớp tiếng tách sẵn
  let vong = 0;
  let quanSat = null;         // ResizeObserver của lớp cha video
  let khungRieng = false;     // đang đặt video slide theo khung xuất khác khổ
  let hoatDong = { deck: '', ds: [], dangHoi: false };   // các đoạn có giọng (hạ nhạc)
  let keoDaiNho = { d: null, moc: null, map: new Map() };

  const D = () => RP.dung;
  /* Gỡ một phần tử media cho HẲN: chỉ pause()+remove() thì Chromium vẫn giữ luồng
     `bee-media` (tệp trong dung/ / output/) mở — đổi tên hay xoá deck báo "đang được
     dùng" (như san-khau.js đã gặp với mp4). Bỏ src + load() mới nhả tệp (audit 10/10/2026). */
  function boPhanTu(el) {
    if (!el) return;
    try { if (el.pause) el.pause(); } catch { /* bỏ */ }
    if (el.tagName === 'VIDEO' || el.tagName === 'AUDIO') {
      try { el.removeAttribute('src'); el.load(); } catch { /* bỏ */ }
    }
    el.remove();
  }
  /** Gỡ một khối xem trước: phần tử media + canvas khung chuẩn (nếu có) + lớp bọc mặt nạ. */
  function boKhoi(p) {
    boPhanTu(p.el);
    if (p.cv) p.cv.remove();
    if (p.mat) p.mat.remove();
    (p.nhay || []).forEach((x) => x.remove());
  }

  /* ── MẶT NẠ / NHÁY của chuyển cảnh (đợt 1 hiệu ứng) ──────────────────────
     Mỗi khối hình nằm trong một lớp bọc `.dx-mat` PHỦ CẢ KHUNG XUẤT: mặt nạ của xfade tính theo khung (moHinh.gradMat →
     `mask-image`), không theo hộp khối — đặt lên chính phần tử thì xoay / cắt khung làm méo mặt nạ. Nháy qua màu: lớp màu
     ANH EM ngay sau lớp bọc (cùng z-index, đứng sau trong DOM ⇒ đè lên khối, dưới mọi khối chồng sau) — KHÔNG nằm trong
     lớp bọc: mặt nạ ở đầu kia của khối không được che lớp màu (bản xuất phủ cả khung — rà soát đợt 1); hai lần nháy
     chồng nhau (khối ngắn) là hai lớp như bản xuất. */
  function apMat(p, mn) {
    const w = p.mat;
    if (!w) return;
    const mask = mn && mn.mask.length ? mn.mask.join(', ') : '';
    // So với chuỗi ĐÃ ĐẶT (trình duyệt chuẩn hoá giá trị đọc lại — so style là lần nào cũng khác).
    if (w.dataset.mask !== mask) {
      w.dataset.mask = mask;
      w.style.maskImage = mask;
      w.style.maskComposite = mn && mn.mask.length > 1 ? 'intersect' : '';
    }
    const phu = (mn && mn.phu) || [];
    p.nhay = p.nhay || [];
    phu.forEach((x, i) => {
      let el = p.nhay[i];
      if (!el) {
        el = document.createElement('div');
        el.className = 'dx-nhay';
        (i ? p.nhay[i - 1] : w).after(el);
        p.nhay[i] = el;
      }
      el.style.zIndex = w.style.zIndex;
      el.style.background = x.mau;
      el.style.opacity = String(x.mo);
      el.hidden = false;
    });
    for (let i = phu.length; i < p.nhay.length; i += 1) p.nhay[i].hidden = true;
  }
  const dangTat = () => { const n = document.querySelector('#tpTieng'); return !!(n && n.classList.contains('dang-tat')); };
  /* Đồng hồ timeline (thanh-phat.js, GĐ3.0) — nguồn DUY NHẤT của giờ + chạy/dừng + tốc độ. */
  const TP = () => RP.thanhPhat || {};
  const gioDongHo = () => (TP().gio ? TP().gio() : 0);
  const chayDongHo = () => !!(TP().dangChay && TP().dangChay());
  const tocDongHo = () => (TP().toc ? TP().toc() : 1);
  /** Video slide đang trong vùng phát mà chưa sẵn sàng (đang tua / thiếu dữ liệu) — đồng hồ đứng chờ. */
  let masterTrongVung = false;
  /* Chờ có HẠN (rà GĐ3): video hỏng / thiếu tệp / giải mã không nổi thì readyState không bao giờ lên 3 — đồng hồ
     đứng mãi, nút hiện "đang phát" mà đầu phát không nhúc nhích. Lỗi ⇒ thôi chờ ngay; quá CHO_TOI_DA_MS ⇒ chạy tiếp. */
  const CHO_TOI_DA_MS = 4000;
  let choTu = 0;
  function dangCho() {
    const cho = !!(master && laTheVideo() && masterTrongVung && chayDongHo() && !master.error
      && (master.seeking || master.readyState < 3));
    if (!cho) { choTu = 0; return false; }
    const bay = performance.now();
    if (!choTu) choTu = bay;
    return bay - choTu < CHO_TOI_DA_MS;
  }
  /* RANH GIỚI ĐOẠN V1 (rà GĐ3): video slide chạy liền, chỉ bị kéo lại khi lệch > LECH_TUA — ở chỗ CẮT / ĐỔI CHỖ
     slide nó phát lố tới 0,25 s hình (và tiếng tách) của phần đã bỏ; khúc tỉa < 0,25 s thì không bao giờ bị tua.
     Đổi sang đoạn mà nguồn KHÔNG liền đoạn trước ⇒ tua NGAY (như vòng phát cũ của timeline.js tua ở cuối đoạn). */
  let doanTruoc = -1;
  /* Dự án video (GĐ3.4): "master" là <div> nền đen của khung xem (san-khau.moVideo nenDen) — không có gì để
     đồng bộ / đo; khổ = khổ dự án. */
  const laTheVideo = () => !!(master && master.tagName === 'VIDEO');
  const kep = (v, a, b) => Math.max(a, Math.min(b, v));
  const khungXuat = () => (D() && D().khungXuat && D().khungXuat()) || null;
  /** Khối nào đang kéo dài dưới chuyển cảnh "hoà" — nhớ theo tham chiếu dự án + mốc. */
  function keoDai(d, moc) {
    if (keoDaiNho.d !== d || keoDaiNho.moc !== moc) keoDaiNho = { d, moc, map: M.keoDaiMs(d, moc) };
    return keoDaiNho.map;
  }

  /* ── lớp đè: đúng vùng KHUNG XUẤT (contain) ────────────────────────────── */
  function canLop() {
    if (!lop || !master) return;
    const cha = lop.parentElement;
    if (!cha) return;
    const W = cha.clientWidth;
    const H = cha.clientHeight;
    const d = D() && D().duAn();
    const KV = d ? d.khung : { rong: master.videoWidth || 1080, cao: master.videoHeight || 1920 };
    const vw = master.videoWidth || KV.rong;
    const vh = master.videoHeight || KV.cao;
    const K = khungXuat() || { rong: vw, cao: vh };
    const rieng = Math.abs(K.rong / K.cao - vw / vh) > 0.01;
    // Khung xuất (vừa vùng sân khấu)
    const s = Math.min(W / K.rong, H / K.cao);
    const w = K.rong * s;
    const h = K.cao * s;
    const trai = (W - w) / 2;
    const tren = (H - h) / 2;
    lop.style.left = `${trai}px`;
    lop.style.top = `${tren}px`;
    lop.style.width = `${w}px`;
    lop.style.height = `${h}px`;
    if (rieng) {
      // Video slide đặt giữa khung xuất — CÙNG vùng bản xuất dùng (moHinh.vungVideo).
      const vv = M.vungVideo({ rong: vw, cao: vh }, K);
      Object.assign(master.style, {
        position: 'absolute', objectFit: 'fill',
        left: `${trai + (vv.trai / K.rong) * w}px`, top: `${tren + (vv.tren / K.cao) * h}px`,
        width: `${(vv.w / K.rong) * w}px`, height: `${(vv.h / K.cao) * h}px`,
      });
      if (!nen) {
        nen = document.createElement('canvas');
        nen.className = 'dx-nen';
        cha.insertBefore(nen, master);
      }
      Object.assign(nen.style, { left: `${trai}px`, top: `${tren}px`, width: `${w}px`, height: `${h}px` });
      // Đặt lại cỡ canvas là XOÁ nó — chỉ khi cỡ đổi thật (canLop chạy ở mỗi lần sửa dự án).
      const nw = Math.max(16, Math.round(w / 6));
      const nh = Math.max(16, Math.round(h / 6));
      if (nen.width !== nw) nen.width = nw;
      if (nen.height !== nh) nen.height = nh;
      khungRieng = true;
      cha.classList.add('dx-co-khung');   // nền đặc: deck phía sau không ló ra quanh khung xuất
      veNen();
    } else if (khungRieng) traKhung();
  }
  function traKhung() {
    if (master) ['position', 'objectFit', 'left', 'top', 'width', 'height'].forEach((k) => { master.style[k] = ''; });
    if (nen) { if (nen.parentElement) nen.parentElement.classList.remove('dx-co-khung'); nen.remove(); nen = null; }
    khungRieng = false;
  }
  /** Nền khung xuất: video slide phóng TRÀN khung, nhoè + tối nhẹ (như bản xuất) — hoặc đen. */
  function veNen() {
    if (!nen || !master) return;
    const g = nen.getContext('2d');
    const d = D() && D().duAn();
    if (!d || (d.xuat || {}).nen === 'den' || !laTheVideo() || !(master.videoWidth > 0)) {
      g.fillStyle = '#000';
      g.fillRect(0, 0, nen.width, nen.height);
      return;
    }
    const s = Math.max(nen.width / master.videoWidth, nen.height / master.videoHeight);
    const w = master.videoWidth * s;
    const h = master.videoHeight * s;
    g.filter = `blur(${Math.max(2, Math.round(Math.max(nen.width, nen.height) / 48))}px) brightness(0.92)`;
    try { g.drawImage(master, (nen.width - w) / 2, (nen.height - h) / 2, w, h); } catch { /* chưa có khung */ }
    g.filter = 'none';
  }

  function moLop(v) {
    master = v;
    const cha = v.parentElement;
    if (!cha) return;
    lop = document.createElement('div');
    lop.className = 'dx-lop';
    cha.insertBefore(lop, v.nextSibling);
    if (v.tagName === 'VIDEO') v.addEventListener('loadedmetadata', canLop);
    // Đổi cỡ khung sân khấu (kéo timeline, kéo cột) thì đo lại — quan sát CHÍNH lớp cha.
    if (window.ResizeObserver) { quanSat = new ResizeObserver(canLop); quanSat.observe(cha); }
    canLop();
    ganKeo();
    capNhat();
  }

  /* ── chỉnh màu (GĐ2.4): SVG feColorMatrix CÙNG ma trận với colorchannelmixer của bản xuất (moHinh.svgMau) ── */
  let svgMauGoc = null;
  const svgMauId = new Map();
  let soMau = 0;   // id KHÔNG bao giờ dùng lại — dọn bộ đệm thì phần tử đang giữ id cũ mất lọc, không nhận nhầm lọc khác
  /** Dọn khi quá 200 bộ lọc — CHỈ ở đầu một lượt capNhat (mọi phần tử được gán lại ngay trong lượt đó). */
  function donMau() {
    if (svgMauGoc && svgMauId.size > 200) { svgMauGoc.textContent = ''; svgMauId.clear(); }
  }
  /** @param {object|null} mKhoi màu khối (cột alpha)  @param {object|null} mVideo màu cả video (cột hằng) */
  function locCss(mKhoi, mVideo) {
    const ra = [];
    [[mKhoi, false], [mVideo, true]].forEach(([m, hangSo]) => {
      if (!m) return;
      const v = M.svgMau(m, hangSo);
      let id = svgMauId.get(v);
      if (!id) {
        if (!svgMauGoc) {
          svgMauGoc = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svgMauGoc.setAttribute('width', '0');
          svgMauGoc.setAttribute('height', '0');
          svgMauGoc.setAttribute('aria-hidden', 'true');
          svgMauGoc.style.position = 'absolute';
          document.body.appendChild(svgMauGoc);
        }
        soMau += 1;
        id = `dxMau${soMau}`;
        const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        f.setAttribute('id', id);
        f.setAttribute('color-interpolation-filters', 'sRGB');
        const cm = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
        cm.setAttribute('type', 'matrix');
        cm.setAttribute('values', v);
        f.appendChild(cm);
        svgMauGoc.appendChild(f);
        svgMauId.set(v, id);
      }
      ra.push(`url(#${id})`);
    });
    return ra.join(' ');
  }

  function dongLop() {
    if (master) master.style.filter = '';
    if (pdEl) { pdEl.goc.remove(); pdEl = null; }
    pt.forEach((p) => boKhoi(p));
    pt.clear();
    if (KC()) KC().don();
    Object.values(goc).forEach((a) => boPhanTu(a));
    goc = { giong: null, deck: null };
    traKhung();
    if (lop) lop.remove();
    if (quanSat) { quanSat.disconnect(); quanSat = null; }
    lop = null;
    master = null;
    cancelAnimationFrame(vong);
    vong = 0;
  }

  /* ── hạ nhạc khi có giọng: các đoạn có giọng (cùng nguồn với bản xuất) ──
     Hai nguồn giọng (GĐ2.1b), gộp trên trục TIMELINE như xuat.js: (1) giọng của deck — đo trên tệp giọng GỐC,
     V1 đã sửa thì chiếu lên timeline (chieuKhoang); (2) khối trên track tiếng vai trò 'giong' (moHinh.khoangGiongNd). */
  function heSoHaNhac(d, ms, moc) {
    const ha = d.amGoc && d.amGoc.haNhac;
    const dg = D();
    const ag = d.amGoc || {};
    if (!ha || !ha.bat) return 1;
    const nd = M.khoangGiongNd(d, moc);
    // Như bản xuất: giọng deck chỉ tính khi CÓ giọng tách và giọng không bị tắt / về 0.
    const coDeck = !!dg.tachTieng() && !ag.tatGiong && ag.giong > 0;
    if (hoatDong.deck !== dg.deck()) {
      hoatDong = { deck: dg.deck(), ds: [], dangHoi: false, bt: null };
    }
    if (!coDeck) {
      if (!nd.length) return 1;
      return beHa(nd, KHONG_DECK, ha.mucDb, ms);
    }
    if (!hoatDong.bt && !hoatDong.dangHoi && window.beeknoee && window.beeknoee.dung.hoatDong) {
      hoatDong.dangHoi = true;
      const ten = dg.deck();
      window.beeknoee.dung.hoatDong(ten).then((r) => {
        if (hoatDong.deck !== ten) return;
        hoatDong.ds = (r && r.ds) || [];
        hoatDong.mucDb = null;
        hoatDong.dangHoi = false;
        hoatDong.bt = null;
        hoatDong.daHoi = true;
        capNhat();
      }).catch(() => { hoatDong.dangHoi = false; });
    }
    if (!hoatDong.daHoi) return nd.length ? beHa(nd, KHONG_DECK, ha.mucDb, ms) : 1;
    if (hoatDong.mocChieu !== moc || hoatDong.dsGoc !== hoatDong.ds) {
      hoatDong.dsTl = hoatDong.ds.flatMap((x) => M.chieuKhoang(moc, x.tuMs, x.denMs));
      hoatDong.mocChieu = moc;
      hoatDong.dsGoc = hoatDong.ds;
    }
    return beHa(nd, hoatDong.dsTl, ha.mucDb, ms);
  }
  /* Đường cong nhớ theo DẤU (khoảng giọng khối + đoạn giọng deck + mức hạ) — xem trước gọi mỗi khung hình. */
  const KHONG_DECK = Object.freeze([]);
  let haNho = { dau: '', bt: null };
  function beHa(nd, dsDeck, mucDb, ms) {
    const dau = `${mucDb}|${dsDeck.length}|${dsDeck === hoatDong.dsTl ? 'd' : ''}|${nd.map((x) => `${x.tuMs}-${x.denMs}`).join(',')}`;
    if (haNho.dau !== dau || haNho.dsDeck !== dsDeck) haNho = { dau, dsDeck, bt: M.btHaNhac(dsDeck.concat(nd), mucDb) };
    return haNho.bt.f(ms);
  }

  /* ── tiếng gốc tách sẵn ───────────────────────────────────────────────── */
  function tiengGoc(ms, dangChay, haNhac, ep) {
    const dg = D();
    const d = dg && dg.duAn();
    const ag0 = (d && d.amGoc) || M.amGocMacDinh();
    /* Không chỉnh gì ở lớp gốc (100%, không tắt, không hạ nhạc): phát tiếng CỦA CHÍNH VIDEO —
       đúng tuyệt đối với tệp mp4, không lệch đồng bộ giữa hai tệp tách (audit: người chưa mở
       trình dựng cũng nghe to gấp đôi khi xem video). */
    const macDinh = ag0.giong === 1 && ag0.deck === 1 && !ag0.tatGiong && !ag0.tatDeck && haNhac === 1
      && !(ag0.haNhac && ag0.haNhac.bat);
    const tt = dg && !macDinh && dg.tachTieng();
    if (!tt || !d || !master || !laTheVideo()) {
      /* Không có tiếng tách: tiếng của video là bản ĐÃ TRỘN — áp âm lượng / tắt của A1
         lên chính nó, đúng như bản xuất làm với `[0:a]` (audit 10/10/2026). */
      ['giong', 'deck'].forEach((k) => { if (goc[k]) { boPhanTu(goc[k]); goc[k] = null; } });
      if (master && d && laTheVideo()) {
        const ag0 = d.amGoc || M.amGocMacDinh();
        master.muted = dangTat() || ag0.tatGiong || ag0.giong <= 0;
        master.volume = kep(ag0.giong, 0, 1);
      }
      return;
    }
    master.muted = true;
    const ag = d.amGoc || M.amGocMacDinh();
    // × 0,5: bước ghép trộn hai lớp bằng amix chuẩn hoá (chia đều khi cả hai cùng phát) — xuat.js làm y vậy.
    [['giong', ag.tatGiong ? 0 : ag.giong * 0.5], ['deck', ag.tatDeck ? 0 : ag.deck * haNhac * 0.5]].forEach(([k, am]) => {
      if (!goc[k]) {
        const a = document.createElement('audio');
        a.preload = 'auto';
        a.src = dg.url(tt[k]);
        a.className = 'dx-am';
        lop.appendChild(a);
        goc[k] = a;
      }
      const a = goc[k];
      a.volume = kep(am, 0, 1);
      a.muted = dangTat() || am <= 0;
      dongBo(a, ms / 1000, dangChay, 1, ep);
    });
  }

  /** Đưa một phần tử media con về đúng giây `g`, chạy/dừng theo ĐỒNG HỒ timeline. */
  function dongBo(el, g, dangChay, toc, ep) {
    if (el.readyState >= 1 && Math.abs((el.currentTime || 0) - g) > (dangChay && !ep ? LECH_TUA : LECH_TUA_DUNG)) {
      try { el.currentTime = Math.max(0, g); } catch { /* chưa tua được */ }
    }
    // Theo cả tốc độ của đồng hồ (J/K/L phát 2×, 4×…) — không thì lớp con trôi rồi bị tua giật.
    // Chromium chỉ nhận 1/16–16× (4× tốc độ khối × 8× J/K/L = 32 ném lỗi, vòng vẽ chết — audit).
    const tocThat = kep(toc * tocDongHo(), 0.0625, 16);
    if (el.playbackRate !== tocThat) { try { el.playbackRate = tocThat; } catch { /* trình phát từ chối */ } }
    /* `ended`: play() trên phần tử đã HẾT là tua về giây 0 (chuẩn HTML) — video slide bị ghim ở khung cuối mà gọi
       play() là loé slide 1 + tiếng đầu rồi tua lại (rà GĐ3). Đã hết thì đứng ở khung cuối. */
    if (dangChay && el.paused && !el.ended) el.play().catch(() => { /* chặn tự phát thì thôi */ });
    else if (!dangChay && !el.paused) el.pause();
  }

  /**
   * Đặt phần tử theo hình học `h` (moHinh.hinhTai) — kèm CẮT KHUNG + LẬT:
   * phần tử mang CẢ media (chưa cắt), `clip-path` chừa phần còn lại; xoay/lật quanh TÂM
   * phần còn lại — như bản xuất cắt trước rồi mới co/xoay/lật.
   */
  function apHinh(el, h, c, K) {
    const ct = c.cat || {};
    const l = ct.trai || 0;
    const r = ct.phai || 0;
    const t = ct.tren || 0;
    const du = ct.duoi || 0;
    const fw = h.w / (1 - l - r);
    const fh = h.h / (1 - t - du);
    const st = el.style;
    st.left = `${((h.trai - l * fw) / K.rong) * 100}%`;
    st.top = `${((h.tren - t * fh) / K.cao) * 100}%`;
    st.width = `${(fw / K.rong) * 100}%`;
    st.height = `${(fh / K.cao) * 100}%`;
    st.clipPath = l || r || t || du ? `inset(${t * 100}% ${r * 100}% ${du * 100}% ${l * 100}%)` : '';
    st.transformOrigin = `${((l * fw + h.w / 2) / fw) * 100}% ${((t * fh + h.h / 2) / fh) * 100}%`;
    const lat = c.lat || {};
    st.transform = `${h.xoay ? `rotate(${h.xoay}deg)` : ''}${lat.ngang || lat.doc ? ` scale(${lat.ngang ? -1 : 1}, ${lat.doc ? -1 : 1})` : ''}`;
  }

  /* ── PHỤ ĐỀ ĐÃ SỬA (phụ đề tách lớp, Giai đoạn 3) ─────────────────────────
     Video đang mở là bản KHÔNG phụ đề (RP.dung.videoXem) ⇒ vẽ phụ đề bằng CÙNG cấu trúc DOM +
     CSS phụ đề của deck (src/render/recordingHtml.js — dung:doc gửi kèm), trong khung CSS của
     deck (390×693 với deck dọc) rồi phóng theo vùng video — như trang quay làm. Biến CSS của
     deck đổi `:root` → `.dx-phude`: không được đè token của app. */
  let pdEl = null;
  const pdChiSoCau = (caps, t) => {
    let ung = -1;
    for (let i = 0; i < caps.length; i += 1) {
      const c = caps[i];
      if (t >= c.start && t <= c.end + 0.18) return i;
      if (c.start <= t) ung = i;
      if (c.start > t) break;
    }
    return ung;
  };
  const pdChiSoChu = (ws, t) => {
    let ung = -1;
    for (let i = 0; i < ws.length; i += 1) {
      const w = ws[i];
      if (t >= w.start && t <= w.end + 0.08) return i;
      if (w.start <= t) ung = i;
      if (w.start > t) break;
    }
    return ung;
  };
  /* V1 đã sửa: câu chiếu lên trục TIMELINE (moHinh.chieuPhuDe — cùng phép với bản xuất), tra theo
     giây timeline. Tra theo giây gốc thì câu bị cắt giữa chừng hiện đủ chữ ở xem trước mà bản
     xuất chỉ còn nửa sau (audit GĐ3). Nhớ theo tham chiếu (caps, mốc). */
  let pdChieu = { caps: null, moc: null, ra: [] };
  function capsTimeline(caps, moc) {
    if (!moc || !moc.doan) return caps;
    if (pdChieu.caps !== caps || pdChieu.moc !== moc) pdChieu = { caps, moc, ra: M.chieuPhuDe(caps, moc) };
    return pdChieu.ra;
  }
  function vePhuDe(msTra, K) {
    const dg = D();
    const tt = dg && dg.phuDeTt && dg.phuDeTt();
    // Tắt = MỘT trạng thái cho cả hai cờ (nút 👁 C1 — render/kieu-phu-de.js), không chỉ `phuDe.an` (rà GĐ1).
    const tatPd = RP.phuDe ? RP.phuDe.tat() : dg.phuDeAn();
    const dung = !!(tt && dg.videoXem && dg.videoXem() && !tatPd);
    if (!lop || !dung) { if (pdEl) { pdEl.goc.remove(); pdEl = null; } return; }
    if (!pdEl || !pdEl.goc.isConnected) {
      const goc = document.createElement('div');
      goc.className = 'dx-phude';
      const st = document.createElement('style');
      st.textContent = String(tt.css || '').replace(/:root/g, '.dx-phude');
      const ov = document.createElement('div');
      ov.className = 'script-subtitles';
      const line = document.createElement('div');
      line.className = 'script-subtitle-line';
      ov.appendChild(line);
      goc.append(st, ov);
      lop.appendChild(goc);
      goc.style.zIndex = '1900000';   // phụ đề trên mọi khối (như track C1 trên cùng timeline), dưới khung chọn
      pdEl = { goc, ov, line, khoa: '', st, css: tt.css };
    }
    // Dự án video đổi kiểu phụ đề (dung:kieuPhuDe → dung-kho.datKieuPhuDe): thay CSS tại chỗ, vẽ lại câu.
    if (pdEl.css !== tt.css) {
      pdEl.st.textContent = String(tt.css || '').replace(/:root/g, '.dx-phude');
      pdEl.css = tt.css;
      pdEl.khoa = '';
    }
    // Vùng video trong lớp đè (khung xuất khác khổ ⇒ video nằm giữa), rồi phóng khung CSS deck vào đó.
    const W = lop.clientWidth;
    const H = lop.clientHeight;
    const KV = (dg.duAn() || {}).khung || K;
    const vv = khungRieng ? M.vungVideo(KV, K) : { trai: 0, tren: 0, w: K.rong, h: K.cao };
    const px = W / K.rong;
    const k = Math.min((vv.w * px) / tt.khung.w, (vv.h * (H / K.cao)) / tt.khung.h);
    Object.assign(pdEl.goc.style, {
      width: `${tt.khung.w}px`, height: `${tt.khung.h}px`,
      left: `${vv.trai * px + (vv.w * px - tt.khung.w * k) / 2}px`, top: `${vv.tren * (H / K.cao) + (vv.h * (H / K.cao) - tt.khung.h * k) / 2}px`,
      transform: `scale(${k})`,
    });
    const caps = capsTimeline(dg.phuDeDung() || [], dg.moc());
    const t = msTra / 1000;
    let khoa = 'an';
    let i = -1;
    let w = -1;
    if (caps.length) {
      i = pdChiSoCau(caps, t);
      if (i >= 0 && t <= caps[caps.length - 1].end + 0.65) {
        const c = caps[i];
        w = Array.isArray(c.words) && c.words.length ? pdChiSoChu(c.words, t) : -1;
        khoa = `${i}|${w}|${c.text}`;
      }
    }
    if (khoa !== pdEl.khoa) {
      pdEl.khoa = khoa;
      pdEl.line.replaceChildren();
      pdEl.line.style.transform = '';
      if (khoa !== 'an') {
        const c = caps[i];
        if (Array.isArray(c.words) && c.words.length) {
          c.words.forEach((x, j) => {
            const sp = document.createElement('span');
            sp.className = `script-subtitle-word${j < w ? ' past' : j === w ? ' active' : ''}`;
            sp.textContent = x.text;
            pdEl.line.appendChild(sp);
          });
        } else pdEl.line.textContent = c.text;
        // Như fitSubtitleLine của trang quay: một dòng mà tràn ⇒ thu nhỏ cho vừa.
        const rong = pdEl.ov.clientWidth - 10;
        const can = pdEl.line.scrollWidth;
        if (rong > 0 && can > rong) pdEl.line.style.transform = `scale(${Math.min(1, (rong / can) * 0.98)})`;
      }
      pdEl.ov.classList.toggle('visible', khoa !== 'an');
    }
  }

  /* ── vẽ khối theo đầu phát ────────────────────────────────────────────── */
  /* ── KHUNG CHUẨN khi dừng (render/dung-khung.js — Mediabunny) ─────────────
     Đang dừng mà khối hiện: giải đúng khung của tệp GỐC ra canvas đè lên <video> (cùng hình
     học, cùng thứ tự chồng). Chưa vẽ xong / đang phát / tệp không giải được ⇒ hiện <video>. */
  const KC = () => window.__beeDung && window.__beeDung.khung;
  function khungChuan(p, c, m, g, chay, hien, deck) {
    const kc = KC();
    const can = !!kc && !chay && hien && !kc.hong(deck, m);
    if (!can) {
      if (p.cv) { p.cv.style.visibility = 'hidden'; p.el.style.visibility = ''; }
      return;
    }
    if (!p.cv) {
      const cv = document.createElement('canvas');
      cv.className = 'dx-khoi dx-chuan';
      cv.dataset.khoi = c.id;
      cv.style.visibility = 'hidden';
      (p.mat || lop).appendChild(cv);
      p.cv = cv;
    }
    const cv = p.cv;
    // Theo đúng phần tử media: vị trí, cắt, xoay/lật, độ mờ, thứ tự chồng, chọn.
    ['left', 'top', 'width', 'height', 'clipPath', 'transformOrigin', 'transform', 'opacity', 'pointerEvents', 'zIndex', 'filter']
      .forEach((k) => { if (cv.style[k] !== p.el.style[k]) cv.style[k] = p.el.style[k]; });
    cv.classList.toggle('chon', p.el.classList.contains('chon'));
    if (kc.dung(cv, deck, m, g)) {
      cv.style.visibility = '';
      p.el.style.visibility = 'hidden';
    } else {
      cv.style.visibility = 'hidden';
      p.el.style.visibility = '';
      kc.ve(cv, deck, m, g, () => capNhat());
    }
  }

  function capNhat() {
    if (RP.bangKhoi && RP.bangKhoi.dauPhat) RP.bangKhoi.dauPhat();
    if (!lop || !master || !D()) return;
    const d = D().duAn();
    if (!d) return;
    const moc = D().moc();
    /* GĐ3.0: giờ TIMELINE lấy từ đồng hồ; giây trên VIDEO GỐC (thẻ <video> + tiếng gốc tách sẵn) suy ra
       qua V1 (nguoc) — video slide là phần tử bị đồng bộ: nhảy đoạn V1 = tua nó, không phải tua đồng hồ. */
    const ms = Math.round(gioDongHo() * 1000);
    const v1 = !!(moc.doan && moc.doan.length);
    const msNguon = Math.round(v1 && moc.nguoc ? moc.nguoc(ms) : ms);
    const chay = chayDongHo();
    /* Đầu phát QUA cuối video slide (khối đặt sau): bản xuất là nền ĐEN — video dừng ở khung cuối, lớp đè
       tô đen (audit 10/10/2026). */
    const cuoiVideo = v1 ? moc.tongDich : (isFinite(master.duration) && master.duration > 0 ? master.duration * 1000 : Infinity);
    /* TRƯỚC khối slide (đã dời khỏi giây 0, GĐ3.2): cũng là nền đen như bản xuất (tpad đầu) — video slide đứng ở
       khung đầu, tiếng gốc im. */
    const truocSlide = moc.batDau > 0 && ms < moc.batDau;
    const quaCuoi = ms > cuoiVideo + 40 || truocSlide;
    lop.classList.toggle('qua-cuoi', quaCuoi);
    masterTrongVung = !quaCuoi;
    const iDoan = v1 ? moc.doan.findIndex((x) => ms >= x.dichTu && ms < x.dichDen) : -1;
    const ep = iDoan >= 0 && doanTruoc >= 0 && iDoan !== doanTruoc && moc.doan[doanTruoc]
      && Math.abs(moc.doan[iDoan].nguonTu - moc.doan[doanTruoc].nguonDen) > 1;
    doanTruoc = iDoan;
    if (laTheVideo()) dongBo(master, Math.min(msNguon, (isFinite(master.duration) ? master.duration * 1000 - 20 : msNguon)) / 1000, chay && !quaCuoi, 1, ep);
    /* Đồng hồ đang đứng chờ video slide tua: khối + tiếng tách cũng đứng — chạy tiếp thì trôi lên trước đúng bằng
       quãng chờ rồi bị tua giật (rà GĐ3). */
    const chayKhoi = chay && !dangCho();
    donMau();
    const deck = D().deck();
    const K = khungXuat() || d.khung;
    const thuTu = new Map(d.track.map((t, i) => [t.id, i]));
    const chon = new Set(D().chon());
    const conDung = new Set();
    const ext = keoDai(d, moc);
    const hang = new Map();
    [...d.khoi].sort((a, b) => M.batDauMs(a, moc) - M.batDauMs(b, moc)).forEach((c, i) => hang.set(c.id, i));
    // Hệ số hạ nhạc theo giây TIMELINE (đoạn giọng deck đã chiếu lên timeline — xem heSoHaNhac).
    const haNhac = heSoHaNhac(d, ms, moc);
    tiengGoc(msNguon, chayKhoi && !quaCuoi, haNhac, ep);
    if (khungRieng) veNen();
    // Màu cả video (lớp hiệu chỉnh): video slide + nền khung + từng khối; phụ đề KHÔNG (bản xuất áp trước lớp phụ đề).
    const mauVideo = (d.xuat && d.xuat.mau) || null;
    const locVideo = locCss(null, mauVideo);
    if (master.style.filter !== locVideo) master.style.filter = locVideo;
    if (nen && nen.style.filter !== locVideo) nen.style.filter = locVideo;
    /* Nền ĐEN sau cuối video slide: bản xuất đệm đen rồi mới áp màu cả video (tương phản < 1 ⇒ xám) — tô đúng
       màu đó (đen qua ma trận = độ dời) thay vì đen trơn. */
    const denSau = mauVideo ? Math.max(0, Math.min(255, Math.round(M.maTranMau(mauVideo)[0][3] * 255))) : null;
    if (denSau == null) lop.style.removeProperty('--dx-qua-cuoi');
    else lop.style.setProperty('--dx-qua-cuoi', `rgb(${denSau}, ${denSau}, ${denSau})`);

    for (const c of d.khoi) {
      const t = D().trackCua(c.track);
      const m = D().mediaCua(c.media);
      if (!t || !m) continue;
      const laHinh = t.loai === 'hinh' && m.loai !== 'tieng';
      const keo = laHinh ? (ext.get(c.id) || 0) : 0;
      const a = M.batDauMs(c, moc);
      const daiKhoi = M.doDaiMs(c);
      const b = a + daiKhoi + keo;
      if (ms < a - NAP_TRUOC_MS || ms >= b) continue;
      const hien = ms >= a;
      if (laHinh && t.an) continue;
      const ca = D().cacheCua(m.id) || {};
      const kieu = m.loai === 'anh' ? 'img' : laHinh ? 'video' : 'audio';
      /* Proxy có cả tiếng (AAC) — video đặt trên track TIẾNG cũng phải phát từ proxy, kẻo
         tệp Chromium không giải được (PCM trong MOV…) câm khi xem trước (audit 10/10/2026). */
      const src = m.loai === 'anh' ? (ca.goc || D().url(m.tep)) : (ca.proxy || ca.goc || D().url(m.tep));
      let p = pt.get(c.id);
      if (p && (p.kieu !== kieu || p.src !== src)) { boKhoi(p); pt.delete(c.id); p = null; }
      if (!p) {
        const el = document.createElement(kieu);
        el.className = `dx-khoi dx-${kieu}`;
        if (kieu !== 'img') { el.preload = 'auto'; el.playsInline = true; }
        el.draggable = false;
        el.src = src;
        el.dataset.khoi = c.id;
        // Nạp xong mới tua được (readyState ≥ 1) — vẽ lại ngay lúc đó, kẻo đang dừng mà hiện khung 0.
        if (kieu !== 'img') el.addEventListener('loadedmetadata', () => capNhat(), { once: true });
        let mat = null;
        if (kieu !== 'audio') {
          mat = document.createElement('div');
          mat.className = 'dx-mat';
          mat.appendChild(el);
          lop.appendChild(mat);
        } else lop.appendChild(el);
        p = { el, kieu, src, mat };
        pt.set(c.id, p);
      }
      conDung.add(c.id);
      const trong = Math.max(0, ms - a);
      if (kieu !== 'audio') {
        const h = M.hinhTai(c, m, K, trong, { dai: daiKhoi + keo, boRa: keo > 0 });
        apHinh(p.el, h, c, K);
        const loc = locCss(c.mau, mauVideo);
        if (p.el.style.filter !== loc) p.el.style.filter = loc;
        const mn = hien ? M.matNa(c, K, trong, { dai: daiKhoi + keo, boRa: keo > 0, fps: K.fps || d.khung.fps }) : null;
        p.el.style.opacity = String(hien ? h.mo * (mn ? mn.he : 1) : 0);
        // Nạp trước (chưa tới giờ) / đục 0: không được bắt chuột — kẻo chọn nhầm khối không thấy.
        // Lớp phủ có sẵn (viền tối, vệt sáng… phủ cả khung): cú bấm XUYÊN xuống cảnh bên dưới — chọn nó ở timeline.
        p.el.style.pointerEvents = hien && h.mo > 0.02 && !m.lopPhu ? '' : 'none';
        /* Chồng như bản xuất: theo track, TRONG track theo giờ bắt đầu (khối sau đè khối trước) —
           theo thứ tự trong mảng thì hoà trộn có thể thành cắt cụt (audit GĐ2). */
        p.el.style.zIndex = String(1 + (thuTu.get(c.track) || 0) * 4000 + (hang.get(c.id) || 0));
        if (p.mat) p.mat.style.zIndex = p.el.style.zIndex;
        // Sau khi đặt z-index của lớp bọc: lớp màu nháy chép z-index đó (apMat).
        apMat(p, mn);
        p.el.classList.toggle('chon', chon.has(c.id));
      }
      if (kieu !== 'img') {
        let g = (c.vaoMs + trong * (c.tocDo || 1)) / 1000;
        /* Khối LẶP (nhạc có sẵn): vị trí trong tệp = giây nguồn mod độ dài THẬT của tệp (el.duration — như aloop
           của bản xuất lặp đúng phần giải mã được, không theo m.ms của ffprobe). */
        if (kieu === 'audio') p.el.loop = !!c.lap;
        /* Mod theo m.ms (ffprobe — bỏ độ trễ bộ mã như ffmpeg giải mã cho aloop): mod theo el.duration (Chromium
           tính cả độ trễ, +26 ms) thì lệch bản xuất CỘNG DỒN mỗi vòng (rà GĐ2). */
        const vongS = m.ms > 0 ? m.ms / 1000 : p.el.duration;
        if (c.lap && kieu === 'audio' && Number.isFinite(vongS) && vongS > 0) g %= vongS;
        const coTieng = (m.loai === 'tieng' || m.coTieng) && !t.tatTieng;
        // Phần KÉO DÀI dưới chuyển cảnh chỉ là hình — bản xuất không kéo dài tiếng.
        const trongTieng = trong < daiKhoi;
        // Track giọng đọc (vai trò 'giong') KÍCH hạ nhạc — chính nó không bị hạ (như xuat.js).
        const am = M.amLuongTai(c, trong) * (t.amLuong == null ? 1 : t.amLuong) * M.heSoMo(c, trong) * (M.khoiLaGiong(d, c, t) ? 1 : haNhac);
        p.el.muted = !coTieng || dangTat() || !trongTieng || am <= 0;
        p.el.volume = kep(am, 0, 1);
        dongBo(p.el, g, chayKhoi && hien, c.tocDo || 1);
        if (kieu === 'video') khungChuan(p, c, m, g, chay, hien, deck);
      }
    }
    // Khối đã qua / bị xoá: gỡ phần tử.
    [...pt.keys()].forEach((id) => {
      if (conDung.has(id)) return;
      boKhoi(pt.get(id));
      pt.delete(id);
    });
    veKhungChon(ms);
    vePhuDe(moc.doan ? ms : msNguon, K);
  }


  /* ── khung chọn + kéo/co trên màn hình ────────────────────────────────── */
  let khungChon = null;
  function veKhungChon(ms) {
    if (!lop) return;
    const d = D().duAn();
    const id = D().chon().length === 1 ? D().chon()[0] : null;
    const c = id && D().khoiCua(id);
    const t = c && D().trackCua(c.track);
    const m = c && D().mediaCua(c.media);
    const moc = D().moc();
    const hien = c && t && m && t.loai === 'hinh' && m.loai !== 'tieng' && !t.an
      && ms >= M.batDauMs(c, moc) && ms < M.ketThucMs(c, moc);
    if (!hien) { if (khungChon) khungChon.hidden = true; return; }
    if (!khungChon) {
      khungChon = document.createElement('div');
      khungChon.className = 'dx-chon';
      khungChon.innerHTML = '<span class="dx-goc" data-goc="tt"></span><span class="dx-goc" data-goc="tp"></span>'
        + '<span class="dx-goc" data-goc="dt"></span><span class="dx-goc" data-goc="dp"></span>';
    }
    if (!khungChon.isConnected) lop.appendChild(khungChon);
    /* Trên MỌI khối: khối mang z-index = track × 4000 + thứ tự (như bản xuất) — vượt xa
       --z-pop. `.dx-lop` là ngữ cảnh chồng riêng nên số lớn ở đây không đụng giao diện ngoài. */
    khungChon.style.zIndex = '2000000';
    khungChon.hidden = false;
    khungChon.dataset.khoi = id;
    khungChon.classList.toggle('khoa', !!t.khoa);
    const K = khungXuat() || d.khung;
    // Khung theo hình ĐANG HIỆN (keyframe + chuyển cảnh + phần còn lại sau cắt khung).
    const keo = keoDai(d, moc).get(c.id) || 0;
    const h = M.hinhTai(c, m, K, ms - M.batDauMs(c, moc), { dai: M.doDaiMs(c) + keo, boRa: keo > 0 });
    const st = khungChon.style;
    st.left = `${(h.trai / K.rong) * 100}%`;
    st.top = `${(h.tren / K.cao) * 100}%`;
    st.width = `${(h.w / K.rong) * 100}%`;
    st.height = `${(h.h / K.cao) * 100}%`;
    st.transform = h.xoay ? `rotate(${h.xoay}deg)` : '';
  }

  /**
   * Đổi vị trí / cỡ từ màn hình. Thuộc tính đang có keyframe ⇒ đặt keyframe TẠI ĐẦU PHÁT
   * (như Premiere); không thì đổi giá trị tĩnh.
   */
  function apDoi(x, msTrong, sua) {
    const kf = { ...(x.kf || {}) };
    const bd = { ...x.bienDoi };
    Object.keys(sua).forEach((k) => {
      const ds = kf[k];
      if (ds && ds.length) {
        const cu = ds.find((z) => Math.abs(z.t - msTrong) <= KHUNG_MS);
        kf[k] = M.kfDat(ds.filter((z) => z !== cu), cu ? cu.t : msTrong, sua[k], !!(cu && cu.muot));
      } else bd[k] = sua[k];
    });
    return { ...x, bienDoi: bd, kf };
  }

  let daGanKeo = false;
  function ganKeo() {
    if (daGanKeo) return;
    daGanKeo = true;
    document.addEventListener('pointerdown', (e) => {
      if (!lop || !khungChon || khungChon.hidden || !e.target.closest('.dx-chon') || khungChon.classList.contains('khoa')) return;
      e.preventDefault();
      e.stopPropagation();
      const id = khungChon.dataset.khoi;
      const c0 = D().khoiCua(id);
      const m = c0 && D().mediaCua(c0.media);
      if (!c0 || !m) return;
      const K = khungXuat() || D().duAn().khung;
      const moc = D().moc();
      const tl = RP.timeline && RP.timeline.tDauMs ? RP.timeline.tDauMs() : 0;
      const msTrong = kep(Math.round(tl - M.batDauMs(c0, moc)), 0, M.doDaiMs(c0));
      const goc0 = e.target.closest('[data-goc]');
      const r = lop.getBoundingClientRect();
      const x0 = e.clientX;
      const y0 = e.clientY;
      const b0 = M.bienDoiTai(c0, msTrong);       // giá trị ĐANG THẤY (kể cả keyframe)
      const h0 = M.hinhTai(c0, m, K, msTrong, {});
      // Tâm khối trên màn hình — co giãn theo khoảng cách từ tâm tới con trỏ.
      const tamX = r.left + (h0.cx / K.rong) * r.width;
      const tamY = r.top + (h0.cy / K.cao) * r.height;
      const kc0 = Math.hypot(x0 - tamX, y0 - tamY) || 1;
      let daKeo = false;
      const di = (ev) => {
        // Vùng chết 3 px: bấm chọn rung tay không được thành một bước "Dời khối" / keyframe mới.
        if (!daKeo && Math.abs(ev.clientX - x0) < 3 && Math.abs(ev.clientY - y0) < 3) return;
        if (!daKeo) { daKeo = true; D().batDauNhom(goc0 ? 'Co giãn khối' : 'Dời khối'); }
        let sua;
        if (goc0) {
          const kc = Math.hypot(ev.clientX - tamX, ev.clientY - tamY);
          // Tối đa 400% như thanh trượt: 1000% + xoay dựng khung hàng chục nghìn điểm ảnh, xuất mất hàng giờ (audit).
          sua = { co: kep(Math.round(b0.co * (kc / kc0) * 1000) / 1000, 0.02, 4) };
        } else {
          let x = b0.x + (ev.clientX - x0) / r.width;
          let y = b0.y + (ev.clientY - y0) / r.height;
          // Hít vào tâm khung khi gần (như đường dóng của Premiere).
          if (Math.abs(x - 0.5) < 0.012) x = 0.5;
          if (Math.abs(y - 0.5) < 0.008) y = 0.5;
          sua = { x: Math.round(kep(x, -2, 3) * 10000) / 10000, y: Math.round(kep(y, -2, 3) * 10000) / 10000 };
        }
        D().suaKhoi(id, (c) => apDoi(c, msTrong, sua), goc0 ? 'Co giãn khối' : 'Dời khối');
      };
      const thoi = () => {
        window.removeEventListener('pointermove', di);
        window.removeEventListener('pointerup', thoi);
        window.removeEventListener('pointercancel', thoi);
        if (daKeo) D().ketThucNhom();
      };
      window.addEventListener('pointermove', di);
      window.addEventListener('pointerup', thoi);
      window.addEventListener('pointercancel', thoi);
    }, true);
    // Bấm thẳng vào một khối hình trên màn hình = chọn khối đó.
    document.addEventListener('pointerdown', (e) => {
      const el = lop && e.target.closest('.dx-lop .dx-khoi');
      if (!el || e.button !== 0) return;
      D().datChon([el.dataset.khoi]);
    });
  }

  /* ── nối với thanh phát / kho ─────────────────────────────────────────── */
  function theoVideo(loai) {
    const v = RP.thanhPhat && RP.thanhPhat.video && RP.thanhPhat.video();
    if (loai === 'dong' || !v) { dongLop(); return; }
    if (v !== master) { dongLop(); moLop(v); }
    // 'nhip' = mỗi khung hình khi đồng hồ chạy (thay vòng rAF riêng trước đây); 'chay'/'dung'/'tua' vẽ ngay.
    capNhat();
  }

  /** Chọn một khối mà video slide chưa mở: mở video tại đầu phát để thấy bản ghép. */
  function moNeuCanXem() {
    const dg = D();
    if (!dg || !dg.chon().length || !dg.coVideo() || !RP.thanhPhat) return;
    if (RP.thanhPhat.video && RP.thanhPhat.video()) return;
    const tMs = RP.timeline && RP.timeline.tDauMs ? RP.timeline.tDauMs() : 0;
    if (RP.thanhPhat.tuaToiGiay) RP.thanhPhat.tuaToiGiay(tMs / 1000);
  }

  function khoi() {
    if (!RP.thanhPhat || !RP.thanhPhat.nghe || !D()) return;
    RP.thanhPhat.nghe(theoVideo);
    D().nghe((loai) => {
      if (loai === 'chon') moNeuCanXem();
      if (loai === 'nap') { dongLop(); hoatDong = { deck: '', ds: [], dangHoi: false }; }
      if (loai === 'moc') hoatDong = { deck: '', ds: [], dangHoi: false };   // dựng lại video ⇒ đo lại giọng
      // Đổi khung xuất (16:9…) ⇒ đặt lại vùng lớp đè / video slide.
      if (loai === 'duAn' || loai === 'nap') canLop();
      /* Bắt đầu / thôi sửa phụ đề: video đang mở phải đổi giữa bản thường (phụ đề đốt sẵn) và bản
         KHÔNG phụ đề — mở lại đúng bản tại đúng giây. */
      /* Dự án VIDEO TRỐNG: nền đen VỪA là bản thường VỪA là "bản không phụ đề" (videoXem = _nen.mp4) —
         không có gì để đổi; so theo đuôi `.nophude.mp4` ở dưới thì lần sửa nào cũng đóng/mở lại video. */
      if ((loai === 'duAn' || loai === 'moc') && master && RP.thanhPhat && RP.thanhPhat.dongVideo
        && !(D().laVideo && D().laVideo())) {
        const muonKhong = !!(D().videoXem && D().videoXem());
        const dangKhong = /\.nophude\.mp4/i.test(decodeURIComponent(master.currentSrc || master.src || ''));
        if (muonKhong !== dangKhong) {
          const t = gioDongHo();   // giây TIMELINE — tuaToiGiay mở lại theo đồng hồ
          RP.thanhPhat.dongVideo();
          // Một nhịp cho sân khấu gỡ xong lớp video cũ — mở ngay là lớp mới bị gỡ theo (đo).
          setTimeout(() => { if (RP.thanhPhat.tuaToiGiay) RP.thanhPhat.tuaToiGiay(t); }, 300);
          return;
        }
      }
      capNhat();
    });
    window.addEventListener('resize', () => { canLop(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', khoi);
  else khoi();

  RP.dungXem = { capNhat, dangCho };
})();
