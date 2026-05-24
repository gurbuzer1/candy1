import { LIVES_MAX, LIFE_REGEN_MS } from '../constants/economy';

// Recompute available lives based on elapsed time since lastLifeRegenMs.
// Returns { lives, lastLifeRegenMs } that should be written back into save.
export function settleLives(save, now = Date.now()) {
  let { lives, lastLifeRegenMs } = save;
  if (lives == null) lives = LIVES_MAX;
  if (!lastLifeRegenMs) lastLifeRegenMs = now;

  if (lives >= LIVES_MAX) {
    // Cap reached — keep regen anchor at now so the timer doesn't drift.
    return { lives: LIVES_MAX, lastLifeRegenMs: now };
  }

  const elapsed = now - lastLifeRegenMs;
  if (elapsed < LIFE_REGEN_MS) {
    return { lives, lastLifeRegenMs };
  }

  const regenCount = Math.floor(elapsed / LIFE_REGEN_MS);
  const newLives = Math.min(LIVES_MAX, lives + regenCount);
  const carryMs = elapsed - regenCount * LIFE_REGEN_MS;

  return {
    lives: newLives,
    lastLifeRegenMs: newLives >= LIVES_MAX ? now : now - carryMs,
  };
}

// Returns ms until the next life regen, or 0 if lives are full.
export function msUntilNextLife(save, now = Date.now()) {
  if ((save.lives ?? LIVES_MAX) >= LIVES_MAX) return 0;
  const last = save.lastLifeRegenMs || now;
  const elapsed = now - last;
  return Math.max(0, LIFE_REGEN_MS - elapsed);
}

export function formatMsClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Spend one life. Returns updated { lives, lastLifeRegenMs } or null if no lives.
export function takeLife(save, now = Date.now()) {
  const settled = settleLives(save, now);
  if (settled.lives <= 0) return null;
  return {
    lives: settled.lives - 1,
    // If lives were full before, kick off the regen clock from now.
    lastLifeRegenMs: settled.lives === LIVES_MAX ? now : settled.lastLifeRegenMs,
  };
}
