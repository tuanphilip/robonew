'use strict';
/**
 * DỰ ÁN VIDEO TRỐNG — phần giao diện (phần lõi: src/dung/duAnVideo.js, main/duAn.js#taoDuAnVideo).
 *
 * Làm video kiểu Premiere KHÔNG cần slide / giọng đọc: thả ảnh, video, nhạc, chữ lên timeline rồi
 * "Xuất video" → `output/<tên>.mp4`.
 *
 *   · Nút "Dự án mới" trên THANH TRÊN CÙNG (render/thanh-tren.js — 23/10/2026; trước là nút "Video trống" trong hộp
 *     Dự án, trông như bộ lọc) → hộp nhập tên + chọn khổ (dọc 9:16 / ngang 16:9) → `projects.createVideo` → mở dự án
 *     vừa tạo (pages.js#moDuAnVuaTao).
 *   · Chế độ dự án video (lớp `du-an-video` trên <body>, đặt khi trình dựng nạp xong — RP.dung
 *     'nap'): ẩn hai tab của deck (Nội dung / Âm thanh — css/du-an-pop.css), mở tab Thuộc tính,
 *     nút trên cùng thành "Xuất video" (thanh-tren.js), timeline chỉ còn track người dùng + "Nền".
 *   · `RP.duAnVideo.xuat()`: lưu rồi xuất qua hàng đợi dựng chung (dung:xuat → render/queue.js) —
 *     tiến độ hiện ở bảng chung y như "Tạo video".
 */
(function () {
  const api = window.beeknoee;
  if (!api || !api.projects || !api.projects.createVideo) return;
  const RP = (window.__renderPage = window.__renderPage || {});
  const $ = (s, g) => (g || document).querySelector(s);

  const bao = (chu, loi) => { if (RP.setStatus) RP.setStatus(chu, loi ? 'bad' : 'good'); };

  /* ── hộp tạo dự án ─────────────────────────────────────────────────────── */
  function moHopTao() {
    const tao = (the, lop) => { const e = document.createElement(the); if (lop) e.className = lop; return e; };
    const h = tao('div', 'ai-hop dav-hop');
    const nen = tao('div', 'ai-nen');
    const khung = tao('div', 'ai-khung');
    khung.setAttribute('role', 'dialog');
    khung.setAttribute('aria-modal', 'true');
    khung.setAttribute('aria-label', 'Dự án mới');
    const nutMo = document.activeElement;
    khung.innerHTML = `
      <div class="ai-dau"><span class="btn-icon" data-icon="duAnMoi"></span><b>Dự án mới</b></div>
      <div class="ai-than">
        <div class="ait-hoi-dong">Thả ảnh, video, nhạc và chữ lên timeline rồi bấm <b>Xuất video</b> — không cần slide hay giọng đọc.</div>
        <label class="dav-nhan" for="davTen">Tên dự án</label>
        <input id="davTen" class="dav-o" type="text" maxlength="60" placeholder="video-moi" autocomplete="off" spellcheck="false" />
        <div class="dav-nhan">Khổ video</div>
        <div class="dav-kho" role="radiogroup" aria-label="Khổ video">
          <button type="button" class="dav-chon on" data-khung="doc" role="radio" aria-checked="true">
            <span class="btn-icon" data-icon="dienthoai"></span><b>Dọc 9:16</b><small>1080×1920 · Shorts, Reels, TikTok</small></button>
          <button type="button" class="dav-chon" data-khung="ngang" role="radio" aria-checked="false">
            <span class="btn-icon" data-icon="bangngang"></span><b>Ngang 16:9</b><small>1920×1080 · YouTube</small></button>
        </div>
        <div class="dav-loi" hidden></div>
      </div>
      <div class="ait-hoi-nut">
        <button type="button" class="ait-hoi-phu" data-huy>Hủy</button>
        <button type="button" class="ait-hoi-chinh" data-tao>Tạo dự án</button>
      </div>`;
    h.append(nen, khung);
    document.body.append(h);
    if (window.__beeIcons) window.__beeIcons.apply(h);

    let khungChon = 'doc';
    const oTen = $('#davTen', h);
    const nutTao = $('[data-tao]', h);
    const oLoi = $('.dav-loi', h);
    oTen.focus();
    h.querySelectorAll('.dav-chon').forEach((b) => {
      b.onclick = () => {
        khungChon = b.dataset.khung;
        h.querySelectorAll('.dav-chon').forEach((x) => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-checked', String(x === b));
        });
      };
    });
    const dong = () => {
      document.removeEventListener('keydown', phim, true);
      h.remove();
      // Trả tiêu điểm về nút đã mở hộp (bàn phím / trình đọc màn hình).
      if (nutMo && nutMo.isConnected && nutMo.focus) nutMo.focus();
    };
    const phim = (e) => {
      // stopPropagation: Esc của hộp này KHÔNG được đóng luôn hộp "Dự án" bên dưới (thanh-tren.js#phimHop).
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dong(); }
      else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && document.activeElement && document.activeElement.classList.contains('dav-chon')) {
        e.preventDefault();
        const ds = [...h.querySelectorAll('.dav-chon')];
        const k = ds[(ds.indexOf(document.activeElement) + (e.key === 'ArrowRight' ? 1 : ds.length - 1)) % ds.length];
        k.click();
        k.focus();
      }
      else if (e.key === 'Enter' && document.activeElement === oTen) { e.preventDefault(); nutTao.click(); }
    };
    document.addEventListener('keydown', phim, true);
    nen.onclick = dong;
    $('[data-huy]', h).onclick = dong;
    nutTao.onclick = async () => {
      if (nutTao.disabled) return;
      nutTao.disabled = true;
      nutTao.textContent = 'Đang tạo…';
      oLoi.hidden = true;
      let r = null;
      try { r = await api.projects.createVideo({ ten: oTen.value.trim(), khung: khungChon }); } catch (e) { r = { ok: false, loi: e.message }; }
      if (!r || !r.ok) {
        oLoi.textContent = (r && r.loi) || 'Không tạo được dự án.';
        oLoi.hidden = false;
        nutTao.disabled = false;
        nutTao.textContent = 'Tạo dự án';
        return;
      }
      dong();
      if (RP.thanhTren && RP.thanhTren.dongHopDuAn) RP.thanhTren.dongHopDuAn();
      bao(`Đã tạo dự án video "${r.name}" — thả ảnh, video, nhạc vào timeline (kéo từ máy hoặc tab Thư viện).`);
      if (window.__beePages && window.__beePages.moDuAnVuaTao) await window.__beePages.moDuAnVuaTao(r.name);
    };
  }


  /* ── xuất ─────────────────────────────────────────────────────────────── */
  async function xuat() {
    const dg = RP.dung;
    if (!dg || !dg.laVideo || !dg.laVideo()) return;
    // Khung xem dự án vừa chọn chưa nạp xong ⇒ kho còn là dự án trước: đừng xuất nhầm.
    if (RP.state && RP.state.project && dg.deck() !== RP.state.project) { bao('Dự án đang mở chưa nạp xong — chờ một chút rồi bấm lại.', true); return; }
    if (dg.chiDoc && dg.chiDoc()) { bao('Dự án này do bản app mới hơn tạo — cập nhật app để xuất.', true); return; }
    const d = dg.duAn();
    if (!d || !d.khoi.length) { bao('Timeline còn trống — thả ảnh, video, nhạc hoặc thêm chữ trước khi xuất video.', true); return; }
    let r = null;
    try { r = await dg.xuat(); } catch (e) { r = { ok: false, loi: [e.message] }; }
    if (!r || !r.ok) bao(((r && r.loi) || ['Không xuất được.']).join(' · '), true);
    else if (r.xepHang) bao(`Đã xếp hàng xuất video (thứ ${r.viTri}) — chạy sau lượt đang dựng.`);
    else if (r.dangChay) bao('Dự án này đang xuất — chờ xong rồi bấm lại.', true);
    else if (!r.xong) bao('Đang xuất video…');
  }

  /* ── phụ đề tự động ──────────────────────────────────────────────────────
     Dự án video không có kịch bản để căn: main trộn tiếng của timeline (đúng thứ bản xuất sẽ phát)
     rồi Whisper nhận dạng (src/dung/index.js#dung:phuDeTuDong). Câu ra ghi vào dự án qua
     `RP.dung.datPhuDe` — có hoàn tác, sửa trên track C1, bản xuất vẽ lên hình. Không tốn lượt. */
  const NGON_NGU = [['vi', 'Tiếng Việt'], ['en', 'English'], ['', 'Tự nhận ngôn ngữ']];
  let ngonNgu = 'vi';
  let pdDang = null;   // { deck, chu } khi đang tạo
  const veLaiBang = () => { if (RP.bangKhoi && RP.bangKhoi.ve) RP.bangKhoi.ve(); };

  /** Dấu vân của mọi thứ quyết định TIẾNG (khối có tiếng, track, âm lượng, tốc độ, cắt) — so trước/sau Whisper. */
  function dauVanTieng(d) {
    if (!d) return '';
    const coTieng = new Set(d.media.filter((m) => m.loai === 'tieng' || (m.loai === 'video' && m.coTieng)).map((m) => m.id));
    return JSON.stringify({
      k: d.khoi.filter((c) => coTieng.has(c.media)).map((c) => [c.id, c.track, c.media, c.neo, c.batDauMs, c.vaoMs, c.raMs, c.tocDo, c.amLuong, c.kf && c.kf.amLuong, c.mo]),
      t: d.track.map((t) => [t.id, t.tatTieng, t.amLuong]),
    });
  }

  async function taoPhuDe() {
    const dg = RP.dung;
    const deck = dg && dg.deck ? dg.deck() : '';
    if (!deck || pdDang || !dg.laVideo()) return;
    const d = dg.duAn();
    const coTieng = !!(d && d.khoi.some((c) => {
      const m = d.media.find((x) => x.id === c.media);
      return m && (m.loai === 'tieng' || (m.loai === 'video' && m.coTieng));
    }));
    if (!coTieng) { bao('Timeline chưa có tiếng nào để nhận dạng — thả video có tiếng, giọng thu hoặc tệp âm thanh vào trước.', true); return; }
    // Đặt cờ TRƯỚC lần chờ đầu tiên — bấm hai lần trong lúc lưu là lượt thứ hai lọt qua chốt (rà 16/10/2026).
    pdDang = { deck, chu: 'Trộn tiếng timeline…' };
    veLaiBang();
    await dg.luuNgay();   // main đọc du-an.json trên đĩa
    const dauVanTruoc = dauVanTieng(dg.duAn());
    let r;
    try { r = await api.dung.phuDeTuDong(deck, { ngonNgu }); } catch (e) { r = { ok: false, loi: [e.message] }; }
    pdDang = null;
    if (!RP.dung || RP.dung.deck() !== deck) return;   // đã chuyển dự án khác
    if (!r || !r.ok) {
      bao(r && r.huy ? 'Đã dừng tạo phụ đề.' : `Không tạo được phụ đề: ${((r && r.loi) || []).join(' · ')}`, !(r && r.huy));
      veLaiBang();
      return;
    }
    if (!r.captions.length) { bao('Không nghe thấy lời nói nào trong timeline — kiểm lại âm lượng, hoặc chọn đúng ngôn ngữ.', true); veLaiBang(); return; }
    const kq = RP.dung.datPhuDe({ captions: r.captions }, 'Tạo phụ đề tự động');
    if (kq && kq.ok === false) { bao(`Không ghi được phụ đề vào dự án: ${(kq.loi || []).join(' · ')}`, true); veLaiBang(); return; }
    /* Người dùng sửa phần TIẾNG trong lúc Whisper chạy (vài phút): câu theo bản lúc bấm — nói rõ. */
    const doi = dauVanTieng(RP.dung.duAn()) !== dauVanTruoc;
    bao(doi
      ? `Đã tạo ${r.captions.length} câu phụ đề — nhưng phần tiếng trên timeline đã đổi trong lúc nhận dạng: phụ đề theo bản lúc bấm, kiểm lại trên C1 hoặc bấm "Tạo lại".`
      : `Đã tạo ${r.captions.length} câu phụ đề — sửa trên track C1, bấm "Xuất video" để đốt vào hình.`, doi);
  }

  if (api.dung && api.dung.onPhuDeTienTrinh) {
    api.dung.onPhuDeTienTrinh((p) => {
      if (!pdDang || !p || p.deck !== pdDang.deck || !p.message) return;
      pdDang.chu = p.message;
      bao(p.message);
      veLaiBang();
    });
  }

  /** Nhóm "Phụ đề" của bảng Khối khi là dự án video (bang-khoi.js#veCaiDat đưa sẵn bộ dựng ô). */
  function nhomPhuDe({ nhom, oTick, oChon, tao }) {
    const dg = RP.dung;
    const d = dg.duAn();
    const pd = d && d.phuDe;
    const dang = !!(pdDang && pdDang.deck === dg.deck());
    // Dự án do bản app mới hơn tạo (chỉ đọc): không nút nào ghi được.
    if (dg.chiDoc && dg.chiDoc()) return nhom('Phụ đề', tao('div', 'bk-phu', 'Dự án chỉ đọc — cập nhật app để sửa phụ đề.'));
    const nut = (chu, f, lop) => {
      const b = tao('button', `bk-nut${lop ? ` ${lop}` : ''}`, chu);
      b.type = 'button';
      b.onclick = f;
      return b;
    };
    const hang = (...cac) => { const h = tao('div', 'bk-nut-hang'); cac.forEach((x) => h.appendChild(x)); return h; };
    if (dang) {
      return nhom('Phụ đề', tao('div', 'bk-phu', pdDang.chu || 'Đang tạo phụ đề…'),
        hang(nut('Dừng', () => api.dung.phuDeHuy(dg.deck()))));
    }
    const cac = [];
    if (pd) {
      // Bật / tắt: một nút chung (👁 ở track C1 + ô "Hiện phụ đề" đầu bảng — render/kieu-phu-de.js).
      cac.push(tao('div', 'bk-phu', `${(pd.captions || []).length} câu — sửa trên track C1: bấm đúp sửa chữ, kéo mép đổi giờ, dao cạo (C) tách câu, Delete xoá câu.`));
    } else {
      cac.push(tao('div', 'bk-phu', 'Nhận dạng lời nói trong video, giọng thu, nhạc trên timeline — chạy ngay trên máy, không tốn lượt tạo video.'));
    }
    cac.push(oChon('Ngôn ngữ', ngonNgu, NGON_NGU, (v) => { ngonNgu = v; }));
    cac.push(hang(
      nut(pd ? 'Tạo lại phụ đề tự động' : 'Tạo phụ đề tự động', taoPhuDe),
      ...(pd ? [nut('Xoá phụ đề', () => dg.datPhuDe(null, 'Xoá phụ đề'))] : [])));
    return nhom('Phụ đề', ...cac);
  }

  /* Kiểu phụ đề (phông, cỡ, màu, vị trí…) ĐÃ DỜI sang render/kieu-phu-de.js (16/10/2026) — một bộ chỉnh
     chung cho deck lẫn dự án video, hiện ở tab Thuộc tính khi bấm track C1. */

  /* ── chế độ dự án video ───────────────────────────────────────────────── */
  let daMoKhoi = '';
  function apCheDo() {
    const dg = RP.dung;
    const la = !!(dg && dg.laVideo && dg.laVideo());
    document.body.classList.toggle('du-an-video', la);
    if (RP.thanhTren) {
      if (RP.thanhTren.veNutTao) RP.thanhTren.veNutTao();
      if (RP.thanhTren.veNutVideo) RP.thanhTren.veNutVideo();
    }
    // Mở tab Thuộc tính MỘT lần mỗi lần vào dự án — hai tab của deck đã ẩn.
    const deck = dg && dg.deck ? dg.deck() : '';
    /* Ba tab của deck đã ẩn ⇒ phải có một tab riêng mở: Thuộc tính, TRỪ khi người dùng đang ở Thư viện. */
    if (la && deck && daMoKhoi !== deck && RP.bangKhoi && RP.bangKhoi.mo) {
      daMoKhoi = deck;
      if (!(RP.tabPhai && RP.tabPhai.dang())) RP.bangKhoi.mo();
    }
    if (!la) daMoKhoi = '';
  }

  function khoi() {
    if (RP.dung && RP.dung.nghe) RP.dung.nghe((loai) => { if (loai === 'nap') apCheDo(); });
    apCheDo();
  }
  RP.duAnVideo = { moHopTao, xuat, apCheDo, taoPhuDe, nhomPhuDe };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', khoi);
  else khoi();
})();
