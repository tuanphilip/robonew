;
'use strict';
/**
 * XUẤT BẢN DỰNG — `du-an.json` → MỘT lệnh ffmpeg → `output/<deck>-dung.mp4`
 * (docs/video-editor/KE-HOACH.md §7).
 *
 *   [0:v] video slide đã dựng  → fps/scale → (tpad nếu dự án dài hơn video)
 *   mỗi khối hình              → trim → tốc độ → scale → mờ/xoay → fade → dời tới chỗ
 *                                → overlay chồng lần lượt (thứ tự track = thứ tự chồng)
 *     · chuyển cảnh MẶT NẠ (quét, tròn, cửa, đồng hồ — đợt 1 hiệu ứng): khối đặt lên khung TRONG SUỐT cỡ khung xuất
 *       → xfade với khung trong suốt (vào: trong suốt → khối; ra: khối → trong suốt) → overlay ở 0:0. Mặt nạ tính
 *       theo khung xuất như Premiere; xem trước tô cùng công thức (moHinh.phuMat / gradMat).
 *     · NHÁY QUA MÀU: khối hiện / tắt giữa lần nháy (fade một khung) + lớp màu cả khung fade 0 → 1 → 0 đè lên.
 *   tiếng: giọng (A1) + nhạc/hiệu ứng deck (A2·A3) tách sẵn lúc dựng, từng khối tiếng
 *          → atrim → atempo → volume → afade → adelay → amix → alimiter
 *
 * ⚠ HÌNH HỌC + THỜI GIAN lấy từ `moHinh` (`hopKhoi`, `batDauMs`, `doDaiMs`) — chính
 * các hàm xem trước dùng. Đừng tính lại ở đây.
 *
 * ⚠ TRẦN DÒNG LỆNH WINDOWS (32 767 ký tự): đồ thị lọc KHÔNG nằm trên dòng lệnh mà
 * ghi ra tệp, đọc bằng `-/filter_complex <tệp>` (FFmpeg ≥ 7). Đầu vào: mặc định mỗi
 * KHỐI một `-i` kèm `-ss/-t` (ffmpeg nhảy thẳng tới đoạn cần, không giải mã từ giây 0);
 * danh sách đầu vào vẫn quá dài thì chuyển sang mỗi MEDIA một `-i`, tách bằng
 * split/asplit (audit 10/10/2026: ~58 khối đã vượt trần).
 *
 * ⚠ HẠN MỨC: chủ dự án chốt 10/10/2026 "1 lần dựng là trừ". Chạy qua hàng đợi dựng
 * (`render/queue.js`, một lượt một lúc) và xin/trả lượt y như `runRender`: giữ
 * lượt TRƯỚC khi chạy ffmpeg, hỏng/huỷ thì trả, xong thì xác nhận.
 *
 * `taoLenh` THUẦN (không chạy gì) — bộ thử gọi thẳng; `xuatBanDung` chạy thật.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const config = require('../config');
const moHinh = require('./moHinh');
const kho = require('./kho');
const { timVideo } = require('../render/tenVideo');

const so = (x) => Number(x.toFixed(4));             // giây, gọn trong lệnh
const tenRa = (deckDir) => `${path.basename(deckDir)}-dung.mp4`;
const TRAN_DONG_LENH = 24000;                        // chừa xa trần 32 767 của Windows

/** Chuỗi atempo cho tốc độ 0.25–4 (mỗi atempo chỉ nhận 0.5–2). */
function chuoiAtempo(tocDo) {
  const ra = [];
  let t = tocDo;
  while (t > 2 + 1e-9) { ra.push('atempo=2'); t /= 2; }
  while (t < 0.5 - 1e-9) { ra.push('atempo=0.5'); t /= 0.5; }
  if (Math.abs(t - 1) > 1e-6) ra.push(`atempo=${so(t)}`);
  return ra;
}

/** Khối có tiếng để phát không (khối tiếng, hoặc khối video CÓ tiếng) — trừ khi track/khối tắt. */
const coTiengKhoi = (c, m, t) => (m.loai === 'tieng' || (m.loai === 'video' && m.coTieng)) && !t.tatTieng
  // Âm lượng tĩnh 0 mà keyframe đẩy lên vẫn là CÓ tiếng (audit: xem trước có tiếng, bản xuất câm).
  && Math.max(c.amLuong, ...((c.kf && c.kf.amLuong) || []).map((k) => k.v)) > 0;

/**
 * Dựng lệnh ffmpeg.
 * @param {object} duAn  dự án ĐÃ qua moHinh.kiem
 * @param {{ deckDir: string, moc: Array<{tuMs:number,denMs:number}>, msVideo: number,
 *           video: string, coTiengVideo?: boolean, giong?: string|null, deck?: string|null,
 *           ra: string, tepLoc: string, ganDongLenh?: number, khungVideo?: object,
 *           hoatDong?: Array<{tuMs:number,denMs:number}> }} vao
 *   Đường TUYỆT ĐỐI cho video/giong/deck/ra/tepLoc. `giong`/`deck` null ⇒ dùng tiếng
 *   của video (nếu `coTiengVideo`). `tepLoc` = nơi ghi đồ thị lọc. `khungVideo` = cỡ
 *   video slide (mặc định `duAn.khung`); khung XUẤT tính từ nó theo `duAn.xuat.khung`.
 *   `hoatDong` = các đoạn có giọng (hạ nhạc). Media được gọi bằng đường TƯƠNG ĐỐI
 *   với deck — chạy ffmpeg với `cwd` = deck (trả về ở `cwd`).
 * @returns {{ args: string[], loc: string, tongMs: number, soKhoi: number, moiMedia: boolean,
 *             cwd: string, khung: object }}
 */
function taoLenh(duAn, vao) {
  const KV = vao.khungVideo || duAn.khung;
  const K = moHinh.khungXuat(KV, (duAn.xuat || {}).khung);
  const fps = duAn.khung.fps || 30;
  /* V1 đã sửa (cắt / đổi chỗ slide): mốc mang ánh xạ giây gốc ↔ giây timeline — mọi khối gắn
     slide tự đi theo (moHinh.mocDich). Video nền ghép lại từ các đoạn giữ lại, theo thứ tự mới. */
  // Khối slide (GĐ3.1: { batDauMs, doan }) — mốc mang ánh xạ giây gốc ↔ giây timeline.
  const moc = moHinh.mocDich(vao.moc || [], duAn.slide, duAn.khung.fps);
  const doanV1 = moc.doan && moc.doan.length ? moc.doan : null;
  const tongMs = moHinh.tongMs(duAn, moc, vao.msVideo);
  const tong = tongMs / 1000;
  const mediaCua = new Map(duAn.media.map((m) => [m.id, m]));
  const trackCua = new Map(duAn.track.map((t) => [t.id, t]));
  const thuTu = new Map(duAn.track.map((t, i) => [t.id, i]));
  const fmtA = 'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo';
  const keoDai = moHinh.keoDaiMs(duAn, moc);
  const chan = (v) => Math.max(2, Math.round(v / 2) * 2);
  const tuongDoi = (f) => path.relative(vao.deckDir, f).split(path.sep).join('/');

  // ── khối sẽ xuất: track không ẩn, theo thứ tự chồng (sau đè trước), trong track theo giờ ──
  let khoi = duAn.khoi
    .map((c) => ({ c, m: mediaCua.get(c.media), t: trackCua.get(c.track) }))
    .filter((x) => x.m && x.t && !(x.t.loai === 'hinh' && x.t.an))
    .filter((x) => moHinh.batDauMs(x.c, moc) < tongMs)
    .map((x) => ({ ...x, tep: kho.duongTrongDeck(vao.deckDir, x.m.tep) }))
    .filter((x) => x.tep)
    .sort((a, b) => (thuTu.get(a.c.track) - thuTu.get(b.c.track)) || (moHinh.batDauMs(a.c, moc) - moHinh.batDauMs(b.c, moc)));
  /* CHỈ TIẾNG (phụ đề tự động): không khối nào là hình, chỉ giữ khối CÓ tiếng — ảnh / chữ / video câm
     khỏi mở, và luồng hình của video không bao giờ được giải mã (đồ thị không dùng tới). Trước đây đổ
     [v] vào nullsink: vẫn giải mã + ghép cả 1080p yuv444 30 khung/giây — chậm gần bằng xuất (rà 16/10/2026). */
  const canHinh = (x) => !vao.chiTieng && x.t.loai === 'hinh' && x.m.loai !== 'tieng';
  const canTieng = (x) => coTiengKhoi(x.c, x.m, x.t);
  if (vao.chiTieng) khoi = khoi.filter(canTieng);
  khoi.forEach((x) => {
    const td = x.c.tocDo || 1;
    x.bdMs = moHinh.batDauMs(x.c, moc);
    x.dai = moHinh.doDaiMs(x.c) / 1000;
    // Kéo dài dưới chuyển cảnh của khối sau (mo.noi) — CHỈ hình; dùng thêm đuôi media nếu còn.
    x.ext = canHinh(x) ? (keoDai.get(x.c.id) || 0) : 0;
    x.hienMs = moHinh.doDaiMs(x.c) + x.ext;
    x.cuoiNguonMs = x.m.loai === 'anh' ? x.c.raMs
      : Math.min(x.c.raMs + Math.round(x.ext * td), x.m.ms || x.c.raMs);
  });

  /* ── ĐẦU VÀO ──────────────────────────────────────────────────────────────
     Kiểu A (mặc định): mỗi khối một `-i`. Video có `-ss vào -t dài` — ffmpeg nhảy
     thẳng tới đoạn cần. `-noaccurate_seek`: GIỮ các khung trước điểm tua (giờ âm) — khung
     ĐANG HIỆU LỰC tại giây "vào" có thể bắt đầu trước đó (video ít khung/giây, quay màn
     hình VFR); bỏ nó đi là khối hiện khung TƯƠNG LAI, lệch xem trước (đo 10/10/2026). KHÔNG `-ss` cho tệp CHỈ có tiếng: MP3 VBR tua theo bitrate
     trung bình, lệch cả 5 giây (audit 10/10/2026) — giải mã từ đầu rồi `atrim`, rẻ.
     `-threads 2` mỗi đầu vào video: mặc định mỗi bộ giải mã H.264 mở cả bể luồng, 50
     khối 1080p ăn 9 GB RAM (đo).
     Kiểu B (quá 16 đầu vào video, hoặc dòng lệnh quá dài): gộp các khối của MỘT media
     thành "lượt đọc" — trong một lượt, khối sau dùng đoạn nguồn SAU đoạn của khối trước
     và đứng sau nó trên timeline, nên split không phải giữ khung chờ (dùng ngược thứ tự
     là đệm hàng GB, đo được). Mỗi lượt một `-i` (video: `-ss` tại đầu đoạn sớm nhất). */
  const VIDEO_TOI_DA = 16;
  const vaoA = khoi.map((x) => {
    if (x.m.loai === 'anh') return ['-i', tuongDoi(x.tep)];
    if (x.m.loai === 'tieng') return ['-i', tuongDoi(x.tep)];
    /* KHÔNG `-t`: tua không chính xác bắt đầu từ khung khoá TRƯỚC điểm tua và `-t` đếm từ
       đó — khối có "vào" xa khung khoá bị cắt cụt (đo). Đuôi do `trim` lo: trim xong là
       ffmpeg thôi đọc đầu vào đó (đo: video 2 phút, cắt 1 giây ⇒ 84 ms). */
    return ['-threads', '2', '-noaccurate_seek', '-ss', String(so(x.c.vaoMs / 1000)), '-i', tuongDoi(x.tep)];
  });
  const dauVaoPhu = [];
  if (vao.giong) dauVaoPhu.push(['-i', vao.giong]);
  if (vao.deck) dauVaoPhu.push(['-i', vao.deck]);
  const doDai = (ds) => ds.reduce((a, x) => a + x.reduce((b, y) => b + y.length + 3, 0), 0);
  const soVideo = khoi.filter((x) => x.m.loai === 'video').length;
  const moiMedia = soVideo > VIDEO_TOI_DA
    || (vao.ganDongLenh || 0) + (vao.video || '').length + doDai(vaoA) + doDai(dauVaoPhu) + 600 > TRAN_DONG_LENH;

  /* KHÔNG có video slide (dự án không có khối slide — GĐ3.2): nền ĐEN do ffmpeg tự sinh đúng khổ + fps + độ dài
     (lavfi color) thay tệp nền đen giả `_nen.mp4`. */
  const khongSlide = !vao.video;
  const args = khongSlide
    ? ['-y', '-v', 'error', '-nostdin', '-f', 'lavfi', '-i', `color=c=black:s=${KV.rong}x${KV.cao}:r=${fps}:d=${so(Math.max(0.04, tong))}`]
    : ['-y', '-v', 'error', '-nostdin', '-i', vao.video];
  /* KHỐI SLIDE DỜI khỏi giây 0 (GĐ3.2): hình video slide đệm đen phía trước, tiếng gốc trễ đúng bằng đó. Đoạn
     V1 (moc.doan) đã mang giờ timeline tuyệt đối ⇒ phụ đề / hạ nhạc / khối neo tự theo. */
  const treB = Math.max(0, Math.round(moc.batDau || 0));
  const treTieng = treB > 0 ? `,adelay=${treB}|${treB}` : '';
  const loc = [];
  /* Tiếng gốc theo V1: asplit + atrim từng đoạn rồi nối — tiếng giải mã rẻ, đệm tiếng (đổi thứ
     tự) chỉ vài MB; KHÔNG tua MP3 (VBR tua lệch, audit). */
  let demCat = 0;
  const catTiengV1 = (nhan) => {
    if (!doanV1) return nhan;
    const k = demCat++;
    const n = doanV1.length;
    if (n > 1) loc.push(`${nhan}asplit=${n}${doanV1.map((_, j) => `[ct${k}i${j}]`).join('')}`);
    doanV1.forEach((x, j) => loc.push(`${n > 1 ? `[ct${k}i${j}]` : nhan}atrim=start=${so(x.nguonTu / 1000)}:end=${so(x.nguonDen / 1000)},asetpts=PTS-STARTPTS[ct${k}d${j}]`));
    loc.push(`${doanV1.map((_, j) => `[ct${k}d${j}]`).join('')}concat=n=${n}:v=0:a=1[ct${k}]`);
    return `[ct${k}]`;
  };
  let soVao = 1;
  // tiếng gốc
  const ag = duAn.amGoc || moHinh.amGocMacDinh();
  let tiengGiong = null;
  const tiengNhac = [];
  const tiengGiongNd = [];
  /* HAI LỚP GỐC trộn ĐÚNG như bước ghép video slide (python/ffmpeg_mux.py: `amix` mặc định —
     chia đều khi cả hai cùng phát). Cộng thẳng là bản xuất to hơn video gốc ~6,5 dB (đo, audit
     10/10/2026). Lớp bị tắt vẫn vào amix với âm lượng 0 để lớp còn lại GIỮ đúng độ to như
     trong video. Hạ nhạc nhân vào lớp deck TRƯỚC khi trộn (`haDeck`, gán ở dưới). */
  let haDeck = null;
  const tronGoc = [];
  if (vao.giong && vao.deck) {
    const iG = soVao++;
    args.push('-i', vao.giong);
    const iD = soVao++;
    args.push('-i', vao.deck);
    tronGoc.push({ i: iG, am: ag.tatGiong ? 0 : ag.giong }, { i: iD, am: ag.tatDeck ? 0 : ag.deck, deck: true });
    tiengGiong = ag.tatGiong || !(ag.giong > 0) ? null : '[ag]';
  } else if (!khongSlide && vao.coTiengVideo !== false && !ag.tatGiong && ag.giong > 0) {
    // Không có tiếng tách: tiếng ĐÃ TRỘN của video, âm lượng A1 áp cho cả khối tiếng đó.
    loc.push(`${catTiengV1('[0:a]')}${fmtA}${treTieng},volume=${so(ag.giong)}[ag]`);
    tiengGiong = '[ag]';
  }

  // nguồn hình/tiếng cho từng khối
  if (!moiMedia) {
    khoi.forEach((x, k) => {
      const i = soVao++;
      args.push(...vaoA[k]);
      x.nguonV = canHinh(x) ? `[${i}:v]` : null;
      x.nguonA = canTieng(x) ? `[${i}:a]` : null;
      // Giây (trong trục thời gian của đầu vào) ứng với "vào" của khối: video đã tua tới đó.
      x.tuNguon = x.m.loai === 'video' ? 0 : x.c.vaoMs / 1000;
    });
  } else {
    // Lượt đọc: theo media, khối xếp theo giờ timeline; xếp vào lượt đầu tiên còn "đi tiếp" được.
    const theoMedia = new Map();
    khoi.forEach((x) => {
      if (!canHinh(x) && !canTieng(x)) return;
      if (!theoMedia.has(x.m.id)) theoMedia.set(x.m.id, []);
      theoMedia.get(x.m.id).push(x);
    });
    const luot = [];
    theoMedia.forEach((ds) => {
      const cua = [];
      ds.slice().sort((a, b) => a.bdMs - b.bdMs).forEach((x) => {
        // Ảnh / tệp chỉ tiếng: một lượt cho cả media (ảnh một khung; tiếng đệm rẻ).
        let l = x.m.loai === 'video'
          ? cua.find((r) => x.c.vaoMs >= r.nguonCuoi && x.bdMs >= r.timelineCuoi)
          : cua[0];
        if (!l) { l = { ds: [], nguonCuoi: 0, timelineCuoi: 0, tep: x.tep, video: x.m.loai === 'video' }; cua.push(l); }
        l.ds.push(x);
        l.nguonCuoi = x.cuoiNguonMs;
        l.timelineCuoi = x.bdMs + x.hienMs;
      });
      luot.push(...cua);
    });
    luot.forEach((l) => {
      const i = soVao++;
      const ssMs = l.video ? Math.min(...l.ds.map((x) => x.c.vaoMs)) : 0;
      if (l.video) args.push('-threads', '2', '-noaccurate_seek', '-ss', String(so(ssMs / 1000)));
      args.push('-i', tuongDoi(l.tep));
      const hinh = l.ds.filter(canHinh);
      const tieng = l.ds.filter(canTieng);
      if (hinh.length === 1) hinh[0].nguonV = `[${i}:v]`;
      else if (hinh.length > 1) {
        loc.push(`[${i}:v]split=${hinh.length}${hinh.map((_, j) => `[s${i}v${j}]`).join('')}`);
        hinh.forEach((x, j) => { x.nguonV = `[s${i}v${j}]`; });
      }
      if (tieng.length === 1) tieng[0].nguonA = `[${i}:a]`;
      else if (tieng.length > 1) {
        loc.push(`[${i}:a]asplit=${tieng.length}${tieng.map((_, j) => `[s${i}a${j}]`).join('')}`);
        tieng.forEach((x, j) => { x.nguonA = `[s${i}a${j}]`; });
      }
      l.ds.forEach((x) => { x.tuNguon = (x.c.vaoMs - ssMs) / 1000; });
    });
  }
  if (args.reduce((a, x) => a + x.length + 3, 0) + (vao.ganDongLenh || 0) > 31000) {
    throw new Error('Dự án quá nhiều media cho một lần xuất — gộp bớt hoặc xoá media không dùng.');
  }

  /* ── nền: video slide (khung xuất khác khổ video ⇒ đặt giữa, nền mờ hoặc đen) ──
     GHÉP LỚP Ở yuv444: với yuv420 ffmpeg làm tròn toạ độ overlay/pad xuống số CHẴN (mỗi
     lần tới −1 px — keyframe vị trí lệch xem trước 2–3 px, đo 10/10/2026). Về yuv420
     ngay trước khi mã hoá. */
  /* Video nền theo V1: mỗi đoạn MỘT đầu vào có `-ss` (video slide CFR, tua chính xác) rồi nối.
     Không split một đầu vào: đổi thứ tự là đoạn sau phải đệm hàng phút khung hình (đo ở chế độ
     tách media, audit GĐ1). */
  let nguonNen = '[0:v]';
  if (doanV1 && !vao.chiTieng) {
    /* Đoạn nằm trên lưới khung (mocDich) ⇒ cắt ĐÚNG số khung: tua sớm nửa khung (khung đầu
       đoạn có pts làm tròn trong timebase vẫn được giữ), `trim=end_frame`. `trim=duration` giữ
       ceil(D·fps) khung — mỗi đoạn dài hơn tiếng, lệch cộng dồn (audit GĐ3). */
    const nuaKhung = 0.5 / fps;
    const cac = doanV1.map((x) => {
      const i = soVao++;
      const soKhung = Math.max(1, Math.round(((x.nguonDen - x.nguonTu) / 1000) * fps));
      args.push('-threads', '2', '-ss', String(so(Math.max(0, x.nguonTu / 1000 - nuaKhung))),
        '-t', String(so((x.nguonDen - x.nguonTu) / 1000 + 0.2)), '-i', vao.video);
      loc.push(`[${i}:v]setpts=PTS-STARTPTS,trim=end_frame=${soKhung},setpts=PTS-STARTPTS[vd${i}]`);
      return `[vd${i}]`;
    });
    loc.push(`${cac.join('')}concat=n=${cac.length}:v=1:a=0[v1n]`);
    nguonNen = '[v1n]';
  }
  // Không có đoạn V1 mà khối slide dời (chưa có mốc): video slide hết ở B + msVideo.
  const thieu = Math.max(0, tong - (doanV1 ? moc.tongDich : vao.msVideo + treB) / 1000);
  const phanPad = [];
  if (treB > 0) phanPad.push(`start_mode=add:start_duration=${so(treB / 1000)}`);
  if (thieu > 0.001) phanPad.push(`stop_mode=add:stop_duration=${so(thieu)}`);
  const tpad = phanPad.length ? `,tpad=${phanPad.join(':')}:color=black` : '';
  if (vao.chiTieng) {
    // Chỉ tiếng: không dựng nền (xem chú thích ở canHinh).
  } else if (K.rong === KV.rong && K.cao === KV.cao) {
    loc.push(`${nguonNen}fps=${fps},scale=${K.rong}:${K.cao},setsar=1,format=yuv444p${tpad}[nen0]`);
  } else {
    const vv = moHinh.vungVideo(KV, K);
    if ((duAn.xuat || {}).nen === 'den') {
      loc.push(`${nguonNen}fps=${fps},scale=${vv.w}:${vv.h},setsar=1,format=yuv444p,pad=${K.rong}:${K.cao}:${vv.trai}:${vv.tren}:color=black${tpad}[nen0]`);
    } else {
      // Nền mờ = chính video phóng TRÀN khung, làm nhoè + tối nhẹ (như "Blur background" của các app dựng).
      loc.push(`${nguonNen}fps=${fps},split=2[nm0][nm1]`);
      loc.push(`[nm0]scale=${K.rong}:${K.cao}:force_original_aspect_ratio=increase,crop=${K.rong}:${K.cao},`
        + `gblur=sigma=${so(Math.max(K.rong, K.cao) / 48)},eq=brightness=-0.08,setsar=1[nm2]`);
      loc.push(`[nm1]scale=${vv.w}:${vv.h},setsar=1[nm3]`);
      loc.push(`[nm2][nm3]overlay=${vv.trai}:${vv.tren}:format=yuv444,format=yuv444p${tpad}[nen0]`);
    }
  }
  let nen = 'nen0';

  khoi.forEach((x, k) => {
    const { c, m } = x;
    const bd = x.bdMs / 1000;
    const d = x.dai;
    const hien = x.hienMs / 1000;
    const td = c.tocDo || 1;
    const nguonDai = (x.cuoiNguonMs - c.vaoMs) / 1000;     // giây NGUỒN dùng (kể cả đuôi kéo dài)
    if (x.nguonV) {
      const hb = moHinh.hinhBieuThuc(c, K, { dai: x.hienMs, boRa: x.ext > 0 });
      const kf = c.kf || {};
      const f = [];
      // 1. thời gian
      // Ảnh (cả GIF một khung): lặp khung đầu bằng BỘ LỌC — demuxer gif không có `-loop` (audit 10/10/2026).
      if (m.loai === 'anh') f.push('loop=loop=-1:size=1', `fps=${fps}`, `trim=duration=${so(hien)}`, 'setpts=PTS-STARTPTS');
      else {
        /* Giờ TUYỆT ĐỐI trong khối (không trừ "khung đầu tiên"): khung trước "vào" mang giờ
           âm. fps `round=up` + `start_time=0`: khung ô k là khung CÓ GIỜ ≤ k/fps — đúng khung
           `<video>` đang hiện ở xem trước. Media ít khung/giây mà dùng PTS-STARTPTS là hai
           kiểu đầu vào chọn hai khung khác nhau (đo 10/10/2026). */
        /* LUÔN giữ khung cuối tới hết khối: (a) kéo dài dưới chuyển cảnh hoà; (b) tệp có TIẾNG
           dài hơn HÌNH — `m.ms` là độ dài container nên khối có thể dài quá khung hình cuối, xem
           trước giữ khung cuối còn bản xuất lộ nền (audit GĐ2). tpad phải đứng TRƯỚC
           setpts=PTS-STARTPTS — đứng sau thì không thêm khung nào (đo 30 → 54 khung). */
        f.push(`setpts=(PTS-${so(x.tuNguon)}/TB)/${so(td)}`, `fps=${fps}:start_time=0:round=up`,
          `trim=end=${so(Math.min(hien, nguonDai / td))}`, 'tpad=stop_mode=clone:stop=-1', `trim=end=${so(hien)}`,
          'setpts=PTS-STARTPTS');
      }
      // 2. cắt khung + lật (trước khi co — cỡ "vừa khung" tính trên phần còn lại)
      const ct = c.cat || {};
      const [l, r, tr, du] = [ct.trai || 0, ct.phai || 0, ct.tren || 0, ct.duoi || 0];
      if (l || r || tr || du) f.push(`crop=w=iw*${so(1 - l - r)}:h=ih*${so(1 - tr - du)}:x=iw*${so(l)}:y=ih*${so(tr)}`);
      if (c.lat && c.lat.ngang) f.push('hflip');
      if (c.lat && c.lat.doc) f.push('vflip');
      // Chỉnh màu khối (GĐ2.4): ma trận RGB trước khi co — cùng ma trận lớp xem trước dùng (moHinh.svgMau).
      if (c.mau) f.push(moHinh.locMau(c.mau));
      // 3. cỡ — đổi theo thời gian thì co từng khung rồi đệm về hộp CỐ ĐỊNH (overlay cần cỡ đứng yên)
      const dongCo = !hb.co.hang;
      const dongXoay = !hb.xoay.hang;
      const dongViTri = !hb.cx.hang || !hb.cy.hang;
      const { mw: mwE, mh: mhE, s0 } = moHinh.coGoc(m, K, c.cat);
      let hop;
      if (dongCo) {
        const CO = hb.co.s('t');
        f.push(`scale=w='max(2,2*round(${moHinh.sx(mwE * s0)}*${CO}/2))':h='max(2,2*round(${moHinh.sx(mhE * s0)}*${CO}/2))':eval=frame`,
          'setsar=1', 'format=yuva444p');
        /* +0,1 % + 2 px: `scale` dùng hằng làm tròn 5 chữ số (sx) — cỡ thật có thể nhỉnh hơn coMax một điểm ảnh, pad
           từ chối khung lớn hơn hộp là cả bản xuất hỏng (rà GĐ2). Hộp đệm thừa không đổi chỗ (đặt theo tâm). */
        hop = { w: chan(mwE * s0 * hb.coMax * 1.001) + 2, h: chan(mhE * s0 * hb.coMax * 1.001) + 2 };
        f.push(`pad=w=${hop.w}:h=${hop.h}:x='(ow-iw)/2':y='(oh-ih)/2':color=black@0:eval=frame`);
      } else {
        const h0 = moHinh.hopKhoi(m, { co: hb.co.v }, K, c.cat);
        hop = { w: h0.w, h: h0.h };
        f.push(`scale=${hop.w}:${hop.h}`, 'setsar=1', 'format=yuva444p');
      }
      // 4. độ đục: keyframe ⇒ sendcmd đổi `aa` từng khung; mờ vào/ra ⇒ fade alpha (nhân vào)
      const dsMo = kf.mo;
      if (dsMo && dsMo.length > 1) {
        f.push(lenhDoMo(dsMo, k, hien), `colorchannelmixer@mo${k}=aa=${so(dsMo[0].v)}`);
      } else {
        const mo0 = dsMo && dsMo.length ? dsMo[0].v : (c.bienDoi.mo == null ? 1 : c.bienDoi.mo);
        if (mo0 < 1) f.push(`colorchannelmixer=aa=${so(mo0)}`);
      }
      const ch = hb.chuyen;
      if (ch.moVao > 0) f.push(`fade=t=in:st=0:d=${so(ch.moVao / 1000)}:alpha=1`);
      if (ch.moRa > 0) f.push(`fade=t=out:st=${so(Math.max(0, hien - ch.moRa / 1000))}:d=${so(ch.moRa / 1000)}:alpha=1`);
      /* NHÁY QUA MÀU: khối hiện (vào) / tắt (ra) ĐÚNG lúc lớp màu đặc nhất — giữa lần nháy. Xem trước: p ≥ 0,5 (moHinh.
         nhayMau). fade 0,5 ms bắt đầu sớm 1 ms: khung nằm ĐÚNG giữa đã đổi hẳn (fade tính (t − st)/d; st đúng giữa thì
         khung đó còn 0). */
      const nhayVao = moHinh.MAU_NHAY[ch.kv] && ch.mv > 0;
      const nhayRa = moHinh.MAU_NHAY[ch.kr] && ch.mr > 0;
      if (nhayVao) f.push(`fade=t=in:st=${so(Math.max(0, ch.mv / 2000 - 0.001))}:d=0.0005:alpha=1`);
      if (nhayRa) f.push(`fade=t=out:st=${so(Math.max(0, hien - ch.mr / 2000 - 0.001))}:d=0.0005:alpha=1`);
      // 5. xoay quanh tâm — đổi theo thời gian / cỡ đổi ⇒ hộp vuông đủ chứa mọi góc
      const xoay0 = hb.xoay.hang ? hb.xoay.v : null;
      let quay = false;
      if (dongXoay || (xoay0 && dongCo)) {
        const R = chan(Math.hypot(hop.w, hop.h)) + 2;
        /* c=black@0 (TRONG SUỐT), không phải c=none: none là KHÔNG tô vùng hình vừa rời đi —
           điểm ảnh của khung trước nằm lại thành vệt khi góc đổi (audit GĐ2: +163% diện tích). */
        f.push(`rotate=a='(${hb.xoay.s('t')})*PI/180':c=black@0:ow=${R}:oh=${R}`);
        quay = true;
      } else if (xoay0) {
        const rad = so((xoay0 * Math.PI) / 180);
        f.push(`rotate=${rad}:c=black@0:ow=rotw(${rad}):oh=roth(${rad})`);
        quay = true;
      }
      /* Số KHUNG của chuyển cảnh mặt nạ (moHinh.khungMat — xem trước tính y hệt): xfade tự làm tròn duration / offset ra
         khung; đưa số khung chẵn vào để bản sao alpha 0 (trim theo khung) và xfade trùng nhau. 0 khung ⇒ bỏ chuyển cảnh. */
      const kmV = moHinh.khungMat(0, ch.mv, fps);
      const kmR = moHinh.khungMat(ch.dai - ch.mr, ch.mr, fps);
      const matVao = ch.mv > 0 && kmV.soF > 0 ? moHinh.XFADE[ch.kv] : null;
      const matRa = ch.mr > 0 && kmR.soF > 0 ? moHinh.XFADE[ch.kr] : null;
      const coMat = !!(matVao || matRa);
      // Có mặt nạ: giữ giờ TRONG khối (khung trong suốt + xfade chạy từ 0), dời tới chỗ SAU khi xfade.
      if (!coMat) f.push(`setpts=PTS+${so(bd)}/TB`);
      loc.push(`${x.nguonV}${f.join(',')}[k${k}]`);
      // 6. chỗ đặt — theo TÂM (hộp đã đệm/xoay đều đồng tâm với hình)
      let px;
      let py;
      if (dongViTri || dongCo || dongXoay) {
        const T = coMat ? 't' : `(t-${so(bd)})`;
        px = `'${hb.cx.s(T)}-overlay_w/2'`;
        py = `'${hb.cy.s(T)}-overlay_h/2'`;
      } else {
        const h = moHinh.hopKhoi(m, { ...c.bienDoi, x: hb.cx.v / K.rong, y: hb.cy.v / K.cao, co: hb.co.v }, K, c.cat);
        px = quay ? `${h.cx}-overlay_w/2` : String(Math.round(h.trai));
        py = quay ? `${h.cy}-overlay_h/2` : String(Math.round(h.tren));
      }
      if (coMat) {
        /* Khung trong suốt cỡ khung xuất ← khối (straight alpha: overlay lên nền alpha 0 giữ NGUYÊN màu khối, đo) →
           xfade → dời tới chỗ.
           ⚠ xfade trộn CẢ màu, không riêng alpha: trộn với khung trong suốt ĐEN thì mép mềm vừa nhạt alpha vừa tối màu —
           overlay nhân alpha lần nữa ⇒ mép đi theo α² (đo 23/10/2026: tròn đóng giữa chừng còn 21/255 thay vì 81). Nên
           trộn với BẢN SAO CỦA CHÍNH KHỐI đặt alpha 0: màu hai đầu như nhau, chỉ alpha đổi. Khi RA, bản sao lùi đúng
           `offset` (trim start) — xfade lấy khung của đầu vào thứ hai theo giờ (t − offset), không lùi thì video bị bóng
           ma ở mép. */
        loc.push(`color=c=black@0:s=${K.rong}x${K.cao}:r=${fps}:d=${so(hien)},format=yuva444p[kc${k}]`);
        loc.push(`[kc${k}][k${k}]overlay=x=${px}:y=${py}:eof_action=pass:format=yuv444,format=yuva444p[km${k}]`);
        let cur = `km${k}`;
        if (matVao) {
          loc.push(`[${cur}]split[ka${k}][kb${k}]`, `[ka${k}]colorchannelmixer=aa=0[kz${k}]`,
            `[kz${k}][kb${k}]xfade=transition=${matVao}:duration=${so(kmV.soF / fps)}:offset=0[kx${k}]`);
          cur = `kx${k}`;
        }
        if (matRa) {
          loc.push(`[${cur}]split[kc${k}a][kc${k}b]`,
            // Cắt theo SỐ KHUNG (trim=start theo giây làm tròn lên — lệch xfade một khung là bóng ma ở mép video).
            // fps sau setpts: setpts làm mất nhịp khung (1/0) — xfade đòi hai đầu cùng nhịp.
            `[kc${k}b]trim=start_frame=${kmR.tuF},setpts=PTS-STARTPTS,fps=${fps},colorchannelmixer=aa=0[kc${k}z]`,
            `[kc${k}a][kc${k}z]xfade=transition=${matRa}:duration=${so(kmR.soF / fps)}:offset=${so(kmR.tuF / fps)},trim=duration=${so(hien)}[ky${k}]`);
          cur = `ky${k}`;
        }
        loc.push(`[${cur}]setpts=PTS+${so(bd)}/TB[kd${k}]`);
        loc.push(`[${nen}][kd${k}]overlay=x=0:y=0:eof_action=pass:format=yuv444:enable='between(t,${so(bd)},${so(bd + hien)})'[n${k}]`);
      } else {
        loc.push(`[${nen}][k${k}]overlay=x=${px}:y=${py}:eof_action=pass:format=yuv444:enable='between(t,${so(bd)},${so(bd + hien)})'[n${k}]`);
      }
      nen = `n${k}`;
      /* Lớp MÀU của nháy: cả khung, đục 0 → 1 (nửa đầu) → 0 (nửa sau), đè lên khối — dưới mọi thứ chồng sau. */
      const nhay = (kieu, tu, dai, ten) => {
        const nua = dai / 2;
        loc.push(`color=c=${moHinh.MAU_NHAY[kieu]}:s=${K.rong}x${K.cao}:r=${fps}:d=${so(dai)},format=yuva444p,`
          + `fade=t=in:st=0:d=${so(nua)}:alpha=1,fade=t=out:st=${so(nua)}:d=${so(nua)}:alpha=1,setpts=PTS+${so(tu)}/TB[${ten}]`);
        loc.push(`[${nen}][${ten}]overlay=x=0:y=0:eof_action=pass:format=yuv444:enable='between(t,${so(tu)},${so(tu + dai)})'[${ten}o]`);
        nen = `${ten}o`;
      };
      if (nhayVao) nhay(ch.kv, bd, ch.mv / 1000, `nv${k}`);
      if (nhayRa) nhay(ch.kr, bd + hien - ch.mr / 1000, ch.mr / 1000, `nr${k}`);
    }
    if (x.nguonA) {
      const t = x.t;
      const vaoS = c.vaoMs / 1000;
      const raS = c.raMs / 1000;
      // Cắt theo giờ TUYỆT ĐỐI của đầu vào (tua không chính xác giữ cả tiếng trước "vào", giờ âm).
      const a = [`atrim=start=${so(x.tuNguon)}:end=${so(x.tuNguon + raS - vaoS)}`, 'asetpts=PTS-STARTPTS'];
      /* LẶP (GĐ2.2, nhạc có sẵn): giải mã → aloop (giữ CẢ tệp trong bộ nhớ — `size` chỉ là trần; hết tệp trước
         thì lặp đúng phần đã đọc, đo 16/10/2026: vết nối 0,0018 so với bước nhảy thường 0,0084) → cắt trên trục
         đã lặp. Tệp nhạc ~30–60 s ⇒ vài MB. */
      if (c.lap && m.loai === 'tieng' && m.ms > 0) {
        const vong = Math.floor(c.vaoMs / m.ms);
        if (vong !== Math.floor((c.raMs - 1) / m.ms)) {
          a.unshift('asetpts=PTS-STARTPTS', fmtA, `aloop=loop=-1:size=${Math.ceil((m.ms / 1000 + 1) * 44100)}`);
        } else if (vong > 0) {
          // Cả khối nằm TRONG một vòng: không cần aloop (khỏi giữ cả tệp trong bộ nhớ) — cắt thẳng ở vào mod độ dài.
          const tu = x.tuNguon - (vong * m.ms) / 1000;
          a[0] = `atrim=start=${so(tu)}:end=${so(tu + raS - vaoS)}`;
        }
      }
      a.push(...chuoiAtempo(td), fmtA);
      const amTrack = t.amLuong == null ? 1 : t.amLuong;
      const dsAm = c.kf && c.kf.amLuong;
      if (dsAm && dsAm.length > 1) a.push(`volume='${moHinh.btKf(dsAm, c.amLuong).s('t')}*${so(amTrack)}':eval=frame`);
      else a.push(`volume=${so((dsAm && dsAm.length ? dsAm[0].v : c.amLuong) * amTrack)}`);
      const mv = Math.min(c.mo.vaoMs, moHinh.doDaiMs(c)) / 1000;
      const mr = Math.min(c.mo.raMs, moHinh.doDaiMs(c)) / 1000;
      if (mv > 0) a.push(`afade=t=in:st=0:d=${so(mv)}`);
      if (mr > 0) a.push(`afade=t=out:st=${so(Math.max(0, d - mr))}:d=${so(mr)}`);
      const tre = Math.round(bd * 1000);
      if (tre > 0) a.push(`adelay=${tre}|${tre}`);
      loc.push(`${x.nguonA}${a.join(',')}[a${k}]`);
      // Track giọng đọc (vai trò 'giong', GĐ2.1b): KÍCH hạ nhạc, chính nó không bị hạ.
      (moHinh.khoiLaGiong(duAn, c, t) ? tiengGiongNd : tiengNhac).push(`[a${k}]`);
    }
  });

  /* Phụ đề đã sửa (phụ đề tách lớp): chuỗi ảnh PNG theo trạng thái (src/render/phuDeLop.js), giờ
     đã chiếu lên trục timeline — chồng TRÊN CÙNG (track C1 nằm trên mọi track hình), đúng vùng
     video slide trong khung xuất. */
  /* MÀU CẢ VIDEO (lớp hiệu chỉnh, GĐ2.4): lên hình ĐÃ GHÉP (V1 + mọi khối), dưới lớp phụ đề. */
  if (!vao.chiTieng && duAn.xuat && duAn.xuat.mau) {
    loc.push(`[${nen}]${moHinh.locMau(duAn.xuat.mau)},format=yuv444p[nmau]`);
    nen = 'nmau';
  }
  if (vao.lopPhuDe) {
    const lp = vao.lopPhuDe;
    const i = soVao++;
    args.push('-f', 'concat', '-safe', '0', '-i', lp.danhSach);
    const vv = K.rong === KV.rong && K.cao === KV.cao ? { trai: 0, tren: 0, w: K.rong, h: K.cao } : moHinh.vungVideo(KV, K);
    const k = vv.w / KV.rong;
    loc.push(`[${i}:v]scale=${chan(lp.w * k)}:${chan(lp.h * k)},format=yuva444p[pdl]`);
    loc.push(`[${nen}][pdl]overlay=x=${Math.round(vv.trai + lp.x * k)}:y=${Math.round(vv.tren + lp.y * k)}:eof_action=pass:format=yuv444[npd]`);
    nen = 'npd';
  }
  if (!vao.chiTieng) loc.push(`[${nen}]trim=duration=${so(tong)},setpts=PTS-STARTPTS,format=yuv420p[v]`);
  /* HẠ NHẠC khi có giọng: mọi lớp tiếng KHÁC giọng (nhạc/hiệu ứng deck + khối tiếng) trộn
     chung rồi nhân hệ số theo các đoạn có giọng — CÙNG đường cong xem trước dùng
     (moHinh.btHaNhac). Cần tiếng giọng TÁCH riêng; không có thì không hạ được. */
  // Đoạn có giọng đo trên tệp giọng GỐC — V1 đã sửa thì chiếu lên trục timeline (đã cắt / đổi chỗ).
  const hoatDongDich = tiengGiong === '[ag]' && vao.giong
    ? (vao.hoatDong || []).flatMap((x) => moHinh.chieuKhoang(moc, x.tuMs, x.denMs)) : [];
  /* + khối trên track giọng đọc (GĐ2.1b) — CÙNG hàm xem trước dùng (moHinh.khoangGiongNd), chỉ giữ khối thật sự
     vào bản xuất (đã lọc ở `khoi`: còn tệp, bắt đầu trước khi hết). */
  const coTrongXuat = new Set(khoi.filter((x) => x.nguonA).map((x) => x.c.id));
  const giongNd = moHinh.khoangGiongNd({ ...duAn, khoi: duAn.khoi.filter((c) => coTrongXuat.has(c.id)) }, moc);
  const doanGiong = hoatDongDich.concat(giongNd);
  const ha = ag.haNhac && ag.haNhac.bat && doanGiong.length ? moHinh.btHaNhac(doanGiong, ag.haNhac.mucDb) : null;
  haDeck = ha && !ha.hang ? ha : null;
  const tiengVao = [];
  if (tronGoc.length) {
    const [g, dk] = tronGoc;
    loc.push(`${catTiengV1(`[${g.i}:a]`)}${fmtA}${treTieng},volume=${so(g.am)}[ag]`);
    loc.push(`[${dk.i}:a]${fmtA},aresample=async=1:first_pts=0${doanV1 ? `[adg];${catTiengV1('[adg]')}anull` : ''}${treTieng},volume=${so(dk.am)}`
      + `${haDeck ? `,volume='${haDeck.s('t')}':eval=frame` : ''}[ad]`);
    loc.push('[ag][ad]amix=inputs=2:duration=longest:dropout_transition=0[goc]');
    tiengVao.push('[goc]');
  } else if (tiengGiong) tiengVao.push(tiengGiong);
  if (ha && !ha.hang && tiengNhac.length) {
    loc.push(`${tiengNhac.join('')}amix=inputs=${tiengNhac.length}:duration=longest:dropout_transition=0:normalize=0,`
      + `volume='${ha.s('t')}':eval=frame[nhac]`);
    tiengVao.push('[nhac]');
  } else tiengVao.push(...tiengNhac);
  tiengVao.push(...tiengGiongNd);
  // Không còn lớp tiếng nào (tắt hết / video câm): tiếng im đúng độ dài — bản xuất vẫn có luồng tiếng.
  /* alimiter: `level=0` — mặc định nó TỰ NÂNG mức ra theo 1/limit (+0,45 dB ở limit 0,95):
     bản xuất không sửa gì cũng to hơn video gốc (đo, audit 10/10/2026). */
  if (!tiengVao.length) { loc.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${so(tong)}[a]`); }
  else {
    loc.push(`${tiengVao.join('')}amix=inputs=${tiengVao.length}:duration=longest:dropout_transition=0:normalize=0,`
      + `alimiter=limit=0.95:level=0,apad,atrim=duration=${so(tong)}[a]`);
  }
  /* CHỈ TIẾNG (phụ đề tự động cho dự án video trống — src/dung/index.js#dung:phuDeTuDong): cùng
     đồ thị trộn tiếng với bản xuất, KHÔNG dựng nhánh hình nào (luồng hình không được giải mã), ra WAV mono 16 kHz cho
     Whisper. Không mã hoá hình nên nhanh, và phụ đề khớp ĐÚNG thứ bản xuất sẽ phát. */
  if (vao.chiTieng) {
    args.push('-/filter_complex', vao.tepLoc, '-map', '[a]', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
      '-t', String(so(tong)), '-progress', 'pipe:1', '-nostats', '-f', 'wav', vao.ra);
    return { args, loc: loc.join(';\n'), tongMs, soKhoi: khoi.length, moiMedia, cwd: vao.deckDir, khung: K };
  }
  const doThi = loc.join(';\n');
  args.push('-/filter_complex', vao.tepLoc, '-map', '[v]', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-t', String(so(tong)), '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', vao.ra);
  return { args, loc: doThi, tongMs, soKhoi: khoi.length, moiMedia, cwd: vao.deckDir, khung: K };
}

/**
 * Keyframe ĐỘ ĐỤC → `sendcmd` đổi `aa` của colorchannelmixer từng khung (colorchannelmixer
 * không nhận biểu thức theo t). Mỗi đoạn giữa hai keyframe là một khoảng `[expr]` nội suy
 * theo TI (0→1 trong khoảng) — cùng công thức `moHinh.giaTriKf`. Giờ tính trong khối.
 */
function lenhDoMo(ds, k, hienS) {
  const ten = `colorchannelmixer@mo${k}`;
  const g = (ms) => so(ms / 1000);
  const ra = [];
  if (ds[0].t > 0) ra.push(`0-${g(ds[0].t)} [expr] ${ten} aa ${moHinh.sx(ds[0].v)}`);
  for (let i = 0; i < ds.length - 1; i += 1) {
    const a = ds[i];
    const b = ds[i + 1];
    const p = a.muot ? 'TI*TI*(3-2*TI)' : 'TI';
    ra.push(`${g(a.t)}-${g(b.t)} [expr] ${ten} aa ${moHinh.sx(a.v)}+${moHinh.sx(b.v - a.v)}*${p}`);
  }
  const cuoi = ds[ds.length - 1];
  ra.push(`${g(cuoi.t)}-${so(Math.max(hienS, cuoi.t / 1000) + 3600)} [expr] ${ten} aa ${moHinh.sx(cuoi.v)}`);
  return `sendcmd=c='${ra.join(';')}'`;
}

/**
 * Đầu vào thật của một deck: video gốc + mốc slide + hai lớp tiếng tách sẵn (nếu KHỚP video).
 *
 * ⚠ timing.json / giọng / tiếng deck được pipeline ghi TRƯỚC video: lượt "Tạo video" lại
 * mà hỏng/huỷ giữa chừng để lại bộ MỚI cạnh video CŨ (audit 10/10/2026). Pipeline ghi dấu
 * (cỡ, băm timing) của bộ đi cùng video vào `<deck>.info.json#dauVaoDung`:
 *   · tiếng tách không khớp ⇒ bỏ, dùng tiếng ĐÃ TRỘN của video (luôn đúng với video);
 *   · timing không khớp ⇒ `mocLech` — xuất bị chặn (khối neo theo slide sẽ lệch chỗ).
 * Deck dựng bằng bản cũ (chưa có dấu): tệp phải không mới hơn video (ghi trước video).
 * @returns {null | { video, moc, giong, deck, mocLech: boolean, tiengLech: boolean }}
 */
/** Tên tệp giọng có thể đi cùng video (thứ tự ưu tiên = khớp trục video nhất trước). */
const TEP_GIONG = ['voiceover_concat_render.mp3', 'voiceover_concat.mp3', 'full_voiceover.mp3'];

/**
 * Tệp giọng ĐI CÙNG video slide hiện có — một chỗ chọn cho bản xuất, xem trước (dung:doc) và
 * sóng âm timeline (main/songAm.js).
 *   · có dấu `dauVaoDung.giong` (pipeline mới): đúng tên + cỡ tệp bước ghép đã dùng;
 *   · deck dựng bằng bản cũ: tệp không mới hơn video và KHÔNG cũ hơn timing.json của lượt đó
 *     (tệp `_render` sót từ lượt trước cũ hơn timing mới ⇒ bỏ).
 * @returns {{ file: string, lech: boolean } | null}  lech = có dấu mà không khớp
 */
function tepGiongKhop(deckDir) {
  const v = timVideo(deckDir);
  if (!v) return null;
  const out = path.join(deckDir, 'output');
  let dau = null;
  try { dau = JSON.parse(fs.readFileSync(v.path.replace(/\.mp4$/i, '.info.json'), 'utf8')).dauVaoDung || null; } catch { dau = null; }
  if (dau && dau.giong && TEP_GIONG.includes(dau.giong.ten)) {
    const f = path.join(out, dau.giong.ten);
    let st;
    try { st = fs.statSync(f); } catch { return { file: null, lech: true }; }
    return st.size === dau.giong.size ? { file: f, lech: false } : { file: null, lech: true };
  }
  if (dau && dau.giong) return { file: null, lech: true };   // dấu đời đầu (không tên) — không tin
  let msVideo = 0;
  let msTiming = 0;
  try { msVideo = fs.statSync(v.path).mtimeMs; } catch { /* bỏ */ }
  try { msTiming = fs.statSync(path.join(out, 'timing.json')).mtimeMs; } catch { /* bỏ */ }
  for (const ten of TEP_GIONG) {
    try {
      const t = fs.statSync(path.join(out, ten)).mtimeMs;
      if (t <= msVideo + 5000 && (!msTiming || t >= msTiming - 2000)) return { file: path.join(out, ten), lech: false };
    } catch { /* không có */ }
  }
  return null;
}

function dauVaoDeck(deckDir) {
  const v = timVideo(deckDir);
  if (!v) return null;
  const out = path.join(deckDir, 'output');
  let dau = null;
  try { dau = JSON.parse(fs.readFileSync(v.path.replace(/\.mp4$/i, '.info.json'), 'utf8')).dauVaoDung || null; } catch { dau = null; }
  let msVideo = 0;
  try { msVideo = fs.statSync(v.path).mtimeMs; } catch { /* bỏ */ }
  const khop = (ten, k, bam) => {
    const f = path.join(out, ten);
    let st;
    try { st = fs.statSync(f); } catch { return null; }
    if (dau) {
      const d = dau[k];
      if (!d || d.size !== st.size) return false;
      if (d.sha && bam && d.sha !== bam) return false;
      return true;
    }
    return st.mtimeMs <= msVideo + 5000;
  };
  let moc = [];
  let mocLech = false;
  try {
    const tho = fs.readFileSync(path.join(out, 'timing.json'));
    moc = moHinh.mocTuTiming(JSON.parse(tho.toString('utf8')));
    const bam = require('node:crypto').createHash('sha256').update(tho).digest('hex').slice(0, 16);
    mocLech = khop('timing.json', 'timing', bam) === false;
  } catch { /* chưa có mốc */ }
  const g = tepGiongKhop(deckDir);
  const kg = g ? (g.file ? true : false) : null;
  const kd = khop('slide_audio.webm', 'deckAm');
  // Thiếu / lệch một trong hai thì dùng tiếng ĐÃ TRỘN của video — đừng ghép nửa vời.
  const dung = kg === true && kd === true;
  /* Bản KHÔNG phụ đề (phụ đề tách lớp, src/render/phuDeLop.js): chỉ nhận khi info.json ghi đúng
     cỡ của nó (đổi tên deck thì tên đổi theo, cỡ thì không) và còn dữ liệu phụ đề của lượt đó. */
  let noPhuDe = null;
  let phuDeGoc = null;
  let phuDeSha = null;
  const tenNo = path.basename(v.path).replace(/\.mp4$/i, '.nophude.mp4');
  try {
    const st = fs.statSync(path.join(out, tenNo));
    if (dau && dau.nophude && dau.nophude.size === st.size) {
      const tho = fs.readFileSync(path.join(out, 'phu-de', 'phude.json'));
      const bam = require('node:crypto').createHash('sha256').update(tho).digest('hex').slice(0, 16);
      // Dữ liệu phụ đề phải ĐÚNG của lượt đã ghi info.json (lượt sau hỏng giữa chừng không được lọt).
      if (!dau.phude || dau.phude.sha === bam) {
        phuDeGoc = JSON.parse(tho.toString('utf8'));
        if (phuDeGoc && Array.isArray(phuDeGoc.captions)) { noPhuDe = path.join(out, tenNo); phuDeSha = bam; }
      }
    }
  } catch { noPhuDe = null; phuDeGoc = null; phuDeSha = null; }
  return {
    video: v.path, moc, mocLech, noPhuDe, phuDeGoc: noPhuDe ? phuDeGoc : null, phuDeSha,
    tiengLech: kg === false || kd === false,
    giong: dung ? g.file : null,
    deck: dung ? path.join(out, 'slide_audio.webm') : null,
  };
}

/** Phụ đề (giây GỐC) → trục timeline đã sửa V1 — moHinh.chieuPhuDe (dùng chung với xem trước). */
const chieuPhuDe = (caps, moc) => moHinh.chieuPhuDe(caps, moc);

/** Đổi tên có thử lại (Windows: trình phát đang mở tệp cũ → EBUSY/EPERM). */
async function doiTenThuLai(tu, den) {
  let loi;
  for (let lan = 0; lan < 12; lan += 1) {
    try {
      if (fs.existsSync(den)) fs.unlinkSync(den);
      fs.renameSync(tu, den);
      return den;
    } catch (e) {
      loi = e;
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  // Tệp cũ đang bị giữ: GIỮ bản vừa xuất dưới tên khác thay vì vứt đi.
  const thay = den.replace(/\.mp4$/, `-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`);
  try { fs.renameSync(tu, thay); return thay; } catch { throw loi; }
}

/**
 * Chạy xuất thật (gọi từ hàng đợi dựng).
 * @param {{ deckDir: string, onStep: Function, shouldCancel: () => boolean,
 *           appVersion?: string, kiemHanMuc?: boolean, doThongSo: (f: string) => object }} o
 *   `doThongSo` = `ctx.doThongSoVideo` (main/duAn.js): { duration, width, height, fps, codecAmThanh }.
 * @returns {Promise<{ videoPath: string, duration: number, sizeBytes: number, banDung: true }>}
 */
async function xuatBanDung(o) {
  const deckDir = o.deckDir;
  const { duAn: daDoc, chiDoc } = kho.docDuAn(deckDir);
  if (chiDoc) throw new Error('Dự án dựng do bản app mới hơn tạo — cập nhật app để xuất bản dựng.');
  if (!daDoc) throw new Error('Chưa có gì để xuất — thêm media lên timeline trước.');
  let daLuu = daDoc;
  /* DỰ ÁN VIDEO TRỐNG (GĐ3.4): không có video slide / giọng / nhạc deck / mốc — đầu vào rỗng, nền đen do
     taoLenh tự sinh (lavfi). Trước đây phải dựng nền đen giả `_nen.mp4` cho đủ dài ở đây. */
  const dvVideo0 = require('./duAnVideo');
  const dv = dvVideo0.laDuAnVideo(deckDir)
    ? { moc: [], video: null, giong: null, deck: null, noPhuDe: null, phuDeSha: null, mocLech: false }
    : dauVaoDeck(deckDir);
  if (!dv) throw new Error('Deck chưa có video slide — bấm "Tạo video" trước, rồi mới xuất bản dựng.');
  // L3 (GĐ3.1): neo + đoạn V1 theo lại slide cùng lời thoại (xuất từ MCP / CLI mà chưa mở trình dựng).
  daLuu = moHinh.khopSlide(daLuu, dv.moc).duAn;
  // Bản vá của người gọi (render/queue.js — media bộ slide phụ vừa dựng): áp lên bản đọc từ đĩa.
  if (typeof o.apDung === 'function') daLuu = o.apDung(daLuu) || daLuu;
  if (dv.mocLech) {
    throw new Error('Lần "Tạo video" gần nhất chưa xong — mốc slide không khớp video slide hiện có, khối neo theo '
      + 'slide sẽ lệch chỗ. Bấm "Tạo video" lại cho xong rồi mới xuất bản dựng.');
  }
  const ts = { ...((dv.video && o.doThongSo(dv.video)) || {}) };
  /* Dự án VIDEO TRỐNG: khổ + fps ở tệp đánh dấu, không có tiếng video. */
  const dvVideo = require('./duAnVideo');
  if (dvVideo.laDuAnVideo(deckDir)) {
    const kv = dvVideo.khungDuAn(deckDir);
    Object.assign(ts, { width: kv.rong, height: kv.cao, fps: kv.fps, codecAmThanh: null });
  }
  /* Bên gọi thiếu cỡ hình / không nói video có tiếng không: tự đo bằng ffprobe — khung
     sai là deck ngang bị ép dọc, tưởng có tiếng là ffmpeg chết ở `[0:a]` (audit 10/10/2026). */
  if (dv.video && (!(Number(ts.width) > 0) || ts.codecAmThanh === undefined)) {
    const t2 = await require('./media').doThongSo(dv.video).catch(() => null);
    if (t2) {
      if (!(Number(ts.width) > 0)) { ts.width = t2.rong; ts.height = t2.cao; ts.fps = ts.fps || t2.fps; }
      if (ts.codecAmThanh === undefined) ts.codecAmThanh = t2.coTieng ? (t2.codecTieng || 'co') : null;
      if (!(Number(ts.duration) > 0)) ts.duration = t2.ms / 1000;
    }
  }
  /* DỰ ÁN VIDEO TRỐNG (duAnVideo.js): bản xuất dài ĐÚNG tới khối cuối (không kéo đuôi đen) và ghi thẳng
     `<tên>.mp4`. Không có khối slide: khối đặt theo giờ tuyệt đối. */
  const laVideo = require('./duAnVideo').laDuAnVideo(deckDir);
  let msVideo = Math.round((Number(ts.duration) || 0) * 1000);
  if (laVideo) {
    msVideo = moHinh.tongMs(daLuu, [], 0);
    if (!msVideo) throw new Error('Timeline còn trống — thả ảnh, video, nhạc hoặc thêm chữ trước khi xuất video.');
  }
  if (!msVideo) throw new Error('Không đọc được thời lượng video slide.');
  // Đuôi video sau slide cuối thuộc slide cuối — cùng phép với dung:doc (xem trước), kẻo dời khối slide là mất đuôi.
  if (!laVideo) dv.moc = moHinh.keoDuoiMoc(dv.moc, msVideo);
  const ff = path.join(config.ffmpegDir() || '', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (!fs.existsSync(ff)) throw new Error('Thiếu ffmpeg đi kèm app.');
  /* KHUNG = đúng cỡ video slide (deck ngang 16:9 thì xuất ngang), không tin số đã lưu:
     dự án tạo trước khi có video, hay deck đổi khổ rồi dựng lại (audit 10/10/2026). */
  const duAn = Number(ts.width) > 0 && Number(ts.height) > 0
    ? { ...daLuu, khung: { rong: Number(ts.width), cao: Number(ts.height), fps: Math.round(Number(ts.fps)) || daLuu.khung.fps || 30 } }
    : daLuu;
  // Media còn trên đĩa không (Dọn dẹp đã bỏ, rồi Ctrl+Z khôi phục bản ghi…).
  const dungDen = new Set(duAn.khoi.map((c) => c.media));
  const mat = duAn.media.filter((m) => dungDen.has(m.id)).filter((m) => {
    const f = kho.duongTrongDeck(deckDir, m.tep);
    return !f || !fs.existsSync(f);
  });
  if (mat.length) throw new Error(`Thiếu tệp media trong dung/media: ${mat.map((m) => m.ten).join(', ')} — nhập lại hoặc xoá các khối dùng nó.`);

  /* `o.chiTieng` + `o.raTieng` (đường .wav): chỉ trộn TIẾNG của timeline cho phụ đề tự động — không
     hạn mức, không vẽ phụ đề, không chuẩn âm lượng (taoLenh: nhánh chiTieng). */
  const ra = o.chiTieng ? o.raTieng
    : path.join(deckDir, 'output', laVideo ? require('../render/tenVideo').tenVideo(path.basename(deckDir)) : tenRa(deckDir));
  const tam = o.chiTieng ? ra.replace(/\.wav$/i, '.tam.wav') : ra.replace(/\.mp4$/, '.tam.mp4');
  const tepLoc = ra.replace(/\.(mp4|wav)$/i, '.loc.txt');
  // Hạ nhạc khi có giọng: đo các đoạn có giọng (nhớ sẵn ở dung/cache) — cùng nguồn xem trước dùng.
  const hoatDong = duAn.amGoc && duAn.amGoc.haNhac && duAn.amGoc.haNhac.bat && dv.giong
    ? await require('./giong').hoatDong(deckDir, dv.giong) : [];
  /* Phụ đề ĐÃ SỬA trong trình dựng + có bản KHÔNG phụ đề: nền = bản không phụ đề, vẽ lại lớp phụ
     đề từ dữ liệu đã sửa bằng chính trang quay của deck (cần cửa sổ Electron — chỉ ở app). */
  let videoNen = dv.video;
  let lopPhuDe = null;
  let tepTrangPD = null;
  if (!o.chiTieng && duAn.phuDe && duAn.phuDe.goc && dv.phuDeSha && duAn.phuDe.goc !== dv.phuDeSha) {
    /* Gọi từ "Tạo video" (render/queue.js — lượt vừa dựng xong là phụ đề MỚI): dùng phụ đề mới,
       bỏ bản sửa cũ, báo nhẹ — đừng để cả lượt dựng hỏng vì một chỉnh sửa đã lỗi thời. */
    if (!o.boQuaPhuDeCu) {
      throw new Error('Phụ đề đã sửa thuộc một lần "Tạo video" trước — lời thoại có thể đã đổi. Bấm track C1 → tab Thuộc tính → "Khôi phục phụ đề gốc" rồi sửa lại trước khi xuất.');
    }
    o.onStep('mux', 'Phụ đề sửa ở lần trước không còn khớp lời thoại mới — dùng phụ đề mới', { progress: 0 });
    duAn.phuDe = null;
    /* Bỏ phụ đề cũ xong mà KHÔNG còn chỉnh sửa nào khác: bản dựng sẽ y hệt video slide — đừng mã hoá lại
       vô ích mỗi lần "Tạo video" (rà 16/10/2026). Bên gọi (render/queue.js) hiểu `boQua`. */
    if (!moHinh.coChinhSua(duAn)) return { boQua: true, banDung: true };
  }
  /* Dự án VIDEO TRỐNG: nền đen vốn KHÔNG có phụ đề — phụ đề tự động (dung:phuDeTuDong) vẽ lên y như
     phụ đề đã sửa của deck. Trục là trục timeline (mốc rỗng). */
  if (!o.chiTieng && (dv.noPhuDe || laVideo) && duAn.phuDe) {
    videoNen = dv.noPhuDe || dv.video;
    const caps = duAn.phuDe.an ? [] : chieuPhuDe(duAn.phuDe.captions, moHinh.mocDich(laVideo ? [] : dv.moc, duAn.slide, duAn.khung.fps));
    if (caps.length) {
      o.onStep('mux', 'Vẽ lại phụ đề đã sửa', { progress: 0 });
      const rh = require('../render/recordingHtml');
      const { tiLeDiemAnh } = require('../render/offscreen');
      const KV = duAn.khung;
      const tiLe = tiLeDiemAnh(KV.rong, KV.cao);
      tepTrangPD = rh.prepareRecordingHtml(deckDir, {
        khung: rh.khungCuaDeck(deckDir), videoWidth: KV.rong / tiLe, videoHeight: KV.cao / tiLe,
        outName: '_phude-dung.html', subtitleData: { captions: caps },
      });
      try {
        lopPhuDe = await require('../render/phuDeLop').vePhuDeLop({
          htmlPath: tepTrangPD, width: KV.rong, height: KV.cao, cssScale: tiLe, captions: caps,
          outDir: path.join(kho.thuMucCache(deckDir).goc, 'phu-de'), shouldCancel: o.shouldCancel,
        });
      } finally {
        try { fs.unlinkSync(tepTrangPD); } catch { /* bỏ */ }
      }
    }
  }
  const lenh = taoLenh(duAn, {
    deckDir, moc: laVideo ? [] : dv.moc, msVideo, video: videoNen, giong: dv.giong, deck: dv.deck, ra: tam, tepLoc, lopPhuDe,
    coTiengVideo: !!ts.codecAmThanh || ts.codecAmThanh === undefined,
    ganDongLenh: ff.length, hoatDong, chiTieng: !!o.chiTieng,
  });

  let luotDaGiu = null;
  let xong = false;
  try {
    if (o.kiemHanMuc !== false && !o.chiTieng) {
      const { xinPhep } = require('../auth/quota');
      const q = await xinPhep({ project: path.basename(deckDir), slides: dv.moc.length || 0, appVersion: o.appVersion });
      luotDaGiu = q.renderId || null;
      if (q.conLai != null) o.onStep('project', `Gói miễn phí, còn ${q.conLai} lượt tạo video`, { conLai: q.conLai });
    }
    /* Dự án video TẠO MỚI chưa có output/ — trước GĐ3.4 bước tạo nền đen `_nen.mp4` tạo hộ thư mục, bỏ nền là
       lần xuất đầu hỏng ENOENT ở `.loc.txt` (thử dựng thật 23/10/2026). */
    fs.mkdirSync(path.dirname(tepLoc), { recursive: true });
    fs.writeFileSync(tepLoc, lenh.loc, 'utf8');
    /* `o.nhan`: chữ hiện ở tiến độ. Gọi từ "Tạo video" (render/queue.js) là "Áp chỉnh sửa timeline" —
       nút "Xuất bản dựng" đã bỏ khỏi giao diện, đừng nhắc tên nó với người dùng. */
    const nhan = o.nhan || (o.chiTieng ? 'Trộn tiếng timeline' : laVideo ? 'Xuất video' : 'Xuất bản dựng');
    o.onStep('mux', `${nhan} · ${lenh.soKhoi} khối · ${(lenh.tongMs / 1000).toFixed(1)} giây`, { progress: 0 });
    await new Promise((xongOk, hong) => {
      // cwd = deck: media gọi bằng đường tương đối (dòng lệnh ngắn — trần 32 767 ký tự của Windows).
      const p = spawn(ff, lenh.args, { cwd: lenh.cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let loi = '';
      p.stderr.on('data', (b) => { loi = (loi + b).slice(-4000); });
      p.stdout.on('data', (b) => {
        const k = /out_time_us=(\d+)/.exec(String(b));
        if (k) o.onStep('mux', nhan === 'Xuất bản dựng' ? 'Đang xuất bản dựng' : `${nhan}…`, { progress: Math.min(0.99, Number(k[1]) / 1000 / lenh.tongMs) });
      });
      const canh = setInterval(() => {
        if (o.shouldCancel()) { clearInterval(canh); try { p.kill(); } catch { /* đã thoát */ } }
      }, 300);
      p.on('error', (e) => { clearInterval(canh); hong(e); });
      p.on('close', (ma) => {
        clearInterval(canh);
        if (o.shouldCancel()) { hong(Object.assign(new Error('Đã dừng xuất bản dựng.'), { cancelled: true })); return; }
        if (ma !== 0) { hong(new Error(`ffmpeg báo lỗi khi xuất bản dựng: ${loi.trim().split(/\r?\n/).slice(-3).join(' · ')}`)); return; }
        xongOk();
      });
    });
    /* Chuẩn âm lượng -14 LUFS (src/render/amLuong.js) — cùng mức với "Tạo video": thêm nhạc,
       B-roll có tiếng… là độ lớn đổi. Chỉ mã hoá lại phần tiếng. */
    if (o.chuanAmLuong !== false && !o.chiTieng) {
      o.onStep('mux', 'Chuẩn âm lượng', { progress: 0.99 });
      const aL = require('../render/amLuong');
      const ff = path.join(require('../config').ffmpegDir() || '', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
      const kqAm = await aL.chuanAmLuong({ ffmpeg: ff, tep: tam, tanSo: 44100, shouldCancel: o.shouldCancel });
      o.onStep('mux', aL.moTa(kqAm), { progress: 0.995 });
    }
    const duong = await doiTenThuLai(tam, ra);
    const st = fs.statSync(duong);
    xong = true;
    if (luotDaGiu) { try { require('../auth/quota').xacNhanXong(luotDaGiu); } catch { /* lưới đỡ */ } }
    o.onStep('done', `${nhan === 'Xuất bản dựng' ? 'Xong bản dựng' : `Xong — ${nhan.toLowerCase()}`} · ${(lenh.tongMs / 1000).toFixed(2)}s · ${(st.size / 1024 / 1024).toFixed(1)} MB`, { progress: 1 });
    return { videoPath: duong, duration: lenh.tongMs / 1000, sizeBytes: st.size, banDung: true, ...(laVideo ? { duAnVideo: true } : {}) };
  } finally {
    try { if (fs.existsSync(tam)) fs.unlinkSync(tam); } catch { /* bị khoá thì lần sau ghi đè */ }
    try { if (fs.existsSync(tepLoc)) fs.unlinkSync(tepLoc); } catch { /* bỏ */ }
    if (!xong && luotDaGiu) {
      const { traLuot } = require('../auth/quota');
      await traLuot(luotDaGiu);
    }
  }
}

/** Deck có chỉnh sửa trên timeline cần áp vào video không (dự án đọc được + moHinh.coChinhSua). */
function coChinhSuaDeck(deckDir) {
  try {
    const { duAn, chiDoc } = kho.docDuAn(deckDir);
    return !chiDoc && moHinh.coChinhSua(duAn);
  } catch { return false; }
}

module.exports = { taoLenh, xuatBanDung, coChinhSuaDeck, dauVaoDeck, chieuPhuDe, tepGiongKhop, TEP_GIONG, chuoiAtempo, tenRa, coTiengKhoi, lenhDoMo, TRAN_DONG_LENH }