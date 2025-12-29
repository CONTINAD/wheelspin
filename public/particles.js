/**
 * $WHEEL - Particle System
 * Money rain and confetti effects
 */

class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.confetti = [];
        this.money = [];
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

        // Create ambient particles (money-themed)
        for (let i = 0; i < 40; i++) {
            this.particles.push(this.createParticle());
        }

        this.animate();
    }

    createParticle() {
        const colors = [
            'rgba(255, 215, 0, 0.6)',    // Gold
            'rgba(0, 200, 83, 0.5)',      // Money green
            'rgba(255, 228, 77, 0.4)',    // Light gold
            'rgba(94, 252, 130, 0.4)',    // Light green
            'rgba(201, 160, 0, 0.5)'      // Dark gold
        ];

        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            size: Math.random() * 4 + 2,
            speedX: (Math.random() - 0.5) * 0.5,
            speedY: (Math.random() - 0.5) * 0.5,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: Math.random() * 0.6 + 0.2,
            pulse: Math.random() * Math.PI * 2,
            pulseSpeed: Math.random() * 0.03 + 0.01
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

            const pulseFactor = Math.sin(p.pulse) * 0.3 + 0.7;

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * pulseFactor, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.alpha * pulseFactor;
            this.ctx.fill();
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
            this.ctx.fillStyle = c.color;
            this.ctx.fillRect(-c.width / 2, -c.height / 2, c.width, c.height);
            this.ctx.restore();

            return true;
        });

        // Draw flying money
        this.money = this.money.filter(m => {
            m.y += m.speedY;
            m.x += m.speedX;
            m.rotation += m.rotationSpeed;
            m.speedY += 0.08;
            m.opacity -= 0.003;

            if (m.y > this.canvas.height + 50 || m.opacity <= 0) return false;

            this.ctx.save();
            this.ctx.translate(m.x, m.y);
            this.ctx.rotate(m.rotation);
            this.ctx.globalAlpha = m.opacity;
            this.ctx.font = `${m.size}px sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(m.emoji, 0, 0);
            this.ctx.restore();

            return true;
        });

        this.ctx.globalAlpha = 1;
        requestAnimationFrame(() => this.animate());
    }

    explode(x, y, count = 120) {
        const colors = [
            '#ffd700', '#00c853', '#ffe44d', '#5efc82',
            '#c9a000', '#43a047', '#e53935', '#1e88e5',
            '#8e24aa', '#fb8c00', '#fdd835'
        ];

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const velocity = Math.random() * 18 + 6;

            this.confetti.push({
                x: x || this.canvas.width / 2,
                y: y || this.canvas.height / 3,
                width: Math.random() * 12 + 5,
                height: Math.random() * 8 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                speedX: Math.cos(angle) * velocity,
                speedY: Math.sin(angle) * velocity - 10,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.4
            });
        }

        // Add money emojis
        const moneyEmojis = ['💵', '💰', '🤑', '💸', '🪙', '💎', '🏆'];
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 12 + 4;

            this.money.push({
                x: x || this.canvas.width / 2,
                y: y || this.canvas.height / 3,
                emoji: moneyEmojis[Math.floor(Math.random() * moneyEmojis.length)],
                size: Math.random() * 25 + 18,
                speedX: Math.cos(angle) * velocity,
                speedY: Math.sin(angle) * velocity - 8,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.15,
                opacity: 1
            });
        }
    }

    rain(duration = 3000, count = 200) {
        const colors = ['#ffd700', '#00c853', '#ffe44d', '#5efc82', '#c9a000', '#ffffff'];
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
                width: Math.random() * 10 + 5,
                height: Math.random() * 6 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                speedX: (Math.random() - 0.5) * 3,
                speedY: Math.random() * 3 + 2,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.25
            });

            spawned++;
        }, interval);
    }
}

// Initialize
let particleSystem = null;

document.addEventListener('DOMContentLoaded', () => {
    particleSystem = new ParticleSystem('particleCanvas');
});

// Export
window.ParticleSystem = ParticleSystem;
window.triggerConfetti = () => {
    if (particleSystem) {
        particleSystem.explode();
        particleSystem.rain(3000, 150);
    }
};
