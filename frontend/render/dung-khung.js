'use strict';
/**
 * KHUNG CHUẨN khi xem trước bản dựng (Giai đoạn 3 — docs/video-editor/KE-HOACH.md §6).
 *
 * `<video>` của Chromium chạy mượt nhưng khi DỪNG / TUA thì khung hiện ra là khung của bản
 * PROXY (30 fps cố định — media.js) hoặc của lần tua đang dở, không chắc trùng khung bản xuất
 * (ffmpeg đọc tệp GỐC). Ở đây giải mã đúng tệp gốc bằng WebCodecs qua Mediabunny (MPL-2.0,
 * src/ui-classic/vendor/mediabunny/) và vẽ ra canvas đè lên `<video>` khi đang dừng:
 *   · cùng luật chọn khung với bản xuất: khung CUỐI có pts ≤ giây cần (fps=…:round=up trong
 *     dung/xuat.js), pts tính từ đầu tệp như ffmpeg (trừ mốc đầu nhỏ nhất của các luồng —
 *     không tính phần mồi âm của AAC, ffmpeg cũng bỏ qua phần đó);
 *   · tua dồn dập ⇒ chỉ vẽ yêu cầu MỚI NHẤT, yêu cầu cũ bỏ;
 *   · tệp WebCodecs không giải được (ProRes, HEVC máy không hỗ trợ…) ⇒ trả false, bên gọi
 *     giữ `<video>` như cũ — không bao giờ hỏng xem trước vì tính năng này.
 * Byte tệp đi qua IPC (`dung:docByte`, chỉ tệp trong dung/media/ của deck) chứ không mở CORS
 * cho `bee-media://`.
 */
(function () {
  const B = window.__beeDung || (window.__beeDung = {});
  const api = () => window.beeknoee && window.beeknoee.dung;
  const RONG_TOI_DA = 1280;            // khung xem trước nhỏ — giải 4K ra canvas 4K chỉ tốn bộ nhớ
  const TRAN_NGUON = 6;                // số tệp giữ bộ giải mã cùng lúc (LRU)
  const TRAN_MOT_LAN = 16 * 1024 * 1024;   // = TRAN_DOC_BYTE của dung:docByte
  const HONG_SAU = 3;                  // giải hỏng liên tiếp chừng này lần ⇒ coi tệp là không giải được
  /* Đầu phát giữ mili-giây NGUYÊN: khung 31 ở 30 fps (1,03333 s) thành 1,033 s — rơi xuống khung
     30, trong khi bản xuất tính đúng k/fps. Cộng nửa mili-giây trước khi chọn khung. */
  const BU_MS = 0.0005;

  let thuVien = null;
  let theHe = 0;                       // tăng mỗi lần `don()` — yêu cầu của thế hệ cũ bỏ
  const nguon = new Map();             // `${deck}|${tep}` → { hua, dangDung, bo, hongLienTiep }
  const hongHan = new Set();           // tệp đã biết là không giải được (ngoài LRU — bị đẩy ra vẫn nhớ)

  function napThuVien() {
    if (!thuVien) {
      thuVien = (typeof VideoDecoder === 'undefined' ? Promise.resolve(null) : import('../vendor/mediabunny/mediabunny.min.mjs'))
        .catch((e) => { console.warn('[dung-khung] không nạp được Mediabunny:', e && e.message); return null; });
    }
    return thuVien;
  }

  async function docKhoang(deck, tep, tu, den) {
    const a = api();
    const ra = new Uint8Array(den - tu);
    for (let i = tu; i < den; i += TRAN_MOT_LAN) {
      const can = Math.min(den, i + TRAN_MOT_LAN) - i;
      const b = await a.docByte(deck, tep, i, i + can);
      // Thiếu byte (tệp bị cắt / đổi giữa chừng) thì báo hỏng — đừng để phần còn lại toàn số 0.
      if (!b || b.length !== can) throw new Error('Không đọc được tệp media.');
      if (can === den - tu) return b;
      ra.set(b, i - tu);
    }
    return ra;
  }

  async function moNguon(deck, m) {
    const MB = await napThuVien();
    const a = api();
    if (!MB || !a || !a.coByte) return null;
    const co = await a.coByte(deck, m.tep);
    if (!co) return null;
    const input = new MB.Input({
      formats: MB.ALL_FORMATS,
      source: new MB.CustomSource({
        getSize: () => co, read: (tu, den) => docKhoang(deck, m.tep, tu, den),
        maxCacheSize: 32 * 1024 * 1024, prefetchProfile: 'fileSystem',
      }),
    });
    try {
      const vt = await input.getPrimaryVideoTrack();
      if (!vt || !(await vt.canDecode())) { input.dispose(); return null; }
      /* Mốc 0 của ffmpeg (không -copyts) = mốc đầu nhỏ nhất của các luồng, nhưng phần mồi của
         AAC (gói tiếng ở −0,021 s, iPhone −0,048 s) KHÔNG tính — ffmpeg cộng skip_samples. Lấy
         mốc đầu từng luồng, kẹp âm về 0, rồi lấy nhỏ nhất. */
      let lech = Infinity;
      for (const t of await input.getTracks()) {
        try { const d = await t.getFirstTimestamp(); if (Number.isFinite(d)) lech = Math.min(lech, Math.max(0, d)); } catch { /* luồng rỗng */ }
      }
      const rong = await vt.getDisplayWidth();
      const sink = new MB.CanvasSink(vt, {
        ...(rong > RONG_TOI_DA ? { width: RONG_TOI_DA } : {}),
        alpha: /^yuva|^rgba|^bgra|^argb/.test(m.pixFmt || ''),
        // Không dùng chung canvas trong bể: nhiều khối cùng tệp giải cùng nhịp sẽ đè khung của nhau.
        poolSize: 0,
      });
      return { input, sink, lech: Number.isFinite(lech) ? lech : 0 };
    } catch (e) {
      console.warn('[dung-khung] không mở được', m.ten || m.tep, e && e.message);
      try { input.dispose(); } catch { /* bỏ */ }
      return null;
    }
  }

  function boNguon(n) {
    n.bo = true;
    if (n.dangDung > 0) return;          // còn lượt giải đang chạy — nhả khi xong
    n.hua.then((x) => { if (x) try { x.input.dispose(); } catch { /* bỏ */ } });
  }

  function layNguon(deck, m) {
    const khoa = `${deck}|${m.tep}`;
    let n = nguon.get(khoa);
    if (!n) {
      n = { hua: moNguon(deck, m), dangDung: 0, bo: false, hongLienTiep: 0 };
      n.hua.then((x) => { if (!x) hongHan.add(khoa); });
      nguon.set(khoa, n);
      // LRU: bỏ nguồn dùng lâu nhất.
      while (nguon.size > TRAN_NGUON) {
        const [k0, n0] = nguon.entries().next().value;
        nguon.delete(k0);
        boNguon(n0);
      }
    } else {
      nguon.delete(khoa);
      nguon.set(khoa, n);
    }
    return n;
  }

  /** Media này đã thử mà không giải được ⇒ đừng tạo canvas nữa. */
  const hong = (deck, m) => hongHan.has(`${deck}|${m.tep}`);

  /**
   * Vẽ khung tại giây `g` của tệp media (cùng trục với currentTime của `<video>`) vào `cv`.
   * Gọi liên tục (tua) thì chỉ yêu cầu MỚI NHẤT được vẽ. `xong(cv)` gọi sau mỗi lần vẽ được.
   * Khung đã vẽ ghi ở `cv.__khung.daVe = { khoa, g }`.
   */
  async function ve(cv, deck, m, g, xong) {
    const st = cv.__khung || (cv.__khung = { muon: null, dang: false, daVe: null, dangGiai: null });
    const khoa = `${deck}|${m.tep}`;
    // Đúng khung đang giải / vừa vẽ ⇒ khỏi xếp lại (capNhat gọi theo mỗi sự kiện).
    const trung = (x) => !!(x && x.khoa === khoa && Math.abs(x.g - g) < 1e-6);
    if (trung(st.dang ? st.dangGiai : st.daVe) && !st.muon) return;
    st.muon = { khoa, g, deck, m, theHe };
    if (st.dang) return;
    st.dang = true;
    try {
      while (st.muon && cv.isConnected) {
        const y = st.muon;
        st.muon = null;
        if (y.theHe !== theHe || hongHan.has(y.khoa)) continue;   // đã đổi deck / tệp hỏng
        st.dangGiai = y;
        const n = layNguon(y.deck, y.m);
        n.dangDung += 1;
        let wc = null;
        let loi = false;
        try {
          const x = await n.hua;
          if (x) wc = await x.sink.getCanvas(y.g + BU_MS + x.lech);
        } catch (e) {
          loi = true;
          console.warn('[dung-khung] giải khung hỏng:', e && e.message);
        } finally {
          n.dangDung -= 1;
          if (n.bo && n.dangDung === 0) boNguon(n);
        }
        if (loi && !n.bo && (n.hongLienTiep += 1) >= HONG_SAU) hongHan.add(y.khoa);
        if (!loi) n.hongLienTiep = 0;
        if (st.muon) continue;               // đã có yêu cầu mới hơn trong lúc giải
        if (!wc || !cv.isConnected || y.theHe !== theHe) return;
        const src = wc.canvas;
        if (cv.width !== src.width || cv.height !== src.height) { cv.width = src.width; cv.height = src.height; }
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.drawImage(src, 0, 0);
        st.daVe = { khoa: y.khoa, g: y.g };
        if (xong) xong(cv);
      }
    } finally {
      st.dang = false;
      st.dangGiai = null;
    }
  }

  /** Canvas `cv` đang mang đúng khung (deck, media, giây) chưa. */
  function dung(cv, deck, m, g) {
    const d = cv && cv.__khung && cv.__khung.daVe;
    return !!(d && d.khoa === `${deck}|${m.tep}` && Math.abs(d.g - g) < 1e-6);
  }

  /** Đổi deck / đóng lớp: nhả mọi bộ giải mã. */
  function don() {
    theHe += 1;
    nguon.forEach((n) => boNguon(n));
    nguon.clear();
  }

  B.khung = { ve, dung, hong, don, napThuVien };
})();
