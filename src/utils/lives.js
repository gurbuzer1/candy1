import { LIVES_MAX, LIFE_REGEN_MS } from '../constants/economy';

// Recompute available lives based on elapsed time since lastLifeRegenMs.
// Returns { lives, lastLifeRegenMs } that should be written back into save.
// Cihaz saati GERI alinabilir. `lastLifeRegenMs` gelecekte kalirsa elapsed
// negatif olur, settleLives erken doner ve anchor KENDINI ONARMAZ: olculdu,
// {lives:0, anchor: now + 30 gun} -> lives 0'da kilitli, msUntilNextLife 30 gun
// donduruyor ve HudBar bunu "43220:00" olarak basiyor, cikis yolu yok.
// Kural: anchor asla `now`u ASAMAZ. Boylece en kotu bekleme LIFE_REGEN_MS'tir.
function normalizeAnchor(value, now) {
  if (!Number.isFinite(value) || value <= 0) return now;
  return Math.min(value, now);
}

// ESKI (KIRIK) HALI — silinmedi, altta yorumda duruyor:
//   function normalizeLives(value) {
//     if (!Number.isFinite(value)) return LIVES_MAX;   // <-- BOZUK KAYIT ODULU
//     return Math.min(LIVES_MAX, Math.max(0, Math.trunc(value)));
//   }
// Olculdu: settleLives({lives:"abc"}) -> 5, settleLives({lives:{}}) -> 5,
// JSON'dan gelen {"lives":1e400} -> Infinity -> 5. Yani kaydi BOZMAK tam can
// veriyordu: "sayisal degilse tam doldur" kurali istismarin ta kendisi.
//
// YENI KURAL — alanin YOK olmasi ile BOZUK olmasi ayri seylerdir:
//   - alan hic yok / null            -> yeni oyuncu, LIVES_MAX (mesru varsayilan)
//   - sayi veya sayisal metin        -> [0, LIVES_MAX] araligina kirpilir
//   - baska her sey (NaN/Infinity/{}/[]/"abc"/true) -> 0 (odul YOK)
function normalizeLives(value) {
  if (value == null) return LIVES_MAX;
  let n;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string' && value.trim() !== '') n = Number(value);
  else n = NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.min(LIVES_MAX, Math.max(0, Math.trunc(n)));
}

export function settleLives(save, now = Date.now()) {
  let { lives, lastLifeRegenMs } = save;
  // ESKI SATIR (silinmedi): `if (lives == null) lives = LIVES_MAX;`
  // Kurali IKI yere yaymak, "alan yok" dalini normalizeLives icinde ULASILMAZ
  // koda cevirmisti: ters yon mutasyon sinavinda `null -> 0` mutanti YESIL
  // gecti (yani o dali hicbir test tutmuyordu). Karar tek noktada:
  lives = normalizeLives(lives);
  lastLifeRegenMs = normalizeAnchor(lastLifeRegenMs, now);

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
  // ESKI SATIR (silinmedi): `if (normalizeLives(save.lives ?? LIVES_MAX) >= LIVES_MAX) return 0;`
  // `?? LIVES_MAX` da ayni dali ikinci kez yaziyordu; kural normalizeLives'ta.
  if (normalizeLives(save.lives) >= LIVES_MAX) return 0;
  // Anchor gelecekteyse kirpilir: geri sayim hicbir zaman LIFE_REGEN_MS'i
  // (20:00) asamaz, "43220:00" gibi bir sayac artik imkansiz.
  const last = normalizeAnchor(save.lastLifeRegenMs, now);
  const elapsed = now - last;
  return Math.min(LIFE_REGEN_MS, Math.max(0, LIFE_REGEN_MS - elapsed));
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
