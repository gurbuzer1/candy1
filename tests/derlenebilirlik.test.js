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
import { join, dirname, sep } from "node:path";
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

/**
 * TARAMA KAPSAMI CITASI — 2026-08-07'de OLCUMLE sikilastirildi.
 *
 * ESKI CITA: `dosyalar.length >= 25`. Gercek sayi 31'di, yani ALTI dosya
 * silinse (ya da tarama yolu bozulup alti dosya gorunmez olsa) test YINE YESIL
 * kaliyordu — "yesil suite, olu app" tuzagi tam olarak buradan geri sizabilir.
 *
 * YENI CITA — dosya LISTESI sabitlendi, sayi degil:
 *   - bir dosya KAYBOLURSA kirmizi (aranan sey adiyla raporlanir),
 *   - YENI dosya eklenince kirmizi YANMAZ (liste "en az bunlar" demektir),
 *     boylece cita kirilgan olmaz ve her yeni bilesende guncelleme istemez.
 * Yeni dosyalar yine de derlenir; sadece listede olmalari sart degildir.
 *
 * ⚠️ Bir dosya BILEREK silinirse bu listeden de cikarilmalidir — testin isi
 * "kaza eseri kaybolmayi" yakalamak, kasitli silmeyi engellemek degil.
 */
const BEKLENEN_DOSYALAR = [
  "App.js",
  "src/components/AchievementToast.js",
  "src/components/AchievementsModal.js",
  "src/components/AnimatedBackground.js",
  "src/components/BoosterShopModal.js",
  "src/components/CandyCell.js",
  "src/components/ColorFrenzyOverlay.js",
  "src/components/DailyLoginModal.js",
  "src/components/DailyQuestsModal.js",
  "src/components/GameBoard.js",
  "src/components/HudBar.js",
  "src/components/LevelIntroOverlay.js",
  "src/components/ParticleBurst.js",
  "src/components/PreGameBoosterModal.js",
  "src/components/ProgressBar.js",
  "src/components/ScorePopup.js",
  "src/components/SpecialActivationFX.js",
  "src/constants/economy.js",
  "src/constants/game.js",
  "src/constants/kural.js",
  "src/constants/levels.js",
  "src/engine/BoardEngine.js",
  "src/screens/GameScreen.js",
  "src/screens/HomeScreen.js",
  "src/screens/HowToPlayModal.js",
  "src/screens/LevelSelectScreen.js",
  "src/utils/achievements.js",
  "src/utils/haptics.js",
  "src/utils/lives.js",
  "src/utils/quests.js",
  "src/utils/storage.js",
];

/** Mutlak yolu depo-koku goreli, ileri-bolu bicime cevirir. */
function goreli(yol) {
  return yol.slice(KOK.length + 1).split(sep).join("/");
}

test("taramanin GORDUGU dosya kumesi: bilinen HICBIR kaynak dosya kaybolmadi", () => {
  // ONCE: cita `>=25` idi, gercek sayi 31 -> alti dosya sessizce kaybolabilirdi.
  const bulunan = new Set(kaynakDosyalari().map(goreli));
  const kayip = BEKLENEN_DOSYALAR.filter((d) => !bulunan.has(d));
  assert.deepEqual(
    kayip,
    [],
    `taramada GORUNMEYEN kaynak dosya(lar) var — ya silindi ya tarama yolu bozuldu:\n  ${kayip.join("\n  ")}`,
  );

  // Kontrol vakasi: liste tarafinin da canli oldugunu goster (tarama hic dosya
  // bulamasa yukaridaki assert zaten patlar, ama bu satir "liste bos kalmis"
  // sessiz halini de kapatir).
  assert.ok(BEKLENEN_DOSYALAR.length >= 31, "beklenen dosya listesi budanmis");

  // Yeni dosya eklemek KIRMIZI YANMAZ; sadece bilgi olarak raporlanir.
  const yeni = [...bulunan].filter((d) => !BEKLENEN_DOSYALAR.includes(d));
  if (yeni.length > 0) {
    console.log(`  (bilgi) listede olmayan yeni kaynak dosya: ${yeni.join(", ")}`);
  }
});

test("her kaynak dosya Metro'nun transform'uyla DERLENIR", () => {
  const babel = require("@babel/core");
  const dosyalar = kaynakDosyalari();

  // Cita artik "sayi >= 25" degil; her BEKLENEN dosya derlenmis olmali.
  const bulunan = new Set(dosyalar.map(goreli));
  const kayip = BEKLENEN_DOSYALAR.filter((d) => !bulunan.has(d));
  assert.deepEqual(kayip, [], `derleme listesinde eksik dosya: ${kayip.join(", ")}`);

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
