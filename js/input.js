// ===== INPUT HANDLER =====

class InputHandler {
    constructor(canvas) {
        this.canvas = canvas;
        this.onCellTap = null;
        this.onSwipe = null;

        this.startX = 0;
        this.startY = 0;
        this.isDragging = false;
        this.startCell = null;
        this.minSwipeDistance = 20;

        this._bindEvents();
    }

    _bindEvents() {
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this._handleStart(touch.clientX, touch.clientY);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this._handleMove(touch.clientX, touch.clientY);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this._handleEnd();
        }, { passive: false });

        // Mouse events (for desktop testing)
        this.canvas.addEventListener('mousedown', (e) => {
            this._handleStart(e.clientX, e.clientY);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this._handleMove(e.clientX, e.clientY);
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this._handleEnd();
        });
    }

    _getCanvasCoords(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    _handleStart(clientX, clientY) {
        const coords = this._getCanvasCoords(clientX, clientY);
        this.startX = coords.x;
        this.startY = coords.y;
        this.isDragging = true;
        this.swiped = false;
    }

    _handleMove(clientX, clientY) {
        if (!this.isDragging || this.swiped) return;

        const coords = this._getCanvasCoords(clientX, clientY);
        const dx = coords.x - this.startX;
        const dy = coords.y - this.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist >= this.minSwipeDistance) {
            // Determine swipe direction
            let dirCol = 0, dirRow = 0;
            if (Math.abs(dx) > Math.abs(dy)) {
                dirCol = dx > 0 ? 1 : -1;
            } else {
                dirRow = dy > 0 ? 1 : -1;
            }

            if (this.onSwipe) {
                this.onSwipe(this.startX, this.startY, dirCol, dirRow);
            }
            this.swiped = true;
            this.isDragging = false;
        }
    }

    _handleEnd() {
        if (this.isDragging && !this.swiped) {
            // It was a tap
            if (this.onCellTap) {
                this.onCellTap(this.startX, this.startY);
            }
        }
        this.isDragging = false;
        this.swiped = false;
    }
}
