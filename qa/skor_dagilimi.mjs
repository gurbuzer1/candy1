/**
 * SKOR DAGILIMI ORNEKLEYICISI (kalibrasyon girdisi).
 *
 * NEDEN: skor dagilimi seviyenin HEDEFLERINE degil YALNIZCA hamle sayisina
 * baglidir (hedefler oyunu hic etkilemez, sadece yildiz sayar). Tablodaki 30
 * seviye 6 farkli hamle degeri kullaniyor, yani 30 orneklem yerine 6 orneklem
 * yeter — ve ayni hamle degerini paylasan seviyeler AYNI ornekten okundugu
 * icin aralarindaki "ters donus" olcum gurultusu SIFIR olur.
 *
 * Kullanim: node qa/skor_dagilimi.mjs [N] [SEED] [cikti.json]
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { orneklemHamle } from './autoplay2.mjs';
import { LEVELS } from '../src/constants/levels.js';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 2000);
const SEED = Number(process.argv[3] || 20260807);
const CIKTI = process.argv[4] || path.join(KOK, 'qa', 'skor_dagilimi.json');

const hamleler = [...new Set(LEVELS.map((l) => l.moves))].sort((a, b) => a - b);
const out = { N, SEED, hamleler: {} };

for (const m of hamleler) {
  const t0 = Date.now();
  const sc = orneklemHamle(m, N, SEED).sort((a, b) => a - b);
  out.hamleler[m] = sc;
  const q = (p) => sc[Math.min(sc.length - 1, Math.floor(p * sc.length))];
  console.log(`hamle ${String(m).padStart(2)} | n=${N} | ${((Date.now() - t0) / 1000).toFixed(1)}s | p05=${q(0.05)} p25=${q(0.25)} p50=${q(0.5)} p75=${q(0.75)} p95=${q(0.95)}`);
}

writeFileSync(CIKTI, JSON.stringify(out));
console.log('yazildi:', CIKTI);
