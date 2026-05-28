"use client";
import { useEffect, useRef } from "react";

export default function ParticlesBG() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;

    // Mobile: fewer dots, no connections, skip every other frame
    const isMobile = window.innerWidth < 768;
    const COUNT = isMobile ? 25 : 50;
    const CONNECT_DIST = isMobile ? 0 : 120; // no connections on mobile
    let frameCount = 0;
    let rafId = 0;

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = Math.max(window.innerHeight, 600);
    };
    onResize();
    window.addEventListener("resize", onResize, { passive: true });

    const dots = Array.from({ length: COUNT }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: 1 + Math.random() * 1.2,
    }));

    const loop = () => {
      frameCount++;
      // Mobile: only render every 2nd frame to halve GPU load
      if (isMobile && frameCount % 2 !== 0) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Move dots
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > canvas.width) d.vx *= -1;
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1;
      }

      // Connections (desktop only)
      if (CONNECT_DIST > 0) {
        for (let i = 0; i < dots.length; i++) {
          for (let j = i + 1; j < dots.length; j++) {
            const dx = dots[i].x - dots[j].x;
            const dy = dots[i].y - dots[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CONNECT_DIST) {
              ctx.strokeStyle = `rgba(255,215,0,${(1 - dist / CONNECT_DIST) * 0.12})`;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(dots[i].x, dots[i].y);
              ctx.lineTo(dots[j].x, dots[j].y);
              ctx.stroke();
            }
          }
        }
      }

      // Dots
      ctx.fillStyle = "rgba(255,215,0,0.3)";
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 -z-10" />;
}
