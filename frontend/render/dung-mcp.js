'use strict';
/**
 * CẦU NỐI MCP ↔ TRÌNH DỰNG (Giai đoạn 3) — `window.__beeDungMcp.lenh(ten, deck, a)`.
 *
 * Công cụ `studio_timeline_*` (src/mcp/congCuDung.js) chạy ở tiến trình chính nhưng KHÔNG
 * tự ghi `du-an.json`: nó mở deck trong cửa sổ rồi gọi vào đây, và mọi thao tác đi qua
 * CHÍNH kho `RP.dung` mà người dùng đang dùng —
 *   · vào được Ctrl+Z (mỗi lần gọi công cụ = MỘT bước hoàn tác, tên "AI: …");
 *   · tự lưu, kiểm `moHinh.kiem` như mọi thao tác tay;
 *   · người dùng thấy ngay trên timeline / màn hình.
 * Một nguồn sự thật — không có đường ghi thứ hai cho agent.
 *
 * Dữ liệu ra/vào là HỢP ĐỒNG CÔNG KHAI (tiếng Anh, giây, tỉ lệ khung) — đổi tên trường là
 * gãy agent đã phát hành. Trả `{ loi: { ma, chu, chiTiet? } }` khi hỏng; `ma` là mã lỗi MCP.
 */
(function () {
  const RP = window.__renderPage || {};
  const M = window.__beeDung && window.__beeDung.moHinh;
  if (!M) return;
  const D = () => RP.dung;

  const KIEU = { fade: 'mo', slide_left: 'truot-trai', slide_right: 'truot-phai', slide_up: 'truot-len', slide_down: 'truot-xuong', zoom: 'phong',
    // Đợt 1 hiệu ứng (moHinh.KIEU_CHUYEN) — tên công khai ↔ nội bộ; danh sách enum ở mcp/congCuDung.js#S_TRANSITION.
    zoom_big: 'phong-lon', pop: 'nay', spin: 'xoay',
    wipe_left: 'quet-trai', wipe_right: 'quet-phai', wipe_up: 'quet-len', wipe_down: 'quet-xuong',
    smooth_wipe_left: 'quet-mem-trai', smooth_wipe_right: 'quet-mem-phai', smooth_wipe_up: 'quet-mem-len', smooth_wipe_down: 'quet-mem-xuong',
    circle_open: 'tron-mo', circle_close: 'tron-dong', open_vertical: 'cua-mo-doc', close_vertical: 'cua-dong-doc',
    open_horizontal: 'cua-mo-ngang', close_horizontal: 'cua-dong-ngang', clock_wipe: 'dong-ho', dip_black: 'nhay-den', dip_white: 'nhay-trang' };
  const KIEU_RA = Object.fromEntries(Object.entries(KIEU).map(([a, b]) => [b, a]));
  // Chữ động dựng sẵn (moHinh.CHU_DONG) — `animation` của studio_timeline_add_title.
  const CHU_DONG_MCP = { none: 'khong', pop: 'bat-len', slide_up: 'truot-len', zoom_big: 'phong-manh', spin: 'xoay-vao', split: 'mo-giua', wipe: 'lo-dan', drift: 'troi-nhe' };
  const TT = { x: 'x', y: 'y', scale: 'co', rotation: 'xoay', opacity: 'mo', volume: 'amLuong' };
  const TT_RA = Object.fromEntries(Object.entries(TT).map(([a, b]) => [b, a]));
  // Hiệu ứng chuyển động (GĐ2.3) — tên công khai ↔ tên nội bộ.
  const HU = { zoom_in: 'phong', zoom_out: 'thu', pan_left: 'troi-trai', pan_right: 'troi-phai', pan_up: 'troi-len', pan_down: 'troi-xuong' };
  const HU_RA = Object.fromEntries(Object.entries(HU).map(([a, b]) => [b, a]));
  // Chỉnh màu (GĐ2.4).
  const mauRa = (m) => (m ? { brightness: m.sang, contrast: m.tuongPhan, saturation: m.baoHoa } : null);
  const mauVao = (cu, a) => (a === null ? null : {
    ...(cu || {}),
    ...(so(a.brightness) ? { sang: a.brightness } : {}),
    ...(so(a.contrast) ? { tuongPhan: a.contrast } : {}),
    ...(so(a.saturation) ? { baoHoa: a.saturation } : {}),
  });
  const giay = (ms) => Math.round(ms) / 1000;
  const ms = (g) => Math.round(Number(g) * 1000);
  const loi = (ma, chu, chiTiet) => ({ loi: { ma, chu, ...(chiTiet ? { chiTiet } : {}) } });
  const so = (v) => typeof v === 'number' && Number.isFinite(v);
  /** Lỗi của themTiengHieuUng / themLopPhu → mã MCP: chuyển dự án giữa chừng = thử lại được; track = đầu vào; còn lại
   *  (ghi tệp, nhập media) = lỗi trình dựng — không bảo agent "sửa đầu vào" khi lỗi không nằm ở đó (rà soát đợt 1). */
  const loiThem = (r, macDinh) => {
    const chu = ((r && r.loi) || [macDinh]).join(' · ');
    if (r && r.ma === 'doiDeck') return loi('EDITOR_UNAVAILABLE', chu);
    return loi(/track/i.test(chu) ? 'INVALID_INPUT' : 'EDIT_FAILED', chu);
  };

  /** Chờ kho nạp xong đúng deck (deck vừa mở trong cửa sổ nạp không đồng bộ). */
  async function choDeck(ten, han = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < han) {
      const dg = D();
      if (dg && dg.deck() === ten && (dg.duAn() || dg.chiDoc())) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  /* ── đọc ─────────────────────────────────────────────────────────────── */
  function moTaKhoi(c, d, moc, keoDai) {
    const m = d.media.find((x) => x.id === c.media) || {};
    const kf = {};
    Object.keys(c.kf || {}).forEach((k) => {
      if (TT_RA[k] && c.kf[k].length) kf[TT_RA[k]] = c.kf[k].map((x) => ({ t_s: giay(x.t), value: x.v, ease: !!x.muot }));
    });
    const b = { x: 0.5, y: 0.5, co: 1, xoay: 0, mo: 1, ...(c.bienDoi || {}) };
    const mo = c.mo || {};
    const ct = c.cat || {};
    return {
      clip_id: c.id, track: c.track, media_id: c.media, media_name: m.ten || '',
      start_s: giay(M.batDauMs(c, moc)), end_s: giay(M.ketThucMs(c, moc)),
      in_s: giay(c.vaoMs), out_s: giay(c.raMs), speed: c.tocDo || 1,
      anchored_to_slide: c.neo ? c.neo.slide : null,
      transform: { x: b.x, y: b.y, scale: b.co, rotation: b.xoay, opacity: b.mo },
      volume: c.amLuong == null ? 1 : c.amLuong,
      fade_in_s: giay(mo.vaoMs || 0), fade_out_s: giay(mo.raMs || 0),
      transition_in: KIEU_RA[mo.kieuVao || 'mo'], transition_out: KIEU_RA[mo.kieuRa || 'mo'],
      crossfade_with_previous: !!mo.noi, extended_by_next_crossfade_s: giay(keoDai.get(c.id) || 0),
      loop: !!c.lap,
      motion: c.hieuUng ? { type: HU_RA[c.hieuUng.kieu], strength: c.hieuUng.manh } : null,
      color: mauRa(c.mau),
      crop: { left: ct.trai || 0, right: ct.phai || 0, top: ct.tren || 0, bottom: ct.duoi || 0 },
      flip: { horizontal: !!(c.lat && c.lat.ngang), vertical: !!(c.lat && c.lat.doc) },
      keyframes: kf,
      // Ô giữ chỗ của mẫu dựng video: số ô + đã thay media mẫu chưa.
      slot: c.oCho ? { number: c.oCho.so, filled: !!c.oCho.daThay } : null,
      // Khối chữ tiêu đề: nội dung + kiểu — sửa bằng studio_timeline_update_title.
      title: m.chu ? { text: m.chu.noiDung, font: m.chu.phong || null, size: m.chu.co || null, color: m.chu.mau || null } : null,
    };
  }

  function moTaMedia(m) {
    const dg = D();
    return { media_id: m.id, kind: m.loai === 'anh' ? 'image' : m.loai === 'tieng' ? 'audio' : 'video',
      name: m.ten, duration_s: m.loai === 'anh' ? null : giay(m.ms), width: m.rong || null, height: m.cao || null,
      has_audio: m.loai === 'tieng' || !!m.coTieng, is_title: !!m.chu, title_text: m.chu ? m.chu.noiDung : null,
      // Bộ slide phụ (GĐ3.7): tên deck `<dự án>::<id>` — sửa nội dung bằng công cụ deck (project_id ở studio_get_project.slide_sets).
      ...(m.boSlide ? { slide_set: `${dg.deck()}::${m.boSlide}`, slide_set_rendered: !/-cho-\d+\.mp4$/.test(m.tep) } : {}),
      ...(m.tts ? { voice_text: m.tts.chu, voice: { engine: m.tts.engine, voice: m.tts.voice || null, model: m.tts.model || null, speed: m.tts.speed } } : {}) };
  }

  function doc() {
    const dg = D();
    const d = dg.duAn();
    // Dự án chỉ đọc (lưu bởi bản app mới hơn): kho không giữ bản dựng — trả khung rỗng, read_only.
    if (!d) {
      return { read_only: true, has_slide_video: dg.coVideo(), duration_s: 0, slides: [], slide_sequence: null,
        tracks: [], media: [], clips: [], markers: [], audio: {}, export_frame: {} };
    }
    const moc = dg.moc();
    const K = dg.khungXuat();
    const ag = { ...M.amGocMacDinh(), ...(d.amGoc || {}) };
    const x = { ...M.xuatMacDinh(), ...(d.xuat || {}) };
    return {
      read_only: !!dg.chiDoc(),
      has_slide_video: dg.coVideo(),
      fps: d.khung.fps || 30,
      slide_video_frame: { width: d.khung.rong, height: d.khung.cao },
      export_frame: { aspect: x.khung === 'goc' ? 'source' : x.khung, background: x.nen === 'den' ? 'black' : 'blur', width: K.rong, height: K.cao, color: mauRa(x.mau) },
      duration_s: giay(M.tongMs(d, moc, 0)),
      slides: (dg.mocGoc ? dg.mocGoc() : moc).map((s, i) => ({ index: i, source_start_s: giay(s.tuMs), source_end_s: giay(s.denMs),
        removed: !!(moc.boSlide && moc.boSlide.has(i)) })),
      // V1 (video slide) theo thứ tự timeline: mỗi đoạn = một phần của một slide (giây trong slide).
      // Khối slide (GĐ3.3): chỗ của video slide trên timeline; null = dự án không có video slide.
      slide_block: dg.slide && dg.slide() ? {
        start_s: giay(dg.slide().batDauMs || 0),
        end_s: giay(moc.tongDich != null ? moc.tongDich : (moc.length ? moc[moc.length - 1].denMs : 0)),
      } : null,
      slide_sequence: moc.doan ? moc.doan.map((x) => ({ slide: x.slide, in_s: giay(x.nguonTu - dg.mocGoc()[x.slide].tuMs),
        out_s: giay(x.nguonDen - dg.mocGoc()[x.slide].tuMs), start_s: giay(x.dichTu), end_s: giay(x.dichDen) })) : null,
      tracks: d.track.map((t) => ({ id: t.id, kind: t.loai === 'hinh' ? 'video' : 'audio', name: t.ten,
        locked: !!t.khoa, hidden: !!t.an, muted: !!t.tatTieng, ...(t.vaiTro === 'giong' ? { role: 'voice' } : {}) })),
      media: d.media.map(moTaMedia),
      clips: d.khoi.map((c) => moTaKhoi(c, d, moc, M.keoDaiMs(d, moc)))
        .sort((a, b) => (a.track < b.track ? -1 : a.track > b.track ? 1 : a.start_s - b.start_s)),
      markers: (d.danhDau || []).map((m) => ({ marker_id: m.id, time_s: giay(m.ms), name: m.ten || '' })),
      audio: {
        voice_volume: ag.giong, voice_muted: !!ag.tatGiong, deck_audio_volume: ag.deck, deck_audio_muted: !!ag.tatDeck,
        ducking: { enabled: !!(ag.haNhac && ag.haNhac.bat), reduce_db: (ag.haNhac && ag.haNhac.mucDb) || 12 },
        separate_voice_available: !!dg.tachTieng(),
      },
    };
  }

  /* ── phụ đề (phụ đề tách lớp) ────────────────────────────────────────────
     Giờ câu giữ theo VIDEO SLIDE (source_*), như dữ liệu nội bộ — cắt / đổi chỗ slide (V1) không
     làm đổi chỉ số hay giờ của câu. start_s/end_s = chỗ câu hiện trên timeline đã dựng (null nếu
     câu nằm trọn trong phần slide đã cắt bỏ). */
  function docPhuDe() {
    const dg = D();
    const tt = dg.phuDeTt && dg.phuDeTt();
    const d = dg.duAn();
    const moc = dg.moc();
    const caps = (tt && dg.phuDeDung()) || [];
    return {
      editable: !!tt && !dg.chiDoc(),
      ...(tt ? {} : { reason: dg.coVideo() ? 'burned_in' : 'not_rendered' }),
      // `hidden` = trạng thái bật/tắt THẬT (cả cờ subtitles.enabled của deck — nút 👁 C1), không chỉ phuDe.an.
      edited: !!(d && d.phuDe), hidden: !!(RP.phuDe ? RP.phuDe.tat() : dg.phuDeAn()),
      // Bản sửa dựa trên một lần "Tạo video" trước — studio_export_edit bị chặn tới khi reset.
      outdated: !!(d && d.phuDe && d.phuDe.goc && tt && tt.sha && d.phuDe.goc !== tt.sha),
      captions: caps.map((c, i) => {
        const p = moc.doan ? M.chieuKhoang(moc, c.start * 1000, c.end * 1000) : [{ tuMs: c.start * 1000, denMs: c.end * 1000 }];
        return { index: i, text: c.text, source_start_s: Math.round(c.start * 1000) / 1000, source_end_s: Math.round(c.end * 1000) / 1000,
          start_s: p.length ? giay(p[0].tuMs) : null, end_s: p.length ? giay(p[p.length - 1].denMs) : null };
      }),
    };
  }

  /** Áp các sửa công khai lên phụ đề. Chỉ số theo danh sách TRƯỚC lần gọi này. */
  async function suaPhuDe(a) {
    const dg = D();
    if (!dg.coVideo()) return loi('VIDEO_NOT_RENDERED', 'Render the slide video first (studio_render).');
    if (!dg.phuDeTt()) return loi('SUBTITLES_NOT_EDITABLE', 'The subtitles of this video are burned in (rendered by an older Studio).');
    if (a.reset) {
      nhom('khôi phục phụ đề', () => dg.datPhuDe(null, 'AI: khôi phục phụ đề'));
      return docPhuDe();
    }
    const caps = (dg.phuDeDung() || []).map((c) => ({ ...c, ...(c.words ? { words: c.words.map((w) => ({ ...w })) } : {}) }));
    const bo = new Set();
    for (const e of a.edits || []) {
      const c = caps[e.index];
      if (!c) return loi('INVALID_INPUT', `Caption index ${e.index} does not exist (0–${caps.length - 1}).`);
      if (e.delete) { bo.add(e.index); continue; }
      if (typeof e.text === 'string') {
        const t = e.text.trim().replace(/\s+/g, ' ');
        if (!t) return loi('INVALID_INPUT', `Caption ${e.index}: text is empty — use delete: true to remove it.`);
        c.text = t;
        delete c.words;   // moHinh.phuDeSach chia lại chữ đều trong câu
      }
      const tu = so(e.source_start_s) ? e.source_start_s : c.start;
      const den = so(e.source_end_s) ? e.source_end_s : c.end;
      if (den - tu < 0.1) return loi('INVALID_INPUT', `Caption ${e.index}: must last at least 0.1 s.`);
      if (c.words && (tu !== c.start || den !== c.end)) {
        // Giữ nhịp chữ: co giãn giờ các chữ theo khung mới của câu.
        const k = (den - tu) / (c.end - c.start);
        c.words = c.words.map((w) => ({ text: w.text, start: tu + (w.start - c.start) * k, end: tu + (w.end - c.start) * k }));
      }
      c.start = tu;
      c.end = den;
    }
    const moi = caps.filter((_, i) => !bo.has(i)).sort((x, y) => x.start - y.start);
    for (let i = 1; i < moi.length; i += 1) {
      if (moi[i].start < moi[i - 1].end - 1e-6) {
        return loi('INVALID_INPUT', `Captions overlap after the edit ("${moi[i - 1].text.slice(0, 30)}" and "${moi[i].text.slice(0, 30)}"). Fix the times.`);
      }
    }
    const an = typeof a.hidden === 'boolean' ? a.hidden : dg.phuDeAn();
    const r0 = nhom('sửa phụ đề', () => dg.datPhuDe({ an, captions: moi }, 'AI: sửa phụ đề'));
    if (r0 && r0.ok === false) return loi('INVALID_INPUT', (r0.loi || []).join(' · '));
    /* `hidden` đổi ⇒ cờ của DECK (preview-settings.json — thứ "Tạo video" đọc) theo cùng, như nút 👁 C1.
       Không thì hidden:false không bật lại được phụ đề người dùng đã tắt bằng nút mắt (rà GĐ1). */
    if (typeof a.hidden === 'boolean' && !(dg.laVideo && dg.laVideo()) && RP.bangSua && RP.bangSua.datPhuDe) {
      const r1 = await RP.bangSua.datPhuDe({ enabled: !a.hidden });
      if (!r1.ok) return loi('INVALID_INPUT', (r1.loi || []).join(' · '));
      if (RP.timeline && RP.timeline.noi && RP.timeline.noi.veHet) RP.timeline.noi.veHet();
    }
    return docPhuDe();
  }

  /* ── ghi: áp phần sửa công khai lên một khối nội bộ ───────────────────── */
  function apSua(c0, a, m) {
    const c = { ...c0, bienDoi: { x: 0.5, y: 0.5, co: 1, xoay: 0, mo: 1, ...(c0.bienDoi || {}) }, mo: { vaoMs: 0, raMs: 0, ...(c0.mo || {}) } };
    if (so(a.in_s)) c.vaoMs = Math.max(0, ms(a.in_s));
    if (so(a.out_s)) c.raMs = ms(a.out_s);
    if (so(a.speed) && m.loai !== 'anh') {
      c.kf = M.kfTiLe(c.kf || {}, (c.tocDo || 1) / a.speed);
      c.tocDo = a.speed;
    }
    if (so(a.duration_s)) {
      const dai = Math.max(100, ms(a.duration_s));
      c.raMs = c.vaoMs + Math.round(dai * (c.tocDo || 1));
    }
    const t = a.transform || {};
    if (so(t.x)) c.bienDoi.x = t.x;
    if (so(t.y)) c.bienDoi.y = t.y;
    if (so(t.scale)) c.bienDoi.co = t.scale;
    if (so(t.rotation)) c.bienDoi.xoay = t.rotation;
    if (so(t.opacity)) c.bienDoi.mo = t.opacity;
    if (so(a.volume)) c.amLuong = a.volume;
    // Lặp (GĐ2.2): chỉ tệp âm thanh — out_s / duration_s được quá độ dài tệp.
    if (typeof a.loop === 'boolean' && m && m.loai === 'tieng') c.lap = a.loop;
    if (a.color !== undefined && m && m.loai !== 'tieng') c.mau = mauVao(c0.mau, a.color);
    if (a.motion !== undefined && m && m.loai !== 'tieng') {
      const cu = c0.hieuUng;
      // Cùng kiểu ⇒ giữ khúc tiến độ (tu/den) của nửa khối đã cắt — chỉ đổi độ mạnh thì đừng chạy lại từ đầu (rà GĐ2).
      c.hieuUng = a.motion && HU[a.motion.type] && a.motion.type !== 'none'
        ? { ...(cu && cu.kieu === HU[a.motion.type] ? cu : {}), kieu: HU[a.motion.type],
          manh: so(a.motion.strength) ? a.motion.strength : ((cu && cu.manh) || 0.5) } : null;
    }
    if (so(a.fade_in_s)) c.mo.vaoMs = ms(a.fade_in_s);
    if (so(a.fade_out_s)) c.mo.raMs = ms(a.fade_out_s);
    if (a.transition_in && KIEU[a.transition_in]) { c.mo.kieuVao = KIEU[a.transition_in]; if (!c.mo.vaoMs) c.mo.vaoMs = 500; }
    if (a.transition_out && KIEU[a.transition_out]) { c.mo.kieuRa = KIEU[a.transition_out]; if (!c.mo.raMs) c.mo.raMs = 500; }
    if (typeof a.crossfade_with_previous === 'boolean') { c.mo.noi = a.crossfade_with_previous; if (c.mo.noi && !c.mo.vaoMs) c.mo.vaoMs = 500; }
    if (a.crop) {
      const ct = { trai: 0, phai: 0, tren: 0, duoi: 0, ...(c.cat || {}) };
      [['left', 'trai'], ['right', 'phai'], ['top', 'tren'], ['bottom', 'duoi']].forEach(([p, k]) => { if (so(a.crop[p])) ct[k] = a.crop[p]; });
      c.cat = ct;
    }
    if (a.flip) c.lat = { ngang: !!(c.lat && c.lat.ngang), doc: !!(c.lat && c.lat.doc),
      ...(typeof a.flip.horizontal === 'boolean' ? { ngang: a.flip.horizontal } : {}),
      ...(typeof a.flip.vertical === 'boolean' ? { doc: a.flip.vertical } : {}) };
    if (a.keyframes && typeof a.keyframes === 'object') {
      const kf = { ...(c.kf || {}) };
      Object.keys(a.keyframes).forEach((p) => {
        const k = TT[p];
        if (!k) return;
        const ds = a.keyframes[p];
        if (!Array.isArray(ds) || !ds.length) { delete kf[k]; return; }
        kf[k] = ds.map((x) => ({ t: Math.max(0, ms(x.t_s)), v: x.value, ...(x.ease ? { muot: true } : {}) })).sort((p1, p2) => p1.t - p2.t);
      });
      c.kf = kf;
    }
    return c;
  }

  /** Track hợp media: chỉ định thì phải có + đúng loại; không thì track đầu tiên hợp (hình: V2 trước). */
  function chonTrack(d, m, id) {
    const hop = (t) => D().hopTrack(t, m) && !t.khoa;
    if (id) {
      const t = d.track.find((x) => x.id === id);
      if (!t) return { loi: loi('INVALID_INPUT', `Track "${String(id).slice(0, 20)}" does not exist. Use a track id from studio_timeline_get.`) };
      if (t.khoa) return { loi: loi('INVALID_INPUT', `Track ${t.id} is locked by the user.`) };
      if (!D().hopTrack(t, m)) return { loi: loi('INVALID_INPUT', `This media cannot go on track ${t.id} (${t.loai === 'hinh' ? 'video' : 'audio'} track).`) };
      return { t };
    }
    const t = d.track.find(hop);
    return t ? { t } : { loi: loi('INVALID_INPUT', 'No unlocked track fits this media.') };
  }

  /** Kiểm + áp một khối mới/sửa: chồng khối ⇒ CLIP_OVERLAP kèm giây trống gần nhất. */
  function datKhoi(d, c, boQua) {
    const moc = D().moc();
    const moiD = { ...d, khoi: boQua ? d.khoi.map((x) => (x.id === c.id ? c : x)) : [...d.khoi, c] };
    if (D().chong(moiD, c)) {
      const trong = D().choTrong(d, c.track, M.batDauMs(c, moc), M.doDaiMs(c), new Set([c.id]));
      return loi('CLIP_OVERLAP', `Clip would overlap another clip on track ${c.track}.`, { next_free_s: giay(trong) });
    }
    const k = M.kiem(moiD);
    if (!k.ok) return loi('INVALID_INPUT', k.loi.slice(0, 3).join(' · '));
    return { duAn: moiD };
  }

  function nhom(ten, f) {
    const dg = D();
    dg.batDauNhom(`AI: ${ten}`);
    try { return f(); } finally { dg.ketThucNhom(); }
  }

  /** Kiểu chữ công khai (style của MCP) → trường `chu` nội bộ, phủ lên `chu0`. */
  function kieuChu(chu0, st0) {
    const chu = { ...chu0 };
    const st = st0 || {};
    if (st.font) chu.phong = st.font;
    if (so(st.size)) chu.co = st.size;
    if (st.color) chu.mau = st.color;
    if (typeof st.background === 'string') chu.nen = st.background;
    if (so(st.outline_width)) chu.vien = st.outline_width;
    if (st.outline_color) chu.mauVien = st.outline_color;
    if (typeof st.shadow === 'boolean') chu.bong = st.shadow;
    if (typeof st.bold === 'boolean') chu.dam = st.bold;
    if (typeof st.italic === 'boolean') chu.nghieng = st.italic;
    if (st.align) chu.canh = { left: 'trai', center: 'giua', right: 'phai' }[st.align] || 'giua';
    return chu;
  }

  /* ── lệnh ────────────────────────────────────────────────────────────── */
  /* Ngoại lệ trong cầu nối không được thành null (main hiểu là "cửa sổ chưa sẵn sàng", agent THỬ
     LẠI một thao tác có khi đã ghi) — trả EDIT_FAILED, không thử lại (audit GĐ3). */
  async function lenh(ten, deck, a0) {
    try {
      return await lenhTho(ten, deck, a0);
    } catch (e) {
      console.warn('[dung-mcp] lệnh hỏng:', ten, e);
      return loi('EDIT_FAILED', `The editor failed while running this change (${String((e && e.message) || e).slice(0, 200)}).`);
    }
  }

  async function lenhTho(ten, deck, a0) {
    const a = a0 || {};
    if (!await choDeck(deck)) return loi('EDITOR_UNAVAILABLE', 'The project did not finish loading in the editor.');
    const dg = D();
    if (ten === 'doc') return doc();
    if (ten === 'phu_de_doc') return docPhuDe();
    if (dg.chiDoc()) return loi('PROJECT_READ_ONLY', 'This edit was saved by a newer Beeknoee Studio and is read-only here.');
    const d = dg.duAn();
    const moc = dg.moc();

    if (ten === 'them_khoi') {
      const m = dg.mediaCua(a.media_id);
      if (!m) return loi('MEDIA_NOT_FOUND', `Unknown media_id "${String(a.media_id).slice(0, 40)}".`);
      const tr = chonTrack(d, m, a.track);
      if (tr.loi) return tr.loi;
      const id = M.taoId('k', d.khoi.map((c) => c.id));
      let c = { id, track: tr.t.id, media: m.id, neo: { slide: 0, lechMs: 0 }, batDauMs: 0, vaoMs: 0,
        raMs: m.loai === 'anh' ? 5000 : m.ms, tocDo: 1, amLuong: 1 };
      c = apSua(c, a, m);
      // Khối LẶP (loop: true, tệp âm thanh) được dài quá tệp — đừng kẹp lại (rà GĐ2).
      if (m.loai !== 'anh' && c.raMs > m.ms && !(c.lap && m.loai === 'tieng')) c.raMs = m.ms;
      c = a.anchor_to_slide === false ? { ...c, neo: null, batDauMs: Math.max(0, ms(a.start_s || 0)) } : M.datChoMs(c, Math.max(0, ms(a.start_s || 0)), moc);
      const kq = datKhoi(d, c, false);
      if (kq.loi) return kq;
      const r = nhom(`thêm ${m.ten}`, () => dg.lam(() => kq.duAn, `AI: thêm ${m.ten}`));
      if (!r.ok) return loi('INVALID_INPUT', (r.loi || []).join(' · '));
      return { clip: moTaKhoi(c, kq.duAn, moc, M.keoDaiMs(kq.duAn, moc)) };
    }

    if (ten === 'sua_khoi') {
      const c0 = dg.khoiCua(a.clip_id);
      if (!c0) return loi('CLIP_NOT_FOUND', `Unknown clip_id "${String(a.clip_id).slice(0, 40)}".`);
      const t0 = dg.trackCua(c0.track);
      if (t0 && t0.khoa) return loi('INVALID_INPUT', `Track ${t0.id} is locked by the user.`);
      const m = dg.mediaCua(c0.media);
      let c = apSua(c0, a, m);
      if (a.track && a.track !== c0.track) {
        const tr = chonTrack(d, m, a.track);
        if (tr.loi) return tr.loi;
        c = { ...c, track: tr.t.id };
      }
      if (typeof a.anchor_to_slide === 'boolean' || so(a.start_s)) {
        const bd = so(a.start_s) ? Math.max(0, ms(a.start_s)) : M.batDauMs(c0, moc);
        const neo = typeof a.anchor_to_slide === 'boolean' ? a.anchor_to_slide : !!c0.neo;
        c = neo ? M.datChoMs({ ...c, neo: c.neo || { slide: 0, lechMs: 0 } }, bd, moc) : { ...c, neo: null, batDauMs: bd };
      }
      const kq = datKhoi(d, c, true);
      if (kq.loi) return kq;
      const r = nhom('sửa khối', () => dg.lam(() => kq.duAn, 'AI: sửa khối'));
      if (!r.ok) return loi('INVALID_INPUT', (r.loi || []).join(' · '));
      return { clip: moTaKhoi(c, kq.duAn, moc, M.keoDaiMs(kq.duAn, moc)) };
    }

    if (ten === 'xoa_khoi') {
      const ids = new Set((a.clip_ids || []).map(String));
      const co = d.khoi.filter((c) => ids.has(c.id));
      const thieu = [...ids].filter((id) => !co.some((c) => c.id === id));
      if (thieu.length) return loi('CLIP_NOT_FOUND', `Unknown clip_id: ${thieu.slice(0, 5).join(', ')}.`);
      const khoa = co.find((c) => (dg.trackCua(c.track) || {}).khoa);
      if (khoa) return loi('INVALID_INPUT', `Clip ${khoa.id} is on a locked track.`);
      nhom(`xoá ${co.length} khối`, () => dg.lam((x) => ({ ...x, khoi: x.khoi.filter((c) => !ids.has(c.id)) }), `AI: xoá ${co.length} khối`));
      dg.datChon([]);
      return { deleted: co.map((c) => c.id) };
    }

    if (ten === 'them_chu') {
      const chu = kieuChu({}, a.style);
      chu.noiDung = String(a.text || '').slice(0, 1000);
      if (!chu.noiDung.trim()) return loi('INVALID_INPUT', 'text is empty.');
      /* Chỗ trống tìm theo ĐÚNG độ dài xin; vị trí / chuyển cảnh áp ngay lúc đặt — một bước hoàn
         tác, và không mở nhóm xuyên qua lúc vẽ PNG (thao tác tay lúc đó bị gộp vào bước AI — audit GĐ3). */
      const id = await dg.themChu(Math.max(0, ms(a.start_s || 0)), chu, {
        daiMs: so(a.duration_s) ? ms(a.duration_s) : 4000,
        ten: 'AI: thêm chữ tiêu đề',
        sua: (c, m) => {
          const x = apSua(c, { transform: a.transform, transition_in: a.transition_in, transition_out: a.transition_out }, m);
          return a.animation ? M.apChuDong(x, CHU_DONG_MCP[a.animation] || 'khong') : x;
        },
      });
      if (!id) return loi('INVALID_INPUT', 'Could not add the title (all video tracks locked, or the text could not be drawn).');
      const d2 = dg.duAn();
      return { clip: moTaKhoi(dg.khoiCua(id), d2, moc, M.keoDaiMs(d2, moc)) };
    }

    /* Giọng đọc thành khối (GĐ2.1): cùng đường với nút "+ Giọng" — tạo tệp (main dung:taoGiong), đặt lên track
       "Giọng đọc". Mặc định engine / giọng / tốc độ = bộ giọng đang chọn cho deck (như hộp thoại). */
    if (ten === 'them_giong') {
      const chu = String(a.text || '').replace(/\s+/g, ' ').trim();
      if (!chu) return loi('INVALID_INPUT', 'text is empty.');
      const st = RP.state || {};
      const eng = a.engine || (st.engine === 'edgetts' ? 'edge' : st.engine) || 'edge';
      const giongMd = { edge: '#edgeVoice', vieneu: '#vnVoice', beeknoee: '#beeVoice', elevenlabs: '#elevenVoice' }[eng];
      const oV = giongMd && document.querySelector(giongMd);
      const voice = typeof a.voice === 'string' && a.voice ? a.voice : ((oV && oV.value) || '').trim();
      const oM = document.querySelector('#beeModel');
      const model = eng === 'beeknoee' ? (a.model || (oM && oM.value) || (RP.beeModelMacDinh ? RP.beeModelMacDinh() : '')) : '';
      const oS = document.querySelector('#renderSpeed');
      const speed = so(a.speed) ? a.speed : (RP.docTocDo && oS ? RP.docTocDo(oS.value).so : 1);
      const r = await dg.taoGiong(Math.max(0, ms(a.start_s || 0)), { chu, engine: eng, voice, model, speed },
        { ten: 'AI: thêm giọng đọc', ...(so(a.volume) ? { amLuong: a.volume } : {}) });
      if (!r || !r.ok) {
        const chuLoi = ((r && r.loi) || ['Could not create the voice-over.']).join(' · ');
        // Sidecar dùng chung cờ huỷ ⇒ main từ chối khi đang dựng / đang tạo phụ đề tự động.
        return loi(/^Đang (dựng video|tạo phụ đề)/.test(chuLoi) ? 'RENDER_BUSY' : 'GENERATION_FAILED', chuLoi);
      }
      const d2 = dg.duAn();
      return { clip: moTaKhoi(dg.khoiCua(r.khoi), d2, moc, M.keoDaiMs(d2, moc)) };
    }

    /* Nhạc có sẵn (GĐ2.2): cùng đường với Thư viện → Nhạc → "Thêm". */
    if (ten === 'them_nhac') {
      const r = await dg.themNhac(String(a.music_id || ''), Math.max(0, ms(a.start_s || 0)), {
        trackId: a.track || null, ten: 'AI: thêm nhạc nền',
        ...(so(a.volume) ? { amLuong: a.volume } : {}), ...(so(a.duration_s) ? { daiMs: ms(a.duration_s) } : {}),
      });
      if (!r || !r.ok) {
        const chuLoi = ((r && r.loi) || ['Could not add the music.']).join(' · ');
        return loi(/nhạc mẫu|ffmpeg/i.test(chuLoi) ? 'ASSET_NOT_FOUND' : 'INVALID_INPUT', chuLoi);
      }
      const d2 = dg.duAn();
      return { clip: moTaKhoi(dg.khoiCua(r.khoi), d2, moc, M.keoDaiMs(d2, moc)) };
    }

    /* Nhập tệp của người dùng (mẫu dựng video 23/10/2026): đúng đường nút "Nhập media" — chép vào dung/media
       (tên băm, nhập lại cùng tệp là nhận bản đã có), thêm vào dự án, chưa đặt lên timeline. */
    if (ten === 'nhap_tep') {
      const ds = (Array.isArray(a.paths) ? a.paths : []).filter((x) => typeof x === 'string' && x).slice(0, 50);
      if (!ds.length) return loi('INVALID_INPUT', 'paths is empty.');
      const r = await dg.nhap(ds);
      return { media: (r.media || []).map((m) => moTaMedia(dg.mediaCua(m.id) || m)), errors: (r.loi || []).slice(0, 20) };
    }

    /* Sửa chữ của khối tiêu đề đang có (mẫu dựng video): vẽ lại PNG, GIỮ chỗ, độ dài, chữ động, vị trí của khối.
       Kiểu chỉ đổi trường được gửi. Media chữ dùng chung nhiều khối thì mọi khối đó đổi theo (báo shared_with_clips). */
    if (ten === 'sua_chu') {
      const c0 = dg.khoiCua(a.clip_id);
      if (!c0) return loi('CLIP_NOT_FOUND', `Unknown clip_id "${String(a.clip_id).slice(0, 40)}".`);
      const t0 = dg.trackCua(c0.track);
      if (t0 && t0.khoa) return loi('INVALID_INPUT', `Track ${t0.id} is locked by the user.`);
      const m = dg.mediaCua(c0.media);
      if (!m || !m.chu) return loi('INVALID_INPUT', `Clip ${c0.id} is not a title — use studio_timeline_replace_media for pictures.`);
      const chu = kieuChu(m.chu, a.style);
      if (typeof a.text === 'string') {
        chu.noiDung = a.text.slice(0, 1000);
        if (!chu.noiDung.trim()) return loi('INVALID_INPUT', 'text is empty — delete the clip instead.');
      }
      const chung = d.khoi.filter((x) => x.media === m.id).length - 1;
      const r = await dg.suaChu(m.id, chu, deck);
      if (!r || !r.ok) return loi('INVALID_INPUT', ((r && r.loi) || ['Could not redraw the title.']).join(' · '));
      const d2 = dg.duAn();
      return { clip: moTaKhoi(dg.khoiCua(a.clip_id), d2, moc, M.keoDaiMs(d2, moc)), ...(chung > 0 ? { shared_with_clips: chung } : {}) };
    }

    if (ten === 'thay_media') {
      const c0 = dg.khoiCua(a.clip_id);
      if (!c0) return loi('CLIP_NOT_FOUND', `Unknown clip_id "${String(a.clip_id).slice(0, 40)}".`);
      if (!dg.mediaCua(a.media_id)) return loi('MEDIA_NOT_FOUND', `Unknown media_id "${String(a.media_id).slice(0, 40)}".`);
      const r = nhom('thay media', () => dg.thayMedia(a.clip_id, a.media_id, 'AI: thay media'));
      if (!r || !r.ok) return loi('INVALID_INPUT', ((r && r.loi) || ['Could not replace the media.']).join(' · '));
      const d2 = dg.duAn();
      return { clip: moTaKhoi(dg.khoiCua(a.clip_id), d2, moc, M.keoDaiMs(d2, moc)) };
    }

    if (ten === 'them_lop_phu') {
      const r = await dg.themLopPhu(String(a.overlay_id || ''), Math.max(0, ms(a.start_s || 0)), {
        trackId: a.track || null, ten: 'AI: thêm lớp phủ',
        ...(so(a.duration_s) ? { daiMs: ms(a.duration_s) } : {}), ...(so(a.opacity) ? { mo: a.opacity } : {}),
      });
      if (!r || !r.ok) return loiThem(r, 'Could not add the overlay.');
      const d2 = dg.duAn();
      return { clip: moTaKhoi(dg.khoiCua(r.khoi), d2, moc, M.keoDaiMs(d2, moc)) };
    }

    if (ten === 'them_sfx') {
      const r = await dg.themTiengHieuUng(String(a.sfx_id || ''), Math.max(0, ms(a.start_s || 0)), {
        trackId: a.track || null, ten: 'AI: thêm tiếng hiệu ứng', ...(so(a.volume) ? { amLuong: a.volume } : {}),
      });
      if (!r || !r.ok) return loiThem(r, 'Could not add the sound effect.');
      const d2 = dg.duAn();
      return { clip: moTaKhoi(dg.khoiCua(r.khoi), d2, moc, M.keoDaiMs(d2, moc)) };
    }

    if (ten === 'cai_dat') {
      nhom('đổi cài đặt bản dựng', () => {
        const x = {};
        if (a.export_aspect) x.khung = a.export_aspect === 'source' ? 'goc' : a.export_aspect;
        if (a.background) x.nen = a.background === 'black' ? 'den' : 'mo';
        if (a.color !== undefined) x.mau = mauVao((dg.duAn().xuat || {}).mau, a.color);
        if (Object.keys(x).length) dg.doiXuat(x, 'AI: đổi khung xuất');
        const ag = {};
        if (so(a.voice_volume)) ag.giong = a.voice_volume;
        if (so(a.deck_audio_volume)) ag.deck = a.deck_audio_volume;
        if (typeof a.voice_muted === 'boolean') ag.tatGiong = a.voice_muted;
        if (typeof a.deck_audio_muted === 'boolean') ag.tatDeck = a.deck_audio_muted;
        if (a.ducking) {
          const cu = (dg.duAn().amGoc || {}).haNhac || { bat: false, mucDb: 12 };
          ag.haNhac = { bat: typeof a.ducking.enabled === 'boolean' ? a.ducking.enabled : cu.bat, mucDb: so(a.ducking.reduce_db) ? Math.round(a.ducking.reduce_db) : cu.mucDb };
        }
        if (Object.keys(ag).length) dg.doiAmGoc(ag, 'AI: đổi âm thanh bản dựng');
      });
      return doc();
    }

    if (ten === 'tvc_vao') {
      const r = await dg.themTuThuVien((a.library_ids || []).map(String), so(a.start_s) ? Math.max(0, ms(a.start_s)) : null, a.track || null,
        'AI: thêm từ thư viện dùng chung');
      if (!r.ok) {
        const ma = r.ma === 'doiDeck' ? 'EDITOR_UNAVAILABLE' : r.ma === 'track' ? 'INVALID_INPUT' : 'ASSET_NOT_FOUND';
        return loi(ma, (r.loi || ['Could not add from the shared library.']).join(' · '));
      }
      const d2 = dg.duAn();
      return { media_ids: r.media, clips: r.khoi.map((id) => moTaKhoi(dg.khoiCua(id), d2, dg.moc(), M.keoDaiMs(d2, dg.moc()))),
        ...(r.loi && r.loi.length ? { skipped: r.loi } : {}) };
    }

    if (ten === 'mau_chen') {
      const r = await dg.chenMau(String(a.template_id || ''), Math.max(0, ms(a.start_s || 0)), 'AI: chèn mẫu');
      if (!r.ok) {
        const ma = r.ma === 'doiDeck' ? 'EDITOR_UNAVAILABLE' : /Không thấy mẫu|không còn/.test((r.loi || []).join('')) ? 'ASSET_NOT_FOUND' : 'INVALID_INPUT';
        return loi(ma, (r.loi || ['Could not insert the template.']).join(' · '));
      }
      const d2 = dg.duAn();
      return { clips: r.khoi.map((id) => moTaKhoi(dg.khoiCua(id), d2, dg.moc(), M.keoDaiMs(d2, dg.moc()))) };
    }

    if (ten === 'bo_slide_them') {
      if (!RP.themSlide || !RP.themSlide.lamPhu) return loi('EDITOR_UNAVAILABLE', 'The editor is not ready.');
      const r = await RP.themSlide.lamPhu({ mauId: String(a.template_id || ''), batDauMs: Math.max(0, ms(a.start_s || 0)) });
      if (!r || !r.ok) return loi(r && r.ma === 'BAN' ? 'RENDER_BUSY' : 'INVALID_INPUT', String((r && r.loi) || 'Could not add the slide set.'));
      return { id: r.id, ten: r.ten, clip_id: r.khoi };
    }

    if (ten === 'v1') {
      // Dự án video (chưa có bộ slide): không có V1 để sửa — coVideo() đúng cả với dự án video (GĐ3.4).
      if (dg.laVideo && dg.laVideo()) return loi('PROJECT_IS_TIMELINE_ONLY', 'This project has no slides yet — add a slide deck with studio_add_slides first.');
      if (!dg.coVideo()) return loi('VIDEO_NOT_RENDERED', 'Render the slide video first (studio_render).');
      const goc = dg.mocGoc();
      // GĐ3.3: `start_s` dời CẢ khối slide — cùng MỘT thao tác với sequence / reset (datV1 batDauMs): hỏng thì không đổi gì.
      const coStart = so(a.start_s);
      // Chồng do khối GẮN slide đi theo khối slide — không có next_free_s; chỉ đường riêng.
      const chong = (rr) => ({ loi: { ma: 'CLIP_OVERLAP', chu: (rr.loi || []).join(' · '),
        buoc: 'A clip anchored to these slides would overlap another clip. Move or delete one of them (studio_timeline_update_clip / studio_timeline_delete_clips), or pick another start_s, then retry.' } });
      if (a.reset) {
        const rr = dg.datV1(null, 'AI: khôi phục V1', coStart ? { batDauMs: ms(a.start_s) } : {});
        if (rr && rr.ok === false) return rr.ma === 'chong' ? chong(rr) : loi('INVALID_INPUT', (rr.loi || []).join(' · '));
        return doc();
      }
      if (coStart && !(a.sequence && a.sequence.length)) {
        const rr = dg.datBatDauSlide(ms(a.start_s), 'AI: dời khối slide');
        if (rr && rr.ok === false) return rr.ma === 'chong' ? chong(rr) : loi('INVALID_INPUT', (rr.loi || []).join(' · '));
        return doc();
      }
      const doan = [];
      for (const x of a.sequence || []) {
        const s = goc[x.slide];
        if (!s) return loi('INVALID_INPUT', `Slide ${x.slide} does not exist (0–${goc.length - 1}).`);
        const dai = s.denMs - s.tuMs;
        const vao = so(x.in_s) ? Math.max(0, Math.min(dai - 100, ms(x.in_s))) : 0;
        const ra = so(x.out_s) ? Math.max(vao + 100, Math.min(dai, ms(x.out_s))) : dai;
        doan.push({ slide: x.slide, vaoMs: vao, raMs: ra });
      }
      if (!doan.length) return loi('INVALID_INPUT', 'sequence is empty — pass reset: true to restore the original order.');
      const r = dg.datV1(doan, 'AI: sửa V1', coStart ? { batDauMs: ms(a.start_s) } : {});
      if (r && r.ok === false) return r.ma === 'chong' ? chong(r) : loi('INVALID_INPUT', (r.loi || []).join(' · '));
      return doc();
    }

    if (ten === 'phu_de_sua') return suaPhuDe(a);

    if (ten === 'xuat') {
      if (!dg.coVideo()) return loi('VIDEO_NOT_RENDERED', 'The slide video has not been rendered yet.');
      const r = await dg.xuat();
      if (!r || !r.ok) return loi('GENERATION_FAILED', ((r && r.loi) || ['Could not start the export.']).join(' · '));
      /* `already_queued`: deck đã có lượt xuất sẵn trong hàng (của người dùng) — studio_export_edit không "nhận vơ" (24/10/2026). */
      return { started: true, queued: !!r.xepHang, queue_position: r.viTri || null, already_running: !!r.dangChay, already_queued: !!r.trung };
    }
    return loi('INTERNAL_ERROR', 'Unknown editor command.');
  }

  window.__beeDungMcp = { lenh };
})();
