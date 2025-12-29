/**
 * THE WHEEL - DEGEN EDITION
 * Maximum neon, maximum hype
 */

class SpinningWheel {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.segments = [];
        this.currentRotation = 0;
        this.isSpinning = false;
        this.spinAnimation = null;

        // DEGEN COLOR PALETTE - Maximum vibes
        this.colorPalette = [
            '#39ff14', // neon green
            '#ff1493', // neon pink
            '#00ffff', // cyan
            '#bf00ff', // purple
            '#ffff00', // yellow
            '#ff6600', // orange
            '#ff0033', // red
            '#00ff88', // money green
            '#ff00ff', // magenta
            '#00ff00', // lime
            '#ff69b4', // hot pink
            '#7b68ee', // medium slate blue
            '#ffd700', // gold
            '#00bfff', // deep sky blue
            '#ff4500', // orange red
            '#adff2f', // green yellow
            '#ee82ee', // violet
            '#40e0d0', // turquoise
            '#ff1493', // deep pink
            '#7fff00', // chartreuse
            '#dc143c', // crimson
            '#00ced1', // dark turquoise
            '#ff8c00', // dark orange
            '#9400d3', // dark violet
            '#32cd32', // lime green
        ];

        this.setupCanvas();
        this.drawWheel();
    }

    setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);

        this.centerX = rect.width / 2;
        this.centerY = rect.height / 2;
        this.radius = Math.min(rect.width, rect.height) / 2 - 12;
    }

    updateSegments(segments) {
        this.segments = segments.map((seg, i) => ({
            ...seg,
            color: this.colorPalette[i % this.colorPalette.length]
        }));
        this.drawWheel();
    }

    drawWheel() {
        const ctx = this.ctx;
        const centerX = this.centerX;
        const centerY = this.centerY;
        const radius = this.radius;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.segments.length === 0) {
            this.drawEmptyWheel();
            return;
        }

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(this.currentRotation);
        ctx.translate(-centerX, -centerY);

        let startAngle = -Math.PI / 2;

        // Draw segments with glow effect
        this.segments.forEach((segment, index) => {
            const sliceAngle = (segment.percentage / 100) * 2 * Math.PI;
            const endAngle = startAngle + sliceAngle;

            // Draw segment
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();

            // Create neon gradient
            const gradient = ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, radius
            );

            const baseColor = segment.color;
            gradient.addColorStop(0, this.lightenColor(baseColor, 40));
            gradient.addColorStop(0.4, baseColor);
            gradient.addColorStop(0.8, this.darkenColor(baseColor, 20));
            gradient.addColorStop(1, this.darkenColor(baseColor, 40));

            ctx.fillStyle = gradient;
            ctx.fill();

            // Add inner glow
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const glowGradient = ctx.createRadialGradient(
                centerX, centerY, radius * 0.3,
                centerX, centerY, radius
            );
            glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
            glowGradient.addColorStop(1, 'transparent');
            ctx.fillStyle = glowGradient;
            ctx.fill();
            ctx.restore();

            // Segment border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Bright edge line
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(startAngle) * radius,
                centerY + Math.sin(startAngle) * radius
            );
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw text
            if (segment.percentage > 1.5) {
                this.drawSegmentText(startAngle, sliceAngle, segment.displayAddress, segment.percentage);
            }

            startAngle = endAngle;
        });

        // Draw outer ring
        this.drawOuterRing();

        ctx.restore();
    }

    drawSegmentText(startAngle, sliceAngle, text, percentage) {
        const ctx = this.ctx;
        const centerX = this.centerX;
        const centerY = this.centerY;

        const midAngle = startAngle + sliceAngle / 2;
        const textRadius = this.radius * 0.68;
        const textX = centerX + Math.cos(midAngle) * textRadius;
        const textY = centerY + Math.sin(midAngle) * textRadius;

        ctx.save();
        ctx.translate(textX, textY);

        let rotation = midAngle + Math.PI / 2;
        if (midAngle > Math.PI / 2 && midAngle < (3 * Math.PI / 2)) {
            rotation += Math.PI;
        }
        ctx.rotate(rotation);

        const fontSize = Math.max(9, Math.min(14, percentage * 1.2));
        ctx.font = `bold ${fontSize}px 'Bebas Neue', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Glow effect for text
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Black outline
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(text, 0, 0);

        // White text
        ctx.fillStyle = '#fff';
        ctx.fillText(text, 0, 0);

        ctx.restore();
    }

    drawOuterRing() {
        const ctx = this.ctx;
        const centerX = this.centerX;
        const centerY = this.centerY;
        const radius = this.radius;

        // Outer neon ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = '#bf00ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#bf00ff';
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Second ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 8, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Tick marks
        const numTicks = 60;
        for (let i = 0; i < numTicks; i++) {
            const angle = (i / numTicks) * 2 * Math.PI - Math.PI / 2;
            const isLarge = i % 5 === 0;
            const innerR = radius - (isLarge ? 10 : 5);
            const outerR = radius - 1;

            const x1 = centerX + Math.cos(angle) * innerR;
            const y1 = centerY + Math.sin(angle) * innerR;
            const x2 = centerX + Math.cos(angle) * outerR;
            const y2 = centerY + Math.sin(angle) * outerR;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);

            if (isLarge) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 5;
            } else {
                ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
                ctx.lineWidth = 1;
                ctx.shadowBlur = 0;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Center shadow
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.16, 0, 2 * Math.PI);
        const centerGradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, radius * 0.16
        );
        centerGradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
        centerGradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
        ctx.fillStyle = centerGradient;
        ctx.fill();
    }

    drawEmptyWheel() {
        const ctx = this.ctx;
        const centerX = this.centerX;
        const centerY = this.centerY;
        const radius = this.radius;

        // Animated gradient background
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);

        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, radius
        );
        gradient.addColorStop(0, '#1a0030');
        gradient.addColorStop(0.5, '#120020');
        gradient.addColorStop(1, '#0a0015');

        ctx.fillStyle = gradient;
        ctx.fill();

        // Neon border
        ctx.strokeStyle = '#bf00ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#bf00ff';
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Loading text
        ctx.font = 'bold 20px "Bebas Neue", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#39ff14';
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 10;
        ctx.fillText('LOADING...', centerX, centerY - 10);
        ctx.font = '14px "Bebas Neue", sans-serif';
        ctx.fillStyle = '#ff1493';
        ctx.shadowColor = '#ff1493';
        ctx.fillText('FETCHING DEGENS', centerX, centerY + 15);
        ctx.shadowBlur = 0;
    }

    lightenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `rgb(${R}, ${G}, ${B})`;
    }

    darkenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return `rgb(${R}, ${G}, ${B})`;
    }

    spin(targetDegree, duration = 5000, onComplete) {
        if (this.isSpinning) return;

        this.isSpinning = true;
        const container = this.canvas.closest('.wheel-container');
        if (container) container.classList.add('spinning');

        // More rotations for excitement
        const fullRotations = 6 + Math.floor(Math.random() * 4); // 6-9 rotations
        const totalRotation = (fullRotations * 360) + (360 - targetDegree);
        const totalRadians = (totalRotation * Math.PI) / 180;

        const startRotation = this.currentRotation;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth deceleration
            const eased = 1 - Math.pow(1 - progress, 4);

            this.currentRotation = startRotation + (totalRadians * eased);
            this.drawWheel();

            if (progress < 1) {
                this.spinAnimation = requestAnimationFrame(animate);
            } else {
                this.currentRotation = this.currentRotation % (2 * Math.PI);
                this.isSpinning = false;

                if (container) container.classList.remove('spinning');
                if (onComplete) onComplete();
            }
        };

        this.spinAnimation = requestAnimationFrame(animate);
    }

    stop() {
        if (this.spinAnimation) {
            cancelAnimationFrame(this.spinAnimation);
            this.spinAnimation = null;
            this.isSpinning = false;

            const container = this.canvas.closest('.wheel-container');
            if (container) container.classList.remove('spinning');
        }
    }

    highlightSegment(index) {
        const segment = this.segments[index];
        if (segment) {
            segment.isWinner = true;
            this.drawWheel();

            setTimeout(() => {
                segment.isWinner = false;
                this.drawWheel();
            }, 3000);
        }
    }

    resize() {
        this.setupCanvas();
        this.drawWheel();
    }
}

window.SpinningWheel = SpinningWheel;
