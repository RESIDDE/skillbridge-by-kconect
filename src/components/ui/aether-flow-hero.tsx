"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface AetherFlowHeroProps {
  onApplicant?: () => void;
  onCompany?: () => void;
}

const AetherFlowHero = ({ onApplicant, onCompany }: AetherFlowHeroProps) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: any[] = [];
    const mouse = { x: null as number | null, y: null as number | null, radius: 200 };

    class Particle {
      x: number; y: number;
      directionX: number; directionY: number;
      size: number; color: string;

      constructor(x: number, y: number, dirX: number, dirY: number, size: number, color: string) {
        this.x = x; this.y = y;
        this.directionX = dirX; this.directionY = dirY;
        this.size = size; this.color = color;
      }

      draw() {
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx!.fillStyle = this.color;
        ctx!.fill();
      }

      update() {
        if (this.x > canvas!.width || this.x < 0) this.directionX = -this.directionX;
        if (this.y > canvas!.height || this.y < 0) this.directionY = -this.directionY;

        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < mouse.radius + this.size) {
            const fx = dx / distance;
            const fy = dy / distance;
            const force = (mouse.radius - distance) / mouse.radius;
            this.x -= fx * force * 5;
            this.y -= fy * force * 5;
          }
        }
        this.x += this.directionX;
        this.y += this.directionY;
        this.draw();
      }
    }

    function init() {
      particles = [];
      const numberOfParticles = (canvas!.height * canvas!.width) / 7000;
      for (let i = 0; i < numberOfParticles; i++) {
        const size = Math.random() * 2.5 + 0.8;
        const x = Math.random() * (canvas!.width - size * 4) + size * 2;
        const y = Math.random() * (canvas!.height - size * 4) + size * 2;
        const directionX = Math.random() * 0.5 - 0.25;
        const directionY = Math.random() * 0.5 - 0.25;
        // Original reference purple
        const color = "rgba(191, 128, 255, 0.85)";
        particles.push(new Particle(x, y, directionX, directionY, size, color));
      }
    }

    const resizeCanvas = () => {
      canvas!.width = canvas!.offsetWidth;
      canvas!.height = canvas!.offsetHeight;
      init();
    };

    const connect = () => {
      for (let a = 0; a < particles.length; a++) {
        for (let b = a; b < particles.length; b++) {
          const dist =
            (particles[a].x - particles[b].x) ** 2 +
            (particles[a].y - particles[b].y) ** 2;
          const threshold = (canvas!.width / 7) * (canvas!.height / 7);

          if (dist < threshold) {
            const opacityValue = 1 - dist / 20000;

            // Near-mouse lines go bright gold/white, others stay faint gold
            const dxMouse = particles[a].x - (mouse.x ?? -9999);
            const dyMouse = particles[a].y - (mouse.y ?? -9999);
            const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

            if (mouse.x !== null && distMouse < mouse.radius) {
              // White lines near mouse — exact original behavior
              ctx!.strokeStyle = `rgba(255, 255, 255, ${opacityValue})`;
            } else {
              // Purple connecting lines
              ctx!.strokeStyle = `rgba(200, 150, 255, ${opacityValue * 0.8})`;
            }

            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(particles[a].x, particles[a].y);
            ctx!.lineTo(particles[b].x, particles[b].y);
            ctx!.stroke();
          }
        }
      }
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      // KEY: fill the canvas solid every frame — this is what makes the animation look immersive
      ctx!.fillStyle = "#020617";
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);

      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
      }
      connect();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const handleMouseOut = () => { mouse.x = null; mouse.y = null; };

    window.addEventListener("resize", resizeCanvas);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseOut);

    resizeCanvas();
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseOut);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { delay: i * 0.2 + 0.5, duration: 0.8, ease: "easeInOut" as const },
    }),
  };

  return (
    <div className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden">
      {/* Canvas IS the background — fills full hero */}
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />

      {/* Bottom fade to blend into the world map below */}
      <div
        className="absolute bottom-0 inset-x-0 h-48 pointer-events-none z-10"
        style={{ background: "linear-gradient(to top, #020617, transparent)" }}
      />

      {/* Overlay content */}
      <div className="relative z-20 text-center px-6 max-w-5xl mx-auto">

        {/* Logo */}
        <motion.div
          custom={0} variants={fadeUp} initial="hidden" animate="visible"
          className="flex justify-center mb-8"
        >
          <img 
            src="/new logo.PNG" 
            alt="SkillBridge Logo" 
            className="h-32 md:h-64 lg:h-80 object-contain max-w-full drop-shadow-[0_0_35px_rgba(191,128,255,0.4)]" 
          />
        </motion.div>

        {/* Dynamic portal description */}
        <motion.p
          custom={1} variants={fadeUp} initial="hidden" animate="visible"
          className="max-w-3xl mx-auto text-sm md:text-base text-gray-300 mb-24 leading-relaxed"
        >
          SkillBridge is an AI-powered talent certification platform that verifies elite professionals through rigorous real-world assessments and connects them directly with top-tier global companies.
        </motion.p>

        {/* CTAs */}
        <motion.div
          custom={3} variants={fadeUp} initial="hidden" animate="visible"
          className="flex flex-wrap gap-4 justify-center"
        >
          <button
            onClick={onApplicant}
            className="flex items-center gap-2 px-8 py-4 rounded-full font-bold text-sm cursor-pointer transition-all duration-200 hover:opacity-90 hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)", color: "#ffffff", boxShadow: "0 0 30px rgba(168, 85, 247, 0.4)", fontFamily: "'Space Grotesk',sans-serif" }}
          >
            Get Certified Free
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={onCompany}
            className="flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-sm cursor-pointer transition-all duration-200 hover:bg-white/10 active:scale-95"
            style={{ background: "transparent", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(10px)", fontFamily: "'Space Grotesk',sans-serif" }}
          >
            Browse Talent Pool
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default AetherFlowHero;
