'use strict';
/**
 * THÊM BỘ SLIDE VÀO DỰ ÁN VIDEO (GĐ3.5 lộ trình gộp, 16/10/2026) — hộp chọn mẫu.
 *
 * Dự án video trống (chỉ timeline) nhận một bộ slide: mẫu được chép vào CHÍNH thư mục dự án (main/duAn.js
 * #themSlideVaoDuAnVideo) — dự án thành deck, mọi khối đang có trên timeline ở nguyên chỗ, KHỐI SLIDE đặt ở giây
 * đã chọn. Sửa lời / chữ ở tab Nội dung rồi bấm "Tạo video": slide được dựng (giọng đọc, nhạc, phụ đề) rồi ghép
 * với timeline như mọi deck.
 *
 * Chỉ mẫu CÙNG KHỔ với dự án (dọc / ngang) — mẫu khác khổ thì slide nằm giữa khung, hai bên nhoè.
 */
(() => {
  const RP = window.__renderPage;
  const api = window.beeknoee;
  let hop = null;
  let dangLam = false;

  const tao = (tag, lop, chu) => {
    const e = document.createElement(tag);
    if (lop) e.className = lop;
    if (chu != null) e.textContent = chu;
    return e;
  };

  function dong() {
    if (!hop || dangLam) return;
    hop.remove();
    hop = null;
    document.removeEventListener('keydown', phim, true);
  }
  function phim(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dong(); } }

  /**
   * Thêm bộ slide vào dự án video ĐANG MỞ — đường chung của hộp chọn mẫu và của agent (MCP studio_add_slides,
   * mcp/index.js#themSlide): xả lượt lưu đang chờ của timeline → main chép mẫu → nạp lại danh sách, khung deck,
   * kho dựng (dự án đổi LOẠI video → deck mà tên giữ nguyên).
   * @returns {Promise<{ ok: boolean, loi?: string, name?: string, soTep?: number, boPhuDe?: boolean }>}
   */
  async function lam({ mauId, batDauMs } = {}) {
    const dg = RP.dung;
    if (!dg || !dg.laVideo || !dg.laVideo()) return { ok: false, loi: 'Dự án đang mở không phải dự án video.' };
    if (dg.chiDoc && dg.chiDoc()) return { ok: false, loi: 'Dự án dựng chỉ đọc (bản app mới hơn tạo).' };
    const ten = dg.deck();
    /* Lưu NỐT + KHOÁ kho dựng (main đọc rồi viết lại du-an.json): sửa tiếp trong lúc chờ — nhất là đường agent, không
       có hộp che — mà lượt lưu hẹn giờ chạy sau là mô hình CŨ (không khối slide) đè bản main vừa ghi (rà GĐ3). */
    const luu = dg.dongBang ? await dg.dongBang() : (dg.luuNgay ? await dg.luuNgay() : null);
    if (luu && luu.ok === false) {
      if (dg.nap) await dg.nap();
      return { ok: false, loi: `Chưa lưu được timeline: ${(luu.loi || []).join(' · ')}` };
    }
    let r;
    try {
      r = await api.projects.themSlide({ ten, mauId, batDauMs: Math.max(0, Math.round(Number(batDauMs) || 0)) });
    } catch (e) { r = { ok: false, loi: e.message }; }
    if (!r || !r.ok) {
      if (dg.nap) await dg.nap();   // kho đã khoá: mở lại từ đĩa (thay đổi đã lưu ở trên)
      return r || { ok: false, loi: 'Không thêm được bộ slide.' };
    }
    if (RP.lamMoiDanhSach) { try { await RP.lamMoiDanhSach(); } catch { /* bỏ */ } }
    if (RP.sanKhau && RP.sanKhau.lamMoi) { try { await RP.sanKhau.lamMoi(); } catch { /* bỏ */ } }
    if (RP.dung && RP.dung.nap) await RP.dung.nap();
    return r;
  }

  /**
   * BỘ SLIDE PHỤ (GĐ3.7): dự án ĐÃ có slide nhận thêm một bộ — deck đầy đủ ở `bo-slide/<id>/` (main/duAn.js#taoBoSlidePhu),
   * lên timeline thành MỘT clip (dung-kho.themBoSlide). Đường chung của hộp chọn mẫu và agent (MCP studio_add_slides).
   * @returns {Promise<{ ok: boolean, loi?: string, id?: string, ten?: string, khoi?: string, media?: object }>}
   */
  async function lamPhu({ mauId, batDauMs } = {}) {
    const dg = RP.dung;
    if (!dg || !dg.duAn || !dg.duAn() || dg.chiDoc() || (dg.laVideo && dg.laVideo())) {
      return { ok: false, loi: 'Dự án đang mở không nhận thêm bộ slide (chỉ đọc, hoặc là dự án video chưa có bộ đầu).' };
    }
    const ten = dg.deck();
    let r;
    try { r = await api.projects.taoBoSlide({ ten, mauId }); } catch (e) { r = { ok: false, loi: e.message }; }
    if (!r || !r.ok) return r || { ok: false, loi: 'Không tạo được bộ slide.' };
    if (dg.deck() !== ten) return { ok: false, loi: `Đã chuyển dự án trong lúc tạo — bộ slide nằm trong "${ten}" nhưng chưa lên timeline.` };
    const k = dg.themBoSlide(r.media, batDauMs);
    if (!k.ok) return { ok: false, loi: (k.loi || []).join(' · ') || 'Không đặt được bộ slide lên timeline.' };
    return { ok: true, id: r.id, ten: r.ten, khoi: k.khoi, media: r.media };
  }

  async function mo() {
    const dg = RP.dung;
    if (!dg || !dg.duAn || !dg.duAn() || dg.chiDoc()) return;
    if (hop) dong();
    const d = dg.duAn();
    // Dự án video ⇒ bộ ĐẦU vào chính dự án (lam); dự án đã có slide ⇒ bộ PHỤ thành clip (lamPhu).
    const phu = !(dg.laVideo && dg.laVideo());
    const pm = RP.projectMap && RP.projectMap.get && RP.projectMap.get(dg.deck());
    const khung = phu && pm && pm.khung ? pm.khung : (d && d.khung && d.khung.rong > d.khung.cao ? 'ngang' : 'doc');

    hop = tao('div', 'bs-hop ts-hop');
    const nen = tao('div', 'bs-hop-nen');
    nen.onclick = dong;
    const kh = tao('div', 'bs-hop-khung');
    kh.setAttribute('role', 'dialog');
    kh.setAttribute('aria-modal', 'true');
    kh.setAttribute('aria-label', 'Thêm bộ slide');
    const dau = tao('div', 'bs-hop-dau');
    dau.appendChild(tao('strong', null, phu ? 'Thêm một bộ slide nữa' : 'Thêm bộ slide vào video'));
    const x = tao('button', 'bs-hop-x', '×');
    x.type = 'button';
    x.style.marginLeft = 'auto';
    x.setAttribute('aria-label', 'Đóng');
    x.onclick = dong;
    dau.appendChild(x);
    const than = tao('div', 'bs-hop-than ts-than');
    than.appendChild(tao('div', 'gk-phu', phu
      ? `Chọn một mẫu ${khung === 'ngang' ? 'ngang 16:9' : 'dọc 9:16'}. Bộ slide mới thành một CLIP trên timeline (track hình còn trống ở giây đã chọn) — kéo / cắt / chuyển cảnh như clip. Viết lời: chọn clip → "Sửa nội dung bộ slide". "Tạo video" dựng chung cả dự án, một lượt.`
      : `Chọn một mẫu ${khung === 'ngang' ? 'ngang 16:9' : 'dọc 9:16'}. Slide thành một KHỐI trên timeline (V1) — khối đang có giữ nguyên chỗ. Sửa lời ở tab Nội dung rồi bấm "Tạo video" để dựng giọng đọc + phụ đề cho slide.`));
    const luoi = tao('div', 'ts-luoi');
    luoi.appendChild(tao('div', 'gk-phu', 'Đang đọc danh sách mẫu…'));
    than.appendChild(luoi);
    const hang = tao('label', 'gk-hang');
    hang.appendChild(tao('span', 'gk-nhan', 'Bắt đầu ở'));
    const oBd = tao('input', 'gk-chon gk-toc');
    oBd.type = 'text';
    oBd.inputMode = 'decimal';
    oBd.value = String(Math.round((RP.timeline && RP.timeline.tDauMs ? RP.timeline.tDauMs() : 0) / 100) / 10);
    hang.appendChild(oBd);
    hang.appendChild(tao('span', 'gk-phu', 'giây (đầu phát)'));
    than.appendChild(hang);
    if (!phu && d && d.phuDe) than.appendChild(tao('div', 'gk-bao loi', 'Phụ đề tự động của dự án sẽ bị bỏ — "Tạo video" sinh phụ đề cho slide; phần ngoài slide bấm "Tạo phụ đề tự động" lại sau.'));
    const bao = tao('div', 'gk-bao');
    bao.hidden = true;
    than.appendChild(bao);
    const cuoi = tao('div', 'gk-cuoi');
    const huy = tao('button', 'bk-nut', 'Huỷ');
    huy.type = 'button';
    huy.onclick = dong;
    const ok = tao('button', 'bk-nut gk-ok', 'Thêm bộ slide');
    ok.type = 'button';
    ok.disabled = true;
    cuoi.append(huy, ok);
    than.appendChild(cuoi);
    kh.append(dau, than);
    hop.append(nen, kh);
    document.body.appendChild(hop);
    document.addEventListener('keydown', phim, true);

    let chon = null;
    let ds = [];
    try { ds = ((await api.templates.list()) || {}).templates || []; } catch { ds = []; }
    if (!hop) return;
    // Mẫu dựng video (timeline có ô) không phải bộ slide — chỉ dùng để tạo dự án mới.
    ds = ds.filter((t) => (t.khung || 'doc') === khung && t.loai !== 'dung');
    luoi.textContent = '';
    if (!ds.length) luoi.appendChild(tao('div', 'gk-phu', 'Không có mẫu cùng khổ.'));
    ds.forEach((t) => {
      const o = tao('button', 'ts-o');
      o.type = 'button';
      o.title = t.moTa || t.ten;
      if (t.anh) { const im = tao('img'); im.src = t.anh; im.alt = ''; im.loading = 'lazy'; o.appendChild(im); }
      o.appendChild(tao('span', 'ts-ten', t.ten || t.id));
      o.onclick = () => {
        chon = t;
        luoi.querySelectorAll('.ts-o.chon').forEach((e) => e.classList.remove('chon'));
        o.classList.add('chon');
        ok.disabled = false;
      };
      luoi.appendChild(o);
    });

    ok.onclick = async () => {
      if (!chon || dangLam) return;
      const g = Number(String(oBd.value).replace(',', '.'));
      dangLam = true;
      [ok, huy, x, oBd].forEach((e) => { e.disabled = true; });
      bao.hidden = false;
      bao.className = 'gk-bao';
      bao.textContent = 'Đang chép mẫu vào dự án…';
      // Hộp ở lại (khoá) tới khi nạp lại xong — đóng sớm thì người dùng bấm vào khung đang đổi loại dự án.
      const r = await (phu ? lamPhu : lam)({ mauId: chon.id, batDauMs: Number.isFinite(g) ? g * 1000 : 0 }).finally(() => { dangLam = false; });
      if (!r.ok) {
        [ok, huy, x, oBd].forEach((e) => { e.disabled = false; });
        bao.className = 'gk-bao loi';
        bao.textContent = r.loi || 'Không thêm được bộ slide.';
        return;
      }
      dong();
      if (RP.setStatus) {
        RP.setStatus(phu
          ? `Đã thêm bộ slide "${chon.ten || chon.id}" thành một clip — chọn clip → "Sửa nội dung bộ slide" để viết lời; "Tạo video" dựng chung.`
          : `Đã thêm bộ slide "${chon.ten || chon.id}" — sửa lời ở tab Nội dung rồi bấm "Tạo video".`
          + (r.banXuatCu ? ` Bản xuất cũ giữ ở output/${r.banXuatCu}.` : ''), 'good');
      }
    };
  }

  RP.themSlide = { mo, lam, lamPhu };
})();
