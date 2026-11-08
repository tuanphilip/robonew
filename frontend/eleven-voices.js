'use strict';
/**
 * Giọng ElevenLabs gợi ý sẵn — hiện trong ô chọn NGAY, không cần API key.
 *
 * Vì sao có file này dù đã hỏi được `/v1/voices`: danh sách từ API chỉ về khi
 * đã lưu khoá, mà lúc mới cài thì chưa có khoá — ô chọn trống trơn và người
 * dùng không biết dán gì vào.
 *
 * ⚠ HAI NHÓM, KHÁC NHAU VỀ BẢN CHẤT — đừng trộn:
 *
 *   TIẾNG VIỆT  — lấy từ Voice Library của cộng đồng ElevenLabs. Đây mới là
 *   thứ đọc tiếng Việt ra tiếng Việt. NHƯNG giọng Voice Library thường phải
 *   "Add to my voices" trong tài khoản trước thì API mới nhận; chưa thêm mà gọi
 *   thẳng thì trả lỗi voice not found. Ghi rõ trong nhãn để người dùng biết
 *   đường xử lý thay vì ngồi đoán.
 *
 *   DỰNG SẴN     — bộ "Default voices" mọi tài khoản đều có, dùng được ngay,
 *   nhưng TẤT CẢ đều là giọng gốc tiếng Anh. Model đa ngữ đọc được tiếng Việt
 *   nhưng có accent. Để sau, làm phương án dự phòng.
 *
 * ⚠ Nguồn ID: nhóm dựng sẵn đối chiếu HAI nguồn độc lập, trùng khớp. Nhóm
 * tiếng Việt lấy từ một nguồn tổng hợp (json2video) — chưa đối chiếu chéo
 * được, nên coi là gợi ý, không phải bảo chứng. Đừng thêm ID mới vào đây nếu
 * chưa kiểm: chọn phải một ID chết là nhận lỗi giữa lúc tạo video.
 */
window.__BEE_ELEVEN_VOICES__ = [
  {
    nhom: 'Tiếng Việt (Voice Library — có thể phải thêm vào tài khoản trước)',
    ds: [
      // ĐỂ ĐẦU: đây chính là "giọng Nhật" mà cấu hình cũ ghi là mặc định.
      { voice_id: '6adFm46eyy74snVn6YrT', name: 'Nhật', mo_ta: 'nam · Bắc · rõ chữ, bản tin & phóng sự' },
      { voice_id: 'XBDAUT8ybuJTTCoOLSUj', name: 'MC Anh Đức', mo_ta: 'nam · Hà Nội · podcast, thuyết minh' },
      { voice_id: 'HG0MlJIknmaXREpTckfK', name: 'Tuấn Anh', mo_ta: 'nam · Bắc · trầm, chắc, thuyết minh' },
      { voice_id: 'RxhjHDfpO54FYotYtKpw', name: 'Phong', mo_ta: 'nam · Bắc · ấm, kể chuyện & podcast' },
      { voice_id: 'jdlxsPOZOHdGEfcItXVu', name: 'Hiền', mo_ta: 'nữ · Hà Nội · giọng dẫn chuyên nghiệp' },
      { voice_id: 'ArosID24mP18TEiQpNhs', name: 'Trang', mo_ta: 'nữ · Bắc · ấm, đáng tin, thuyết minh' },
      { voice_id: 'd5HVupAWCwe4e6GvMCAL', name: 'Mai', mo_ta: 'nữ · Hà Nội · tự nhiên, tươi sáng' },
      { voice_id: 'Si3s1VCb7dLbeqH57kiC', name: 'Quỳnh Anh', mo_ta: 'nữ · trẻ · giọng đọc bản tin' },
      { voice_id: '9OkfZUfSSXvew1flIzTP', name: 'Henry', mo_ta: 'nam · Nam · thân thiện, bản tin & quảng cáo' },
      { voice_id: 'N0Z0aL8qHhzwUHwRBcVo', name: 'Thanh', mo_ta: 'nữ · Sài Gòn · bản tin, sách nói' },
      { voice_id: '8vnoQ76hEPzk19VcdqZ7', name: 'Hoàng Anh', mo_ta: 'nam · Nam · trò chuyện, podcast' },
      { voice_id: 'JxmKvRaNYFidf0N27Vng', name: 'Sơn Trần', mo_ta: 'nam · Trung · trẻ, sách nói' },
    ],
  },
  {
    nhom: 'Dựng sẵn (gốc tiếng Anh — đọc tiếng Việt sẽ có accent)',
    ds: [
      { voice_id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', mo_ta: 'nam · Anh · ấm, kể chuyện' },
      { voice_id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', mo_ta: 'nam · Mỹ · trầm, kể chuyện' },
      { voice_id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', mo_ta: 'nam · Anh · dứt khoát, bản tin' },
      { voice_id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', mo_ta: 'nam · Mỹ · trẻ, rõ chữ' },
      { voice_id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', mo_ta: 'nữ · Mỹ · biểu cảm' },
      { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', mo_ta: 'nữ · Mỹ · nhẹ, bản tin' },
      { voice_id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', mo_ta: 'nữ · Anh · chắc, bản tin' },
      { voice_id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', mo_ta: 'nữ · Anh · ấm, kể chuyện' },
    ],
  },
];
