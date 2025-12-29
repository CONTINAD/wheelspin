/**
 * $WHEEL - Rainbow Wheel Canvas Component
 * Matches the colorful brand wheel design
 */

class SpinningWheel {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.segments = [];
        this.currentRotation = 0;
        this.isSpinning = false;
        this.spinAnimation = null;

        // Rainbow colors matching the brand wheel
        this.colorPalette = [
            '#e53935', // Red
            '#fb8c00', // Orange
            '#fdd835', // Yellow
            '#43a047', // Green
            '#1e88e5', // Blue
            '#8e24aa', // Purple
            '#d81b60', // Pink/Magenta
            '#00acc1', // Cyan
            '#7cb342', // Light Green
            '#f4511e', // Deep Orange
            '#5e35b1', // Deep Purple
            '#00897b', // Teal
            '#ffb300', // Amber
            '#3949ab', // Indigo
            '#c0ca33', // Lime
            '#e53935', // Red
            '#fb8c00', // Orange
            '#fdd835', // Yellow
            '#43a047', // Green
            '#1e88e5', // Blue
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

        // Draw segments
        this.segments.forEach((segment, index) => {
            const sliceAngle = (segment.percentage / 100) * 2 * Math.PI;
            const endAngle = startAngle + sliceAngle;

            // Draw segment
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();

            // Create gradient for 3D effect
            const midAngle = startAngle + sliceAngle / 2;
            const gradient = ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, radius
            );

            const baseColor = segment.color;
            gradient.addColorStop(0, this.lightenColor(baseColor, 30));
            gradient.addColorStop(0.5, baseColor);
            gradient.addColorStop(1, this.darkenColor(baseColor, 15));

            ctx.fillStyle = gradient;
            ctx.fill();

            // Gold separator lines
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(startAngle) * radius,
                centerY + Math.sin(startAngle) * radius
            );
            ctx.strokeStyle = '#c9a000';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw text
            if (segment.percentage > 1.5) {
                this.drawSegmentText(startAngle, sliceAngle, segment.displayAddress, segment.percentage);
            }

            startAngle = endAngle;
        });

        // Draw gold outer ring
        this.drawGoldRing();

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

        const fontSize = Math.max(9, Math.min(13, percentage * 1.2));
        ctx.font = `700 ${fontSize}px 'Fredoka', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Black outline for readability
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 3;
        ctx.strokeText(text, 0, 0);

        // White text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, 0, 0);

        ctx.restore();
    }

    drawGoldRing() {
        const ctx = this.ctx;
        const centerX = this.centerX;
        const centerY = this.centerY;
        const radius = this.radius;

        // Outer gold ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 6, 0, 2 * Math.PI);
        const goldGradient = ctx.createRadialGradient(
            centerX, centerY, radius,
            centerX, centerY, radius + 8
        );
        goldGradient.addColorStop(0, '#c9a000');
        goldGradient.addColorStop(0.5, '#ffd700');
        goldGradient.addColorStop(1, '#c9a000');
        ctx.strokeStyle = goldGradient;
        ctx.lineWidth = 8;
        ctx.stroke();

        // Inner gold accent
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 1, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ffe44d';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Center hub shadow
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.12, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();
    }

    drawEmptyWheel() {
        const ctx = this.ctx;
        const centerX = this.centerX;
        const centerY = this.centerY;
        const radius = this.radius;

        // Background circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);

        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, radius
        );
        gradient.addColorStop(0, '#1a3a1a');
        gradient.addColorStop(1, '#0d1f0d');

        ctx.fillStyle = gradient;
        ctx.fill();

        // Gold border
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 6;
        ctx.stroke();

        // Loading text
        ctx.font = '700 18px "Fredoka", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd700';
        ctx.fillText('Loading...', centerX, centerY - 8);
        ctx.font = '500 14px "Fredoka", sans-serif';
        ctx.fillStyle = '#00c853';
        ctx.fillText('Fetching holders', centerX, centerY + 15);
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

        const fullRotations = 5 + Math.floor(Math.random() * 3); // 5-7 rotations
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
