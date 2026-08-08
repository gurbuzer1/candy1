/**
 * BAGIMSIZ DOGRULAMA — B) MUTASYON SINAVI (KENDIM UYGULUYORUM)
 *
 * Kural: mutasyonun UYGULANDIGINI kanitla (s !== o) VE arama metninin KAC KEZ
 * gectigini yazdir; 1 degilse sinav GECERSIZ. Dosya CRLF, arama metni LF ise
 * mutasyon hic uygulanmaz ve suite sessizce yesil kalir (gecen turun tuzagi).
 *
 * Kullanim: node qa/dogrulama_B_mutasyon.mjs [ad]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const md5 = (p) => crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex");

const MUTANTLAR = [
  {
    ad: "B1-M6",
    aciklama: "collapse REZERVE EDILMEMIS tahtayla kosar (gorevde istenen birebir mutasyon)",
    dosya: "src/screens/GameScreen.js",
    ara: "removeAndCollapse(workGrid, toRemove)",
    yaz: "removeAndCollapse(currentGrid, matched)",
  },
  {
    ad: "B2-M5",
    aciklama: "FRENZY_CHARGE_TARGET = 100000 (frenzy pratikte hic tetiklenmez)",
    dosya: "src/constants/economy.js",
    araRegex: /FRENZY_CHARGE_TARGET\s*=\s*\d+/,
    yazRegex: "FRENZY_CHARGE_TARGET = 100000",
  },
];

function suiteKos() {
  try {
    const out = execSync("npm test", { cwd: KOK, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 900000 });
    return { cikis: 0, out };
  } catch (e) {
    return { cikis: e.status ?? -1, out: (e.stdout || "") + (e.stderr || "") };
  }
}

function ozet(out) {
  const t = (out.match(/^# tests (\d+)/m) || out.match(/tests (\d+)/) || [])[1];
  const p = (out.match(/pass (\d+)/) || [])[1];
  const f = (out.match(/fail (\d+)/) || [])[1];
  const kirilan = [...out.matchAll(/^✖ (.+?)(?: \([\d.]+ms\))?$/gm)].map((m) => m[1]);
  return { t, p, f, kirilan };
}

const secim = process.argv[2];
for (const m of MUTANTLAR) {
  if (secim && m.ad !== secim) continue;
  const tam = path.join(KOK, m.dosya);
  console.log(`\n=== ${m.ad} — ${m.aciklama}`);
  console.log(`    dosya      : ${m.dosya}`);
  const oncekiMd5 = md5(tam);
  console.log(`    ONCE md5   : ${oncekiMd5}`);
  const o = fs.readFileSync(tam, "utf8");

  let s, gecis;
  if (m.araRegex) {
    const hepsi = o.match(new RegExp(m.araRegex.source, m.araRegex.flags.includes("g") ? m.araRegex.flags : m.araRegex.flags + "g")) || [];
    gecis = hepsi.length;
    console.log(`    arama      : ${m.araRegex}  (eslesenler: ${JSON.stringify(hepsi)})`);
    s = o.replace(m.araRegex, m.yazRegex);
  } else {
    gecis = o.split(m.ara).length - 1;
    console.log(`    arama metni: ${JSON.stringify(m.ara)}`);
    s = o.split(m.ara).join(m.yaz);
  }
  console.log(`    GECIS SAYISI = ${gecis}   ${gecis === 1 ? "(gecerli)" : "(*** GECERSIZ SINAV ***)"}`);
  console.log(`    s !== o    = ${s !== o}`);
  if (gecis !== 1 || s === o) {
    console.log("    SINAV GECERSIZ — mutasyon uygulanmadi, atlaniyor.");
    continue;
  }

  fs.writeFileSync(tam, s, "utf8");
  console.log(`    MUTANT md5 : ${md5(tam)}`);
  const r = suiteKos();
  const z = ozet(r.out);
  console.log(`    MUTANT     : tests ${z.t} | pass ${z.p} | fail ${z.f} | exit ${r.cikis}`);
  console.log(`    KIRILAN    : ${z.kirilan.length ? z.kirilan.join("\n                 ") : "(YOK)"}`);

  fs.writeFileSync(tam, o, "utf8");
  const sonMd5 = md5(tam);
  console.log(`    geri yazildi, md5 AYNI mi: ${sonMd5 === oncekiMd5}  (${sonMd5})`);
  console.log(`    SONUC      : ${Number(z.f) > 0 ? "mutant OLDU (KIRMIZI) — test ISE YARIYOR" : "*** MUTANT HAYATTA (YESIL) — TEST KOR ***"}`);
}
