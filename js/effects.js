// ===== VISUAL EFFECTS =====

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 300;
        this.vy = (Math.random() - 0.5) * 300 - 100;
        this.life = 1;
        this.decay = 1.5 + Math.random() * 1.5;
        this.size = 3 + Math.random() * 4;
        this.gravity = 400;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 10;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += this.gravity * dt;
        this.life -= this.decay * dt;
        this.rotation += this.rotSpeed * dt;
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}

class ScorePopup {
    constructor(x, y, score, color = '#fff') {
        this.x = x;
        this.y = y;
        this.score = '+' + score;
        this.color = color;
        this.life = 1;
        this.vy = -60;
        this.scale = 0;
        this.targetScale = 1;
    }

    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt * 0.8;
        this.scale += (this.targetScale - this.scale) * 8 * dt;
        if (this.life < 0.3) {
            this.targetScale = 0;
        }
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = 'bold 22px "Fredoka One", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        ctx.strokeText(this.score, 0, 0);
        ctx.fillStyle = this.color;
        ctx.fillText(this.score, 0, 0);
        ctx.restore();
    }
}

class ShockwaveEffect {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = 80;
        this.life = 1;
    }

    update(dt) {
        this.radius += 200 * dt;
        this.life -= dt * 3;
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life) * 0.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }
}

class LineEffect {
    constructor(x, y, horizontal) {
        this.x = x;
        this.y = y;
        this.horizontal = horizontal;
        this.length = 0;
        this.maxLength = 500;
        this.life = 1;
        this.width = 6;
    }

    update(dt) {
        this.length += 1200 * dt;
        this.life -= dt * 2.5;
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life) * 0.8;

        const grad = ctx.createLinearGradient(
            this.horizontal ? this.x - this.length : this.x,
            this.horizontal ? this.y : this.y - this.length,
            this.horizontal ? this.x + this.length : this.x,
            this.horizontal ? this.y : this.y + this.length
        );
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.3, '#fff');
        grad.addColorStop(0.7, '#fff');
        grad.addColorStop(1, 'transparent');

        ctx.strokeStyle = grad;
        ctx.lineWidth = this.width * this.life;
        ctx.beginPath();
        if (this.horizontal) {
            ctx.moveTo(this.x - this.length, this.y);
            ctx.lineTo(this.x + this.length, this.y);
        } else {
            ctx.moveTo(this.x, this.y - this.length);
            ctx.lineTo(this.x, this.y + this.length);
        }
        ctx.stroke();
        ctx.restore();
    }
}

class EffectsManager {
    constructor() {
        this.particles = [];
        this.popups = [];
        this.effects = [];
    }

    spawnMatchParticles(x, y, candyType, count = 8) {
        const colors = CANDY_COLORS[candyType];
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y,
                [colors.main, colors.highlight, '#fff'][Math.floor(Math.random() * 3)]
            ));
        }
    }

    spawnScorePopup(x, y, score, color) {
        this.popups.push(new ScorePopup(x, y, score, color));
    }

    spawnShockwave(x, y) {
        this.effects.push(new ShockwaveEffect(x, y));
    }

    spawnLineEffect(x, y, horizontal) {
        this.effects.push(new LineEffect(x, y, horizontal));
    }

    spawnColorBombEffect(x, y) {
        for (let i = 0; i < 20; i++) {
            const color = CANDY_COLORS[Math.floor(Math.random() * CANDY_COUNT)].main;
            const p = new Particle(x, y, color);
            p.vx = (Math.random() - 0.5) * 500;
            p.vy = (Math.random() - 0.5) * 500;
            p.size = 4 + Math.random() * 6;
            p.decay = 1;
            this.particles.push(p);
        }
        this.effects.push(new ShockwaveEffect(x, y));
    }

    update(dt) {
        this.particles = this.particles.filter(p => p.update(dt));
        this.popups = this.popups.filter(p => p.update(dt));
        this.effects = this.effects.filter(e => e.update(dt));
    }

    draw(ctx) {
        this.effects.forEach(e => e.draw(ctx));
        this.particles.forEach(p => p.draw(ctx));
        this.popups.forEach(p => p.draw(ctx));
    }

    get isActive() {
        return this.particles.length > 0 || this.popups.length > 0 || this.effects.length > 0;
    }
}
