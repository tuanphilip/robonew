'use strict';
/**
 * SỬA KHỐI trên timeline — phần "Premiere" của trình dựng (KE-HOACH.md §5, Giai đoạn 1).
 *
 *   Kéo từ Thư viện / thả tệp từ Explorer  → thêm khối vào track dưới con trỏ
 *   Bấm khối = chọn (Shift/Ctrl: chọn thêm) · kéo thân = di chuyển (sang track
 *   cùng loại được) · kéo mép = cắt đầu/đuôi · công cụ Dao cạo (C) = cắt đôi
 *   Phím: V chọn · C dao cạo · S bắt dính · Delete xoá · Shift+Delete xoá liền
 *         Ctrl+K cắt tại đầu phát · Ctrl+C / Ctrl+V · Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y · Esc
 *
 * Không tự quy đổi giây ↔ điểm ảnh: dùng `RP.timeline.noi` (timeline.js). Không tự
 * giữ dự án: mọi thay đổi đi qua `RP.dung` (render/dung-kho.js) → hoàn tác + tự lưu.
 * Kéo một lượt = MỘT bước hoàn tác (`batDauNhom` … `ketThucNhom`).
 *
 * Trong một track các khối KHÔNG chồng nhau (như Premiere): thả vào chỗ đã có khối
 * thì dời ra sau; kéo vào chỗ va chạm thì khối dừng ở vị trí hợp lệ gần nhất.
 */
(function () {
  const RP = window.__renderPage || {};
  const M = window.__beeDung && window.__beeDung.moHinh;
  if (!M) return;

  const NGUONG_BAT_PX = 8;      // bắt dính khi cách mốc ≤ 8px
  const MS_MIN = 100;           // khối ngắn nhất 0,1 giây
  let congCu = 'chon';          // 'chon' | 'cat'
  let batDinh = true;
  let banChep = [];             // khối đã chép (Ctrl+C)

  const N = () => RP.timeline && RP.timeline.noi;
  const D = () => RP.dung;

  /* ── mốc bắt dính: đầu phát, ranh giới slide, mép mọi khối, giây 0 ─────── */
  function cacMoc(boQua) {
    const ra = [0, Math.round(N().tDau() * 1000)];
    N().mocSlide().forEach((g) => ra.push(Math.round(g * 1000)));
    ((D().duAn() && D().duAn().danhDau) || []).forEach((x) => ra.push(x.ms));
    const d = D().duAn();
    const moc = D().moc();
    d.khoi.forEach((c) => {
      if (boQua && boQua.has(c.id)) return;
      ra.push(M.batDauMs(c, moc), M.ketThucMs(c, moc));
    });
    return ra;
  }
  /** Bắt dính một giây (ms) — trả về giây đã dính hoặc giữ nguyên. */
  function bat(ms, cac) {
    if (!batDinh) return ms;
    const nguong = (NGUONG_BAT_PX / N().pps()) * 1000;
    let tot = ms;
    let gan = nguong;
    for (const m of cac) {
      const k = Math.abs(m - ms);
      if (k <= gan) { gan = k; tot = m; }
    }
    return tot;
  }

  /** Track người dùng dưới con trỏ — cho thả và kéo sang track khác. */
  function trackDuoi(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const lan = el && el.closest('.tl-lan.nd');
    return lan ? D().trackCua(lan.dataset.track) : null;
  }
  const hopTrack = (t, m) => D().hopTrack(t, m);

  /* ── bấm / kéo khối ──────────────────────────────────────────────────── */
  function ganKhoi() {
    const cuon = N().cuon();
    cuon.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.tl-khoi.nd');
      if (!el || e.button !== 0 || !D() || D().chiDoc()) return;
      e.preventDefault();
      N().goc().focus({ preventScroll: true });
      const id = el.dataset.khoi;
      const c0 = D().khoiCua(id);
      if (!c0) return;
      const t0 = D().trackCua(c0.track);
      const m = D().mediaCua(c0.media);
      const msBam = Math.round(N().giayTai(e.clientX) * 1000);

      // Dao cạo: cắt ngay tại chỗ bấm.
      if (congCu === 'cat' && !(t0 && t0.khoa)) {
        D().catTai(id, bat(msBam, cacMoc(new Set([id]))));
        return;
      }
      // Chọn: Shift/Ctrl thêm/bớt; bấm khối chưa chọn thì chỉ chọn nó.
      let chon = D().chon();
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        chon = chon.includes(id) ? chon.filter((x) => x !== id) : [...chon, id];
      } else if (!chon.includes(id)) chon = [id];
      /* Đầu phát tới chỗ bấm TRƯỚC khi chọn: chọn khối có thể mở video (dung-xem
         moNeuCanXem) tại đầu phát — đặt sau thì video mở ở chỗ cũ (audit 10/10/2026). */
      N().datDau(msBam / 1000);
      D().datChon(chon);
      if (!t0 || t0.khoa || !m) return;

      const tay = e.target.closest('[data-tay]');
      const kieu = tay ? tay.dataset.tay : 'di';
      const x0 = e.clientX;
      const moc = D().moc();
      const dau0 = M.batDauMs(c0, moc);
      const cuoi0 = M.ketThucMs(c0, moc);
      const td = c0.tocDo || 1;
      const boQua = new Set(kieu === 'di' ? chon : [id]);
      const cac = cacMoc(boQua);
      // Kéo nhiều khối cùng lúc: dời CÙNG một khoảng, giữ nguyên track.
      const nhom = kieu === 'di' ? chon.map((k) => D().khoiCua(k)).filter(Boolean) : [c0];
      const dauNhom = new Map(nhom.map((c) => [c.id, M.batDauMs(c, moc)]));
      let daKeo = false;
      let msCuoi = null;

      const y0 = e.clientY;
      const di = (ev) => {
        /* Vùng chết 3px: bấm chọn lệch tay không được dời khối (rồi bắt dính tới vài
           giây ở mức thu nhỏ). Chỉ bỏ vùng chết khi con trỏ đã sang track KHÁC. */
        if (!daKeo && Math.abs(ev.clientX - x0) < 3 && Math.abs(ev.clientY - y0) < 3) return;
        if (!daKeo && Math.abs(ev.clientX - x0) < 3 && kieu === 'di') {
          const tDuoi = trackDuoi(ev.clientX, ev.clientY);
          if (!tDuoi || tDuoi.id === c0.track) return;
        }
        if (!daKeo) { daKeo = true; D().batDauNhom(kieu === 'di' ? 'Di chuyển khối' : 'Cắt mép khối'); }
        const dMs = ((ev.clientX - x0) / N().pps()) * 1000;
        if (kieu === 'di') {
          // Bắt dính theo MÉP ĐẦU hoặc MÉP CUỐI của khối được bấm — mép nào gần mốc hơn.
          let moi = Math.max(0, Math.round(dau0 + dMs));
          const daiK = cuoi0 - dau0;
          const bDau = bat(moi, cac);
          const bCuoi = bat(moi + daiK, cac) - daiK;
          if (bDau !== moi) moi = bDau; else if (bCuoi !== moi) moi = Math.max(0, bCuoi);
          const lech = moi - dau0;
          const tMoi = nhom.length === 1 ? trackDuoi(ev.clientX, ev.clientY) : null;
          const trackDich = tMoi && hopTrack(tMoi, m) ? tMoi.id : c0.track;
          if (msCuoi === `${lech}|${trackDich}`) return;
          D().lam((d) => {
            const khoi = d.khoi.map((c) => {
              if (!dauNhom.has(c.id)) return c;
              const goc = d.khoi.find((x) => x.id === c.id);
              const daDoi = M.datChoMs({ ...goc, track: c.id === id ? trackDich : goc.track }, dauNhom.get(c.id) + lech, moc);
              return daDoi;
            });
            const moiD = { ...d, khoi };
            // Va chạm với khối KHÔNG được kéo ⇒ bỏ bước này (khối đứng ở vị trí hợp lệ trước đó).
            const vaCham = khoi.some((c) => dauNhom.has(c.id) && D().chong(moiD, c));
            return vaCham ? d : moiD;
          }, 'Di chuyển khối');
          msCuoi = `${lech}|${trackDich}`;
        } else if (kieu === 'trai') {
          // Mép đầu: video/tiếng không lùi quá đầu media; ảnh thì tuỳ ý.
          const sauNhat = cuoi0 - MS_MIN;
          const somNhat = m.loai === 'anh' ? 0 : Math.max(0, dau0 - c0.vaoMs / td);
          const dauMoi = Math.min(sauNhat, Math.max(somNhat, bat(Math.round(dau0 + dMs), cac)));
          const lechNguon = Math.round((dauMoi - dau0) * td);
          D().lam((d) => {
            const i = d.khoi.findIndex((x) => x.id === id);
            if (i < 0) return d;
            const c = m.loai === 'anh'
              ? { ...c0, raMs: c0.raMs - lechNguon }
              : { ...c0, vaoMs: c0.vaoMs + lechNguon };
            let daDat = M.datChoMs(c, dauMoi, moc);
            /* Làm tròn theo tốc độ: mép PHẢI có thể nhích 1 ms ⇒ va khối kế, bước bị bỏ, mép kẹt.
               Giữ mép phải đứng yên, dời mép trái theo nó (audit 10/10/2026). */
            const lechCuoi = M.ketThucMs(daDat, moc) - cuoi0;
            if (lechCuoi) daDat = M.datChoMs(daDat, M.batDauMs(daDat, moc) - lechCuoi, moc);
            // Keyframe tính từ ĐẦU khối: đầu dời bao nhiêu thì keyframe dời ngược bấy nhiêu (hình đứng yên).
            if (c0.kf && Object.keys(c0.kf).length) daDat = { ...daDat, kf: M.kfDoi(c0.kf, -(M.batDauMs(daDat, moc) - dau0)) };
            const khoi = d.khoi.slice();
            khoi[i] = daDat;
            const moiD = { ...d, khoi };
            return D().chong(moiD, daDat) ? d : moiD;
          }, 'Cắt mép khối');
        } else {
          // Mép cuối: video/tiếng không vượt cuối media.
          const somNhat = dau0 + MS_MIN;
          // Khối LẶP (nhạc có sẵn) kéo dài bao nhiêu cũng được — tệp tự lặp lại.
          const muonNhat = m.loai === 'anh' || (c0.lap && m.loai === 'tieng') ? Infinity : dau0 + (m.ms - c0.vaoMs) / td;
          const cuoiMoi = Math.max(somNhat, Math.min(muonNhat, bat(Math.round(cuoi0 + dMs), cac)));
          D().lam((d) => {
            const i = d.khoi.findIndex((x) => x.id === id);
            if (i < 0) return d;
            const c = { ...c0, raMs: Math.round(c0.vaoMs + (cuoiMoi - dau0) * td) };
            const khoi = d.khoi.slice();
            khoi[i] = c;
            const moiD = { ...d, khoi };
            return D().chong(moiD, c) ? d : moiD;
          }, 'Cắt mép khối');
        }
      };
      const thoi = () => {
        window.removeEventListener('pointermove', di);
        window.removeEventListener('pointerup', thoi);
        window.removeEventListener('pointercancel', thoi);
        document.body.classList.remove('tl-dang-sua');
        if (daKeo) D().ketThucNhom();
      };
      document.body.classList.add('tl-dang-sua');
      window.addEventListener('pointermove', di);
      window.addEventListener('pointerup', thoi);
      window.addEventListener('pointercancel', thoi);
    }, true);   // capture: chạy TRƯỚC bộ tua của timeline.js
  }

  /* ── SỬA V1: cắt / bỏ / đổi chỗ / cắt mép đoạn slide (Giai đoạn 3) ─────────
     V1 lưu ở `duAn.v1.doan` = [{ slide, vaoMs, raMs }] theo thứ tự timeline (moHinh.v1Sach).
     Chưa sửa lần nào ⇒ coi như mỗi slide một đoạn nguyên. Mọi thay đổi đi qua D().datV1 (một bước
     hoàn tác); khối gắn slide tự dời theo (moHinh.mocDich). Chỉ sửa được khi đã có video slide. */
  let chonV1 = -1;                 // chỉ số đoạn V1 đang chọn (-1 = không)
  // Dự án video trống: V1 là NỀN ĐEN tự giãn — không cho cắt / đổi chỗ (src/dung/duAnVideo.js).
  const coSuaV1 = () => !!(D() && D().duAn() && !D().chiDoc() && D().coVideo() && D().mocGoc().length && !(D().laVideo && D().laVideo()));
  /* Đọc từ mốc ĐÃ chuẩn hoá (moHinh.mocDich: bỏ đoạn của slide không còn, kẹp theo độ dài slide
     sau lần dựng lại, đặt lên lưới khung) — chỉ số trùng `data-doan` timeline vẽ. Đọc V1 thô thì
     sau khi "Tạo video" lại, Delete / kéo / dao cạo sửa nhầm đoạn (audit GĐ3). */
  function doanHienTai() {
    const m = D().moc();
    const g = D().mocGoc();
    if (m && m.doan) {
      return m.doan.map((x) => ({ slide: x.slide, vaoMs: Math.max(0, Math.round(x.nguonTu - g[x.slide].tuMs)),
        raMs: Math.round(x.nguonDen - g[x.slide].tuMs) }));
    }
    return g.map((x, i) => ({ slide: i, vaoMs: 0, raMs: x.denMs - x.tuMs }));
  }
  /** Ghi V1; trùng nguyên trạng (mỗi slide nguyên, đúng thứ tự) thì xoá hẳn (null). */
  function datDoan(doan, ten) {
    const g = D().mocGoc();
    // Đoạn đã đặt lên lưới khung (mocDich) lệch mép slide tới nửa khung — vẫn tính là nguyên slide.
    const nua = 500 / ((D().duAn() && D().duAn().khung.fps) || 30) + 1;
    const nguyen = doan.length === g.length && doan.every((x, i) => x.slide === i && x.vaoMs <= nua && Math.abs(x.raMs - (g[i].denMs - g[i].tuMs)) <= nua);
    D().datV1(nguyen ? null : doan, ten);
  }
  /** Đoạn V1 tại giây timeline (ms) → { j, d, dichTu }. */
  function doanTai(ms) {
    const doan = doanHienTai();
    const m = D().moc();
    let t = 0;
    for (let j = 0; j < doan.length; j += 1) {
      const tu = m && m.doan ? m.doan[j].dichTu : t;
      const den = m && m.doan ? m.doan[j].dichDen : t + (doan[j].raMs - doan[j].vaoMs);
      if (ms < den || j === doan.length - 1) return { j, d: doan[j], dichTu: tu, doan };
      t = den;
    }
    return null;
  }
  function veChonV1() {
    const l = N().luoi();
    if (!l) return;
    l.querySelectorAll('.tl-khoi.hinh.chon-v1').forEach((k) => k.classList.remove('chon-v1'));
    if (chonV1 >= 0) {
      const k = l.querySelector(`.tl-khoi.hinh[data-doan="${chonV1}"]`);
      if (k) k.classList.add('chon-v1');
    }
  }
  function catV1(ms) {
    const x = doanTai(ms);
    if (!x) return;
    const local = Math.round(ms - x.dichTu);
    if (local < 100 || local > x.d.raMs - x.d.vaoMs - 100) return;
    const doan = x.doan.slice();
    doan.splice(x.j, 1, { ...x.d, raMs: x.d.vaoMs + local }, { ...x.d, vaoMs: x.d.vaoMs + local });
    datDoan(doan, 'Cắt V1');
  }
  function boDoanV1(j) {
    const doan = doanHienTai();
    if (doan.length <= 1 || j < 0 || j >= doan.length) return;
    doan.splice(j, 1);
    chonV1 = -1;
    datDoan(doan, 'Bỏ đoạn V1');
  }

  function ganV1() {
    const cuon = N().cuon();
    cuon.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.tl-khoi.hinh[data-doan]');
      if (!el || e.button !== 0 || !coSuaV1()) return;
      e.preventDefault();
      e.stopPropagation();
      N().goc().focus({ preventScroll: true });
      const j = Number(el.dataset.doan);
      const msBam = Math.round(N().giayTai(e.clientX) * 1000);
      if (congCu === 'cat') { catV1(bat(msBam, cacMoc())); return; }
      const tay = e.target.closest('[data-tay-v1]');
      const x0 = e.clientX;
      /* Alt + kéo một khối V1 = DỜI CẢ KHỐI SLIDE (GĐ3.3): video slide, giọng, nhạc + tiếng chuyển của deck, phụ đề
         và khối gắn slide đi cùng. Kéo thường vẫn là đổi chỗ đoạn. */
      if (e.altKey && !tay && D().slide && D().slide()) {
        const bd0 = D().slide().batDauMs || 0;
        // Mốc dính tính MỘT lần lúc bấm, chỉ từ thứ ĐỨNG YÊN (ranh giới slide + khối gắn slide đi theo khối đang kéo).
        const mocDung0 = D().moc();
        const cacS = [0, Math.round(N().tDau() * 1000), ...((D().duAn().danhDau) || []).map((x) => x.ms),
          ...D().duAn().khoi.filter((c) => !c.neo).flatMap((c) => [M.batDauMs(c, mocDung0), M.ketThucMs(c, mocDung0)])];
        let daDoi = false;
        const diSlide = (ev) => {
          const dx = ev.clientX - x0;
          if (!daDoi && Math.abs(dx) < 5) return;
          if (!daDoi) { daDoi = true; D().batDauNhom('Dời khối slide'); document.body.classList.add('tl-dang-sua'); }
          D().datBatDauSlide(Math.max(0, bat(bd0 + Math.round((dx / N().pps()) * 1000), cacS)), 'Dời khối slide');
        };
        const thoiSlide = () => {
          window.removeEventListener('pointermove', diSlide);
          window.removeEventListener('pointerup', thoiSlide);
          window.removeEventListener('pointercancel', thoiSlide);
          document.body.classList.remove('tl-dang-sua');
          if (daDoi) D().ketThucNhom();
        };
        window.addEventListener('pointermove', diSlide);
        window.addEventListener('pointerup', thoiSlide);
        window.addEventListener('pointercancel', thoiSlide);
        return;
      }
      const doan0 = doanHienTai();
      const d0 = doan0[j];
      const s = D().mocGoc()[d0.slide];
      const daiSlide = s ? s.denMs - s.tuMs : d0.raMs;
      let daKeo = false;
      let dich = j;
      const di = (ev) => {
        const dx = ev.clientX - x0;
        if (!daKeo && Math.abs(dx) < 5) return;
        if (!daKeo) { daKeo = true; D().batDauNhom(tay ? 'Cắt mép V1' : 'Đổi chỗ V1'); document.body.classList.add('tl-dang-sua'); }
        const dMs = Math.round((dx / N().pps()) * 1000);
        if (tay) {
          const doan = doan0.map((x) => ({ ...x }));
          if (tay.dataset.tayV1 === 'trai') doan[j].vaoMs = Math.max(0, Math.min(d0.raMs - 100, d0.vaoMs + dMs));
          else doan[j].raMs = Math.max(d0.vaoMs + 100, Math.min(daiSlide, d0.raMs + dMs));
          datDoan(doan, 'Cắt mép V1');
          return;
        }
        // Đổi chỗ: vị trí mới = số đoạn có TÂM nằm trước con trỏ (tính từ ĐẦU khối slide — GĐ3.3).
        const t = N().giayTai(ev.clientX) * 1000 - ((D().slide && D().slide() && D().slide().batDauMs) || 0);
        let tt = 0;
        let k = 0;
        doan0.forEach((x, i) => { const dai = x.raMs - x.vaoMs; if (i !== j && t > tt + dai / 2) k += 1; if (i !== j) tt += dai; });
        if (k === dich) return;
        dich = k;
        const doan = doan0.filter((_, i) => i !== j);
        doan.splice(k, 0, { ...d0 });
        chonV1 = k;
        datDoan(doan, 'Đổi chỗ V1');
      };
      const thoi = () => {
        window.removeEventListener('pointermove', di);
        window.removeEventListener('pointerup', thoi);
        window.removeEventListener('pointercancel', thoi);
        document.body.classList.remove('tl-dang-sua');
        if (daKeo) { D().ketThucNhom(); veChonV1(); return; }
        // Bấm (không kéo): chọn đoạn + đầu phát tới chỗ bấm (như bấm khối slide trước đây).
        chonV1 = j;
        chonCau = -1;
        // Loại chọn 'v1' — bảng phải mở tab Nội dung đúng slide (bang-khoi.js), không còn "không chọn gì".
        D().datChon([], 'v1');
        veChonCau();
        N().datDau(msBam / 1000);
        veChonV1();
      };
      window.addEventListener('pointermove', di);
      window.addEventListener('pointerup', thoi);
      window.addEventListener('pointercancel', thoi);
    }, true);
    // Lưới vẽ lại (innerHTML) sau mỗi thay đổi: dán lại dấu chọn.
    new MutationObserver(() => { if (chonV1 >= 0) veChonV1(); }).observe(N().luoi(), { childList: true });
    /* Lựa chọn chuyển sang THỨ KHÁC (khối, C1, A1/A2…) ⇒ bỏ đoạn V1 đang chọn — không thì Delete xoá đoạn V1
       trong lúc bảng phải đang hiện thứ khác (rà GĐ1: bấm tên C1 / A1 vẫn giữ đoạn V1 cũ). */
    D().nghe((loai) => {
      if (loai === 'chon' && (D().chon().length || D().chonGoc() !== 'v1') && chonV1 >= 0) { chonV1 = -1; veChonV1(); }
      if (loai === 'nap') chonV1 = -1;
    });
  }

  /* ── SỬA PHỤ ĐỀ trên track C1 (phụ đề tách lớp, Giai đoạn 3) ─────────────
     Câu phụ đề giữ giây GỐC (trục video đã dựng). Lần sửa đầu chép phụ đề của lượt dựng vào
     `duAn.phuDe` rồi sửa trên bản chép — "Khôi phục phụ đề gốc" ở bảng Khối bỏ bản chép. */
  let chonCau = -1;
  const coSuaPhuDe = () => !!(D() && D().duAn() && !D().chiDoc() && D().phuDeTt && D().phuDeTt());
  const capsHienTai = () => (D().phuDeDung() || []).map((c) => ({ ...c, ...(c.words ? { words: c.words.map((w) => ({ ...w })) } : {}) }));
  function ghiCaps(caps, ten) {
    D().datPhuDe({ an: D().phuDeAn(), captions: caps.filter((c) => c.end > c.start).sort((a, b) => a.start - b.start) }, ten);
  }
  /** Chữ mới cho một câu: chia lại các chữ đều trong [start, end] (giữ tô sáng từng chữ). */
  function chiaChu(c, text) {
    const tu = String(text).trim().split(/\s+/).filter(Boolean);
    const dai = (c.end - c.start) / Math.max(1, tu.length);
    return { start: c.start, end: c.end, text: tu.join(' '),
      ...(tu.length ? { words: tu.map((w, i) => ({ text: w, start: c.start + i * dai, end: c.start + (i + 1) * dai })) } : {}) };
  }
  function veChonCau() {
    const l = N().luoi();
    if (!l) return;
    l.querySelectorAll('.tl-khoi.phude.chon').forEach((k) => k.classList.remove('chon'));
    if (chonCau >= 0) l.querySelectorAll(`.tl-khoi.phude[data-cau="${chonCau}"]`).forEach((k) => k.classList.add('chon'));
  }
  function xoaCau(k) {
    const caps = capsHienTai();
    if (k < 0 || k >= caps.length) return;
    caps.splice(k, 1);
    chonCau = -1;
    ghiCaps(caps, 'Xoá câu phụ đề');
  }
  function tachCau(k, giayGoc) {
    const caps = capsHienTai();
    const c = caps[k];
    if (!c || giayGoc <= c.start + 0.1 || giayGoc >= c.end - 0.1) return;
    const ws = c.words || [];
    const a = ws.filter((w) => w.start < giayGoc);
    const b = ws.filter((w) => w.start >= giayGoc);
    const c1 = a.length && b.length ? { start: c.start, end: giayGoc, text: a.map((w) => w.text).join(' '), words: a.map((w) => ({ ...w, end: Math.min(w.end, giayGoc) })) }
      : chiaChu({ start: c.start, end: giayGoc }, c.text);
    const c2 = a.length && b.length ? { start: giayGoc, end: c.end, text: b.map((w) => w.text).join(' '), words: b }
      : chiaChu({ start: giayGoc, end: c.end }, c.text);
    caps.splice(k, 1, c1, c2);
    ghiCaps(caps, 'Tách câu phụ đề');
  }

  function ganPhuDe() {
    const cuon = N().cuon();
    cuon.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.tl-khoi.phude[data-cau]');
      if (!el || e.button !== 0 || !coSuaPhuDe()) return;
      e.preventDefault();
      e.stopPropagation();
      N().goc().focus({ preventScroll: true });
      const k = Number(el.dataset.cau);
      const msBam = N().giayTai(e.clientX) * 1000;
      const goc = (ms) => (N().dich2goc ? N().dich2goc(ms / 1000) : ms / 1000);
      if (congCu === 'cat') { tachCau(k, goc(msBam)); return; }
      const tay = e.target.closest('[data-tay-cau]');
      const x0 = e.clientX;
      const caps0 = capsHienTai();
      const c0 = caps0[k];
      if (!c0) return;
      const truoc = caps0[k - 1];
      const sau = caps0[k + 1];
      let daKeo = false;
      const di = (ev) => {
        const dx = ev.clientX - x0;
        if (!daKeo && Math.abs(dx) < 4) return;
        if (!daKeo) { daKeo = true; D().batDauNhom(tay ? 'Đổi giờ phụ đề' : 'Dời câu phụ đề'); document.body.classList.add('tl-dang-sua'); }
        const dS = dx / N().pps();
        const caps = caps0.map((c) => ({ ...c, ...(c.words ? { words: c.words.map((w) => ({ ...w })) } : {}) }));
        const c = caps[k];
        const sanTruoc = truoc ? truoc.end : 0;
        const tranSau = sau ? sau.start : Infinity;
        if (tay && tay.dataset.tayCau === 'trai') {
          c.start = Math.max(sanTruoc, Math.min(c0.end - 0.1, c0.start + dS));
          if (c.words) c.words.forEach((w) => { w.start = Math.max(w.start, c.start); w.end = Math.max(w.end, w.start); });
        } else if (tay) {
          c.end = Math.min(tranSau, Math.max(c0.start + 0.1, c0.end + dS));
          if (c.words) c.words.forEach((w) => { w.end = Math.min(w.end, c.end); w.start = Math.min(w.start, w.end); });
        } else {
          // Dời cả câu (cùng các chữ), không lấn câu kề.
          const d = Math.max(sanTruoc - c0.start, Math.min(tranSau - c0.end, dS));
          c.start = c0.start + d;
          c.end = c0.end + d;
          if (c.words) c.words.forEach((w, i) => { w.start = c0.words[i].start + d; w.end = c0.words[i].end + d; });
        }
        ghiCaps(caps, tay ? 'Đổi giờ phụ đề' : 'Dời câu phụ đề');
      };
      const thoi = () => {
        window.removeEventListener('pointermove', di);
        window.removeEventListener('pointerup', thoi);
        window.removeEventListener('pointercancel', thoi);
        document.body.classList.remove('tl-dang-sua');
        if (daKeo) { D().ketThucNhom(); return; }
        chonCau = k;
        chonV1 = -1;
        // Loại chọn 'phude' — tab Thuộc tính hiện bộ chỉnh phụ đề (render/kieu-phu-de.js).
        D().datChon([], 'phude');
        N().datDau(msBam / 1000);
        veChonCau();
        veChonV1();
      };
      window.addEventListener('pointermove', di);
      window.addEventListener('pointerup', thoi);
      window.addEventListener('pointercancel', thoi);
    }, true);
    // Bấm đúp: sửa chữ ngay trên khối.
    cuon.addEventListener('dblclick', (e) => {
      const el = e.target.closest('.tl-khoi.phude[data-cau]');
      if (!el || !coSuaPhuDe()) return;
      const k = Number(el.dataset.cau);
      const c = capsHienTai()[k];
      if (!c) return;
      const o = document.createElement('input');
      o.className = 'tl-dd-ten tl-pd-sua';
      o.value = c.text;
      o.maxLength = 400;
      o.setAttribute('aria-label', 'Sửa câu phụ đề');
      const g = N().goc();
      const rg = g.getBoundingClientRect();
      const re = el.getBoundingClientRect();
      o.style.left = `${Math.max(0, re.left - rg.left)}px`;
      o.style.top = `${re.top - rg.top}px`;
      o.style.width = `${Math.max(220, re.width)}px`;
      g.appendChild(o);
      o.focus();
      o.select();
      let xong = false;
      const luu = (giu) => {
        if (xong) return;
        xong = true;
        const moi = o.value.trim();
        if (giu && moi && moi !== c.text) {
          const caps = capsHienTai();
          // Dự án đổi trong lúc gõ (Ctrl+Z, agent sửa…) ⇒ chỉ số k có thể đã trỏ câu khác — bỏ.
          if (!caps[k] || caps[k].start !== c.start || caps[k].text !== c.text) { o.remove(); return; }
          caps[k] = chiaChu(caps[k], moi);
          ghiCaps(caps, 'Sửa chữ phụ đề');
        }
        o.remove();
      };
      o.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Enter') luu(true);
        else if (ev.key === 'Escape') luu(false);
      });
      o.addEventListener('blur', () => luu(true));
    });
    new MutationObserver(() => { if (chonCau >= 0) veChonCau(); }).observe(N().luoi(), { childList: true });
    /* Chỉ số câu đổi sau mọi thay đổi dự án (Ctrl+Z/Y, xoá, tách) — bỏ chọn, kẻo Delete xoá nhầm câu (audit GĐ3). */
    D().nghe((loai) => {
      if (loai === 'nap' || loai === 'duAn') { if (chonCau >= 0) { chonCau = -1; veChonCau(); } }
      // Như V1 ở trên: chọn thứ khác câu phụ đề (khối, A1/A2, V1) ⇒ bỏ câu đang chọn. Bấm tên C1 thì giữ.
      if (loai === 'chon' && (D().chon().length || D().chonGoc() !== 'phude') && chonCau >= 0) { chonCau = -1; veChonCau(); }
    });
  }

  /* ── thả từ Thư viện / Explorer ─────────────────────────────────────── */
  function ganTha() {
    const cuon = N().cuon();
    let vach = null;
    /** Khối sẽ bị THAY khi thả: khối hình có Ô giữ chỗ dưới con trỏ, hoặc bất kỳ khối hình khi giữ Alt. */
    const khoiThayDuoi = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const k = el && el.closest('.tl-khoi.nd[data-khoi]');
      const c = k && D().khoiCua(k.dataset.khoi);
      const t = c && D().trackCua(c.track);
      if (!c || !t || t.loai !== 'hinh' || t.khoa) return null;
      const m = D().mediaCua(c.media);
      if (!m || m.chu || m.lopPhu || m.boSlide) return null;
      return c.oCho || e.altKey ? c : null;
    };
    const laMedia = (e) => [...(e.dataTransfer.types || [])].some((x) => x === 'application/x-bee-media' || x === 'application/x-bee-thu-vien'
      || x === 'application/x-bee-nhac' || x === 'application/x-bee-sfx' || x === 'application/x-bee-lop-phu');
    const laTep = (e) => [...(e.dataTransfer.types || [])].includes('Files');
    const anVach = () => { if (vach) vach.hidden = true; cuon.querySelectorAll('.tl-lan.tha').forEach((l) => l.classList.remove('tha')); };
    cuon.addEventListener('dragover', (e) => {
      if (!D() || !D().duAn() || D().chiDoc() || !(laMedia(e) || laTep(e))) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      const g = N().giayTai(e.clientX);
      if (!vach) {
        vach = document.createElement('div');
        vach.className = 'tl-vach-tha';
        N().luoi().appendChild(vach);
      }
      if (!vach.isConnected) N().luoi().appendChild(vach);
      vach.hidden = false;
      vach.style.left = `${N().rongDau() + g * N().pps()}px`;
      cuon.querySelectorAll('.tl-lan.tha').forEach((l) => l.classList.remove('tha'));
      const lan = document.elementFromPoint(e.clientX, e.clientY);
      const l2 = lan && lan.closest('.tl-lan.nd');
      if (l2) l2.classList.add('tha');
    });
    cuon.addEventListener('dragleave', (e) => { if (!cuon.contains(e.relatedTarget)) anVach(); });
    cuon.addEventListener('drop', async (e) => {
      if (!D() || !D().duAn() || !(laMedia(e) || laTep(e))) return;
      e.preventDefault();
      anVach();
      document.body.classList.remove('dung-dang-keo');
      const ms = Math.round(bat(N().giayTai(e.clientX) * 1000, cacMoc()));
      const t = trackDuoi(e.clientX, e.clientY);
      if (laMedia(e)) {
        const tv = e.dataTransfer.getData('application/x-bee-thu-vien');
        // Mục thư viện dùng chung: chép vào dự án rồi đặt (một bước hoàn tác).
        if (tv) { await D().themTuThuVien([tv], ms, t ? t.id : null); return; }
        // Nhạc có sẵn (GĐ2.2): dựng/chép vào dự án rồi đặt khối LẶP tới hết video.
        // Lớp phủ có sẵn: đặt ĐÚNG chỗ thả, lên track hình thả vào (nếu là track hình) hoặc track trên cùng.
        const lp = e.dataTransfer.getData('application/x-bee-lop-phu');
        if (lp) {
          const r = await D().themLopPhu(lp, ms, { trackId: t && t.loai === 'hinh' ? t.id : null });
          if (!r.ok && RP.setStatus) RP.setStatus((r.loi || []).join(' · '), 'bad');
          return;
        }
        // Tiếng hiệu ứng có sẵn: đặt ĐÚNG chỗ thả (đã bắt dính) — track thả vào nếu nhận được.
        const sfx = e.dataTransfer.getData('application/x-bee-sfx');
        if (sfx) {
          const r = await D().themTiengHieuUng(sfx, ms, { trackId: t && t.loai === 'tieng' && t.vaiTro !== 'giong' ? t.id : null });
          if (!r.ok && RP.setStatus) RP.setStatus((r.loi || []).join(' · '), 'bad');
          return;
        }
        const nhac = e.dataTransfer.getData('application/x-bee-nhac');
        if (nhac) {
          const r = await D().themNhac(nhac, ms, { trackId: t ? t.id : null });
          if (!r.ok && RP.setStatus) RP.setStatus((r.loi || []).join(' · '), 'bad');
          return;
        }
        const idMedia = e.dataTransfer.getData('application/x-bee-media');
        /* Thả lên một Ô của mẫu (hoặc Alt + thả lên khối hình bất kỳ) = THAY media của khối đó, giữ chỗ + hiệu ứng. */
        const kDich = khoiThayDuoi(e);
        if (kDich && idMedia) {
          const r = D().thayMedia(kDich.id, idMedia);
          if (!r.ok && RP.setStatus) RP.setStatus(r.loi.join(' · '), 'bad');
          return;
        }
        D().themKhoi(idMedia, t ? t.id : null, ms);
        return;
      }
      // Tệp từ Explorer: nhập trước (chép vào dung/media) rồi xếp nối nhau từ chỗ thả.
      const tv = window.__beeThuVien;
      const ds = tv ? tv.duongTuDrop(e) : [];
      if (!ds.length) return;
      const kThay = khoiThayDuoi(e);
      if (kThay) {
        // Thả tệp lên một Ô / Alt + khối hình: nhập rồi THAY bằng tệp ảnh / video đầu tiên.
        D().batDauNhom('Thay media');
        try {
          const r = tv ? await tv.nhapVa(() => D().nhap(ds)) : null;
          const mm = ((r && r.media) || []).find((x) => x.loai !== 'tieng');
          if (mm) { const k = D().thayMedia(kThay.id, mm.id); if (!k.ok && RP.setStatus) RP.setStatus(k.loi.join(' · '), 'bad'); }
        } finally { D().ketThucNhom(); }
        return;
      }
      // Nhập (thêm media) + đặt N khối = MỘT bước hoàn tác — mở nhóm TRƯỚC khi nhập (audit GĐ2).
      D().batDauNhom('Thả media');
      try {
        const r = tv ? await tv.nhapVa(() => D().nhap(ds)) : null;
        let o = ms;
        const moi = r && r.media ? r.media : [];
        moi.forEach((mm) => {
          const idK = D().themKhoi(mm.id, t && hopTrack(t, mm) ? t.id : null, o);
          const c = idK && D().khoiCua(idK);
          if (c) o = M.ketThucMs(c, D().moc());
        });
      } finally { D().ketThucNhom(); }
    });
  }

  /* ── phím tắt ───────────────────────────────────────────────────────── */
  function catTaiDauPhat() {
    const ms = Math.round(N().tDau() * 1000);
    const moc = D().moc();
    const d = D().duAn();
    const chon = new Set(D().chon());
    // Có khối đang chọn thì cắt khối đó; không thì cắt MỌI khối dưới đầu phát trên track không khoá (như Premiere).
    const cac = d.khoi.filter((c) => (chon.size ? chon.has(c.id) : true)
      && !(D().trackCua(c.track) || {}).khoa && M.batDauMs(c, moc) < ms && M.ketThucMs(c, moc) > ms);
    if (!cac.length) return;
    D().batDauNhom('Cắt tại đầu phát');   // N khối = MỘT bước hoàn tác (audit)
    try { cac.forEach((c) => D().catTai(c.id, ms)); } finally { D().ketThucNhom(); }
  }

  function xoaLien(ids) {
    const moc = D().moc();
    D().lam((d) => {
      // Từ khối MUỘN nhất về trước: dời theo khối sớm trước là vị trí của khối muộn sai đi (audit GĐ2).
      const bo = d.khoi.filter((c) => ids.includes(c.id)).sort((a, b) => M.batDauMs(b, moc) - M.batDauMs(a, moc));
      let khoi = d.khoi.filter((c) => !ids.includes(c.id));
      // Mỗi khối xoá: các khối SAU nó trên cùng track dời lùi đúng độ dài của nó.
      bo.forEach((b) => {
        const a = M.batDauMs(b, moc);
        const dai = M.doDaiMs(b);
        khoi = khoi.map((c) => (c.track === b.track && M.batDauMs(c, moc) >= a
          ? M.datChoMs(c, M.batDauMs(c, moc) - dai, moc) : c));
      });
      return { ...d, khoi };
    }, 'Xoá liền');
    D().datChon([]);
  }

  function dan() {
    if (!banChep.length) return;
    const moc = D().moc();
    const ms = Math.round(N().tDau() * 1000);
    const dau = Math.min(...banChep.map((c) => M.batDauMs(c, moc)));
    const moiIds = [];
    D().lam((d) => {
      const co = d.khoi.map((c) => c.id);
      let khoi = d.khoi.slice();
      for (const c of banChep) {
        if (!d.media.some((m) => m.id === c.media) || !d.track.some((t) => t.id === c.track)) continue;
        const id = M.taoId('k', [...co, ...moiIds]);
        const muon = ms + (M.batDauMs(c, moc) - dau);
        const cho = D().choTrong({ ...d, khoi }, c.track, muon, M.doDaiMs(c));
        const moi = M.datChoMs({ ...c, id }, cho, moc);
        khoi = [...khoi, moi];
        moiIds.push(id);
      }
      return { ...d, khoi };
    }, 'Dán khối');
    D().datChon(moiIds);
  }

  /* ── điểm đánh dấu (M) ─────────────────────────────────────────────────
     M: đặt tại đầu phát (đã có ở đó thì thôi) · Shift+M: tới điểm sau · Ctrl+Shift+M:
     điểm trước. Trên thước: bấm gần cờ = nhảy đúng cờ · Alt+bấm = xoá · bấm đúp = đổi tên. */
  const dsDanhDau = () => ((D() && D().duAn() && D().duAn().danhDau) || []).slice().sort((a, b) => a.ms - b.ms);
  function datDanhDau() {
    const ms = Math.round(N().tDau() * 1000);
    if (dsDanhDau().some((x) => Math.abs(x.ms - ms) < 20)) return;
    D().themDanhDau(ms);
  }
  function nhayDanhDau(huong) {
    const ms = Math.round(N().tDau() * 1000);
    const ds = dsDanhDau();
    const x = huong > 0 ? ds.find((d) => d.ms > ms + 20) : [...ds].reverse().find((d) => d.ms < ms - 20);
    if (x) N().datDau(x.ms / 1000);
  }
  /** Cờ gần con trỏ trên thước (≤ 6px). */
  function coGan(clientX) {
    const ms = N().giayTai(clientX) * 1000;
    const nguong = (6 / N().pps()) * 1000;
    let tot = null;
    dsDanhDau().forEach((x) => { const k = Math.abs(x.ms - ms); if (k <= nguong && (!tot || k < tot.k)) tot = { x, k }; });
    return tot && tot.x;
  }
  function ganDanhDau() {
    const cuon = N().cuon();
    cuon.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !e.target.closest('[data-thuoc]') || !D() || !D().duAn()) return;
      const x = coGan(e.clientX);
      if (!x) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.altKey && !D().chiDoc()) { D().xoaDanhDau(x.id); return; }
      N().datDau(x.ms / 1000);
    }, true);
    cuon.addEventListener('dblclick', (e) => {
      if (!e.target.closest('[data-thuoc]') || !D() || D().chiDoc()) return;
      const x = coGan(e.clientX);
      if (!x) return;
      const o = document.createElement('input');
      o.className = 'tl-dd-ten';
      o.value = x.ten || '';
      o.maxLength = 80;
      o.placeholder = 'Tên điểm đánh dấu';
      o.setAttribute('aria-label', 'Tên điểm đánh dấu');
      /* Gắn vào GỐC timeline (ngoài lưới): lưới bị dựng lại (innerHTML) mỗi khi có sự kiện —
         ô đang gõ sẽ mất (audit). Toạ độ tính theo màn hình lúc mở. */
      const thuoc = e.target.closest('[data-thuoc]');
      const g = N().goc();
      const rg = g.getBoundingClientRect();
      const rt = thuoc.getBoundingClientRect();
      o.style.left = `${e.clientX - rg.left - 8}px`;
      o.style.top = `${rt.top - rg.top}px`;
      g.appendChild(o);
      o.focus();
      o.select();
      let xong = false;
      const luu = (giu) => {
        if (xong) return;
        xong = true;
        if (giu && o.value !== (x.ten || '')) D().suaDanhDau(x.id, { ten: o.value.slice(0, 80) }, 'Đổi tên điểm đánh dấu');
        o.remove();
      };
      o.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Enter') luu(true);
        else if (ev.key === 'Escape') luu(false);
      });
      o.addEventListener('blur', () => luu(true));
    });
    // Rê chuột trên cờ: hiện tên.
    cuon.addEventListener('pointermove', (e) => {
      const th = e.target.closest('[data-thuoc]');
      if (!th) return;
      const x = coGan(e.clientX);
      th.title = x ? `${x.ten || 'Điểm đánh dấu'} · ${(x.ms / 1000).toFixed(2)} giây — bấm đúp đổi tên, Alt+bấm xoá` : '';
    });
  }

  function ganPhim() {
    N().goc().addEventListener('keydown', (e) => {
      if (!D() || !D().duAn() || e.target.closest('input, textarea, .tl-keo')) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      let xong = true;
      if (ctrl && k === 'z' && !e.shiftKey) D().hoanTac();
      else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) D().lamLai();
      else if (D().chiDoc()) xong = false;
      else if (ctrl && k === 'k') catTaiDauPhat();
      else if (ctrl && k === 'c') banChep = D().chon().map((id) => D().khoiCua(id)).filter(Boolean);
      else if (ctrl && k === 'v') dan();
      else if (ctrl && k === 'a') D().datChon(D().duAn().khoi.filter((c) => !(D().trackCua(c.track) || {}).khoa).map((c) => c.id));
      else if (ctrl && e.shiftKey && k === 'm') nhayDanhDau(-1);
      else if (ctrl) xong = false;
      else if ((e.key === 'Delete' || e.key === 'Backspace') && chonCau >= 0 && !D().chon().length && coSuaPhuDe()) xoaCau(chonCau);
      else if ((e.key === 'Delete' || e.key === 'Backspace') && chonV1 >= 0 && !D().chon().length && coSuaV1()) boDoanV1(chonV1);
      else if ((e.key === 'Delete' || e.key === 'Backspace') && D().chon().length) {
        const ids = D().chon().filter((id) => !(D().trackCua((D().khoiCua(id) || {}).track) || {}).khoa);
        if (e.shiftKey) xoaLien(ids); else D().xoaKhoi(ids);
      } else if (k === 'c' && !e.shiftKey) datCongCu('cat');
      else if (k === 'v' && !e.shiftKey) datCongCu('chon');
      else if (k === 's' && !e.shiftKey) { batDinh = !batDinh; veNut(); }
      else if (k === 'm' && e.shiftKey) nhayDanhDau(1);
      else if (k === 'm') datDanhDau();
      else if (e.key === 'Escape' && (D().chon().length || congCu !== 'chon' || chonV1 >= 0 || chonCau >= 0)) {
        D().datChon([]); chonV1 = -1; chonCau = -1; veChonV1(); veChonCau(); datCongCu('chon');
      }
      else xong = false;
      if (xong) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  /* ── nút trên thanh công cụ timeline ────────────────────────────────── */
  function datCongCu(c) {
    // Bật dao cạo: nói rõ cắt được ở đâu — giọng đọc / nhạc / tiếng chuyển của slide là làn dẫn xuất, không cắt (audit 23/10).
    if (c === 'cat' && congCu !== 'cat' && RP.setStatus) {
      RP.setStatus('Dao cạo: bấm vào khối video / ảnh / âm thanh, đoạn slide (V1) hoặc câu phụ đề để cắt. V hoặc Esc: về công cụ Chọn.', 'good');
    }
    congCu = c;
    const g = N().goc();
    g.classList.toggle('tl-cong-cu-cat', c === 'cat');
    veNut();
  }
  function veNut() {
    const g = N().goc();
    const q = (s) => g.querySelector(s);
    const dg = D();
    const co = !!(dg && dg.duAn() && !dg.chiDoc());
    [['[data-sua="chon"]', congCu === 'chon'], ['[data-sua="cat"]', congCu === 'cat'], ['[data-sua="bat"]', batDinh]].forEach(([s, bat0]) => {
      const n = q(s);
      if (n) { n.classList.toggle('bat', bat0); n.disabled = !co; }
    });
    const ht = q('[data-sua="hoan"]');
    const ll = q('[data-sua="lai"]');
    if (ht) ht.disabled = !(dg && dg.coHoanTac());
    if (ll) ll.disabled = !(dg && dg.coLamLai());
  }

  function dungNut() {
    const thanh = N().goc().querySelector('.tl-thanh');
    const vachSau = thanh.querySelector('.tl-trang-thai');
    const cum = document.createElement('span');
    cum.className = 'tl-cum-sua';
    cum.innerHTML = `
      <button class="tl-nut" type="button" data-sua="chon" title="Công cụ Chọn — bấm / kéo khối (V)" aria-label="Công cụ chọn"><span class="btn-icon" data-icon="conTro"></span></button>
      <button class="tl-nut" type="button" data-sua="cat" title="Dao cạo — bấm vào khối video / ảnh / âm thanh, đoạn slide (V1) hoặc câu phụ đề để cắt đôi (C)" aria-label="Dao cạo"><span class="btn-icon" data-icon="dao"></span></button>
      <button class="tl-nut" type="button" data-sua="bat" title="Bắt dính: kéo khối / cắt sẽ hút vào đầu phát, ranh giới slide và mép khối (S)"
              aria-label="Bắt dính"><span class="btn-icon" data-icon="namCham"></span></button>
      <span class="tl-vach"></span>
      <button class="tl-nut" type="button" data-sua="hoan" title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác"><span class="btn-icon" data-icon="hoantac"></span></button>
      <button class="tl-nut tl-lat" type="button" data-sua="lai" title="Làm lại (Ctrl+Shift+Z)" aria-label="Làm lại"><span class="btn-icon" data-icon="hoantac"></span></button>
      <span class="tl-vach"></span>`;
    thanh.insertBefore(cum, vachSau);
    /* ⚠ NÚT "XUẤT BẢN DỰNG" ĐÃ BỎ (chủ dự án 12/10/2026: "gần giống nút Tạo video, chả cần
       thiết"). Chỉnh sửa trên timeline nay được "Tạo video" TỰ ÁP sau khi dựng slide xong
       (render/queue.js) → `output/<tên>-dung.mp4`. `D().xuat()` vẫn còn cho cổng MCP. */
    if (window.__beeIcons) window.__beeIcons.apply(thanh);
    thanh.addEventListener('click', async (e) => {
      const n = e.target.closest('[data-sua]');
      if (!n || n.disabled) return;
      const l = n.dataset.sua;
      if (l === 'chon' || l === 'cat') datCongCu(l);
      else if (l === 'bat') { batDinh = !batDinh; veNut(); }
      else if (l === 'hoan') D().hoanTac();
      else if (l === 'lai') D().lamLai();
    });
  }
  /* Báo cả ở dòng trạng thái của timeline (bị vẽ lại khá nhanh) lẫn dòng trạng
     thái chung của trang (RP.setStatus, core.js) — chỗ người dùng quen nhìn. */
  function baoXuat(chu, loi) {
    const el = N().goc().querySelector('#tlTrangThai');
    if (el) {
      el.textContent = chu;
      el.title = chu;
      el.className = `tl-trang-thai${loi ? ' canh-bao' : ''}`;
    }
    if (RP.setStatus) RP.setStatus(chu, loi ? 'bad' : 'good');
  }

  function khoi() {
    if (!N() || !D()) return;
    dungNut();
    ganKhoi();
    ganTha();
    ganPhim();
    ganDanhDau();
    ganV1();
    ganPhuDe();
    D().nghe(() => veNut());
    veNut();
    const api = window.beeknoee;
    if (api && api.render && api.render.onDone) {
      api.render.onDone((r) => {
        if (!r || !D() || !r.projectDir) return;
        // Chỉ báo của CHÍNH deck đang mở (lượt của deck khác: dải tiến độ chung đã báo).
        if (String(r.projectDir).split(/[\\/]/).filter(Boolean).pop() !== D().deck()) return;
        if (r.banDung) {   // lượt xuất do AI agent gọi qua MCP (nút trên timeline đã bỏ)
          const ten = String(r.videoPath || '').split(/[\\/]/).pop();
          const nhan = D().laVideo && D().laVideo() ? 'Đã xuất video' : 'Đã xuất bản dựng';
          baoXuat(`${nhan}: output/${ten} (${Number(r.duration || 0).toFixed(1)} giây)`);
        } else if (r.banDungPath) {   // "Tạo video" đã tự áp chỉnh sửa timeline (render/queue.js)
          baoXuat(`Đã áp chỉnh sửa timeline: output/${String(r.banDungPath).split(/[\\/]/).pop()}`);
        }
      });
    }
    if (api && api.render && api.render.onError) {
      api.render.onError((r) => {
        if (r && r.banDung && r.message) baoXuat(r.message, true);
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', khoi);
  else khoi();
})();
