;
'use strict';
/**
 * DỌN DẸP phần của trình dựng — nối vào nút "Dọn dẹp" (ipc/projects.js `cleanup:*`).
 *
 *   nhóm `dungCache`  — dung/cache/** (ảnh thu nhỏ, sóng âm, proxy 720p) + tệp chép /
 *                       ghi DỞ (`*.tam*`) bỏ lại khi tắt app giữa chừng. Tự sinh lại.
 *   nhóm `dungThua`   — media trong dung/media/ KHÔNG còn được dự án dùng — đối chiếu
 *                       cả `du-an.json` lẫn MỌI bản `.bak` / `.hong-*` (hoàn tác hay
 *                       khôi phục bản lưu vẫn cần nó). Chuyển vào Thùng rác, không xoá hẳn.
 *
 * ⚠ GIỮ hai lớp tiếng tách sẵn (`voiceover_concat_render.mp3`, `slide_audio.webm`)
 * ở deck CÓ dự án dựng: nhóm "Tệp dựng dở" coi chúng là rác dựng lại được, nhưng
 * trình dựng cần chúng để chỉnh RIÊNG âm lượng giọng / nhạc deck. Xoá đi là bản
 * xuất lặng lẽ rơi về tiếng đã trộn (audit 10/10/2026).
 */
const fs = require('node:fs');
const path = require('node:path');
const kho = require('./kho');

const TIENG_TACH = new Set(['voiceover_concat_render.mp3', 'slide_audio.webm']);

const coDuAn = (deckDir) => {
  const f = kho.tepDuAn(deckDir);
  return fs.existsSync(f) || fs.existsSync(`${f}.bak-1`);
};

/** Tệp `ten` trong `<deck>/<thuMuc>` có phải tiếng tách cần GIỮ cho trình dựng không. */
function giuChoTrinhDung(deckDir, ten, thuMuc) {
  if (thuMuc !== 'output' || !coDuAn(deckDir)) return false;
  if (TIENG_TACH.has(ten)) return true;
  /* Tệp giọng THẬT đi cùng video (xuat.tepGiongKhop) có thể là voiceover_concat.mp3 — lượt
     không cần đệm khoảng lặng thì bước ghép dùng thẳng tệp đó (audit 10/10/2026). */
  try {
    const g = require('./xuat').tepGiongKhop(deckDir);
    return !!(g && g.file && path.basename(g.file) === ten);
  } catch { return false; }
}

/** Mọi tệp media mà dự án (hoặc một bản lưu của nó) còn trỏ tới — tên tệp trong dung/media. */
function mediaConDung(deckDir) {
  const dir = kho.thuMuc(deckDir);
  const ds = new Set();
  let ten = [];
  try { ten = fs.readdirSync(dir).filter((x) => x === kho.TEP || x.startsWith(`${kho.TEP}.`)); } catch { return ds; }
  for (const t of ten) {
    if (t.endsWith('.tam')) continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, t), 'utf8'));
      (Array.isArray(j.media) ? j.media : []).forEach((m) => {
        if (m && typeof m.tep === 'string' && m.tep.startsWith('dung/media/')) ds.add(m.tep.slice('dung/media/'.length));
      });
    } catch {
      // Một bản lưu HỎNG không đọc được: không biết nó trỏ tới gì ⇒ coi như mọi media còn dùng.
      ds.add('*');
    }
  }
  return ds;
}

/**
 * Quét `dung/` của một deck.
 * @returns {{ cache: Array<{f:string,byte:number}>, thua: Array<{f:string,byte:number}>, tongByte: number }}
 */
function quetDung(deckDir) {
  const ra = { cache: [], thua: [], tongByte: 0 };
  const goc = kho.thuMuc(deckDir);
  if (!fs.existsSync(goc)) return ra;
  const them = (mang, f) => {
    try {
      const st = fs.lstatSync(f);
      if (!st.isFile()) return;
      mang.push({ f, byte: st.size });
    } catch { /* vừa bị xoá */ }
  };
  // Cache: đi hết cây dung/cache (không theo liên kết).
  const di = (d) => {
    let ds;
    try { ds = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ds) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) di(p);
      else if (e.isFile()) them(ra.cache, p);
    }
  };
  di(path.join(goc, 'cache'));
  // Tệp ghi dở ở gốc dung/ (du-an.json.tam).
  try {
    fs.readdirSync(goc).filter((x) => /\.tam$/.test(x)).forEach((x) => them(ra.cache, path.join(goc, x)));
  } catch { /* bỏ */ }
  // Media: chép dở (.tam-*) → cache-rác; không còn ai dùng → thừa.
  const conDung = mediaConDung(deckDir);
  let media = [];
  try { media = fs.readdirSync(path.join(goc, 'media'), { withFileTypes: true }); } catch { media = []; }
  for (const e of media) {
    if (!e.isFile()) continue;
    const p = path.join(goc, 'media', e.name);
    if (/\.tam-/.test(e.name)) them(ra.cache, p);
    else if (!conDung.has('*') && !conDung.has(e.name)) {
      /* Ảnh CHỮ TIÊU ĐỀ: mỗi lần sửa chữ là một tệp mới, bản cũ chỉ còn ngăn hoàn tác (trong bộ
         nhớ app) trỏ tới — chưa vào du-an.json/.bak. Chưa đủ 12 giờ thì giữ, kẻo Ctrl+Z trỏ
         vào tệp đã vứt (audit GĐ2). */
      let moi = false;
      // Bản chép video BỘ SLIDE PHỤ (GĐ3.7, boslide-…) cũng vậy: dựng lại là tệp mới, Ctrl+Z còn trỏ bản cũ (audit 3.7).
      try { moi = /^(chu|boslide)-/.test(e.name) && Date.now() - fs.statSync(p).mtimeMs < 12 * 3600 * 1000; } catch { /* bỏ */ }
      if (!moi) them(ra.thua, p);
    }
  }
  /* Tệp tạm của lượt xuất bản dựng (output/<deck>-dung.tam.mp4 / .loc.txt) và của bước chồng phụ
     đề trong "Tạo video" (<deck>.pd-tam.mp4) sót lại khi app bị
     tắt ngang. Chỉ nhận tệp cũ hơn 30 phút — lượt xuất ĐANG chạy đang ghi đúng các tệp này. */
  try {
    const out = path.join(deckDir, 'output');
    /* Dự án VIDEO TRỐNG (duAnVideo.js) còn: bản xuất `<tên>.tam.mp4` / `<tên>.loc.txt` (xuất thẳng ra
       `<tên>.mp4`, không có đuôi -dung), nền đang dựng `_nen.tam-<pid>.mp4`, mốc `timing.tam-<pid>.json`. */
    const laVideo = fs.existsSync(path.join(deckDir, 'du-an-video.json'));
    const tenTho = laVideo ? require('../render/tenVideo').tenVideo(path.basename(deckDir)).replace(/\.mp4$/i, '') : null;
    /* + nền đen GIẢ của bản trước GĐ3.4 (`_nen.mp4`, hồ sơ của nó, `timing.json` một "slide") — không còn dùng. */
    const laTamVideo = (x) => laVideo && (x === `${tenTho}.tam.mp4` || x === `${tenTho}.loc.txt`
      || /^_nen\.tam-\d+\.mp4$/.test(x) || /^timing\.tam-\d+\.json$/.test(x)
      || x === '_nen.mp4' || x === '_nen.info.json' || x === 'timing.json');
    fs.readdirSync(out).filter((x) => /-dung\.(tam\.mp4|loc\.txt)$|\.pd-tam\.mp4$/.test(x) || laTamVideo(x)).forEach((x) => {
      const p = path.join(out, x);
      try { if (Date.now() - fs.statSync(p).mtimeMs > 30 * 60 * 1000) them(ra.cache, p); } catch { /* bỏ */ }
    });
  } catch { /* chưa có output/ */ }
  ra.tongByte = [...ra.cache, ...ra.thua].reduce((a, x) => a + x.byte, 0);
  return ra;
}

module.exports = { TIENG_TACH, giuChoTrinhDung, mediaConDung, quetDung }