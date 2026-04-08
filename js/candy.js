// ===== CANDY CLASS =====

class Candy {
    constructor(type, col, row) {
        this.type = type;
        this.col = col;
        this.row = row;
        this.special = SPECIAL.NONE;

        // Visual position (for animations)
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.scale = 1;
        this.targetScale = 1;
        this.alpha = 1;
        this.rotation = 0;

        // Animation state
        this.isMoving = false;
        this.isRemoving = false;
        this.isNew = true;
        this.shimmerPhase = Math.random() * Math.PI * 2;
        this.bouncePhase = 0;
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
    }

    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
        this.isMoving = true;
    }

    update(dt) {
        // Smooth movement
        if (this.isMoving) {
            const speed = 12;
            this.x += (this.targetX - this.x) * speed * dt;
            this.y += (this.targetY - this.y) * speed * dt;

            if (Math.abs(this.x - this.targetX) < 0.5 && Math.abs(this.y - this.targetY) < 0.5) {
                this.x = this.targetX;
                this.y = this.targetY;
                this.isMoving = false;
            }
        }

        // Scale animation
        this.scale += (this.targetScale - this.scale) * 10 * dt;

        // Shimmer animation
        this.shimmerPhase += dt * 2;

        // Bounce on land
        if (this.bouncePhase > 0) {
            this.bouncePhase -= dt * 5;
            if (this.bouncePhase < 0) this.bouncePhase = 0;
        }
    }

    draw(ctx, cellSize) {
        const size = cellSize - CANDY_PADDING * 2;
        const halfSize = size / 2;
        const colors = CANDY_COLORS[this.type];

        ctx.save();
        ctx.translate(this.x, this.y);

        // Apply bounce
        let drawScale = this.scale;
        if (this.bouncePhase > 0) {
            drawScale *= 1 + Math.sin(this.bouncePhase * Math.PI) * 0.15;
        }
        ctx.scale(drawScale, drawScale);
        ctx.globalAlpha = this.alpha;
        ctx.rotate(this.rotation);

        if (this.special === SPECIAL.COLOR_BOMB) {
            this._drawColorBomb(ctx, halfSize);
        } else {
            this._drawCandy(ctx, halfSize, colors);

            if (this.special === SPECIAL.STRIPED_H) {
                this._drawStripes(ctx, halfSize, true);
            } else if (this.special === SPECIAL.STRIPED_V) {
                this._drawStripes(ctx, halfSize, false);
            } else if (this.special === SPECIAL.WRAPPED) {
                this._drawWrapped(ctx, halfSize, colors);
            }
        }

        // Shimmer highlight
        this._drawShimmer(ctx, halfSize);

        ctx.restore();
    }

    _drawCandy(ctx, r, colors) {
        const radius = r * 0.85;

        // Outer glow
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 8;

        // Main body - rounded square candy shape
        ctx.beginPath();
        this._roundedRect(ctx, -radius, -radius, radius * 2, radius * 2, radius * 0.35);
        ctx.fillStyle = colors.main;
        ctx.fill();

        ctx.shadowBlur = 0;

        // Inner gradient overlay
        const grad = ctx.createRadialGradient(
            -radius * 0.3, -radius * 0.3, 0,
            0, 0, radius * 1.2
        );
        grad.addColorStop(0, colors.highlight + '80');
        grad.addColorStop(0.5, 'transparent');
        grad.addColorStop(1, colors.shadow + '60');

        ctx.beginPath();
        this._roundedRect(ctx, -radius, -radius, radius * 2, radius * 2, radius * 0.35);
        ctx.fillStyle = grad;
        ctx.fill();

        // Top highlight
        ctx.beginPath();
        ctx.ellipse(-radius * 0.15, -radius * 0.45, radius * 0.5, radius * 0.25, -0.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();

        // Subtle border
        ctx.beginPath();
        this._roundedRect(ctx, -radius, -radius, radius * 2, radius * 2, radius * 0.35);
        ctx.strokeStyle = colors.outline + '60';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    _drawStripes(ctx, r, horizontal) {
        const radius = r * 0.85;
        ctx.save();
        ctx.beginPath();
        this._roundedRect(ctx, -radius, -radius, radius * 2, radius * 2, radius * 0.35);
        ctx.clip();

        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2.5;

        for (let i = -3; i <= 3; i++) {
            ctx.beginPath();
            if (horizontal) {
                ctx.moveTo(-radius, i * radius * 0.35);
                ctx.lineTo(radius, i * radius * 0.35);
            } else {
                ctx.moveTo(i * radius * 0.35, -radius);
                ctx.lineTo(i * radius * 0.35, radius);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    _drawWrapped(ctx, r, colors) {
        const radius = r * 0.85;
        // Inner square pattern
        ctx.save();
        ctx.beginPath();
        this._roundedRect(ctx, -radius, -radius, radius * 2, radius * 2, radius * 0.35);
        ctx.clip();

        const innerR = radius * 0.55;
        ctx.beginPath();
        this._roundedRect(ctx, -innerR, -innerR, innerR * 2, innerR * 2, innerR * 0.3);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Corner dots
        const dotR = radius * 0.12;
        const dotDist = radius * 0.6;
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([dx, dy]) => {
            ctx.beginPath();
            ctx.arc(dx * dotDist, dy * dotDist, dotR, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fill();
        });

        ctx.restore();
    }

    _drawColorBomb(ctx, r) {
        const radius = r * 0.85;

        // Multi-colored sphere
        ctx.shadowColor = 'rgba(255,255,255,0.5)';
        ctx.shadowBlur = 12;

        // Dark base
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a2e';
        ctx.fill();

        ctx.shadowBlur = 0;

        // Colored segments
        const segColors = ['#ff4757', '#ffa502', '#ffd32a', '#2ed573', '#1e90ff', '#a855f7'];
        segColors.forEach((color, i) => {
            const angle = (i / 6) * Math.PI * 2 + this.shimmerPhase * 0.3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius * 0.8, angle, angle + Math.PI / 3);
            ctx.closePath();
            ctx.fillStyle = color + 'aa';
            ctx.fill();
        });

        // Inner glow
        const bombGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        bombGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
        bombGrad.addColorStop(0.5, 'transparent');
        bombGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = bombGrad;
        ctx.fill();

        // Star in center
        this._drawStar(ctx, 0, 0, radius * 0.3, radius * 0.15, 6, '#fff');

        // Border
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    _drawStar(ctx, cx, cy, outerR, innerR, points, color) {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    _drawShimmer(ctx, r) {
        const shimX = Math.cos(this.shimmerPhase) * r * 0.3;
        const shimY = Math.sin(this.shimmerPhase * 0.7) * r * 0.3;

        ctx.beginPath();
        ctx.arc(shimX - r * 0.2, shimY - r * 0.2, r * 0.08, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + Math.sin(this.shimmerPhase) * 0.15) + ')';
        ctx.fill();
    }

    _roundedRect(ctx, x, y, w, h, r) {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
    }
}
