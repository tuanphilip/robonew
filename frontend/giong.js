'use strict';
/**
 * BẢNG NGUỒN GIỌNG ĐỌC — một nơi duy nhất (02/09/2026, audit Phase 2.8).
 *
 * Trước đây cùng một ánh xạ nằm ở BA chỗ và phải sửa cả ba khi thêm một nguồn:
 *   - render-layout.js  mảng GIONG (nút hiển thị → engine/mode của bản cũ)
 *   - api-shim.js       chuỗi engine giao diện → engine mà main/pipeline hiểu
 *   - render/tts-panel.js  setEngine/currentElevenMode (trạng thái thật)
 * Nay hai chỗ đầu đọc từ đây; tts-panel giữ nguyên vì nó là NGUỒN trạng thái
 * (nút [data-engine].active + radio elevenMode), không phải bản sao ánh xạ.
 *
 * Mỗi nguồn giọng:
 *   key         tên nút hiển thị (data-giong)
 *   nhan / phu  chữ trên nút
 *   engine      giá trị [data-engine] của tab cũ trong index.html
 *   mode        radio elevenMode ('upload' | 'tts') hoặc null nếu engine không có mode
 *   icon        tên icon trong icons.js (`data-icon`) vẽ trước hai dòng chữ
 *   engineMain  engine mà main.js / pipeline.js / sidecar hiểu
 *   an          true = TẠM ẨN nút, KHÔNG xoá — đường xử lý phía sau vẫn còn nguyên
 *               (engine `edgetts`, pane, mã sidecar); bỏ `an` là nút hiện lại ngay.
 *
 * Nạp TRƯỚC api-shim.js (thẻ <script> đầu <head>) vì shim cần bảng này lúc
 * định tuyến /api/render.
 */
(() => {
  const GIONG = [
    { key: 'upload', nhan: 'Tải file', phu: 'Có sẵn file đọc', engine: 'elevenlabs', mode: 'upload', engineMain: 'upload', icon: 'upload' },
    { key: 'eleven', nhan: 'ElevenLabs', phu: 'Gọi API', engine: 'elevenlabs', mode: 'tts', engineMain: 'elevenlabs', icon: 'eleven' },
    /* Beeknoee Platform: engine riêng (xem tab 'Beeknoee AI' trong index.html),
       không có mode con — key/model/giọng nằm ở pane của nó. */
    { key: 'bee', nhan: 'Beeknoee AI', phu: 'Gọi API', engine: 'beeknoee', mode: null, engineMain: 'beeknoee', icon: 'bee' },
    { key: 'edge', nhan: 'Edge TTS', phu: 'Miễn phí', engine: 'edgetts', mode: null, engineMain: 'edge', an: true, icon: 'mic' },
    /* Giọng TRÊN MÁY (VieNeu-TTS, python/tts/vieneu.py): miễn phí, đọc không cần mạng — mô hình
       tải một lần ở pane của nó (render/vieneu-panel.js). */
    { key: 'maytinh', nhan: 'Trên máy', phu: 'Miễn phí', engine: 'vieneu', mode: null, engineMain: 'vieneu', icon: 'monitor' },
  ];

  /** Nút nào đang chọn, tính từ trạng thái thật (engine của tab + radio mode). */
  function keyTu(engine, mode) {
    const g = GIONG.find((x) => x.engine === engine && (x.mode === null || x.mode === mode))
      || GIONG.find((x) => x.engine === engine)
      || GIONG[0];
    return g.key;
  }

  /**
   * Engine cho main/pipeline từ cặp (engine giao diện, mode). Chuỗi engine từ
   * giao diện có thể là 'elevenlabs' / 'edgetts' / 'beeknoee' hoặc một biến thể
   * cũ ('eleven', 'bee'…) — khớp mềm để không gãy khi bản web cũ gửi tên khác.
   */
  function engineMainTu(engine, mode) {
    const e = String(engine || '').toLowerCase();
    if (/eleven/.test(e)) return mode === 'upload' ? 'upload' : 'elevenlabs';
    if (/^bee/.test(e)) return 'beeknoee';
    /* ⚠ PHẢI có trước dòng cuối: tên lạ rơi về 'edge' — thiếu dòng này thì chọn "Trên máy" mà
       video lặng lẽ đọc bằng Edge TTS, không báo gì. */
    if (/vieneu|maytinh/.test(e)) return 'vieneu';
    return 'edge';
  }

  window.__beeGiong = { GIONG, keyTu, engineMainTu };
})();
