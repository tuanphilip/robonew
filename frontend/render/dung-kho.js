'use strict';
/**
 * KHO TRẠNG THÁI của trình dựng phía giao diện — `RP.dung` (docs/video-editor/KE-HOACH.md).
 *
 * Một nguồn sự thật cho ba mảnh giao diện: tab Thư viện (thu-vien.js), các track
 * người dùng trên timeline (timeline.js + timeline-sua.js), bảng Khối (bang-khoi.js)
 * và lớp ghép trên sân khấu (dung-xem.js). Không mảnh nào tự giữ bản dự án riêng.
 *
 *   · Dự án đọc/ghi qua `window.beeknoee.dung` (tiến trình chính kiểm + ghi nguyên tử).
 *   · Mọi thay đổi đi qua `lam(f, ten)` → ngăn hoàn tác (src/dung/nganLenh.js) → tự
 *     lưu sau khi im tay. Kết quả không qua `moHinh.kiem` thì bị BỎ, trạng thái giữ nguyên.
 *   · `duAn()` trả THAM CHIẾU bản hiện tại — coi như chỉ đọc, đừng sửa tại chỗ.
 *
 * Sự kiện `nghe(f)`: f(loai) với loai ∈ 'nap' | 'duAn' | 'chon' | 'cache' | 'loi' | 'moc'.
 */
(function () {
  const api = window.beeknoee;
  const D = window.__beeDung || {};
  if (!api || !api.dung || !D.moHinh || !D.nganLenh) return;
  const RP = (window.__renderPage = window.__renderPage || {});
  const M = D.moHinh;

  const MS_ANH = 5000;           // ảnh thả vào timeline mặc định dài 5 giây

  let deck = '';
  let ngan = null;
  let hienTai = null;            // tham chiếu bản dự án hiện tại (chỉ đọc)
  let moc = [];                  // mốc slide ms THẬT (timing.json của video đã dựng)
  /* Mốc dùng cho MỌI phép tính: thật nếu có; chưa dựng video thì lấy mốc ƯỚC của timeline
     (cùng mốc người dùng đang nhìn). Không có mốc mà kéo khối là khối neo về slide 0 trong
     khi khối khác vẫn hiện theo `lechMs` — lệch nhau sau lần dựng (audit 10/10/2026). */
  let mocNho = { goc: null, v1: '', ra: [] };
  function mocDung() {
    const n = RP.timeline && RP.timeline.noi;
    const goc = moc.length ? moc : (n && n.mocUoc ? n.mocUoc() : []);
    /* V1 đã sửa (cắt / đổi chỗ slide, Giai đoạn 3): mốc mang ánh xạ giây gốc ↔ giây timeline
       (moHinh.mocDich). Nhớ theo tham chiếu mốc + nội dung V1 — xem trước gọi mỗi khung hình. */
    // Khối slide (GĐ3.1): { batDauMs, doan } — dời khối slide / sửa V1 đều đổi ánh xạ.
    const sl = hienTai && hienTai.slide;
    const v1 = sl ? `${JSON.stringify(sl)}@${hienTai.khung.fps}` : '';
    if (mocNho.goc !== goc || mocNho.v1 !== v1) mocNho = { goc, v1, ra: M.mocDich(goc, sl, hienTai && hienTai.khung.fps) };
    return mocNho.ra;
  }
  /** Mốc slide GỐC (trục video đã dựng, chưa áp V1) — cho tua video / vẽ sóng âm. */
  function mocGoc() {
    const n = RP.timeline && RP.timeline.noi;
    return moc.length ? moc : (n && n.mocUoc ? n.mocUoc() : []);
  }
  let video = '';                // 'output/<deck>.mp4' hoặc ''
  let tachTieng = null;          // { giong, deck } đường tương đối hai lớp tiếng tách sẵn, hoặc null
  let phuDeTt = null;            // phụ đề tách lớp: { noPhuDe, captions (gốc), css, khung } hoặc null
  let chiDoc = false;
  let loiDoc = [];
  let maNap = 0;
  /* DỰ ÁN VIDEO TRỐNG (src/dung/duAnVideo.js): 'video' | 'deck'. GĐ3.4: không còn nền đen giả / giãn nền —
     timeline của dự án video dài theo nội dung (moHinh.doDaiChoTha, timeline.js), bản xuất tự sinh nền đen. */
  let loai = 'deck';
  /* BỘ SLIDE PHỤ (GĐ3.7, src/dung/boSlide.js): deck đang mở là `cha::id` — một clip của dự án mẹ. Timeline của nó chỉ
     để XEM (chỉ đọc); { cha, id } hoặc null. */
  let boSlideTin = null;
  const cache = new Map();       // id media → { anh, song, proxy, goc, dangSinh, tienDo }
  let chon = new Set();          // id khối đang chọn
  let chonGoc = null;            // 'giong' | 'deck' | 'phude' (C1 / một câu) | 'v1' (khối slide) — bảng Thuộc tính
  /* Lúc vừa THẢ media / chèn mẫu từ Thư viện — bảng phải đang mở Thư viện thì ĐỪNG tự nhảy sang Thuộc tính
     (người ta đang kéo thả liên tục; chốt 16/10/2026). */
  let lanThemTv = 0;
  const nguoiNghe = new Set();

  const bao = (loai) => nguoiNghe.forEach((f) => { try { f(loai); } catch (e) { console.error('[dung]', e); } });

  /* ── nạp theo deck ─────────────────────────────────────────────────────── */
  async function nap() {
    const ma = ++maNap;
    const ten = (RP.deckCau && RP.deckCau.deck()) || '';
    if (ngan) {
      // Còn thay đổi chưa lưu của deck cũ thì lưu nốt MỘT lần rồi tắt hẳn ngăn đó.
      const tenCu = deck;
      Promise.resolve(ngan.dung()).then((r) => {
        if (r && r.ok === false && RP.setStatus) RP.setStatus(`Không lưu được thay đổi dựng của "${tenCu}": ${(r.loi || []).join(' · ')}`, 'bad');
      }, (e) => { if (RP.setStatus) RP.setStatus(`Không lưu được thay đổi dựng của "${tenCu}": ${e && e.message}`, 'bad'); });
    }
    deck = ten;
    ngan = null; hienTai = null; moc = []; video = ''; tachTieng = null; phuDeTt = null; chiDoc = false; loiDoc = [];
    loai = 'deck'; boSlideTin = null;
    cache.clear(); chon = new Set(); chonGoc = null;
    if (!ten) { bao('nap'); return; }
    let r = null;
    try { r = await api.dung.doc(ten); } catch (e) { r = { ok: false, loiDoc: [e.message] }; }
    if (ma !== maNap) return;
    if (!r || !r.ok) { loiDoc = (r && r.loiDoc) || ['Không đọc được dự án dựng.']; bao('nap'); return; }
    moc = r.moc || [];
    video = r.video || '';
    tachTieng = r.tachTieng || null;
    phuDeTt = r.phuDe || null;
    loai = r.loai === 'video' ? 'video' : 'deck';
    boSlideTin = r.boSlide || null;
    chiDoc = !!r.chiDoc || !!boSlideTin;
    loiDoc = [...(r.loiDoc || [])];
    if (boSlideTin) loiDoc.push(`Đây là bộ slide của dự án "${boSlideTin.cha}" — sửa nội dung / lời thoại ở đây; timeline (vị trí, cắt, chuyển cảnh) chỉnh ở dự án "${boSlideTin.cha}".`);
    if (r.daCatHong) loiDoc.push(`Tệp dự án dựng bị hỏng đã được cất ở dung/${r.daCatHong} — đang mở bản lưu gần nhất.`);
    if (r.duAn) {
      ngan = D.nganLenh.taoNgan(r.duAn, {
        kiem: M.kiem,
        /* Ghi vào ĐÚNG deck của ngăn này — kể cả khi người dùng đã chuyển sang deck khác
           (lượt lưu lại sau một lần hỏng). Trả `ok:true` giả cho deck cũ là mất thay đổi
           âm thầm (audit 10/10/2026). */
        luu: (d) => api.dung.ghi(ten, d),
      });
      hienTai = ngan.lay();
      const n = ngan;
      ngan.nghe((d, ly) => {
        if (n !== ngan) return;   // ngăn của deck cũ — không được đụng trạng thái deck mới
        hienTai = d;
        if (ly === 'loiLuu' || ly === 'daLuu') { bao('loi'); return; }
        // Khối đã bị xoá (hoàn tác) thì bỏ khỏi vùng chọn.
        const con = new Set(d.khoi.map((c) => c.id));
        chon = new Set([...chon].filter((id) => con.has(id)));
        // Hoàn tác "Xoá media" đưa media về: hỏi lại bộ nhớ đệm của nó (audit 10/10/2026).
        d.media.forEach((m) => { if (!cache.has(m.id)) layCache(m.id); });
        bao('duAn');
      });
      // Xin trước bộ nhớ đệm của mọi media (ảnh thu nhỏ cho thư viện + timeline).
      hienTai.media.forEach((m) => layCache(m.id));
    }
    bao('nap');
  }

  /* ── dự án video: độ dài nội dung (GĐ3.4 — hết nền đen giả, không còn "giãn nền") ── */
  const msNoiDung = () => (hienTai ? M.tongMs(hienTai, [], 0) : 0);

  /** Video slide vừa dựng lại (hoặc vừa xuất): đọc lại MỐC + video, GIỮ lịch sử hoàn tác. */
  async function napMoc() {
    if (!deck) return;
    const ten = deck;
    const r = await api.dung.doc(ten).catch(() => null);
    if (!r || !r.ok || ten !== deck) return;
    moc = r.moc || [];
    video = r.video || '';
    tachTieng = r.tachTieng || null;
    phuDeTt = r.phuDe || null;
    /* L3 (rà GĐ3): dung:doc vừa khớp lại neo / đoạn V1 theo DẤU slide và ghi đĩa — ngăn đang mở vẫn giữ chỉ số
       slide CŨ (lần sửa sau sẽ ghi đè bản đúng). Khớp lại ngay trên ngăn, thành MỘT bước hoàn tác. */
    if (ngan && hienTai && !chiDoc) {
      const kq = M.khopSlide(hienTai, moc);
      if (kq.doi) {
        ngan.lam(() => kq.duAn, 'Theo lại slide sau khi dựng');
        if (RP.setStatus) RP.setStatus(`Deck đã đổi thứ tự / thêm slide — ${kq.doi} khối / đoạn V1 đã theo lại đúng slide.`, 'good');
      }
    }
    bao('moc');
  }

  /* ── bộ nhớ đệm media ──────────────────────────────────────────────────── */
  const dangHoi = new Set();
  async function layCache(id) {
    const m = mediaCua(id);
    if (!m || !deck || dangHoi.has(id)) return cache.get(id) || null;
    dangHoi.add(id);
    const ten = deck;
    try {
      const r = await api.dung.cache(ten, m);
      if (ten !== deck) return null;
      cache.set(id, { ...(cache.get(id) || {}), ...r });
      bao('cache');
      return cache.get(id);
    } catch { return null; } finally { dangHoi.delete(id); }
  }
  if (api.dung.onCacheXong) {
    api.dung.onCacheXong((x) => {
      if (!x || x.deck !== deck) return;
      if (x.loai === 'proxy' && cache.has(x.id)) cache.get(x.id).tienDo = null;
      layCache(x.id);
    });
  }
  // Dọn dẹp vừa xoá bộ nhớ đệm của deck này: bỏ URL cũ (404) rồi hỏi lại — main sinh lại nền.
  if (api.dung.onCacheBo) {
    api.dung.onCacheBo((x) => {
      if (!x || x.deck !== deck || !hienTai) return;
      cache.clear();
      bao('cache');
      hienTai.media.forEach((m) => layCache(m.id));
    });
  }
  if (api.dung.onTienTrinh) {
    api.dung.onTienTrinh((x) => {
      if (!x || x.deck !== deck || x.loai !== 'proxy') return;
      cache.set(x.id, { ...(cache.get(x.id) || {}), tienDo: x.phan });
      bao('cache');
    });
  }

  /* ── tra cứu ───────────────────────────────────────────────────────────── */
  /** Bộ nhớ đệm của media. URL tệp gốc (và ảnh thu nhỏ của CHỮ) luôn tính từ `tep` HIỆN TẠI:
   *  sửa chữ / hoàn tác đổi tệp mà giữ id — URL nhớ theo id sẽ trỏ ảnh của bản khác. */
  function cacheCua(id) {
    const ca = cache.get(id) || null;
    const m = mediaCua(id);
    if (!m || !deck) return ca;
    const goc = M.urlMedia(deck, m.tep);
    return { ...(ca || {}), goc, ...(m.chu ? { anh: goc } : {}) };
  }
  const mediaCua = (id) => (hienTai ? hienTai.media.find((m) => m.id === id) : null);
  const khoiCua = (id) => (hienTai ? hienTai.khoi.find((c) => c.id === id) : null);
  const trackCua = (id) => (hienTai ? hienTai.track.find((t) => t.id === id) : null);

  /** Khối `c` (đặt ở vị trí mới) có chồng khối nào khác trên cùng track không. */
  function chong(d, c, boQua) {
    const a = M.batDauMs(c, mocDung());
    const b = M.ketThucMs(c, mocDung());
    return d.khoi.some((x) => x.track === c.track && x.id !== c.id && !(boQua && boQua.has(x.id))
      && M.batDauMs(x, mocDung()) < b && M.ketThucMs(x, mocDung()) > a);
  }

  /** Giây trống gần nhất từ `ms` trở đi trên một track cho một khối dài `dai` ms. */
  function choTrong(d, trackId, ms, dai, boQua) {
    let t = Math.max(0, Math.round(ms));
    const ds = d.khoi.filter((x) => x.track === trackId && !(boQua && boQua.has(x.id)))
      .map((x) => [M.batDauMs(x, mocDung()), M.ketThucMs(x, mocDung())]).sort((p, q) => p[0] - q[0]);
    for (const [a, b] of ds) {
      if (t + dai <= a) break;
      if (t < b) t = b;
    }
    return t;
  }

  /** Số cặp khối chồng nhau trên cùng track theo mốc `mc`. */
  function demChong(khoi, mc) {
    let n = 0;
    const theoTrack = new Map();
    khoi.forEach((c) => { if (!theoTrack.has(c.track)) theoTrack.set(c.track, []); theoTrack.get(c.track).push([M.batDauMs(c, mc), M.ketThucMs(c, mc)]); });
    theoTrack.forEach((ds) => {
      ds.sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < ds.length; i += 1) if (ds[i][0] < ds[i - 1][1] - 0.5) n += 1;
    });
    return n;
  }

  /**
   * Sửa V1 (cắt / đổi chỗ / bỏ slide). Khối gắn slide VỪA bị bỏ giữ nguyên chỗ trên timeline (thành
   * khối không neo) thay vì dồn về đầu slide kề sau rồi chồng lên nhau; vẫn sinh chồng khối thì
   * từ chối, báo rõ (audit GĐ3).
   */
  /** @param {{ batDauMs?: number }} [o] dời khối slide TRONG CÙNG thao tác (MCP sequence + start_s): kiểm chồng
   *  một lần cho cả hai, hỏng thì không đổi gì — làm hai bước thì bước sau hỏng để lại bước trước (rà GĐ3). */
  function datV1(doan, ten, o = {}) {
    // Mỗi đoạn mang DẤU slide (L3, GĐ3.1) — deck đổi thứ tự slide thì đoạn tìm lại đúng slide.
    const g0 = mocGoc();
    const dsDoan = doan && doan.length
      ? doan.map((x) => ({ slide: x.slide, vaoMs: x.vaoMs, raMs: x.raMs, ...(g0[x.slide] && g0[x.slide].dau ? { dau: g0[x.slide].dau } : {}) }))
      : null;
    let loiChong = null;
    const bdMoi = Number.isFinite(o.batDauMs) ? Math.max(0, Math.round(o.batDauMs)) : null;
    const r = lam((d) => {
      // Dự án KHÔNG có khối slide (dự án video): "khôi phục V1" không được đẻ ra khối slide (rà GĐ3).
      if (!d.slide && !dsDoan && bdMoi == null) return d;
      const cu = mocDung();
      const slide = { batDauMs: bdMoi != null ? bdMoi : ((d.slide && d.slide.batDauMs) || 0), doan: dsDoan };
      const moi = M.mocDich(mocGoc(), slide, d.khung.fps);
      const boCu = cu.boSlide || new Set();
      const boMoi = moi.boSlide || new Set();
      const khoi = d.khoi.map((c) => (c.neo && boMoi.has(c.neo.slide) && !boCu.has(c.neo.slide)
        ? { ...c, neo: null, batDauMs: Math.max(0, Math.round(M.batDauMs(c, cu))) } : c));
      if (demChong(khoi, moi) > demChong(d.khoi, cu)) {
        loiChong = 'Sửa V1 như vậy làm các khối trên timeline chồng lên nhau — dời hoặc xoá bớt khối gắn các slide này trước.';
        return d;
      }
      return { ...d, slide, khoi };
    }, ten || 'Sửa V1');
    if (loiChong) {
      console.warn('[dung] thao tác bị bỏ:', loiChong);
      bao('loi');
      return { ok: false, loi: [loiChong], ma: 'chong' };
    }
    return r;
  }

  /**
   * DỜI KHỐI SLIDE (GĐ3.3): video slide + giọng / nhạc / tiếng chuyển của deck + phụ đề + khối GẮN slide đi cùng;
   * khối đứng yên theo giây (nhạc nền đặt từ 0, intro…) ở lại. Sinh thêm chồng khối thì từ chối (như datV1).
   */
  function datBatDauSlide(ms, ten) {
    if (!hienTai || !hienTai.slide) return { ok: false, loi: ['Dự án không có khối slide.'] };
    const bd = Math.max(0, Math.round(Number(ms) || 0));
    let loiChong = null;
    const r = lam((d) => {
      if (!d.slide || d.slide.batDauMs === bd) return d;
      const slide = { ...d.slide, batDauMs: bd };
      const moi = M.mocDich(mocGoc(), slide, d.khung.fps);
      if (demChong(d.khoi, moi) > demChong(d.khoi, mocDung())) {
        loiChong = 'Dời khối slide tới đó làm khối gắn slide chồng lên khối khác trên cùng track — dời khối kia ra trước.';
        return d;
      }
      return { ...d, slide };
    }, ten || 'Dời khối slide');
    if (loiChong) {
      if (RP.setStatus) RP.setStatus(loiChong, 'warn');
      return { ok: false, loi: [loiChong], ma: 'chong' };
    }
    return r;
  }

  /**
   * ĐÓNG BĂNG trước khi tiến trình chính viết lại du-an.json (thêm bộ slide — render/them-slide.js): lưu NỐT thay
   * đổi đang chờ rồi tắt ngăn — thao tác sau đó bị từ chối (chỉ đọc) thay vì lượt lưu hẹn giờ / ngan.dung() của
   * nap() ghi mô hình CŨ đè bản main vừa ghi (rà GĐ3). Xong việc thì nap() (thành công) hoặc nap() lại (hỏng).
   */
  async function dongBang() {
    if (!ngan) return { ok: true };
    const n = ngan;
    ngan = null;
    try { return (await n.dung()) || { ok: true }; } catch (e) { return { ok: false, loi: [e && e.message] }; }
  }

  /* ── thao tác ──────────────────────────────────────────────────────────── */
  function lam(f, ten) {
    if (!ngan || chiDoc) return { ok: false, loi: ['Dự án đang ở chế độ chỉ đọc.'] };
    const r = ngan.lam(f, ten);
    if (!r.ok) { console.warn('[dung] thao tác bị bỏ:', r.loi); bao('loi'); }
    return r;
  }

  /** Thêm media vào dự án (bỏ qua id đã có). */
  function themMedia(ds) {
    const moi = ds.filter((m) => !mediaCua(m.id));
    if (!moi.length) return;
    lam((d) => ({ ...d, media: [...d.media, ...moi.map(({ daCo, tuThuVien, ...m }) => m)] }), 'Nhập media');
    moi.forEach((m) => layCache(m.id));
  }

  /* ⚠ Giữ TÊN deck trước khi chờ: chép tệp lớn mất vài giây, người dùng chuyển deck
     giữa chừng thì media (đã chép vào deck A) không được thêm vào dự án deck B
     (audit 10/10/2026). Lần mở lại deck A, media vẫn nằm trong dung/media — nhập lại
     là nhận ngay (cùng băm). */
  async function nhap(duong) {
    const ten = deck;
    if (!ten) return { media: [], loi: ['Chưa mở dự án.'] };
    // Chỉ đọc (bộ slide phụ / bản app mới hơn): chặn TRƯỚC khi chép — chép rồi mới bị từ chối là rác nằm lại (rà 3.7).
    if (chiDoc) return { media: [], loi: [boSlideTin ? `Bộ slide phụ không có timeline riêng — nhập media ở dự án "${boSlideTin.cha}".` : 'Dự án dựng đang ở chế độ chỉ đọc.'] };
    const r = await api.dung.nhap(ten, duong);
    if (ten === deck) themMedia(r.media || []);
    else r.loi = [...(r.loi || []), `Đã chuyển dự án trong lúc nhập — media đã chép vào "${ten}", mở lại dự án đó để dùng.`];
    return r;
  }
  async function chonTep() {
    const ten = deck;
    if (!ten) return { media: [], loi: ['Chưa mở dự án.'] };
    if (chiDoc) return { media: [], loi: [boSlideTin ? `Bộ slide phụ không có timeline riêng — nhập media ở dự án "${boSlideTin.cha}".` : 'Dự án dựng đang ở chế độ chỉ đọc.'] };
    const r = await api.dung.chonTep(ten);
    if (ten === deck) themMedia(r.media || []);
    return r;
  }

  /** Track `t` nhận được media `m` không: hình nhận video/ảnh; tiếng nhận âm thanh và video CÓ tiếng. */
  const hopTrack = (t, m) => !!t && !t.khoa
    && (t.loai === 'hinh' ? m.loai !== 'tieng' : (m.loai === 'tieng' || (m.loai === 'video' && m.coTieng)));
  /** Track đầu tiên nhận được loại media này (khi thả vào chỗ không phải track). */
  function trackHopVoi(m) {
    const loai = m.loai === 'tieng' ? 'tieng' : 'hinh';
    return hienTai.track.find((t) => t.loai === loai && hopTrack(t, m)) || null;
  }

  /**
   * Thả media lên timeline. Chỗ đã có khối thì dời ra sau (không chồng trong một track).
   * @returns {string|null} id khối mới
   */
  function themKhoi(mediaId, trackId, ms) {
    const m = mediaCua(mediaId);
    if (!m || !hienTai) return null;
    let t = trackCua(trackId);
    if (!hopTrack(t, m)) t = trackHopVoi(m);
    if (!t) return null;
    const dai = m.loai === 'anh' ? MS_ANH : m.ms;
    const id = M.taoId('k', hienTai.khoi.map((c) => c.id));
    let mk = null;
    const r = lam((d) => {
      const bd = choTrong(d, t.id, ms, dai);
      const c = M.datChoMs({
        id, track: t.id, media: m.id, neo: { slide: 0, lechMs: 0 }, batDauMs: 0,
        vaoMs: 0, raMs: dai, tocDo: 1, bienDoi: { x: 0.5, y: 0.5, co: 1, xoay: 0, mo: 1 },
        amLuong: 1, mo: { vaoMs: 0, raMs: 0 },
      }, bd, mocDung());
      mk = c;
      return { ...d, khoi: [...d.khoi, c] };
    }, `Thêm ${m.ten}`);
    if (!r.ok) return null;
    lanThemTv = Date.now();
    datChon([mk.id]);
    return mk.id;
  }

  /**
   * Đặt BỘ SLIDE PHỤ vừa tạo (main/duAn.js#taoBoSlidePhu → `media` boSlide) lên timeline: một clip video giờ TUYỆT ĐỐI
   * (không neo slide của bộ đầu) trên track hình đầu tiên còn trống ở `ms`; hết chỗ thì thêm track hình. MỘT bước hoàn tác.
   * @returns {{ ok: boolean, khoi?: string, loi?: string[] }}
   */
  function themBoSlide(m, ms, o = {}) {
    if (!hienTai || chiDoc || !ngan) return { ok: false, loi: ['Dự án đang chỉ đọc.'] };
    if (!m || !m.boSlide) return { ok: false, loi: ['Không phải bộ slide.'] };
    const bd0 = Math.max(0, Math.round(ms || 0));
    const hop = (x) => !!x && x.loai === 'hinh' && !x.khoa;
    let mk = null;
    /* MỘT thao tác (media + track nếu cần + clip): hỏng ở đâu cũng không để lại media / track lẻ (rà 3.7 — bộ chỉ còn
       media từng bị coi là "đang dùng" và dựng mỗi lần Tạo video). */
    const kq = lam((d) => {
      const media = d.media.some((x) => x.id === m.id) ? d.media : [...d.media, m];
      let track = d.track;
      let t = track.find((x) => hop(x) && choTrong(d, x.id, bd0, m.ms) === bd0) || null;
      if (!t) {
        const co = new Set(track.map((x) => x.id));
        let so = 2;
        while (co.has(`V${so}`)) so += 1;
        t = { id: `V${so}`, loai: 'hinh', ten: 'Bộ slide' };
        track = [...track, t];
      }
      const id = M.taoId('k', d.khoi.map((c) => c.id));
      mk = { id, track: t.id, media: m.id, neo: null, batDauMs: choTrong({ ...d, track }, t.id, bd0, m.ms), vaoMs: 0, raMs: m.ms, tocDo: 1,
        bienDoi: { x: 0.5, y: 0.5, co: 1, xoay: 0, mo: 1 }, amLuong: 1, mo: { vaoMs: 0, raMs: 0 } };
      return { ...d, media, track, khoi: [...d.khoi, mk] };
    }, o.ten || `Thêm ${m.ten}`);
    if (!mk || !kq || !kq.ok) return { ok: false, loi: (kq && kq.loi) || ['Không đặt được bộ slide lên timeline.'] };
    layCache(m.id);
    datChon([mk.id]);
    return { ok: true, khoi: mk.id };
  }

  /* Video MỚI của bộ slide phụ (render/queue.js dựng xong → src/dung/boSlide.js#capNhatSauDung đã ghi đĩa): áp CÙNG
     bản vá lên ngăn đang mở — không thì lượt lưu kế của giao diện ghi đè media cũ (video đen đứng chỗ) lên bản mới. */
  async function apBoSlideMoi(x) {
    if (!x || !Array.isArray(x.media) || !x.media.length || !ngan || !hienTai || chiDoc) return;
    const ten = String(x.projectDir || '').split(/[\\/]/).filter(Boolean).pop();
    if (ten !== deck) return;
    /* Mốc slide MỚI trước (sự kiện tới TRƯỚC render:done — lượt dựng vừa đổi giờ slide): kẹp theo mốc cũ là clip bộ phụ
       có thể dài đè lên khối neo slide phía sau, rồi lượt lưu của giao diện đè bản đúng của main (audit 3.7). */
    const n0 = ngan;
    await napMoc();
    if (n0 !== ngan || ten !== deck || !hienTai || chiDoc) return;
    const n = ngan;
    const moi = M.apMediaBoSlide(hienTai, x.media, mocDung());
    if (moi === hienTai || n !== ngan) return;
    ngan.lam(() => moi, 'Video bộ slide mới');
    x.media.forEach((m) => { cache.delete(m.id); layCache(m.id); });
  }

  function xoaKhoi(ids) {
    const bo = new Set(ids || [...chon]);
    if (!bo.size) return;
    lam((d) => ({ ...d, khoi: d.khoi.filter((c) => !bo.has(c.id)) }), bo.size > 1 ? `Xoá ${bo.size} khối` : 'Xoá khối');
    datChon([]);
  }

  /** Xoá media khỏi dự án — kèm mọi khối đang dùng nó (giao diện hỏi trước). */
  function xoaMedia(id) {
    lam((d) => ({ ...d, media: d.media.filter((m) => m.id !== id), khoi: d.khoi.filter((c) => c.media !== id) }), 'Xoá media');
    cache.delete(id);
  }

  /**
   * Sửa một khối: `f(c) → c mới`. Va chạm với khối khác trên cùng track (vd tăng tốc độ
   * chậm lại làm khối dài ra) ⇒ KHÔNG đổi, trả lỗi và báo ở dòng trạng thái — không
   * lặng lẽ như thể đã sửa (audit 10/10/2026).
   */
  function suaKhoi(id, f, ten) {
    const d0 = hienTai;
    const i0 = d0 ? d0.khoi.findIndex((c) => c.id === id) : -1;
    if (i0 < 0) return { ok: false, loi: ['Không thấy khối.'] };
    const c0 = f(d0.khoi[i0]);
    if (c0 && chong({ ...d0, khoi: d0.khoi.map((x, j) => (j === i0 ? c0 : x)) }, c0)) {
      const loi = 'Không đổi được: khối sẽ chồng lên khối khác trên cùng track — dời khối kia ra trước.';
      if (RP.setStatus) RP.setStatus(loi, 'warn');
      return { ok: false, loi: [loi] };
    }
    return lam((d) => {
      const i = d.khoi.findIndex((c) => c.id === id);
      if (i < 0) return d;
      const c = f(d.khoi[i]);
      if (!c || chong({ ...d, khoi: d.khoi.map((x, j) => (j === i ? c : x)) }, c)) return d;
      const khoi = d.khoi.slice();
      khoi[i] = c;
      return { ...d, khoi };
    }, ten);
  }

  /**
   * Cắt khối tại giây `ms` (dao cạo / Ctrl+K). Ảnh: chia đôi thời lượng; video/tiếng:
   * hai khối dùng chung media, đoạn vào/ra nối liền nhau.
   */
  function catTai(id, msVao) {
    const c = khoiCua(id);
    if (!c) return false;
    const ms = Math.round(msVao);
    const a = M.batDauMs(c, mocDung());
    const b = M.ketThucMs(c, mocDung());
    if (ms <= a + 30 || ms >= b - 30) return false;
    const lechNguon = Math.round((ms - a) * (c.tocDo || 1));
    const id2 = M.taoId('k', hienTai.khoi.map((x) => x.id));
    const r = lam((d) => {
      const i = d.khoi.findIndex((x) => x.id === id);
      // Keyframe tách theo chỗ cắt (giờ trong khối): mỗi nửa giữ đúng hình ở chỗ cắt.
      const [kfDau, kfSau] = M.kfTach(c.kf || {}, ms - a);
      const dau = { ...c, raMs: c.vaoMs + lechNguon, mo: { ...c.mo, raMs: 0 }, kf: kfDau };
      /* Hiệu ứng chuyển động (GĐ2.3): chia khúc tiến độ tại chỗ cắt — nửa sau chạy TIẾP, không phóng lại từ đầu. */
      let huSau = c.hieuUng;
      if (c.hieuUng) {
        const tu = c.hieuUng.tu || 0;
        const den = c.hieuUng.den == null ? 1 : c.hieuUng.den;
        /* Tiến độ chạy trên độ dài HIỆN (kể cả phần kéo dài dưới hoà trộn của khối sau — hinhTai `o.dai`): chia theo
           đó thì hai nửa giữ nguyên tốc độ chuyển động như trước khi cắt (rà GĐ2). */
        const ext = M.keoDaiMs(d, mocDung()).get(c.id) || 0;
        const giua = tu + (den - tu) * Math.max(0, Math.min(1, (ms - a) / (b - a + ext)));
        dau.hieuUng = { ...c.hieuUng, den: giua };
        huSau = { ...c.hieuUng, tu: giua };
      }
      /* Nửa sau đặt ĐÚNG tại cuối nửa đầu (đã làm tròn theo tốc độ) — đặt tại `ms` thì
         với tốc độ ≠ 1 hai nửa chồng nhau 1 ms và mọi lần sửa sau bị từ chối (audit). */
      const sau = M.datChoMs({ ...c, id: id2, vaoMs: c.vaoMs + lechNguon, mo: { ...c.mo, vaoMs: 0, noi: false }, kf: kfSau, hieuUng: huSau },
        M.ketThucMs(dau, mocDung()), mocDung());
      /* Hai nửa làm tròn riêng theo tốc độ có thể dài hơn khối gốc 1 ms ⇒ nửa sau chồng khối kế
         và mọi lần sửa sau bị từ chối (audit 10/10/2026). Bớt đuôi nguồn tới khi hết đúng chỗ cũ. */
      while (M.ketThucMs(sau, mocDung()) > b && sau.raMs - 1 > sau.vaoMs) sau.raMs -= 1;
      const khoi = d.khoi.slice();
      khoi.splice(i, 1, dau, sau);
      return { ...d, khoi };
    }, 'Cắt khối');
    return r.ok;
  }

  function datChon(ids, goc) {
    chon = new Set(ids || []);
    chonGoc = goc || null;
    bao('chon');
  }

  /** Track: thêm (V mới lên trên cùng, A mới xuống dưới cùng), khoá/ẩn/tắt tiếng. */
  function themTrack(loai) {
    lam((d) => {
      const tienTo = loai === 'tieng' ? 'A' : 'V';
      let so = loai === 'tieng' ? 4 : 2;
      const co = new Set(d.track.map((t) => t.id));
      while (co.has(`${tienTo}${so}`)) so += 1;
      const t = { id: `${tienTo}${so}`, loai, ten: loai === 'tieng' ? 'Âm thanh' : 'Hình' };
      return { ...d, track: [...d.track, t] };
    }, loai === 'tieng' ? 'Thêm track tiếng' : 'Thêm track hình');
  }
  function doiTrack(id, sua, ten) {
    lam((d) => ({ ...d, track: d.track.map((t) => (t.id === id ? { ...t, ...sua } : t)) }), ten);
  }
  function doiAmGoc(sua, ten) {
    lam((d) => ({ ...d, amGoc: { ...M.amGocMacDinh(), ...(d.amGoc || {}), ...sua } }), ten);
  }

  /* ── Giai đoạn 2: chữ tiêu đề, điểm đánh dấu, cài đặt bản dựng ─────────── */
  /** Vẽ chữ → ghi PNG (main) → bản ghi media. `id` cũ = sửa chữ của media đó. */
  async function veChu(id, chu) {
    const ten = deck;   // giữ TÊN deck trước khi chờ — chuyển deck giữa chừng thì bỏ
    const ve = RP.chuTieuDe && await RP.chuTieuDe.ve(chu);
    if (!ve) return { ok: false, loi: ['Không vẽ được chữ.'] };
    if (ten !== deck) return { ok: false, loi: ['Đã chuyển sang dự án khác.'] };
    const r = await api.dung.ghiChu(ten, { id, png: ve.png, chu });
    return ten === deck ? r : { ok: false, loi: ['Đã chuyển sang dự án khác.'] };
  }
  /** Thêm chữ tiêu đề lên track hình TRÊN CÙNG tại giây `ms` (mặc định 4 giây). */
  /**
   * @param {{ daiMs?: number, sua?: (khoi: object, media: object) => object, ten?: string }} [o]
   *   `daiMs`: độ dài khối (mặc định 4 s) — tìm chỗ trống theo ĐÚNG độ dài này; `sua`: chỉnh khối
   *   (vị trí, chuyển cảnh…) trước khi đặt — vẫn MỘT bước hoàn tác (MCP `studio_timeline_add_title`).
   */
  async function themChu(ms, chu, o = {}) {
    if (!hienTai || chiDoc) return null;
    const id = M.taoId('m', hienTai.media.map((m) => m.id));
    const r = await veChu(id, { ...(RP.chuTieuDe ? RP.chuTieuDe.CHU_MAC_DINH() : {}), ...(chu || {}) });
    if (!r || !r.ok) { if (RP.setStatus) RP.setStatus((r && r.loi || ['Không tạo được chữ.']).join(' · '), 'bad'); return null; }
    // Tìm track TRƯỚC khi mở nhóm: thoát giữa nhóm là nhóm treo, hoàn tác chết (audit).
    const hinh = hienTai.track.filter((t) => t.loai === 'hinh' && !t.khoa);
    const t = hinh[hinh.length - 1];
    if (!t) { if (RP.setStatus) RP.setStatus('Mọi track hình đang khoá — mở khoá một track để thêm chữ.', 'warn'); return null; }
    const ten = o.ten || 'Thêm chữ tiêu đề';
    const dai = Math.max(100, Math.round(o.daiMs || 4000));
    if (ngan) ngan.batDauNhom(ten);   // nhập media + đặt khối = MỘT bước hoàn tác
    themMedia([r.media]);
    const idK = M.taoId('k', hienTai.khoi.map((c) => c.id));
    let mk = null;
    lam((d) => {
      const bd = choTrong(d, t.id, ms, dai);
      mk = M.datChoMs({ id: idK, track: t.id, media: r.media.id, neo: { slide: 0, lechMs: 0 }, batDauMs: 0, vaoMs: 0, raMs: dai,
        tocDo: 1, bienDoi: { x: 0.5, y: 0.82, co: 1, xoay: 0, mo: 1 }, amLuong: 1, mo: { vaoMs: 300, raMs: 300 } }, bd, mocDung());
      if (o.sua) mk = o.sua(mk, r.media);
      return { ...d, khoi: [...d.khoi, mk] };
    }, ten);
    if (ngan) ngan.ketThucNhom();   // (lam không ném — nhóm luôn được đóng)
    if (mk) datChon([mk.id]);
    return mk && mk.id;
  }
  /* Sửa chữ: mỗi lần là MỘT ảnh mới; lượt cũ về muộn hơn lượt mới thì bỏ (gõ nhanh). */
  const luotChu = new Map();   // lượt RIÊNG theo media — sửa chữ B không được huỷ lượt của chữ A (audit)
  async function suaChu(mediaId, chu, deckLuc) {
    if (deckLuc && deckLuc !== deck) return { ok: false, loi: ['Đã chuyển sang dự án khác.'] };
    const luot = (luotChu.get(mediaId) || 0) + 1;
    luotChu.set(mediaId, luot);
    const r = await veChu(mediaId, chu);
    if (luot !== luotChu.get(mediaId)) return { ok: false, cu: true };
    if (!r || !r.ok) { if (RP.setStatus) RP.setStatus((r && r.loi || ['Không sửa được chữ.']).join(' · '), 'bad'); return r; }
    const kq = lam((d) => ({ ...d, media: d.media.map((m) => (m.id === mediaId ? r.media : m)) }), 'Sửa chữ tiêu đề');
    cache.delete(mediaId);   // URL ảnh cũ — hỏi lại theo tệp mới
    layCache(mediaId);
    return kq;
  }

  /* ── GĐ2.1 lộ trình gộp slide + timeline: giọng đọc thành khối ───────────── */
  /** Track tiếng vai trò 'giong' chưa khoá; chưa có thì thêm "Giọng đọc" (dưới cùng, như themTrack). */
  function trackGiong() {
    const tim = () => hienTai.track.find((t) => t.loai === 'tieng' && t.vaiTro === 'giong' && !t.khoa) || null;
    if (tim()) return tim();
    lam((d) => {
      const co = new Set(d.track.map((t) => t.id));
      let so = 4;
      while (co.has(`A${so}`)) so += 1;
      return { ...d, track: [...d.track, { id: `A${so}`, loai: 'tieng', ten: 'Giọng đọc', vaiTro: 'giong' }] };
    }, 'Thêm track giọng đọc');
    return tim();
  }
  /**
   * Chữ → giọng đọc (main `dung:taoGiong`, Python `tts.chu`) → khối trên track giọng đọc tại giây `ms`.
   * `o.thay` = id khối giọng đang có: đổi sang tệp mới (sửa chữ / đổi giọng) — giữ chỗ, âm lượng, mờ vào/ra.
   * `o.amLuong` = âm lượng khối mới, `o.ten` = tên bước hoàn tác (MCP: "AI: …").
   * Nhập media + đặt / đổi khối (+ âm lượng) = MỘT bước hoàn tác.
   * @param {{ chu: string, engine?: string, voice?: string, model?: string, speed?: number }} tts
   * @returns {Promise<{ ok: boolean, khoi?: string, loi?: string[] }>}
   */
  async function taoGiong(ms, tts, o = {}) {
    const ten = deck;   // giữ TÊN deck trước khi chờ — chuyển deck giữa chừng thì bỏ
    if (!ten || !hienTai || chiDoc) return { ok: false, loi: ['Chưa mở dự án (hoặc dự án đang chỉ đọc).'] };
    const r = await api.dung.taoGiong(ten, tts);
    if (ten !== deck || !hienTai) return { ok: false, loi: ['Đã chuyển sang dự án khác — giọng đọc đã tạo nằm trong bộ đệm, tạo lại là có ngay.'] };
    if (!r || !r.ok) return { ok: false, loi: (r && r.loi) || ['Không tạo được giọng đọc.'] };
    if (o.thay) {
      const c0 = khoiCua(o.thay);
      if (!c0) return { ok: false, loi: ['Khối giọng đọc đã bị xoá.'] };
      // Kiểm CHỖ trước khi nhập media — không thì bước hoàn tác chỉ còn mỗi media mồ côi (rà GĐ2).
      const c1 = { ...c0, media: r.media.id, vaoMs: 0, raMs: r.media.ms };
      if (chong({ ...hienTai, khoi: hienTai.khoi.map((x) => (x.id === c0.id ? c1 : x)) }, c1)) {
        return { ok: false, loi: [`Giọng mới dài ${(M.doDaiMs(c1) / 1000).toFixed(1)} giây — chồng lên khối kế trên track. Dời khối kia ra rồi bấm lại (giọng đã nằm trong bộ đệm, không tính lại).`] };
      }
      let kq;
      if (ngan) ngan.batDauNhom(o.ten || 'Tạo lại giọng đọc');
      try {
        themMedia([r.media]);
        kq = suaKhoi(c0.id, (c) => ({ ...c, media: r.media.id, vaoMs: 0, raMs: r.media.ms }), 'Tạo lại giọng đọc');
      } finally { if (ngan) ngan.ketThucNhom(); }
      if (!kq.ok) return kq;
      datChon([c0.id]);
      return { ok: true, khoi: c0.id };
    }
    let id = null;
    if (ngan) ngan.batDauNhom(o.ten || 'Thêm giọng đọc');
    try {
      themMedia([r.media]);
      const t = trackGiong();
      id = t ? themKhoi(r.media.id, t.id, Math.max(0, Math.round(ms || 0))) : null;
      if (id && typeof o.amLuong === 'number' && o.amLuong !== 1) suaKhoi(id, (c) => ({ ...c, amLuong: o.amLuong }), 'Đổi âm lượng giọng đọc');
    } finally { if (ngan) ngan.ketThucNhom(); }
    if (!id) return { ok: false, loi: ['Không đặt được khối giọng đọc lên timeline.'] };
    // Không phải thả từ Thư viện ⇒ để bảng Thuộc tính tự mở (thấy ngay chữ + "Sửa lời"); themKhoi đã đánh dấu thả.
    lanThemTv = 0;
    datChon([id]);
    return { ok: true, khoi: id };
  }

  /* ── Mẫu dựng video (23/10/2026): THAY MEDIA + LẤP NHANH các ô giữ chỗ ─── */
  /**
   * Thay media của khối `idKhoi` bằng media `idMedia` (đã có trong dự án) — moHinh.thayMediaKhoi: giữ chỗ, độ dài,
   * hiệu ứng; quy đổi cỡ khi khối phủ kín khung. Một bước hoàn tác (`ten`).
   */
  function thayMedia(idKhoi, idMedia, ten) {
    if (!hienTai || chiDoc) return { ok: false, loi: ['Dự án đang ở chế độ chỉ đọc.'] };
    const c = khoiCua(idKhoi);
    const mMoi = mediaCua(idMedia);
    if (!c) return { ok: false, loi: ['Không thấy khối cần thay.'] };
    if (!mMoi) return { ok: false, loi: ['Không thấy media để thay vào.'] };
    const t = trackCua(c.track);
    if (!t || t.loai !== 'hinh' || mMoi.loai === 'tieng' || mMoi.chu) return { ok: false, loi: ['Chỉ thay được ảnh / video của khối trên track hình.'] };
    if (t.khoa) return { ok: false, loi: [`Track ${t.id} đang khoá.`] };
    const mCu = mediaCua(c.media);
    if (mCu && mCu.id === mMoi.id) return { ok: true, khoi: idKhoi };
    const K = M.khungXuat(hienTai.khung, (hienTai.xuat || {}).khung);
    const r = lam((d) => ({ ...d, khoi: d.khoi.map((x) => (x.id === idKhoi ? M.thayMediaKhoi(x, mCu, mMoi, K) : x)) }),
      ten || `Thay ${mCu ? mCu.ten : 'media'} bằng ${mMoi.ten}`);
    return r && r.ok ? { ok: true, khoi: idKhoi } : { ok: false, loi: (r && r.loi) || ['Không thay được media.'] };
  }
  /** Các ô giữ chỗ của dự án, gom theo SỐ ô (một số có thể nhiều khối — cùng ảnh dùng hai lần), xếp theo số. */
  function cacO() {
    if (!hienTai) return [];
    const theoSo = new Map();
    hienTai.khoi.filter((c) => c.oCho).forEach((c) => {
      if (!theoSo.has(c.oCho.so)) theoSo.set(c.oCho.so, []);
      theoSo.get(c.oCho.so).push(c);
    });
    return [...theoSo.entries()].sort((a, b) => a[0] - b[0]).map(([so, ds]) => ({ so, khoi: ds, daThay: ds.every((c) => c.oCho.daThay) }));
  }
  /**
   * LẤP NHANH: media (theo thứ tự) vào các ô theo SỐ ô — ô chưa thay trước, rồi tới ô đã thay (lấp lại cả mẫu khi
   * đưa đủ). Một bước hoàn tác. → `{ ok, soO, thua, thieu }`.
   */
  function lapNhanh(idsMedia) {
    if (!hienTai || chiDoc) return { ok: false, loi: ['Dự án đang ở chế độ chỉ đọc.'] };
    const o = cacO();
    if (!o.length) return { ok: false, loi: ['Dự án này không có ô nào để lấp.'] };
    const ds = (idsMedia || []).map((id) => mediaCua(id)).filter((m) => m && m.loai !== 'tieng' && !m.chu);
    if (!ds.length) return { ok: false, loi: ['Chưa có ảnh / video nào để lấp.'] };
    const thuTu = ds.length >= o.length ? o : [...o.filter((x) => !x.daThay), ...o.filter((x) => x.daThay)];
    const n = Math.min(thuTu.length, ds.length);
    if (ngan) ngan.batDauNhom(`Lấp nhanh ${n} ô`);
    const loi = [];
    try {
      for (let i = 0; i < n; i += 1) {
        thuTu[i].khoi.forEach((c) => {
          const r = thayMedia(c.id, ds[i].id, `Lấp nhanh ${n} ô`);
          if (!r.ok) loi.push(...r.loi);
        });
      }
    } finally { if (ngan) ngan.ketThucNhom(); }
    return { ok: !loi.length, loi, soO: n, thua: ds.length - n, thieu: o.length - n };
  }

  /* ── Đợt 1 hiệu ứng: tiếng hiệu ứng có sẵn (Thư viện → Hiệu ứng) ──────── */
  /**
   * Tiếng hiệu ứng có sẵn → media của dự án → MỘT khối dài đúng tệp, ĐÚNG tại `ms` (tiếng hiệu ứng canh theo khung —
   * không dời sang chỗ trống kế như thả media), trên track tiếng (không phải giọng đọc) TRỐNG ở đoạn đó; hết chỗ thì
   * thêm track tiếng mới. Nhập + đặt = MỘT bước hoàn tác.
   * @param {{ trackId?: string, ten?: string, amLuong?: number }} [o]
   */
  async function themTiengHieuUng(id, ms, o = {}) {
    const ten = deck;
    if (!ten || !hienTai || chiDoc) return { ok: false, loi: ['Chưa mở dự án (hoặc dự án đang chỉ đọc).'] };
    const hop = (x) => !!x && x.loai === 'tieng' && !x.khoa && x.vaiTro !== 'giong';
    if (o.trackId && !hop(trackCua(o.trackId))) {
      return { ok: false, loi: [`Track "${String(o.trackId).slice(0, 40)}" không nhận tiếng hiệu ứng (không có, đang khoá, không phải track tiếng, hoặc là track giọng đọc).`] };
    }
    const r = await api.dung.themTiengHieuUng(ten, id);
    if (ten !== deck || !hienTai) return { ok: false, ma: 'doiDeck', loi: ['Đã chuyển sang dự án khác.'] };
    if (!r || !r.ok) return { ok: false, loi: (r && r.loi) || ['Không thêm được tiếng hiệu ứng.'] };
    // Track chỉ định vừa bị xoá / khoá trong lúc chuẩn bị tệp: báo, không lặng lẽ tạo track mới (như themNhac).
    if (o.trackId && !hop(trackCua(o.trackId))) return { ok: false, loi: ['Track vừa đổi trong lúc chuẩn bị tiếng hiệu ứng — thử lại.'] };
    const m = r.media;
    const bd = Math.max(0, Math.round(ms || 0));
    const dai = Math.max(1, m.ms);
    const trong = (t) => hop(t) && choTrong(hienTai, t.id, bd, dai) === bd;
    // Tự chọn: bỏ track đang TẮT TIẾNG (đặt vào đó là kêu câm).
    let t = o.trackId ? trackCua(o.trackId) : hienTai.track.find((x) => !x.tatTieng && trong(x)) || null;
    // Track chỉ định mà đoạn đó đã có khối: báo, KHÔNG đè / dời (agent và người dùng đều cần biết).
    if (t && !trong(t)) return { ok: false, loi: [`Track ${t.id} đã có khối ở ${(bd / 1000).toFixed(2)} s — chọn track khác hoặc giây khác.`] };
    let mk = null;
    let kqLam = null;
    if (ngan) ngan.batDauNhom(o.ten || `Thêm tiếng ${m.ten.replace(/^Hiệu ứng: /, '')}`);
    try {
      if (!t) {
        const truoc = new Set(hienTai.track.map((x) => x.id));
        themTrack('tieng');
        t = hienTai.track.find((x) => !truoc.has(x.id)) || null;
      }
      if (!t) return { ok: false, loi: ['Không thêm được track tiếng cho tiếng hiệu ứng.'] };
      const idK = M.taoId('k', hienTai.khoi.map((c) => c.id));
      themMedia([m]);
      const tid = t.id;
      kqLam = lam((d) => {
        mk = M.datChoMs({
          id: idK, track: tid, media: m.id, neo: null, batDauMs: 0, vaoMs: 0, raMs: dai, tocDo: 1,
          bienDoi: { x: 0.5, y: 0.5, co: 1, xoay: 0, mo: 1 },
          amLuong: typeof o.amLuong === 'number' ? o.amLuong : 1, mo: { vaoMs: 0, raMs: 0 },
        }, bd, mocDung());
        return { ...d, khoi: [...d.khoi, mk] };
      }, 'Đặt tiếng hiệu ứng');
    } finally { if (ngan) ngan.ketThucNhom(); }
    if (!mk || !kqLam || !kqLam.ok) return { ok: false, loi: (kqLam && kqLam.loi) || ['Không đặt được tiếng hiệu ứng lên timeline.'] };
    lanThemTv = Date.now();
    datChon([mk.id]);
    return { ok: true, khoi: mk.id, media: m.id };
  }

  /**
   * Lớp phủ có sẵn → media ảnh (PNG đúng cỡ KHUNG XUẤT) → khối "vừa khung" từ `ms`, dài theo `macDinh` của lớp (tới hết
   * video / 1,5 s / 0,36 s…) kèm keyframe độ đục / tăng-giảm dần dựng sẵn. Track: track hình TRÊN CÙNG nếu trống cả đoạn,
   * không thì thêm track hình mới (lên trên cùng) — lớp phủ phải nằm trên cảnh. Một bước hoàn tác.
   * @param {{ trackId?: string, ten?: string, daiMs?: number, mo?: number }} [o]  `mo`: độ đục tối đa (0..1)
   */
  async function themLopPhu(id, ms, o = {}) {
    const ten = deck;
    if (!ten || !hienTai || chiDoc) return { ok: false, loi: ['Chưa mở dự án (hoặc dự án đang chỉ đọc).'] };
    const hop = (x) => !!x && x.loai === 'hinh' && !x.khoa;
    if (o.trackId && !hop(trackCua(o.trackId))) {
      return { ok: false, loi: [`Track "${String(o.trackId).slice(0, 40)}" không nhận lớp phủ (không có, đang khoá, hoặc không phải track hình).`] };
    }
    const K = M.khungXuat(hienTai.khung, (hienTai.xuat || {}).khung);
    const r = await api.dung.themLopPhu(ten, id, K.rong, K.cao);
    if (ten !== deck || !hienTai) return { ok: false, ma: 'doiDeck', loi: ['Đã chuyển sang dự án khác.'] };
    if (!r || !r.ok) return { ok: false, loi: (r && r.loi) || ['Không thêm được lớp phủ.'] };
    if (o.trackId && !hop(trackCua(o.trackId))) return { ok: false, loi: ['Track vừa đổi trong lúc chuẩn bị lớp phủ — thử lại.'] };
    const m = r.media;
    const md = r.macDinh || { dai: 'het' };
    const bd = Math.max(0, Math.round(ms || 0));
    const het = Math.max(M.tongMs(hienTai, mocDung(), 0),
      !mocDung().doan && loai !== 'video' && RP.timeline && RP.timeline.msVideo ? RP.timeline.msVideo() : 0);
    const dai0 = md.dai === 'het' ? (het - bd >= 1000 ? het - bd : 5000) : md.dai;
    const dai = Math.max(100, Math.round(o.daiMs > 0 ? o.daiMs : dai0));
    const moToiDa = typeof o.mo === 'number' ? Math.max(0, Math.min(1, o.mo)) : 1;
    const trong = (t) => hop(t) && choTrong(hienTai, t.id, bd, dai) === bd;
    // Track hình TRÊN CÙNG đang HIỆN (track ẩn: lớp phủ vào đó là không thấy ở cả xem trước lẫn bản xuất).
    const tren = [...hienTai.track].reverse().find((t) => t.loai === 'hinh' && !t.an) || null;
    let t = o.trackId ? trackCua(o.trackId) : (trong(tren) ? tren : null);
    if (t && !trong(t)) return { ok: false, loi: [`Track ${t.id} đã có khối trong đoạn ${(bd / 1000).toFixed(2)}–${((bd + dai) / 1000).toFixed(2)} s — chọn track khác.`] };
    let mk = null;
    let kqLam = null;
    if (ngan) ngan.batDauNhom(o.ten || `Thêm ${m.ten}`);
    try {
      if (!t) {
        const truoc = new Set(hienTai.track.map((x) => x.id));
        themTrack('hinh');
        t = hienTai.track.find((x) => !truoc.has(x.id)) || null;
      }
      if (!t) return { ok: false, loi: ['Không thêm được track hình cho lớp phủ.'] };
      const idK = M.taoId('k', hienTai.khoi.map((c) => c.id));
      themMedia([m]);
      /* Cùng PNG đã có trong dự án như media thường (cùng băm ⇒ cùng id) thì themMedia bỏ qua — vá dấu `lopPhu` lên
         bản đang có, không thì xem trước mất "bấm xuyên" và cỡ kéo giãn. */
      if (!(mediaCua(m.id) || {}).lopPhu) lam((d) => ({ ...d, media: d.media.map((x) => (x.id === m.id ? { ...x, lopPhu: m.lopPhu } : x)) }), 'Nhập media');
      const tid = t.id;
      // Keyframe độ đục dựng sẵn co giãn theo độ dài thật (dài khác mặc định thì giữ hình dạng đường cong).
      const heT = typeof md.dai === 'number' && md.dai > 0 ? dai / md.dai : 1;
      const kf = md.kfMo ? { mo: md.kfMo.map(([tt, v]) => ({ t: Math.round(tt * heT), v: Math.round(v * moToiDa * 1000) / 1000, muot: true })) } : {};
      kqLam = lam((d) => {
        mk = M.datChoMs({
          id: idK, track: tid, media: m.id, neo: null, batDauMs: 0, vaoMs: 0, raMs: dai, tocDo: 1,
          bienDoi: { x: 0.5, y: 0.5, co: 1, xoay: 0, mo: md.kfMo ? 1 : moToiDa }, kf, amLuong: 1,
          mo: md.mo ? { vaoMs: Math.min(md.mo.vaoMs, Math.floor(dai / 2)), raMs: Math.min(md.mo.raMs, Math.floor(dai / 2)) } : { vaoMs: 0, raMs: 0 },
        }, bd, mocDung());
        return { ...d, khoi: [...d.khoi, mk] };
      }, 'Đặt lớp phủ');
    } finally { if (ngan) ngan.ketThucNhom(); }
    if (!mk || !kqLam || !kqLam.ok) return { ok: false, loi: (kqLam && kqLam.loi) || ['Không đặt được lớp phủ lên timeline.'] };
    /* KHÔNG tự chọn khối lớp phủ: khung chọn phủ CẢ màn hình xem trước và nhận cú bấm (kéo / co) — bấm vào cảnh bên dưới
       lại thành kéo lớp phủ (rà soát đợt 1). Muốn chỉnh: bấm khối trên timeline. */
    return { ok: true, khoi: mk.id, media: m.id };
  }

  /* ── GĐ2.2: nhạc có sẵn (Thư viện → Nhạc) ─────────────────────────────── */
  /**
   * Bản nhạc có sẵn → media của dự án → khối LẶP từ giây `ms` tới hết video (dự án trống: hết nội dung, ít nhất
   * một vòng nhạc), âm lượng 50 %, tăng dần 1 s / giảm dần 2 s, trên track tiếng đầu tiên KHÔNG phải giọng đọc.
   * Nhập + đặt khối = MỘT bước hoàn tác.
   * @param {{ trackId?: string, ten?: string, amLuong?: number, daiMs?: number }} [o]  `daiMs`: độ dài muốn (mặc định tới hết video)
   */
  async function themNhac(id, ms, o = {}) {
    const ten = deck;
    if (!ten || !hienTai || chiDoc) return { ok: false, loi: ['Chưa mở dự án (hoặc dự án đang chỉ đọc).'] };
    const hop = (x) => !!x && x.loai === 'tieng' && !x.khoa && x.vaiTro !== 'giong';
    // Chỉ định track mà track đó không nhận nhạc ⇒ báo, KHÔNG lặng lẽ đặt chỗ khác (MCP add_clip cũng báo — rà GĐ2).
    if (o.trackId && !hop(trackCua(o.trackId))) {
      return { ok: false, loi: [`Track "${String(o.trackId).slice(0, 40)}" không nhận nhạc (không có, đang khoá, không phải track tiếng, hoặc là track giọng đọc).`] };
    }
    const r = await api.dung.themNhacSan(ten, id);
    if (ten !== deck || !hienTai) return { ok: false, loi: ['Đã chuyển sang dự án khác.'] };
    if (!r || !r.ok) return { ok: false, loi: (r && r.loi) || ['Không thêm được nhạc.'] };
    const m = r.media;
    const bd0 = Math.max(0, Math.round(ms || 0));
    const tChon = o.trackId ? trackCua(o.trackId) : null;
    if (o.trackId && !hop(tChon)) return { ok: false, loi: ['Track vừa đổi trong lúc chuẩn bị nhạc — thử lại.'] };
    // Không chỉ track: track tiếng (không phải giọng đọc) TRỐNG tại đầu phát; hết chỗ thì thêm một track mới.
    let t = tChon || hienTai.track.find((x) => hop(x) && choTrong(hienTai, x.id, bd0, 1) === bd0) || null;
    let mk = null;
    let kqLam = null;
    if (ngan) ngan.batDauNhom(o.ten || `Thêm nhạc ${m.ten.replace(/^Nhạc: /, '')}`);
    try {
    if (!t) {
      const truoc = new Set(hienTai.track.map((x) => x.id));
      themTrack('tieng');
      t = hienTai.track.find((x) => !truoc.has(x.id)) || null;
    }
    if (!t) return { ok: false, loi: ['Không thêm được track tiếng cho nhạc.'] };
    /* Hết video: V1 đã sửa ⇒ theo mốc đích; không thì cả đuôi video sau slide cuối (bản xuất dài theo video). */
    const het = Math.max(M.tongMs(hienTai, mocDung(), 0),
      !mocDung().doan && loai !== 'video' && RP.timeline && RP.timeline.msVideo ? RP.timeline.msVideo() : 0);
    /* Dài tới HẾT video (lặp nếu bản nhạc ngắn hơn), không dài hơn: nhạc dài hơn hình là kéo vạch "Kết thúc" ra
       theo — video 15 giây thêm bản nhạc 32 giây từng xuất 33 giây, 18 giây cuối đen (24/10/2026). Đầu phát đã ở
       sau hết hình (còn < 1 giây) ⇒ một vòng nhạc. */
    const conLai = het - bd0;
    const dai = o.daiMs > 0 ? Math.round(o.daiMs) : (conLai >= 1000 ? conLai : m.ms);
    const idK = M.taoId('k', hienTai.khoi.map((c) => c.id));
    themMedia([m]);
    kqLam = lam((d) => {
      /* Chỗ trống đầu tiên từ `ms`; khối kế trên track chặn trước khi hết đoạn ⇒ nhạc dừng ngay trước nó. Khe
         ngắn hơn 1 giây ⇒ một vòng nhạc ở chỗ trống kế (như thả media thường). */
      let bd = choTrong(d, t.id, bd0, 1);
      const ke = d.khoi.filter((x) => x.track === t.id).map((x) => M.batDauMs(x, mocDung())).filter((a) => a >= bd).sort((a, b) => a - b)[0];
      let len = ke == null ? dai : Math.min(dai, ke - bd);
      if (len < 1000) { len = Math.min(m.ms, dai); bd = choTrong(d, t.id, bd0, len); }
      mk = M.datChoMs({
        id: idK, track: t.id, media: m.id, neo: null, batDauMs: 0, vaoMs: 0, raMs: len, lap: true, tocDo: 1,
        bienDoi: { x: 0.5, y: 0.5, co: 1, xoay: 0, mo: 1 },
        // Số NGUYÊN: kiem đặt về 0 mọi mo.vaoMs/raMs lẻ (khe 3.001 ms từng mất cả tăng/giảm dần — rà GĐ2).
        amLuong: typeof o.amLuong === 'number' ? o.amLuong : 0.5, mo: { vaoMs: Math.round(Math.min(1000, len / 4)), raMs: Math.round(Math.min(2000, len / 4)) },
      }, bd, mocDung());
      return { ...d, khoi: [...d.khoi, mk] };
    }, 'Đặt nhạc');
    } finally { if (ngan) ngan.ketThucNhom(); }
    if (!mk || !kqLam || !kqLam.ok) return { ok: false, loi: (kqLam && kqLam.loi) || ['Không đặt được nhạc lên timeline.'] };
    lanThemTv = Date.now();
    datChon([mk.id]);
    return { ok: true, khoi: mk.id, media: m.id };
  }

  function themDanhDau(ms, ten) {
    const id = M.taoId('d', ((hienTai && hienTai.danhDau) || []).map((x) => x.id));
    // Giữ danh sách THEO GIỜ ngay trong bộ nhớ (Shift+M nhảy theo thứ tự — audit).
    lam((d) => ({ ...d, danhDau: [...(d.danhDau || []), { id, ms: Math.max(0, Math.round(ms)), ten: ten || '', mau: 'xanh' }]
      .sort((a, b) => a.ms - b.ms) }), 'Thêm điểm đánh dấu');
    return id;
  }
  function suaDanhDau(id, sua, ten) {
    lam((d) => ({ ...d, danhDau: (d.danhDau || []).map((x) => (x.id === id ? { ...x, ...sua } : x)) }), ten || 'Sửa điểm đánh dấu');
  }
  function xoaDanhDau(id) {
    lam((d) => ({ ...d, danhDau: (d.danhDau || []).filter((x) => x.id !== id) }), 'Xoá điểm đánh dấu');
  }
  function doiXuat(sua, ten) {
    lam((d) => ({ ...d, xuat: { ...M.xuatMacDinh(), ...(d.xuat || {}), ...sua } }), ten || 'Đổi cài đặt bản dựng');
  }

  /* ── Giai đoạn 3: thư viện dùng chung + mẫu intro/outro ────────────────── */
  const tvc = api.dung.tvc;
  /** Đưa mục thư viện vào dự án (CHÉP vào dung/media); `ms` có thì đặt luôn lên timeline. */
  /** `tenBuoc`: tên bước hoàn tác (MCP đặt "AI: …"). Kết quả mang `ma` khi hỏng: 'doiDeck' | 'track' | 'khongCo'. */
  async function themTuThuVien(ids, ms, trackId, tenBuoc) {
    const ten = deck;
    if (!ten || !hienTai || chiDoc || !tvc) return { ok: false, ma: 'doiDeck', loi: ['Chưa mở dự án.'] };
    if (trackId) {
      const t = trackCua(trackId);
      if (!t || t.khoa) return { ok: false, ma: 'track', loi: [`Track "${trackId}" không có hoặc đang khoá.`] };
    }
    const r = await tvc.vaoDeck(ten, ids);
    if (ten !== deck) return { ok: false, ma: 'doiDeck', loi: ['Đã chuyển sang dự án khác.'] };
    if (r.loi.length && RP.setStatus) RP.setStatus(r.loi.join(' · '), 'warn');
    if (!r.media.length) return { ok: false, ma: 'khongCo', loi: r.loi };
    if (ngan) ngan.batDauNhom(tenBuoc || 'Thêm từ thư viện dùng chung');
    const idKhoi = [];
    try {
      themMedia(r.media);
      if (ms != null) {
        let o = ms;
        r.media.forEach((m) => {
          const id = themKhoi(m.id, trackId, o);
          const c = id && khoiCua(id);
          if (c) { idKhoi.push(id); o = M.ketThucMs(c, mocDung()); }
        });
      }
    } finally { if (ngan) ngan.ketThucNhom(); }
    return { ok: true, media: r.media.map((m) => m.id), khoi: idKhoi, loi: r.loi };
  }
  async function luuVaoThuVien(mediaIds) {
    if (!deck || !hienTai || !tvc) return { ok: false, loi: ['Chưa mở dự án.'] };
    const ds = mediaIds.map(mediaCua).filter(Boolean);
    const r = await tvc.tuDeck(deck, ds);
    return { ok: !r.loi.length, loi: r.loi, ...r };
  }

  /** Lưu các khối thành MẪU: giờ tương đối so với khối sớm nhất, track theo loại + thứ tự. */
  async function luuMau(tenMau, ids) {
    if (!deck || !hienTai || !tvc) return { ok: false, loi: ['Chưa mở dự án.'] };
    const moc = mocDung();
    const ds = ids.map(khoiCua).filter(Boolean);
    if (!ds.length) return { ok: false, loi: ['Chọn ít nhất một khối trên timeline.'] };
    const dau = Math.min(...ds.map((c) => M.batDauMs(c, moc)));
    const khoi = ds.map((c) => {
      const t = trackCua(c.track);
      const giong = t.loai === 'tieng' && t.vaiTro === 'giong';
      return {
        // Thứ tự TRONG NHÓM CÙNG VAI TRÒ (track giọng đọc đếm riêng) — chèn vào dự án khác vẫn đúng loại track.
        loaiTrack: t.loai, thuTu: nhomTrack(t.loai, giong).map((x) => x.id).indexOf(t.id), lechMs: M.batDauMs(c, moc) - dau,
        ...(giong ? { vaiTro: 'giong' } : {}),
        vaoMs: c.vaoMs, raMs: c.raMs, tocDo: c.tocDo, bienDoi: c.bienDoi, amLuong: c.amLuong, mo: c.mo, kf: c.kf,
        cat: c.cat, lat: c.lat, mediaDuAn: mediaCua(c.media),
        // GĐ2: lặp / hiệu ứng chuyển động / màu — thiếu thì mẫu nhạc lặp bị từ chối, Ken Burns + màu mất (rà GĐ2).
        ...(c.lap ? { lap: true } : {}), ...(c.hieuUng ? { hieuUng: c.hieuUng } : {}), ...(c.mau ? { mau: c.mau } : {}),
      };
    });
    return tvc.luuMau(deck, { ten: tenMau, khung: khungXuatHt(), khoi });
  }
  const khungXuatHt = () => (hienTai ? M.khungXuat(hienTai.khung, (hienTai.xuat || {}).khung) : null);
  /** Track theo loại + VAI TRÒ: track tiếng chia "giọng đọc" / thường; track hình một nhóm. */
  const nhomTrack = (loai, giong) => hienTai.track.filter((t) => t.loai === loai && (loai !== 'tieng' || (t.vaiTro === 'giong') === !!giong));

  /**
   * Chèn mẫu tại `ms`: chép media, đặt các khối giữ nguyên khoảng cách. Chỗ đã có khối thì dời
   * CẢ mẫu ra sau tới chỗ trống đầu tiên (không xé lẻ các khối của mẫu). Thiếu track thì thêm.
   */
  async function chenMau(id, ms, tenBuoc) {
    const ten = deck;
    if (!ten || !hienTai || chiDoc || !tvc) return { ok: false, ma: 'doiDeck', loi: ['Chưa mở dự án.'] };
    const r = await tvc.mauVaoDeck(ten, id);
    if (ten !== deck) return { ok: false, ma: 'doiDeck', loi: ['Đã chuyển sang dự án khác.'] };
    if (!r.ok) return r;
    const theoTv = new Map(r.media.map((m) => [m.tuThuVien, m]));
    const truoc = hienTai;
    if (ngan) ngan.batDauNhom(tenBuoc || `Chèn mẫu ${r.mau.ten}`);
    const idKhoi = [];
    // Không chèn được thì trả dự án về như trước (media + track vừa thêm) — nhóm không thành bước nào (audit GĐ3).
    const hoan = (loi) => { lam(() => truoc, 'Chèn mẫu'); return { ok: false, loi }; };
    try {
      themMedia(r.media);
      // Đủ track cho mẫu (theo loại + vai trò + thứ tự). Mẫu cũ (chưa có vaiTro) = track thường.
      [['hinh', false], ['tieng', false], ['tieng', true]].forEach(([loai, giong]) => {
        const can = Math.max(-1, ...r.mau.khoi.filter((k) => k.loaiTrack === loai && (k.vaiTro === 'giong') === giong).map((k) => k.thuTu)) + 1;
        while (nhomTrack(loai, giong).length < can) {
          const truocId = new Set(hienTai.track.map((t) => t.id));
          themTrack(loai);
          const moiT = hienTai.track.find((t) => !truocId.has(t.id));
          if (!moiT) break;   // không thêm được (chỉ đọc / hết trần) — đừng lặp mãi
          if (giong) doiTrack(moiT.id, { vaiTro: 'giong', ten: 'Giọng đọc' });
        }
      });
      const moc = mocDung();
      const trackCho = (k) => nhomTrack(k.loaiTrack, k.vaiTro === 'giong')[k.thuTu];
      const dung = (d, lech) => {
        const co = d.khoi.map((c) => c.id);
        const moi = r.mau.khoi.map((k) => {
          const m = theoTv.get(k.media);
          const t = trackCho(k);
          if (!t) throw new Error('Thiếu track cho mẫu.');
          const idK = M.taoId('k', [...co, ...idKhoi]);
          co.push(idK);
          return M.datChoMs({ id: idK, track: t.id, media: m.id, neo: { slide: 0, lechMs: 0 }, batDauMs: 0,
            vaoMs: k.vaoMs, raMs: k.raMs, tocDo: k.tocDo, bienDoi: k.bienDoi, amLuong: k.amLuong, mo: k.mo, kf: k.kf,
            cat: k.cat, lat: k.lat,
            ...(k.lap ? { lap: true } : {}), ...(k.hieuUng ? { hieuUng: k.hieuUng } : {}), ...(k.mau ? { mau: k.mau } : {}) }, lech + k.lechMs, moc);
        });
        return moi;
      };
      let lech = Math.max(0, Math.round(ms));
      let moi = null;
      for (let lan = 0; lan < 60; lan += 1) {
        const thu = dung(hienTai, lech);
        const va = thu.map((c) => [c, hienTai.khoi.find((x) => x.track === c.track
          && M.batDauMs(x, moc) < M.ketThucMs(c, moc) && M.ketThucMs(x, moc) > M.batDauMs(c, moc))]).find((p) => p[1]);
        if (!va) { moi = thu; break; }
        // Dời cả mẫu ra sau khối đang chắn.
        lech += M.ketThucMs(va[1], moc) - M.batDauMs(va[0], moc);
      }
      if (!moi) return hoan(['Không tìm được chỗ trống cho mẫu.']);
      const kq = lam((d) => ({ ...d, khoi: [...d.khoi, ...moi] }), `Chèn mẫu ${r.mau.ten}`);
      if (!kq.ok) return hoan(kq.loi);
      moi.forEach((c) => idKhoi.push(c.id));
    } finally { if (ngan) ngan.ketThucNhom(); }
    lanThemTv = Date.now();
    datChon(idKhoi);
    return { ok: true, khoi: idKhoi };
  }

  async function xuat() {
    if (!deck || !ngan) return { ok: false, loi: ['Chưa mở dự án.'] };
    ngan.luuNgay();
    return api.dung.xuat(deck, ngan.lay());
  }

  // Chỉ lượt "Tạo video" của CHÍNH deck này đổi mốc/video slide (bản xuất dựng không đổi gì ở đầu vào).
  if (api.render && api.render.onDone) {
    api.render.onDone((r) => {
      const ten = String((r && r.projectDir) || '').split(/[\\/]/).filter(Boolean).pop();
      if (r && !r.banDung && ten === deck) napMoc();
    });
  }

  RP.dung = {
    nghe: (f) => { nguoiNghe.add(f); return () => nguoiNghe.delete(f); },
    nap, napMoc, themBoSlide,
    /** Deck đang mở là BỘ SLIDE PHỤ `cha::id` (GĐ3.7) → { cha, id } | null. */
    boSlide: () => boSlideTin,
    deck: () => deck,
    /** Dự án VIDEO TRỐNG (chỉ timeline, không slide / giọng) — src/dung/duAnVideo.js. */
    laVideo: () => loai === 'video',
    msNen: () => 0,   // nền đen giả bỏ ở GĐ3.4 — giữ tên cho chỗ gọi cũ
    /** Dự án video: độ dài SẼ XUẤT (khối cuối, ms) — nền đen dài hơn để còn chỗ thả. 0 khi trống. */
    msXuat: () => (loai === 'video' ? msNoiDung() : 0),
    /** Ghi ngay thay đổi đang chờ (main đọc du-an.json trên đĩa — phụ đề tự động, xuất). */
    luuNgay: () => (ngan ? ngan.luuNgay() : null),
    dongBang,
    gianNen: async () => {},
    duAn: () => hienTai,
    moc: mocDung,
    mocGoc,
    /** V1 đã sửa: [{ slide, vaoMs, raMs }] hoặc null (nguyên video). */
    /** V1 đã sửa: { doan } hoặc null (nguyên video) — đọc từ khối slide (GĐ3.1). */
    v1: () => (hienTai && hienTai.slide && hienTai.slide.doan ? { doan: hienTai.slide.doan } : null),
    /** Khối slide: { batDauMs, doan } | null (dự án không có video slide). */
    slide: () => (hienTai && hienTai.slide) || null,
    /* ── phụ đề tách lớp ── */
    phuDeTt: () => phuDeTt,
    /** Dự án video: kiểu phụ đề vừa ghi (dung:kieuPhuDe) — lớp xem trước đổi CSS ngay, không nạp lại dự án. */
    datKieuPhuDe: (kieu, css) => {
      if (!phuDeTt) return;
      phuDeTt = { ...phuDeTt, kieu: kieu || {}, css: String(css || '') };
      bao('kieuPhuDe');
    },
    /** Câu phụ đề đang dùng (giây GỐC): đã sửa > của lượt dựng > null (deck dựng bằng bản cũ). */
    phuDeDung: () => (hienTai && hienTai.phuDe ? hienTai.phuDe.captions : (phuDeTt ? phuDeTt.captions : null)),
    phuDeAn: () => !!(hienTai && hienTai.phuDe && hienTai.phuDe.an),
    /** Tệp video xem trước: bản KHÔNG phụ đề khi phụ đề đã sửa (dung-xem vẽ phụ đề lên trên). */
    videoXem: () => (hienTai && hienTai.phuDe && phuDeTt ? phuDeTt.noPhuDe : null),
    /* Lưu bản ĐÃ chuẩn hoá (moHinh.phuDeSach — câu thiếu `words` được chia chữ): bản xem trước
       phải giống hệt thứ ghi ra đĩa và đem xuất. */
    datPhuDe: (pd, ten) => lam((d) => {
      /* Lần sửa đầu ghi băm phude.json của lượt dựng đang có (`goc`); sửa tiếp giữ nguyên `goc` cũ —
         "Tạo video" lại thì lệch băm ⇒ cảnh báo + khoá xuất tới khi khôi phục (audit GĐ3). */
      const goc = (d.phuDe && d.phuDe.goc) || (phuDeTt && phuDeTt.sha) || null;
      if (pd && goc && !pd.goc) pd = { ...pd, goc };
      const k = pd ? M.kiem({ ...d, phuDe: pd }) : null;
      return { ...d, phuDe: k && k.ok ? k.duAn.phuDe : pd };
    }, ten || 'Sửa phụ đề'),
    datV1, datBatDauSlide,
    video: () => video,
    /* "Xem được bản dựng": có video slide — hoặc dự án video (không có slide, xem trên nền đen; GĐ3.4). */
    coVideo: () => !!video || loai === 'video',
    tachTieng: () => tachTieng,
    chiDoc: () => chiDoc,
    loiDoc: () => loiDoc,
    loiLuu: () => (ngan ? ngan.loiLuu() : null),
    url: (rel) => (deck ? M.urlMedia(deck, rel) : ''),
    mediaCua, khoiCua, trackCua, cacheCua, layCache,
    chon: () => [...chon], chonGoc: () => chonGoc, datChon,
    /** Lựa chọn hiện tại đến từ việc vừa thả media / chèn mẫu (≤ 600 ms) — bang-khoi.js không tự mở Thuộc tính. */
    vuaThemTuThuVien: () => Date.now() - lanThemTv < 600,
    lam, batDauNhom: (ten) => ngan && ngan.batDauNhom(ten), ketThucNhom: () => ngan && ngan.ketThucNhom(),
    hoanTac: () => !!(ngan && ngan.hoanTac()), lamLai: () => !!(ngan && ngan.lamLai()),
    coHoanTac: () => !!(ngan && ngan.coHoanTac()), coLamLai: () => !!(ngan && ngan.coLamLai()),
    nhap, chonTep, themKhoi, xoaKhoi, xoaMedia, suaKhoi, catTai, chong, choTrong, hopTrack,
    themTrack, doiTrack, doiAmGoc, xuat,
    themChu, suaChu, themDanhDau, suaDanhDau, xoaDanhDau, doiXuat, taoGiong, themNhac, themTiengHieuUng, themLopPhu, thayMedia, cacO, lapNhanh,
    themTuThuVien, luuVaoThuVien, luuMau, chenMau,
    /** Khung XUẤT (đã tính lựa chọn 16:9…) — mọi toạ độ khối là tỉ lệ của khung này. */
    khungXuat: () => (hienTai ? M.khungXuat(hienTai.khung, (hienTai.xuat || {}).khung) : null),
  };

  function khoi() {
    if (api.dung && api.dung.onBoSlideMoi) api.dung.onBoSlideMoi(apBoSlideMoi);
    if (RP.deckCau && RP.deckCau.nghe) RP.deckCau.nghe(() => {
      // Cùng deck (watcher nạp lại khung) thì giữ nguyên — chỉ đổi deck mới nạp lại.
      const ten = (RP.deckCau && RP.deckCau.deck()) || '';
      if (ten !== deck) nap();
    });
    nap();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', khoi);
  else khoi();
})();
