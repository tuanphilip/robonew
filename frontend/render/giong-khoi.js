'use strict';
/**
 * GIỌNG ĐỌC THÀNH KHỐI (GĐ2.1 lộ trình gộp slide + timeline, 16/10/2026): hộp "+ Giọng" — gõ chữ, chọn
 * giọng ⇒ tệp giọng (main `dung:taoGiong` → Python `tts.chu`, cùng nhà cung cấp / cache / chuẩn hoá số
 * với deck) ⇒ khối trên track tiếng "Giọng đọc" (vai trò 'giong': kích hạ nhạc, chính nó không bị hạ).
 *
 * Danh sách giọng KHÔNG khai báo lại: chép từ chính các ô của bộ giọng (tab Âm thanh) lúc mở hộp —
 * #edgeVoice, #vnVoice, #beeModel + #beeVoice, danh sách ElevenLabs (#elevenVoicePop). Mặc định = engine
 * và giọng đang chọn cho deck, tốc độ = ô #renderSpeed ⇒ giọng khối nghe như giọng của slide.
 *
 * Sửa lại (bảng Thuộc tính của khối có `media.tts`): mở hộp với chữ + giọng cũ, "Tạo lại giọng" đổi
 * tệp của CHÍNH khối đó (giữ chỗ, âm lượng, tăng/giảm dần) — RP.dung.taoGiong({ thay }).
 */
(() => {
  const RP = window.__renderPage;
  const D = () => RP.dung;
  const ENGINE = [['edge', 'Edge TTS (miễn phí)'], ['vieneu', 'Trên máy (miễn phí)'], ['beeknoee', 'Beeknoee AI'], ['elevenlabs', 'ElevenLabs']];
  // state.engine của bộ giọng dùng 'edgetts' (tên pane) — main / Python dùng 'edge'.
  const tuState = (e) => (e === 'edgetts' ? 'edge' : e);
  const EDGE_GOI_Y = ['vi-VN-HoaiMyNeural', 'vi-VN-NamMinhNeural'];
  let hop = null;
  let dangTao = false;

  const tao = (tag, lop, chu) => {
    const e = document.createElement(tag);
    if (lop) e.className = lop;
    if (chu != null) e.textContent = chu;
    return e;
  };
  function hangO(nhan, o) {
    const h = tao('label', 'gk-hang');
    h.appendChild(tao('span', 'gk-nhan', nhan));
    h.appendChild(o);
    return h;
  }
  /** Chép các <option> của một ô chọn có sẵn (giữ value + chữ). */
  function chepChon(nguon, chon) {
    const s = tao('select', 'gk-chon');
    const src = document.querySelector(nguon);
    [...((src && src.options) || [])].forEach((op) => {
      if (!op.value) return;
      const o = tao('option', null, op.textContent);
      o.value = op.value;
      s.appendChild(o);
    });
    const v = chon != null ? chon : (src && src.value) || '';
    if (v && ![...s.options].some((o) => o.value === v)) {
      const o = tao('option', null, v);
      o.value = v;
      s.appendChild(o);
    }
    if (v) s.value = v;
    return s;
  }
  function chonEleven(chon) {
    const s = tao('select', 'gk-chon');
    const cur = chon != null ? chon : (document.querySelector('#elevenVoice') || {}).value || '';
    document.querySelectorAll('#elevenVoicePop .voice-row').forEach((r) => {
      if (!r.dataset.id) return;
      const o = tao('option', null, r.dataset.ten || r.dataset.id);
      o.value = r.dataset.id;
      s.appendChild(o);
    });
    if (cur && ![...s.options].some((o) => o.value === cur)) {
      const o = tao('option', null, cur);
      o.value = cur;
      s.appendChild(o);
    }
    if (!s.options.length) {
      const o = tao('option', null, '— chọn giọng ElevenLabs ở tab Âm thanh trước —');
      o.value = '';
      s.appendChild(o);
    }
    s.value = cur;
    return s;
  }

  function dong() {
    if (!hop || dangTao) return;
    hop.remove();
    hop = null;
    document.removeEventListener('keydown', phim, true);
  }
  function phim(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dong(); }
  }

  /**
   * @param {{ ms?: number, thay?: string, tts?: object }} [o]  `thay` + `tts`: sửa khối giọng đang có.
   */
  function mo(o = {}) {
    if (dangTao) return;   // đang tạo giọng: hộp cũ còn chờ kết quả — không mở hộp thứ hai (rà GĐ2)
    const dg = D();
    if (!dg || !dg.duAn() || dg.chiDoc()) {
      if (RP.setStatus) RP.setStatus('Mở một dự án (không ở chế độ chỉ đọc) để thêm giọng đọc.', 'warn');
      return;
    }
    if (hop) dong();
    const cu = o.tts || null;
    const st = RP.state || {};
    let engine = tuState((cu && cu.engine) || st.engine || 'edge');
    if (!ENGINE.some(([k]) => k === engine)) engine = 'edge';
    const msDat = Math.max(0, Math.round(o.ms || 0));

    hop = tao('div', 'bs-hop gk-hop');
    hop.id = 'gkHop';
    const nen = tao('div', 'bs-hop-nen');
    nen.onclick = dong;
    const khung = tao('div', 'bs-hop-khung');
    khung.setAttribute('role', 'dialog');
    khung.setAttribute('aria-modal', 'true');
    khung.setAttribute('aria-label', o.thay ? 'Sửa giọng đọc' : 'Thêm giọng đọc');
    const dau = tao('div', 'bs-hop-dau');
    const ic = tao('span', 'btn-icon');
    ic.dataset.icon = 'mic';
    dau.append(ic, tao('strong', null, o.thay ? 'Sửa giọng đọc' : 'Thêm giọng đọc'));
    const x = tao('button', 'bs-hop-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Đóng');
    x.style.marginLeft = 'auto';
    x.onclick = dong;
    dau.appendChild(x);
    const than = tao('div', 'bs-hop-than gk-than');

    const chu = tao('textarea', 'gk-chu');
    chu.rows = 5;
    chu.maxLength = 5000;
    chu.placeholder = 'Gõ lời cần đọc… (số, ngày tháng tự đọc thành chữ như giọng của slide)';
    chu.value = (cu && cu.chu) || '';
    const dem = tao('div', 'gk-dem');
    const veDem = () => { dem.textContent = `${chu.value.length.toLocaleString('vi-VN')} / 5.000 ký tự`; };
    chu.addEventListener('input', veDem);
    veDem();

    const chonEngine = tao('select', 'gk-chon');
    ENGINE.forEach(([k, ten]) => { const op = tao('option', null, ten); op.value = k; chonEngine.appendChild(op); });
    chonEngine.value = engine;
    const oGiong = tao('div', 'gk-giong');
    let docGiong = () => ({ voice: '', model: '' });
    const veGiong = () => {
      const e = chonEngine.value;
      const giuCu = cu && tuState(cu.engine) === e;
      oGiong.textContent = '';
      if (e === 'edge') {
        const i = tao('input', 'gk-chon');
        i.type = 'text';
        i.spellcheck = false;
        i.value = (giuCu && cu.voice) || (document.querySelector('#edgeVoice') || {}).value || EDGE_GOI_Y[0];
        const dl = tao('datalist');
        dl.id = 'gkEdgeGoiY';
        EDGE_GOI_Y.forEach((v) => { const op = tao('option'); op.value = v; dl.appendChild(op); });
        i.setAttribute('list', dl.id);
        oGiong.append(hangO('Giọng', i), dl);
        docGiong = () => ({ voice: i.value.trim(), model: '' });
      } else if (e === 'vieneu') {
        const s = chepChon('#vnVoice', giuCu ? cu.voice : null);
        oGiong.appendChild(hangO('Giọng', s));
        docGiong = () => ({ voice: s.value, model: '' });
      } else if (e === 'beeknoee') {
        const m = chepChon('#beeModel', giuCu ? cu.model : null);
        const s = chepChon('#beeVoice', giuCu ? cu.voice : null);
        oGiong.append(hangO('Model', m), hangO('Giọng', s));
        docGiong = () => ({ voice: s.value, model: m.value || (RP.beeModelMacDinh ? RP.beeModelMacDinh() : '') });
      } else {
        const s = chonEleven(giuCu ? cu.voice : null);
        oGiong.appendChild(hangO('Giọng', s));
        docGiong = () => ({ voice: s.value, model: '' });
      }
    };
    chonEngine.addEventListener('change', veGiong);
    veGiong();

    const toc = tao('input', 'gk-chon gk-toc');
    toc.type = 'text';
    toc.inputMode = 'decimal';
    toc.value = String((cu && cu.speed) || (document.querySelector('#renderSpeed') || {}).value || '1');
    const ghiChu = tao('div', 'gk-phu', engine === 'beeknoee' || engine === 'elevenlabs'
      ? 'Tính tiền theo API key của bạn (như giọng của slide). Chữ + giọng đã đọc rồi thì lần sau lấy lại, không tính lại.'
      : 'Miễn phí. Chữ + giọng đã đọc rồi thì lần sau lấy lại ngay.');
    chonEngine.addEventListener('change', () => {
      ghiChu.textContent = chonEngine.value === 'beeknoee' || chonEngine.value === 'elevenlabs'
        ? 'Tính tiền theo API key của bạn (như giọng của slide). Chữ + giọng đã đọc rồi thì lần sau lấy lại, không tính lại.'
        : 'Miễn phí. Chữ + giọng đã đọc rồi thì lần sau lấy lại ngay.';
    });
    const bao = tao('div', 'gk-bao');
    bao.setAttribute('role', 'status');
    bao.hidden = true;

    const cuoi = tao('div', 'gk-cuoi');
    const huy = tao('button', 'bk-nut', 'Huỷ');
    huy.type = 'button';
    huy.onclick = dong;
    const ok = tao('button', 'bk-nut gk-ok', o.thay ? 'Tạo lại giọng' : 'Tạo giọng đọc');
    ok.type = 'button';
    cuoi.append(huy, ok);

    than.append(chu, dem, hangO('Bộ giọng', chonEngine), oGiong, hangO('Tốc độ', toc), ghiChu, bao, cuoi);
    khung.append(dau, than);
    hop.append(nen, khung);
    document.body.appendChild(hop);
    if (window.__beeIcons) window.__beeIcons.apply(hop);
    document.addEventListener('keydown', phim, true);
    setTimeout(() => chu.focus(), 0);

    const hien = (thongDiep, loai) => {
      bao.hidden = !thongDiep;
      bao.textContent = thongDiep || '';
      bao.className = `gk-bao${loai ? ` ${loai}` : ''}`;
    };
    ok.onclick = async () => {
      if (dangTao) return;
      const noiDung = chu.value.replace(/\s+/g, ' ').trim();
      if (!noiDung) { hien('Chưa có chữ để đọc.', 'loi'); chu.focus(); return; }
      const g = docGiong();
      if (chonEngine.value === 'elevenlabs' && !g.voice) { hien('Chọn một giọng ElevenLabs (tab Âm thanh) trước.', 'loi'); return; }
      const sp = RP.docTocDo ? RP.docTocDo(toc.value).so : Math.min(2, Math.max(0.5, Number(String(toc.value).replace(',', '.')) || 1));
      dangTao = true;
      [chu, chonEngine, toc, ok, huy, x].forEach((e) => { e.disabled = true; });
      oGiong.querySelectorAll('input, select').forEach((e) => { e.disabled = true; });
      hien('Đang tạo giọng đọc…', '');
      let r;
      try {
        r = await dg.taoGiong(msDat, { chu: noiDung, engine: chonEngine.value, voice: g.voice, model: g.model, speed: sp },
          o.thay ? { thay: o.thay } : {});
      } catch (e) {
        r = { ok: false, loi: [String((e && e.message) || e)] };
      }
      dangTao = false;
      if (r && r.ok) {
        dong();
        if (RP.setStatus) RP.setStatus(o.thay ? 'Đã tạo lại giọng đọc.' : 'Đã thêm giọng đọc lên track "Giọng đọc".', 'good');
        return;
      }
      [chu, chonEngine, toc, ok, huy, x].forEach((e) => { e.disabled = false; });
      oGiong.querySelectorAll('input, select').forEach((e) => { e.disabled = false; });
      hien(((r && r.loi) || ['Không tạo được giọng đọc.']).join(' · '), 'loi');
    };
  }

  RP.giongKhoi = { mo, dangMo: () => !!hop };
})();
