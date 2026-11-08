'use strict';
/**
 * Màn hình cài đặt lần đầu — tải mô hình nhận dạng giọng nói.
 *
 * Vì sao có màn này (DESKTOP_PACKAGING_SIGNING.md §4): model faster-whisper-base
 * là 148 MB trọng số int8, **nén gần như không xuống**. Bundle vào bộ cài thì
 * mỗi bản cập nhật lại đẩy thêm 148 MB cho từng người dùng, trong khi file này
 * gần như không bao giờ đổi. Nên tách ra, tải một lần.
 *
 * ⚠ THỰC TẾ MẠNG VN (đo 2026-08-02, xem HANDOFF §5):
 *   - hf-mirror.com nay 308-redirect mọi thứ về huggingface.co → không còn là mirror
 *   - CDN LFS của HuggingFace (us.aws.cdn.hf.co) KHÔNG kết nối được
 * Nghĩa là cả hai nguồn công khai đều chết. Khi chưa có CDN riêng, nút
 * "Nhập từ file" mới là đường đi được — nên nó phải hiện ngang hàng với nút
 * tải, không giấu trong phần nâng cao.
 */
(function () {
  const api = window.beeknoee;
  if (!api || !api.models) return;

  const MB = 1024 * 1024;
  const fmt = (b) => `${(b / MB).toFixed(1)} MB`;

  /**
   * Gỡ phần vỏ mà ipcRenderer.invoke bọc quanh lỗi.
   * Nguyên văn nó trả về: "Error invoking remote method 'models:download': Error: <thật>".
   * Đã mất công làm cho thông báo lỗi tải model nói đúng nguyên nhân (SAI
   * CHECKSUM vs lỗi mạng) thì đừng để cái vỏ này che mất dòng đầu.
   */
  const clean = (msg) => String(msg || '')
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');

  let el = null;
  let unsub = null;

  function style() {
    if (document.getElementById('bee-firstrun-style')) return;
    // CSS của module này nằm ở css/first-run.css (tách 02/09/2026, nạp bằng <link> trong index.html).
  }

  function render() {
    el = document.createElement('div');
    el.id = 'bee-firstrun';
    el.innerHTML = `
      <div class="card">
        <h2>Cài đặt lần đầu</h2>
        <div class="sub">Beeknoee Studio cần mô hình nhận dạng giọng nói để cắt slide theo lời đọc.
          Tải một lần, những lần sau dùng lại.</div>
        <ul class="steps">
          <li class="done" data-s="env"><span class="m">✓</span><span>Kiểm tra môi trường</span></li>
          <li class="active" data-s="dl"><span class="m">○</span><span>Tải mô hình nhận dạng giọng nói (148 MB)</span></li>
          <li data-s="sum"><span class="m">○</span><span>Kiểm checksum SHA256</span></li>
        </ul>
        <div class="bar"><i></i></div>
        <div class="meta">Chưa bắt đầu</div>
        <div class="row">
          <button class="primary" data-a="dl">Tải mô hình</button>
          <button data-a="import">Nhập từ file…</button>
          <button class="skip" data-a="skip">Để sau</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    el.querySelector('[data-a="dl"]').onclick = doDownload;
    el.querySelector('[data-a="import"]').onclick = doImport;
    el.querySelector('[data-a="skip"]').onclick = close;
  }

  const q = (s) => el && el.querySelector(s);
  const setMeta = (t) => { const m = q('.meta'); if (m) m.textContent = t; };
  const setBar = (p) => { const b = q('.bar>i'); if (b) b.style.width = `${Math.max(0, Math.min(100, p))}%`; };

  function step(name, state) {
    const li = q(`[data-s="${name}"]`);
    if (!li) return;
    li.className = state;
    li.querySelector('.m').textContent = state === 'done' ? '✓' : (state === 'active' ? '⟳' : '○');
  }

  function showError(msg) {
    let box = q('.err');
    if (!box) {
      box = document.createElement('div');
      box.className = 'err';
      q('.card').appendChild(box);
    }
    box.textContent = msg;
  }

  function busy(on) {
    for (const b of el.querySelectorAll('button')) {
      if (b.dataset.a !== 'skip') b.disabled = on;
    }
  }

  async function doDownload() {
    busy(true);
    const old = q('.err');
    if (old) old.remove();
    step('dl', 'active');
    setMeta('Đang kết nối…');

    unsub = api.models.onProgress((p) => {
      const total = p.bytesTotal || 1;
      const done = p.bytesDone || 0;
      setBar((done / total) * 100);
      const src = p.source ? `\nNguồn: ${p.source}` : '';
      setMeta(`${p.message || ''}  ${fmt(done)} / ${fmt(total)}${src}`);
    });

    try {
      const r = await api.models.download('base');
      step('dl', 'done');
      step('sum', 'done');   // download() chỉ trả về khi MỌI file đã khớp SHA256
      setBar(100);
      setMeta(`Xong. Model ở: ${r.path}`);
      setTimeout(close, 900);
    } catch (e) {
      step('dl', '');
      showError(
        `${clean(e.message)}\n\n` +
        'Gợi ý: nếu mạng ở Việt Nam chặn huggingface.co, dùng nút "Nhập từ file…" ' +
        'với thư mục faster-whisper-base chép từ máy khác.'
      );
      setMeta('Tải thất bại');
    } finally {
      if (unsub) { unsub(); unsub = null; }
      busy(false);
    }
  }

  async function doImport() {
    busy(true);
    const old = q('.err');
    if (old) old.remove();
    setMeta('Đang kiểm file…');
    try {
      const r = await api.models.importFromFile();
      if (!r) { setMeta('Đã huỷ'); return; }
      step('dl', 'done');
      step('sum', 'done');
      setBar(100);
      setMeta(`Đã nhập, checksum khớp (${r.verified.length} file). ${r.path}`);
      setTimeout(close, 900);
    } catch (e) {
      showError(clean(e.message));
      setMeta('Nhập thất bại');
    } finally {
      busy(false);
    }
  }

  function close() {
    if (unsub) { unsub(); unsub = null; }
    if (el) { el.remove(); el = null; }
  }

  async function boot() {
    try {
      const st = await api.models.status();
      if (st && st.ready) return;   // đã có model — không làm phiền
      style();
      render();
    } catch (e) {
      // Sidecar chưa lên thì im lặng bỏ qua: giao diện chính vẫn dùng được,
      // và system.health sẽ báo lỗi ở chỗ của nó.
      console.warn('[first-run] không đọc được trạng thái model:', e.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
