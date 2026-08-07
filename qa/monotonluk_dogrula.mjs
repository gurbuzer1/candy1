/**
 * ZORLUK EGRISI MONOTONLUK OLCUMU — hem CLI dogrulayicisi hem de
 * `tests/seviye_tablosu.test.js`'in KULLANDIGI kutuphane.
 *
 * ==========================================================================
 * NEDEN BOYLE OLCULUYOR
 * ==========================================================================
 * Naif olcum: 30 seviyenin her birini n kez oynat, gecme oranlarini karsilastir.
 * Bu olcum GURULTULU: n=400'de bile bitisik iki seviyenin orani arasindaki
 * ikili-dagilim standart sapmasi ~3,5 puan; yani hicbir sey bozuk olmasa bile
 * 29 gecisin bir kismi "ters donmus" gorunur. Rastgele kirmizi yanan test
 * testsizlikten beterdir.
 *
 * BU OLCUM: skor dagilimi seviyenin HEDEFLERINE degil YALNIZCA hamle sayisina
 * bagli oldugu icin (hedefler yalnizca yildiz sayar, oyunu etkilemez) ayni
 * hamle sayisini paylasan seviyeler AYNI ORNEKLEMDEN okunur. Sonuc:
 *   - grup ICI 25 gecisde gurultu SIFIR (ayni ornek, artan esik),
 *   - yalnizca 5 hamle-siniri gecisinde ornekleme gurultusu kalir
 *     — ve zaten hata TAM ORADAYDI (10->11, 15->16, 20->21, 25->26).
 * Ustelik 30 x n yerine 6 x n oyun oynanir: 5 kat hizli.
 *
 * Rastgelelik TOHUMLU: ayni (n, seed) ikilisi ayni sayilari verir, yani test
 * deterministiktir.
 *
 * Kullanim: node qa/monotonluk_dogrula.mjs [n] [seed1,seed2,...]
 */
import { orneklemHamle } from './autoplay2.mjs';
import { LEVELS } from '../src/constants/levels.js';

/**
 * Her seviye icin OLCULEN gecme oranlari.
 * @returns {{ hamleler:number[], oranlar:{t1:number[],t2:number[],t3:number[]},
 *             ornekBoyu:number, seed:number }}
 */
export function olcumTablosu(n, seed) {
  const hamleler = [...new Set(LEVELS.map((l) => l.moves))].sort((a, b) => a - b);
  const ornekler = new Map();
  for (const m of hamleler) ornekler.set(m, orneklemHamle(m, n, seed));

  const oran = (S, v) => S.filter((s) => s >= v).length / S.length;
  const oranlar = { t1: [], t2: [], t3: [] };
  LEVELS.forEach((lv) => {
    const S = ornekler.get(lv.moves);
    oranlar.t1.push(oran(S, lv.target1));
    oranlar.t2.push(oran(S, lv.target2));
    oranlar.t3.push(oran(S, lv.target3));
  });
  return { hamleler: LEVELS.map((l) => l.moves), oranlar, ornekBoyu: n, seed };
}

/** Egrideki TERS DONUSLER: oran[i] - oran[i-1] > 0 olan gecisler. */
export function tersDonusler(oranlar, hamleler) {
  const out = [];
  for (const ad of ['t1', 't2', 't3']) {
    const s = oranlar[ad];
    for (let i = 1; i < s.length; i++) {
      const fark = s[i] - s[i - 1];
      if (fark > 0) {
        out.push({
          alan: ad, sev: i + 1, fark,
          onceki: s[i - 1], simdi: s[i],
          hamleSiniri: hamleler[i] !== hamleler[i - 1],
        });
      }
    }
  }
  return out;
}

const dogrudan = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('qa/monotonluk_dogrula.mjs');
if (dogrudan) {
  const n = Number(process.argv[2] || 300);
  const seeds = (process.argv[3] || '1,2,3,4,5').split(',').map(Number);
  let enBuyuk = 0;
  for (const seed of seeds) {
    const t0 = Date.now();
    const { oranlar, hamleler } = olcumTablosu(n, seed);
    const ters = tersDonusler(oranlar, hamleler);
    const enKotu = ters.reduce((a, b) => (b.fark > a ? b.fark : a), 0);
    if (enKotu > enBuyuk) enBuyuk = enKotu;
    console.log(`\nseed=${seed} n=${n}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    console.log('  1y: ' + oranlar.t1.map((v) => (v * 100).toFixed(0).padStart(3)).join(''));
    console.log('  2y: ' + oranlar.t2.map((v) => (v * 100).toFixed(0).padStart(3)).join(''));
    console.log('  3y: ' + oranlar.t3.map((v) => (v * 100).toFixed(0).padStart(3)).join(''));
    if (ters.length === 0) console.log('  ters donus YOK');
    for (const t of ters) {
      console.log(`  ters ${t.alan} sev ${t.sev - 1}->${t.sev}: ${(t.onceki * 100).toFixed(1)}% -> ${(t.simdi * 100).toFixed(1)}%` +
        ` (+${(t.fark * 100).toFixed(1)} puan)${t.hamleSiniri ? '  [HAMLE SINIRI]' : ''}`);
    }
  }
  console.log(`\nTUM TOHUMLARDA EN BUYUK TERS DONUS: +${(enBuyuk * 100).toFixed(1)} puan`);
}
