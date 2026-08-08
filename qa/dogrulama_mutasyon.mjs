// Bagimsiz mutasyon sinavi (olcum ajani). Dosyayi gecici bozar, suite kosar, GERI ALIR.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const MUT = [
  { ad: 'M1 storage.js: maxLevel yine KAYITTAN okunsun',
    dosya: 'src/utils/storage.js',
    ara: 'out.maxLevel = deriveMaxLevel(out.stars, out.highScores);',
    yaz: 'out.maxLevel = safeInt(raw.maxLevel, 1, 1, LEVELS.length);' },
  { ad: 'M2 storage.js: sanitizeQuests bozuk listeyi GECIRSIN',
    dosya: 'src/utils/storage.js',
    ara: '  if (!raw.every(isValidQuest)) return [];',
    yaz: '  if (false) return [];' },
  { ad: 'M3 DailyQuestsModal.js: QuestRow ham `q` kullansin (eski cokertici hal)',
    dosya: 'src/components/DailyQuestsModal.js',
    ara: '  const { desc, target, progress, reward, claimed } = normalizeQuest(q);',
    yaz: '  const { desc, target, progress, reward, claimed } = q;' },
  { ad: 'M4 lives.js: gelecek anchor kirpilmasin',
    dosya: 'src/utils/lives.js',
    ara: '  return Math.min(value, now);',
    yaz: '  return value;' },
  { ad: 'M5 storage.js: evaluateDailyLogin eski ESITSIZLIK kuraline donsun',
    dosya: 'src/utils/storage.js',
    ara: '  if (Number.isFinite(daysSince) && daysSince <= 0) {',
    yaz: '  if (Number.isFinite(daysSince) && daysSince === 0) {' },
];

function suite() {
  try {
    const out = execSync('npm test 2>&1', { encoding: 'utf8', shell: true });
    return { out, kod: 0 };
  } catch (e) { return { out: (e.stdout || '') + (e.stderr || ''), kod: e.status }; }
}
function say(out) {
  const p = /^ℹ pass (\d+)$/m.exec(out) || /pass (\d+)/.exec(out);
  const f = /^ℹ fail (\d+)$/m.exec(out) || /fail (\d+)/.exec(out);
  return `pass ${p ? p[1] : '?'} fail ${f ? f[1] : '?'}`;
}

const temiz = suite();
console.log(`TEMIZ SUITE: ${say(temiz.out)} | cikis ${temiz.kod}`);

for (const m of MUT) {
  const o = fs.readFileSync(m.dosya, 'utf8');
  const kez = o.split(m.ara).length - 1;
  const s = o.replace(m.ara, m.yaz);
  console.log(`\n--- ${m.ad}`);
  console.log(`    arama metni ${kez} kez gecti | mutasyon UYGULANDI (s !== o): ${s !== o}`);
  if (s === o) { console.log('    !!! MUTASYON UYGULANMADI — bu sinav GECERSIZ'); continue; }
  fs.writeFileSync(m.dosya, s);
  const r = suite();
  console.log(`    mutantla: ${say(r.out)} | cikis ${r.kod} -> ${r.kod !== 0 ? 'KIRMIZI (test isini yapiyor)' : '*** YESIL KALDI — TEST BU DAVRANISI OLCMUYOR ***'}`);
  fs.writeFileSync(m.dosya, o);
  const g = suite();
  console.log(`    geri alindi: ${say(g.out)} | cikis ${g.kod}`);
}
console.log('\ngit diff (tracked, bos olmali):');
console.log(execSync('git status --porcelain -- src/ tests/', { encoding: 'utf8' }) || '  (temiz)');
