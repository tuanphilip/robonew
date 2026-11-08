'use strict';
/**
 * TAB "KHỐI" ở cột phải — "Effect Controls" của trình dựng (KE-HOACH.md §5).
 *
 * Tự gắn một nút tab vào hàng tab của bảng sửa (bang-sua.js) và một thân riêng đặt
 * cạnh `#bsThan` — KHÔNG sửa ruột bang-sua: bấm tab Thuộc tính (render/tab-phai.js) thì ẩn thân của bảng sửa,
 * bấm tab khác của bảng sửa thì trả lại (nghe ở pha capture, trước bộ xử lý của nó).
 *
 *   Khối hình:  Chuyển động (X/Y · Cỡ · Xoay · Độ đục — mỗi thuộc tính có ⏱ keyframe)
 *               · Cắt khung + lật · Chuyển cảnh vào/ra (+ hoà với khối liền trước)
 *   Khối tiếng: Âm lượng (⏱ keyframe) · Tăng/giảm dần · Tốc độ
 *   Chữ tiêu đề: nội dung, phông, cỡ, màu, nền, viền, bóng (vẽ lại PNG — chu-tieu-de.js)
 *   Không chọn gì: Cài đặt bản dựng (khung xuất 16:9…, nền, hạ nhạc khi có giọng)
 *   Track A1/A2 (bấm tên track): âm lượng giọng / nhạc + hiệu ứng deck
 *
 * KEYFRAME kiểu Premiere: ⏱ bật/tắt hoạt ảnh của thuộc tính; khi bật, kéo thanh trượt là
 * đặt keyframe TẠI ĐẦU PHÁT; ◆ thêm/bỏ keyframe tại đầu phát; ◀ ▶ nhảy tới keyframe kề.
 * Giờ keyframe tính từ đầu khối (moHinh) — dao cạo / cắt mép / tốc độ tự dời theo.
 *
 * Kéo một thanh trượt = MỘT bước hoàn tác (nhóm mở lúc nhấn, đóng lúc nhả).
 * Mọi chữ từ dữ liệu người dùng (tên tệp, nội dung chữ) đi qua `textContent` / `.value`.
 */
(function () {
  const RP = window.__renderPage || {};
  const M = window.__beeDung && window.__beeDung.moHinh;
  if (!M) return;
  const D = () => RP.dung;
  const kep = (v, a, b) => Math.max(a, Math.min(b, v));
  const KHUNG_MS = 34;              // ◆ "đang ở keyframe" khi đầu phát cách ≤ 1 khung

  let nut = null;
  let than = null;
  let dangMo = false;
  let dangKeoTruot = false;        // đang KÉO một thanh trượt của bảng — đừng dựng lại (mất cú kéo)
  let lanGoPhim = 0;               // phím mũi tên trên thanh trượt đang giữ
  let hangSong = [];               // các hàng có keyframe: cập nhật giá trị khi đầu phát chạy

  const tao = (the, lop, chu) => {
    const e = document.createElement(the);
    if (lop) e.className = lop;
    if (chu != null) e.textContent = chu;
    return e;
  };
  const nutNho = (chu, tieuDe, lop) => {
    const b = tao('button', `bk-kf-nut${lop ? ` ${lop}` : ''}`, chu);
    b.type = 'button';
    b.title = tieuDe;
    b.setAttribute('aria-label', tieuDe);
    return b;
  };

  /* ── gắn vào bảng sửa ──────────────────────────────────────────────────── */
  /* Tab "Thuộc tính" (trước 16/10/2026 tên "Khối") — đăng ký qua tab-phai.js: nó lo loại trừ với các tab
     của bảng sửa và với "Thư viện". Nội dung đi theo THỨ ĐANG CHỌN trên timeline (như Premiere):
     khối · track C1 / câu phụ đề · A1 / A2 · không chọn gì = cài đặt bản dựng. */
  function gan() {
    if (nut) return true;
    if (!RP.tabPhai) return false;
    const thanMoi = tao('div', 'bs-than bk-than');
    thanMoi.id = 'bkThan';
    if (!RP.tabPhai.dangKy('khoi', { ten: 'Thuộc tính', icon: 'khoi', than: thanMoi, thuTu: 1,
      onDoi: (bat) => { dangMo = bat; if (bat) ve(); } })) return false;
    than = thanMoi;
    nut = document.querySelector('#bangSua .bs-tab [data-tab-rieng="khoi"]');
    // Rời một ô nhập của bảng: vẽ lại (đã bỏ qua các lượt vẽ trong lúc đang gõ).
    /* Focus chuyển sang một nút KHÁC trong bảng (đang nhấn chuột) thì đừng dựng lại — dựng lại
       là gỡ chính cái nút đó trước lúc nhả chuột, cú bấm bị nuốt (audit). */
    than.addEventListener('focusout', (e) => {
      if (e.relatedTarget && than.contains(e.relatedTarget)) return;
      setTimeout(() => { if (!dangGo()) ve(); }, 0);
    });
    return true;
  }

  function mo(bat) {
    if (!nut || !than) return;
    // Đang mở sẵn thì tabPhai.mo không gọi lại onDoi — vẽ lại ở đây (lựa chọn vừa đổi).
    if (bat) { if (RP.tabPhai.dangMo('khoi')) ve(); else RP.tabPhai.mo('khoi'); }
    else if (RP.tabPhai.dangMo('khoi')) RP.tabPhai.dong();
  }

  /** Đang gõ / kéo trong bảng: dựng lại lúc này là mất con trỏ và cú kéo. */
  function dangGo() {
    if (!than) return false;
    if (dangKeoTruot) return true;
    const a = document.activeElement;
    if (!a || !than.contains(a)) return false;
    if (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'
      || (a.tagName === 'INPUT' && (a.type === 'text' || a.type === 'number' || a.type === 'color'))) return true;
    return a.type === 'range' && Date.now() - lanGoPhim < 600;
  }

  /* ── đầu phát trong khối ───────────────────────────────────────────────── */
  const tDauMs = () => (RP.timeline && RP.timeline.tDauMs ? RP.timeline.tDauMs() : 0);
  /** Giờ của đầu phát TRONG khối (ms), kẹp vào độ dài khối. */
  const msTrong = (c) => kep(Math.round(tDauMs() - M.batDauMs(c, D().moc())), 0, M.doDaiMs(c));
  const toiGiay = (ms) => { const n = RP.timeline && RP.timeline.noi; if (n && n.datDau) n.datDau(ms / 1000); };

  /* ── một hàng điều khiển: nhãn · thanh trượt · ô số ───────────────────── */
  function hang(nhan, { min, max, buoc, gia, donVi, doi, ten, truoc, sau }) {
    /* DIV chứ không LABEL: label chuyển MỌI cú bấm vào chữ/khe trong hàng cho ô điều khiển
       đầu tiên — ở hàng có keyframe đó là nút ⏱, bấm chữ "Cỡ" là bật/tắt hoạt ảnh (audit). */
    const h = tao('div', `bk-hang${truoc ? ' co-kf' : ''}`);
    if (truoc) h.appendChild(truoc);
    h.appendChild(tao('span', 'bk-nhan', nhan));
    const tr = tao('input', 'bk-truot');
    Object.assign(tr, { type: 'range', min, max, step: buoc, value: gia });
    const o = tao('input', 'bk-so');
    Object.assign(o, { type: 'number', min, max, step: buoc, value: gia });
    const dv = tao('span', 'bk-dv', donVi || '');
    let nhom = false;
    const datGia = (v, xong) => {
      // Xoá trống ô số rồi rời ô: Number('') = 0 ⇒ kẹp về "min" (độ đục 0, khối biến mất). Trả lại số cũ.
      if (String(v).trim() === '') { o.value = tr.value; return; }
      const so = Math.min(Number(max), Math.max(Number(min), Number(v)));
      if (!Number.isFinite(so)) return;
      tr.value = String(so);
      o.value = String(so);
      if (!nhom) { D().batDauNhom(ten); nhom = true; }
      doi(so);
      if (xong) { D().ketThucNhom(); nhom = false; }
    };
    tr.addEventListener('input', () => datGia(tr.value, false));
    tr.addEventListener('pointerdown', () => { dangKeoTruot = true; });
    tr.addEventListener('keydown', () => { lanGoPhim = Date.now(); });
    /* Đóng nhóm hoàn tác ở MỌI lối kết thúc: kéo rồi nhả đúng giá trị cũ thì Chrome
       không bắn `change` — nhóm treo, Ctrl+Z hết tác dụng (audit 10/10/2026). Nhả xong
       thì vẽ lại: bảng đã bỏ qua các lượt vẽ trong lúc kéo (audit: bảng đứng số cũ). */
    const dongNhom = () => {
      if (nhom) { D().ketThucNhom(); nhom = false; }
      if (dangKeoTruot) { dangKeoTruot = false; setTimeout(ve, 0); }
    };
    ['change', 'pointerup', 'pointercancel', 'blur', 'keyup'].forEach((ev) => tr.addEventListener(ev, dongNhom));
    o.addEventListener('change', () => datGia(o.value, true));
    h.append(tr, o, dv);
    if (sau) h.appendChild(sau);
    h.datHienThi = (v) => { tr.value = String(v); o.value = String(v); };
    return h;
  }

  function nhom(tieuDe, ...cac) {
    const g = tao('div', 'bk-nhom');
    g.appendChild(tao('div', 'bk-nhom-ten', tieuDe));
    cac.filter(Boolean).forEach((x) => g.appendChild(x));
    return g;
  }

  /** `cacLua`: `[giá trị, chữ]` hoặc nhóm `{ nhom: 'Tên', ds: [[giá trị, chữ], …] }` (→ <optgroup>). */
  function oChon(nhan, giaTri, cacLua, doi) {
    const h = tao('label', 'bk-hang bk-hang-chon');
    h.appendChild(tao('span', 'bk-nhan', nhan));
    const s = tao('select', 'bk-chon');
    const lua = (cha, [v, chu]) => { const op = tao('option', '', chu); op.value = v; cha.appendChild(op); };
    cacLua.forEach((x) => {
      if (x && x.nhom) {
        const g = tao('optgroup');
        g.label = x.nhom;
        x.ds.forEach((y) => lua(g, y));
        s.appendChild(g);
      } else lua(s, x);
    });
    s.value = giaTri;
    s.addEventListener('change', () => doi(s.value));
    h.appendChild(s);
    return h;
  }

  function oTick(chu, bat, doi) {
    const h = tao('label', 'bk-hang bk-neo');
    const o = tao('input');
    o.type = 'checkbox';
    o.checked = !!bat;
    o.addEventListener('change', () => doi(o.checked));
    h.append(o, tao('span', '', chu));
    return h;
  }

  /**
   * Hàng của một thuộc tính CÓ keyframe (x, y, co, xoay, mo, amLuong).
   * `heSo`: giá trị lưu × heSo = số hiển thị (vd 0.5 → 50 %).
   */
  function hangThuocTinh(c, ten, nhan, { min, max, buoc, heSo, donVi, tenLenh }) {
    const dg = D();
    const tinh = (x) => (ten === 'amLuong' ? x.amLuong : (x.bienDoi[ten] == null ? 1 : x.bienDoi[ten]));
    const hienTai = () => dg.khoiCua(c.id) || c;
    const ds = () => (hienTai().kf || {})[ten] || [];
    const giaTai = () => {
      const c2 = hienTai();
      const d2 = (c2.kf || {})[ten];
      const v = d2 && d2.length ? M.giaTriKf(d2, msTrong(c2)) : tinh(c2);
      return Math.round(v * heSo * 100) / 100;
    };
    const suaKf = (f, tenL) => dg.suaKhoi(c.id, (x) => ({ ...x, kf: { ...(x.kf || {}), [ten]: f(((x.kf || {})[ten]) || [], x) } }), tenL);
    const datTinh = (x, v) => (ten === 'amLuong' ? { ...x, amLuong: v } : { ...x, bienDoi: { ...x.bienDoi, [ten]: v } });
    const boKf = (x) => { const k = { ...(x.kf || {}) }; delete k[ten]; return k; };

    const dongHo = nutNho('⏱', 'Bật / tắt hoạt ảnh (keyframe) cho thuộc tính này', 'bk-dong-ho');
    const lui = nutNho('◀', 'Tới keyframe trước');
    const kim = nutNho('◆', 'Thêm / bỏ keyframe tại đầu phát', 'bk-kim');
    const toi = nutNho('▶', 'Tới keyframe sau');
    const cum = tao('span', 'bk-kf-cum');
    cum.append(lui, kim, toi);

    const h = hang(nhan, {
      min, max, buoc, gia: giaTai(), donVi, ten: tenLenh,
      truoc: dongHo, sau: cum,
      doi: (v) => {
        const gt = v / heSo;
        const c2 = dg.khoiCua(c.id);
        if (c2 && ((c2.kf || {})[ten] || []).length) {
          // Đang có hoạt ảnh: đặt keyframe TẠI ĐẦU PHÁT (như Premiere).
          const t = msTrong(c2);
          suaKf((d) => {
            const cu = d.find((k) => Math.abs(k.t - t) <= KHUNG_MS);
            return M.kfDat(d.filter((k) => k !== cu), cu ? cu.t : t, gt, !!(cu && cu.muot));
          }, tenLenh);
        } else dg.suaKhoi(c.id, (x) => datTinh(x, gt), tenLenh);
      },
    });
    const ngoaiKhoi = () => {
      const c2 = hienTai();
      const t = tDauMs() - M.batDauMs(c2, dg.moc());
      return t < 0 || t > M.doDaiMs(c2);
    };
    const veNut = () => {
      const d = ds();
      const t = msTrong(hienTai());
      const coKf = d.length > 0;
      /* Đầu phát NGOÀI khối mà thuộc tính có hoạt ảnh: sửa là đặt keyframe ở MÉP khối (giờ bị
         kẹp) — điều người dùng không thấy. Khoá như Premiere, nhắc đưa đầu phát vào khối. */
      const khoaKf = coKf && ngoaiKhoi();
      h.querySelectorAll('input').forEach((x) => { x.disabled = khoaKf || !!x.dataset.khoaGoc; });
      kim.disabled = ngoaiKhoi() || !!kim.dataset.khoaGoc;
      h.title = khoaKf ? 'Đưa đầu phát vào trong khối để sửa keyframe' : '';
      dongHo.classList.toggle('bat', coKf);
      dongHo.setAttribute('aria-pressed', coKf ? 'true' : 'false');
      cum.hidden = !coKf;
      kim.classList.toggle('bat', d.some((k) => Math.abs(k.t - t) <= KHUNG_MS));
      lui.disabled = !d.some((k) => k.t < t - KHUNG_MS);
      toi.disabled = !d.some((k) => k.t > t + KHUNG_MS);
    };
    dongHo.addEventListener('click', (e) => {
      e.preventDefault();
      const d = ds();
      const c2 = dg.khoiCua(c.id);
      if (!c2) return;
      if (d.length) {
        // Tắt hoạt ảnh: giữ giá trị ĐANG THẤY tại đầu phát làm giá trị tĩnh.
        const v = M.giaTriKf(d, msTrong(c2));
        dg.suaKhoi(c.id, (x) => ({ ...datTinh(x, v), kf: boKf(x) }), `Tắt hoạt ảnh ${nhan.toLowerCase()}`);
      } else {
        suaKf((_d, x) => [{ t: msTrong(c2), v: tinh(x) }], `Bật hoạt ảnh ${nhan.toLowerCase()}`);
      }
    });
    kim.addEventListener('click', (e) => {
      e.preventDefault();
      const c2 = dg.khoiCua(c.id);
      if (!c2 || ngoaiKhoi()) return;
      const t = msTrong(c2);
      const d = ds();
      const cu = d.find((k) => Math.abs(k.t - t) <= KHUNG_MS);
      if (cu && d.length === 1) dg.suaKhoi(c.id, (x) => ({ ...datTinh(x, cu.v), kf: boKf(x) }), 'Bỏ keyframe');
      else if (cu) suaKf((dd) => dd.filter((k) => k.t !== cu.t), 'Bỏ keyframe');
      else suaKf((dd, x) => M.kfDat(dd, t, dd.length ? M.giaTriKf(dd, t) : tinh(x)), 'Thêm keyframe');
    });
    const nhay = (huong) => (e) => {
      e.preventDefault();
      const c2 = dg.khoiCua(c.id);
      if (!c2) return;
      const t = msTrong(c2);
      const d = ds();
      const k = huong < 0 ? [...d].reverse().find((x) => x.t < t - KHUNG_MS) : d.find((x) => x.t > t + KHUNG_MS);
      if (k) toiGiay(M.batDauMs(c2, dg.moc()) + k.t);
    };
    lui.addEventListener('click', nhay(-1));
    toi.addEventListener('click', nhay(1));
    veNut();
    // Đầu phát chạy: giá trị + ◆ theo đầu phát (không dựng lại cả bảng).
    hangSong.push(() => { if (!h.contains(document.activeElement)) h.datHienThi(giaTai()); veNut(); });
    return h;
  }

  /* ── vẽ ───────────────────────────────────────────────────────────────── */
  function ve() {
    if (!than || !dangMo) return;
    if (dangGo()) return;
    than.textContent = '';
    hangSong = [];
    const dg = D();
    const d = dg && dg.duAn();
    const goc = dg && dg.chonGoc ? dg.chonGoc() : null;
    /* Deck mà timeline chưa nạp được (hỏng / bản app mới hơn): phụ đề vẫn là thiết lập của DECK — vẫn chỉnh được. */
    if (dg && !d && goc === 'phude' && RP.phuDe && !(dg.laVideo && dg.laVideo())) {
      RP.phuDe.vePhuDe(than, { nhom, oTick, oChon, tao });
      return;
    }
    if (!dg || !d) {
      than.appendChild(tao('div', 'bk-trong', 'Mở một dự án để dựng video.'));
      return;
    }
    // Track C1 / một câu phụ đề: bộ chỉnh phụ đề dùng chung (bật/tắt, tạo tự động, kiểu chữ, chép).
    if (goc === 'phude') {
      if (RP.phuDe) RP.phuDe.vePhuDe(than, { nhom, oTick, oChon, tao });
      /* Chỉ đọc = DỰ ÁN TIMELINE chỉ đọc. Kiểu / bật-tắt phụ đề của DECK ghi preview-settings.json, không phải
         timeline ⇒ chỉ khoá khi là dự án video (ở đó phụ đề nằm trong timeline). kieu-phu-de.js tự khoá nút timeline. */
      if (dg.chiDoc() && dg.laVideo && dg.laVideo()) than.querySelectorAll('input, button, select').forEach((e) => { e.disabled = true; });
      return;
    }
    // Khối slide (V1): deck ⇒ đã nhảy sang tab Nội dung (khoi() bên dưới); dự án video ⇒ nền, xem cài đặt.
    if (goc === 'v1') {
      than.appendChild(tao('div', 'bk-trong', dg.laVideo && dg.laVideo()
        ? 'V1 là nền đen của dự án video — thả ảnh / video lên V2, V3.'
        : 'Chỉnh chữ, màu, hiệu ứng của slide ở tab Nội dung (bấm khối slide trên V1 là tới đúng slide đó).'));
      veCaiDat();
      return;
    }
    /* Đang mở một BỘ SLIDE PHỤ (GĐ3.7): timeline của nó chỉ để xem — vị trí / cắt / chuyển cảnh của bộ này chỉnh ở
       dự án mẹ (nó là một clip ở đó). */
    const bo = dg.boSlide && dg.boSlide();
    if (bo) {
      const ve1 = tao('button', 'bk-nut gk-ok', `← Về dự án "${bo.cha}"`);
      ve1.type = 'button';
      ve1.onclick = () => { if (window.__beePages && window.__beePages.moDuAnVuaTao) window.__beePages.moDuAnVuaTao(bo.cha); };
      const h1 = tao('div', 'bk-nut-hang');
      h1.appendChild(ve1);
      than.appendChild(nhom(`Bộ slide ${bo.id.slice(1)} của "${bo.cha}"`,
        tao('div', 'bk-phu', 'Sửa chữ, lời thoại, giọng, nhạc của bộ này ở tab Nội dung / Âm thanh. Bộ này là MỘT clip trên timeline của dự án mẹ — kéo, cắt, chuyển cảnh ở đó. "Tạo video" dựng chung cả dự án mẹ (một lượt).'),
        h1));
      return;
    }
    if (goc) { veGoc(goc); return; }
    const ids = dg.chon();
    if (ids.length !== 1) {
      than.appendChild(tao('div', 'bk-trong', ids.length
        ? `Đang chọn ${ids.length} khối — chọn MỘT khối để chỉnh thuộc tính.`
        : 'Chọn một khối trên timeline (hoặc bấm tên track C1 / A1 / A2) để chỉnh. Kéo media từ tab Thư viện vào timeline để thêm khối.'));
      if (!ids.length) veCaiDat();
      return;
    }
    const c = dg.khoiCua(ids[0]);
    const m = c && dg.mediaCua(c.media);
    const t = c && dg.trackCua(c.track);
    if (!c || !m || !t) return;
    const khoa = t.khoa || dg.chiDoc();
    const sua = (f, ten) => dg.suaKhoi(c.id, f, ten);
    const moc = dg.moc();

    const dau = tao('div', 'bk-dau');
    dau.appendChild(tao('b', 'bk-ten', m.ten));
    dau.appendChild(tao('span', 'bk-phu', `${t.id} · ${((M.ketThucMs(c, moc) - M.batDauMs(c, moc)) / 1000).toFixed(2)} giây${khoa ? ' · track đang khoá' : ''}`));
    than.appendChild(dau);

    if (m.chu) than.appendChild(nhomChu(m));
    /* THAY ẢNH / VIDEO (mẫu dựng video, 23/10/2026): khối hình thường (không phải chữ / lớp phủ / bộ slide) — giữ
       chỗ, độ dài, hiệu ứng (dung-kho.js#thayMedia). Ô của mẫu thì nói rõ đang dùng ảnh mẫu. */
    if (t.loai === 'hinh' && m.loai !== 'tieng' && !m.chu && !m.lopPhu && !m.boSlide && !khoa) {
      const nutThay = tao('button', 'bk-nut gk-ok', c.oCho && !c.oCho.daThay ? 'Thay bằng ảnh / video của bạn…' : 'Thay ảnh / video…');
      nutThay.type = 'button';
      nutThay.onclick = async () => {
        nutThay.disabled = true;
        try {
          const r = await dg.chonTep();
          const mMoi = ((r && r.media) || []).find((x) => x.loai !== 'tieng');
          if (mMoi) {
            const k = dg.thayMedia(c.id, mMoi.id);
            if (!k.ok && RP.setStatus) RP.setStatus(k.loi.join(' · '), 'bad');
          } else if (r && r.loi && r.loi.length && RP.setStatus) RP.setStatus(r.loi.join(' · '), 'bad');
        } finally { nutThay.disabled = false; }
      };
      const hThay = tao('div', 'bk-nut-hang');
      hThay.appendChild(nutThay);
      than.appendChild(nhom(c.oCho ? `Ô ${c.oCho.so} của mẫu` : 'Ảnh / video', tao('div', 'bk-phu', c.oCho
        ? (c.oCho.daThay ? 'Đã thay bằng media của bạn — thay lại thoải mái, hiệu ứng giữ nguyên.'
          : 'Đang dùng ảnh / video MẪU. Thay bằng của bạn — giữ nguyên chỗ, độ dài, hiệu ứng; hoặc kéo media từ Thư viện thả lên khối này.')
        : 'Đổi sang ảnh / video khác — giữ nguyên chỗ, độ dài, chuyển cảnh, keyframe.'), hThay));
    }
    // Chữ động dựng sẵn (đợt 1 hiệu ứng, moHinh.CHU_DONG): một ô chọn = vào + ra + hiệu ứng. Chỉnh tay ở "Chuyển cảnh".
    if (m.chu && !khoa) {
      const dangCo = M.chuDongCua(c);
      const ds = [['khong', 'Không'], ...Object.entries(M.CHU_DONG).map(([k, x]) => [k, x.ten]), ...(dangCo === 'tuy-chinh' ? [['tuy-chinh', 'Tuỳ chỉnh (ở mục Chuyển cảnh)']] : [])];
      than.appendChild(nhom('Chữ động', oChon('Kiểu', dangCo, ds, (v) => { if (v !== 'tuy-chinh') sua((x) => M.apChuDong(x, v), 'Đổi kiểu chữ động'); })));
    }
    /* Clip của BỘ SLIDE PHỤ (GĐ3.7): nội dung sửa trong chính bộ đó (mở như một dự án); "Tạo video" dựng lại nó nếu
       đã sửa sau lần dựng cuối. */
    if (m.boSlide) {
      const chua = /-cho-\d+\.mp4$/.test(m.tep);
      const nutBo = tao('button', 'bk-nut gk-ok', 'Sửa nội dung bộ slide');
      nutBo.type = 'button';
      nutBo.onclick = () => {
        const ten = `${dg.deck()}::${m.boSlide}`;
        if (window.__beePages && window.__beePages.moDuAnVuaTao) window.__beePages.moDuAnVuaTao(ten);
      };
      const hBo = tao('div', 'bk-nut-hang');
      hBo.appendChild(nutBo);
      than.appendChild(nhom('Bộ slide', tao('div', 'bk-phu', chua
        ? 'Chưa dựng — đang là video đen dài ước theo lời thoại. Viết lời ở "Sửa nội dung bộ slide", rồi "Tạo video": bộ này được dựng chung với cả dự án (một lượt) và thay vào đây.'
        : 'Đã dựng. Sửa nội dung xong, "Tạo video" sẽ dựng lại bộ này (chung lượt với cả dự án) và thay video ở đây — clip đang chạy hết video thì tự dài / ngắn theo.'), hBo));
    }

    const laHinh = t.loai === 'hinh' && m.loai !== 'tieng';
    if (laHinh) {
      const coKf = Object.keys(c.kf || {}).some((k) => (c.kf[k] || []).length);
      const muot = coKf && Object.values(c.kf).every((ds) => ds.every((k, i) => i === ds.length - 1 || k.muot));
      than.appendChild(nhom('Chuyển động',
        hangThuocTinh(c, 'x', 'Vị trí X', { min: -50, max: 150, buoc: 0.5, heSo: 100, donVi: '%', tenLenh: 'Dời khối' }),
        hangThuocTinh(c, 'y', 'Vị trí Y', { min: -50, max: 150, buoc: 0.5, heSo: 100, donVi: '%', tenLenh: 'Dời khối' }),
        hangThuocTinh(c, 'co', 'Cỡ', { min: 2, max: 400, buoc: 1, heSo: 100, donVi: '%', tenLenh: 'Co giãn khối' }),
        hangThuocTinh(c, 'xoay', 'Xoay', { min: -360, max: 360, buoc: 1, heSo: 1, donVi: '°', tenLenh: 'Xoay khối' }),
        hangThuocTinh(c, 'mo', 'Độ đục', { min: 0, max: 100, buoc: 1, heSo: 100, donVi: '%', tenLenh: 'Đổi độ đục' }),
        coKf ? oTick('Chuyển động êm giữa các keyframe (vào/ra chậm)', muot, (bat) => sua((x) => {
          const kf = {};
          Object.keys(x.kf || {}).forEach((k) => { kf[k] = x.kf[k].map(({ muot: _bo, ...r }) => (bat ? { ...r, muot: true } : r)); });
          return { ...x, kf };
        }, bat ? 'Keyframe êm' : 'Keyframe thẳng')) : null));

      /* Hiệu ứng chuyển động suốt khối (GĐ2.3 — moHinh.hieuUngKhoi): chồng lên vị trí/cỡ/keyframe. */
      const hu = c.hieuUng || null;
      const LUA_HU = [['', 'Không'], ['phong', 'Phóng chậm (Ken Burns)'], ['thu', 'Thu chậm'], ['troi-trai', 'Trôi sang trái'],
        ['troi-phai', 'Trôi sang phải'], ['troi-len', 'Trôi lên'], ['troi-xuong', 'Trôi xuống']];
      than.appendChild(nhom('Hiệu ứng chuyển động',
        oChon('Kiểu', hu ? hu.kieu : '', LUA_HU, (v) => sua((x) => (v ? { ...x, hieuUng: { kieu: v, manh: (x.hieuUng && x.hieuUng.manh) || 0.5 } }
          : { ...x, hieuUng: null }), v ? 'Đặt hiệu ứng chuyển động' : 'Bỏ hiệu ứng chuyển động')),
        hu ? hang('Mạnh', { min: 10, max: 100, buoc: 5, gia: Math.round((hu.manh || 0.5) * 100), donVi: '%', ten: 'Đổi độ mạnh hiệu ứng',
          doi: (v) => sua((x) => ({ ...x, hieuUng: { ...(x.hieuUng || hu), manh: v / 100 } }), 'Đổi độ mạnh hiệu ứng') }) : null,
        hu ? tao('div', 'bk-phu', hu.kieu === 'phong' || hu.kieu === 'thu'
          ? 'Cỡ đổi dần suốt khối (tới 20 % ở mức 100 %). Hợp ảnh phủ kín khung.'
          : 'Ảnh phóng nhẹ để chừa mép rồi trôi suốt khối. Hợp ảnh phủ kín khung.') : null));

      than.appendChild(nhomMau(c.mau, (sua1, ten) => sua((x) => ({ ...x, mau: sua1 ? { ...(x.mau || {}), ...sua1 } : null }), ten)));

      const cat = c.cat || {};
      const hangCat = (k, nhan) => hang(nhan, { min: 0, max: 90, buoc: 1, gia: Math.round((cat[k] || 0) * 100), donVi: '%', ten: 'Cắt khung',
        doi: (v) => sua((x) => {
          const ct = { trai: 0, phai: 0, tren: 0, duoi: 0, ...(x.cat || {}), [k]: v / 100 };
          // Hai cạnh đối không được cắt hết hình: kẹp cạnh đang kéo.
          const doi2 = { trai: 'phai', phai: 'trai', tren: 'duoi', duoi: 'tren' }[k];
          ct[k] = Math.max(0, Math.min(ct[k], 0.95 - ct[doi2]));
          return { ...x, cat: ct };
        }, 'Cắt khung') });
      const lat = c.lat || {};
      const hangLat = tao('div', 'bk-nut-hang bk-lat');
      [['ngang', '⇋ Lật ngang'], ['doc', '⇵ Lật dọc']].forEach(([k, chu]) => {
        const b = tao('button', `bk-nut${lat[k] ? ' bat' : ''}`, chu);
        b.type = 'button';
        b.setAttribute('aria-pressed', lat[k] ? 'true' : 'false');
        b.onclick = () => sua((x) => ({ ...x, lat: { ...(x.lat || {}), [k]: !(x.lat || {})[k] } }), chu.slice(2));
        hangLat.appendChild(b);
      });
      than.appendChild(nhom('Cắt khung & lật', hangCat('trai', 'Trái'), hangCat('phai', 'Phải'), hangCat('tren', 'Trên'), hangCat('duoi', 'Dưới'), hangLat));
    }
    if (m.loai === 'tieng' || m.coTieng) {
      /* LẶP (GĐ2.2): chỉ tệp âm thanh. Tắt ⇒ đưa đoạn về trong một vòng tệp (vào = vào mod độ dài, ra ≤ hết tệp). */
      // Tệp > 10 phút không mời lặp: aloop giữ CẢ tệp đã giải mã trong bộ nhớ (~21 MB mỗi phút).
      const lap = m.loai === 'tieng' && m.ms > 0 && (m.ms <= 600000 || c.lap) ? oTick('Lặp lại — kéo mép phải dài bao nhiêu cũng được, nhạc tự lặp', !!c.lap, (bat) => sua((x) => {
        if (bat) return { ...x, lap: true };
        const vao = x.vaoMs % m.ms;
        return { ...x, lap: false, vaoMs: vao, raMs: Math.max(vao + 1, Math.min(m.ms, vao + (x.raMs - x.vaoMs))) };
      }, bat ? 'Bật lặp' : 'Tắt lặp')) : null;
      than.appendChild(nhom('Âm thanh',
        hangThuocTinh(c, 'amLuong', 'Âm lượng', { min: 0, max: 400, buoc: 1, heSo: 100, donVi: '%', tenLenh: 'Đổi âm lượng' }), lap));
    }
    if (m.tts) than.appendChild(nhomGiong(c, m));
    if (t.loai === 'tieng') than.appendChild(nhomVaiTro(t, d));

    const dai = M.doDaiMs(c);
    const maxGiay = Math.min(10, dai / 1000);
    if (laHinh) {
      /* Đợt 1 hiệu ứng: 26 kiểu chia nhóm. Quét / Hình / Nháy là mặt nạ theo CẢ KHUNG (như Premiere) — hợp nhất khi bật
         "Hoà với khối liền trước" (khối trước nằm lại bên dưới trong lúc chuyển). */
      const QUET = { nhom: 'Quét', ds: [['quet-trai', 'Quét sang trái'], ['quet-phai', 'Quét sang phải'], ['quet-len', 'Quét lên'],
        ['quet-xuong', 'Quét xuống'], ['quet-mem-trai', 'Quét mềm sang trái'], ['quet-mem-phai', 'Quét mềm sang phải'],
        ['quet-mem-len', 'Quét mềm lên'], ['quet-mem-xuong', 'Quét mềm xuống']] };
      const HINH = { nhom: 'Hình', ds: [['tron-mo', 'Tròn mở từ giữa'], ['tron-dong', 'Tròn khép từ mép'],
        ['cua-mo-doc', 'Mở từ giữa (khe dọc)'], ['cua-dong-doc', 'Khép vào giữa (khe dọc)'],
        ['cua-mo-ngang', 'Mở từ giữa (khe ngang)'], ['cua-dong-ngang', 'Khép vào giữa (khe ngang)'], ['dong-ho', 'Quét vòng kim đồng hồ']] };
      const NHAY = { nhom: 'Nháy qua màu', ds: [['nhay-den', 'Nháy đen'], ['nhay-trang', 'Nháy trắng']] };
      const LUA = [{ nhom: 'Cơ bản', ds: [['mo', 'Mờ dần'], ['truot-trai', 'Trượt từ trái'], ['truot-phai', 'Trượt từ phải'],
        ['truot-len', 'Trượt từ dưới lên'], ['truot-xuong', 'Trượt từ trên xuống'], ['phong', 'Phóng to + mờ']] },
      { nhom: 'Chuyển động', ds: [['phong-lon', 'Phóng mạnh (từ 1,6×)'], ['nay', 'Bật nảy'], ['xoay', 'Xoay vào']] }, QUET, HINH, NHAY];
      const LUA_RA = [{ nhom: 'Cơ bản', ds: [['mo', 'Mờ dần'], ['truot-trai', 'Trượt sang trái'], ['truot-phai', 'Trượt sang phải'],
        ['truot-len', 'Trượt lên trên'], ['truot-xuong', 'Trượt xuống dưới'], ['phong', 'Thu nhỏ + mờ']] },
      { nhom: 'Chuyển động', ds: [['phong-lon', 'Phình to + mờ'], ['nay', 'Thu nảy'], ['xoay', 'Xoay ra']] }, QUET, HINH, NHAY];
      const truoc = khoiLienTruoc(d, c, moc);
      than.appendChild(nhom('Chuyển cảnh',
        oChon('Vào', c.mo.kieuVao || 'mo', LUA, (v) => sua((x) => ({ ...x, mo: { ...x.mo, kieuVao: v, vaoMs: x.mo.vaoMs || Math.min(500, dai) } }), 'Đổi chuyển cảnh vào')),
        hang('Dài', { min: 0, max: maxGiay, buoc: 0.1, gia: c.mo.vaoMs / 1000, donVi: 'giây', ten: 'Đổi chuyển cảnh vào',
          doi: (v) => sua((x) => ({ ...x, mo: { ...x.mo, vaoMs: Math.round(v * 1000) } }), 'Đổi chuyển cảnh vào') }),
        oChon('Ra', c.mo.kieuRa || 'mo', LUA_RA, (v) => sua((x) => ({ ...x, mo: { ...x.mo, kieuRa: v, raMs: x.mo.raMs || Math.min(500, dai) } }), 'Đổi chuyển cảnh ra')),
        hang('Dài', { min: 0, max: maxGiay, buoc: 0.1, gia: c.mo.raMs / 1000, donVi: 'giây', ten: 'Đổi chuyển cảnh ra',
          doi: (v) => sua((x) => ({ ...x, mo: { ...x.mo, raMs: Math.round(v * 1000) } }), 'Đổi chuyển cảnh ra') }),
        truoc ? oTick(`Hoà với khối liền trước (${(dg.mediaCua(truoc.media) || {}).ten || truoc.id}) — khối trước nằm lại bên dưới trong lúc chuyển`,
          !!c.mo.noi, (bat) => sua((x) => ({ ...x, mo: { ...x.mo, noi: bat, vaoMs: x.mo.vaoMs || (bat ? Math.min(500, dai) : 0) } }),
            bat ? 'Hoà với khối trước' : 'Bỏ hoà với khối trước'))
          : null));
    } else {
      than.appendChild(nhom('Tăng / giảm dần',
        hang('Tăng dần', { min: 0, max: maxGiay, buoc: 0.1, gia: c.mo.vaoMs / 1000, donVi: 'giây', ten: 'Đổi tăng dần',
          doi: (v) => sua((x) => ({ ...x, mo: { ...x.mo, vaoMs: Math.round(v * 1000) } }), 'Đổi tăng dần') }),
        hang('Giảm dần', { min: 0, max: maxGiay, buoc: 0.1, gia: c.mo.raMs / 1000, donVi: 'giây', ten: 'Đổi giảm dần',
          doi: (v) => sua((x) => ({ ...x, mo: { ...x.mo, raMs: Math.round(v * 1000) } }), 'Đổi giảm dần') })));
    }
    if (m.loai !== 'anh') {
      than.appendChild(nhom('Thời gian',
        hang('Tốc độ', { min: 25, max: 400, buoc: 5, gia: Math.round((c.tocDo || 1) * 100), donVi: '%', ten: 'Đổi tốc độ',
          // Khối dài/ngắn theo tốc độ ⇒ giờ keyframe co giãn theo (hình động vẫn đúng chỗ trong media).
          /* Tỉ lệ MỘT lần từ bản lúc vẽ bảng (c), không cộng dồn từng nhịp kéo — cộng dồn làm tròn
             lệch dần và gộp mất keyframe trùng giờ (audit). Bảng vẽ lại sau khi nhả. */
          doi: (v) => sua((x) => ({ ...x, tocDo: v / 100, kf: M.kfTiLe(c.kf || {}, (c.tocDo || 1) / (v / 100)) }), 'Đổi tốc độ') })));
    }

    // Gắn theo slide hay đứng yên theo giây. Dự án VIDEO TRỐNG không có slide — bỏ hẳn mục này.
    if (!(D().laVideo && D().laVideo())) than.appendChild(nhom('Vị trí trên timeline', oTick(c.neo
      ? `Gắn theo slide ${c.neo.slide + 1} — dựng lại deck thì khối tự dời theo slide`
      : 'Gắn theo slide (đang đứng yên theo giây)', !!c.neo, (bat) => {
      const ms = M.batDauMs(c, moc);
      sua((x) => (bat ? M.datChoMs({ ...x, neo: { slide: 0, lechMs: 0 } }, ms, moc) : { ...x, neo: null, batDauMs: ms }),
        bat ? 'Gắn khối theo slide' : 'Bỏ gắn theo slide');
    })));

    const cuoi = tao('div', 'bk-nut-hang');
    const macDinh = tao('button', 'bk-nut', 'Về mặc định');
    macDinh.type = 'button';
    macDinh.onclick = () => sua((x) => ({
      ...x, bienDoi: { x: 0.5, y: 0.5, co: 1, xoay: 0, mo: 1 }, amLuong: 1, hieuUng: null, mau: null,
      mo: { vaoMs: 0, raMs: 0, kieuVao: 'mo', kieuRa: 'mo', noi: false },
      kf: {}, cat: { trai: 0, phai: 0, tren: 0, duoi: 0 }, lat: { ngang: false, doc: false },
    }), 'Về mặc định');
    const xoa = tao('button', 'bk-nut bk-nut-xoa', 'Xoá khối');
    xoa.type = 'button';
    xoa.onclick = () => dg.xoaKhoi([c.id]);
    cuoi.append(macDinh, xoa);
    than.appendChild(cuoi);
    than.querySelectorAll('input, button, select, textarea').forEach((x) => { if (khoa) { x.disabled = true; x.dataset.khoaGoc = '1'; } });
  }

  /** Khối liền trước trên cùng track (kết thúc đúng lúc khối này bắt đầu) — cho "hoà trộn". */
  function khoiLienTruoc(d, c, moc) {
    const a = M.batDauMs(c, moc);
    return d.khoi.find((x) => x.id !== c.id && x.track === c.track && Math.abs(M.ketThucMs(x, moc) - a) <= KHUNG_MS) || null;
  }

  /* ── giọng đọc thành khối (GĐ2.1) ─────────────────────────────────────── */
  function nhomGiong(c, m) {
    const tts = m.tts;
    const ENG = { edge: 'Edge TTS', vieneu: 'Trên máy', beeknoee: 'Beeknoee AI', elevenlabs: 'ElevenLabs' };
    const nd = tao('div', 'bk-giong-chu', tts.chu.length > 240 ? `${tts.chu.slice(0, 240)}…` : tts.chu);
    const phu = tao('div', 'bk-phu', `${ENG[tts.engine] || tts.engine}${tts.voice ? ` · ${tts.voice}` : ''}${tts.model ? ` · ${tts.model}` : ''} · tốc độ ${tts.speed}`);
    const b = tao('button', 'bk-nut', 'Sửa lời / đổi giọng…');
    b.type = 'button';
    b.onclick = () => { if (RP.giongKhoi) RP.giongKhoi.mo({ thay: c.id, tts }); };
    const h = tao('div', 'bk-nut-hang');
    h.appendChild(b);
    return nhom('Giọng đọc', nd, phu, h);
  }
  /** Track tiếng: vai trò GIỌNG ĐỌC (kích hạ nhạc, không bị hạ) — moHinh.khoangGiongNd. */
  function nhomVaiTro(t, d) {
    const dg = D();
    const ha = ((d.amGoc || {}).haNhac || {}).bat;
    return nhom('Track ' + t.id,
      oTick('Track giọng đọc — khi khối trên track này đang phát thì nhạc + âm thanh khác tự hạ xuống', t.vaiTro === 'giong',
        (bat) => dg.doiTrack(t.id, { vaiTro: bat ? 'giong' : undefined }, bat ? 'Đặt track giọng đọc' : 'Bỏ track giọng đọc')),
      t.vaiTro === 'giong' && !ha ? tao('div', 'bk-phu', (dg.laVideo && dg.laVideo())
        ? 'Hạ nhạc đang tắt — bật ở "Hạ nhạc khi có giọng" (bỏ chọn khối để thấy Cài đặt video).'
        : 'Hạ nhạc đang tắt — bật ở tab Âm thanh hoặc bấm tên track A2.') : null);
  }

  /* ── chỉnh màu (GĐ2.4 — moHinh.maTranMau; xem trước SVG + xuất colorchannelmixer cùng ma trận) ── */
  /** `doi(sua | null, tenBuoc)` — sua = { sang | tuongPhan | baoHoa }, null = về gốc. */
  function nhomMau(mau, doi, tieuDe) {
    const m = { sang: 1, tuongPhan: 1, baoHoa: 1, ...(mau || {}) };
    const dong = (nhan, k, min, max) => hang(nhan, { min, max, buoc: 1, gia: Math.round(m[k] * 100), donVi: '%', ten: 'Chỉnh màu',
      doi: (v) => doi({ [k]: v / 100 }, 'Chỉnh màu') });
    const veGoc = tao('button', 'bk-nut', 'Màu gốc');
    veGoc.type = 'button';
    veGoc.disabled = !mau;
    veGoc.onclick = () => doi(null, 'Bỏ chỉnh màu');
    const h = tao('div', 'bk-nut-hang');
    h.appendChild(veGoc);
    return nhom(tieuDe || 'Màu', dong('Độ sáng', 'sang', 30, 200), dong('Tương phản', 'tuongPhan', 30, 200), dong('Bão hoà', 'baoHoa', 0, 300), h);
  }

  /* ── chữ tiêu đề ──────────────────────────────────────────────────────── */
  function nhomChu(m) {
    const dg = D();
    const ct = RP.chuTieuDe;
    let chu = { ...(ct ? ct.CHU_MAC_DINH() : {}), ...m.chu };
    let hen = 0;
    const deckLuc = dg.deck();
    const doi = (sua, ngay) => {
      chu = { ...chu, ...sua };
      clearTimeout(hen);
      // Gõ chữ: gom lại 350 ms rồi mới vẽ PNG (mỗi lần vẽ là một tệp + một bước hoàn tác).
      // Ghi vào ĐÚNG deck lúc gõ — chuyển deck trong 350 ms thì bỏ (audit: PNG sang nhầm deck).
      hen = setTimeout(() => dg.suaChu(m.id, chu, deckLuc), ngay ? 0 : 350);
    };
    const nd = tao('textarea', 'bk-chu-nd');
    nd.rows = 2;
    nd.value = chu.noiDung;
    nd.maxLength = 1000;
    nd.setAttribute('aria-label', 'Nội dung chữ');
    nd.addEventListener('input', () => { if (nd.value.trim()) doi({ noiDung: nd.value }); });
    // Phông `an` (Georgia / Impact — vẽ sai dấu tiếng Việt) chỉ hiện khi chính khối này đang dùng.
    const phong = oChon('Phông', chu.phong, (ct ? ct.PHONG : []).filter((p) => !p.an || p.ten === chu.phong)
      .map((p) => [p.ten, p.an ? `${p.ten} (thiếu dấu tiếng Việt)` : p.ten]), (v) => doi({ phong: v }, true));
    const co = hang('Cỡ chữ', { min: 24, max: 400, buoc: 2, gia: chu.co, donVi: 'px', ten: 'Sửa chữ tiêu đề', doi: (v) => doi({ co: v }) });
    const mau = (nhan, k, macDinh) => {
      const h = tao('label', 'bk-hang bk-hang-chon');
      h.appendChild(tao('span', 'bk-nhan', nhan));
      const o = tao('input', 'bk-mau');
      o.type = 'color';
      o.value = (chu[k] || macDinh).slice(0, 7);
      o.addEventListener('change', () => doi({ [k]: k === 'nen' ? `${o.value}b3` : o.value }, true));
      h.appendChild(o);
      return h;
    };
    const vien = hang('Viền', { min: 0, max: 20, buoc: 1, gia: chu.vien, donVi: 'px', ten: 'Sửa chữ tiêu đề', doi: (v) => doi({ vien: v }) });
    const canh = oChon('Căn', chu.canh, [['trai', 'Trái'], ['giua', 'Giữa'], ['phai', 'Phải']], (v) => doi({ canh: v }, true));
    const kieu = tao('div', 'bk-nut-hang bk-lat');
    [['dam', 'Đậm'], ['nghieng', 'Nghiêng'], ['bong', 'Bóng đổ']].forEach(([k, nhan]) => {
      const b = tao('button', `bk-nut${chu[k] ? ' bat' : ''}`, nhan);
      b.type = 'button';
      b.setAttribute('aria-pressed', chu[k] ? 'true' : 'false');
      b.onclick = () => { b.classList.toggle('bat'); doi({ [k]: !chu[k] }, true); };
      kieu.appendChild(b);
    });
    const coNen = oTick('Nền sau chữ', !!chu.nen, (bat) => doi({ nen: bat ? '#000000b3' : '' }, true));
    return nhom('Chữ tiêu đề', nd, phong, co, kieu, canh, mau('Màu chữ', 'mau', '#ffffff'), vien, mau('Màu viền', 'mauVien', '#000000'),
      coNen, chu.nen ? mau('Màu nền', 'nen', '#000000') : null);
  }

  /* ── không chọn gì: cài đặt bản dựng ─────────────────────────────────── */
  function veCaiDat() {
    const dg = D();
    const d = dg.duAn();
    const x = { ...M.xuatMacDinh(), ...(d.xuat || {}) };
    const K = dg.khungXuat();
    // Dự án VIDEO TRỐNG (src/dung/duAnVideo.js): không có video slide, không có giọng đọc.
    const laVideo = !!(dg.laVideo && dg.laVideo());
    /* Khung + nền xuất ở lại đây ("Cài đặt bản dựng", như Sequence Settings — chốt Q3 16/10/2026). Dời đi:
       "Tự hạ nhạc" → tab Âm thanh (và bảng A2); phụ đề → bấm track C1 (render/kieu-phu-de.js);
       "+ Chữ" → thanh track của timeline. */
    const g = nhom(laVideo ? 'Cài đặt video' : 'Cài đặt bản dựng',
      oChon('Khung', x.khung, [['goc', laVideo ? 'Theo khổ dự án' : 'Theo video slide'], ['16:9', '16:9 ngang (YouTube)'], ['9:16', '9:16 dọc (Shorts, TikTok)'],
        ['1:1', '1:1 vuông'], ['4:5', '4:5 (Instagram)']], (v) => dg.doiXuat({ khung: v }, 'Đổi khung xuất')),
      x.khung === 'goc' ? null : oChon('Nền', x.nen, [['mo', 'Video nhoè'], ['den', 'Đen']], (v) => dg.doiXuat({ nen: v }, 'Đổi nền khung xuất')),
      K ? tao('div', 'bk-phu', `Bản xuất: ${K.rong}×${K.cao}`) : null);
    than.appendChild(g);
    // Màu CẢ VIDEO (lớp hiệu chỉnh — xuat.mau): áp lên hình đã ghép, dưới phụ đề.
    // Gộp vào màu ĐANG CÓ lúc ghi (không phải lúc vẽ bảng) — gõ ô này rồi Tab sang ô kia không làm mất số vừa gõ.
    than.appendChild(nhomMau(x.mau, (sua1, ten) => dg.doiXuat({ mau: sua1 ? { ...(((dg.duAn() || {}).xuat || {}).mau || {}), ...sua1 } : null }, ten), 'Màu cả video'));
    /* Lối vào bảng phụ đề bằng nút thật (tên track C1 là div). DECK: nút nằm dưới "Lời thoại slide này" ở tab Nội dung
       (bang-sua.js — chốt 17/10/2026). Ở đây chỉ còn cho DỰ ÁN VIDEO: không có tab Nội dung. */
    if (laVideo) {
      const nutPd = tao('button', 'bk-nut', !d.phuDe ? 'Tạo phụ đề tự động…' : 'Chỉnh phụ đề…');
      nutPd.type = 'button';
      nutPd.onclick = () => dg.datChon([], 'phude');
      const hPd = tao('div', 'bk-nut-hang');
      hPd.appendChild(nutPd);
      than.appendChild(nhom('Phụ đề', tao('div', 'bk-phu', !d.phuDe
        ? 'Tạo phụ đề tự động từ tiếng trên timeline — hoặc bấm tên track C1 (Phụ đề).'
        : 'Bật / tắt, đổi kiểu chữ — hoặc bấm tên track C1 (Phụ đề) / một câu phụ đề.'), hPd));
    }
    /* THÊM BỘ SLIDE — dự án video: bộ ĐẦU vào chính dự án (GĐ3.5); dự án đã có slide: bộ PHỤ thành một clip (GĐ3.7). */
    if (RP.themSlide && !dg.chiDoc()) {
      const nutS = tao('button', 'bk-nut', laVideo ? 'Thêm bộ slide…' : 'Thêm một bộ slide nữa…');
      nutS.type = 'button';
      nutS.onclick = () => RP.themSlide.mo();
      const hS = tao('div', 'bk-nut-hang');
      hS.appendChild(nutS);
      than.appendChild(nhom('Bộ slide', tao('div', 'bk-phu', laVideo
        ? 'Chèn một bộ slide (mẫu) vào video — có giọng đọc, nhạc, phụ đề riêng; khối đang có giữ nguyên chỗ.'
        : 'Thêm một bộ slide khác (mẫu) — thành một clip trên timeline; "Tạo video" dựng chung cả dự án, một lượt.'), hS));
    }
    /* Dự án video: không có A2 / tab Âm thanh ⇒ "Hạ nhạc khi có giọng" (theo track giọng đọc) nằm ở đây. */
    if (laVideo) {
      const ha = { bat: false, mucDb: 12, ...((d.amGoc || {}).haNhac || {}) };
      than.appendChild(nhom('Hạ nhạc khi có giọng',
        oTick('Tự hạ nhạc + âm thanh khác khi khối trên track Giọng đọc đang phát', ha.bat,
          (bat) => dg.doiAmGoc({ haNhac: { ...ha, bat } }, bat ? 'Bật hạ nhạc' : 'Tắt hạ nhạc')),
        ha.bat ? hang('Hạ', { min: 3, max: 30, buoc: 1, gia: ha.mucDb, donVi: 'dB', ten: 'Đổi mức hạ nhạc',
          doi: (v) => dg.doiAmGoc({ haNhac: { ...ha, bat: true, mucDb: Math.round(v) } }, 'Đổi mức hạ nhạc') }) : null));
    }
    // V1 đã sửa (cắt / bỏ / đổi chỗ slide trên timeline): báo + nút khôi phục nguyên video.
    const v1 = dg.v1 && dg.v1();
    if (v1) {
      const kp = tao('button', 'bk-nut', 'Khôi phục V1 nguyên video');
      kp.type = 'button';
      kp.onclick = () => dg.datV1(null, 'Khôi phục V1');
      const hv = tao('div', 'bk-nut-hang');
      hv.appendChild(kp);
      than.appendChild(nhom('Video slide (V1)', tao('div', 'bk-phu',
        `Đã sửa: ${v1.doan.length} đoạn — cắt / bỏ / đổi chỗ trên timeline (dao cạo C, Delete, kéo khối).`), hv));
    }
    /* KHỐI SLIDE (GĐ3.3): video slide + giọng / nhạc / tiếng chuyển của deck + phụ đề là MỘT khối trên timeline —
       dời được (chừa chỗ cho intro trước slide). Khối gắn slide đi cùng; khối đứng yên theo giây thì ở lại. */
    const sl = dg.slide && dg.slide();
    if (sl && !laVideo) {
      const bdS = sl.batDauMs || 0;
      const veKhong = tao('button', 'bk-nut', 'Về giây 0');
      veKhong.type = 'button';
      veKhong.disabled = !bdS;
      veKhong.onclick = () => dg.datBatDauSlide(0, 'Khối slide về giây 0');
      const hS = tao('div', 'bk-nut-hang');
      hS.appendChild(veKhong);
      than.appendChild(nhom('Khối slide',
        hang('Bắt đầu', { min: 0, max: 600, buoc: 0.1, gia: Math.round(bdS / 100) / 10, donVi: 'giây', ten: 'Dời khối slide',
          doi: (v) => dg.datBatDauSlide(Math.round(v * 1000), 'Dời khối slide') }),
        tao('div', 'bk-phu', 'Alt + kéo một khối slide trên V1 cũng dời cả khối. Khối gắn slide đi cùng; khối đứng yên theo giây ở lại.'), hS));
    }
    if (dg.chiDoc()) than.querySelectorAll('input, button, select').forEach((e) => { e.disabled = true; });
  }

  function veGoc(loai) {
    const dg = D();
    const ag = dg.duAn().amGoc || M.amGocMacDinh();
    const dau = tao('div', 'bk-dau');
    dau.appendChild(tao('b', 'bk-ten', loai === 'giong' ? 'A1 · Giọng đọc' : 'A2 · A3 · Nhạc nền + tiếng chuyển'));
    dau.appendChild(tao('span', 'bk-phu', dg.tachTieng()
      ? 'Chỉ đổi trong BẢN DỰNG — video slide gốc giữ nguyên.'
      : 'Video slide này dựng từ bản cũ, không còn tiếng tách riêng: âm lượng áp cho cả tiếng của video.'));
    than.appendChild(dau);
    if (loai !== 'giong' && !dg.tachTieng()) {
      than.appendChild(tao('div', 'bk-trong', 'Video slide này không còn tiếng tách riêng — nhạc và tiếng chuyển đã trộn vào A1. Chỉnh âm lượng ở A1, hoặc bấm "Tạo video" để dựng lại có tiếng tách.'));
      return;
    }
    const k = loai === 'giong' ? 'giong' : 'deck';
    const kTat = loai === 'giong' ? 'tatGiong' : 'tatDeck';
    than.appendChild(nhom('Âm thanh',
      hang('Âm lượng', { min: 0, max: 400, buoc: 1, gia: Math.round(ag[k] * 100), donVi: '%', ten: 'Đổi âm lượng gốc',
        doi: (v) => dg.doiAmGoc({ [k]: v / 100 }, 'Đổi âm lượng gốc') })));
    than.appendChild(oTick('Tắt hẳn lớp tiếng này trong bản dựng', !!ag[kTat],
      (bat) => dg.doiAmGoc({ [kTat]: bat }, bat ? 'Tắt tiếng gốc' : 'Bật tiếng gốc')));
    if (loai !== 'giong') {
      const ha = { bat: false, mucDb: 12, ...(ag.haNhac || {}) };
      than.appendChild(nhom('Hạ nhạc khi có giọng',
        oTick('Tự hạ nhạc + âm thanh thêm khi giọng đọc đang nói', ha.bat, (bat) => dg.doiAmGoc({ haNhac: { ...ha, bat } }, bat ? 'Bật hạ nhạc' : 'Tắt hạ nhạc')),
        ha.bat ? hang('Hạ', { min: 3, max: 30, buoc: 1, gia: ha.mucDb, donVi: 'dB', ten: 'Đổi mức hạ nhạc',
          doi: (v) => dg.doiAmGoc({ haNhac: { ...ha, bat: true, mucDb: Math.round(v) } }, 'Đổi mức hạ nhạc') }) : null));
    }
  }

  /** Đầu phát đổi (chạy / tua / bước khung): cập nhật số + ◆ của các hàng keyframe. */
  let henDau = 0;
  function dauPhat() {
    if (!dangMo || !hangSong.length || henDau) return;
    henDau = requestAnimationFrame(() => { henDau = 0; hangSong.forEach((f) => { try { f(); } catch { /* hàng đã gỡ */ } }); });
  }

  function khoi() {
    if (!D()) return;
    // Bảng sửa dựng hàng tab lúc DOMContentLoaded — chờ nó xong rồi mới gắn.
    if (!gan()) { setTimeout(khoi, 300); return; }
    let henVe = 0;
    D().nghe((loai) => {
      /* Người dùng vừa CHỌN một khối (hay track gốc / C1): tự mở Thuộc tính — như Premiere.
         TRỪ khi bảng đang ở Thư viện và khối vừa được THẢ từ đó: người ta đang kéo thả liên tục,
         nhảy tab là mất chỗ (chốt 16/10/2026). Chọn khối slide (V1) của deck ⇒ tab Nội dung đúng slide. */
      if (loai === 'chon' && D().chonGoc() === 'v1' && !(D().laVideo && D().laVideo())) {
        if (RP.bangSua && RP.bangSua.moTab) RP.bangSua.moTab('mau');
        return;
      }
      if (loai === 'chon' && (D().chon().length === 1 || D().chonGoc())) {
        if (RP.tabPhai.dangMo('thuvien') && D().vuaThemTuThuVien && D().vuaThemTuThuVien()) {
          if (dangMo) ve();
          return;
        }
        mo(true);
        return;
      }
      // Tiến độ proxy / trạng thái lưu: không đổi gì trong bảng — dựng lại là đóng ô chọn đang mở.
      if (loai === 'cache' || loai === 'loi') return;
      if (henVe) return;
      henVe = requestAnimationFrame(() => { henVe = 0; ve(); });
    });
  }
  // `ve`: vẽ lại khi trạng thái NGOÀI dự án đổi (đang tạo phụ đề tự động — du-an-video.js).
  RP.bangKhoi = { dauPhat, mo: () => mo(true), ve: () => { if (dangMo) ve(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', khoi);
  else setTimeout(khoi, 0);
})();
