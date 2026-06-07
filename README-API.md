# Hướng Dẫn Gọi API Từ Backend (C#) Lên Giao Diện (React)

Dự án này sử dụng mô hình Service Pattern kết hợp với thư viện Axios. Việc giao tiếp và lấy dữ liệu từ Backend được tiêu chuẩn hóa qua các lớp trung gian để đảm bảo khả năng bảo trì.

## 1. Cấu trúc thư mục API

Tất cả các lệnh gọi API đều nằm gọn trong thư mục `src/services/`:
- `api.js`: Nơi cấu hình Axios Instance chung, tự động nối chuỗi `BASE_API_URL` và đính kèm Token xác thực (`Bearer token`) vào mỗi request gửi đi.
- `[feature]Service.js`: Chứa các hàm cụ thể phân theo nghiệp vụ (ví dụ: `accountService.js` để quản lý tài khoản, `productService.js` để quản lý sản phẩm).

---

## 2. Quy Trình Gọi Một API Mới

### Bước 1: Khai báo Service

Tất cả các hàm gọi API cần được gom nhóm trong các file service tương ứng thay vì gọi trực tiếp trong UI component. Ví dụ, tạo file `src/services/productService.js`:

```javascript
import api from './api';

const productService = {
  // Lấy danh sách sản phẩm (GET)
  getAllProducts: async () => {
    const response = await api.get('/Product'); 
    return response.data;
  },

  // Thêm mới sản phẩm (POST) kèm Body Data
  createProduct: async (productData) => {
    const response = await api.post('/Product', productData);
    return response.data;
  },
  
  // Xóa sản phẩm (DELETE) với Route Param
  deleteProduct: async (id) => {
    const response = await api.delete(`/Product/${id}`);
    return response.data;
  }
};

export default productService;
```

### Bước 2: Sử dụng Service trong Component

Mở màn hình giao diện cần hiển thị dữ liệu (ví dụ: `src/pages/Buyer/Home/Home.jsx`):

1. Sử dụng hook `useState` và `useEffect` để quản lý trạng thái dữ liệu.
2. Import service và gọi hàm trong khối lệnh `try...catch` để bắt lỗi.
3. Sử dụng `useToast` để hiển thị thông báo trực quan cho người dùng.

```javascript
import React, { useState, useEffect } from 'react';
import productService from '../../services/productService';
import { useToast } from '../../context/ToastContext';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const data = await productService.getAllProducts();
        setProducts(data);
      } catch (error) {
        showToast('Không tải được danh sách sản phẩm!', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div>
      <h2>Danh Sách Sản Phẩm</h2>
      {loading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <ul>
          {products.map((item) => (
            <li key={item.id}>{item.name} - {item.price} VND</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## 3. Luồng Xác Thực và Xử Lý Token Hết Hạn

- **Tự động gắn Token**: Đối với các API được cấu hình `[Authorize]` ở phía Backend, Axios instance trong `api.js` sẽ tự động đính kèm Token xác thực lưu trong `localStorage` vào tiêu đề (Header) của request. Lập trình viên không cần truyền Token thủ công.
- **Xử lý lỗi 401 Unauthorized**: Khi Token hết hạn hoặc tài khoản bị khóa, Backend sẽ trả về mã lỗi HTTP 401. Axios Interceptor trong `api.js` sẽ tự động phát hiện lỗi này, dọn sạch thông tin đăng nhập trong `localStorage` và chuyển hướng người dùng về trang `/login` ngay lập tức.

---

## 4. Luồng Thay Đổi Mật Khẩu Sau Khôi Phục (Must Change Password)

Khi người dùng thực hiện khôi phục mật khẩu, hệ thống sẽ tạo mật khẩu ngẫu nhiên gửi về email của họ và đánh dấu trạng thái tài khoản là `MustChangePassword = true` ở Backend:

1. **Đăng nhập với mật khẩu tạm thời**: Người dùng đăng nhập bình thường bằng mật khẩu tạm nhận qua email.
2. **Kích hoạt Modal đổi mật khẩu**: Phía Frontend kiểm tra cờ `mustChangePassword` trả về từ API login. Nếu cờ này có giá trị `true`, giao diện hiển thị hộp thoại `ChangePasswordAfterRecoveryModal` yêu cầu đổi mật khẩu ngay lập tức để tiếp tục truy cập.
3. **Gọi API đổi mật khẩu tiêu chuẩn**: Modal sẽ yêu cầu người dùng điền đầy đủ:
   - Mật khẩu tạm thời (Mật khẩu cũ)
   - Mật khẩu mới
   - Nhập lại mật khẩu mới để xác nhận
4. **API Endpoint**: Modal thực hiện gửi dữ liệu lên endpoint `/Account/change-password` thông qua hàm `accountService.changePassword(oldPassword, newPassword)`. Hệ thống không sử dụng API đổi mật khẩu riêng sau khôi phục nhằm đồng nhất luồng bảo mật.
