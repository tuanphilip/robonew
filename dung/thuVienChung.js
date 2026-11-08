;
'use strict';
/**
 * THƯ VIỆN DÙNG CHUNG + MẪU INTRO/OUTRO của trình dựng (Giai đoạn 3).
 *
 *   <userData>/thu-vien-chung/
 *     muc-luc.json          { phienBan, media: [...], mau: [...] }
 *     media/<băm12>-<tên>    tệp gốc (chép, tên theo băm ⇒ cùng tệp chỉ giữ một bản)
 *     anh/<id>.jpg          ảnh thu nhỏ 320px
 *
 * Vì sao ở thư mục dữ liệu của APP chứ không ở thư mục nguồn: logo / nhạc nền / intro dùng
 * cho MỌI dự án, kể cả khi người dùng đổi thư mục nguồn. Dự án vẫn TỰ ĐỦ: dùng một mục thư
 * viện là CHÉP tệp vào `<deck>/dung/media/` (media.nhap — cùng đường nhập tay, cùng kiểm),
 * nên chép deck sang máy khác hay xoá thư viện không làm hỏng dự án.
 *
 * MẪU = một nhóm khối (chữ + logo + nhạc…) lưu kèm giờ TƯƠNG ĐỐI và track theo LOẠI + thứ
 * tự; chèn vào dự án khác là chép media của nó vào deck rồi đặt lại các khối (dung-kho.js).
 *
 * Mọi thứ đi qua đây đều kiểm: id đúng dạng, đường tệp nằm TRONG thư mục thư viện (cả
 * realpath — chặn junction), mục lục hỏng thì cất riêng và bắt đầu mục lục mới.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const media = require('./media');
const moHinh = require('./moHinh');

const PHIEN_BAN = 1;
const TRAN = { media: 2000, mau: 300, khoiMau: 200 };
const ID = /^[A-Za-z0-9_-]{1,40}$/;

let gocThuMuc = null;
/** Thư mục thư viện. `datGoc` cho bộ thử; app gọi `khoiTao(app)`. */
function datGoc(d) { gocThuMuc = d; }
function khoiTao(app) { if (!gocThuMuc) gocThuMuc = path.join(app.getPath('userData'), 'thu-vien-chung'); }
const goc = () => { if (!gocThuMuc) throw new Error('Thư viện dùng chung chưa khởi tạo.'); return gocThuMuc; };
const tepMucLuc = () => path.join(goc(), 'muc-luc.json');

/** Đường tuyệt đối của một tệp tương đối trong thư viện — null nếu ra ngoài. */
function trongThuVien(rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\0') || rel.includes(':') || rel.includes('\\')) return null;
  const phan = rel.split('/');
  if (phan.some((x) => !x || x === '.' || x === '..')) return null;
  if (!['media', 'anh'].includes(phan[0])) return null;
  const f = path.join(goc(), ...phan);
  const g = path.resolve(goc()) + path.sep;
  if (!path.resolve(f).startsWith(g)) return null;
  try {
    const that = fs.realpathSync(f);
    if (!that.startsWith(fs.realpathSync(goc()) + path.sep)) return null;
  } catch { /* chưa có tệp — để bên gọi báo */ }
  return f;
}

/* ── mục lục ─────────────────────────────────────────────────────────── */
function rong() { return { phienBan: PHIEN_BAN, media: [], mau: [] }; }

function doc() {
  let j;
  try { j = JSON.parse(fs.readFileSync(tepMucLuc(), 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return rong();
    // Hỏng: cất riêng (đừng xoá — người dùng có thể cần), bắt đầu mục lục mới.
    try { fs.renameSync(tepMucLuc(), `${tepMucLuc()}.hong-${Date.now()}`); } catch { /* bỏ */ }
    return rong();
  }
  if (!j || typeof j !== 'object') return rong();
  const mediaSach = (Array.isArray(j.media) ? j.media : []).slice(0, TRAN.media).filter((m) => m && ID.test(m.id)
    && moHinh.LOAI_MEDIA.includes(m.loai) && typeof m.tep === 'string' && trongThuVien(m.tep));
  const mauSach = (Array.isArray(j.mau) ? j.mau : []).slice(0, TRAN.mau).filter((x) => x && ID.test(x.id) && Array.isArray(x.khoi));
  return { phienBan: PHIEN_BAN, media: mediaSach, mau: mauSach };
}

function ghi(ml) {
  fs.mkdirSync(goc(), { recursive: true });
  const tam = `${tepMucLuc()}.tam-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
  fs.writeFileSync(tam, JSON.stringify(ml, null, 1), 'utf8');
  fs.renameSync(tam, tepMucLuc());
}

/** Bản công khai của một mục (cho giao diện / MCP) — kèm URL ảnh thu nhỏ & tệp. */
function moTa(m) {
  return {
    id: m.id, ten: m.ten, loai: m.loai, ms: m.ms || 0, rong: m.rong || 0, cao: m.cao || 0, coTieng: !!m.coTieng,
    byte: m.byte || 0, them: m.them || '', chu: m.chu || null,
    anh: m.anh ? `bee-media://thu-vien/${m.anh.split('/').map(encodeURIComponent).join('/')}` : null,
    url: `bee-media://thu-vien/${m.tep.split('/').map(encodeURIComponent).join('/')}`,
  };
}

/* ── thêm / xoá media ──────────────────────────────────────────────────── */
async function taoAnh(m) {
  if (m.loai === 'tieng') return null;
  const ff = media.exe('ffmpeg');
  const vao = trongThuVien(m.tep);
  if (!ff || !vao) return null;
  fs.mkdirSync(path.join(goc(), 'anh'), { recursive: true });
  const rel = `anh/${m.id}.jpg`;
  const ra = path.join(goc(), 'anh', `${m.id}.jpg`);
  if (fs.existsSync(ra)) return rel;
  const { spawnSync } = require('node:child_process');
  const ss = m.loai === 'video' ? ['-ss', String(Math.min(3, (m.ms / 1000) * 0.1))] : [];
  const r = spawnSync(ff, ['-y', '-v', 'error', ...ss, '-i', vao, '-frames:v', '1',
    '-vf', m.loai === 'video' ? 'thumbnail=12,scale=320:-2' : 'scale=320:-2', '-q:v', '4', ra], { windowsHide: true, timeout: 60000 });
  return r.status === 0 && fs.existsSync(ra) ? rel : null;
}

/**
 * Thêm một tệp vào thư viện (chép, khử trùng theo băm). Dùng CHÍNH `media.nhap` để đọc
 * thông số + kiểm (thư mục thư viện đóng vai "deck": tệp nằm ở `<goc>/dung/media/` rồi
 * dời sang `<goc>/media/`) — một đường kiểm duy nhất cho mọi media.
 * @param {{ ten?: string, chu?: object }} [o]
 */
/* Thêm tuần tự: `themTep` mượn `<goc>/dung/media` làm chỗ tạm rồi dọn — hai lượt song song
   dọn mất tệp của nhau. */
let hangThem = Promise.resolve();
function themTep(duong, o = {}) {
  const p = hangThem.then(() => themTepMot(duong, o));
  hangThem = p.catch(() => {});
  return p;
}
async function themTepMot(duong, o = {}) {
  fs.mkdirSync(goc(), { recursive: true });
  const r = await media.nhap(goc(), duong, { ten: o.ten });
  if (!r.ok) return r;
  const ml = doc();
  const tenTep = r.media.tep.split('/').pop();
  fs.mkdirSync(path.join(goc(), 'media'), { recursive: true });
  const tu = path.join(goc(), 'dung', 'media', tenTep);
  const den = path.join(goc(), 'media', tenTep);
  if (!fs.existsSync(den)) fs.renameSync(tu, den);
  else { try { fs.unlinkSync(tu); } catch { /* bỏ */ } }
  try { fs.rmSync(path.join(goc(), 'dung'), { recursive: true, force: true }); } catch { /* bỏ */ }
  const cu = ml.media.find((m) => m.id === r.media.id);
  if (cu) return { ok: true, daCo: true, muc: moTa(cu) };
  if (ml.media.length >= TRAN.media) return { ok: false, loi: `Thư viện đã có ${TRAN.media} mục — xoá bớt trước.` };
  const m = { ...r.media, tep: `media/${tenTep}`, them: new Date().toISOString() };
  if (o.chu) {
    const k = moHinh.kiem({ ...moHinh.moi(), media: [{ ...r.media, chu: o.chu }] });
    if (k.ok && k.duAn.media[0].chu) m.chu = k.duAn.media[0].chu;
  }
  // Giọng đọc thành khối (GĐ2.1): giữ chữ + giọng — chèn lại từ thư viện vẫn "Sửa lời / đổi giọng" được.
  if (o.tts && r.media.loai === 'tieng') {
    const t = moHinh.ttsSach(o.tts);
    if (t) m.tts = t;
  }
  m.anh = await taoAnh(m);
  ml.media.push(m);
  ghi(ml);
  return { ok: true, daCo: false, muc: moTa(m) };
}

function xoa(id) {
  const ml = doc();
  const m = ml.media.find((x) => x.id === id);
  if (!m) return { ok: false, loi: 'Không thấy mục này trong thư viện.' };
  /* Mẫu chỉ giữ id media thư viện — xoá mục thì mẫu không chèn được nữa. Bắt xoá mẫu trước. */
  const mauDung = ml.mau.filter((x) => (x.media || []).includes(id));
  if (mauDung.length) {
    return { ok: false, loi: `Mục này đang dùng trong mẫu "${mauDung[0].ten}"${mauDung.length > 1 ? ` và ${mauDung.length - 1} mẫu khác` : ''} — xoá mẫu trước.` };
  }
  ml.media = ml.media.filter((x) => x.id !== id);
  ghi(ml);
  [m.tep, m.anh].filter(Boolean).forEach((rel) => { const f = trongThuVien(rel); if (f) { try { fs.unlinkSync(f); } catch { /* bỏ */ } } });
  return { ok: true };
}

function doiTen(id, ten) {
  const ml = doc();
  const m = ml.media.find((x) => x.id === id);
  if (!m || typeof ten !== 'string' || !ten.trim()) return { ok: false, loi: 'Tên sai.' };
  m.ten = ten.trim().slice(0, 255);
  ghi(ml);
  return { ok: true, muc: moTa(m) };
}

/** Chép các mục thư viện vào deck → bản ghi media của DỰ ÁN (giữ thông số chữ tiêu đề). */
async function vaoDeck(deckDir, ids) {
  const ml = doc();
  const ra = { media: [], loi: [] };
  for (const id of (Array.isArray(ids) ? ids : []).slice(0, 200)) {
    const m = ml.media.find((x) => x.id === id);
    const f = m && trongThuVien(m.tep);
    if (!m || !f || !fs.existsSync(f)) { ra.loi.push(`Mục thư viện ${String(id).slice(0, 40)} không còn.`); continue; }
    const r = await media.nhap(deckDir, f, { ten: m.ten });
    if (!r.ok) { ra.loi.push(r.loi); continue; }
    ra.media.push({ ...r.media, ...(m.chu ? { chu: m.chu } : {}), ...(m.tts ? { tts: m.tts } : {}), daCo: r.daCo, tuThuVien: id });
  }
  return ra;
}

/* ── mẫu intro / outro ─────────────────────────────────────────────────── */
/**
 * Lưu mẫu. `khoi`: [{ loaiTrack: 'hinh'|'tieng', thuTu: số (0 = track người dùng thấp nhất
 * của loại đó), lechMs, media: id THƯ VIỆN, vaoMs, raMs, tocDo, bienDoi, amLuong, mo, kf, cat, lat }].
 */
function luuMau({ ten, khoi, khung }) {
  const ml = doc();
  if (ml.mau.length >= TRAN.mau) return { ok: false, loi: `Đã có ${TRAN.mau} mẫu — xoá bớt trước.` };
  if (typeof ten !== 'string' || !ten.trim()) return { ok: false, loi: 'Mẫu cần có tên.' };
  if (!Array.isArray(khoi) || !khoi.length || khoi.length > TRAN.khoiMau) return { ok: false, loi: 'Mẫu cần 1–200 khối.' };
  const coMedia = new Set(ml.media.map((m) => m.id));
  const sach = [];
  for (const k of khoi) {
    if (!k || !coMedia.has(k.media) || !['hinh', 'tieng'].includes(k.loaiTrack)) return { ok: false, loi: 'Khối của mẫu trỏ tới media không có trong thư viện.' };
    // Kiểm phần còn lại của khối bằng moHinh như một dự án một khối.
    const m = ml.media.find((x) => x.id === k.media);
    const thu = moHinh.kiem({ ...moHinh.moi(), media: [{ ...m, tep: `dung/media/${m.tep.split('/').pop()}` }],
      track: [{ id: 'T', loai: k.loaiTrack, ten: 'T' }],
      khoi: [{ ...k, id: 'k', track: 'T', neo: null, batDauMs: 0 }] });
    if (!thu.ok) return { ok: false, loi: `Khối mẫu sai: ${thu.loi[0]}` };
    const c = thu.duAn.khoi[0];
    sach.push({
      loaiTrack: k.loaiTrack, thuTu: Math.max(0, Math.min(10, Math.round(Number(k.thuTu) || 0))),
      lechMs: Math.max(0, Math.round(Number(k.lechMs) || 0)), media: k.media,
      ...(k.loaiTrack === 'tieng' && k.vaiTro === 'giong' ? { vaiTro: 'giong' } : {}),
      vaoMs: c.vaoMs, raMs: c.raMs, tocDo: c.tocDo, bienDoi: c.bienDoi, amLuong: c.amLuong, mo: c.mo, kf: c.kf, cat: c.cat, lat: c.lat,
      // GĐ2 (đã qua kiem ở trên): lặp, hiệu ứng chuyển động, màu.
      ...(c.lap ? { lap: true } : {}), ...(c.hieuUng ? { hieuUng: c.hieuUng } : {}), ...(c.mau ? { mau: c.mau } : {}),
    });
  }
  const dai = Math.max(...sach.map((k) => k.lechMs + Math.round((k.raMs - k.vaoMs) / (k.tocDo || 1))));
  const mau = {
    id: `t${crypto.randomBytes(5).toString('hex')}`, ten: ten.trim().slice(0, 80), taoLuc: new Date().toISOString(),
    khung: khung && Number(khung.rong) > 0 ? { rong: Math.round(khung.rong), cao: Math.round(khung.cao) } : null,
    daiMs: dai, media: [...new Set(sach.map((k) => k.media))], khoi: sach,
  };
  ml.mau.push(mau);
  ghi(ml);
  return { ok: true, mau: moTaMau(mau, ml) };
}

function moTaMau(x, ml) {
  const anh = (x.media || []).map((id) => ml.media.find((m) => m.id === id)).find((m) => m && m.anh);
  return { id: x.id, ten: x.ten, taoLuc: x.taoLuc, daiMs: x.daiMs, soKhoi: x.khoi.length, khung: x.khung,
    anh: anh ? moTa(anh).anh : null };
}
const dsMau = () => { const ml = doc(); return ml.mau.map((x) => moTaMau(x, ml)); };
const layMau = (id) => doc().mau.find((x) => x.id === id) || null;
function xoaMau(id) {
  const ml = doc();
  if (!ml.mau.some((x) => x.id === id)) return { ok: false, loi: 'Không thấy mẫu.' };
  ml.mau = ml.mau.filter((x) => x.id !== id);
  ghi(ml);
  return { ok: true };
}

const ds = () => doc().media.map(moTa);

module.exports = { PHIEN_BAN, datGoc, khoiTao, goc, trongThuVien, doc, ds, themTep, xoa, doiTen, vaoDeck, luuMau, dsMau, layMau, xoaMau }