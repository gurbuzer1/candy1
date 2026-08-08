/**
 * CURUTME PROBU — "Oyun ortasinda '<-' tusu: can gider, ilerleme silinir".
 *
 * Amac: bulguyu KOD OKUYARAK degil, CALISTIRARAK olcmek.
 *   A) Geri yolunun kodda gercekten kayit yapmadigini kaynaktan dogrula.
 *   B) Bir seviyeyi motorla GERCEKTEN oyna, GameScreen'in sessionRef
 *      sayaclarini birebir aynala, sonra iki senaryoyu karsilastir:
 *        1) hamleler bitti  -> emitResult -> App.handleLevelEnd
 *        2) '<-' tusu       -> App.handleBackToLevels (sadece setScreen)
 *      Kaybedilen coin / stat / quest ilerlemesini SAY.
 *
 * Kod DEGISTIRMEZ. Sadece olcer.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  createBoard, swapCells, findMatches, determineSpecials,
  getSpecialRemovals, removeAndCollapse, placeSpecials,
  calculateScore, hasValidMoves, shuffleBoard,
} from "../src/engine/BoardEngine.js";
import { COLS, ROWS, SPECIAL } from "../src/constants/kural.js";
import { takeLife, settleLives } from "../src/utils/lives.js";
import { LIVES_MAX, LIFE_REGEN_MS, QUEST_POOL, COIN_PER_STAR } from "../src/constants/economy.js";
import { applyQuestEvents } from "../src/utils/quests.js";
import { LEVELS } from "../src/constants/levels.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const gameSrc = readFileSync(join(root, "src/screens/GameScreen.js"), "utf8");
const appSrc = readFileSync(join(root, "App.js"), "utf8");

console.log("================ A) KAYNAK OLCUMU ================");

// A1: '<-' dugmesi dogrudan onBack cagiriyor mu, arada onay var mi?
const backBtnLine = gameSrc.split("\n").findIndex((l) => l.includes("styles.backBtn")) + 1;
const backBtnSnippet = gameSrc.split("\n").slice(backBtnLine - 1, backBtnLine + 2).join("\n");
console.log(`GameScreen.js:${backBtnLine}\n${backBtnSnippet}`);

// A2: onay diyalogu var mi? (Alert / BackHandler / "are you sure")
const onayIzleri = ["Alert.alert", "BackHandler", "Are you sure", "confirmQuit", "showQuitConfirm"];
const bulunanOnay = onayIzleri.filter((p) => gameSrc.includes(p) || appSrc.includes(p));
console.log(`onay izi arandi ${JSON.stringify(onayIzleri)} -> bulunan: ${JSON.stringify(bulunanOnay)}`);

// A3: handleBackToLevels govdesi
const hb = appSrc.indexOf("function handleBackToLevels");
console.log("App.handleBackToLevels govdesi:\n" + appSrc.slice(hb, appSrc.indexOf("}", hb) + 1));

// A4: emitResult kac yerden cagriliyor, kapisi ne?
const emitCalls = gameSrc.split("\n")
  .map((l, i) => [i + 1, l])
  .filter(([, l]) => /emitResult\(/.test(l));
console.log("emitResult satirlari:", JSON.stringify(emitCalls));
const endedSet = gameSrc.split("\n")
  .map((l, i) => [i + 1, l.trim()])
  .filter(([, l]) => /endedRef\.current\s*=\s*true/.test(l));
console.log("endedRef=true satirlari:", JSON.stringify(endedSet));

// A5: can nerede harcaniyor?
const canHarcama = appSrc.split("\n")
  .map((l, i) => [i + 1, l.trim()])
  .filter(([, l]) => /takeLife\(/.test(l));
console.log("takeLife cagrilari:", JSON.stringify(canHarcama));

console.log("\n================ B) GERCEK OYUN KOSUMU ================");

// --- GameScreen'in resolveMatches sayaclarinin birebir aynasi ---
function playLevel(levelIdx, moveBudget) {
  let grid = createBoard();
  const session = {
    striped: 0, wrapped: 0, colorBombs: 0, bigCascades: 0,
    maxCascadeLevel: 0, matches: 0, candiesByColor: [0, 0, 0, 0, 0, 0],
  };
  let score = 0;
  let moves = moveBudget;
  let wonAtMove = null;

  const cascade = (g) => {
    let cascadeLevel = 0;
    let cur = g;
    for (;;) {
      const { matched, matchGroups } = findMatches(cur);
      if (matched.size === 0) break;
      const specials = determineSpecials(matchGroups);
      const all = new Set(matched);
      getSpecialRemovals(cur, all).forEach((k) => all.add(k));

      // --- sessionRef aynasi (GameScreen.js:404-419) ---
      session.matches += matchGroups.length;
      if (cascadeLevel >= 3) session.bigCascades += 1;
      if (cascadeLevel > session.maxCascadeLevel) session.maxCascadeLevel = cascadeLevel;
      specials.forEach((s) => {
        if (s.special === SPECIAL.COLOR_BOMB) session.colorBombs += 1;
        else if (s.special === SPECIAL.WRAPPED) session.wrapped += 1;
        else session.striped += 1;
      });
      all.forEach((key) => {
        const [c, r] = key.split(",").map(Number);
        const candy = cur[c]?.[r];
        if (candy && candy.type >= 0 && candy.type < 6) session.candiesByColor[candy.type] += 1;
      });

      score += calculateScore(matchGroups, specials, cascadeLevel);
      cur = placeSpecials(removeAndCollapse(cur, all).grid, specials);
      cascadeLevel += 1;
    }
    return cur;
  };

  grid = cascade(grid);

  while (moves > 0) {
    if (!hasValidMoves(grid)) grid = cascade(shuffleBoard(grid));
    let did = false;
    outer:
    for (let c = 0; c < COLS && !did; c++) {
      for (let r = 0; r < ROWS; r++) {
        for (const [dc, dr] of [[1, 0], [0, 1]]) {
          const c2 = c + dc, r2 = r + dr;
          if (c2 >= COLS || r2 >= ROWS) continue;
          const sw = swapCells(grid, c, r, c2, r2);
          if (findMatches(sw).matched.size > 0) {
            grid = cascade(sw);
            did = true;
            break outer;
          }
        }
      }
    }
    if (!did) break;
    moves -= 1;
    if (wonAtMove === null && score >= LEVELS[levelIdx].target1) {
      wonAtMove = moveBudget - moves;
    }
  }
  return { session, score, movesLeft: moves, wonAtMove };
}

const LEVEL_NUM = 1;
const cfg = LEVELS[LEVEL_NUM - 1];
const { session: s, score, wonAtMove } = playLevel(LEVEL_NUM - 1, cfg.moves);

// D) ERKEN KAZANMA PENCERESI — 20 kosum, "kazandi ama oynamaya mecbur" hamle sayisi
const pencere = [];
for (let i = 0; i < 20; i++) {
  const r = playLevel(LEVEL_NUM - 1, cfg.moves);
  if (r.wonAtMove !== null) pencere.push(cfg.moves - r.wonAtMove);
}
console.log(`\n[D] Seviye 1, 20 kosum: target1 asildiktan SONRA hala oynanmak zorunda kalinan hamle`);
console.log(`    ortalama=${(pencere.reduce((a, b) => a + b, 0) / pencere.length).toFixed(1)} | min=${Math.min(...pencere)} | max=${Math.max(...pencere)} | n=${pencere.length}/20`);
console.log(`    (checkEndConditions SADECE moves<=0 ile biter -> erken kazanma cikisi YOK; oyuncunun tek cikisi '<-')\n`);
const won = score >= cfg.target1;
const stars = !won ? 0 : score >= cfg.target3 ? 3 : score >= cfg.target2 ? 2 : 1;

console.log(`Seviye ${LEVEL_NUM}: ${cfg.moves} hamle oynandi, skor=${score}, target1=${cfg.target1}, kazandi=${won}, yildiz=${stars}`);
console.log("sessionRef sonucu:", JSON.stringify(s));

// --- GameScreen.emitResult (satir 575) birebir ---
const COLOR_NAMES = ["clearRed", "clearOrange", "clearYellow", "clearGreen", "clearBlue", "clearPurple"];
const questEvents = [
  ...(won ? [{ type: "win", value: 1 }] : []),
  { type: "score", value: score },
  ...(s.striped > 0 ? [{ type: "striped", value: s.striped }] : []),
  ...(s.wrapped > 0 ? [{ type: "wrapped", value: s.wrapped }] : []),
  ...(s.bigCascades > 0 ? [{ type: "bigCascade", value: s.bigCascades }] : []),
  ...(stars === 3 ? [{ type: "threeStar", value: 1 }] : []),
  ...COLOR_NAMES.map((name, i) => ({ type: name, value: s.candiesByColor[i] })),
];

// Bugunun quest'leri yerine EN KOTU DEGIL, POOL'un ilk 3'u — deterministik olsun.
const dailyQuests = QUEST_POOL.slice(0, 3).map((q) => ({
  id: q.id, event: q.event, desc: q.desc, target: q.target,
  progress: 0, reward: q.reward, claimed: false,
}));

// --- Senaryo 1: hamleler bitti (emitResult -> handleLevelEnd) ---
const bitis = applyQuestEvents({ dailyQuests }, questEvents);
// --- Senaryo 2: '<-' tusu (handleBackToLevels: sadece setScreen) ---
const geri = { quests: dailyQuests, earnedCoins: 0, completedIds: [] };

console.log("\n--- SENARYO 1: hamleler bitti ---");
console.log("  quest ilerlemesi:", bitis.quests.map((q) => `${q.id} ${q.progress}/${q.target}`).join(" | "));
console.log("  quest coin:", bitis.earnedCoins, "| tamamlanan:", JSON.stringify(bitis.completedIds));
console.log("  stat yazimi: lifetimeMatches +" + s.matches
  + ", lifetimeSpecialsMade +" + (s.striped + s.wrapped + s.colorBombs)
  + ", lifetimeCascadesBig +" + s.bigCascades);
console.log("  seviye coin (COIN_PER_STAR):", won ? (COIN_PER_STAR[stars] || 0) : 0);

console.log("\n--- SENARYO 2: '<-' tusuna basildi ---");
console.log("  quest ilerlemesi:", geri.quests.map((q) => `${q.id} ${q.progress}/${q.target}`).join(" | "));
console.log("  quest coin:", geri.earnedCoins);
console.log("  stat yazimi: HICBIRI (commit cagrilmiyor)");
console.log("  seviye coin: 0");

console.log("\n--- FARK (kaybedilen) ---");
const kayipCoin = bitis.earnedCoins + (won ? (COIN_PER_STAR[stars] || 0) : 0);
console.log("  coin:", kayipCoin);
console.log("  quest ilerleme birimi:", bitis.quests.reduce((a, q) => a + q.progress, 0));
console.log("  lifetime stat birimi:", s.matches + s.striped + s.wrapped + s.colorBombs + s.bigCascades);

console.log("\n================ C) CAN OLCUMU ================");
let save = { lives: LIVES_MAX, lastLifeRegenMs: Date.now() };
console.log("seviyeye girmeden once lives =", save.lives);
const upd = takeLife(save);            // App.handleConfirmBoosters (App.js:128)
save = { ...save, ...upd };
console.log("handleConfirmBoosters -> takeLife sonrasi lives =", save.lives);
// '<-' tusu: handleBackToLevels sadece setScreen('levels'). Can iadesi yok.
const backRefundsLife = /function handleBackToLevels[\s\S]*?\}/.exec(appSrc)[0].includes("lives");
console.log("handleBackToLevels 'lives' kelimesi iceriyor mu:", backRefundsLife);
console.log("geri donusten sonra lives =", save.lives, "(iade yok)");
const settled = settleLives(save, Date.now() + LIFE_REGEN_MS - 1);
console.log("19:59 sonra lives =", settled.lives, "-> can SADECE", LIFE_REGEN_MS / 60000, "dk bekleyerek geri gelir");
console.log("magazada can dolumu var mi (kaynakta 'refill' satin alma):",
  /refill/i.test(readFileSync(join(root, "src/components/BoosterShopModal.js"), "utf8")));
