# Nguồn — Case study kinh doanh (KD-01)

Deck mẫu đi kèm Beeknoee Studio. Case: **dây chuyền lắp ráp di động của Ford
Motor Company, nhà máy Highland Park, 1913–1914**.

## Vì sao chọn case này

* **Số liệu trước–sau gắt và được ghi chép kỹ**: giờ công một khung xe, giá
  bán, tỉ lệ bỏ việc — đều có nguồn độc lập.
* **Ảnh thật đã hết bản quyền**: ảnh nhà máy 1913–1914 và catalogue 1911 đều
  thuộc phạm vi công cộng. Case hiện đại (Apple, Netflix, Toyota…) thì ảnh và
  logo đều có chủ — không đóng gói vào bộ cài được.
* **Bài học chuyển được sang doanh nghiệp nhỏ**: "đưa việc tới người" áp dụng
  được cho một tiệm, một xưởng, một shop online.

⚠ Deck cố ý **không dùng logo Ford**. Hình quảng cáo năm 1908 có sẵn trên
Commons (phạm vi công cộng về bản quyền) nhưng mang chữ ký "Ford" — vẫn là
nhãn hiệu đang dùng. Tên công ty thì nêu bình thường, như mọi bài phân tích.

## Tám hình: nguồn và giấy phép

Tất cả tải từ Wikimedia Commons, giấy phép đọc bằng trường `LicenseShortName`
của API, **ngày chụp đọc bằng `DateTimeOriginal`** — không suy từ tên tệp.
**Cả tám đều thuộc phạm vi công cộng.**

| Tệp | Tệp gốc trên Commons | Ngày | Tác giả / nguồn |
|---|---|---|---|
| `k0-bia.jpg` | *AssemblyLine.jpg* — thả thân xe xuống khung | 1913 | không rõ |
| `k1-day-chuyen.jpg` | *Assembly line at the Ford Motor Company's Highland Park plant* | 1913 | Library of Congress |
| `k2-magneto.jpg` | *Ford assembly line - 1913 (restored).jpg* — dây chuyền magneto | 1913 | không rõ |
| `k3-doi-ca.jpg` | *Change of work shift at Ford Motor Company.jpg* | thập niên 1910 | Detroit Publishing Company |
| `k4-catalogue.jpg` | *1911 Ford Catalog - Model T Open Runabout.png* | 1911 | Ford Motor Company (catalogue) |
| `k4-gia.jpg` | cắt từ chính trang catalogue trên, phóng 4× | 1911 | như trên |
| `k5-mui-tran.jpg` | *Ford Roadster LCCN2016850280.jpg* — phim kính | 1925 | National Photo Company · Library of Congress |
| `k6-sach-1915.jpg` | Trang 161 sách *Ford Methods and the Ford Shops* — Internet Archive `fordmethodsandf00faurgoog`, ghi `NOT_IN_COPYRIGHT` | 1915 | H. L. Arnold & F. L. Faurote |

### Ảnh đã loại, và lý do

* *Model T's coming off the assembly line at the Highland Park plant* (LOC) —
  trường ngày ghi **1900**, sai rõ ràng (Model T ra đời 1908, Highland Park mở
  1910). Ảnh có thể đúng, nhưng siêu dữ liệu hỏng thì không dùng làm tư liệu.
* *1908 Ford Model T.jpg* — quảng cáo mang chữ ký logo Ford (xem trên).
* Ảnh xe Model T chụp ở bảo tàng năm 2013–2016 — xe thật nhưng ảnh hiện đại,
  lẫn biển tên và xe khác xung quanh.

### ⚠ Ảnh thẻ 3 là minh hoạ đúng thời, không phải đúng ngày

`k3-doi-ca.jpg` chụp thợ Ford tan ca ở Detroit **trong thập niên 1910**, không
xác định được là trước hay sau ngày 5/1/1914. Chú thích trên slide ghi đúng
như vậy (*"Thợ Ford tan ca · Detroit, thập niên 1910"*), không nói đó là cảnh
nhận lương 5 đô.

## Dữ kiện và nơi tra

| Dữ kiện trên slide | Xác nhận |
|---|---|
| Khâu lắp magneto chia cho **29 người**, **20 phút → 5 phút** (4/1913) | Wikipedia "April 1913" · Assembly Magazine |
| Dây chuyền khung xe chạy từ **7/10/1913**; cả nhà máy chạy dây chuyền từ 1/12/1913 | History.com · Library of Congress |
| Khung xe: **12 giờ 28 phút** công (lắp tại chỗ, **tháng 9/1913**) → **1 giờ 33 phút** công (**30/4/1914**) | **nguồn gốc: Arnold & Faurote (1915), tr. 161** — đoạn trích `k6` in trên slide |
| Ngày 30/4/1914: **1.212 khung xe** trong một ngày 8 tiếng, trên ba dây chuyền | như trên |
| Lương **5 đô/ngày** từ **5/1/1914**, gấp đôi mức cũ | The Henry Ford |
| Tỉ lệ bỏ việc **370%** năm 1913 → **16%** sau một năm | The Henry Ford (bài *Ford's Five-Dollar Day*) |
| Catalogue 1911: Open Runabout **$680** đủ trang bị, **$600** không trang bị | **chính trang catalogue `k4`** — in ngay trên hình |
| Giá niêm yết bản mui trần **$260** từ 12/1923, kéo sang 1924–1925 | MTFCA · Model T Ford Fix · Wikipedia (Ford Model T) |
| **2.011.125** chiếc Model T năm 1923 — **không tính Canada** | MTFCA Model T Encyclopedia (1923) · Best Selling Cars Blog |
| *"Một chiếc ô tô cho số đông"* | Henry Ford, *My Life and Work* (1922) |
| *"…đưa việc tới người, thay vì đưa người tới việc"* | Henry Ford, *My Life and Work* (1922) — bản dịch |

### ⚠ Ba chỗ dễ sai — và cách deck xử lý

1. **"12,5 giờ → 93 phút" là GIỜ CÔNG, không phải thời gian trôi qua.** Nguồn
   gốc ghi *"12.5 man-hours to 93 man-minutes"*; nhiều bài viết lại chép thành
   "một chiếc xe mỗi 93 phút". Deck ghi rõ **giờ công** và giải thích ở dòng
   nguồn: *tổng thời gian của mọi người thợ cho một khung xe*.
2. **So giá phải cùng một loại xe.** Cặp số hay được trích *"$850 năm 1909 →
   $260 năm 1924"* là **hai loại xe khác nhau**: $850 là xe du lịch bốn chỗ,
   $260 là xe mui trần hai chỗ. Deck so **mui trần với mui trần**: $680 in trên
   catalogue 1911 → $260 niêm yết 1924. Cả hai đều **chưa có máy đề điện** (máy
   đề chỉ có từ 1919, và bản $260 là bản không máy đề) nên cùng cấu hình.
3. **Sản lượng theo năm không dùng làm biểu đồ.** Các nguồn trộn năm tài chính
   (từ 1914 bắt đầu ngày 1/8) với năm dương lịch, nên cùng một "năm 1914" mỗi
   nguồn một số. Deck chỉ nêu MỘT mốc sản lượng (năm 1923) trong phần chữ, kèm
   nguồn — không dựng cột trước–sau trên dữ liệu vênh.

> **Nguyên tắc của thể loại case study:** so sánh trước–sau phải **cùng đơn
> vị, cùng loại, cùng cấu hình**. Một cặp số lệch loại làm cả bài phân tích
> mất giá trị, dù từng con số riêng lẻ đều đúng.

## ⚠ Tìm được NGUỒN GỐC cho con số giờ công — và nguồn gốc có lỗi tính

Lượt soát lại lần theo con số "12,5 giờ → 93 phút" về tận gốc: sách *Ford
Methods and the Ford Shops* (Arnold & Faurote, 1915), trang 161. Tìm bằng API
tìm-trong-sách của Internet Archive, rồi **đọc trên bản quét chứ không tin bản
chữ nhận dạng (OCR)**. Đọc bằng mắt lộ ra hai điều:

1. OCR đọc **"1,219"** khung xe, bản quét in **"1,212"**. Deck dùng 1.212.
2. Sách viết *"12 hours 28 minutes"* rồi ngay câu sau *"93 minutes as against
   **728** minutes"* — nhưng 12 giờ 28 phút là **748** phút. **Chính nguồn gốc
   tự mâu thuẫn.** Không biết số nào đúng, nên deck:
   * hiện "12,5 giờ" (khớp 12 giờ 28 phút, con số được trích rộng rãi nhất);
   * chọn kết luận **"gấp tám lần"** — đứng vững với CẢ HAI số
     (748/93 = 8,0; 728/93 = 7,8);
   * cắt đoạn trích dừng trước dòng có "728", và ghi rõ chuyện này ở đây.

> **Chọn kết luận chịu được sai số của chính nguồn.** Khi hai con số trong
> cùng một tài liệu vênh nhau, đừng chọn đại một — hãy chọn phát biểu nào
> đúng với cả hai.

## ⚠ Phụ đề: một màu cho cả video — nên không slide nào được tối ở dải phụ đề

Khung hình thật trích từ video mẫu (mở `demo.mp4` trong trình duyệt, tua tới
giây cần xem, chụp — `ffmpeg` đóng gói trong app không có bộ mã hoá ảnh nào)
cho thấy slide 2 bản đầu: phụ đề mực navy trên nền navy, **tỉ lệ tương phản
1,0:1**, biến mất 6,7 giây. Mọi bộ soát bố cục đều ĐẠT. Sửa: khối tối dừng ở
y = 560, dải dưới trắng — cùng luật với ảnh bìa.

## Thay case khác

1. Thay ảnh trong `anh/` — đúng tên tệp. Đọc **ngày chụp** từng ảnh.
2. Sửa ba thẻ ở slide 3 và hai biểu đồ ở slide 4, 5 thẳng trong `index.html`.
   Mỗi cột khai `--cao` = giá trị ÷ giá trị lớn nhất của biểu đồ và số đích
   `--so-toi` / `--le-toi` — **tính bằng máy tính rồi dán**, đừng ước bằng mắt
   (xem `TEMPLATE_RULES.md` mục Biểu đồ).
3. Sửa **cả bảy dòng** `script-90s.txt` và `slides.scriptLines` trong
   `preview-settings.json`. Số trong lời thoại viết **bằng chữ**.
4. Giữ nhịp **3 / 1 / 3 / 2 / 2 / 2 / 2** phần tử mỗi slide.
5. Ghi nguồn, giấy phép, **ngày chụp** từng ảnh vào chính tệp này.
