import React, { useEffect, useRef } from 'react';

interface ConfettiProps {
    onComplete?: () => void;
}

const Confetti: React.FC<ConfettiProps> = ({ onComplete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize canvas to full screen
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        // Theme colors: Accent (Orange), Protein (Purple), Gold, Blue
        const colors = ['#FF7E5F', '#764BA2', '#FBBF24', '#667EEA'];
        
        // Reduced particle count for better performance on mobile devices
        const particleCount = 80;
        // Store particles
        const particles: any[] = [];

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                vx: Math.random() * 4 - 2,     
                vy: Math.random() * 5 + 3,     
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 8 + 4,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 10 - 5,
                shape: Math.random() > 0.5 ? 'rect' : 'circle' 
            });
        }

        let animationId: number;
        let stopEmitting = false;

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            let activeCount = 0;

            particles.forEach((p) => {
                // If particle is way off screen and we are stopping, don't update/draw it to save resources
                if (stopEmitting && p.y > canvas.height + 50) {
                    return;
                }
                
                activeCount++;
                p.y += p.vy;
                p.x += p.vx;
                p.rotation += p.rotationSpeed;

                // Recycling Logic
                if (p.y > canvas.height) {
                    if (!stopEmitting) {
                        // Reset to top if we are still emitting
                        p.y = -20;
                        p.x = Math.random() * canvas.width;
                        p.vy = Math.random() * 5 + 3; 
                    }
                    // If stopEmitting is true, we simply let it fall > height, and do nothing
                }

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;

                if (p.shape === 'rect') {
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                ctx.restore();
            });

            if (stopEmitting && activeCount === 0) {
                // All particles have fallen off screen
                if (onComplete) onComplete();
            } else {
                animationId = requestAnimationFrame(animate);
            }
        };

        animate();

        // After 2.5 seconds, stop recycling particles (they will fall off screen one by one)
        const stopTimer = setTimeout(() => {
            stopEmitting = true;
        }, 2500);

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', resize);
            clearTimeout(stopTimer);
        };
    }, [onComplete]);

    return (
        <canvas 
            ref={canvasRef} 
            className="fixed inset-0 pointer-events-none z-[100]"
        />
    );
};

export default Confetti;