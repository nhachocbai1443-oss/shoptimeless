import React from 'react';

// Hiệu ứng rơi toàn web: tia sáng + kim cương sang, không còn
// kiểu cute cánh hoa nữa, rơi nhẹ từ trên xuống, bay lượn qua lại
// như gió. Chỉ là trang trí:
// - Không chặn bấm: pointer-events-none, không nhận click.
// - Không nặng máy: chỉ 22 vật, chạy bằng CSS transform/opacity,
//   không dùng JavaScript chạy liên tục, không tải ảnh ngoài.
// - Không che chữ: vật nhỏ, mờ nhẹ, lớp này nằm dưới header.
// - Người dùng bật "giảm chuyển động" trong hệ thống thì hiệu
//   ứng tự tắt (xem @media trong index.html).
// Vị trí/tốc độ tính cố định theo chỉ số (không dùng Math.random
// lúc render) để mỗi lần tải lại vẫn rơi đều, không bị giật.

const PETALS = ['✨', '💎', '⭐', '🌟', '✨', '💠', '⭐', '✨', '💎', '🌟'];

interface FallingItem {
  left: number;
  size: number;
  fallDuration: number;
  fallDelay: number;
  swayDuration: number;
  opacity: number;
  emoji: string;
}

const ITEMS: FallingItem[] = Array.from({ length: 22 }, (_, i) => {
  // Công thức giả ngẫu nhiên nhưng cố định theo i.
  const seed = (i * 37 + 11) % 100;
  return {
    left: (i * 43 + seed) % 100,
    size: 12 + ((i * 7 + seed) % 12),
    fallDuration: 10 + ((i * 3 + seed) % 9),
    // Delay âm: vật đã rơi dở dang ngay khi vừa mở web, khỏi
    // phải đợi lượt rơi đầu tiên.
    fallDelay: -((i * 5 + seed) % 18),
    swayDuration: 2 + ((i * 2) % 3),
    opacity: 0.45 + ((seed % 35) / 100),
    emoji: PETALS[i % PETALS.length],
  };
});

const FallingEffect: React.FC = () => {
  return (
    <div
      className="falling-effect fixed inset-0 overflow-hidden pointer-events-none z-[5]"
      aria-hidden="true"
    >
      {ITEMS.map((item, i) => (
        <span
          key={i}
          className="falling-item"
          style={{
            left: `${item.left}%`,
            animationDuration: `${item.fallDuration}s`,
            animationDelay: `${item.fallDelay}s`,
          }}
        >
          <span
            className="falling-sway"
            style={{
              fontSize: `${item.size}px`,
              opacity: item.opacity,
              animationDuration: `${item.swayDuration}s`,
              filter: 'drop-shadow(0 2px 4px rgba(15, 23, 42, 0.20))',
            }}
          >
            {item.emoji}
          </span>
        </span>
      ))}
    </div>
  );
};

export default FallingEffect;
