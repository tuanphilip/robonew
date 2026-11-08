'use strict';
/**
 * PANE "TRÊN MÁY" — giọng đọc VieNeu-TTS chạy ngay trên máy người dùng (python/tts/vieneu.py).
 *
 * Thẻ `#vnThe` đi theo đúng thứ tự người dùng cần:
 *   1. KIỂM MÁY (chưa tải gì): CPU, RAM, ổ trống → bản nên dùng (int8 nhẹ ~210 MB nếu CPU có
 *      VNNI, còn lại fp32 ~520 MB) hoặc lý do máy không dùng được.
 *   2. TẢI (tiến độ, huỷ) — hoặc NHẬP TỪ THƯ MỤC khi mạng chặn huggingface. Bộ cài từ
 *      10/10/2026 KÈM SẴN cả hai bản (python/tts/vieneu.py: goc_kem) nên bước này chỉ còn cho
 *      bản cài cũ / bản dựng thiếu mô hình.
 *   3. ĐO TỐC ĐỘ thật (đọc thử một câu) → "chạy tốt / được nhưng chậm / máy yếu" + ước lượng
 *      video 3 phút mất bao lâu đọc. Tự đo ngay sau khi tải xong / đổi bản (số đo theo TỪNG bản).
 *   4. CHỌN BẢN (đầy đủ fp32 / nhẹ int8 — int8 chỉ khi CPU có VNNI) và XOÁ BẢN KHÔNG DÙNG
 *      (bản đi kèm chỉ xoá được trên Windows; cập nhật app là có lại).
 * `state.vieneuSanSang` cho `kiemNguonGiongDoc` (tts-panel.js) chặn nút Tạo video khi chưa có
 * mô hình. Chỉ hỏi sidecar khi pane hiện lần đầu (hoặc nguồn đang chọn là "Trên máy").
 */
(function () {
  const RP = (window.__renderPage = window.__renderPage || {});
  const api = window.beeknoee && window.beeknoee.tts && window.beeknoee.tts.vieneu;
  const $ = (s) => document.querySelector(s);
  const pane = $('[data-pane="vieneu"]');
  if (!api || !pane) return;
  const state = RP.state || (RP.state = {});

  const sach = (e) => String((e && e.message) || e || '')
    .replace(/^Error invoking remote method '[^']+':\s*/, '').replace(/^Error:\s*/, '');
  const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const mb = (b) => `${Math.round((b || 0) / 2 ** 20)} MB`;
  const gb = (b) => `${((b || 0) / 2 ** 30).toFixed(1).replace('.', ',')} GB`;
  const so = (x) => String(x).replace('.', ',');

  let tt = null;        // vieneu.status
  let may = null;       // vieneu.check
  let tai = null;       // { bytesDone, bytesTotal, message } khi đang tải
  let dangDo = false;
  let loi = '';
  let daNap = false;

  function baoNut() {
    state.vieneuSanSang = !!(tt && tt.banDung);
    if (RP.capNhatNutDung) RP.capNhatNutDung();
  }

  const TEN_BAN = { fp32: 'Bản đầy đủ', int8: 'Bản nhẹ' };

  /** Hai nút chọn bản mô hình — bộ cài kèm cả hai; bản nhẹ (int8) chỉ khi CPU có VNNI. */
  function veChonBan() {
    const nguon = tt.nguon || {};
    const duoc = tt.duocDung || { fp32: true, int8: tt.banNen === 'int8' };
    const o = ['fp32', 'int8'].map((b) => {
      const dang = tt.banDung === b;
      let phu;
      if (!duoc[b]) phu = 'CPU không có VNNI — giọng sẽ méo';
      else if (!tt.daCai[b]) phu = `chưa có · tải ${mb(tt.coTai[b])}`;
      else phu = (nguon[b] === 'kem' ? 'có sẵn' : 'đã tải') + (b === tt.banNen ? ' · hợp máy này' : '');
      const tat = dang || !duoc[b] || dangDo || !!tai;
      return `<button type="button" class="vn-chon${dang ? ' on' : ''}" data-ban="${b}" aria-pressed="${dang}"${tat ? ' disabled' : ''}>`
        + `<b>${TEN_BAN[b]}</b><small>${b} · ${esc(phu)}</small></button>`;
    }).join('');
    return `<div class="vn-ban" role="group" aria-label="Bản mô hình giọng">${o}</div>`;
  }

  function ve() {
    const the = $('#vnThe');
    if (!the) return;
    const nut = (id, chu, icon, phu) => `<button type="button" class="vn-nut${phu ? ' phu' : ''}" id="${id}">${icon ? `<span class="btn-icon" data-icon="${icon}"></span>` : ''}<span>${chu}</span></button>`;
    let h = '';
    if (!tt) {
      h = '<p class="vn-chu">Đang kiểm tra…</p>';
    } else if (!tt.coGoi) {
      h = '<p class="vn-chu loi">Bản app này chưa có bộ giọng trên máy — cập nhật app mới dùng được.</p>';
    } else if (tai) {
      const pt = tai.bytesTotal ? Math.min(100, Math.round((tai.bytesDone / tai.bytesTotal) * 100)) : 0;
      h = `<p class="vn-chu"><b>Đang tải mô hình giọng</b> · ${mb(tai.bytesDone)} / ${mb(tai.bytesTotal)}</p>
        <div class="vn-thanh"><i style="width:${pt}%"></i></div>
        <p class="vn-phu">${esc(tai.message || '')}</p>
        <div class="vn-hang">${nut('vnHuy', 'Huỷ tải', 'stop', true)}</div>`;
    } else if (!tt.banDung) {
      const m = may;
      const ban = m ? m.banNen : tt.banNen;
      const nhan = ban === 'int8' ? 'bản nhẹ (CPU có VNNI)' : 'bản đầy đủ';
      h = `<p class="vn-chu"><b>Giọng đọc miễn phí chạy ngay trên máy</b> — 25 giọng Bắc · Trung · Nam, đọc không cần mạng.</p>`;
      if (m) {
        h += `<dl class="vn-may">
          <dt>CPU</dt><dd>${esc(m.cpu || '—')}${m.soLuong ? ` · ${m.soLuong} luồng` : ''}</dd>
          <dt>RAM</dt><dd>${m.ramTong ? gb(m.ramTong) : '—'}${m.ramTrong ? ` (trống ${gb(m.ramTrong)})` : ''}</dd>
          <dt>Ổ đĩa trống</dt><dd>${m.diaTrong != null ? gb(m.diaTrong) : '—'}</dd>
          <dt>Sẽ tải</dt><dd>${nhan} · ${mb(m.coTai)}</dd></dl>`;
        (m.lyDo || []).forEach((x) => { h += `<p class="vn-chu loi">${esc(x)}</p>`; });
        (m.canhBao || []).forEach((x) => { h += `<p class="vn-phu canh">${esc(x)}</p>`; });
        if (m.duocDung) h += `<div class="vn-hang">${nut('vnTai', `Tải giọng (${mb(m.coTai)})`, 'upload')}${nut('vnNhap', 'Nhập từ thư mục', 'folder', true)}</div>`;
      } else {
        h += '<p class="vn-phu">Đang đọc cấu hình máy…</p>';
      }
    } else {
      const dg = tt.danhGia;
      const ban = TEN_BAN[tt.banDung].toLowerCase();
      if (dangDo) {
        h = `<p class="vn-chu"><b>Đang đo tốc độ máy…</b> (đọc thử một câu, mất chừng 10–30 giây)</p>`;
      } else if (dg) {
        // RTF = giây tính cho mỗi giây giọng: 0,52 là NHANH gấp ~1,9 lần — đừng ghi "0,52×" (đọc ra là chậm).
        const nhip = dg.rtf <= 0 ? '' : (dg.rtf < 1
          ? `nhanh gấp ${so((1 / dg.rtf).toFixed(1))} lần thời gian thật`
          : `chậm gấp ${so(dg.rtf.toFixed(1))} lần thời gian thật`);
        h = `<p class="vn-chu ${esc(dg.muc)}"><b>${dg.muc === 'tot' ? '✓ ' : ''}${esc(dg.chu)}</b></p>
          <p class="vn-phu">Video 3 phút ≈ ${so(dg.phut3)} phút đọc · ${nhip} · ${ban}</p>`;
      } else {
        h = `<p class="vn-chu"><b>Đã có mô hình giọng</b> (${ban}).</p>`;
      }
      h += veChonBan();
      const khac = tt.banDung === 'int8' ? 'fp32' : 'int8';
      const nguon = tt.nguon || {};
      const xoaKhac = !dangDo && tt.daCai[khac] && (nguon[khac] === 'tai' || tt.xoaDuocKem);
      const coTaiThem = Object.keys(nguon).some((b) => nguon[b] === 'tai');
      h += `<div class="vn-hang">${dangDo ? '' : nut('vnDo', dg ? 'Đo lại' : 'Đo tốc độ máy', 'dongho', true)}`
        + (xoaKhac ? nut('vnXoaKhac', `Xoá bản không dùng (${mb((tt.coBan || {})[khac])})`, 'trash', true) : '')
        + (coTaiThem && !dangDo ? nut('vnGo', Object.keys(nguon).some((b) => nguon[b] === 'kem') ? 'Gỡ bản đã tải' : 'Gỡ mô hình', 'trash', true) : '')
        + '</div>';
    }
    if (loi) h += `<p class="vn-chu loi">${esc(loi)}</p>`;
    the.innerHTML = h;
    if (window.__beeIcons) window.__beeIcons.apply(the);
    const on = (id, f) => { const n = document.getElementById(id); if (n) n.onclick = f; };
    on('vnTai', () => taiMoHinh(may && may.banNen));
    on('vnNhap', nhapThuMuc);
    on('vnHuy', () => api.cancel().catch(() => {}));
    on('vnDo', doTocDo);
    on('vnGo', goMoHinh);
    on('vnXoaKhac', xoaBanKhac);
    the.querySelectorAll('.vn-chon[data-ban]').forEach((n) => { n.onclick = () => chonBan(n.dataset.ban); });
  }

  async function napTrangThai() {
    try { tt = await api.status(); } catch (e) { loi = sach(e); }
    baoNut();
    ve();
    if (tt && tt.coGoi && !tt.banDung && !may) {
      try { may = await api.check(); } catch (e) { loi = sach(e); }
      ve();
    }
  }

  async function taiMoHinh(ban) {
    loi = '';
    const tong = (tt && tt.coTai && ban && tt.coTai[ban]) || (may && may.coTai) || 0;
    tai = { bytesDone: 0, bytesTotal: tong, message: 'Bắt đầu tải…' };
    ve();
    try {
      await api.download(ban);
      tai = null;
      // Tải bản KHÁC bản đang dùng (bấm nút chọn bản) ⇒ chọn luôn bản vừa tải.
      if (ban && tt && tt.banDung && tt.banDung !== ban) await api.choose(ban).catch(() => {});
      await napTrangThai();
      if (tt && tt.banDung) await doTocDo();
    } catch (e) {
      tai = null;
      loi = /huỷ/i.test(sach(e)) ? 'Đã huỷ tải — bấm Tải để tải tiếp từ chỗ dừng.' : sach(e);
      ve();
    }
  }

  async function nhapThuMuc() {
    loi = '';
    try {
      const r = await api.importFolder();
      if (!r) return;
      await napTrangThai();
      if (tt && tt.banDung) await doTocDo();
    } catch (e) { loi = sach(e); ve(); }
  }

  async function doTocDo() {
    loi = '';
    dangDo = true;
    ve();
    try {
      await api.bench();
    } catch (e) { loi = sach(e); }
    dangDo = false;
    await napTrangThai();
  }

  async function chonBan(ban) {
    if (!tt || ban === tt.banDung) return;
    if (!tt.daCai[ban]) { await taiMoHinh(ban); return; }
    loi = '';
    try { tt = await api.choose(ban); } catch (e) { loi = sach(e); }
    baoNut();
    ve();
    // Tốc độ đo theo TỪNG bản — bản mới chưa đo thì đo luôn (bấm đổi là muốn biết nhanh hơn không).
    if (tt && tt.banDung === ban && !tt.danhGia) await doTocDo();
  }

  async function xoaBanKhac() {
    const khac = tt.banDung === 'int8' ? 'fp32' : 'int8';
    const coKem = tt.nguon && tt.nguon[khac] === 'kem';
    const dongY = window.__beeHoi ? await window.__beeHoi({
      tieuDe: `Xoá ${TEN_BAN[khac].toLowerCase()} (${khac})?`,
      chu: [`Giải phóng ${mb((tt.coBan || {})[khac])} ổ đĩa. Bản đang dùng (${TEN_BAN[tt.banDung].toLowerCase()}) giữ nguyên.`]
        .concat(coKem ? ['Bản này đi kèm bộ cài nên sẽ có lại sau lần cập nhật app tới.'] : []),
      nutDong: 'Xoá', nguyHiem: true,
    }) : window.confirm(`Xoá ${TEN_BAN[khac].toLowerCase()}?`);
    if (!dongY) return;
    loi = '';
    try { tt = await api.remove(khac); } catch (e) { loi = sach(e); }
    await napTrangThai();
  }

  async function goMoHinh() {
    const dongY = window.__beeHoi ? await window.__beeHoi({
      tieuDe: 'Gỡ mô hình giọng trên máy?',
      chu: ['Xoá các tệp mô hình đã tải (giải phóng ổ đĩa). Muốn dùng lại thì tải lại.'],
      nutDong: 'Gỡ', nguyHiem: true,
    }) : window.confirm('Gỡ mô hình giọng trên máy?');
    if (!dongY) return;
    loi = '';
    try { tt = await api.remove(); } catch (e) { loi = sach(e); }
    may = null;
    await napTrangThai();
  }

  api.onProgress((p) => {
    if (!tai) return;
    tai = { bytesDone: p.bytesDone || 0, bytesTotal: p.bytesTotal || tai.bytesTotal, message: p.message || '' };
    ve();
  });

  /* ── danh sách giọng ─────────────────────────────────────────────────── */
  async function napGiong() {
    const sel = $('#vnVoice');
    if (!sel) return;
    let ds = [];
    let macDinh = '';
    try { const r = await api.voices(); ds = r.giong || []; macDinh = r.macDinh || ''; } catch { ds = []; }
    let daLuu = '';
    try { daLuu = (((await window.beeknoee.settings.get()) || {}).giongMay || {}).voice || ''; } catch { daLuu = ''; }
    sel.innerHTML = '';
    ['Bắc', 'Trung', 'Nam'].forEach((mien) => {
      const nhom = ds.filter((g) => g.mien === mien);
      if (!nhom.length) return;
      const og = document.createElement('optgroup');
      og.label = `Giọng miền ${mien}`;
      nhom.forEach((g) => {
        const o = document.createElement('option');
        o.value = g.id;
        const phongCach = (g.moTa.split('·')[2] || '').trim();
        o.textContent = (g.noiBat ? '⭐ ' : '') + g.ten + ' — ' + (g.gioiTinh === 'nu' ? 'Nữ' : 'Nam') + (phongCach ? ' · ' + phongCach : '');
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    const co = (v) => ds.some((g) => g.id === v);
    sel.value = co(daLuu) ? daLuu : (co(macDinh) ? macDinh : (ds[0] && ds[0].id) || '');
    const st = $('#vnVoiceState');
    if (st) st.textContent = ds.length ? `${ds.length} giọng` : '';
  }
  const vnVoice = $('#vnVoice');
  if (vnVoice) {
    vnVoice.addEventListener('change', () => {
      if (RP.dungNgheThu) RP.dungNgheThu();
      try { window.beeknoee.settings.set({ giongMay: { voice: vnVoice.value } }).catch(() => {}); } catch { /* thôi */ }
    });
  }
  const vnNghe = $('#vnNghe');
  if (vnNghe) vnNghe.addEventListener('click', (e) => { e.preventDefault(); if (RP.ngheThuVieneu) RP.ngheThuVieneu(vnNghe); });

  /* Chỉ hỏi sidecar khi pane hiện lần đầu — đa số người dùng không mở tab này. */
  function khiHien() {
    if (daNap || pane.hidden) return;
    daNap = true;
    napGiong();
    napTrangThai();
  }
  new MutationObserver(khiHien).observe(pane, { attributes: true, attributeFilter: ['hidden'] });
  khiHien();

  RP.vieneuPanel = { napTrangThai, ve };
})();
