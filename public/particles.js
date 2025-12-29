/**
 * THE WHEEL - DEGEN PARTICLE SYSTEM
 * Maximum visual chaos for PumpFun vibes
 */

class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.confetti = [];
        this.emojis = [];
        this.isRunning = false;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.start();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;

        // Create degen particles
        for (let i = 0; i < 80; i++) {
            this.particles.push(this.createParticle());
        }

        this.animate();
    }

    createParticle() {
        const colors = [
            'rgba(57, 255, 20, 0.7)',     // Neon green
            'rgba(255, 20, 147, 0.6)',    // Neon pink
            'rgba(0, 255, 255, 0.5)',     // Cyan
            'rgba(191, 0, 255, 0.6)',     // Purple
            'rgba(255, 255, 0, 0.5)',     // Yellow
            'rgba(255, 102, 0, 0.5)',     // Orange
            'rgba(255, 215, 0, 0.6)'      // Gold
        ];

        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            size: Math.random() * 4 + 1,
            speedX: (Math.random() - 0.5) * 1,
            speedY: (Math.random() - 0.5) * 1,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: Math.random() * 0.7 + 0.3,
            pulse: Math.random() * Math.PI * 2,
            pulseSpeed: Math.random() * 0.05 + 0.02
        };
    }

    animate() {
        if (!this.isRunning) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw particles
        this.particles.forEach(p => {
            p.x += p.speedX;
            p.y += p.speedY;
            p.pulse += p.pulseSpeed;

            // Wrap around
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;

            const pulseFactor = Math.sin(p.pulse) * 0.4 + 0.6;

            // Draw with glow
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * pulseFactor, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.alpha * pulseFactor;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = p.color;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });

        // Draw confetti
        this.confetti = this.confetti.filter(c => {
            c.y += c.speedY;
            c.x += c.speedX;
            c.rotation += c.rotationSpeed;
            c.speedY += 0.15;

            if (c.y > this.canvas.height + 20) return false;

            this.ctx.save();
            this.ctx.translate(c.x, c.y);
            this.ctx.rotate(c.rotation);
            this.ctx.globalAlpha = 1;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = c.color;
            this.ctx.fillStyle = c.color;
            this.ctx.fillRect(-c.width / 2, -c.height / 2, c.width, c.height);
            this.ctx.restore();

            return true;
        });

        // Draw flying emojis
        this.emojis = this.emojis.filter(e => {
            e.y += e.speedY;
            e.x += e.speedX;
            e.rotation += e.rotationSpeed;
            e.speedY += 0.08;
            e.opacity -= 0.005;

            if (e.y > this.canvas.height + 50 || e.opacity <= 0) return false;

            this.ctx.save();
            this.ctx.translate(e.x, e.y);
            this.ctx.rotate(e.rotation);
            this.ctx.globalAlpha = e.opacity;
            this.ctx.font = `${e.size}px sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(e.emoji, 0, 0);
            this.ctx.restore();

            return true;
        });

        this.ctx.globalAlpha = 1;
        requestAnimationFrame(() => this.animate());
    }

    explode(x, y, count = 150) {
        const colors = [
            '#39ff14', '#ff1493', '#00ffff', '#bf00ff',
            '#ffff00', '#ff6600', '#00ff88', '#ffd700'
        ];

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const velocity = Math.random() * 20 + 8;

            this.confetti.push({
                x: x || this.canvas.width / 2,
                y: y || this.canvas.height / 3,
                width: Math.random() * 12 + 5,
                height: Math.random() * 8 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                speedX: Math.cos(angle) * velocity,
                speedY: Math.sin(angle) * velocity - 12,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.4
            });
        }

        // Add flying emojis
        const degenEmojis = ['🚀', '💎', '🔥', '💰', '🎰', '👑', '✨', '💸', '🌙', '⚡'];
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 15 + 5;

            this.emojis.push({
                x: x || this.canvas.width / 2,
                y: y || this.canvas.height / 3,
                emoji: degenEmojis[Math.floor(Math.random() * degenEmojis.length)],
                size: Math.random() * 30 + 20,
                speedX: Math.cos(angle) * velocity,
                speedY: Math.sin(angle) * velocity - 10,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                opacity: 1
            });
        }
    }

    rain(duration = 3000, count = 250) {
        const colors = ['#39ff14', '#ff1493', '#00ffff', '#bf00ff', '#ffd700', '#ff6600'];
        const interval = duration / count;
        let spawned = 0;

        const spawnInterval = setInterval(() => {
            if (spawned >= count) {
                clearInterval(spawnInterval);
                return;
            }

            this.confetti.push({
                x: Math.random() * this.canvas.width,
                y: -20,
                width: Math.random() * 12 + 5,
                height: Math.random() * 8 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                speedX: (Math.random() - 0.5) * 4,
                speedY: Math.random() * 4 + 3,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3
            });

            spawned++;
        }, interval);
    }

    // Money rain effect
    moneyRain() {
        const moneyEmojis = ['💵', '💰', '🤑', '💸', '💎'];

        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                this.emojis.push({
                    x: Math.random() * this.canvas.width,
                    y: -30,
                    emoji: moneyEmojis[Math.floor(Math.random() * moneyEmojis.length)],
                    size: Math.random() * 25 + 15,
                    speedX: (Math.random() - 0.5) * 2,
                    speedY: Math.random() * 3 + 2,
                    rotation: 0,
                    rotationSpeed: (Math.random() - 0.5) * 0.1,
                    opacity: 1
                });
            }, i * 100);
        }
    }
}

// Floating orbs around the wheel
class OrbSystem {
    constructor() {
        this.orbs = [];
        this.wheelContainer = document.querySelector('.wheel-container');
        if (!this.wheelContainer) return;
        this.createOrbs();
    }

    createOrbs() {
        const colors = ['#39ff14', '#ff1493', '#00ffff', '#bf00ff', '#ffd700'];

        for (let i = 0; i < 8; i++) {
            const orb = document.createElement('div');
            orb.className = 'floating-orb';
            const color = colors[i % colors.length];
            orb.style.cssText = `
                position: absolute;
                width: ${Math.random() * 8 + 4}px;
                height: ${Math.random() * 8 + 4}px;
                background: ${color};
                border-radius: 50%;
                pointer-events: none;
                box-shadow: 0 0 15px ${color}, 0 0 30px ${color};
                animation: orb-float-${i} ${Math.random() * 4 + 3}s ease-in-out infinite;
                z-index: 0;
            `;

            const style = document.createElement('style');
            const startX = Math.random() * 80 + 10;
            const startY = Math.random() * 80 + 10;
            style.textContent = `
                @keyframes orb-float-${i} {
                    0%, 100% { 
                        top: ${startY}%; 
                        left: ${startX}%;
                        opacity: 0.6;
                        transform: scale(1);
                    }
                    50% { 
                        top: ${startY + (Math.random() - 0.5) * 20}%; 
                        left: ${startX + (Math.random() - 0.5) * 20}%;
                        opacity: 1;
                        transform: scale(1.3);
                    }
                }
            `;
            document.head.appendChild(style);
            this.wheelContainer.appendChild(orb);
            this.orbs.push(orb);
        }
    }
}

// Initialize
let particleSystem = null;
let orbSystem = null;

document.addEventListener('DOMContentLoaded', () => {
    particleSystem = new ParticleSystem('particleCanvas');
    orbSystem = new OrbSystem();
});

// Export
window.ParticleSystem = ParticleSystem;
window.triggerConfetti = () => {
    if (particleSystem) {
        particleSystem.explode();
        particleSystem.rain(3000, 200);
        particleSystem.moneyRain();
    }
};
