};
'use strict';
/**
 * BỘ SLIDE PHỤ (GĐ3.7 lộ trình gộp slide + timeline, 17/10/2026 — chủ dự án chọn "như một clip").
 *
 * Bộ slide ĐẦU của dự án vẫn là deck ở gốc thư mục (khối slide V1/A1–A3/C1 đầy đủ). Bộ THỨ HAI trở đi là một deck
 * đầy đủ nằm ở `<dự án>/bo-slide/<id>/` (index.html, app.js, script-90s.txt, preview-settings.json, output/…), lên
 * timeline như MỘT clip video: media `{ boSlide: id, tep: 'dung/media/boslide-<id>-….mp4' }`.
 *
 *   · TÊN deck của bộ phụ (giao diện, IPC, MCP): `<dự án>::<id>` — mọi chỗ tra deck theo tên (giaoThuc.deckTrongNguon,
 *     main/duAn.js#resolveDeckDir, api-shim) hiểu dạng này, nên trình sửa / dựng / MCP của deck dùng lại nguyên vẹn.
 *   · "Tạo video" của dự án (render/queue.js): dựng các bộ phụ ĐANG CŨ rồi bộ đầu — CẢ DỰ ÁN MỘT LƯỢT (chủ dự án chốt).
 *   · Video bộ phụ dựng xong được CHÉP vào `dung/media/` dưới tên MỚI mỗi lần dựng (bộ nhớ đệm ảnh / sóng / proxy và
 *     trình duyệt khoá theo tên tệp) — mọi đường media có sẵn chạy y nguyên. KHÔNG hardlink (rà 3.7): lượt dựng lại ghi
 *     `ffmpeg -y` thẳng vào `output/<id>.mp4` — cùng dữ liệu với liên kết, media timeline đang dùng bị ghi đè giữa chừng.
 *     Tệp cũ KHÔNG tự xoá (lịch sử hoàn tác / bản .bak còn trỏ tới) — "Dọn dẹp" nhận chúng khi không còn bản nào dùng.
 *     Chưa dựng: một video ĐEN dài bằng thời lượng ước theo lời thoại đứng chỗ.
 *   · Giới hạn (đã chốt): phụ đề của bộ phụ in sẵn trong video của nó; không cắt / đổi chỗ từng slide; khối không neo
 *     theo slide của bộ phụ.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const THU_MUC = 'bo-slide';
const ID_BO = /^[a-z0-9][a-z0-9-]{0,39}$/;   // khớp moHinh.ID_BO
const NOI = '::';
const CHU_MOI_GIAY = 3.3;                     // như timeline.js (ước thời lượng khi chưa dựng)

/** `cha::id` → `{ cha, id }` (null nếu không phải tên bộ phụ hợp lệ). */
function tachTen(ten) {
  const s = String(ten || '');
  const i = s.indexOf(NOI);
  if (i <= 0) return null;
  const cha = s.slice(0, i);
  const id = s.slice(i + NOI.length);
  if (!cha || /[\\/:\0]/.test(cha) || cha === '.' || cha === '..' || !ID_BO.test(id)) return null;
  return { cha, id };
}
const tenBo = (cha, id) => `${cha}${NOI}${id}`;
const dirCon = (dirCha, id) => path.join(dirCha, THU_MUC, id);

/** Thư mục có phải một bộ phụ (`<cha>/bo-slide/<id>`) không → `{ dirCha, id }`. */
function laDirCon(dir) {
  const d = path.resolve(String(dir || ''));
  const id = path.basename(d);
  const giua = path.dirname(d);
  if (path.basename(giua) !== THU_MUC || !ID_BO.test(id)) return null;
  const dirCha = path.dirname(giua);
  return fs.existsSync(path.join(dirCha, 'index.html')) ? { dirCha, id } : null;
}

/** Tên deck của một thư mục: bộ phụ ⇒ `cha::id`, còn lại ⇒ tên thư mục. */
function tenDeckCua(dir) {
  const c = laDirCon(dir);
  return c ? tenBo(path.basename(c.dirCha), c.id) : path.basename(String(dir || ''));
}

/** Bộ phụ đang có trong dự án (thư mục có index.html), xếp theo id. */
function ds(dirCha) {
  const goc = path.join(dirCha, THU_MUC);
  let ten = [];
  try { ten = fs.readdirSync(goc); } catch { return []; }
  return ten.filter((id) => ID_BO.test(id) && fs.existsSync(path.join(goc, id, 'index.html'))).sort()
    .map((id) => ({ id, dir: path.join(goc, id) }));
}

/** Id mới chưa dùng: b2, b3… (bộ ĐẦU là deck gốc — "bộ 1"). */
function idMoi(dirCha) {
  const co = new Set(ds(dirCha).map((x) => x.id));
  for (let i = 2; i < 1000; i += 1) if (!co.has(`b${i}`) && !fs.existsSync(dirCon(dirCha, `b${i}`))) return `b${i}`;
  throw new Error('Quá nhiều bộ slide trong một dự án.');
}

/** Thời lượng ƯỚC (ms) theo lời thoại — như timeline.js ước khi deck chưa dựng. */
function uocMs(dir) {
  let dong = [];
  try { dong = fs.readFileSync(path.join(dir, 'script-90s.txt'), 'utf8').split(/\r?\n/).filter((l) => l.trim()); } catch { dong = []; }
  if (!dong.length) return 8000;
  return Math.round(dong.reduce((t, l) => {
    const n = l.trim().split(/\s+/).filter(Boolean).length;
    return t + (n ? Math.max(2, n / CHU_MOI_GIAY) : 4) * 1000;
  }, 0));
}

/** Video đã dựng của bộ phụ (`output/<id>.mp4`) hoặc null. */
function videoCua(dir) {
  return require('../render/tenVideo').timVideo(dir);
}

/* Bỏ qua khi dò "sửa sau lần dựng": thư mục của app + tệp app / HỆ ĐIỀU HÀNH tự ghi (mở thư mục bằng Finder / Explorer là
   có `.DS_Store` / `Thumbs.db` — không bỏ là bộ phụ "cần dựng lại" mãi — audit 3.7; khớp ipc/projects.js#TEP_APP_TU_GHI). */
const BO_QUA_QUET = new Set(['output', 'dung', 'qa', 'node_modules', '.git', '_preview.html', '_recording.html', '_bia.html',
  '_phude-dung.html', 'Thumbs.db', 'desktop.ini']);
/** Có tệp nào của deck (trừ output/, dung/…) sửa SAU mốc `ms` — lời, thiết lập, trang, ảnh trong assets… */
function coTepMoiHon(dir, ms, sau = 0, dem = { n: 0 }) {
  let ds = [];
  try { ds = fs.readdirSync(dir, { withFileTypes: true }); } catch { return false; }
  for (const e of ds) {
    if (BO_QUA_QUET.has(e.name) || e.name.startsWith('.') || ++dem.n > 3000) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (sau < 4 && coTepMoiHon(f, ms, sau + 1, dem)) return true; continue; }
    try { if (fs.statSync(f).mtimeMs > ms + 1000) return true; } catch { /* vừa mất */ }
  }
  return false;
}
/**
 * Bộ phụ CẦN dựng: chưa có video; lượt dựng gần nhất DỞ (video ghi sau hồ sơ `<id>.info.json` — pipeline ghi hồ sơ
 * SAU CÙNG, huỷ / hỏng sau bước ghép là để lại video mới mà không có hồ sơ mới — rà 3.7); hoặc tệp nào của deck sửa
 * sau lần dựng xong cuối.
 */
function canDung(dir) {
  const v = videoCua(dir);
  if (!v) return true;
  let msV = 0;
  let msI = 0;
  try {
    msV = fs.statSync(v.path).mtimeMs;
    msI = fs.statSync(v.path.replace(/\.mp4$/i, '.info.json')).mtimeMs;
  } catch { return true; }
  if (msI + 2000 < msV) return true;
  return coTepMoiHon(dir, msI);
}

/** Id các bộ phụ đang ĐƯỢC DÙNG trên timeline — có CLIP dùng media của bộ đó (bộ chỉ còn media / mồ côi: không dựng). */
function dangDung(duAn) {
  const mm = new Map(((duAn && duAn.media) || []).map((m) => [m.id, m]));
  return new Set(((duAn && duAn.khoi) || []).map((c) => (mm.get(c.media) || {}).boSlide).filter(Boolean));
}

const ffmpeg = () => require('./media').exe('ffmpeg');

/**
 * Video ĐEN đứng chỗ (chưa dựng) đúng khổ + fps dự án, dài `ms` — có luồng tiếng im (bản xuất trộn tiếng clip).
 * @returns {Promise<string>} đường tuyệt đối trong dung/media/
 */
async function taoChoTrong(dirCha, id, khung, ms) {
  const ff = ffmpeg();
  if (!ff) throw new Error('Thiếu ffmpeg đi kèm app.');
  const thuMuc = path.join(dirCha, 'dung', 'media');
  fs.mkdirSync(thuMuc, { recursive: true });
  const f = path.join(thuMuc, `boslide-${id}-cho-${Math.round(ms)}.mp4`);
  if (fs.existsSync(f)) return f;
  const tam = `${f}.tam-${process.pid}.mp4`;
  const giay = (Math.max(1000, ms) / 1000).toFixed(3);
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(ff, ['-y', '-v', 'error', '-nostdin',
    '-f', 'lavfi', '-i', `color=c=black:s=${khung.rong}x${khung.cao}:r=${khung.fps || 30}:d=${giay}`,
    '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo`, '-t', giay,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', tam], { windowsHide: true });
  if (r.status !== 0) { try { fs.unlinkSync(tam); } catch { /* chưa có */ } throw new Error('Không tạo được video đứng chỗ cho bộ slide.'); }
  fs.renameSync(tam, f);
  return f;
}

/** Thông số media (phần dùng trong du-an.json) của một tệp video trong dung/media/. */
async function thongSoMedia(dirCha, f) {
  const ts = await require('./media').doThongSo(f);
  if (!ts || !(ts.ms > 0)) throw new Error('Không đọc được video của bộ slide.');
  return {
    tep: `dung/media/${path.basename(f)}`, ms: ts.ms, rong: ts.rong, cao: ts.cao, fps: ts.fps, xoay: ts.xoay || 0,
    coTieng: !!ts.coTieng, byte: fs.statSync(f).size, codec: ts.codec, pixFmt: ts.pixFmt, codecTieng: ts.codecTieng,
  };
}

/** Tên tệp trong dung/media cho video HIỆN TẠI của bộ phụ (theo cỡ + giờ sửa — dựng lại là tên mới), null nếu chưa có. */
function tenBanSao(dirCha, id) {
  const v = videoCua(dirCon(dirCha, id));
  if (!v) return null;
  const st = fs.statSync(v.path);
  const bam = crypto.createHash('sha1').update(`${st.size}:${Math.round(st.mtimeMs)}`).digest('hex').slice(0, 10);
  return { nguon: v.path, ten: `boslide-${id}-${bam}.mp4` };
}

/**
 * CHÉP video ĐÃ DỰNG của bộ phụ vào dung/media/ (không hardlink — xem đầu tệp).
 * @returns {Promise<string|null>} đường tuyệt đối, null nếu bộ chưa có video
 */
async function lienKet(dirCha, id) {
  const b = tenBanSao(dirCha, id);
  if (!b) return null;
  const thuMuc = path.join(dirCha, 'dung', 'media');
  fs.mkdirSync(thuMuc, { recursive: true });
  const f = path.join(thuMuc, b.ten);
  if (!fs.existsSync(f)) {
    const tam = `${f}.tam-${process.pid}`;
    await fs.promises.copyFile(b.nguon, tam);
    fs.renameSync(tam, f);
  }
  return f;
}

/** Dự án có bộ phụ đang dùng mà video CHƯA lên timeline (cần dựng, hoặc đã dựng mà media còn tệp cũ) — "video cũ". */
function coBoCu(dirCha, duAn) {
  const dung = dangDung(duAn);
  if (!dung.size) return false;
  const mm = ((duAn && duAn.media) || []).filter((m) => m.boSlide && dung.has(m.boSlide));
  return mm.some((m) => {
    const dir = dirCon(dirCha, m.boSlide);
    if (!fs.existsSync(path.join(dir, 'index.html'))) return false;
    if (canDung(dir)) return true;
    try { const b = tenBanSao(dirCha, m.boSlide); return !!b && `dung/media/${b.ten}` !== m.tep; } catch { return false; }
  });
}

/**
 * Sau khi dựng: bản vá media cho mọi bộ phụ đang dùng mà tệp trong dung/media KHÁC video mới nhất của nó.
 * @returns {Promise<Array<object>>} `[{ id: <media id>, tep, ms, … }]` — đưa vào moHinh.apMediaBoSlide
 */
async function chuanBiMedia(dirCha, duAn) {
  const ra = [];
  // Chỉ bộ ĐANG DÙNG (có clip): bộ mồ côi hỏng video không được chặn cả bước áp timeline (audit 3.7).
  const dung = dangDung(duAn);
  for (const m of ((duAn && duAn.media) || []).filter((x) => x.boSlide && dung.has(x.boSlide))) {
    // Bộ chưa có video: bỏ qua. Chép / đọc thông số HỎNG: ném lên — người gọi báo, không lặng lẽ xuất với video cũ (rà 3.7).
    const f = await lienKet(dirCha, m.boSlide);
    if (!f || `dung/media/${path.basename(f)}` === m.tep) continue;
    ra.push({ id: m.id, ...(await thongSoMedia(dirCha, f)) });
  }
  return ra;
}

const soDong = (dir) => {
  try { return fs.readFileSync(path.join(dir, 'script-90s.txt'), 'utf8').split(/\r?\n/).filter((l) => l.trim()).length; } catch { return 0; }
};

/**
 * "Tạo video" CẢ DỰ ÁN (render/queue.js, src/cli/render.js): dựng các bộ phụ đang dùng mà ĐANG CŨ, rồi deck gốc —
 * MỘT lượt hạn mức cho tất cả (chủ dự án chốt 17/10/2026). Không có bộ phụ nào cần dựng ⇒ đúng đường cũ (`dungMot`
 * của deck gốc tự giữ / xác nhận / trả lượt). Một bộ hỏng ⇒ cả lượt hỏng, trả lượt.
 * @param {{ dirCha: string, dungMot: (dir: string, them?: { kiemHanMuc?: false, nhan?: string }) => Promise<object>,
 *           appVersion?: string }} o
 */
async function dungCaDuAn(o) {
  const r = require('./kho').docDuAn(o.dirCha);
  const dung = r.duAn ? dangDung(r.duAn) : new Set();
  const can = ds(o.dirCha).filter((b) => dung.has(b.id) && canDung(b.dir));
  if (!can.length) return o.dungMot(o.dirCha);
  const quota = require('../auth/quota');
  const q = await quota.xinPhep({
    project: path.basename(o.dirCha),
    slides: [o.dirCha, ...can.map((b) => b.dir)].reduce((t, d) => t + soDong(d), 0),
    appVersion: o.appVersion,
  });
  const luot = (q && q.renderId) || null;
  let xong = false;
  try {
    for (let i = 0; i < can.length; i += 1) {
      try {
        await o.dungMot(can[i].dir, { kiemHanMuc: false, boPhu: true, nhan: `Bộ slide ${can[i].id.slice(1)} (${i + 1}/${can.length})` });
      } catch (e) {
        /* Lỗi của bộ PHỤ ("Slide 2: script có 1 câu…") mà không nói bộ nào thì người dùng sửa nhầm bộ đầu. */
        if (e && typeof e.message === 'string' && !e.cancelled) e.message = `Bộ slide ${can[i].id.slice(1)}: ${e.message}`;
        throw e;
      }
    }
    const res = await o.dungMot(o.dirCha, { kiemHanMuc: false });
    xong = true;
    if (luot) { try { quota.xacNhanXong(luot); } catch { /* lưới đỡ */ } }
    return res;
  } finally {
    if (!xong && luot) await quota.traLuot(luot);
  }
}

/**
 * Sau khi dựng: video mới của bộ phụ vào dung/media + vá du-an.json (moHinh.apMediaBoSlide). Tệp cũ để lại (Dọn dẹp).
 * @returns {Promise<{ va: Array<object>, moc: Array }>} `va` = bản vá đã áp (rỗng = không đổi) — gửi giao diện áp CÙNG
 *   phép lên ngăn đang mở; `moc` = mốc dùng khi kẹp (bản xuất áp lại cùng mốc).
 */
async function capNhatSauDung(dirCha) {
  const kho = require('./kho');
  const moHinh = require('./moHinh');
  const r = kho.docDuAn(dirCha);
  if (!r.duAn || r.chiDoc) return { va: [], moc: [] };
  const vaMedia = await chuanBiMedia(dirCha, r.duAn);
  if (!vaMedia.length) return { va: [], moc: [] };
  let mocGoc = [];
  try { mocGoc = moHinh.mocTuTiming(JSON.parse(fs.readFileSync(path.join(dirCha, 'output', 'timing.json'), 'utf8'))); } catch { mocGoc = []; }
  const moc = moHinh.mocDich(mocGoc, r.duAn.slide, r.duAn.khung && r.duAn.khung.fps);
  const moi = moHinh.apMediaBoSlide(r.duAn, vaMedia, moc);
  const g = kho.ghiDuAn(dirCha, moi);
  if (!g.ok) throw new Error((g.loi || []).join(' · ') || 'Không ghi được dự án dựng.');
  return { va: vaMedia, moc };
}

module.exports = {
  dungCaDuAn, capNhatSauDung,
  THU_MUC, ID_BO, NOI, tachTen, tenBo, dirCon, laDirCon, tenDeckCua, ds, idMoi, uocMs, videoCua, canDung, dangDung,
  taoChoTrong, thongSoMedia, tenBanSao, lienKet, coBoCu, chuanBiMedia, coTepMoiHon,
}