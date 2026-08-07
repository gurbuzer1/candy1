/**
 * AKIS BUTUNLUGU SINAVI — "oyuncunun gordugu seyler".
 *
 * Kapsanan bulgular (qa/BULGULAR.md, lens: akis + durum):
 *   1) [ONEMLI] Oyun ortasinda '<-' tusu: uyari yok, can gider, o eldeki
 *      quest/istatistik ilerlemesi kaydedilmeden silinir.
 *   2) [KUCUK] Can kapisi "Next Level" yolundan tamamen atlaniyor.
 *   3) [KUCUK] Hedef puan oyunun HICBIR yerinde yazmiyor.
 *   4) [KUCUK] Seviye 30'da "Next Level" dugmesi yalan soyluyor.
 *   5) [KUCUK] Android geri tusu hicbir yerde tanimli degil.
 *   6) [KUCUK] PreGameBoosterModal'da "<- Back" secimi SIFIRLAMIYOR.
 *
 * OLCUM BICIMI: kaynakta grep DEGIL. Bilesenler Metro'nun transform'uyla
 * derlenip hook'lari GERCEKTEN calisan bir mini React ile kosuluyor
 * (tests/qa_akis_render.mjs); dugmelere BASILIYOR ve sonuc agacta okunuyor.
 *
 * MUTASYON SINAVI: qa/mutasyon_akis.mjs
 *
 * KAPSAM DISI: gercek React reconciler, yerlesim/olcu, animasyon, gercek
 * cihazda Android'in Modal geri tusunu hangi katmanda yuttugu.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadModule, mount, collectText, collectVisibleText, findPressableByText, press,
  flattenNodes, BACK_HANDLERS,
} from './qa_akis_render.mjs';

/**
 * Sonuc modallerinin ICERIGI. Bunlar seviye bitene kadar `visible={false}`
 * oldugu icin "gorunur metin" toplayicisiyla okunamaz; modal dugumu bulunup
 * govdesi dogrudan okunur. Sinanan sey: modal ACILDIGINDA ne YAZAR.
 */
function modalMetni(tree, baslik) {
  const modal = flattenNodes(tree)
    .filter((n) => n.name === 'Modal')
    .find((n) => collectText(n).join('|').includes(baslik));
  assert.ok(modal, `"${baslik}" basligini tasiyan Modal bulunamadi`);
  return collectText(modal).join('|');
}

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(KOK, 'App.js');
const GAME = path.join(KOK, 'src', 'screens', 'GameScreen.js');
const PREGAME = path.join(KOK, 'src', 'components', 'PreGameBoosterModal.js');

const app = loadModule(APP);
const { canStartLevel, nextLevelDecision, replayDecision, backTarget, AKIS } = app;
const { LEVELS } = loadModule(path.join(KOK, 'src', 'constants', 'levels.js'));
const { LIVES_MAX, LIFE_REGEN_MS } = loadModule(path.join(KOK, 'src', 'constants', 'economy.js'));
const { shortfallLabel } = loadModule(GAME);
const { nextSelection } = loadModule(PREGAME);

const NOW = 1_800_000_000_000;

/** Zamanlayicilari susturur: sinav 5 sn'lik ipucu sayacini beklemesin. */
function withoutTimers(fn) {
  const st = globalThis.setTimeout;
  const si = globalThis.setInterval;
  globalThis.setTimeout = () => 0;
  globalThis.setInterval = () => 0;
  try {
    return fn();
  } finally {
    globalThis.setTimeout = st;
    globalThis.setInterval = si;
  }
}

/**
 * App'i mount eder, ilk `loadProgress` sozunu bekler ve varsa gunluk giris
 * odulunu alir (aksi halde DailyLoginModal acik kalir ve geri tusu BILEREK
 * yutulur — `backTarget` 'blocked' doner).
 */
async function appKur() {
  BACK_HANDLERS.length = 0;
  const m = mount(APP, {});
  await new Promise((r) => setImmediate(r));
  m.rerender();
  const bul = (ad) => flattenNodes(m.tree).find((n) => n.name === ad);
  const login = bul('DailyLoginModal');
  if (login && login.props.visible) login.props.onClaim();
  return { m, bul, metin: () => collectVisibleText(m.tree).join('|') };
}

// ====================================================================
// BULGU 2 — CAN KAPISI
// ====================================================================

test('BULGU 2: canStartLevel canlari TURETIR, ham `lives` alanina inanmaz', () => {
  assert.equal(canStartLevel({ lives: 3, lastLifeRegenMs: NOW }, NOW), true);
  assert.equal(canStartLevel({ lives: 1, lastLifeRegenMs: NOW }, NOW), true);
  // 0 can + saat henuz dolmadi -> HAYIR (eskiden bu kapi hic sorulmuyordu)
  assert.equal(canStartLevel({ lives: 0, lastLifeRegenMs: NOW }, NOW), false);
  // 0 can ama regen suresi doldu -> EVET (kapi zamani da hesaba katar)
  assert.equal(
    canStartLevel({ lives: 0, lastLifeRegenMs: NOW - LIFE_REGEN_MS }, NOW),
    true,
  );
  assert.equal(canStartLevel(null, NOW), false);
  assert.equal(canStartLevel(undefined, NOW), false);
});

test('BULGU 2: nextLevelDecision can 0 iken seviye BASLATMAZ', () => {
  const canli = { lives: 2, lastLifeRegenMs: NOW };
  const bos = { lives: 0, lastLifeRegenMs: NOW };

  assert.deepEqual(
    nextLevelDecision(1, canli, NOW),
    { action: AKIS.START, levelNum: 2 },
  );
  // ESKI DAVRANIS: burada da dogrudan pendingLevelNum=2 set ediliyordu.
  assert.deepEqual(
    nextLevelDecision(1, bos, NOW),
    { action: AKIS.NO_LIVES, levelNum: 2 },
  );
  assert.deepEqual(
    nextLevelDecision(LEVELS.length - 1, canli, NOW),
    { action: AKIS.START, levelNum: LEVELS.length },
  );
});

test('BULGU 2: replayDecision de ayni kapidan gecer', () => {
  assert.deepEqual(
    replayDecision(7, { lives: 1, lastLifeRegenMs: NOW }, NOW),
    { action: AKIS.START, levelNum: 7 },
  );
  assert.deepEqual(
    replayDecision(7, { lives: 0, lastLifeRegenMs: NOW }, NOW),
    { action: AKIS.NO_LIVES, levelNum: 7 },
  );
});

test('BULGU 2 (UCTAN UCA): App icinde 5 can bitince 6. seviye BASLAMAZ', async () => {
  await withoutTimers(async () => {
    const { bul, metin } = await appKur();

    bul('HomeScreen').props.onPlay();
    assert.ok(bul('LevelSelectScreen'), 'seviye listesi acilmali');

    // LIVES_MAX kadar seviye baslat: her biri 1 can yer.
    for (let i = 0; i < LIVES_MAX; i++) {
      bul('LevelSelectScreen').props.onSelectLevel(1);
      bul('PreGameBoosterModal').props.onConfirm({});
      assert.ok(bul('GameScreen'), `${i + 1}. baslatma oyun ekranini acmali`);
      bul('GameScreen').props.onBack();
    }

    // Canlar bitti. "Next Level" yolu ESKIDEN kapiyi hic sormuyordu.
    assert.ok(!metin().includes('Out of Lives'), 'henuz uyari olmamali');
    bul('LevelSelectScreen').props.onSelectLevel(1);
    bul('PreGameBoosterModal').props.onConfirm({});

    assert.ok(!bul('GameScreen'), 'can 0 iken oyun ekrani ACILMAMALI');
    assert.ok(metin().includes('Out of Lives'), 'reddin bir sesi olmali');
  });
});

// ====================================================================
// BULGU 4 — SEVIYE 30'DAN SONRASI
// ====================================================================

test('BULGU 4: son seviyeden sonra FINISHED — can durumundan BAGIMSIZ', () => {
  const canli = { lives: 5, lastLifeRegenMs: NOW };
  const bos = { lives: 0, lastLifeRegenMs: NOW };
  assert.deepEqual(
    nextLevelDecision(LEVELS.length, canli, NOW),
    { action: AKIS.FINISHED, levelNum: null },
  );
  assert.deepEqual(
    nextLevelDecision(LEVELS.length, bos, NOW),
    { action: AKIS.FINISHED, levelNum: null },
  );
  assert.equal(nextLevelDecision(999, canli, NOW).action, AKIS.FINISHED);
});

test('BULGU 4: son seviyede dugme "Next Level" DEMEZ', () => {
  withoutTimers(() => {
    const sonda = mount(GAME, {
      levelNum: LEVELS.length,
      save: { inventory: {} },
      boosters: {},
      onLevelEnd: () => {},
      onBack: () => {},
      backRequest: 0,
    });
    const t1 = modalMetni(sonda.tree, 'Level Complete!');
    assert.ok(t1.includes('Finish Game'), 'son seviyede "Finish Game" yazmali');
    assert.ok(!t1.includes('Next Level'), 'son seviyede "Next Level" YAZMAMALI');

    const ortada = mount(GAME, {
      levelNum: 1,
      save: { inventory: {} },
      boosters: {},
      onLevelEnd: () => {},
      onBack: () => {},
      backRequest: 0,
    });
    const t2 = modalMetni(ortada.tree, 'Level Complete!');
    assert.ok(t2.includes('Next Level'), '1. seviyede "Next Level" yazmali');
    assert.ok(!t2.includes('Finish Game'));
  });
});

test('BULGU 4: App son seviyeden sonra BITTI ekranini gosterir', async () => {
  await withoutTimers(async () => {
    const { bul, metin } = await appKur();

    bul('HomeScreen').props.onPlay();
    bul('LevelSelectScreen').props.onSelectLevel(LEVELS.length);
    bul('PreGameBoosterModal').props.onConfirm({});
    assert.ok(bul('GameScreen'), 'son seviye baslamali');
    assert.ok(!metin().includes('You Beat Sugar Blast!'), 'daha bitmedi');

    bul('GameScreen').props.onNextLevel();
    assert.ok(metin().includes('You Beat Sugar Blast!'),
      `bitis ekrani yok: ${metin().slice(0, 200)}`);
    assert.ok(!bul('PreGameBoosterModal').props.visible, '31. seviye acilmamali');
  });
});

// ====================================================================
// BULGU 5 — DONANIM GERI TUSU
// ====================================================================

test('BULGU 5: backTarget en ustteki katmandan basa dogru coz', () => {
  assert.equal(backTarget({ screen: 'home' }), 'exit');
  assert.equal(backTarget({ screen: 'levels' }), 'toHome');
  assert.equal(backTarget({ screen: 'game' }), 'quitGame');
  assert.equal(backTarget({ screen: 'game', pendingLevelNum: 4 }), 'closePreGame');
  assert.equal(backTarget({ screen: 'levels', showShop: true }), 'closeShop');
  assert.equal(backTarget({ screen: 'home', showHowTo: true }), 'closeHowTo');
  assert.equal(backTarget({ screen: 'home', showQuests: true }), 'closeQuests');
  assert.equal(backTarget({ screen: 'home', showAchievements: true }), 'closeAchievements');
  // Gunluk giris odulu ALINMADAN kapanmaz: tus YUTULUR.
  assert.equal(backTarget({ screen: 'home', showLogin: true, showShop: true }), 'blocked');
  assert.equal(backTarget({}), 'exit');
});

test('BULGU 5: App donanim geri tusunu GERCEKTEN kaydeder ve geri gezinir', async () => {
  await withoutTimers(async () => {
    const { bul } = await appKur();

    assert.equal(BACK_HANDLERS.length, 1, 'tam bir dinleyici kayitli olmali');
    assert.equal(BACK_HANDLERS[0].evt, 'hardwareBackPress');

    const bas = () => BACK_HANDLERS[BACK_HANDLERS.length - 1].fn();

    // Ana ekran: olayi isletim sistemine BIRAK (uygulamadan cikis).
    assert.equal(bas(), false);

    bul('HomeScreen').props.onPlay();
    assert.ok(bul('LevelSelectScreen'));
    assert.equal(bas(), true, 'seviye listesinde tus YUTULMALI');
    assert.ok(bul('HomeScreen'), 'geri tusu ana ekrana donmeli');
  });
});

test('BULGU 5: GameScreen ve PreGameBoosterModal Modal\'larinda onRequestClose VAR', () => {
  withoutTimers(() => {
    const g = mount(GAME, {
      levelNum: 3,
      save: { inventory: {} },
      boosters: {},
      onLevelEnd: () => {},
      onBack: () => {},
      backRequest: 0,
    });
    const gm = flattenNodes(g.tree).filter((n) => n.name === 'Modal');
    assert.equal(gm.length, 3, 'GameScreen 3 Modal cizer (quit + complete + failed)');
    assert.equal(
      gm.filter((n) => typeof n.props.onRequestClose === 'function').length,
      3,
      'GameScreen Modal\'larinin HEPSINDE onRequestClose olmali',
    );

    const p = mount(PREGAME, {
      visible: true, levelNum: 2, inventory: {},
      onConfirm: () => {}, onCancel: () => {},
    });
    const pm = flattenNodes(p.tree).filter((n) => n.name === 'Modal');
    assert.equal(pm.length, 1);
    assert.equal(typeof pm[0].props.onRequestClose, 'function');
  });
});

test('BULGU 5: App\'in KENDI iki yeni modali da onRequestClose tasir', async () => {
  await withoutTimers(async () => {
    const { m } = await appKur();
    const modaller = flattenNodes(m.tree).filter((n) => n.name === 'Modal');
    assert.equal(modaller.length, 2, 'App 2 kendi Modal\'ini cizer');
    assert.equal(
      modaller.filter((n) => typeof n.props.onRequestClose === 'function').length,
      2,
    );
  });
});

// ====================================================================
// BULGU 1 — OYUN ORTASINDA CIKIS
// ====================================================================

function oyunuKur(ekstra = {}) {
  const kayit = [];
  let geri = 0;
  const m = mount(GAME, {
    levelNum: 4,
    save: { inventory: { shuffle: 1, hammer: 1 } },
    boosters: {},
    onLevelEnd: (r) => kayit.push(r),
    onBack: () => { geri += 1; },
    onNextLevel: () => {},
    onReplay: () => {},
    onUseBooster: () => {},
    backRequest: 0,
    ...ekstra,
  });
  return { m, kayit, geriSayisi: () => geri };
}

test('BULGU 1: "<-" tusu ONCE sorar, oyun ekranindan HEMEN cikmaz', () => {
  withoutTimers(() => {
    const { m, kayit, geriSayisi } = oyunuKur();
    press(findPressableByText(m.tree, '←'));

    assert.equal(geriSayisi(), 0, 'onay sorulmadan cikilmamali');
    assert.equal(kayit.length, 0);
    const t = collectVisibleText(m.tree).join('|');
    assert.ok(t.includes('Quit this level?'), 'onay metni gorunmeli');
    assert.ok(t.includes('Keep Playing'));
  });
});

test('BULGU 1: "Keep Playing" oyunda BIRAKIR', () => {
  withoutTimers(() => {
    const { m, kayit, geriSayisi } = oyunuKur();
    press(findPressableByText(m.tree, '←'));
    press(findPressableByText(m.tree, 'Keep Playing'));
    assert.equal(geriSayisi(), 0);
    assert.equal(kayit.length, 0);
    assert.ok(!collectVisibleText(m.tree).join('|').includes('Quit this level?'));
  });
});

test('BULGU 1: onaylanan cikis ILERLEMEYI GONDERIR (eskiden sessizce siliniyordu)', () => {
  withoutTimers(() => {
    const { m, kayit, geriSayisi } = oyunuKur();
    press(findPressableByText(m.tree, '←'));
    press(findPressableByText(m.tree, 'Quit Level'));

    assert.equal(geriSayisi(), 1, 'onaydan sonra seviye listesine donulmeli');
    assert.equal(kayit.length, 1, 'oturum ilerlemesi GONDERILMELI');
    const r = kayit[0];
    assert.equal(r.abandoned, true);
    assert.equal(r.won, false);
    assert.equal(r.coinsEarned, 0, 'yarim el coin ODEMEZ');
    assert.equal(r.levelNum, 4);
    assert.ok(r.statsDelta, 'istatistik farki tasinmali');
    assert.ok(Array.isArray(r.questEvents) && r.questEvents.length > 0,
      'gorev olaylari tasinmali');
    assert.ok(!r.questEvents.some((e) => e.type === 'win'), 'kazanma sayilmaz');
  });
});

test('BULGU 1: yarim birakilan el kazanma SERISINI kirmaz, kaybetmek kirar', async () => {
  // ⚠️ Bu test ONCE kurali kendi icinde YENIDEN YAZIYORDU ve App.js'teki
  // gercek dal bozuldugunda YESIL kaliyordu (mutasyon sinavi M8 hayatta
  // kaldi). Simdi App.handleLevelEnd GERCEKTEN cagriliyor ve kayittaki
  // winStreak okunuyor.
  await withoutTimers(async () => {
    const { bul } = await appKur();
    bul('HomeScreen').props.onPlay();
    bul('LevelSelectScreen').props.onSelectLevel(1);
    bul('PreGameBoosterModal').props.onConfirm({});

    const seri = () => bul('GameScreen').props.save.winStreak || 0;
    const bitir = (ekstra) => bul('GameScreen').props.onLevelEnd({
      levelNum: 1,
      won: false,
      abandoned: false,
      score: 100,
      stars: 0,
      coinsEarned: 0,
      coinBreakdown: { base: 0, cascade: 0, mult: 1, total: 0 },
      newStreak: 0,
      statsDelta: {},
      questEvents: [],
      inventoryUsed: { shuffle: 0, hammer: 0 },
      ...ekstra,
    });

    bitir({ won: true, stars: 1 });
    assert.equal(seri(), 1, 'kazanma seriyi artirmali');
    bitir({ won: true, stars: 1 });
    assert.equal(seri(), 2);

    bitir({ abandoned: true });
    assert.equal(seri(), 2, 'yarim birakmak seriyi KIRMAMALI');

    bitir({ won: false });
    assert.equal(seri(), 0, 'kaybetmek seriyi KIRAR');
  });
});

test('BULGU 1+5: donanim geri tusu de AYNI onayi acar (backRequest)', () => {
  withoutTimers(() => {
    const { m, kayit, geriSayisi } = oyunuKur();
    assert.ok(!collectVisibleText(m.tree).join('|').includes('Quit this level?'));
    m.setProps({ backRequest: 1 });
    assert.ok(collectVisibleText(m.tree).join('|').includes('Quit this level?'),
      'geri tusu istegi onay modalini acmali');
    assert.equal(geriSayisi(), 0);
    assert.equal(kayit.length, 0);
  });
});

// ====================================================================
// BULGU 3 — HEDEF PUAN
// ====================================================================

test('BULGU 3: shortfallLabel farki SAYIYLA soyler', () => {
  assert.equal(shortfallLabel(12340, 12500), `Target ${(12500).toLocaleString()} — ${(160).toLocaleString()} short`);
  assert.equal(shortfallLabel(12500, 12500), `Target ${(12500).toLocaleString()} — reached`);
  assert.equal(shortfallLabel(99999, 12500), `Target ${(12500).toLocaleString()} — reached`);
  assert.equal(shortfallLabel(NaN, 500), `Target ${(500).toLocaleString()} — ${(500).toLocaleString()} short`);
});

test('BULGU 3: hedef puan OYUN EKRANINDA sayi olarak yaziyor', () => {
  withoutTimers(() => {
    const seviye = 12;
    const cfg = LEVELS[seviye - 1];
    const { m } = oyunuKur({ levelNum: seviye });
    const t = collectVisibleText(m.tree).join('|');
    assert.ok(
      t.includes(cfg.target1.toLocaleString()),
      `1. yildiz hedefi (${cfg.target1}) ekranda yok: ${t.slice(0, 200)}`,
    );
    assert.ok(t.includes(cfg.target2.toLocaleString()), '2. yildiz hedefi de yazmali');
    assert.ok(t.includes(cfg.target3.toLocaleString()), '3. yildiz hedefi de yazmali');
  });
});

test('BULGU 3: kaybetme modali NE KADAR EKSIK kaldigini yazar', () => {
  withoutTimers(() => {
    const seviye = 12;
    const cfg = LEVELS[seviye - 1];
    const { m } = oyunuKur({ levelNum: seviye });
    // Skor 0 iken tam hedef kadar eksik olmali.
    assert.ok(
      modalMetni(m.tree, 'Out of Moves!').includes(shortfallLabel(0, cfg.target1)),
      'kaybetme modalinda eksik puan metni olmali',
    );
    assert.ok(
      modalMetni(m.tree, 'Level Complete!').includes('Target'),
      'kazanma modalinda da hedef yazmali',
    );
  });
});

// ====================================================================
// BULGU 6 — PRE-GAME BOOSTER SECIMI
// ====================================================================

test('BULGU 6: nextSelection cikis/iptal/acilista secimi SIFIRLAR', () => {
  const dolu = { startBomb: true, startStriped: true };
  assert.deepEqual(nextSelection(dolu, 'cancel'), {});
  assert.deepEqual(nextSelection(dolu, 'confirm'), {});
  assert.deepEqual(nextSelection(dolu, 'skip'), {});
  assert.deepEqual(nextSelection(dolu, 'open'), {});
  assert.deepEqual(nextSelection({}, 'toggle', 'startBomb'), { startBomb: true });
  assert.deepEqual(nextSelection({ startBomb: true }, 'toggle', 'startBomb'), { startBomb: false });
  // Bilinmeyen olay durumu DEGISTIRMEZ.
  assert.equal(nextSelection(dolu, 'bilinmeyen'), dolu);
});

function boosterKur() {
  const onaylananlar = [];
  let iptal = 0;
  const m = mount(PREGAME, {
    visible: true,
    levelNum: 3,
    inventory: { startBomb: 2, startStriped: 1, plus5: 1 },
    onConfirm: (s) => onaylananlar.push({ ...s }),
    onCancel: () => { iptal += 1; },
  });
  const tikSayisi = () => collectVisibleText(m.tree).filter((t) => t === '✓').length;
  return { m, onaylananlar, iptalSayisi: () => iptal, tikSayisi };
}

test('BULGU 6: secim yapilabiliyor (olcumun kendisi calisiyor mu)', () => {
  const { m, tikSayisi } = boosterKur();
  assert.equal(tikSayisi(), 0, 'baslangicta secim olmamali');
  press(findPressableByText(m.tree, 'Color Bomb'));
  assert.equal(tikSayisi(), 1, 'secim isaretlenmeli');
});

test('BULGU 6: "<- Back" secimi SIFIRLAR (eskiden bir sonraki seviyeye TASINIYORDU)', () => {
  const { m, tikSayisi, iptalSayisi, onaylananlar } = boosterKur();
  press(findPressableByText(m.tree, 'Color Bomb'));
  assert.equal(tikSayisi(), 1);

  press(findPressableByText(m.tree, '← Back'));
  assert.equal(iptalSayisi(), 1, 'onCancel yine cagrilmali');
  assert.equal(tikSayisi(), 0, 'geri donunce secim KALMAMALI');

  // Modal yeniden acilir ve oyuncu "Start Level"a basarsa BOS secim gitmeli.
  press(findPressableByText(m.tree, 'Start Level'));
  assert.deepEqual(onaylananlar, [{}], 'kendiliginden booster harcanmamali');
});

test('BULGU 6: modal her ACILISINDA temiz baslar (ikinci katman)', () => {
  const { m, tikSayisi } = boosterKur();
  press(findPressableByText(m.tree, 'Color Bomb'));
  assert.equal(tikSayisi(), 1);
  // Ebeveyn modali kapatip yeniden aciyor (App.js pendingLevelNum ile boyle yapar).
  m.setProps({ visible: false });
  m.setProps({ visible: true, levelNum: 4 });
  assert.equal(tikSayisi(), 0, 'yeni seviyede secim tasinmamali');
});

test('BULGU 6: "Start Level" secilen booster\'i AYNEN gonderir', () => {
  const { m, onaylananlar } = boosterKur();
  press(findPressableByText(m.tree, 'Color Bomb'));
  press(findPressableByText(m.tree, 'Start Level'));
  assert.equal(onaylananlar.length, 1);
  assert.equal(Object.values(onaylananlar[0]).filter(Boolean).length, 1,
    'tam bir booster secili gitmeli');
});

test('BULGU 6: envanterde olmayan booster secilemez', () => {
  const m = mount(PREGAME, {
    visible: true, levelNum: 1, inventory: {},
    onConfirm: () => {}, onCancel: () => {},
  });
  press(findPressableByText(m.tree, 'Color Bomb'));
  assert.equal(collectVisibleText(m.tree).filter((t) => t === '✓').length, 0);
});
