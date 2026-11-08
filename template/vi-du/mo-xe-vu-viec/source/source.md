# Nguồn — Mổ xẻ một vụ việc (KC-01)

Deck mẫu đi kèm Beeknoee Studio. Vụ việc: **cầu Tacoma Narrows sập, 7/11/1940**,
bang Washington, Mỹ.

## ⚠ Vì sao lại là vụ này, sau khi bỏ một vụ khác

Bản dựng đầu tiên chọn **thảm hoạ khí cầu Hindenburg (1937)**. Ảnh đã tải về,
giấy phép sạch (phạm vi công cộng), bố cục đã lên. **Rồi mở ảnh ra nhìn và bỏ
toàn bộ**: mọi ảnh tư liệu chụp LZ 129 lúc còn nguyên vẹn đều có **chữ thập
ngoặc trên hai vây đuôi** — nó nằm ở cả hai mặt của cả hai vây ngang, không
cắt đi được mà vẫn còn là "con tàu".

Mẫu này **đóng gói vào bộ cài và khách hàng nhân bản nó ra để làm video của
họ**. Một biểu tượng Quốc xã đi theo từng bản sao là chuyện không chấp nhận
được, kể cả khi nó đúng về mặt lịch sử.

> **Quy tắc rút ra:** ảnh tư liệu lịch sử phải soi thêm một lớp nữa ngoài giấy
> phép — **biểu tượng chính trị, quân hiệu, cờ hiệu**. Giấy phép sạch không có
> nghĩa là đem phát hành được.

Vụ Tacoma Narrows hơn hẳn ở bốn điểm: **không ai chết**, không dính chính trị,
ảnh phạm vi công cộng có độ phân giải rất cao, và bài học kỹ thuật thì rõ ràng
— đúng chất "mổ xẻ".

## ⚠ Bản đầu dùng NHẦM CẦU cho ảnh bìa

Bản dựng đầu lấy ảnh bìa từ tệp HAER *"TACOMA NARROWS BRIDGE IN PERSPECTIVE
LOOKING WEST FROM THE MILLERS ADDITION SUBDIVISION"* — tên tệp **không ghi năm**,
nhìn thì đúng là cầu treo Tacoma Narrows, giấy phép sạch. Lượt soát lại mới đọc
trường **ngày chụp** (`DateTimeOriginal`) trong API Commons: **1993**, người chụp
Jet Lowe. Cây cầu 1940 đã nằm dưới đáy eo biển từ 53 năm trước đó — ảnh là
**cây cầu dựng lại, thông xe năm 1950**. Bìa ghi "Cầu Tacoma Narrows sập" đè lên
ảnh một cây cầu KHÁC, và lỗi đó đã lọt vào cả video mẫu lẫn ảnh bìa thư viện.

Sắp cả bộ ảnh HAER theo ngày chụp là lộ ngay: **mọi ảnh chụp năm 1993 đều là cầu
1950**. Ảnh thật của cầu 1940 chỉ có vài tấm, và đều ghi năm ngay trong tên
(*"29 AUGUST 1940"*, *"7 NOVEMBER 1940"*) vì HAER chụp lại từ tư liệu gốc.

> **Quy tắc rút ra:** công trình nào **từng được dựng lại** thì ảnh "cùng tên"
> rất có thể là công trình mới. **Đọc ngày chụp, đừng đọc tên.** Và ghi ngày
> chụp lên chính slide — deck giờ có dòng *"Ảnh chụp 29·8·1940, mười tuần
> trước khi sập"* ở góc bìa, nên ai thay ảnh cũng buộc phải tra ngày.

Ảnh HAER 1993 đó không bị vứt đi phí: nó chính là cầu 1950 — nhưng slide cuối
dùng **bản vẽ mặt cắt** thay vì ảnh ấy, vì bản vẽ cho thấy được CÁI ĐÃ ĐỔI.

## Sáu hình: nguồn và giấy phép

Tất cả tải từ Wikimedia Commons, giấy phép đọc bằng trường `LicenseShortName`
của API chứ không đoán. **Cả sáu đều là `Public domain`.** Ảnh HAER là tư liệu
khảo sát của chính phủ Mỹ (Historic American Engineering Record).

| Tệp | Tệp gốc trên Commons | Ngày chụp / vẽ | Cỡ gốc |
|---|---|---|---|
| `a0-nhip-cau.jpg` | *TACOMA NARROWS BRIDGE, LOOKING WEST ACROSS TOLL PLAZA, 29 AUGUST 1940* (HAER, bản chụp lại ảnh gốc) | **29/8/1940** | 5000×4037 |
| `a1-khanh-thanh.jpg` | *Opening day of the Tacoma Narrows Bridge, Tacoma, Washington.jpg* | 1/7/1940 | 768×606 |
| `a2-song-doc.jpg` | *VERTICAL OSCILLATIONS, 3-4 VIEW, 7 NOVEMBER 1940 …* (HAER WASH,27-TACO,11-33) | 7/11/1940 | 5000×3972 |
| `a3-xoan.jpg` | *VERTICAL AND TORSIONAL OSCILLATIONS, 3-4 VIEW, 7 NOVEMBER 1940 …* (HAER WASH,27-TACO,11-34) | 7/11/1940 | 5000×3999 |
| `a4-sap.jpg` | *Tacoma-narrows-bridge-collapse.jpg* | 7/11/1940 | 365×300 |
| `a5-mat-cau.png` | Tờ bản vẽ HAER WA-99, tờ 2/2 *"Tacoma Narrows Bridge 1940 · 1950"* — vẽ bởi Wolfgang G. Mayr, hè 1993 | 1993 (bản vẽ) | 17628×13632 |

### Cách xử lý từng hình

* **`a0`** — cắt bỏ khung giấy, dải nhãn HAER bên phải và dòng chữ viết tay
  ở đáy ảnh gốc; cắt tỉ lệ 16:9.
* **`a2`, `a3`** — khung phim có góc bo, viền trắng và **dòng chú thích tiếng
  Anh cháy sẵn trong khung**. Cắt sát vào phần hình, đo trên lưới toạ độ.
* **`a4`** — chỉ có bản 365×300, là **toàn bộ** những gì Commons có cho khoảnh
  khắc nhịp cầu rơi (đã tìm bằng bốn truy vấn khác nhau). Phóng lên bằng
  LANCZOS lúc chuẩn bị ảnh, hiển thị trong ô 376px, và cả năm ảnh đóng chung
  khung kiểu bản in báo (`.anh-bao`) để độ mềm đọc ra chất liệu.
* **`a5`** — tách hai hình trục đo *"1940 Bridge Roadway"* và *"1950 Bridge
  Roadway"* từ tờ bản vẽ. **Hai hình vẽ cùng tỉ lệ 1:96**, nên độ chênh kích
  thước trong hình là số liệu thật. Xoá tiêu đề tiếng Anh và đoạn văn lấn vào
  (nhãn tiếng Việt đặt bằng HTML), làm dày nét trước khi thu nhỏ, đổi sang nét
  ngà trên nền trong suốt, nén 64 màu: **35 KB** thay vì 318 KB, soi ở cỡ quay
  không phân biệt được.

### ⚠ Ghi công phim: Farquharson, KHÔNG phải Barney Elliott

Ngày 7/11/1940 có bốn người cùng quay: Walter Miles, Barney Elliott, T. Harbine
Monroe và **Giáo sư F. B. Farquharson (Đại học Washington)**. Chú thích HAER của
đúng hai khung dùng ở đây ghi rõ là phim của **Farquharson**.

> Cùng một bài học với tên tệp ảnh: **đọc chú thích gốc, đừng suy ra từ cái tên
> nổi tiếng nhất gắn với sự kiện.**

## Dữ kiện và nơi tra

| Dữ kiện trên slide | Xác nhận |
|---|---|
| Khánh thành **1/7/1940**; nhịp chính **2.800 ft ≈ 853 m**, dài thứ ba thế giới khi đó | WSDOT · Wikipedia |
| Biệt danh **"Galloping Gertie"** do chính thợ dựng đặt, ngay từ lúc lắp mặt cầu | WSDOT |
| **7:30 sáng** gió **38 mph ≈ 61 km/h**; hai tiếng sau **42 mph ≈ 68 km/h** ở đầu đông | KING5 · WSDOT |
| Một **vòng kẹp cáp giữa nhịp (cáp bắc)** trượt — mồi cho chuyển động xoắn | Journal of Fluid Mechanics |
| Xoắn ở **0,2 Hz**, có lúc nghiêng tới gần **45°** | Journal of Fluid Mechanics |
| Nhịp chính đứt rời **khoảng 11 giờ trưa** | Britannica · WSDOT |
| Nạn nhân **duy nhất**: Tubby, chó cocker spaniel đen ba chân, kẹt trong xe | Fox Weather · ASCE |
| Cơ chế thật là **rung xoắn khí động**, không phải cộng hưởng | Billah & Scanlan, *American Journal of Physics* 59(2), 1991 |
| Cầu dựng lại **thông xe 14/10/1950**, mặt cầu **giàn thép hở sâu 33 ft ≈ 10 m** | HistoryLink · Wikipedia · **chính bản vẽ HAER `a5`** |
| Mặt cầu 1940 là **dầm bản đặc sâu 8 ft ½ in ≈ 2,45 m** | **chính bản vẽ HAER `a5`** (số in trên hình) |
| Thiết kế mới được thử **200 cấu hình** trong hầm gió, 11/1943 – 1945 | Wikipedia (Tacoma Narrows Bridge 1950) · đoạn chữ trên tờ bản vẽ HAER |
| **1992** xác cầu vào Sổ bộ Di tích Quốc gia; phần chìm thành **rạn nhân tạo** | National Geographic · Atlas Obscura |

### ⚠ Chỗ các nguồn không khớp nhau — và cách deck xử lý

1. **Phút sập chính xác.** Nguồn ghi 11:00, 11:02, 11:10. Deck viết
   **"≈11:00 trưa"** và cả lời thoại cũng nói *"khoảng mười một giờ trưa"*.
2. **Chiều dài đoạn mặt cầu rơi.** Bản dựng đầu ghi *"một đoạn dài 180 m"*
   (từ con số 600 ft hay gặp). **Không xác minh được**, nên **đã bỏ hẳn**.
3. **Biên độ xoắn.** *"Amplitude up to 28 feet"* là biên độ của **một mép**,
   không phải chênh lệch giữa hai mép. Đã thay bằng **góc nghiêng ~45°**.
4. **"Mọi cầu dùng ngân sách liên bang Mỹ phải thử hầm gió".** Bản đầu dùng câu
   này (WSDOT viết vậy) làm gạch đầu dòng thứ hai. Phạm vi và thời điểm của quy
   định đó không tra ra được nguồn gốc, nên đã **thay bằng cây cầu dựng lại** —
   một hệ quả có số đo in ngay trên bản vẽ gốc.

> **Đây chính là nghề của thể loại "mổ xẻ vụ việc":** khi các nguồn vênh nhau
> thì **kể trình tự, đừng kể đồng hồ**, và **bỏ con số mình không tra được**
> thay vì để nó lại cho chắc bài.

## Thay vụ việc khác

1. Thay các hình trong `anh/` — **đúng tên tệp**. Ảnh bìa phải là công trình
   **đúng năm** xảy ra vụ việc; sửa luôn dòng ngày chụp ở góc bìa.
2. Sửa ba mốc thẳng trong `index.html`. Thanh mốc `.moc-thanh` lặp ở đầu slide
   2, 3, 4: chữ ở `.moc-gio` / `.moc-ten` phải GIỐNG HỆT nhau ở cả ba lần; chỉ
   lớp `dang` (mốc đang nói) / `qua` (mốc đã qua) và ba biến `--tu --toi --tre`
   đổi theo slide — xem `TEMPLATE_RULES.md` mục 10.
3. Sửa **cả bảy dòng** `script-90s.txt` và `slides.scriptLines` trong
   `preview-settings.json` cho khớp.
4. Giữ nguyên nhịp **3 / 2 / 2 / 2 / 2 / 1 / 2** phần tử mỗi slide.
5. Đổi câu ở slide 6 thì đo lại `--tre-ngoat` trong `style.css` theo
   `output/timing.json` — nét gạch chân phải chạy đúng lúc giọng đọc tới vế sau.
6. Ghi lại nguồn, giấy phép và **ngày chụp** từng hình vào chính tệp này.
