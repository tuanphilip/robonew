;
/**
 * NGĂN LỆNH — hoàn tác / làm lại cho trình dựng (KE-HOACH.md §4.2).
 *
 * Mỗi thao tác là một hàm `(duAn) => duAnMoi` THUẦN (không sửa bản cũ). Ngăn giữ
 * BẢN CHỤP trước mỗi lệnh chứ không giữ lệnh nghịch đảo: dự án dựng chỉ vài chục
 * KB, chụp cả bản thì hoàn tác không bao giờ sai vì quên viết chiều ngược của một
 * thao tác — lỗi kinh điển của kiểu "lệnh + lệnh ngược".
 *
 * Gom nhóm: kéo một khối bắn hàng chục lệnh `diChuyen`; `batDauNhom()` …
 * `ketThucNhom()` biến cả lượt kéo thành MỘT bước hoàn tác.
 *
 * Tự lưu: `luu(duAn)` gọi sau `chamLuu` ms kể từ thay đổi CUỐI (im tay mới lưu).
 * Ghi đĩa an toàn (tạm → đổi tên, xoay .bak) là việc của `src/dung/kho.js`.
 * `luu` có thể trả Promise<{ ok }>: lưu HỎNG (tệp bị khoá…) thì giữ cờ "còn việc
 * dở" và hẹn lưu lại sau `chamLoi` ms — không được coi như đã lưu (audit 10/10/2026).
 *
 * UMD như moHinh.js: chạy ở giao diện (`window.__beeDung.nganLenh`) và bộ thử.
 */
(function (goc, nhaMay) {
  if (typeof module === 'object' && module.exports) module.exports = nhaMay();
  else {
    goc.__beeDung = goc.__beeDung || {};
    goc.__beeDung.nganLenh = nhaMay();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const chup = (x) => JSON.parse(JSON.stringify(x));

  /**
   * @param {object} duAn  trạng thái ban đầu
   * @param {{ sau?: number, luu?: (duAn: object) => void, chamLuu?: number,
   *           kiem?: (duAn: object) => { ok: boolean, loi: string[] },
   *           henGio?: typeof setTimeout, boHen?: typeof clearTimeout }} [o]
   */
  function taoNgan(duAn, o) {
    const cfg = o || {};
    const SAU = cfg.sau || 200;
    const henGio = cfg.henGio || setTimeout;
    const boHen = cfg.boHen || clearTimeout;
    let hienTai = chup(duAn);
    const lui = [];    // bản chụp TRƯỚC mỗi bước
    const toi = [];    // bản chụp để làm lại
    let nhom = null;   // bản chụp lúc mở nhóm
    let doSau = 0;     // nhóm LỒNG (vd công cụ AI gọi themChu — tự mở nhóm bên trong): chỉ nhóm NGOÀI cùng tính
    let hen = null;
    let banLuu = 0;    // số lần đổi chưa lưu — để biết còn việc dở
    let loiLuu = null; // câu lỗi của lần lưu hỏng gần nhất (giao diện hiện cho người dùng)
    let daDung = false; // đã `dung()` (chuyển deck): không hẹn lưu lại, không báo ai nữa
    const nguoiNghe = new Set();

    const bao = (ly) => { if (!daDung) nguoiNghe.forEach((f) => { try { f(hienTai, ly); } catch { /* bỏ */ } }); };

    function henLuu() {
      if (!cfg.luu) return;
      banLuu += 1;
      if (hen) boHen(hen);
      hen = henGio(() => { hen = null; luuNgay(); }, cfg.chamLuu == null ? 800 : cfg.chamLuu);
    }
    function luuNgay(laCuoi) {
      if (daDung && laCuoi !== true) return undefined;   // đã thôi dùng: hẹn giờ cũ còn sót cũng không lưu
      if (!cfg.luu || !banLuu) return undefined;
      if (hen) { boHen(hen); hen = null; }
      const soCho = banLuu;
      banLuu = 0;
      const hong = (loi) => {
        loiLuu = loi || 'Không lưu được.';
        // Có thay đổi mới trong lúc chờ thì lượt hẹn của nó lo; không thì tự hẹn lưu lại.
        banLuu += soCho;
        if (daDung) return;
        if (!hen) hen = henGio(() => { hen = null; luuNgay(); }, cfg.chamLoi == null ? 3000 : cfg.chamLoi);
        bao('loiLuu');
      };
      let kq;
      try { kq = cfg.luu(chup(hienTai)); } catch (e) { hong(e && e.message); return undefined; }
      if (kq && typeof kq.then === 'function') {
        return kq.then((r) => {
          if (r && r.ok === false) hong((r.loi || []).join(' · '));
          else if (loiLuu) { loiLuu = null; bao('daLuu'); }
          return r;
        }, (e) => { hong(e && e.message); });
      }
      if (kq && kq.ok === false) hong((kq.loi || []).join(' · '));
      else if (loiLuu) { loiLuu = null; bao('daLuu'); }
      return kq;
    }

    /**
     * Áp một thao tác. Kết quả không qua `kiem` thì BỎ, trả lỗi — trạng thái không đổi.
     * @param {(d: object) => object} f
     * @param {string} [ten] tên bước (hiện ở menu Hoàn tác)
     * @returns {{ ok: boolean, loi?: string[] }}
     */
    function lam(f, ten) {
      const moi = f(chup(hienTai));
      if (!moi) return { ok: false, loi: ['Thao tác không trả về dự án.'] };
      /* Không đổi gì (vd sửa bị từ chối vì va chạm) thì KHÔNG thành bước hoàn tác, không
         xoá nhánh làm lại, không hẹn lưu (audit 10/10/2026). */
      if (moi === hienTai || JSON.stringify(moi) === JSON.stringify(hienTai)) return { ok: true, khongDoi: true };
      if (cfg.kiem) {
        const k = cfg.kiem(moi);
        if (!k.ok) return { ok: false, loi: k.loi };
      }
      if (!nhom) {
        lui.push({ duAn: hienTai, ten: ten || '' });
        if (lui.length > SAU) lui.shift();
      }
      toi.length = 0;
      hienTai = moi;
      henLuu();
      bao(ten || 'lam');
      return { ok: true };
    }

    function batDauNhom(ten) {
      if (nhom) { doSau += 1; return; }
      nhom = { duAn: hienTai, ten: ten || '' };
    }
    function ketThucNhom() {
      if (!nhom) return;
      if (doSau > 0) { doSau -= 1; return; }
      // Nhóm không đổi gì (bấm rồi nhả tại chỗ) thì không thành một bước.
      if (JSON.stringify(nhom.duAn) !== JSON.stringify(hienTai)) {
        lui.push(nhom);
        if (lui.length > SAU) lui.shift();
      }
      nhom = null;
    }

    /* Đang KÉO (nhóm mở) thì bỏ qua hoàn tác / làm lại — như Premiere. Đóng nhóm
       giữa chừng thì các lượt kéo còn lại thành từng bước lẻ (audit 10/10/2026). */
    function hoanTac() {
      if (nhom) return false;
      const b = lui.pop();
      if (!b) return false;
      toi.push({ duAn: hienTai, ten: b.ten });
      hienTai = b.duAn;
      henLuu();
      bao('hoanTac');
      return true;
    }
    function lamLai() {
      if (nhom) return false;
      const b = toi.pop();
      if (!b) return false;
      lui.push({ duAn: hienTai, ten: b.ten });
      hienTai = b.duAn;
      henLuu();
      bao('lamLai');
      return true;
    }

    return {
      lay: () => chup(hienTai),
      lam, batDauNhom, ketThucNhom, hoanTac, lamLai, luuNgay,
      coHoanTac: () => lui.length > 0 || !!nhom,
      coLamLai: () => toi.length > 0,
      tenHoanTac: () => (lui.length ? lui[lui.length - 1].ten : ''),
      conViecDo: () => banLuu > 0,
      loiLuu: () => loiLuu,
      nghe: (f) => { nguoiNghe.add(f); return () => nguoiNghe.delete(f); },
      /**
       * Thôi dùng ngăn này (chuyển sang deck khác): lưu NỐT một lần rồi tắt hẳn — không hẹn
       * lưu lại, không báo người nghe. Không tắt thì lượt "lưu lại sau 3 giây" của deck cũ
       * chạy mãi và đè dự án của deck mới lên giao diện (audit 10/10/2026).
       * @returns kết quả lần lưu cuối (có thể là Promise) — bên gọi báo lỗi nếu hỏng.
       */
      dung: () => {
        daDung = true;                       // TRƯỚC lần lưu cuối: hỏng thì `hong` không hẹn lưu lại
        if (hen) { boHen(hen); hen = null; }
        const kq = luuNgay(true);
        nguoiNghe.clear();
        return kq;
      },
      /** Nạp lại từ đĩa (deck đổi / người khác sửa tệp): xoá lịch sử — lịch sử cũ không còn đúng. */
      datLai: (d) => {
        // Còn thay đổi chưa lưu (vd đang chuyển deck) thì lưu NỐT trước khi bỏ lịch sử.
        luuNgay();
        hienTai = chup(d); lui.length = 0; toi.length = 0; nhom = null; doSau = 0; banLuu = 0; loiLuu = null;
        if (hen) { boHen(hen); hen = null; }
        bao('datLai');
      },
    };
  }

  return { taoNgan };
}))