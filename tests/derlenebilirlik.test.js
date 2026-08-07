/**
 * DERLENEBILIRLIK SINAVI — "yesil suite, olu app" tuzagina karsi.
 *
 * NEDEN VAR: 2026-08-07'de bu depoda 9/9 test YESILDI ve uygulama HIC ACILMIYORDU.
 * `src/constants/game.js` icinde ayni ad iki kez disa aciliyordu
 * ("`COLS` has already been exported") -> babel SyntaxError -> o dosyayi import
 * eden 9 dosyanin hepsi, yani her ekran, olu. Testler bunu goremedi cunku
 * dogrudan `kural.js`'i import ediyorlardi; bozuk dosyaya hic dokunmuyorlardi.
 *
 * Bu dosya o korlugu kapatir: TEK TEK her kaynak dosyayi Metro'nun kullandigi
 * transform ile (babel-preset-expo) derler. Bir dosya derlenmiyorsa uygulama
 * calismiyordur; testlerin geri kalani ne derse desin.
 *
 * ⚠️ Bu sinav "derleniyor" der, "dogru calisiyor" DEMEZ. Kural mantigi
 * tahta_motoru.test.js'te; dokunma/animasyon ikisinin de kapsami disinda.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const KOK = join(dirname(fileURLToPath(import.meta.url)), "..");

/** `src/` altindaki tum .js/.jsx dosyalari + kokteki App.js. */
function kaynakDosyalari() {
  const bulunan = [];
  (function tara(dizin) {
    for (const girdi of readdirSync(dizin, { withFileTypes: true })) {
      const yol = join(dizin, girdi.name);
      if (girdi.isDirectory()) {
        if (!/node_modules|\.git/.test(yol)) tara(yol);
      } else if (/\.jsx?$/.test(girdi.name)) {
        bulunan.push(yol);
      }
    }
  })(join(KOK, "src"));
  bulunan.push(join(KOK, "App.js"));
  return bulunan;
}

test("her kaynak dosya Metro'nun transform'uyla DERLENIR", () => {
  const babel = require("@babel/core");
  const dosyalar = kaynakDosyalari();

  assert.ok(
    dosyalar.length >= 25,
    `beklenen >=25 kaynak dosya, bulunan ${dosyalar.length} — tarama yolu bozulmus olabilir`,
  );

  const hatalar = [];
  for (const yol of dosyalar) {
    try {
      babel.transformSync(readFileSync(yol, "utf8"), {
        filename: yol,
        presets: [["babel-preset-expo", {}]],
        babelrc: false,
        configFile: false,
      });
    } catch (e) {
      hatalar.push(`${yol.slice(KOK.length + 1)} -> ${e.message.split("\n")[0]}`);
    }
  }

  assert.deepEqual(
    hatalar,
    [],
    `derlenmeyen dosya var; bu dosyalari import eden HER ekran olu:\n  ${hatalar.join("\n  ")}`,
  );
});

test("game.js'ten import edilen HER ad gercekten disa aciliyor", () => {
  // Derleme gecse bile eksik bir ad calisma aninda `undefined` olur ve
  // ekran sessizce bozulur (CELL_SIZE undefined -> tahta cizilmez).
  const disaAcilanlar = (kaynak) => [
    ...[...kaynak.matchAll(/export const (\w+)/g)].map((m) => m[1]),
    ...[...kaynak.matchAll(/^export \{([^}]*)\}/gm)].flatMap((m) =>
      m[1].split(",").map((x) => x.trim()).filter(Boolean),
    ),
  ];

  const gameJs = new Set(
    disaAcilanlar(readFileSync(join(KOK, "src/constants/game.js"), "utf8")),
  );

  const eksik = [];
  let importEden = 0;
  for (const yol of kaynakDosyalari()) {
    const kaynak = readFileSync(yol, "utf8");
    const desen = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]*constants\/game(?:\.js)?)['"]/g;
    for (const eslesme of kaynak.matchAll(desen)) {
      importEden++;
      for (const ham of eslesme[1].split(",").map((x) => x.trim()).filter(Boolean)) {
        const ad = ham.split(/\s+as\s+/)[0].trim();
        if (!gameJs.has(ad)) eksik.push(`${yol.slice(KOK.length + 1)} -> ${ad}`);
      }
    }
  }

  assert.ok(importEden > 0, "hicbir dosya game.js'i import etmiyor gorunuyor — desen bozulmus");
  assert.deepEqual(eksik, [], `game.js'te olmayan ad import ediliyor:\n  ${eksik.join("\n  ")}`);
});
