import React, { useEffect, useRef } from 'react';

interface ConfettiSystemProps {
  streak: number;
  isRichMode?: boolean;
  activeTitle: string | null;
  momPurchases: number;
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
  text?: string;
}

const COLORS = [
  '#fbbf24', // amber-400
  '#f59e0b', // amber-500
  '#d97706', // amber-600
  '#fffbeb', // amber-50 (sparkle)
];

const RICH_COLORS = [
  '#4ade80', // green-400
  '#22c55e', // green-500
  '#16a34a', // green-600
  '#15803d', // green-700
  '#86efac', // green-300
];

const MOMMY_COLORS = [
  '#f472b6', // pink-400
  '#ec4899', // pink-500
  '#db2777', // pink-600
  '#ef4444', // red-500
  '#fce7f3', // pink-100
];

const ConfettiSystem: React.FC<ConfettiSystemProps> = ({ streak, isRichMode = false, activeTitle, momPurchases }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationId = useRef<number | null>(null);
  const prevStreak = useRef(streak);
  
  // Refs for loop access
  const isRichModeRef = useRef(isRichMode);
  const isMommyModeRef = useRef(activeTitle === 'MOMMY');
  const hasMilfUpgradeRef = useRef(momPurchases >= 10);

  useEffect(() => {
    isRichModeRef.current = isRichMode;
    isMommyModeRef.current = activeTitle === 'MOMMY';
    hasMilfUpgradeRef.current = momPurchases >= 10;
  }, [isRichMode, activeTitle, momPurchases]);

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

      // --- TRICKLE LOGIC (Ambient effects) ---
      
      // 1. Rich Mode Trickle
      if (isRichModeRef.current) {
          if (Math.random() < 0.3) { 
              const isText = Math.random() < 0.3; 
              particles.current.push({
                  x: Math.random() * canvas.width,
                  y: -30,
                  size: isText ? Math.random() * 16 + 12 : Math.random() * 6 + 4,
                  color: RICH_COLORS[Math.floor(Math.random() * RICH_COLORS.length)],
                  speedY: Math.random() * 2 + 1.5, 
                  speedX: Math.random() * 1 - 0.5,
                  rotation: Math.random() * 360,
                  rotationSpeed: (Math.random() - 0.5) * 5,
                  text: isText ? '$' : undefined
              });
          }
      } 
      // 2. Mommy Mode Trickle
      else if (isMommyModeRef.current) {
          if (Math.random() < 0.3) {
              const isText = Math.random() < 0.4; // Higher chance for emojis
              let char = '❤️';
              // If Milf upgrade unlocked, mix in peaches
              if (hasMilfUpgradeRef.current && Math.random() > 0.5) {
                  char = '🍑';
              }

              particles.current.push({
                  x: Math.random() * canvas.width,
                  y: -30,
                  size: isText ? Math.random() * 16 + 12 : Math.random() * 6 + 4,
                  color: MOMMY_COLORS[Math.floor(Math.random() * MOMMY_COLORS.length)],
                  speedY: Math.random() * 2 + 1.5,
                  speedX: Math.random() * 1 - 0.5,
                  rotation: Math.random() * 360,
                  rotationSpeed: (Math.random() - 0.5) * 5,
                  text: isText ? char : undefined
              });
          }
      }

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
        
        if (p.text) {
            ctx.font = `bold ${p.size}px serif`; // Serif for emojis/symbols looks better usually
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Emojis don't respect fillStyle color, but '$' does.
            // We set fillStyle anyway for symbols that do.
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, 0, 0);
        } else {
            ctx.fillStyle = p.color;
            // Draw pixel-perfect square
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }
        
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

  // Streak Logic (Explosions)
  useEffect(() => {
    // 1. Handle Reset (Failed flip)
    if (streak === 0) {
      if (!isRichMode && !activeTitle) particles.current = [];
    } 
    // 2. Handle Streak Increase (Success)
    else if (streak > prevStreak.current) {
      const canvas = canvasRef.current;
      if (canvas) {
         const count = Math.min(20 + (streak * 10), 200); 
         
         for (let i = 0; i < count; i++) {
            
            // Determine Style based on Mode
            let colorPool = COLORS;
            let text: string | undefined = undefined;
            
            if (activeTitle === 'RICH' && isRichMode) {
                colorPool = RICH_COLORS;
                if (Math.random() < 0.3) text = '$';
            } else if (activeTitle === 'MOMMY') {
                colorPool = MOMMY_COLORS;
                if (Math.random() < 0.4) {
                    text = '❤️';
                    if (momPurchases >= 10 && Math.random() > 0.5) text = '🍑';
                }
            }

            particles.current.push({
              x: Math.random() * canvas.width,
              y: -Math.random() * 300 - 20, 
              size: text ? Math.random() * 12 + 10 : Math.random() * 8 + 4,
              color: colorPool[Math.floor(Math.random() * colorPool.length)],
              speedY: Math.random() * 5 + 3,
              speedX: Math.random() * 2 - 1, 
              rotation: Math.random() * 360,
              rotationSpeed: (Math.random() - 0.5) * 15,
              text: text
            });
          }
      }
    }
    prevStreak.current = streak;
  }, [streak, isRichMode, activeTitle, momPurchases]);

  return (
    <canvas 
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[60]"
      style={{ mixBlendMode: (isRichMode || activeTitle === 'MOMMY') ? 'normal' : 'screen' }} 
    />
  );
};

export default ConfettiSystem;