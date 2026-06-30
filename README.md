# PlanTop — Sơ đồ luồng Clender × Upbain

Ứng dụng web kéo-thả giúp bạn thiết kế hệ thống tool bằng cách kết hợp module từ **Clender** (lịch & kế hoạch) và **Upbain** (ý tưởng & sáng tạo).

## Tính năng

- **Kéo thả module** từ sidebar vào canvas
- **Nối các node** thành luồng làm việc (click cổng ra → cổng vào)
- **Thêm ý tưởng tùy chỉnh** bằng cách nhập text ở thanh trên
- **Chỉnh sửa** tên và mô tả node (double-click hoặc panel bên phải)
- **Zoom / pan** canvas (scroll chuột, Space + kéo)
- **Lưu / tải** tự động trong trình duyệt (localStorage)
- **Xuất / nhập JSON** để chia sẻ hoặc backup
- **Tổng quan hệ thống** — xem cấu trúc luồng dạng text

## Cách chạy

Mở file `index.html` trực tiếp trong trình duyệt, hoặc dùng local server:

```bash
# Python
python3 -m http.server 8080

# Node.js (npx)
npx serve .
```

Truy cập: http://localhost:8080

## Cấu trúc

```
├── index.html      # Giao diện chính
├── css/styles.css  # Giao diện
├── js/
│   ├── config.js   # Module gợi ý Clender & Upbain
│   └── app.js      # Logic kéo-thả, nối node, lưu trữ
```

## Module gợi ý

### Clender — Lịch & Kế hoạch
Lịch, Sự kiện, Deadline, Lịch trình, Nhắc nhở, Timeline, Lặp lại, Khối thời gian

### Upbain — Ý tưởng & Sáng tạo
Ý tưởng, Brainstorm, Ghi chú, Task, Mục tiêu, Quyết định, Mind map, Inbox, Review, Lưu trữ

## Phím tắt

| Phím | Hành động |
|------|-----------|
| Double-click node | Sửa tên |
| Del / Backspace | Xóa node hoặc kết nối đã chọn |
| Escape | Hủy nối dây |
| Space + kéo | Di chuyển canvas |
| Scroll chuột | Zoom |
