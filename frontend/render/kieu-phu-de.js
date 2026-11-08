'use strict';
/**
 * PHỤ ĐỀ — MỘT bộ chỉnh cho deck lẫn dự án video (GĐ1 lộ trình gộp slide + timeline, 16/10/2026).
 *
 * Trước đây phụ đề chỉnh ở HAI nơi: tab "Phụ đề" của deck (bang-sua.js, qua engine trong khung slide) và
 * nhóm "Kiểu phụ đề" của dự án video (du-an-video.js, qua IPC dung:kieuPhuDe) — cộng hai cờ bật/tắt riêng.
 * Nay: bấm track C1 / một câu phụ đề ⇒ tab "Thuộc tính" vẽ `vePhuDe()` dưới đây. Ghi vẫn đi ĐÚNG đường cũ
 * của từng loại dự án:
 *   · deck        → RP.bangSua.datPhuDe (st.subtitles → engine → preview-settings.json), rồi tính lại CSS
 *                   lớp phụ đề trên timeline (dung:cssPhuDe — trước đây lớp đó đứng yên kiểu cũ, lỗi L1);
 *   · dự án video → dung:kieuPhuDe (duAnVideo.ghiKieuPhuDe lọc giá trị) → RP.dung.datKieuPhuDe.
 *
 * BẬT / TẮT (nút 👁 ở đầu track C1, chốt Q1): MỘT nút cho cả hai cờ — `subtitles.enabled` của deck (lượt
 * "Tạo video" đốt hay không — pipeline.js) và `phuDe.an` của timeline (bản xuất có vẽ lớp phụ đề đã sửa).
 */
(function () {
  const RP = (window.__renderPage = window.__renderPage || {});
  const api = window.beeknoee;
  const D = () => RP.dung;
  const laVideo = () => !!(D() && D().laVideo && D().laVideo());
  const bao = (chu, loi) => { if (RP.setStatus) RP.setStatus(chu, loi ? 'bad' : 'good'); };
  const laHex = (x) => typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x);

  /* ── bật / tắt ───────────────────────────────────────────────────────── */
  function tat() {
    const dg = D();
    const an = !!(dg && dg.phuDeAn && dg.phuDeAn());
    if (laVideo()) return an;
    return an || !!(RP.bangSua && RP.bangSua.phuDeBat && !RP.bangSua.phuDeBat());
  }
  /** Có gì để bật / tắt không (dự án video chưa có phụ đề thì không). */
  function coPhuDe() {
    const dg = D();
    if (laVideo()) return !!(dg && dg.duAn && dg.duAn() && dg.duAn().phuDe);
    // Deck: cờ nằm ở preview-settings.json — bật/tắt được cả khi timeline chưa nạp (st của bảng sửa đã có).
    return !!(RP.bangSua && RP.bangSua.docPhuDe && RP.bangSua.docPhuDe());
  }
  /* Mọi lần ghi (kiểu chữ LẪN bật/tắt) đi chung MỘT hàng: mỗi lần là một POST cả `st` của deck — hai lần chạy
     song song thì bản sau đè bản trước (rà GĐ1). */
  let hangGhi = Promise.resolve();
  const xepHang = (viec) => {
    hangGhi = hangGhi.then(viec).catch((e) => bao(`Không lưu được phụ đề: ${(e && e.message) || e}`, true));
    return hangGhi;
  };
  const veLaiHet = () => {
    if (RP.timeline && RP.timeline.noi && RP.timeline.noi.veHet) RP.timeline.noi.veHet();
    if (RP.bangKhoi && RP.bangKhoi.ve) RP.bangKhoi.ve();
  };
  function datTat(tatMoi) {
    const dg = D();
    const deck = dg && dg.deck ? dg.deck() : (RP.deckCau && RP.deckCau.deck());
    const video = laVideo();
    return xepHang(async () => {
      if (!D() || (D().deck && D().deck() !== deck)) return;   // đã sang dự án khác trong lúc chờ
      const d = dg.duAn && dg.duAn();
      const pd = d && d.phuDe;
      const timelineGhiDuoc = !!(d && !(dg.chiDoc && dg.chiDoc()));
      /* Deck: GHI CỜ CỦA DECK TRƯỚC (preview-settings.json — thứ "Tạo video" đọc), được rồi mới đổi cờ `an` của
         timeline. Ngược lại thì lúc bảng sửa chưa sẵn sàng (khung đang nạp / deck tự viết app.js) chỉ một cờ đổi:
         nút báo "tắt" mà video vẫn đốt phụ đề. */
      if (!video) {
        const r = RP.bangSua && RP.bangSua.datPhuDe ? await RP.bangSua.datPhuDe({ enabled: !tatMoi }) : { ok: false, loi: ['Bảng sửa chưa nạp.'] };
        if (!r.ok) { bao((r.loi || []).join(' '), true); veLaiHet(); return; }
      }
      if (pd && timelineGhiDuoc) dg.datPhuDe({ ...pd, an: tatMoi }, tatMoi ? 'Tắt phụ đề' : 'Bật phụ đề');
      /* Câu nhắc dựng lại: video slide đã dựng giữ nguyên phụ đề đốt sẵn — trừ khi có bản phụ đề đã sửa VÀ còn
         bản không phụ đề (phụ đề tách lớp), lúc đó bản dựng timeline theo cờ `an` ngay. */
      if (!video && !(pd && dg.phuDeTt && dg.phuDeTt()) && dg.coVideo && dg.coVideo()) {
        bao(tatMoi ? 'Đã tắt phụ đề — bấm "Tạo video" để dựng lại video không phụ đề.'
          : 'Đã bật phụ đề — bấm "Tạo video" để dựng lại video có phụ đề.');
      }
      veLaiHet();
    });
  }

  /* ── kiểu chữ ────────────────────────────────────────────────────────── */
  function docKieu() {
    const dg = D();
    if (laVideo()) {
      const tt = dg && dg.phuDeTt && dg.phuDeTt();
      return tt ? (tt.kieu || {}) : null;
    }
    return RP.bangSua && RP.bangSua.docPhuDe ? RP.bangSua.docPhuDe() : null;
  }
  function doiKieu(va) {
    const dg = D();
    const deck = dg && dg.deck ? dg.deck() : (RP.deckCau && RP.deckCau.deck());
    const video = laVideo();
    // Nối đuôi: hai lần đổi liền nhau phải tới đĩa đúng thứ tự (lần sau ghi đè lần trước).
    return xepHang(async () => {
      if (D() && D().deck && D().deck() !== deck) return;   // đã sang dự án khác trong lúc chờ
      if (video) {
        const r = await api.dung.kieuPhuDe(deck, va);
        if (!r || !r.ok) { bao((r && r.loi && r.loi.join(' ')) || 'Không lưu được kiểu phụ đề.', true); return; }
        if (D().deck() === deck && D().datKieuPhuDe) D().datKieuPhuDe(r.kieu, r.css);
        return;
      }
      const r = await RP.bangSua.datPhuDe(va);
      if (!r || !r.ok) { bao((r && r.loi && r.loi.join(' ')) || 'Không lưu được kiểu phụ đề.', true); return; }
      // Lớp phụ đề trên timeline (phụ đề tách lớp) tính lại CSS từ tệp vừa ghi.
      if (D().phuDeTt && D().phuDeTt() && api.dung.cssPhuDe) {
        const c = await api.dung.cssPhuDe(deck).catch(() => null);
        if (c && c.ok && D().deck() === deck && D().datKieuPhuDe) D().datKieuPhuDe(c.kieu, c.css);
      }
      if (RP.bangKhoi && RP.bangKhoi.ve) RP.bangKhoi.ve();
    });
  }

  const PHONG = [['', 'Mặc định'], ['Inter, sans-serif', 'Inter'], ['Arial, Helvetica, sans-serif', 'Arial'],
    ["'Segoe UI', Roboto, sans-serif", 'Segoe UI'], ['Georgia, serif', 'Georgia'],
    ["'Times New Roman', Times, serif", 'Times New Roman'], ["'Courier New', monospace", 'Courier New']];

  function nhomKieu({ nhom, oChon, oTick, tao }) {
    const k = docKieu();
    if (!k) {
      return nhom('Kiểu phụ đề', tao('div', 'bk-phu', laVideo()
        ? 'Tạo phụ đề trước rồi mới chỉnh kiểu chữ.'
        : 'Đang đọc thiết lập của deck… (deck không dùng engine chung thì sửa phụ đề trong style.css của deck).'));
    }
    const mau = (nhan, gia, doi) => {
      const h = tao('label', 'bk-hang bk-hang-chon');
      h.appendChild(tao('span', 'bk-nhan', nhan));
      const o = tao('input', 'bk-mau');
      o.type = 'color';
      o.value = gia;
      o.addEventListener('change', () => doi(o.value));
      h.appendChild(o);
      return h;
    };
    // Thanh trượt + ô số: ghi khi THẢ (change) — mỗi lần ghi là một lượt đọc/ghi preview-settings.json.
    const truot = (nhan, gia, min, max, buoc, donVi, doi) => {
      const h = tao('div', 'bk-hang');
      h.appendChild(tao('span', 'bk-nhan', nhan));
      const tr = tao('input', 'bk-truot');
      Object.assign(tr, { type: 'range', min, max, step: buoc, value: gia });
      const o = tao('input', 'bk-so');
      Object.assign(o, { type: 'number', min, max, step: buoc, value: gia });
      tr.addEventListener('input', () => { o.value = tr.value; });
      tr.addEventListener('change', () => doi(Number(tr.value)));
      o.addEventListener('change', () => {
        const v = Math.min(max, Math.max(min, Math.round(Number(o.value))));
        if (!Number.isFinite(v)) { o.value = tr.value; return; }
        o.value = String(v);
        tr.value = String(v);
        doi(v);
      });
      h.append(tr, o, tao('span', 'bk-dv', donVi));
      return h;
    };
    const co = Number(k.fontSize) || 15;
    const cacCo = [...new Set([12, 14, 16, 18, 20, 22, 24, 26, 28, co])].sort((a, b) => a - b).map((n) => [String(n), `${n} px`]);
    const kieu = tao('div', 'bk-nut-hang bk-lat');
    [['bold', 'Đậm', k.bold !== false], ['italic', 'Nghiêng', k.italic === true], ['underline', 'Gạch chân', k.underline === true]]
      .forEach(([khoa, nhan, bat]) => {
        const b = tao('button', `bk-nut${bat ? ' bat' : ''}`, nhan);
        b.type = 'button';
        b.setAttribute('aria-pressed', bat ? 'true' : 'false');
        b.onclick = () => doiKieu({ [khoa]: !bat });
        kieu.appendChild(b);
      });
    const coVien = laHex(k.outlineColor);
    const doMo = Math.round(Number(k.bgOpacity) || 0);
    return nhom('Kiểu phụ đề',
      oChon('Phông', PHONG.some(([v]) => v === (k.fontFamily || '')) ? (k.fontFamily || '') : '', PHONG,
        (v) => doiKieu({ fontFamily: v || null })),
      oChon('Cỡ chữ', String(co), cacCo, (v) => doiKieu({ fontSize: Number(v) })),
      kieu,
      oChon('Căn lề', ['trai', 'giua', 'phai'].includes(k.align) ? k.align : 'giua',
        [['trai', 'Trái'], ['giua', 'Giữa'], ['phai', 'Phải']], (v) => doiKieu({ align: v })),
      mau('Màu chữ', laHex(k.color) ? k.color : '#ffffff', (v) => doiKieu({ color: v })),
      mau('Màu từ đang đọc', laHex(k.activeColor) ? k.activeColor : (laHex(k.color) ? k.color : '#ff4d4f'),
        (v) => doiKieu({ activeColor: v })),
      oTick('Viền chữ', coVien, (bat) => doiKieu({ outlineColor: bat ? '#000000' : null })),
      coVien ? mau('Màu viền', k.outlineColor, (v) => doiKieu({ outlineColor: v })) : null,
      truot('Nền sau chữ', doMo, 0, 100, 5, '%', (v) => doiKieu({ bgOpacity: v })),
      doMo > 0 ? mau('Màu nền', laHex(k.bgColor) ? k.bgColor : '#000000', (v) => doiKieu({ bgColor: v })) : null,
      oChon('Vị trí', k.position === 'tren' ? 'tren' : 'duoi', [['duoi', 'Dưới'], ['tren', 'Trên']], (v) => doiKieu({
        position: v,
        // subtitleCssFromSettings chỉ lật neo khi CÓ `bottom` — chưa có thì điền mặc định CSS (96 px).
        ...(Number(k.bottom) >= 40 && Number(k.bottom) <= 180 ? {} : { bottom: 96 }),
      })),
      truot(k.position === 'tren' ? 'Cách đỉnh' : 'Cách đáy', Math.min(180, Math.max(40, Math.round(Number(k.bottom) || 96))), 40, 180, 4, 'px',
        (v) => doiKieu({ bottom: v })));
  }

  /* ── thân tab Thuộc tính khi chọn C1 / một câu phụ đề ────────────────── */
  function vePhuDe(than, h) {
    const { nhom, oTick, tao } = h;
    const dg = D();
    const d = dg && dg.duAn ? dg.duAn() : null;
    const chiDoc = !!(dg && dg.chiDoc && dg.chiDoc());
    const dau = tao('div', 'bk-dau');
    dau.appendChild(tao('b', 'bk-ten', 'C1 · Phụ đề'));
    dau.appendChild(tao('span', 'bk-phu', laVideo()
      ? 'Phụ đề tự động của dự án — sửa chữ, giờ ngay trên track C1.'
      : 'Phụ đề karaoke của video — kiểu chữ áp cho cả video slide lẫn bản dựng.'));
    than.appendChild(dau);
    // Deck: cờ ở preview-settings.json ⇒ dự án timeline chỉ đọc vẫn bật/tắt được. Dự án video: cờ ở timeline.
    if (coPhuDe() && !(laVideo() && chiDoc)) {
      than.appendChild(oTick('Hiện phụ đề trong video', !tat(), (bat) => { datTat(!bat); }));
    }
    if (laVideo()) {
      // Tạo / tạo lại / xoá phụ đề tự động (du-an-video.js).
      if (RP.duAnVideo && RP.duAnVideo.nhomPhuDe) than.appendChild(RP.duAnVideo.nhomPhuDe(h));
    } else if (dg && dg.phuDeTt && dg.phuDeTt()) {
      const daSua = !!(d && d.phuDe);
      const kp = tao('button', 'bk-nut', 'Khôi phục phụ đề gốc');
      kp.type = 'button';
      kp.disabled = !daSua || chiDoc;
      kp.onclick = () => dg.datPhuDe(null, 'Khôi phục phụ đề gốc');
      const hk = tao('div', 'bk-nut-hang');
      hk.appendChild(kp);
      than.appendChild(nhom('Câu phụ đề', tao('div', 'bk-phu', daSua
        ? 'Đã sửa phụ đề — bản dựng vẽ lại phụ đề lên trên mọi khối.'
        : 'Sửa ngay trên track C1: bấm đúp sửa chữ, kéo mép đổi giờ, dao cạo (C) tách câu, Delete xoá câu.'), hk));
    } else if (tat()) {
      // Đã dựng lúc phụ đề TẮT ⇒ không có lớp phụ đề để sửa câu (pipeline bỏ bước tách lớp).
      than.appendChild(nhom('Câu phụ đề', tao('div', 'bk-phu',
        'Phụ đề đang tắt. Bật lại rồi bấm "Tạo video" để có phụ đề — sửa được từng câu trên track C1.')));
    } else if (dg && dg.coVideo && dg.coVideo()) {
      than.appendChild(nhom('Câu phụ đề', tao('div', 'bk-phu',
        'Video slide này dựng bằng bản cũ (phụ đề đốt thẳng vào hình). Bấm "Tạo video" lại để sửa được câu phụ đề trên timeline.')));
    } else {
      than.appendChild(nhom('Câu phụ đề', tao('div', 'bk-phu',
        'Chưa có video — bấm "Tạo video" để có phụ đề, sau đó sửa được từng câu trên track C1.')));
    }
    if (laVideo() ? !!(d && d.phuDe) : true) than.appendChild(nhomKieu(h));
    if (!laVideo()) {
      // Chép toàn bộ lời thoại / phụ đề (trước ở cuối tab Phụ đề) — bấm hộ nút thật của danh sách dự án.
      const nutChep = tao('button', 'bk-nut', 'Chép toàn bộ phụ đề');
      nutChep.type = 'button';
      nutChep.onclick = () => {
        const deck = dg && dg.deck ? dg.deck() : (RP.deckCau && RP.deckCau.deck());
        if (deck && RP.copyProjectScript) RP.copyProjectScript(deck, nutChep);
        else bao('Chưa nạp được bộ chép phụ đề', true);
      };
      const hc = tao('div', 'bk-nut-hang');
      hc.appendChild(nutChep);
      than.appendChild(hc);
    }
  }

  RP.phuDe = { tat, coPhuDe, datTat, docKieu, doiKieu, nhomKieu, vePhuDe };
})();
