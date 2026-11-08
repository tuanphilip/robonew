;
'use strict';
/**
 * KHO trên đĩa của trình dựng — thư mục `<deck>/dung/` (KE-HOACH.md §3.1).
 *
 *   dung/du-an.json            timeline — nguồn sự thật
 *   dung/du-an.json.bak-1..5   bản lưu xoay vòng (1 = mới nhất), TỐI ĐA 5 phút một lần
 *   dung/du-an.json.hong-<giờ> tệp chính đọc không được — CẤT RIÊNG, không bao giờ xoay đè
 *   dung/media/                tệp người dùng nhập — CHÉP vào (chủ dự án chốt 10/10/2026)
 *   dung/cache/{anh,song,proxy}/  sinh ra, xoá được, tự sinh lại
 *
 * ⚠ GHI NGUYÊN TỬ: ghi `du-an.json.tam` (fsync) rồi đổi tên đè. Mất điện giữa chừng
 * thì còn nguyên bản cũ hoặc bản mới — không bao giờ nửa tệp JSON.
 *
 * ⚠ ĐỔI TÊN TRÊN WINDOWS hay vướng EPERM/EBUSY: antivirus, OneDrive, trình soạn thảo
 * đang mở tệp mà không cho xoá. Thử lại trong ~1,5 giây rồi mới chịu thua — và
 * `.bak` chỉ xoay SAU khi tệp tạm đã ghi xong, không thì mỗi lần lưu hỏng lại đẩy
 * một bản lịch sử thật ra khỏi vòng (audit 10/10/2026).
 *
 * ⚠ TỆP CHÍNH HỎNG (AI sửa tay, bản app MỚI HƠN ghi `phienBan` cao hơn…): đọc lùi về
 * `.bak` thì được, nhưng lượt lưu kế tiếp sẽ ĐÈ tệp chính — mất hẳn bản người dùng
 * đang có. Nên: phiên bản mới hơn ⇒ khoá ghi (chỉ đọc); hỏng kiểu khác ⇒ chép sang
 * `du-an.json.hong-<giờ>` trước khi cho ghi.
 *
 * Không `require('electron')`: bộ thử chạy bằng Node thường.
 */
const fs = require('node:fs');
const path = require('node:path');
const moHinh = require('./moHinh');

const THU_MUC = 'dung';
const TEP = 'du-an.json';
const SO_BAK = 5;
const NHIP_BAK_MS = 5 * 60 * 1000;

const thuMuc = (deckDir) => path.join(deckDir, THU_MUC);
const tepDuAn = (deckDir) => path.join(thuMuc(deckDir), TEP);

/**
 * Đường tuyệt đối của một tệp TƯƠNG ĐỐI trong deck — chỉ cho phép dưới các gốc
 * được liệt kê (mặc định `dung/`). Trả null nếu thoát ra ngoài bằng `..`, đường
 * tuyệt đối, ổ đĩa, ADS (`a.mp4:x`), UNC… — chặn ở dạng chuỗi rồi chặn lại sau
 * khi resolve, đề phòng cách viết nào đó lọt bước đầu.
 */
function duongTrongDeck(deckDir, rel, goc = [THU_MUC]) {
  if (typeof rel !== 'string' || !rel || rel.length > 400) return null;
  if (/[\0:\\]/.test(rel) || rel.startsWith('/')) return null;
  const phan = rel.split('/');
  if (phan.some((x) => x === '' || x === '.' || x === '..')) return null;
  if (!goc.includes(phan[0])) return null;
  const goc0 = path.resolve(deckDir);
  const f = path.resolve(goc0, ...phan);
  return f.startsWith(goc0 + path.sep) ? f : null;
}

/**
 * Tệp đã có thật có NẰM THẬT trong deck không — giải cả liên kết tượng trưng /
 * junction (Windows). `duongTrongDeck` chỉ xét chuỗi; một junction đặt trong
 * `dung/` trỏ ra ngoài thì chuỗi vẫn hợp lệ mà đích thì không.
 */
function nhanThatTrongDeck(deckDir, f) {
  try {
    const goc = fs.realpathSync.native(deckDir);
    const that = fs.realpathSync.native(f);
    return that.startsWith(goc + path.sep);
  } catch { return false; }
}

const doc1 = (t) => { try { return JSON.parse(fs.readFileSync(t, 'utf8')); } catch { return undefined; } };

/** Ngữ cảnh nâng cấp v1 → v2 (moHinh.nangCap): dự án video trống? + mốc slide hiện tại (có dấu slide). */
function nguCanhNangCap(deckDir) {
  let mocGoc = [];
  try { mocGoc = moHinh.mocTuTiming(JSON.parse(fs.readFileSync(path.join(deckDir, 'output', 'timing.json'), 'utf8'))); } catch { mocGoc = []; }
  return { laVideo: require('./duAnVideo').laDuAnVideo(deckDir), mocGoc };
}

/**
 * Đọc dự án.
 * @returns {{ duAn: object|null, nguon: string|null, loiDoc?: string[],
 *   chiDoc?: boolean, daCatHong?: string }}
 *   `chiDoc`: tệp do bản app MỚI HƠN ghi — giao diện phải khoá sửa, kho cũng chặn ghi.
 *   `daCatHong`: tên tệp đã cất bản hỏng (báo cho người dùng biết bản đó vẫn còn).
 */
function docDuAn(deckDir) {
  const f = tepDuAn(deckDir);
  const cacTep = [f, ...Array.from({ length: SO_BAK }, (_, i) => `${f}.bak-${i + 1}`)];
  if (!cacTep.some((x) => fs.existsSync(x))) return { duAn: null, nguon: null };

  const chinh = fs.existsSync(f) ? doc1(f) : null;
  if (chinh && typeof chinh.phienBan === 'number' && chinh.phienBan > moHinh.PHIEN_BAN) {
    return {
      duAn: null, nguon: null, chiDoc: true,
      loiDoc: [`Dự án dựng do bản app mới hơn tạo (phiên bản ${chinh.phienBan}). Cập nhật app để mở — app này không ghi đè.`],
    };
  }
  const loiDoc = [];
  let daCatHong;
  let ngu = null;   // tính một lần, chỉ khi gặp tệp v1
  for (const t of cacTep) {
    if (!fs.existsSync(t)) continue;
    let j = t === f ? chinh : doc1(t);
    // Tệp v1 (trước GĐ3): nâng lên v2 trong bộ nhớ — ghi xuống đĩa ở lần lưu kế (bản v1 còn trong .bak).
    if (j && j.phienBan === 1) { ngu = ngu || nguCanhNangCap(deckDir); j = moHinh.nangCap(j, ngu); }
    const k = j === undefined ? { ok: false, loi: ['JSON hỏng'] } : moHinh.kiem(j);
    if (k.ok) {
      if (t !== f && fs.existsSync(f) && !daCatHong) daCatHong = catBanHong(f);
      return { duAn: k.duAn, nguon: path.basename(t), loiDoc, daCatHong };
    }
    loiDoc.push(`${path.basename(t)}: ${k.loi.slice(0, 3).join(' · ')}`);
  }
  // Không bản nào đọc được: vẫn cất tệp chính trước khi giao diện (nếu có) bắt đầu lưu bản mới.
  if (fs.existsSync(f)) daCatHong = catBanHong(f);
  return { duAn: null, nguon: null, loiDoc, daCatHong };
}

/** Chép tệp chính đang hỏng sang `du-an.json.hong-<giờ>` — không xoá, không đè. */
function catBanHong(f) {
  // Mở deck nhiều lần trước khi kịp lưu: đã cất đúng nội dung này rồi thì thôi, không đẻ thêm bản.
  try {
    const goc = fs.readFileSync(f);
    const dir = path.dirname(f);
    const daCo = fs.readdirSync(dir).find((x) => x.startsWith(`${TEP}.hong-`) && fs.readFileSync(path.join(dir, x)).equals(goc));
    if (daCo) return daCo;
  } catch { /* đọc không được thì cứ cất */ }
  const gio = new Date().toISOString().replace(/[:.]/g, '-');
  const dich = `${f}.hong-${gio}`;
  try { fs.copyFileSync(f, dich, fs.constants.COPYFILE_EXCL); return path.basename(dich); } catch { return undefined; }
}

/** Ngủ đồng bộ — chỉ dùng cho vài lần thử lại đổi tên (tổng ≤ 0,15 s).
 *  Ngắn có chủ ý: đây là TIẾN TRÌNH CHÍNH — chặn 1,5 s mỗi lần lưu (tệp bị OneDrive / diệt virus
 *  giữ) là hụt khung khi đang quay video (audit 10/10/2026). Lưu hỏng thì giao diện tự thử lại
 *  sau 3 giây (nganLenh), không cần cố ở đây. */
const ngu = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function doiTenThuLai(tu, den) {
  let loiCuoi;
  for (let lan = 0; lan < 4; lan += 1) {
    try { fs.renameSync(tu, den); return; } catch (e) {
      loiCuoi = e;
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      if (lan < 3) ngu(50);
    }
  }
  throw loiCuoi;
}

/**
 * Ghi dự án: KIỂM trước (bản chuẩn hoá mới được ghi), ghi tạm, xoay .bak (thưa),
 * đổi tên có thử lại.
 * @returns {{ ok: boolean, loi?: string[], khongDoi?: boolean, chiDoc?: boolean }}
 */
function ghiDuAn(deckDir, duAn) {
  const k = moHinh.kiem(duAn);
  if (!k.ok) return { ok: false, loi: k.loi };
  const dir = thuMuc(deckDir);
  fs.mkdirSync(dir, { recursive: true });
  const f = tepDuAn(deckDir);
  const cu = fs.existsSync(f) ? doc1(f) : null;
  if (cu && typeof cu.phienBan === 'number' && cu.phienBan > moHinh.PHIEN_BAN) {
    return { ok: false, chiDoc: true, loi: [`Dự án dựng do bản app mới hơn tạo (phiên bản ${cu.phienBan}) — không ghi đè.`] };
  }
  const noiDung = `${JSON.stringify(k.duAn, null, 1)}\n`;
  // Nội dung y hệt bản trên đĩa thì thôi — tự lưu không đẻ ra .bak trùng nhau.
  try { if (fs.readFileSync(f, 'utf8') === noiDung) return { ok: true, khongDoi: true }; } catch { /* chưa có */ }

  const tam = `${f}.tam`;
  const fd = fs.openSync(tam, 'w');
  try {
    fs.writeSync(fd, noiDung);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  /* Xoay .bak SAU khi tệp tạm đã ghi xong, và THƯA: tự lưu chạy mỗi lần ngừng tay,
     xoay mỗi lần thì 5 bản chỉ phủ vài giây thao tác cuối — xoá nhầm một khối là
     bị đẩy khỏi mọi bản lưu ngay. Xoay khi bak-1 đã cũ hơn 5 phút (hoặc chưa có). */
  if (cu) {
    let cuHon = true;
    try { cuHon = Date.now() - fs.statSync(`${f}.bak-1`).mtimeMs > NHIP_BAK_MS; } catch { cuHon = true; }
    if (cuHon) {
      for (let i = SO_BAK; i >= 1; i -= 1) {
        const nguon = i === 1 ? f : `${f}.bak-${i - 1}`;
        if (fs.existsSync(nguon)) {
          try { fs.copyFileSync(nguon, `${f}.bak-${i}`); } catch { /* .bak hỏng không chặn việc lưu */ }
        }
      }
    }
  }
  try {
    doiTenThuLai(tam, f);
  } catch (e) {
    try { fs.unlinkSync(tam); } catch { /* bị khoá nốt thì để lần sau ghi đè */ }
    return { ok: false, loi: [`Không lưu được dự án dựng (${e.code || e.message}) — tệp đang bị chương trình khác giữ.`] };
  }
  return { ok: true };
}

/** Các thư mục cache — xoá được, tự sinh lại (nút Dọn dẹp dùng ở Giai đoạn 1). */
function thuMucCache(deckDir) {
  const c = path.join(thuMuc(deckDir), 'cache');
  return { goc: c, anh: path.join(c, 'anh'), song: path.join(c, 'song'), proxy: path.join(c, 'proxy') };
}

module.exports = {
  THU_MUC, TEP, SO_BAK, NHIP_BAK_MS, thuMuc, tepDuAn, duongTrongDeck, nhanThatTrongDeck, docDuAn, ghiDuAn, thuMucCache,
}