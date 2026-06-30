/**
 * Gợi ý module từ Clender (lịch/kế hoạch) và Upbain (ý tưởng/sáng tạo)
 */
const PALETTE = {
  clender: [
    { type: 'calendar', icon: '📅', label: 'Lịch', desc: 'Quản lý ngày tháng & sự kiện' },
    { type: 'event', icon: '📌', label: 'Sự kiện', desc: 'Tạo và theo dõi sự kiện' },
    { type: 'deadline', icon: '⏰', label: 'Deadline', desc: 'Hạn chót & nhắc nhở' },
    { type: 'schedule', icon: '🗓️', label: 'Lịch trình', desc: 'Lập kế hoạch theo tuần/ngày' },
    { type: 'reminder', icon: '🔔', label: 'Nhắc nhở', desc: 'Thông báo tự động' },
    { type: 'timeline', icon: '📊', label: 'Timeline', desc: 'Dòng thời gian dự án' },
    { type: 'recurring', icon: '🔁', label: 'Lặp lại', desc: 'Task định kỳ hàng ngày/tuần' },
    { type: 'timeblock', icon: '⏱️', label: 'Khối thời gian', desc: 'Phân bổ thời gian làm việc' },
  ],
  upbain: [
    { type: 'idea', icon: '💡', label: 'Ý tưởng', desc: 'Ghi nhận ý tưởng mới' },
    { type: 'brainstorm', icon: '🧠', label: 'Brainstorm', desc: 'Động não & liên kết ý tưởng' },
    { type: 'note', icon: '📝', label: 'Ghi chú', desc: 'Ghi chú nhanh & tài liệu' },
    { type: 'task', icon: '✅', label: 'Task', desc: 'Công việc cần làm' },
    { type: 'goal', icon: '🎯', label: 'Mục tiêu', desc: 'OKR & mục tiêu dài hạn' },
    { type: 'decision', icon: '⚖️', label: 'Quyết định', desc: 'Điểm rẽ nhánh logic' },
    { type: 'mindmap', icon: '🕸️', label: 'Mind map', desc: 'Sơ đồ tư duy phân nhánh' },
    { type: 'inbox', icon: '📥', label: 'Inbox', desc: 'Thu thập mọi thứ chưa xử lý' },
    { type: 'review', icon: '🔍', label: 'Review', desc: 'Đánh giá & tổng kết' },
    { type: 'archive', icon: '🗄️', label: 'Lưu trữ', desc: 'Lưu trữ hoàn thành' },
  ],
};

const SOURCE_COLORS = {
  clender: { bg: '#0f2a3d', border: '#1e6b9e', accent: '#38bdf8' },
  upbain: { bg: '#1a1530', border: '#6d4fc7', accent: '#a78bfa' },
  custom: { bg: '#1a2e1a', border: '#3d8b4a', accent: '#4ade80' },
};

const STORAGE_KEY = 'plantop-flow-v1';
