/**
 * KANIT PROBU — "[KUCUK] Can kapisi 'Next Level' yolundan atlaniyor".
 *
 * NEDEN VAR: BULGULAR.md'deki eski kanit komutu SCRATCHPAD'e dosya kopyalayip
 * oradan calisiyordu (`.../Temp/claude/.../scratchpad/proof/lives.mjs`).
 * Scratchpad oturuma ozeldir ve silinir -> kanit komutu kisa surede
 * CALISTIRILAMAZ hale gelir, yani bulgu "dogrulanamaz" olur. Bu prob ayni seyi
 * DEPO ICINDEN, kopyasiz olcer: `src/utils/lives.js` uzantisiz goreli import
 * kullandigi icin dogrudan `node` ile yuklenemiyordu; burada Metro'nun
 * transform'unu kullanan kosum takimi (tests/qa_akis_render.mjs) yukluyor.
 *
 * Kullanim: node qa/probe_can_kapisi.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModule } from '../tests/qa_akis_render.mjs';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { takeLife } = loadModule(path.join(KOK, 'src', 'utils', 'lives.js'));
const app = loadModule(path.join(KOK, 'App.js'));

const save = { lives: 0, lastLifeRegenMs: Date.now() };
const u = takeLife(save);
console.log('takeLife(0 can) ->', u, '   (null = can DUSURULEMEDI)');

// Duzeltmeden SONRAKI durum: App.js artik tek gecitli bir karar fonksiyonu
// disa aciyor. Bulgu tarihinde bu fonksiyon YOKTU ve `setScreen("game")`
// kosulsuz calisiyordu.
console.log('App.canStartLevel var mi   :', typeof app.canStartLevel === 'function');
if (typeof app.canStartLevel === 'function') {
  console.log('canStartLevel(0 can)       :', JSON.stringify(app.canStartLevel(save)));
  console.log('canStartLevel(3 can)       :', JSON.stringify(app.canStartLevel({ ...save, lives: 3 })));
}
console.log('App.nextLevelDecision var mi:', typeof app.nextLevelDecision === 'function');
if (typeof app.nextLevelDecision === 'function') {
  console.log('nextLevelDecision(sev 5, 0 can):',
    JSON.stringify(app.nextLevelDecision(5, save)));
  console.log('nextLevelDecision(sev 5, 3 can):',
    JSON.stringify(app.nextLevelDecision(5, { ...save, lives: 3 })));
}
