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
import fs from 'node:fs';
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

// --------------------------------------------------------------------
// OLU MODAL KAPILARI — SABIT SAYI DEGIL, TARAMA.
//
// Asagidaki iki test (GameScreen/PreGame ve "App'in kendi 2 modali") DOGRU
// ama DAR: sabit sayilar yazar ve yalnizca 3 dosyaya bakar. Dogrulama ajani
// olctu: depoda 11 gercek <Modal> var, o iki test bunlarin 6'sini goruyordu;
// kalan 5'ten 4'u OLU KAPIYDI (Android'de gorunur bir Modal donanim geri
// tusunu KENDISI yutar, App.js'in BackHandler'ina HIC ulasmaz -> oyuncu
// sikisir). Testler SILINMEDI (hala dogru ve daha keskin hata mesaji
// veriyorlar); asagiya TARAYICI eklendi: yeni bir modal eklendiginde
// kimsenin bir sayiyi elle guncellemesi gerekmez.
// --------------------------------------------------------------------

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
// OLU MODAL KAPILARI — TUM MODALLERIN TARANMASI
//
// OLCUM BICIMI iki katmanli, cunku tek katman yalan soyluyor:
//   1) KESIF  — kaynakta (App.js + src/**) `<Modal` gecen DOSYALARI bulur.
//      Bu yalnizca "nereye bakmali" sorusunu cevaplar; prop'a kaynaktan
//      BAKMAZ (grep, `onRequestClose={undefined}` gibi bir yalani goremez).
//   2) DOGRULAMA — bulunan her dosya GERCEKTEN mount edilir, agactaki Modal
//      dugumlerinin `props.onRequestClose`'u OKUNUR ve fonksiyon mu diye
//      bakilir.
// Yeni bir modal eklenirse (1) onu bulur, kayit defterinde yoksa test
// KIRILIR ve "kayit defterine ekle" der. Sabit sayi YOK.
// ====================================================================

const HOWTO = path.join(KOK, 'src', 'screens', 'HowToPlayModal.js');
const QUESTS = path.join(KOK, 'src', 'components', 'DailyQuestsModal.js');
const SHOP = path.join(KOK, 'src', 'components', 'BoosterShopModal.js');
const ACH = path.join(KOK, 'src', 'components', 'AchievementsModal.js');
const LOGIN = path.join(KOK, 'src', 'components', 'DailyLoginModal.js');

/**
 * KASITLI ISTISNA — TEK. DailyLoginModal'in geri tusunu YUTMASI istenen
 * davranistir (odul alinmadan kapanmamali; `backTarget` da 'blocked' der).
 * Bu liste BUYUMEMELI: asagida hem "muaf olan gercekten muaf mi" hem de
 * "muafiyet digerlerini kor etti mi" ayri ayri sinaniyor.
 */
const MUAF = ['DailyLoginModal.js'];

/** `//` ve `/* *\/` yorumlarini kabaca siler — yorumdaki `<Modal>` sayilmasin. */
function yorumsuz(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/** App.js + src/** icinde `<Modal` gecen dosyalar (mutlak yol). */
function modalTasiyanDosyalar() {
  const bulunan = [];
  const bak = (f) => {
    if (/<Modal\b/.test(yorumsuz(fs.readFileSync(f, 'utf8')))) bulunan.push(f);
  };
  const gez = (d) => {
    for (const ad of fs.readdirSync(d)) {
      const fp = path.join(d, ad);
      if (fs.statSync(fp).isDirectory()) gez(fp);
      else if (/\.jsx?$/.test(ad)) bak(fp);
    }
  };
  bak(path.join(KOK, 'App.js'));
  gez(path.join(KOK, 'src'));
  return bulunan;
}

/**
 * KAYIT DEFTERI: her modal tasiyici dosya + onu AYAGA KALDIRAN prop'lar.
 * Kosum takimi ic ice fonksiyon bilesenlerini BILEREK cagirmaz (bkz.
 * qa_akis_render.mjs), yani App'i mount etmek cocuk modallerin Modal
 * dugumlerini URETMEZ — her dosya AYRI mount edilmek ZORUNDA. Sabit sayi
 * yerine bu defter tutuluyor.
 */
const KAYIT_DEFTERI = [
  { dosya: GAME, mount: () => mount(GAME, {
    levelNum: 3, save: { inventory: {} }, boosters: {},
    onLevelEnd: () => {}, onBack: () => {}, backRequest: 0,
  }) },
  { dosya: PREGAME, mount: () => mount(PREGAME, {
    visible: true, levelNum: 2, inventory: {},
    onConfirm: () => {}, onCancel: () => {},
  }) },
  { dosya: HOWTO, mount: () => mount(HOWTO, { visible: true, onClose: () => {} }) },
  { dosya: QUESTS, mount: () => mount(QUESTS, {
    visible: true, quests: [], onClose: () => {},
  }) },
  { dosya: SHOP, mount: () => mount(SHOP, {
    visible: true, coins: 0, inventory: {}, onBuy: () => {}, onClose: () => {},
  }) },
  { dosya: ACH, mount: () => mount(ACH, {
    visible: true, unlocked: {}, onClose: () => {},
  }) },
  { dosya: LOGIN, mount: () => mount(LOGIN, {
    visible: true, day: 1, onClaim: () => {},
  }) },
];

/** Mount edilmis bir agactaki Modal dugumleri. */
function modalDugumleri(m) {
  return flattenNodes(m.tree).filter((n) => n.name === 'Modal');
}

/** OLU KAPI olcutu: prop bir FONKSIYON degilse geri tusu hicbir yere gitmez. */
function oluKapi(node) {
  return typeof node.props?.onRequestClose !== 'function';
}

test('OLU KAPI: kaynakta `<Modal` gecen HER dosya kayit defterinde olmali', () => {
  const kaynakta = modalTasiyanDosyalar().map((f) => path.relative(KOK, f));
  const defterde = [APP, ...KAYIT_DEFTERI.map((k) => k.dosya)]
    .map((f) => path.relative(KOK, f));

  const eksik = kaynakta.filter((f) => !defterde.includes(f));
  const fazla = defterde.filter((f) => !kaynakta.includes(f));

  assert.deepEqual(eksik, [],
    `Modal tasiyan ama SINANMAYAN dosya(lar): ${eksik.join(', ')} `
    + '-> tests/akis_butunlugu.test.js icindeki KAYIT_DEFTERI\'ne ekle.');
  assert.deepEqual(fazla, [],
    `Defterde olup kaynakta Modal tasimayan dosya(lar): ${fazla.join(', ')}`);
  // Olcumun kendisi yasiyor mu: hicbir sey bulamayan bir tarayici da "eksik
  // yok" der. En az App.js + GameScreen bulunmali.
  assert.ok(kaynakta.length >= 2, `tarama coktu, bulunan: ${kaynakta.length}`);
});

test('OLU KAPI: MUAF olanlar disinda her Modal onRequestClose TASIR', async () => {
  await withoutTimers(async () => {
    const olu = [];
    let toplam = 0;

    // App.js'in KENDI modalleri (gercek uygulama akisiyla mount edilir).
    const { m } = await appKur();
    for (const n of modalDugumleri(m)) {
      toplam += 1;
      if (oluKapi(n)) olu.push(`App.js: "${collectText(n).join(' ').slice(0, 40)}"`);
    }

    for (const { dosya, mount: kur } of KAYIT_DEFTERI) {
      const ad = path.basename(dosya);
      const dugumler = modalDugumleri(kur());
      assert.ok(dugumler.length > 0, `${ad}: agacta Modal BULUNAMADI (olcum coktu)`);
      for (const n of dugumler) {
        toplam += 1;
        if (MUAF.includes(ad)) continue; // kasitli istisna
        if (oluKapi(n)) olu.push(`${ad}: "${collectText(n).join(' ').slice(0, 40)}"`);
      }
    }

    assert.deepEqual(olu, [],
      `onRequestClose TASIMAYAN Modal(ler) -- Android geri tusu bunlarda OLU:\n  `
      + olu.join('\n  '));
    // Kalibrasyon: sayim gercekten yapildi mi (0 modal sayan bir olcum de
    // "olu kapi yok" derdi).
    assert.ok(toplam >= 11, `taranan Modal sayisi beklenenden az: ${toplam}`);
  });
});

test('OLU KAPI: muafiyet DIGER modalleri kor etmiyor (kontrol vakasi)', async () => {
  await withoutTimers(async () => {
    // (a) Muafiyet listesi TEK ad icerir ve o ad gercekten bir modal dosyasi.
    assert.deepEqual(MUAF, ['DailyLoginModal.js']);
    assert.ok(
      KAYIT_DEFTERI.some((k) => path.basename(k.dosya) === MUAF[0]),
      'muaf tutulan dosya defterde bile degil -> muafiyet anlamsiz',
    );

    // (b) Muafiyet HALA GEREKLI mi? DailyLogin'e bir gun onRequestClose
    // eklenirse bu satir kirilir ve muafiyetin KALDIRILMASI gerektigini
    // soyler. Boylece liste sessizce bayatlamaz.
    const l = modalDugumleri(mount(LOGIN, { visible: true, day: 1, onClaim: () => {} }));
    assert.equal(l.length, 1);
    assert.ok(oluKapi(l[0]),
      'DailyLoginModal artik onRequestClose tasiyor -> MUAF listesinden CIKAR');

    // (c) Muaf OLMAYAN her dosya gercekten sinaniyor mu: muafiyet disindaki
    // her kayit en az bir Modal uretmeli ve HEPSI kapiyi tasimali.
    const sinananlar = KAYIT_DEFTERI
      .filter((k) => !MUAF.includes(path.basename(k.dosya)));
    assert.equal(sinananlar.length, KAYIT_DEFTERI.length - 1,
      'muaf olmayan dosya sayisi beklenenden farkli');
    for (const { dosya, mount: kur } of sinananlar) {
      const ad = path.basename(dosya);
      for (const n of modalDugumleri(kur())) {
        assert.ok(!oluKapi(n), `${ad} muaf DEGIL ama kapisi OLU`);
      }
    }

    // (d) OLCUT'un kendisi calisiyor mu: uydurma bir "kapisiz" dugum OLU
    // sayilmali, kapili olan sayilmamali. (Bu olmadan `oluKapi` daima false
    // dondurse bile yukaridaki her sey YESIL gecerdi.)
    assert.equal(oluKapi({ props: {} }), true);
    assert.equal(oluKapi({ props: { onRequestClose: undefined } }), true);
    assert.equal(oluKapi({ props: { onRequestClose: true } }), true, 'fonksiyon degilse OLU');
    assert.equal(oluKapi({ props: { onRequestClose: () => {} } }), false);
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

/**
 * REGRESYON — bu duzeltme turunun KENDI urettigi hata.
 *
 * "Geri tusu onay sorsun" duzeltmesi App.js'e artan bir sayac koydu
 * (`setGameBackRequest(n => n + 1)`) ama SIFIRLAYAN hicbir yer yok. GameScreen
 * ise App.js:485'te `key={`level_${currentLevel}_${gameSessionId}`}` ile HER
 * SEVIYEDE YENIDEN MOUNT oluyor ve useEffect ilk render'da da kosuyor.
 * Sonuc: oyuncu herhangi bir seviyede BIR KEZ geri tusuna bastiktan sonra
 * SONRAKI HER SEVIYE "Quit this level?" modali ACIK basliyordu.
 *
 * Dogru olcut mutlak deger degil DEGISIM: mount anindaki deger taban alinir.
 */
test('REGRESYON: backRequest>0 ile MOUNT edilen taze seviye quit modalini ACMAZ', () => {
  withoutTimers(() => {
    const quitModal = (m) =>
      flattenNodes(m.tree)
        .filter((n) => n.name === 'Modal')
        .find((n) => collectText(n).some((t) => String(t).includes('Quit this level?')));

    // Oyuncu onceki seviyelerde uc kez geri tusuna basmis; sayac 3'te kalmis.
    const g = mount(GAME, {
      levelNum: 4,
      save: { inventory: {} },
      boosters: {},
      onLevelEnd: () => {},
      onBack: () => {},
      backRequest: 3,
    });

    const acilis = quitModal(g);
    assert.ok(acilis, 'quit modali agacta cizilmeli (visible=false olsa bile)');
    assert.equal(
      acilis.props.visible,
      false,
      'TAZE seviye quit modali ACIK baslamamali -- sayac >0 diye tetiklenmemeli',
    );

    // KONTROL VAKASI: sayac gercekten ARTINCA modal acilmali.
    // (Bu olmadan test "modal hic acilmiyor" diyen bir bozuklugu da yesil gecerdi.)
    g.setProps({ backRequest: 4 });
    assert.equal(
      quitModal(g).props.visible,
      true,
      'sayac artinca quit modali ACILMALI -- kontrol vakasi',
    );
  });
});
