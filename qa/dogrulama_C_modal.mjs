/**
 * BAGIMSIZ DOGRULAMA — C) MODAL KAPILARI
 *
 * (1) SAYIM: `<Modal` etiketlerini KENDIM sayarim (yorumlar ayri raporlanir),
 *     kacinda `onRequestClose` VAR.
 * (2) MUTASYON: dort ayri saldiri; testin KOR olup olmadigi olculur.
 *     Ozellikle C1: bir modali MUAFIYET LISTESINE ekleyip kapisini oldururum.
 *     Test bunu yakalamiyorsa muafiyet listesi testi KOR ediyor demektir.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const md5 = (p) => crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex");

// ---------------------------------------------------------------------------
// (1) KENDI SAYIMIM
// ---------------------------------------------------------------------------
function dosyalar() {
  const out = [path.join(KOK, "App.js")];
  (function gez(d) {
    for (const ad of fs.readdirSync(d)) {
      const fp = path.join(d, ad);
      if (fs.statSync(fp).isDirectory()) gez(fp);
      else if (/\.jsx?$/.test(ad)) out.push(fp);
    }
  })(path.join(KOK, "src"));
  return out;
}
const yorumsuz = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

console.log("=== (1) KENDI SAYIMIM ===");
let hamToplam = 0, gercekToplam = 0, varOR = 0, yokOR = 0;
const yokListe = [];
for (const f of dosyalar()) {
  const ham = fs.readFileSync(f, "utf8");
  const temiz = yorumsuz(ham);
  const hamSayi = (ham.match(/<Modal\b/g) || []).length;
  const sayi = (temiz.match(/<Modal\b/g) || []).length;
  hamToplam += hamSayi;
  if (sayi === 0) { if (hamSayi > 0) console.log(`  ${path.relative(KOK, f)}: ${hamSayi} adet <Modal ama HEPSI YORUMDA (sayilmaz)`); continue; }
  gercekToplam += sayi;
  // Her <Modal etiketinin acilis blogunu cikar ve icinde onRequestClose ara.
  const satirlar = temiz.split(/\r?\n/);
  const ilkSatir = [];
  temiz.replace(/<Modal\b/g, (m, off) => { ilkSatir.push(temiz.slice(0, off).split(/\r?\n/).length); return m; });
  for (const ln of ilkSatir) {
    // acilis etiketi bitene kadar (ilk '>' ya da 12 satir) tara
    let blok = "";
    for (let i = ln - 1; i < Math.min(satirlar.length, ln + 12); i++) {
      blok += satirlar[i] + "\n";
      if (/>/.test(satirlar[i]) && i > ln - 1) break;
      if (i > ln - 1 && /^\s*>/.test(satirlar[i])) break;
    }
    const has = /onRequestClose/.test(blok);
    if (has) varOR++; else { yokOR++; yokListe.push(`${path.relative(KOK, f)}:${ln}`); }
    console.log(`  ${has ? "VAR" : "YOK"} ${path.relative(KOK, f)}:${ln}`);
  }
}
console.log(`\n  TOPLAM <Modal (yorumlar DAHIL) = ${hamToplam}`);
console.log(`  GERCEK <Modal (yorumlar HARIC) = ${gercekToplam}`);
console.log(`  onRequestClose VAR = ${varOR}   YOK = ${yokOR}  -> ${yokListe.join(", ") || "(yok)"}`);

// ---------------------------------------------------------------------------
// (2) MUTASYONLAR
// ---------------------------------------------------------------------------
function suite() {
  try {
    const out = execSync("npm test", { cwd: KOK, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 900000 });
    return { cikis: 0, out };
  } catch (e) { return { cikis: e.status ?? -1, out: (e.stdout || "") + (e.stderr || "") }; }
}
function ozet(out) {
  return {
    t: (out.match(/tests (\d+)/) || [])[1],
    p: (out.match(/pass (\d+)/) || [])[1],
    f: (out.match(/fail (\d+)/) || [])[1],
    kirilan: [...new Set([...out.matchAll(/^✖ (.+?)(?: \([\d.]+ms\))?$/gm)].map((m) => m[1]))].filter((x) => !/^failing tests|\.test\.js$/.test(x)),
  };
}

const MUTANTLAR = [
  {
    ad: "C1 — MUAFIYET LISTESI KOR EDIYOR MU? (HowToPlay muaf + kapisi oldurulur)",
    duzenler: [
      { dosya: "tests/akis_butunlugu.test.js", ara: "const MUAF = ['DailyLoginModal.js'];", yaz: "const MUAF = ['DailyLoginModal.js', 'HowToPlayModal.js'];" },
      { dosya: "src/screens/HowToPlayModal.js", ara: ' onRequestClose={onClose}>', yaz: ">" },
    ],
  },
  {
    ad: "C2 — HowToPlayModal onRequestClose SILINIR (muafiyet YOK)",
    duzenler: [
      { dosya: "src/screens/HowToPlayModal.js", ara: ' onRequestClose={onClose}>', yaz: ">" },
    ],
  },
  {
    ad: "C3 — BoosterShopModal onRequestClose={undefined} (grep gecerdi, MOUNT gecmemeli)",
    duzenler: [
      { dosya: "src/components/BoosterShopModal.js", ara: "onRequestClose={onClose}", yaz: "onRequestClose={undefined}" },
    ],
  },
  {
    ad: "C4 — DEFTERDE OLMAYAN yeni bir Modal tasiyicisi (ProgressBar.js'e eklenir)",
    duzenler: [
      { dosya: "src/components/ProgressBar.js", ekle: "\nexport function __GeciciModalProbu() {\n  return <Modal visible={false} />;\n}\n" },
    ],
  },
];

for (const m of MUTANTLAR) {
  console.log(`\n=== ${m.ad}`);
  const yedek = [];
  let gecerli = true;
  for (const d of m.duzenler) {
    const tam = path.join(KOK, d.dosya);
    const o = fs.readFileSync(tam, "utf8");
    yedek.push({ tam, o, md5: md5(tam) });
    let s;
    if (d.ekle) {
      s = o + d.ekle;
      console.log(`    ${d.dosya}: DOSYA SONUNA ekleme yapildi (${d.ekle.trim().split("\n")[0]}...)`);
    } else {
      const gecis = o.split(d.ara).length - 1;
      console.log(`    ${d.dosya}  arama=${JSON.stringify(d.ara)}  GECIS SAYISI=${gecis} ${gecis === 1 ? "(gecerli)" : "(*** GECERSIZ ***)"}`);
      if (gecis !== 1) gecerli = false;
      s = o.split(d.ara).join(d.yaz);
    }
    console.log(`    s !== o = ${s !== o}`);
    if (s === o) gecerli = false;
    fs.writeFileSync(tam, s, "utf8");
  }
  if (!gecerli) {
    console.log("    *** SINAV GECERSIZ *** (geri aliniyor)");
  } else {
    const r = suite();
    const z = ozet(r.out);
    console.log(`    MUTANT  : tests ${z.t} | pass ${z.p} | fail ${z.f} | exit ${r.cikis}`);
    console.log(`    KIRILAN : ${z.kirilan.length ? z.kirilan.join("\n              ") : "(YOK)"}`);
    console.log(`    SONUC   : ${Number(z.f) > 0 ? "KIRMIZI — test ISE YARIYOR" : "*** YESIL — TEST KOR ***"}`);
  }
  let hepsiAyni = true;
  for (const y of yedek) {
    fs.writeFileSync(y.tam, y.o, "utf8");
    if (md5(y.tam) !== y.md5) hepsiAyni = false;
  }
  console.log(`    geri yazildi, TUM md5'ler AYNI mi: ${hepsiAyni}`);
}
