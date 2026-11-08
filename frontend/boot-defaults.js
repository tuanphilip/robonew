'use strict';
// Giá trị mặc định cho ba biến mà preload bơm vào từ settings của người dùng.
//
// Bản trích ra từ web_server.py có sẵn đường dẫn máy người viết
// ("D:\\Beeknoee\\...\\slide") và tên một deck cụ thể. Để nguyên thì bản cài
// trên máy người khác trỏ vào thư mục không tồn tại và cố mở một deck không có
// — trong khi mốc đi/dừng là "người ngoài cài không cần hướng dẫn".
//
// ⚠ Vì sao nằm ở FILE RIÊNG chứ không còn là <script> nội tuyến: trang này có
// Content-Security-Policy `script-src 'self'`. Còn một thẻ script nội tuyến là
// phải mở `'unsafe-inline'` cho toàn trang — mất gần hết giá trị của CSP.
//
// ⚠ VÌ SAO PHẢI try/catch: preload định nghĩa các biến này là CHỈ ĐỌC. Thẻ
// script nội tuyến cũ chạy ở chế độ lỏng nên phép gán đè lên thuộc tính chỉ đọc
// chỉ âm thầm trượt; file riêng này chạy 'use strict' nên nó NÉM TypeError và
// chặn luôn các dòng sau. Đã dính thật lúc chuyển ra file — chỉ đặt mặc định
// khi biến còn TRỐNG, và bọc lại phòng khi preload đã khoá.
(function () {
  function dat(ten, giaTri) {
    try {
      if (window[ten] === undefined || window[ten] === null) window[ten] = giaTri;
    } catch (e) {
      // preload đã khoá sẵn = đã có giá trị thật, không cần mặc định nữa.
    }
  }
  dat('__PROJECTS__', []);
  dat('__PROJECT_SOURCE_ROOT__', '');
  var dauTien = window.__PROJECTS__ && window.__PROJECTS__[0];
  dat('__INITIAL_PROJECT__', (dauTien && dauTien.name) || '');
})();
