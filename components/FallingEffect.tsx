import React, { useMemo } from 'react';

// CÁNH HOA ĐÀO RƠI — y hệt bên web confession (cfstimeless):
// 1 cánh đào đơn (không phải hoa 5 cánh, không phải emoji), vẽ
// bằng CSS: gradient hồng #ffe3ef → #ffb3d4 → #ff8fbf, bo tròn
// kiểu cánh hoa, rơi chậm rãi 22–34 giây, bay lượn qua lại và
// xoay nhẹ, mờ dần ở đầu/cuối như hoa thật rơi.
// Khác bản trước (tia sáng/kim cương emoji rơi nhanh, đè lên chữ
// nên nhìn xấu): bản này rơi CHẬM, nằm SAU nội dung (z-index 1,
// như bên confession) nên chỉ thấy hoa rơi ở nền, không che chữ,
// không chặn bấm (pointer-events-none), không tải ảnh ngoài.

const COUNT = 12;

const FallingEffect: React.FC = () => {
  const petals = useMemo(
    () =>
      Array.from({ length: COUNT }).map((_, i) => {
        const scale = 0.7 + ((i * 23) % 60) / 100;
        return {
          left: `${(i * 73 + 11) % 100}%`,
          delay: `${(i * 1.9) % 20}s`,
          duration: `${22 + ((i * 37) % 120) / 10}s`,
          // Cánh to/nhỏ theo scale (tính ra width/height thật, vì
          // transform trong keyframes sẽ ghi đè transform scale).
          width: Math.round(13 * scale),
          height: Math.round(17 * scale),
        };
      }),
    []
  );

  return (
    <div className="shop-petal-rain" aria-hidden="true">
      {petals.map((p, i) => (
        <span
          key={i}
          className="shop-petal"
          style={{
            left: p.left,
            width: `${p.width}px`,
            height: `${p.height}px`,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
};

export default FallingEffect;
