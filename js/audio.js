// ===== AUDIO MANAGER =====
// Generates sounds programmatically using Web Audio API

class AudioManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            this.enabled = false;
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(frequency, duration, type = 'sine', volume = 0.15, delay = 0) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.value = frequency;

        const now = this.ctx.currentTime + delay;
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
    }

    playSelect() {
        this.playTone(587, 0.1, 'sine', 0.12);
    }

    playSwap() {
        this.playTone(440, 0.08, 'sine', 0.1);
        this.playTone(554, 0.08, 'sine', 0.1, 0.06);
    }

    playMatch(cascadeLevel = 0) {
        const baseFreq = 523 + cascadeLevel * 80;
        this.playTone(baseFreq, 0.15, 'sine', 0.12);
        this.playTone(baseFreq * 1.25, 0.15, 'sine', 0.1, 0.05);
        this.playTone(baseFreq * 1.5, 0.12, 'sine', 0.08, 0.1);
    }

    playSpecial() {
        this.playTone(523, 0.1, 'square', 0.08);
        this.playTone(659, 0.1, 'square', 0.08, 0.08);
        this.playTone(784, 0.15, 'square', 0.08, 0.16);
        this.playTone(1047, 0.2, 'sine', 0.1, 0.24);
    }

    playColorBomb() {
        for (let i = 0; i < 6; i++) {
            this.playTone(300 + i * 120, 0.12, 'sawtooth', 0.06, i * 0.04);
        }
        this.playTone(1200, 0.4, 'sine', 0.12, 0.25);
    }

    playInvalidSwap() {
        this.playTone(200, 0.15, 'square', 0.08);
        this.playTone(160, 0.2, 'square', 0.08, 0.1);
    }

    playLevelComplete() {
        const notes = [523, 587, 659, 784, 880, 1047];
        notes.forEach((freq, i) => {
            this.playTone(freq, 0.2, 'sine', 0.1, i * 0.1);
        });
    }

    playLevelFailed() {
        this.playTone(400, 0.3, 'sine', 0.1);
        this.playTone(350, 0.3, 'sine', 0.1, 0.2);
        this.playTone(300, 0.5, 'sine', 0.1, 0.4);
    }

    playFall() {
        this.playTone(350, 0.06, 'sine', 0.04);
    }
}

const audio = new AudioManager();
