# Cấu Trúc Thư Mục Dự Án (Folder Structure)

Dự án ReTrade Frontend được xây dựng theo kiến trúc chuẩn dành cho các ứng dụng React hiện đại, tách biệt rõ ràng giữa các phần hiển thị (UI) và xử lý logic (Services/Utils).

Dưới đây là giải thích chi tiết chức năng của từng thư mục nằm bên trong `src/`:

---

### 📁 assets/
  - Mục đích: Chứa các tệp tin tài nguyên tĩnh (static resources) của dự án.
  - Nội dung: Hình ảnh logo, background đăng nhập, icon hệ thống...
  - Ví dụ: `logo.png`, `background-login.png`.

### 📁 components/
  - Mục đích: Chứa các thành phần giao diện nhỏ, có tính tái sử dụng cao ở nhiều trang khác nhau.
  - Nội dung: Các button, text input, modal popup chung...
  - Ví dụ:
    - `Header/Header.jsx`: Thanh công cụ trên cùng của trang web, hỗ trợ hamburger menu trên mobile.
    - `Footer/Footer.jsx`: Chân trang web chứa thông tin liên hệ.
    - `ChangePasswordAfterRecoveryModal/`: Cửa sổ yêu cầu thay đổi mật khẩu sau khi khôi phục tài khoản thành công.
  - Quy tắc: Các thành phần này chỉ nhận dữ liệu thông qua props để kết xuất hiển thị, hạn chế tối đa việc nhúng các xử lý API phức tạp.

### 📁 context/
  - Mục đích: Quản lý các trạng thái toàn cục (Global State) của ứng dụng bằng React Context API.
  - Nội dung:
    - `AuthContext.jsx`: Quản lý trạng thái đăng nhập của người dùng, phân quyền (Roles) và các thao tác liên quan như Login/Logout.
    - `ToastContext.jsx`: Quản lý việc hiển thị thông báo góc màn hình (Toast Notifications) dưới dạng slide-in tiện dụng.

### 📁 layouts/
  - Mục đích: Định nghĩa khung sườn cấu trúc giao diện chung cho website.
  - Nội dung:
    - `MainLayout.jsx`: Chứa Header và Footer cố định. Phần nội dung trang ở giữa sẽ tự động thay đổi động bằng cách nhúng thẻ `<Outlet />` của thư viện `react-router-dom`.

### 📁 pages/
  - Mục đích: Chứa các trang chính của ứng dụng. Mỗi thư mục con tương ứng với một tuyến đường đường dẫn (URL) cụ thể.
  - Phân vùng: Các trang được phân chia theo đối tượng người dùng (ví dụ: `Buyer/`) để tránh nhầm lẫn.
  - Ví dụ: `Buyer/Home`, `Buyer/Login`, `Buyer/Register`, `Buyer/MyAccount` (quản lý thông tin cá nhân).
  - Lưu ý: Trang `Profile` dư thừa trước đây đã được gỡ bỏ hoàn toàn khỏi hệ thống để chuyển đổi tập trung mọi cấu hình vào trang `MyAccount`.

### 📁 services/
  - Mục đích: Điểm duy nhất chịu trách nhiệm giao tiếp trực tiếp với Backend APIs.
  - Nội dung:
    - `api.js`: Khởi tạo và cấu hình Axios instance, tự động chèn JWT token vào header của request, tự động bắt lỗi 401 để ép đăng xuất người dùng.
    - `accountService.js`: Chứa các API liên quan đến tài khoản như đăng nhập, đăng ký, đổi mật khẩu, khôi phục tài khẩu.

### 📁 styles/
  - Mục đích: Chứa toàn bộ các file CSS định dạng giao diện đặc thù cho từng trang/thành phần.
  - Nội dung: Các file CSS riêng như `Login.css`, `Register.css`, `Header.css`.
  - Lưu ý: Lưới responsive dùng chung (`responsive-grid.css`) được tách riêng tại đây và import trực tiếp vào `index.css` để bất kỳ trang nào cũng có thể tái sử dụng mà không cần viết lại `@media` query.

### 📁 utils/
  - Mục đích: Chứa các hàm tiện ích xử lý logic thuần túy (không chứa mã JSX hiển thị).
  - Nội dung: Các hàm định dạng tiền tệ, xử lý/bóc tách lỗi từ server, các hàm định dạng ngày tháng năm.

---

## Quy Trắc Luồng Dữ Liệu (Flow of Data)

Để giữ mã nguồn luôn sạch và dễ mở rộng:
1. Giao tiếp Backend để lấy dữ liệu thô thông qua các file định nghĩa trong `services/`.
2. Định dạng hoặc làm sạch dữ liệu bằng các hàm tiện ích trong `utils/` (nếu cần thiết).
3. Lưu trữ trạng thái toàn cục vào các Context định nghĩa trong `context/`.
4. Gọi dữ liệu và phân phối xuống các Component/Trang chính tại `pages/`.
5. Đóng gói giao diện bằng các Component tái sử dụng trong `components/`.

