/**
 * PROBE — "derlenebilirlik citasi >=25 idi, gercek sayi 31" bulgusunun olcumu.
 * Ayrica M8b mutasyonunun (src/utils taramadan dusuyor) ESKI citayi neden
 * GECECEGINI sayiyla gosterir.
 *
 * Kullanim: node qa/probe_derleme_citasi.mjs
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function tara(disla) {
  const bulunan = [];
  (function gez(dizin) {
    for (const girdi of readdirSync(dizin, { withFileTypes: true })) {
      const yol = path.join(dizin, girdi.name);
      if (girdi.isDirectory()) {
        if (!disla.test(yol)) gez(yol);
      } else if (/\.jsx?$/.test(girdi.name)) {
        bulunan.push(yol);
      }
    }
  })(path.join(KOK, 'src'));
  bulunan.push(path.join(KOK, 'App.js'));
  return bulunan;
}

const normal = tara(/node_modules|\.git/);
const m8b = tara(/node_modules|\.git|utils/);   // M8b mutasyonu

console.log('ESKI CITA               : dosyalar.length >= 25');
console.log('gercek dosya sayisi     :', normal.length);
console.log('  -> cita ile arasindaki bosluk:', normal.length - 25, 'dosya sessizce kaybolabilirdi');
console.log('M8b (src/utils dusuyor) :', m8b.length, 'dosya');
console.log('  -> ESKI cita (>=25) M8b ile:', m8b.length >= 25 ? 'YESIL GECERDI (kor nokta)' : 'kirmizi yanardi');
console.log('  -> YENI cita (sabit liste):', 'kayip', normal.length - m8b.length, 'dosya adiyla raporlanir');
