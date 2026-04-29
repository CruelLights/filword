"use client";

import { useEffect, useRef } from "react";

const EMOJIS = ["🔤", "🏆", "⚡", "🎯", "✨", "🎮", "📝", "🌟", "💡", "🎲", "🔡", "🥇", "🎪", "🌈", "💫"];

type Particle = {
  x: number;
  y: number;
  size: number;
  speed: number;
  emoji: string;
  opacity: number;
  drift: number;
  rotation: number;
  rotationSpeed: number;
};

export function FloatingEmojis() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrameId: number;
    let particles: Particle[] = [];

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function createParticle(): Particle {
      return {
        x: Math.random() * (canvas?.width ?? 800),
        y: (canvas?.height ?? 600) + 50,
        size: 16 + Math.random() * 20,
        speed: 0.4 + Math.random() * 0.8,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)]!,
        opacity: 0.15 + Math.random() * 0.25,
        drift: (Math.random() - 0.5) * 0.5,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
      };
    }

    function init() {
      particles = Array.from({ length: 20 }, () => {
        const p = createParticle();
        p.y = Math.random() * (canvas?.height ?? 600);
        return p;
      });
    }

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.font = `${p.size}px serif`;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillText(p.emoji, -p.size / 2, p.size / 2);
        ctx.restore();

        p.y -= p.speed;
        p.x += p.drift;
        p.rotation += p.rotationSpeed;

        if (p.y < -50) {
          Object.assign(p, createParticle());
        }
      });

      animFrameId = requestAnimationFrame(draw);
    }

    resize();
    init();
    draw();

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}