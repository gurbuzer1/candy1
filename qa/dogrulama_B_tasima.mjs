/**
 * BAGIMSIZ DOGRULAMA — B) DERLENEBILIRLIK CITASI
 * Bir kaynak dosyayi GECICI olarak baska yere TASIR (SILMEZ), suite'in KIRMIZI
 * olup olmadigini olcer, sonra geri koyar ve md5'i karsilastirir.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const md5 = (p) => crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex");
const PARK = path.join(KOK, "qa", "_gecici_park");
fs.mkdirSync(PARK, { recursive: true });

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
    kirilan: [...new Set([...out.matchAll(/^✖ (.+?)(?: \([\d.]+ms\))?$/gm)].map((m) => m[1]))],
  };
}

for (const hedef of ["src/components/HudBar.js", "src/utils/lives.js"]) {
  const src = path.join(KOK, hedef);
  const dst = path.join(PARK, path.basename(hedef));
  const h0 = md5(src);
  console.log(`\n=== TASIMA: ${hedef}`);
  console.log(`    ONCE md5 : ${h0}`);
  fs.renameSync(src, dst);
  console.log(`    tasindi -> qa/_gecici_park/${path.basename(hedef)}  (kaynakta var mi: ${fs.existsSync(src)})`);
  const r = suite();
  const z = ozet(r.out);
  console.log(`    SUITE    : tests ${z.t} | pass ${z.p} | fail ${z.f} | exit ${r.cikis}`);
  console.log(`    KIRILAN  : ${z.kirilan.length ? z.kirilan.join("\n               ") : "(YOK)"}`);
  fs.renameSync(dst, src);
  const h1 = md5(src);
  console.log(`    geri kondu, md5 AYNI mi: ${h1 === h0}`);
  console.log(`    SONUC    : ${Number(z.f) > 0 ? "KIRMIZI — cita calisiyor" : "*** YESIL — CITA KOR ***"}`);
}
