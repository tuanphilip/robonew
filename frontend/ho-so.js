'use strict';
/**
 * Hồ sơ người mua DÙNG CHUNG ở Bee Account — tab "Thông tin" (cá nhân) và "Doanh nghiệp" (xuất hoá đơn) của bảng
 * tài khoản (login.js). 28/09/2026.
 *
 * Cùng mẫu + cùng luật form Bee Platform: khai ở Platform / Bee Project / Studio thì nơi khác thấy ngay. Máy chủ
 * tài khoản Studio (`/v1/profile*`) gọi Bee Account; ở đây chỉ vẽ form, kiểm sơ bộ để báo lỗi tại chỗ.
 *
 * Hai chế độ như Platform: XEM (ô mờ, không sửa được, một nút "Sửa thông tin" rộng hết khung) và SỬA (Hủy / Lưu).
 * Đã xác minh / đã duyệt ⇒ khoá, không có nút sửa (liên hệ hỗ trợ).
 *
 * Bộ tỉnh/phường (`data/vietnam-address.js`, ~120 KB) nạp LƯỜI lần đầu mở — không làm chậm lúc khởi động.
 */
(() => {
  const api = window.beeknoee;
  if (!api || !api.profile) return;

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const PHONE_RE = /^[0-9]{10,11}$/;
  const ID_RE = /^[0-9]{12}$/;
  const MST_RE = /^([0-9]{10}(-[0-9]{3})?|[0-9]{12})$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Văn bản gốc của Chính phủ — cùng link Bee Platform dùng. Mở bằng TRÌNH DUYỆT HỆ THỐNG (openExternal), không mở
  // trong cửa sổ app.
  const ND70 = 'https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/3/70-nd-cp.signed.pdf';

  let hs = null;          // { linked, personal, invoice } — null = chưa tải xong
  let loiTai = null;      // câu lỗi khi tải hồ sơ
  let oCN = null;         // khung tab Thông tin
  let oHD = null;         // khung tab Doanh nghiệp
  let suaCN = false;
  let suaHD = false;
  let tbCN = null;        // { tone: 'tot' | 'xau', chu }
  let tbHD = null;
  let lanMo = 0;          // chống kết quả tải của lần mở TRƯỚC ghi đè lần mở sau

  // ───────────── bộ tỉnh/phường (nạp lười) ─────────────
  let napDiaChiP = null;
  function napDiaChi() {
    if (window.__VN_DIA_CHI__) return Promise.resolve(window.__VN_DIA_CHI__);
    if (!napDiaChiP) {
      napDiaChiP = new Promise((ok, hong) => {
        const s = document.createElement('script');
        s.src = 'data/vietnam-address.js';
        s.onload = () => (window.__VN_DIA_CHI__ ? ok(window.__VN_DIA_CHI__) : hong(new Error('thiếu dữ liệu')));
        s.onerror = () => { napDiaChiP = null; hong(new Error('không nạp được danh sách tỉnh/phường')); };
        document.head.appendChild(s);
      });
    }
    return napDiaChiP;
  }
  const dsTinh = () => (window.__VN_DIA_CHI__ && window.__VN_DIA_CHI__.cities) || [];
  const dsPhuong = (cityId) => (dsTinh().find((c) => c.id === Number(cityId)) || {}).districts || [];

  // ───────────── tải ─────────────
  async function tai() {
    const lan = lanMo;
    loiTai = null;
    const [r] = await Promise.all([
      api.profile.get().catch((e) => ({ ok: false, message: e && e.message })),
      napDiaChi().catch(() => null),
    ]);
    if (lan !== lanMo) return;
    if (r && r.ok) hs = r.data;
    else { hs = null; loiTai = (r && r.message) || 'Không tải được hồ sơ.'; }
    ve();
  }

  function ve() {
    if (oCN) veCaNhan();
    if (oHD) veHoaDon();
  }

  const icon = (o) => { if (window.__beeIcons) window.__beeIcons.apply(o); };

  /** Khung chung khi CHƯA có form: đang tải / lỗi (kèm Thử lại) / chưa nối Bee Account. */
  function veTrangThai(o) {
    if (!hs && !loiTai) {
      o.innerHTML = '<div class="hs-cho">Đang tải hồ sơ…</div>';
      return true;
    }
    if (loiTai) {
      o.innerHTML = `<div class="hs-tb xau">${esc(loiTai)}</div>
        <button type="button" class="ghost hs-thu-lai">Thử lại</button>`;
      o.querySelector('.hs-thu-lai').onclick = () => { hs = null; loiTai = null; ve(); tai(); };
      return true;
    }
    if (!hs.linked) {
      o.innerHTML = '<div class="hs-tb">Tài khoản chưa nối Bee Account — hãy đăng xuất rồi đăng nhập lại để dùng hồ sơ chung.</div>';
      return true;
    }
    return false;
  }

  const o = (ten, nhan, giaTri, { batBuoc = false, kieu = 'text', max = 300, goiY = '', them = '' } = {}) => `
    <label class="hs-o">
      <span class="hs-nhan">${esc(nhan)}${batBuoc ? '<b>*</b>' : ''}</span>
      <input name="${ten}" type="${kieu}" value="${esc(giaTri)}" maxlength="${max}" placeholder="${esc(goiY)}" ${them} />
    </label>`;

  const tb = (t) => (t ? `<div class="hs-tb ${t.tone || ''}">${esc(t.chu)}</div>` : '');

  const nutXem = (id, chu) => `
    <button type="button" class="primary hs-nut-sua" data-hs="${id}">
      <span class="btn-icon" data-icon="butchi" aria-hidden></span><span>${esc(chu)}</span>
    </button>`;
  const nutSua = (huy, luu) => `
    <div class="hs-nut-doi">
      <button type="button" class="ghost" data-hs="${huy}">Hủy</button>
      <button type="button" class="primary" data-hs="${luu}">Lưu thay đổi</button>
    </div>`;

  // ───────────── tab Thông tin (cá nhân) ─────────────
  function veCaNhan() {
    if (veTrangThai(oCN)) return;
    const p = hs.personal || {};
    const daXacMinh = (p.verificationStatus || 0) >= 1;
    const sua = suaCN && !daXacMinh;
    const tinh = p.cityId != null ? String(p.cityId) : '';
    const phuong = p.districtId != null ? String(p.districtId) : '';
    const tat = sua ? '' : 'disabled';
    oCN.innerHTML = `
      <div class="hs-form ${sua ? '' : 'xem'}">
        ${daXacMinh ? '<div class="hs-khoa"><span class="btn-icon" data-icon="khien" aria-hidden></span><span>Thông tin cá nhân đã được xác minh — liên hệ hỗ trợ để thay đổi.</span></div>' : ''}
        ${o('fullName', 'Họ và tên', p.fullName, { batBuoc: true, max: 100, goiY: 'Nguyễn Văn A', them: tat })}
        ${o('phone', 'Số điện thoại', p.phone, { batBuoc: true, kieu: 'tel', max: 11, goiY: '0912345678', them: tat })}
        <div class="hs-hai">
          <label class="hs-o">
            <span class="hs-nhan">Tỉnh/Thành phố<b>*</b></span>
            <select name="cityId" ${tat}>
              <option value="">Chọn tỉnh/thành phố</option>
              ${dsTinh().map((c) => `<option value="${c.id}" ${String(c.id) === tinh ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>
          </label>
          <label class="hs-o">
            <span class="hs-nhan">Phường/Xã<b>*</b></span>
            <select name="districtId" ${tat}></select>
          </label>
        </div>
        ${o('streetAddress', 'Số nhà, tên đường', p.streetAddress, { batBuoc: true, goiY: 'Số nhà, tên đường', them: tat })}
        ${o('idNumber', 'Số CCCD', p.idNumber, { batBuoc: true, max: 12, goiY: '12 chữ số', them: `inputmode="numeric" ${tat}` })}
        <p class="hs-phaply">Theo <a class="hs-link" href="${ND70}" data-ngoai>Nghị định 70/2025/NĐ-CP</a> (hiệu lực từ 01/06/2025), doanh nghiệp bán hàng online phải xuất hoá đơn điện tử. Beeknoee cam kết bảo mật và chỉ sử dụng thông tin của bạn cho mục đích lập hoá đơn theo quy định.</p>
        ${tb(tbCN)}
        ${daXacMinh ? '' : (sua ? nutSua('huy-cn', 'luu-cn') : nutXem('sua-cn', 'Sửa thông tin'))}
      </div>`;
    const selTinh = oCN.querySelector('select[name=cityId]');
    const selPhuong = oCN.querySelector('select[name=districtId]');
    const dienPhuong = (chon) => {
      const ds = dsPhuong(selTinh.value);
      selPhuong.innerHTML = `<option value="">${selTinh.value ? 'Chọn phường/xã' : 'Chọn tỉnh trước'}</option>`
        + ds.map((w) => `<option value="${w.id}" ${String(w.id) === chon ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
      if (sua) selPhuong.disabled = !selTinh.value;
    };
    dienPhuong(phuong);
    selTinh.onchange = () => dienPhuong('');
    oCN.querySelectorAll('a[data-ngoai]').forEach((a) => {
      a.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (api.openExternal) api.openExternal(a.href);
      };
    });
    gan(oCN, {
      'sua-cn': () => { suaCN = true; tbCN = null; veCaNhan(); },
      'huy-cn': () => { suaCN = false; tbCN = null; veCaNhan(); },
      'luu-cn': luuCaNhan,
    });
    icon(oCN);
  }

  async function luuCaNhan(nut) {
    const f = oCN.querySelector('.hs-form');
    const v = (n) => (f.querySelector(`[name=${n}]`).value || '').trim();
    const d = {
      fullName: v('fullName'), phone: v('phone'), idNumber: v('idNumber'),
      cityId: Number(v('cityId')) || 0, districtId: Number(v('districtId')) || 0, streetAddress: v('streetAddress'),
    };
    let loi = null;
    if (!d.fullName || !d.phone || !d.idNumber || !d.cityId || !d.districtId || !d.streetAddress) loi = 'Vui lòng điền đủ các ô có dấu * (họ tên, số điện thoại, tỉnh, phường, số nhà, CCCD).';
    else if (!PHONE_RE.test(d.phone)) loi = 'Số điện thoại phải có 10-11 chữ số.';
    else if (!ID_RE.test(d.idNumber)) loi = 'Số CCCD phải đúng 12 chữ số.';
    if (loi) { baoLoi(f, loi); return; }
    nut.disabled = true;
    const r = await api.profile.savePersonal(d).catch((e) => ({ ok: false, message: e && e.message }));
    if (!oCN) return;
    if (r && r.ok) {
      hs = r.data; suaCN = false; tbCN = { tone: 'tot', chu: 'Đã lưu thông tin cá nhân.' };
      ve();
      baoDoi();
    } else {
      nut.disabled = false;
      baoLoi(f, (r && r.message) || 'Không lưu được thông tin cá nhân.');
    }
  }

  // ───────────── tab Doanh nghiệp (xuất hoá đơn) ─────────────
  function veHoaDon() {
    if (veTrangThai(oHD)) return;
    const i = hs.invoice || {};
    const daDuyet = (i.verificationStatus || 0) >= 1;
    const sua = suaHD && !daDuyet;
    const tat = sua ? '' : 'disabled';
    oHD.innerHTML = `
      <div class="hs-form ${sua ? '' : 'xem'}">
        ${daDuyet ? '<div class="hs-khoa"><span class="btn-icon" data-icon="khien" aria-hidden></span><span>Thông tin doanh nghiệp đã được duyệt — liên hệ hỗ trợ để thay đổi.</span></div>' : ''}
        ${o('companyName', 'Tên doanh nghiệp', i.companyName, { batBuoc: true, max: 200, goiY: 'Công ty TNHH ABC', them: tat })}
        ${o('taxCode', 'Mã số thuế (MST)', i.taxCode, { batBuoc: true, max: 14, goiY: '0123456789 (DN) · 030089009888 (HKD) · 0123456789-001', them: tat })}
        ${o('companyAddress', 'Địa chỉ doanh nghiệp', i.companyAddress, { batBuoc: true, goiY: 'Số 1, Đường XYZ, Quận 1, TP.HCM', them: tat })}
        <div class="hs-hai">
          ${o('companyPhone', 'SĐT doanh nghiệp', i.companyPhone, { kieu: 'tel', max: 11, goiY: '02812345678', them: tat })}
          ${o('invoiceEmail', 'Email nhận HĐ', i.invoiceEmail, { kieu: 'email', max: 200, goiY: 'ketoan@abc.vn', them: tat })}
        </div>
        ${o('representative', 'Người mua hàng / đại diện', i.representative, { max: 100, goiY: 'Nguyễn Văn B', them: tat })}
        <label class="hs-tick">
          <input type="checkbox" name="laDoanhNghiep" ${i.invoiceType === 'BUSINESS' ? 'checked' : ''} ${tat} />
          <span>Xuất hoá đơn theo thông tin doanh nghiệp</span>
        </label>
        <p class="hs-goiy">Nếu không có thông tin doanh nghiệp, Beeknoee sẽ mặc định xuất hoá đơn theo thông tin cá nhân của bạn. (Nếu bạn là cá nhân chỉ cần điền thông tin cá nhân.)</p>
        ${tb(tbHD)}
        ${daDuyet ? '' : (sua ? nutSua('huy-hd', 'luu-hd') : nutXem('sua-hd', 'Sửa thông tin doanh nghiệp'))}
      </div>`;
    gan(oHD, {
      'sua-hd': () => { suaHD = true; tbHD = null; veHoaDon(); },
      'huy-hd': () => { suaHD = false; tbHD = null; veHoaDon(); },
      'luu-hd': luuHoaDon,
    });
    icon(oHD);
  }

  async function luuHoaDon(nut) {
    const f = oHD.querySelector('.hs-form');
    const v = (n) => (f.querySelector(`[name=${n}]`).value || '').trim();
    const dn = f.querySelector('[name=laDoanhNghiep]').checked;
    const d = { invoiceType: dn ? 'BUSINESS' : 'PERSONAL' };
    for (const k of ['companyName', 'taxCode', 'companyAddress', 'companyPhone', 'invoiceEmail', 'representative']) {
      if (v(k)) d[k] = v(k);
    }
    let loi = null;
    if (dn && !d.companyName) loi = 'Vui lòng nhập tên doanh nghiệp.';
    else if (dn && !d.taxCode) loi = 'Vui lòng nhập mã số thuế.';
    else if (dn && !d.companyAddress) loi = 'Vui lòng nhập địa chỉ doanh nghiệp.';
    // Có điền MST là phải đúng dạng, kể cả chưa tick — dữ liệu công ty vẫn được LƯU dù chưa tick.
    else if (d.taxCode && !MST_RE.test(d.taxCode)) loi = 'Mã số thuế phải 10 số (doanh nghiệp), 12 số (hộ kinh doanh) hoặc dạng 0123456789-001 (chi nhánh).';
    else if (d.companyPhone && !PHONE_RE.test(d.companyPhone)) loi = 'SĐT doanh nghiệp phải có 10-11 chữ số.';
    else if (d.invoiceEmail && !EMAIL_RE.test(d.invoiceEmail)) loi = 'Email nhận hoá đơn không hợp lệ.';
    if (loi) { baoLoi(f, loi); return; }
    nut.disabled = true;
    const r = await api.profile.saveInvoice(d).catch((e) => ({ ok: false, message: e && e.message }));
    if (!oHD) return;
    if (r && r.ok) {
      hs = r.data; suaHD = false; tbHD = { tone: 'tot', chu: 'Đã lưu thông tin doanh nghiệp.' };
      ve();
      baoDoi();
    } else {
      nut.disabled = false;
      baoLoi(f, (r && r.message) || 'Không lưu được thông tin doanh nghiệp.');
    }
  }

  /** Báo cho màn khác (trang thanh toán đang mở) biết hồ sơ vừa đổi — nó vẽ lại với dữ liệu mới. */
  function baoDoi() {
    try { window.dispatchEvent(new CustomEvent('bee-ho-so-doi', { detail: hs })); } catch { /* không có ai nghe thì thôi */ }
  }

  // ───────────── tiện ích ─────────────
  /** Gắn hành động cho các nút `data-hs` trong khung. Truyền chính nút vào để khoá lúc đang lưu. */
  function gan(khung, bang) {
    khung.querySelectorAll('[data-hs]').forEach((b) => {
      const fn = bang[b.dataset.hs];
      if (fn) b.onclick = (e) => { e.stopPropagation(); fn(b); };
    });
  }

  /** Báo lỗi ngay trên hàng nút, KHÔNG vẽ lại form (giữ nguyên chữ người dùng đang gõ). */
  function baoLoi(f, chu) {
    let x = f.querySelector('.hs-tb');
    if (!x) {
      x = document.createElement('div');
      const nut = f.querySelector('.hs-nut-doi, .hs-nut-sua');
      f.insertBefore(x, nut);
    }
    x.className = 'hs-tb xau';
    x.textContent = chu;
  }

  /** Tên tỉnh + phường theo mã (form thanh toán chỉ có ô CHỮ cho tỉnh/phường). Cần `napDiaChi()` xong trước. */
  function tenDiaChi(cityId, districtId) {
    const c = dsTinh().find((x) => x.id === Number(cityId));
    const w = c && c.districts.find((x) => x.id === Number(districtId));
    return { tinh: c ? c.name : '', phuong: w ? w.name : '' };
  }

  window.__beeHoSo = {
    napDiaChi,
    tenDiaChi,
    /** Bảng tài khoản vừa vẽ: nhận hai khung rồi tải hồ sơ mới nhất (người dùng có thể vừa sửa ở Platform). */
    mo(khungCaNhan, khungHoaDon) {
      lanMo += 1;
      oCN = khungCaNhan || null;
      oHD = khungHoaDon || null;
      suaCN = false; suaHD = false; tbCN = null; tbHD = null;
      hs = null; loiTai = null;
      ve();
      tai();
    },
    /** Đổi tab / đóng bảng: bỏ chế độ sửa đang dở. */
    thoiSua() {
      if (!suaCN && !suaHD) return;
      suaCN = false; suaHD = false; tbCN = null; tbHD = null;
      ve();
    },
    dong() {
      lanMo += 1;
      oCN = null; oHD = null;
    },
  };
})();
