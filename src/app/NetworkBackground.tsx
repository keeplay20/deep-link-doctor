"use client";
import { useEffect, useRef } from "react";

type P = { x: number; y: number; vx: number; vy: number };

/** Sparse animated dots. */
export default function NetworkBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, pts: P[] = [];

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(20, Math.floor((w * h) / 80000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      }));
    }

    function draw() {
      const dark = document.documentElement.classList.contains("dark");
      const rgb = dark ? "129,140,248" : "79,70,229";
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        if (!reduce) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
      }
      ctx.fillStyle = `rgba(${rgb},${dark ? 0.7 : 0.5})`;
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill(); }
      if (!reduce) raf = requestAnimationFrame(draw);
    }

    resize(); draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 h-full w-full" />;
}
