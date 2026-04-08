// ===== APP BOOTSTRAP =====

(function () {
    'use strict';

    // Wait for DOM
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    // Create game instance
    const game = new Game(canvas);

    // Start the game loop (renders even on menu screen for background effects)
    game.run();

    // Prevent default touch behaviors that interfere with gameplay
    document.addEventListener('touchmove', (e) => {
        if (e.target.closest('#game-canvas')) {
            e.preventDefault();
        }
    }, { passive: false });

    // Handle visibility change (pause/resume audio context)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Game naturally pauses since requestAnimationFrame stops
        } else {
            audio.resume();
            game.lastTime = 0; // Reset dt to avoid big jump
        }
    });

    // Log init
    console.log('Sugar Blast initialized!');
})();
