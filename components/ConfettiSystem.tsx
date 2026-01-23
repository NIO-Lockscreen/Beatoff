import React, { useEffect, useRef } from 'react';

interface ConfettiSystemProps {
  streak: number;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedY: number;
  speedX: number;
  rotation: number;
  rotationSpeed: number;
}

const COLORS = [
  '#fbbf24', // amber-400
  '#f59e0b', // amber-500
  '#d97706', // amber-600
  '#fffbeb', // amber-50 (sparkle)
];

const ConfettiSystem: React.FC<ConfettiSystemProps> = ({ streak }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationId = useRef<number>();
  const prevStreak = useRef(streak);

  // Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const update = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        
        p.y += p.speedY;
        p.x += Math.sin(p.y * 0.01) * 0.5 + p.speedX; // Slight weave
        p.rotation += p.rotationSpeed;

        // Draw
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        // Draw pixel-perfect square
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();

        // Remove if off screen
        if (p.y > canvas.height + 20) {
          particles.current.splice(i, 1);
        }
      }

      animationId.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationId.current) cancelAnimationFrame(animationId.current);
    };
  }, []);

  // Streak Logic
  useEffect(() => {
    // 1. Handle Reset (Failed flip)
    if (streak === 0) {
      particles.current = [];
    } 
    // 2. Handle Streak Increase (Success)
    else if (streak > prevStreak.current) {
      const canvas = canvasRef.current;
      if (canvas) {
         // Aggressive scaling for visual impact
         // Streak 1: 30 particles
         // Streak 5: 70 particles
         // Streak 10: 120 particles
         const count = Math.min(20 + (streak * 10), 200); 
         
         for (let i = 0; i < count; i++) {
            particles.current.push({
              x: Math.random() * canvas.width,
              y: -Math.random() * 300 - 20, // Start well above screen to fall in
              size: Math.random() * 8 + 4,  // 4px to 12px squares
              color: COLORS[Math.floor(Math.random() * COLORS.length)],
              speedY: Math.random() * 5 + 3, // Fast falling
              speedX: Math.random() * 2 - 1, // Slight drift
              rotation: Math.random() * 360,
              rotationSpeed: (Math.random() - 0.5) * 15,
            });
          }
      }
    }
    prevStreak.current = streak;
  }, [streak]);

  return (
    <canvas 
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[60]"
      style={{ mixBlendMode: 'screen' }} // Makes gold pop against dark background
    />
  );
};

export default ConfettiSystem;