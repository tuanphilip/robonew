'use strict';
/**
 * Màn thanh toán chuyển khoản QR.
 *
 * VÌ SAO CHỌN CHUYỂN KHOẢN QR, KHÔNG PHẢI CỔNG THẺ:
 * cổng thẻ (Stripe/Paddle) cần pháp nhân, hợp đồng, và một máy chủ nhận webhook
 * — chưa có cái nào. Chuyển khoản qua VietQR thì chỉ cần số tài khoản: người
 * dùng quét, chuyển, mình đối soát. Đủ để bán được ngay, đổi sang cổng thẻ sau
 * mà không phải làm lại giao diện này.
 *
 * ⚠ ĐỐI SOÁT ĐANG THỦ CÔNG. Nút "Đã thanh toán" chỉ GHI NHẬN yêu cầu, không tự
 * nâng gói — không có gì nối tới ngân hàng để biết tiền đã về. Cố ý không tự
 * nâng: tự nâng khi chưa xác nhận là ai bấm cũng lên gói Plus.
 */
(() => {
  const api = window.beeknoee;

  const tien = (n) => Number(Math.round(n)).toLocaleString('vi-VN');
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  let el = null;
  let cfg = null;
  let chuKyId = '1m';
  /** Bảng giá THẬT do máy chủ trả về; null khi chưa đăng nhập / mất mạng. */
  let giaMayChu = null;
  // Hoá đơn đã lưu ở hồ sơ người dùng — đổ sẵn để lần sau khỏi gõ lại.
  let hoaDonLuu = null;

  function style() {
    if (document.getElementById('bee-checkout-style')) return;
    // CSS của module này nằm ở css/checkout.css (tách 02/09/2026, nạp bằng <link> trong index.html).
  }

  /**
   * Giá hiển thị. Đã gồm VAT.
   *
   * ⚠ Ưu tiên con số của MÁY CHỦ. Phép tính ở đây chỉ là đường lùi cho lúc chưa
   * đăng nhập hoặc mất mạng — và dù có lệch thì tiền thật vẫn là tiền máy chủ
   * ghi vào đơn, vì mã QR lấy số từ chính đơn đó.
   */
  function tinh(id) {
    /* `id` để hỏi giá của MỘT chu kỳ bất kỳ mà không đụng vào lựa chọn đang
       có — bốn thẻ chu kỳ ở đầu trang phải in được giá của cả bốn. Bỏ trống
       thì tính cho chu kỳ đang chọn, đúng như trước. */
    const key = id || chuKyId;
    const g = cfg.goi[0];
    const ck = cfg.chuKy.find((x) => x.id === key) || cfg.chuKy[0];
    const mc = giaMayChu && (giaMayChu.chuKy || []).find((x) => x.id === key);
    const vatPt = (giaMayChu && giaMayChu.vatPhanTram) || cfg.vat || 0;

    // Đăng nhập được thì CHỈ VIỆC IN con số máy chủ gửi sang — nó gửi sẵn cả ba
    // (`giaTruocVat`, `vat`, `gia`) chính vì không muốn app tự nhân chia.
    if (mc) {
      const lanDau = !!giaMayChu.laLanDau;
      return {
        g, ck, vatPt,
        tong: mc.gia,
        vat: mc.vat,
        truocVat: mc.giaTruocVat,
        thuong: mc.giaThuong,
        lanDau,
        giamLanDau: lanDau ? (giaMayChu.giamLanDau || 0) : 0,
      };
    }

    /* ĐƯỜNG LÙI khi chưa đăng nhập — phải tính Y HỆT `account-api/src/gia.js`.
     *
     * ⚠ SAI CŨ: chỗ này lấy `giaThang` làm giá ĐÃ GỒM VAT rồi suy ngược tiền
     * thuế ra (`tong - tong/1.1`). Nhưng `gia.js` đã đổi nghĩa từ 13/08:
     * `giaThang` là giá GỐC, VAT cộng LÊN TRÊN. Nên màn này hiện 199.000đ trong
     * khi đơn thật là 199.000 + 19.900 = 218.900đ — khách nhìn một số, chuyển
     * một số, mà số phải chuyển là số của máy chủ.
     *
     * Thứ tự phép tính cũng phải giống: giảm theo chu kỳ → làm tròn XUỐNG nghìn
     * → rồi mới cộng VAT. Làm tròn sau khi cộng VAT là lệch vài trăm đồng.
     *
     * Không tính ưu đãi lần đầu ở đây: điều kiện "đã có đơn paid chưa" chỉ máy
     * chủ biết, đoán bừa là mời một mức giá có thể không có thật. */
    const goc = g.giaThang * ck.thang;
    const truocVat = Math.floor(Math.round(goc * (1 - ck.giam / 100)) / 1000) * 1000;
    const vat = Math.round(truocVat * vatPt / 100);
    const tong = truocVat + vat;
    return { g, ck, vatPt, tong, vat, truocVat, thuong: tong, lanDau: false, giamLanDau: 0 };
  }

  /** Ảnh QR + nội dung CK, do tiến trình chính sinh (EMVCo, không gọi mạng). */
  let qr = { anh: '', noiDung: '', coMaNguoiDung: false };

  /**
   * ĐƠN CHỈ ĐƯỢC TẠO KHI KHÁCH TỰ BẤM NÚT.
   *
   * `api.plans.qr()` không phải là hàm đọc — nó gọi `POST /v1/orders`, và mỗi
   * lần gọi là MỘT HÀNG MỚI trong bảng `orders`. Trước đây `mo()` gọi nó ngay
   * lúc mở màn, nên chỉ cần bấm nhầm vào "Nâng cấp" là đã đẻ ra một đơn treo.
   * Ai tò mò mở ra đóng vào mươi lần thì máy chủ có mươi đơn `pending` chẳng
   * bao giờ có tiền về — rác dữ liệu, mà lại làm hỏng chính việc đối soát:
   * webhook khớp theo mã CK nên nhiều đơn treo cùng một người là nhiều mã phải
   * dò.
   *
   * `daBamTao` phân biệt "chưa hỏi bao giờ" với "hỏi rồi mà không ra QR" — hai
   * cái này nhìn bề ngoài giống hệt nhau (đều `qr.anh === ''`) nhưng phải hiện
   * hai thứ khác nhau: một cái là cái nút, một cái là báo lỗi.
   */
  let daBamTao = false;
  /** Số lượt đặt đơn đang bay. > 0 là đang tạo, dùng để vẽ trạng thái nút. */
  let dangChay = 0;
  /**
   * Số thứ tự lượt đặt đơn. CHỈ lượt mới nhất được phép ghi vào `qr`.
   *
   * ⚠ VÌ SAO CẦN: nút chu kỳ KHÔNG bị khoá trong lúc đang tạo mã. Bấm "Tạo mã
   * QR" (1 tháng) rồi bấm ngay "3 tháng" là hai lệnh cùng bay; lệnh 1 tháng về
   * sau thì nó ghi đè, để lại màn hình: số tiền in ra là 623.700đ của 3 tháng,
   * còn mã QR và nội dung CK lại là đơn 218.900đ của 1 tháng.
   *
   * Khách chuyển 623.700đ vào đơn 218.900đ. Webhook khớp bằng `amount >=
   * don.amount` nên đơn được đánh dấu trả đủ và chỉ cộng 1 THÁNG — khách trả
   * tiền ba tháng, nhận một tháng, mà không có gì báo sai ở đâu cả.
   */
  let luotQR = 0;
  const QR_LOI = () => ({ anh: '', noiDung: '', coMaNguoiDung: false, loiDatDon: true });

  /**
   * Gói hiện tại của tài khoản — để màn này biết đang BÁN MỚI hay GIA HẠN.
   * Trước đây thông tin này nằm ở trang giới thiệu gói (đã gộp vào đây), người
   * đang trả phí mở màn thanh toán ra không thấy mình còn hạn đến bao giờ.
   */
  let thueBao = null;
  const laGiaHan = () => Boolean(
    thueBao && cfg && cfg.goi && cfg.goi[0] && thueBao.plan === cfg.goi[0].id
      && (!thueBao.status || thueBao.status === 'active'),
  );
  const hanCu = () => {
    const v = thueBao && thueBao.currentPeriodEnd;
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN');
  };

  /**
   * Đặt đơn ở máy chủ rồi vẽ lại màn. ĐÂY LÀ CHỖ DUY NHẤT gọi `plans.qr`.
   *
   * Gộp việc đánh dấu bận, gọi mạng và vẽ lại vào một hàm là có ý: ba thứ đó
   * phải đi cùng nhau, tách ra thì chỗ gọi nào quên một bước là ra một trạng
   * thái nửa vời khác nhau.
   */
  async function taoLaiQR() {
    daBamTao = true;
    dangChay += 1;
    giuOApaint();            // hiện "Đang tạo mã QR…" trước khi chờ mạng
    const luot = ++luotQR;
    let kq;
    try {
      // Gửi CHU KỲ, không gửi tiền — máy chủ tự tính (xem account-api/src/gia.js).
      kq = await api.plans.qr(chuKyId);
    } catch {
      // `loiDatDon: true` chứ không phải object rỗng: đã gọi và đã hỏng, khác
      // hẳn với "chưa gọi bao giờ". Thiếu cờ này thì màn hình rơi vào nhánh
      // "chưa khai số tài khoản trong plans.json" — báo sai bệnh, mà lại không
      // có nút thử lại.
      kq = QR_LOI();
    } finally {
      dangChay -= 1;
    }
    // Có lượt mới hơn rồi thì VỨT kết quả này đi — xem chú thích ở `luotQR`.
    if (luot === luotQR) {
      qr = (kq && typeof kq === 'object') ? kq : QR_LOI();
    }
    giuOApaint();
  }

  /**
   * Icon cho từng dòng tính năng của gói.
   *
   * Chọn theo TỪ KHOÁ trong chính câu chữ, không theo thứ tự dòng: danh sách
   * nằm ở `plans.json`, thêm/bớt/đảo dòng là chuyện thường. Đánh số cứng theo
   * vị trí thì thêm một dòng ở giữa là toàn bộ icon phía dưới lệch hết mà không
   * có gì báo.
   *
   * ⚠ THỨ TỰ LUẬT LÀ CÓ Ý. "Template mới hằng tháng" khớp cả /template/ lẫn
   * /hằng tháng/ — để luật lịch lên trước thì dòng đó ra icon lịch (đúng ý:
   * điểm nhấn là "mới hằng tháng"), đảo lại là ra icon lưới giống hệt dòng
   * "Toàn bộ template" bên trên, hai dòng cạnh nhau cùng một hình.
   *
   * Không khớp luật nào thì ra dấu tích — luôn có icon, không bao giờ thủng lỗ.
   */
  const NET = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  const HINH = {
    lich: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 2.8v4M16 2.8v4"/>',
    luoi: '<rect x="3" y="3" width="8" height="8" rx="1.6"/><rect x="13" y="3" width="8" height="8" rx="1.6"/><rect x="3" y="13" width="8" height="8" rx="1.6"/><rect x="13" y="13" width="8" height="8" rx="1.6"/>',
    phim: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M10 9.3l5.2 2.7-5.2 2.7z"/>',
    mic: '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    mayMoc: '<rect x="2.5" y="4" width="13" height="10" rx="2"/><path d="M6.5 18h5"/><rect x="16.5" y="8.5" width="5.5" height="11.5" rx="1.8"/>',
    thu: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3.6 7.2l8.4 5.9 8.4-5.9"/>',
    khien: '<path d="M12 2.8l7.2 3v5.7c0 4.4-3 8.2-7.2 10-4.2-1.8-7.2-5.6-7.2-10V5.8z"/><path d="M9.3 9.3l5.4 5.4M14.7 9.3l-5.4 5.4"/>',
    chop: '<path d="M13.2 2.5L4.8 13.6h5.6l-1 7.9 8.8-11.1h-5.6z"/>',
    netCao: '<path d="M12 3.2l2 4.8 4.8 2-4.8 2-2 4.8-2-4.8-4.8-2 4.8-2z"/><path d="M18.6 15.4l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    tich: '<circle cx="12" cy="12" r="9.2"/><path d="M8.3 12.4l2.5 2.5 4.9-5.3"/>',
  };
  const LUAT = [
    [/h[àằ]ng th[áa]ng|m[ỗo]i th[áa]ng|h[àa]ng tu[âầ]n/i, HINH.lich],
    /* ⚠ Luật thư ĐỨNG TRƯỚC luật tốc độ. "Hỗ trợ nhanh qua email" có chữ
       "nhanh" — để luật tốc độ lên trước là dòng đó ra tia chớp. */
    [/email|h[ỗo] tr[ợo]|support/i, HINH.thu],
    /* Hai luật này phải ĐỨNG TRƯỚC luật video: "Tốc độ dựng video siêu nhanh"
       và "Tạo video Full HD" đều có chữ "video", rơi vào luật video là cả ba
       dòng video dùng chung một hình. */
    [/t[ốo]c [đd][ộo]|si[êe]u nhanh|nhanh ch[óo]ng/i, HINH.chop],
    [/full ?hd|1080|2k|4k|[đd][ộo] ph[âa]n gi[ảa]i|s[ắa]c n[ée]t/i, HINH.netCao],
    [/template|m[ẫa]u/i, HINH.luoi],
    [/video|d[ựu]ng|render/i, HINH.phim],
    [/gi[ọo]ng|voice|tts|[đd][ọo]c/i, HINH.mic],
    [/thi[ếe]t b[ịi]|m[áa]y|device/i, HINH.mayMoc],
    [/qu[ảa]ng c[áa]o|ads/i, HINH.khien],
  ];
  /**
   * Logo ngân hàng, tra theo MÃ BIN của VietQR chứ không theo tên.
   *
   * Tên bên plans.json là chữ gõ tay ("Techcombank", "TCB", "Techcom Bank" đều
   * có thể viết ra), còn BIN là con số chuẩn của Napas. Ngân hàng nào chưa có
   * tệp logo thì rơi về ô icon + tên đọc từ cấu hình — đổi số tài khoản sang
   * ngân hàng khác mà logo vẫn là Techcombank thì logo đang nói dối.
   */
  const LOGO_NH = { 970407: 'assets/nh-tcb.png' };

  const iconTinhNang = (chu) => {
    const d = (LUAT.find(([re]) => re.test(chu)) || [null, HINH.tich])[1];
    return `<svg class="co-ds-ic" viewBox="0 0 24 24" ${NET} aria-hidden="true">${d}</svg>`;
  };

  /* Thứ tự ở đây LÀ thứ tự trên màn hình: xếp đôi một, hai ô một hàng.
     Ba phần địa chỉ đứng liền nhau theo chiều to → nhỏ (Tỉnh → Phường → Số
     nhà) và vẫn là BA ô riêng, không gộp thành một ô "Địa chỉ": hoá đơn điện
     tử cần từng phần tách bạch. */
  /* HAI bộ ô, theo loại hoá đơn (28/09/2026 — trước đó chỉ đổi NHÃN ô cuối, dữ liệu giữ nguyên: bấm "Công ty"
     mà ô vẫn là họ tên + CCCD của cá nhân).
     · Cá nhân: họ tên, email, SĐT, tỉnh, phường, số nhà, CCCD.
     · Công ty: tên DN, email nhận HĐ, SĐT DN, MỘT ô "Địa chỉ doanh nghiệp" đầy đủ, MST. Không tách tỉnh/phường:
       địa chỉ công ty trong hồ sơ Bee Account là một dòng (như Bee Platform) — ghép tỉnh/phường cá nhân vào là
       sai địa chỉ trên hoá đơn VAT (máy chủ nay chỉ đòi `diachi` với hoá đơn công ty — services/hoaDon.js).
     Mỗi hàng là một mảng ô, xếp đôi. */
  const BO_O = {
    cccd: [
      [{ k: 'ten', nhan: 'Họ và tên', goiY: 'Nhập họ và tên' }, { k: 'email', nhan: 'Email', goiY: 'example@email.com' }],
      [{ k: 'sdt', nhan: 'Số điện thoại', goiY: 'Nhập số điện thoại' }, { k: 'tinh', nhan: 'Tỉnh/Thành phố', goiY: 'Nhập tỉnh/thành phố' }],
      [{ k: 'phuong', nhan: 'Phường/Xã', goiY: 'Nhập phường/xã' }, { k: 'diachi', nhan: 'Số nhà, tên đường', goiY: 'Nhập số nhà, tên đường' }],
      [{ k: 'ma', nhan: 'Số CCCD', goiY: 'Nhập số CCCD', sua: true }],
    ],
    mst: [
      [{ k: 'ten', nhan: 'Tên doanh nghiệp', goiY: 'Nhập tên doanh nghiệp' }, { k: 'email', nhan: 'Email nhận hoá đơn', goiY: 'ketoan@congty.vn' }],
      [{ k: 'sdt', nhan: 'SĐT doanh nghiệp', goiY: 'Nhập số điện thoại' }, { k: 'diachi', nhan: 'Địa chỉ doanh nghiệp', goiY: 'Số nhà, đường, phường, tỉnh/thành' }],
      [{ k: 'ma', nhan: 'Mã số thuế', goiY: 'Nhập mã số thuế', sua: true }],
    ],
  };

  /* Form hoá đơn LUÔN CHỈ ĐỌC, lấy từ hồ sơ Bee Account; sửa bằng nút "Sửa thông tin" (mở bảng hồ sơ) — như Bee
     Project (29/09/2026). Trước đây chỉ khoá khi TẢI ĐƯỢC hồ sơ + đã nối; tải lỗi / chưa nối là rơi về gõ tay thẳng
     vào form ⇒ hai nguồn dữ liệu người mua lệch nhau. Nhánh gõ tay (nhapTay / luuNhapTay) giữ nguyên nhưng không còn
     chạy tới. */
  const theoHoSo = () => true;
  const daNoi = () => !!(hoSoBee && hoSoBee.linked);
  /* Hồ sơ đã tick "Xuất hoá đơn theo thông tin doanh nghiệp" ⇒ CHỈ hoá đơn công ty: ẩn nút Cá nhân / Công ty, chốt
     loại 'mst' (29/09/2026). Máy chủ cũng tự đối chiếu hồ sơ Bee lúc xuất (account-api services/hoaDon.js). */
  const khoaCongTy = () => daNoi() && !!hoSoBee.invoice && hoSoBee.invoice.invoiceType === 'BUSINESS';

  /** Giá trị một ô theo loại đang chọn: hồ sơ Bee Account, hoặc (chưa nối) thứ đã gõ / hồ sơ riêng đã lưu. */
  function giaTriO(k) {
    if (theoHoSo()) {
      const bo = hoSoBeeChoThanhToan(hoSoBee, emailTK, loaiHoaDon) || {};
      return bo[k] || '';
    }
    const tay = nhapTay[loaiHoaDon] || {};
    if (tay[k] != null) return tay[k];
    const luu = hoaDonLuu && (hoaDonLuu.loaiHoaDon || 'cccd') === loaiHoaDon ? hoaDonLuu : null;
    if (luu && luu[k] != null && luu[k] !== '') return String(luu[k]);
    return k === 'email' ? emailTK : '';
  }

  /** Một ô nhập có nhãn ở TRÊN — cả form dùng chung. */
  const oNhap = (o) => `
    <div class="co-o">
      <label for="co-o-${esc(o.k)}">${esc(o.nhan)} <b>*</b></label>
      <input id="co-o-${esc(o.k)}" data-o="${esc(o.k)}" placeholder="${esc(o.goiY || '')}"
             value="${esc(giaTriO(o.k))}"${theoHoSo() ? ' readonly tabindex="-1"' : ''} />
    </div>`;

  /** Nút "Sửa thông tin" (nền đen, như bảng hồ sơ) — ô thứ hai CÙNG HÀNG với CCCD / MST (chủ dự án chốt 28/09/2026). */
  const nutSuaHoSo = () => `
    <div class="co-o co-o-nut">
      <button type="button" class="co-sua" data-sua-ho-so>
        <span class="btn-icon" data-icon="butchi" aria-hidden></span><span>Sửa thông tin</span>
      </button>
    </div>`;

  /** Dòng báo ĐỎ, căn giữa, có icon cảnh báo — ngay dưới form hoá đơn khi hồ sơ của loại đang chọn chưa đủ (29/09/2026). */
  function lyDoThieu() {
    if (!daDangNhap) return 'Hãy đăng nhập để tạo mã QR và xuất hoá đơn.';
    const du = BO_O[loaiHoaDon].every((hang) => hang.every((o) => String(giaTriO(o.k) || '').trim()));
    if (du) return '';
    return hoSoLoi
      ? 'Chưa tải được hồ sơ xuất hoá đơn — đóng rồi mở lại màn này, hoặc bấm "Sửa thông tin".'
      : !daNoi()
        ? 'Tài khoản chưa nối Bee Account — hãy đăng xuất rồi đăng nhập lại để dùng hồ sơ xuất hoá đơn.'
        : `Hồ sơ ${loaiHoaDon === 'mst' ? 'doanh nghiệp' : 'cá nhân'} còn thiếu thông tin — bấm "Sửa thông tin" để bổ sung.`;
  }

  function thongBaoThieu() {
    const cau = lyDoThieu();
    if (!cau) return '';
    return `<p class="co-thieu" role="alert"><span class="btn-icon" data-icon="warn" aria-hidden></span><span>${esc(cau)}</span></p>`;
  }

  /**
   * Một thẻ chu kỳ: tên, giá CHƯA VAT của cả kỳ, giá gốc gạch ngang, huy hiệu giảm.
   *
   * Giá in ở đây là `truocVat` chứ không phải số khách chuyển — để nó khớp
   * đúng dòng "Gói đăng ký N tháng" ở cột phải, rồi VAT cộng thêm bên dưới.
   * In số đã gồm VAT lên thẻ thì cột phải lại cộng VAT lần nữa lên cùng con
   * số ấy, nhìn như tính thuế hai lần.
   */
  function veChuKy(c) {
    const g = cfg.goi[0];
    const t = tinh(c.id);
    const goc = g.giaThang * c.thang;
    const dv = esc(cfg.donVi);
    return `
      <button type="button" class="co-ck${c.id === chuKyId ? ' active' : ''}" data-ck="${esc(c.id)}">
        ${c.giam ? `<span class="giam">-${c.giam}%</span>` : ''}
        <span class="co-ck-ten">${esc(c.ten)}</span>
        <span class="co-ck-gia">${tien(t.truocVat)}${dv}${
          goc > t.truocVat ? `<s>${tien(goc)}${dv}</s>` : ''
        }</span>
      </button>`;
  }

  let loaiHoaDon = 'cccd';

  function paint() {
    const { g, ck, tong, vat, truocVat, thuong, lanDau, giamLanDau, vatPt } = tinh();
    const nd = qr.noiDung;
    const n = cfg.nganHang || {};
    const dv = esc(cfg.donVi);

    /* Tách chữ CUỐI của tên gói ra để tô dải màu ("Beeknoee Studio *Plus*").
       Tách theo khoảng trắng chứ không viết cứng chữ "Plus": tên gói nằm ở
       plans.json, đổi tên ở đó là chỗ này tự theo. */
    const tu = String(g.ten).trim().split(' ').filter(Boolean);
    const tenCuoi = tu.length > 1 ? tu.pop() : '';
    const tenDau = tu.join(' ');

    /* Ô mã QR. Có mã thì dựng đúng tấm thẻ VietQR như app ngân hàng (nền
       TRẮNG bắt buộc — máy quét cần nền sáng); chưa có thì là một khung nét
       đứt nói rõ phải bấm gì. Bốn trạng thái "chưa có" đều phải phân biệt
       được: đang gọi, chưa bấm bao giờ, gọi hỏng, và thiếu số tài khoản. */
    const oQR = qr.anh
      ? `<div class="co-qr-anh">
           <div class="co-qr-top">
             <span class="vq-mark"><span class="vq-v">V</span><span class="vq-red">IET</span><span class="vq-navy">QR</span></span>
           </div>
           <div class="co-qr-ma"><img src="${esc(qr.anh)}" alt="Mã QR chuyển khoản" /></div>
           <div class="co-qr-bot">
             <span class="np-mark"><span class="np-navy">napas</span><span class="np-blue">2</span><span class="np-navy">4</span><span class="np-green">7</span></span>
             <span class="co-qr-sep"></span>
             <span class="co-qr-bank"><svg class="bank-dia" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 12l5-5 5 5-5 5z"/><path d="M2 12l5-5 3 3-5 5z" opacity="0.85"/></svg>${esc(n.ten || 'Ngân hàng')}</span>
           </div>
         </div>`
      : `<div class="co-qr-cho${qr.loiDatDon ? ' loi' : ''}">
           <span class="btn-icon" data-icon="maqr"></span>
           ${dangChay
             ? '<b>Đang tạo mã QR…</b>'
             : (!daBamTao
               ? '<b>Chưa có mã QR</b><span>Bấm nút “Tạo mã QR” ở bên phải để tạo</span>'
               : (qr.loiDatDon
                 ? '<b>Chưa tạo được đơn</b><span>Xem dòng báo bên dưới. <b>Đừng chuyển khoản</b> khi chưa có mã.</span>'
                 : '<b>Chưa khai số tài khoản</b><span>Thiếu thông tin ngân hàng trong plans.json</span>'))}
         </div>`;

    el.innerHTML = `
      <div class="co-hop">
        <button class="co-x" type="button" data-dong aria-label="Đóng">×</button>

        <section class="co-hero">
          <h2>${laGiaHan() ? 'Gia hạn' : 'Nâng cấp'} ${esc(tenDau)}${tenCuoi ? ` <em>${esc(tenCuoi)}</em>` : ''} ✨</h2>
          <p>${esc(g.moTa || '')}</p>
        </section>

        ${laGiaHan()
          ? `<div class="co-dangdung">
               <span class="btn-icon" data-icon="qua"></span>
               <span>Bạn đang dùng <b>${esc(g.ten)}</b>${hanCu() ? ` — đến <b>${esc(hanCu())}</b>` : ''} — thời hạn mua thêm được <b>cộng tiếp vào ngày hết hạn</b>, không mất ngày nào.</span>
             </div>`
          : ''}

        <div class="co-chuky">${cfg.chuKy.map(veChuKy).join('')}</div>

        <div class="co-luoi">
          <div class="co-trai">
            ${/* MỘT bước, không phải hai. Mẫu thiết kế có một dòng "Phương thức
                  thanh toán" rồi bên trong lại một thẻ "Chuyển khoản ngân hàng"
                  kèm nút chọn — đúng khi có nhiều cách trả tiền. Ở đây chỉ có
                  MỘT cách, nên hai lớp tiêu đề đó là hỏi một câu không có lựa
                  chọn nào, và cái nút tròn luôn luôn được chọn sẵn. Gộp lại
                  thành một tiêu đề. */ ''}
            <section class="co-buoc">
              <header class="co-buoc-dau">
                <span class="co-stt">1</span>
                <div class="co-buoc-ten">
                  <h3>Chuyển khoản ngân hàng</h3>
                  <p>Phổ biến, xác nhận nhanh — quét mã QR hoặc chuyển theo số tài khoản bên dưới</p>
                </div>
              </header>

              <div class="co-nh-the">
                <div class="co-nh-hieu">
                  ${LOGO_NH[n.bin]
                    ? `<img class="co-nh-logo" src="${esc(LOGO_NH[n.bin])}" alt="${esc(n.ten || '')}" />`
                    : `<span class="co-nh-hieu-o"><span class="btn-icon" data-icon="nganhang"></span></span>
                       <span class="co-nh-hieu-ten">${esc(n.ten || 'Ngân hàng')}</span>`}
                </div>
                <div class="co-nh-tin">
                  <dl class="co-nh-bang">
                    <dt>Tên tài khoản</dt>
                    <dd><span class="co-nh-chu">${esc(n.chuTaiKhoanHienThi || n.chuTaiKhoan || '')}</span></dd>
                    <dt>Ngân hàng</dt>
                    <dd><span class="co-nh-chu">${esc(n.ten || '')}</span></dd>
                    <dt>Số tài khoản</dt>
                    <dd>
                      <span class="co-nh-gt">${esc(n.soTaiKhoan || '')}</span>
                      <button class="co-chep" type="button" data-chep="${esc(n.soTaiKhoan || '')}">Copy</button>
                    </dd>
                    <dt>Nội dung chuyển khoản</dt>
                    <dd>
                      ${nd
                        ? `<span class="co-nh-gt quan-trong">${esc(nd)}</span>
                           <button class="co-chep" type="button" data-chep="${esc(nd)}">Copy</button>`
                        : '<span class="co-nh-gt co-mo">— chưa có —</span>'}
                    </dd>
                  </dl>
                  ${/* Cảnh báo chưa đăng nhập chỉ có nghĩa khi ĐÃ có mã. Chưa bấm
                        tạo thì coMaNguoiDung đương nhiên false, hiện ra là doạ
                        nhầm người đang đăng nhập tử tế. */ ''}
                  ${(qr.anh && !qr.coMaNguoiDung)
                    ? '<div class="co-canhbao">⚠ Chưa đăng nhập nên mã chưa gắn với tài khoản của bạn. Đăng nhập trước khi chuyển khoản.</div>'
                    : ''}
                </div>
                <div class="co-qr-o">${oQR}</div>
              </div>

              ${/* Lý do THẬT máy chủ từ chối, hết chiều ngang thẻ — không nhét vào ô
                    QR rộng 264px vì câu lỗi có kèm địa chỉ máy chủ đang gọi, xuống
                    cả chục dòng trong ô hẹp. */ ''}
              ${qr.loiDatDon && qr.loiChiTiet
                ? `<div class="co-loi-don">
                     <span class="btn-icon" data-icon="warn"></span>
                     <span><b>Máy chủ không nhận đơn:</b> ${esc(qr.loiChiTiet)}</span>
                   </div>`
                : ''}

              <div class="co-tin">
                <span class="btn-icon" data-icon="info"></span>
                <span>Sau khi chuyển khoản, hệ thống sẽ tự động xác nhận trong 1–2 phút.</span>
              </div>
            </section>

            <section class="co-buoc">
              <header class="co-buoc-dau">
                <span class="co-stt">2</span>
                <div class="co-buoc-ten">
                  <h3>Thông tin xuất hoá đơn</h3>
                  <p>${khoaCongTy()
                    ? 'Xuất hoá đơn theo thông tin doanh nghiệp trong hồ sơ'
                    : 'Vui lòng nhập đầy đủ thông tin để xuất hoá đơn'}</p>
                </div>
                ${/* MỘT nút gạt cho MỘT lựa chọn. Mẫu vẽ hai cái ("Cá nhân |
                      Công ty" ở đầu mục, "CCCD | MST" giữa form) nhưng cả hai
                      đổi đúng một thứ: loại hoá đơn. Để cả hai thì bấm cái này
                      cái kia tự nhảy theo — nhìn như màn hình tự đổi lung tung.
                      Giữ cái ở đầu mục: chọn TRƯỚC rồi mới gõ, và nhãn ô cuối
                      tự đổi theo (Số CCCD/CMND ↔ Mã số thuế). */ ''}
                ${khoaCongTy() ? '' : `<div class="co-loai" role="group" aria-label="Loại hoá đơn">
                  <button type="button" data-loai="cccd" class="${loaiHoaDon === 'cccd' ? 'active' : ''}">Cá nhân</button>
                  <button type="button" data-loai="mst" class="${loaiHoaDon === 'mst' ? 'active' : ''}">Công ty</button>
                </div>`}
              </header>

              <div class="co-form${theoHoSo() ? ' chi-doc' : ''}">
                ${BO_O[loaiHoaDon].map((hang) => `<div class="co-hang">${hang.map(oNhap).join('')}${
                  theoHoSo() && hang.some((o) => o.sua) ? nutSuaHoSo() : ''}</div>`).join('')}
              </div>
              ${thongBaoThieu()}
            </section>
          </div>

          <aside class="co-goi">
            <div class="co-goi-dau">
              <span class="co-goi-o"><span class="btn-icon" data-icon="crown"></span></span>
              <div>
                <div class="co-goi-ten">${esc(g.ten)}</div>
                <div class="co-goi-gia">${tien(g.giaThang)}${dv}/tháng${ck.giam ? ` · giảm ${ck.giam}% khi trả ${esc(ck.ten)}` : ''}</div>
              </div>
              ${/* Chỉ dán huy hiệu khi bảng giá có ĐÚNG MỘT gói — lúc đó "cao
                    cấp nhất" là sự thật hiển nhiên. Thêm gói thứ hai vào
                    plans.json mà huy hiệu vẫn nằm đây là nó đang nói bừa, vì cả
                    màn này chỉ đọc goi[0]. */ ''}
              ${cfg.goi.length <= 1
                ? '<span class="co-goi-tem"><span class="btn-icon" data-icon="sao"></span>Gói cao cấp nhất</span>'
                : ''}
            </div>
            ${lanDau ? `<div class="co-uudai">Ưu đãi lần đầu · giảm ${giamLanDau}% cho đơn đầu tiên</div>` : ''}

            <h3>Bạn sẽ nhận được</h3>
            <ul class="co-ds">${g.co.map((x) => `
              <li>
                <span class="co-ds-o">${iconTinhNang(String(x))}</span>
                <span>${esc(x)}</span>
                <span class="co-ds-tich"><span class="btn-icon" data-icon="check"></span></span>
              </li>`).join('')}</ul>

            <div class="co-tong">
              <div class="co-dong"><span>Gói đăng ký ${esc(ck.ten)}</span><span>${tien(truocVat)}${dv}</span></div>
              <div class="co-dong"><span>VAT (${vatPt}%)</span><span>${tien(vat)}${dv}</span></div>
              <div class="co-dong lon"><span>Tổng</span><span class="co-tien">${tien(tong)}${dv}${
                lanDau && thuong > tong ? `<span class="co-gia-cu">${tien(thuong)}${dv}</span>` : ''
              }</span></div>
            </div>

            ${/* MỘT chỗ, HAI nút nối tiếp nhau theo đúng thứ tự việc phải làm:
                  chưa có mã thì việc duy nhất là lấy mã, có mã rồi mới đến việc
                  báo đã chuyển. Để hai nút cùng lúc là bày ra một nút chưa dùng
                  được ngay dưới nút đang cần bấm. */ ''}
            ${qr.anh
              ? `<button class="co-nut" type="button" data-xong disabled>Đã thanh toán · ${tien(tong)}${dv}</button>
                 <div class="co-nhac">⚠ Vui lòng điền thông tin hoá đơn trước</div>
                 <div class="co-dieukhoan">
                   Chuyển đúng số tiền &amp; nội dung, rồi bấm nút trên.
                   Hệ thống <b>tự nâng gói trong 1–2 phút</b>. Hoá đơn gửi qua email.
                 </div>`
              : `<div class="co-khoa-qr"${lyDoThieu() ? ` data-tip="${esc(lyDoThieu())}"` : ''}>
                   <button class="co-nut" type="button" data-tao-qr${dangChay || lyDoThieu() ? ' disabled' : ''}>${
                     dangChay ? 'Đang tạo mã QR…'
                       : (daBamTao ? 'Thử lại tạo mã QR'
                         : `Tạo mã QR · ${tien(tong)}${dv}`)
                   }</button>
                 </div>
                 <div class="co-dieukhoan">
                   <b>Chưa có mã QR thì đừng chuyển khoản</b> — tiền sẽ không khớp đơn nào.
                   Bấm nút trên để lấy mã và nội dung chuyển khoản.
                 </div>`}

            <div class="co-luat">
              <span class="btn-icon" data-icon="info"></span>
              <span>Theo <b>Nghị định 70/2025/NĐ-CP, áp dụng từ 01/01/2026</b>, mọi đơn hàng
                online đều phải xuất hoá đơn kèm thông tin người mua. Beeknoee cam kết bảo mật
                và chỉ dùng thông tin của bạn cho mục đích lập hoá đơn theo quy định.</span>
            </div>
          </aside>
        </div>
      </div>`;

    // icons.js chỉ quét một lần lúc nạp trang, mà màn này vẽ lại nhiều lần —
    // không gọi lại thì mọi ô icon trống trơn và không báo lỗi gì.
    if (window.__beeIcons) window.__beeIcons.apply(el);
    noiSuKien();
  }

  function noiSuKien() {
    el.querySelector('[data-dong]').onclick = dong;
    el.onclick = (e) => { if (e.target === el) dong(); };

    const nutTaoQR = el.querySelector('[data-tao-qr]');
    // Hồ sơ hoá đơn chưa đủ ⇒ không tạo mã (nút đã disabled; chặn thêm ở đây cho chắc — 29/09/2026).
    if (nutTaoQR) nutTaoQR.onclick = () => { if (!dangChay && !lyDoThieu()) taoLaiQR(); };

    el.querySelectorAll('[data-ck]').forEach((b) => {
      b.onclick = () => {
        chuKyId = b.dataset.ck;
        // Đã có đơn rồi thì PHẢI sinh lại: đổi chu kỳ là đổi số tiền, để mã cũ
        // nằm đó là khách quét và chuyển sai số.
        // Chưa bấm tạo thì thôi — xem qua các mức giá không phải là đặt đơn.
        if (daBamTao && !lyDoThieu()) taoLaiQR(); else giuOApaint();
      };
    });

    el.querySelectorAll('[data-chep]').forEach((b) => {
      b.onclick = async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(b.dataset.chep);
          b.textContent = 'Đã copy';
          b.classList.add('xong');
          setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('xong'); }, 1300);
        } catch { b.textContent = 'Lỗi'; }
      };
    });
    el.querySelectorAll('[data-loai]').forEach((b) => {
      b.onclick = () => {
        if (b.dataset.loai === loaiHoaDon) return;
        luuNhapTay();                  // chưa nối: giữ chữ đã gõ của loại CŨ cho loại cũ
        loaiHoaDon = b.dataset.loai;
        paint();                       // vẽ bộ ô của loại MỚI với dữ liệu của loại mới
        if (kiemHienTai) kiemHienTai();
      };
    });
    // "Chỉnh sửa" ⇒ mở bảng hồ sơ ĐÚNG tab (Thông tin / Doanh nghiệp). Lưu xong ho-so.js bắn `bee-ho-so-doi`,
    // màn này nghe và vẽ lại với dữ liệu mới (xem cuối tệp).
    const nutSua = el.querySelector('[data-sua-ho-so]');
    if (nutSua) {
      nutSua.onclick = (e) => {
        e.stopPropagation();
        if (window.__beeAuth && window.__beeAuth.moCaiDat) {
          window.__beeAuth.moCaiDat(nutSua, loaiHoaDon === 'mst' ? 'doanhnghiep' : 'thongtin');
        }
      };
    }

    const nut = el.querySelector('[data-xong]');
    const nhac = el.querySelector('.co-nhac');
    const o = () => [...el.querySelectorAll('input[data-o]')];
    const kiem = () => {
      // Chưa có mã thì chỗ này đang là nút "Tạo mã QR", không có [data-xong] để
      // bật/tắt — và cũng chẳng cần: không có đơn thì không có gì để xác nhận.
      if (!nut || !nhac) return;
      const du = o().every((i) => i.value.trim());
      nut.disabled = !du;
      nhac.style.display = du ? 'none' : '';
      nhac.textContent = theoHoSo()
        ? `⚠ Hồ sơ ${loaiHoaDon === 'mst' ? 'doanh nghiệp' : 'cá nhân'} còn thiếu thông tin — bấm "Sửa thông tin" để bổ sung`
        : '⚠ Vui lòng điền thông tin hoá đơn trước';
    };
    // giuOApaint() vẽ lại rồi tự bật/tắt nút "Đã thanh toán" — nhưng nó chỉ nhìn
    // mấy ô nhập, không nhìn QR. Trỏ nó về đúng hàm này để một chỗ quyết định.
    kiemHienTai = kiem;
    // Giá trị đã có sẵn trong markup (giaTriO). Chưa nối Bee Account: nhớ chữ đang gõ THEO LOẠI.
    if (!theoHoSo()) {
      o().forEach((i) => i.addEventListener('input', () => {
        (nhapTay[loaiHoaDon] = nhapTay[loaiHoaDon] || {})[i.dataset.o] = i.value;
      }));
    }
    /**
     * Đẩy hồ sơ hoá đơn lên máy chủ NGAY KHI ĐIỀN ĐỦ, không đợi bấm nút.
     *
     * ⚠ VÌ SAO CẦN: đơn và mã QR được tạo ngay lúc mở màn này, TRƯỚC khi khách
     * gõ gì. Còn dòng chữ ngay dưới lại bảo "chuyển đúng số tiền, rồi bấm nút
     * trên" — tức khách chuyển khoản TRƯỚC khi bấm. Webhook ngân hàng về trước
     * cú bấm thì `phatHoaDon()` đọc `billing_json` rỗng, ghi
     * `invoice_status='thieu_thong_tin'` và KHÔNG gọi bee_finance. Tiền đã thu,
     * gói đã lên, hoá đơn không bao giờ ra. Khách đóng cửa sổ sau khi chuyển
     * tiền là mất hẳn dữ liệu người mua.
     *
     * Đo được trên máy chủ thật trước khi sửa: `users` 2 tài khoản, 0 có
     * `billing_json`.
     *
     * Vẫn GIỮ lần lưu ở nút bấm — hai đường không đụng nhau (`PUT /v1/billing`
     * ghi đè cùng một hàng), và giữ được cho trường hợp khách sửa lại thông tin
     * ngay trước khi bấm.
     */
    const guiHoSoNeuDu = () => {
      if (!api.billing || !api.billing.save) return;
      const oo = o();
      if (!oo.every((i) => i.value.trim())) return; // chưa đủ thì chưa gửi
      const hd = { loaiHoaDon };
      oo.forEach((i) => { hd[i.dataset.o] = i.value.trim(); });
      const van = JSON.stringify(hd);
      if (van === hoSoDaGui) return; // không gửi lại y nguyên
      hoSoDaGui = van;
      Promise.resolve(api.billing.save(hd)).catch(() => { hoSoDaGui = ''; });
    };

    // Gõ xong mới gửi, đừng gửi từng phím: chờ 800ms im tiếng.
    let hen = null;
    o().forEach((i) => i.addEventListener('input', () => {
      i.classList.remove('thieu');
      kiem();
      clearTimeout(hen);
      hen = setTimeout(guiHoSoNeuDu, 800);
    }));
    // Rời khỏi ô là gửi luôn, không đợi hết 800ms.
    o().forEach((i) => i.addEventListener('blur', guiHoSoNeuDu));
    kiem();
    // Hồ sơ đổ sẵn từ lần trước đã đủ thì gửi luôn — khách có thể chuyển khoản
    // mà không chạm vào form lần nào.
    guiHoSoNeuDu();

    if (nut) nut.onclick = () => {
      const dl = {};
      o().forEach((i) => { dl[i.dataset.o] = i.value.trim(); });
      dl.loaiHoaDon = loaiHoaDon;
      dl.chuKy = chuKyId;
      dl.soTien = tinh().tong;
      dl.noiDung = qr.noiDung;
      // Mã đơn do máy chủ cấp lúc dựng QR — PHẢI kèm, nếu không màn "chờ tiền
      // về" không có gì để hỏi và quay mãi mãi (đơn vẫn được webhook đánh dấu
      // paid nhưng cửa sổ này không bao giờ biết).
      dl.orderId = qr.orderId || null;
      // Lưu hồ sơ hoá đơn để lần sau đổ sẵn — không chặn luồng, lỗi thì kệ.
      // Đây cũng là ĐƯỜNG DUY NHẤT dữ liệu hoá đơn tới máy chủ: `taoDon` lúc
      // dựng QR chưa có form, nên phải gửi riêng ở bước bấm này.
      if (api.billing && api.billing.save) {
        const hd = {
          ten: dl.ten, sdt: dl.sdt, email: dl.email, tinh: dl.tinh,
          phuong: dl.phuong, diachi: dl.diachi, ma: dl.ma, loaiHoaDon,
        };
        Promise.resolve(api.billing.save(hd)).catch(() => {});
      }
      xacNhan(dl);
    };
  }

  /** Vẽ lại nhưng GIỮ nguyên những gì người dùng đã gõ. */
  /** Hàm `kiem()` của lần vẽ gần nhất — xem chú thích chỗ gán. */
  let kiemHienTai = null;

  function giuOApaint() {
    // Màn đã đóng giữa lúc chờ mạng (bấm × hay mở lại trang trong khi đang đặt
    // đơn) thì `el` là null — vẽ tiếp là ném "Cannot read properties of null".
    if (!el) return;
    const giu = {};
    el.querySelectorAll('input[data-o]').forEach((i) => { giu[i.dataset.o] = i.value; });
    paint();
    // Theo hồ sơ: ô chỉ đọc, giá trị lấy từ hồ sơ — khôi phục chữ cũ là đè mất dữ liệu vừa sửa ở bảng hồ sơ.
    if (!theoHoSo()) {
      el.querySelectorAll('input[data-o]').forEach((i) => {
        if (giu[i.dataset.o]) i.value = giu[i.dataset.o];
      });
    }
    // ⚠ Trước đây chỗ này tự tính lại `disabled` và CHỈ nhìn các ô nhập. Điền đủ
    // form rồi đổi chu kỳ một cái là nút "Đã thanh toán" sáng lên dù chưa có mã
    // QR nào — bấm vào thì chẳng có đơn nào để dò tiền. `kiem()` mới là chỗ biết
    // đủ điều kiện, gọi thẳng nó.
    if (kiemHienTai) kiemHienTai();
  }

  /**
   * Chờ tiền về. KHÔNG có ai đối soát tay: webhook ngân hàng bắn về máy chủ,
   * máy chủ khớp mã CK rồi cộng hạn. Ở đây chỉ hỏi lại đơn cho tới khi `paid`.
   */
  function xacNhan(dl) {
    el.querySelector('.co-hop').innerHTML = `
      <button class="co-x" type="button" data-dong aria-label="Đóng">×</button>
      <h2>Đang chờ tiền về…</h2>
      <div class="co-cot" style="max-width:560px;margin:0 auto">
        <div class="co-dong lon"><span>Số tiền</span><span>${tien(dl.soTien)}${esc(cfg.donVi)}</span></div>
        <div class="co-dong"><span>Nội dung CK</span><span class="co-nh-gt">${esc(dl.noiDung)}</span></div>
        <div class="co-cho" id="co-cho">
          <span class="co-quay"></span> Hệ thống tự nhận biến động số dư. Gói sẽ lên ngay khi tiền về.
        </div>
        <div class="co-luat" style="margin-top:14px">
          Chuyển khoản xong cứ để cửa sổ này mở. Quá 15 phút chưa thấy thì kiểm tra
          lại <b>nội dung chuyển khoản</b> có đúng mã ở trên không, rồi liên hệ
          ${esc(cfg.lienHe || '')}.
        </div>
      </div>`;
    el.querySelector('[data-dong]').onclick = dong;
    if (dl.orderId) {
      doiTienVe(dl.orderId);
    } else {
      // Không có mã đơn = chưa đăng nhập lúc dựng QR. Không thể tự dò tiền về;
      // đừng để spinner quay vô nghĩa — nói thẳng phải đăng nhập.
      const box = el.querySelector('#co-cho');
      if (box) {
        box.classList.remove('xong');
        box.innerHTML = '⚠ Cần <b>đăng nhập</b> để hệ thống tự nhận tiền và nâng gói. '
          + 'Hãy đăng nhập rồi quay lại thanh toán.';
      }
    }
  }

  async function doiTienVe(orderId) {
    const het = Date.now() + 15 * 60 * 1000;
    while (Date.now() < het && el) {
      await new Promise((r) => setTimeout(r, 5000));
      if (!el) return;
      let d;
      try { d = await api.plans.checkOrder(orderId); } catch { continue; }
      if (d && d.status === 'paid') {
        const box = el.querySelector('#co-cho');
        if (box) {
          box.classList.add('xong');
          box.textContent = '✓ Đã nhận tiền. Gói của bạn đã được nâng cấp.';
        }
        const h2 = el.querySelector('h2');
        if (h2) h2.textContent = 'Nâng cấp thành công ✓';
        // Tô lại nút tài khoản để gói mới hiện ra ngay.
        if (window.__beeAuth) window.__beeAuth.lamMoi();
        return;
      }
    }
    // Hết 15 phút mà vẫn chưa thấy: DỪNG spinner và nói rõ phải làm gì — để
    // quay mãi là dấu hiệu "app treo" trong mắt người dùng.
    if (!el) return;
    const box = el.querySelector('#co-cho');
    if (box) {
      box.classList.remove('xong');
      box.innerHTML = '⏱ Chưa nhận được tiền sau 15 phút. Kiểm tra lại <b>nội dung '
        + 'chuyển khoản</b> có đúng mã ở trên, hoặc liên hệ ' + esc(cfg.lienHe || 'hỗ trợ')
        + '. Gói sẽ tự lên khi tiền về — bạn có thể đóng cửa sổ này.';
    }
  }

  // Nhấn Esc = đóng/quay lại. Giữ tham chiếu để gỡ đúng listener khi đóng.
  function onEsc(e) { if (e.key === 'Escape') dong(); }

  function dong() {
    document.removeEventListener('keydown', onEsc);
    if (el) { el.remove(); el = null; }
    // Ở chế độ TRANG, đóng = quay lại trang Nâng cấp (giới thiệu gói), không để
    // trống một trang trắng.
    const veTrang = trangMount;
    trangMount = null;
    // Trang giới thiệu gói đã gộp vào chính trang này, nên đóng = về Dựng video
    // (chỗ người dùng đang làm việc), không phải quay lại một trang đã bỏ.
    if (veTrang && window.__beePages) window.__beePages.moTrang('render');
  }

  /** Container của chế độ TRANG; null nghĩa là đang mở kiểu popup. */
  let trangMount = null;

  let hoSoBee = null;                     // { linked, personal, invoice } của Bee Account — null = chưa nối / lỗi
  let hoSoLoi = false;                    // gọi hồ sơ Bee Account LỖI (khác "đã tải nhưng chưa nối")
  let daDangNhap = false;                 // trang Nâng cấp mở được cả khi chưa đăng nhập (pages.js)
  let hoSoDaGui = '';                     // billing_json đã gửi (chống PUT lặp mỗi lần vẽ lại — soát 29/09/2026)
  let emailTK = '';                       // email tài khoản — dự phòng cho ô email
  let nhapTay = { cccd: {}, mst: {} };    // CHƯA nối: chữ đã gõ, TÁCH theo loại hoá đơn

  /** Loại mặc định theo hồ sơ: đã tick "xuất theo doanh nghiệp" + đủ tên + MST ⇒ Công ty; còn lại Cá nhân. */
  function loaiTheoHoSo(data) {
    const i = (data && data.invoice) || {};
    return i.invoiceType === 'BUSINESS' ? 'mst' : 'cccd';
  }

  /**
   * Hồ sơ Bee Account → ô form thanh toán THEO LOẠI được chọn (không phải loại hồ sơ tick): khách đổi sang "Công
   * ty" ở đây thì thấy dữ liệu công ty, đổi lại "Cá nhân" thì thấy họ tên + CCCD.
   * Tỉnh/phường là ô CHỮ ⇒ đổi mã sang tên bằng bộ dữ liệu của ho-so.js.
   */
  function hoSoBeeChoThanhToan(data, email, loai) {
    if (!data || !data.linked) return null;
    const p = data.personal || {};
    const i = data.invoice || {};
    const dc = window.__beeHoSo && window.__beeHoSo.tenDiaChi
      ? window.__beeHoSo.tenDiaChi(p.cityId, p.districtId) : { tinh: '', phuong: '' };
    // Email: CÁ NHÂN = email tài khoản (email đăng nhập); CÔNG TY = "Email nhận HĐ" khai trong hồ sơ doanh nghiệp
    // (chưa khai thì lùi về email tài khoản để hoá đơn vẫn có nơi gửi).
    if (loai === 'mst') {
      // SĐT DN là ô TUỲ CHỌN trong hồ sơ ⇒ chưa khai thì lấy SĐT cá nhân (như buyerInfo của Bee Platform) —
      // đừng để thiếu một ô tuỳ chọn mà khoá nút "Đã thanh toán" / không lưu được billing (soát 28/09).
      return { loaiHoaDon: 'mst', ten: i.companyName || '', ma: i.taxCode || '', email: i.invoiceEmail || email || '',
        sdt: i.companyPhone || p.phone || '', diachi: i.companyAddress || '' };
    }
    return { loaiHoaDon: 'cccd', ten: p.fullName || '', ma: p.idNumber || '', email: email || '', sdt: p.phone || '',
      tinh: dc.tinh, phuong: dc.phuong, diachi: p.streetAddress || '' };
  }

  /** Chưa nối Bee Account: cất chữ đang gõ của loại hiện tại trước khi đổi loại. */
  function luuNhapTay() {
    if (!el || theoHoSo()) return;
    const bo = (nhapTay[loaiHoaDon] = nhapTay[loaiHoaDon] || {});
    el.querySelectorAll('input[data-o]').forEach((i) => { bo[i.dataset.o] = i.value; });
  }

  // Bảng hồ sơ vừa lưu (ho-so.js) ⇒ màn thanh toán đang mở vẽ lại với dữ liệu mới.
  window.addEventListener('bee-ho-so-doi', (e) => {
    if (!el || !e.detail) return;
    hoSoBee = e.detail;
    hoSoLoi = false;
    // Vừa tick "xuất theo doanh nghiệp" trong bảng hồ sơ ⇒ chuyển hẳn sang hoá đơn công ty.
    if (khoaCongTy()) loaiHoaDon = 'mst';
    if (!el.querySelector('input[data-o]')) return;   // đang ở màn "chờ tiền về", không có form
    giuOApaint();
  });

  async function mo(opts = {}) {
    style();
    if (!cfg) cfg = await api.plans.get();
    if (!cfg || !cfg.goi || !cfg.goi.length) return;
    // Hỏi giá THẬT trước khi vẽ: có thế mới biết tài khoản này còn ưu đãi lần
    // đầu hay không, và hiện đúng con số máy chủ sẽ ghi vào đơn.
    try { giaMayChu = await api.plans.bangGia(); } catch { giaMayChu = null; }
    emailTK = '';
    hoSoBee = null;
    hoSoLoi = false;
    nhapTay = { cccd: {}, mst: {} };
    try {
      const st = await api.auth.state();
      thueBao = (st && st.subscription) || null;
      emailTK = (st && st.user && st.user.email) || '';
      daDangNhap = !!(st && st.user);
    } catch { thueBao = null; daDangNhap = false; }
    // Đổ sẵn "Thông tin xuất hoá đơn" (28/09/2026): hồ sơ người mua DÙNG CHUNG ở Bee Account trước (khai ở Bee
    // Platform / Bee Project / tab Thông tin của app là có ở đây), `billing_json` riêng của Studio lấp chỗ còn
    // trống, email tài khoản cho ô email. Không có / lỗi thì bỏ qua, form trống như cũ.
    try {
      const [r, hs] = await Promise.all([
        api.billing && api.billing.get ? api.billing.get().catch(() => null) : null,
        api.profile && api.profile.get ? api.profile.get().catch(() => null) : null,
        window.__beeHoSo && window.__beeHoSo.napDiaChi ? window.__beeHoSo.napDiaChi().catch(() => null) : null,
      ]);
      /* ⚠ IPC `billing:get` trả THẲNG hồ sơ, KHÔNG bọc `{ billing }` (ipc/account.js). Bản trước đọc `r.billing`
         ⇒ luôn null ⇒ form thanh toán CHƯA BAO GIỜ đổ sẵn được. Nhận cả hai dạng cho chắc. */
      hoaDonLuu = r && typeof r === 'object' ? ((r.billing && typeof r.billing === 'object') ? r.billing : r) : null;
      hoSoBee = hs && hs.ok && hs.data && hs.data.linked ? hs.data : null;
      hoSoLoi = !(hs && hs.ok);
      if (hoSoBee) loaiHoaDon = loaiTheoHoSo(hoSoBee);
      else if (hoaDonLuu && (hoaDonLuu.loaiHoaDon === 'cccd' || hoaDonLuu.loaiHoaDon === 'mst')) {
        loaiHoaDon = hoaDonLuu.loaiHoaDon;
      }
    } catch { hoaDonLuu = null; hoSoBee = null; hoSoLoi = true; }
    // KHÔNG gọi taoLaiQR() ở đây — mở màn không phải là đặt đơn. Xem chú thích
    // ở chỗ khai báo `daBamTao`.
    qr = { anh: '', noiDung: '', coMaNguoiDung: false };
    daBamTao = false;
    dangChay = 0;
    // Tăng số lượt để mọi lệnh đặt đơn của LẦN MỞ TRƯỚC còn đang bay không ghi
    // được kết quả vào màn mới — mở lại trang giữa lúc mạng chậm là gặp.
    luotQR += 1;
    /* ⚠ PHẢI xoá `trangMount` TRƯỚC khi dọn bản cũ.
     *
     * `dong()` kết thúc bằng `moTrang('render')` khi đang ở chế độ trang — đúng
     * với người bấm dấu ×, nhưng ở đây ta đang MỞ LẠI chính trang này, và
     * `moTrang('thanhtoan')` vừa bỏ `hidden` xong ngay trước khi gọi vào đây.
     * Không xoá thì lượt dọn này lật `hidden` về, mở lần hai ra trang trắng —
     * mà lần một vẫn tốt nên rất dễ tưởng là chạy được. */
    trangMount = null;
    if (el) dong();
    trangMount = opts.trang || null;
    el = document.createElement('div');
    el.id = 'bee-checkout';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Thanh toán nâng cấp gói');
    document.addEventListener('keydown', onEsc);
    if (trangMount) {
      el.classList.add('la-trang');
      trangMount.replaceChildren(el);
    } else {
      document.body.appendChild(el);
    }
    paint();
    // Ở chế độ trang, nút đóng là "quay lại" — đổi dấu × thành mũi tên cho rõ.
    if (trangMount) {
      const x = el.querySelector('.co-x');
      if (x) { x.textContent = '←'; x.title = 'Quay lại'; x.setAttribute('aria-label', 'Quay lại'); }
    }
  }

  window.__beeCheckout = { mo };
})();
