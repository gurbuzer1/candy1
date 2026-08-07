/**
 * MUTASYON SINAVI — AKIS BUTUNLUGU.
 *
 * "Yesil suite kanit degildir." Her duzeltme KASTEN bozulur, sinavin KIRMIZI
 * oldugu gorulur, sonra geri alinip YESIL oldugu dogrulanir.
 *
 * ⚠️ Bu depoda daha once oldu: eslesmeyen bir regex sessizce HICBIR SEY
 * yapmadi ve suite yesil kaldigi icin "test koruyor" sanildi. Bu yuzden her
 * mutasyon icin `s !== o` YAZDIRILIYOR; uygulanmayan mutasyon HATA sayilir.
 *
 * Kosum:  node qa/mutasyon_akis.mjs
 * Cikis kodu 0 = tum mutasyonlar kirmizi oldu ve hepsi geri alindi.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(KOK, 'App.js');
const GAME = path.join(KOK, 'src', 'screens', 'GameScreen.js');
const PREGAME = path.join(KOK, 'src', 'components', 'PreGameBoosterModal.js');
// OLU MODAL KAPILARI turu: onRequestClose tasimasi gereken diger modaller.
const HOWTO = path.join(KOK, 'src', 'screens', 'HowToPlayModal.js');
const QUESTS = path.join(KOK, 'src', 'components', 'DailyQuestsModal.js');
const SHOP = path.join(KOK, 'src', 'components', 'BoosterShopModal.js');
const ACH = path.join(KOK, 'src', 'components', 'AchievementsModal.js');
const LOGIN = path.join(KOK, 'src', 'components', 'DailyLoginModal.js');
const SINAV = path.join('tests', 'akis_butunlugu.test.js');
const SINAV_ABS = path.join(KOK, SINAV);

/**
 * ⚠️ Dosyalar CRLF. Duz metin arama coklu satirda SESSIZCE eslesmez — ilk
 * kosumda 6 mutasyon tam bu yuzden "uygulanmadi" cikti. Desen, satir sonu
 * fark etmeksizin eslesen bir regex'e cevriliyor.
 */
function desen(bul) {
  const kacan = bul.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(kacan.replace(/\n/g, '\\r?\\n'));
}

/** [ad, dosya, bul, degistir] */
const MUTASYONLAR = [
  [
    'M1 can kapisi HEP acik (canStartLevel -> true)',
    APP,
    'return settleLives(save, now).lives > 0;',
    'return true; // MUTANT',
  ],
  [
    'M2 "Next Level" can kapisini atlar (eski davranis)',
    APP,
    'if (!canStartLevel(save, now)) return { action: AKIS.NO_LIVES, levelNum: nextNum };',
    '// MUTANT: kapi yok',
  ],
  [
    'M3 handleConfirmBoosters kapisi kaldirildi (else dali yine yok)',
    APP,
    `if (!canStartLevel(save)) {
      setPendingLevelNum(null);
      setShowNoLives(true);
      return;
    }`,
    '// MUTANT: kapi yok',
  ],
  [
    'M4 seviye 30 sonrasi sessizce listeye duser (eski davranis)',
    APP,
    'if (nextNum > LEVELS.length) return { action: AKIS.FINISHED, levelNum: null };',
    'if (nextNum > LEVELS.length) return { action: AKIS.START, levelNum: nextNum }; // MUTANT',
  ],
  [
    'M5 donanim geri tusu oyun ekraninda cikis yapar',
    APP,
    "if (u.screen === 'game') return 'quitGame';",
    "if (u.screen === 'game') return 'exit'; // MUTANT",
  ],
  [
    'M6 geri tusu seviye listesinden ana ekrana DONMEZ',
    APP,
    "if (u.screen === 'levels') return 'toHome';",
    '// MUTANT: dal yok',
  ],
  [
    'M7 BackHandler hic kaydedilmez',
    APP,
    "const sub = BackHandler.addEventListener('hardwareBackPress', onBack);",
    'const sub = null; // MUTANT',
  ],
  [
    'M8 yarim birakilan el kazanma serisini KIRAR',
    APP,
    'if (result.abandoned) {\n        next.winStreak = prev.winStreak || 0;',
    'if (false) {\n        next.winStreak = prev.winStreak || 0; // MUTANT',
  ],
  [
    'M9 oyun ici geri tusu ONAY SORMADAN cikar (eski davranis)',
    GAME,
    '<TouchableOpacity style={styles.backBtn} onPress={requestQuit}>',
    '<TouchableOpacity style={styles.backBtn} onPress={onBack}>',
  ],
  [
    'M10 cikis onaylaninca ilerleme GONDERILMEZ (eski davranis)',
    GAME,
    "emitResult(false, 0, { base: 0, cascade: 0, mult: 1, total: 0 }, true);",
    '// MUTANT: emitResult yok',
  ],
  [
    'M11 abandoned bayragi sonuca konmaz',
    GAME,
    '      abandoned,\n      score: scoreRef.current,',
    '      score: scoreRef.current,',
  ],
  [
    'M12 hedef puan satiri BOS (eski davranis: hicbir yerde yazmiyor)',
    GAME,
    '{`Target ★ ${levelConfig.target1.toLocaleString()}`}',
    "{''} /* MUTANT */",
  ],
  [
    'M13 kaybetme modalinde eksik puan yazmaz',
    GAME,
    '<Text style={styles.targetLine}>{shortfallLabel(score, levelConfig.target1)}</Text>\n            <Text style={styles.streakBroken}>',
    '<Text style={styles.streakBroken}>',
  ],
  [
    'M14b shortfallLabel farki YANLIS hesaplar',
    GAME,
    'const diff = t - s;',
    'const diff = t; // MUTANT',
  ],
  [
    'M14 son seviyede dugme yine "Next Level" der (eski davranis)',
    GAME,
    "{isFinalLevel ? 'Finish Game' : 'Next Level'}",
    "{'Next Level'} /* MUTANT */",
  ],
  [
    'M15 GameScreen sonuc modallerinde onRequestClose yok',
    GAME,
    'onRequestClose={() => { setShowComplete(false); onBack?.(); }}',
    '/* MUTANT: onRequestClose yok */',
  ],
  [
    // ⚠️ BAYAT DESEN BULUNDU (2026-08-07): bu mutasyonun arama metni
    // `if (backRequest > 0) requestQuit();` idi. c1a215c'deki regresyon
    // duzeltmesi satiri `backRequestBaselineRef` olcutune cevirdi ve desen
    // ARTIK ESLESMIYORDU -> mutasyon SESSIZCE uygulanmiyordu, yani "backRequest
    // dinleniyor mu" sorusu turlardir HIC sinanmamisti. Yeni gecis sayaci
    // (`arama metni N kez gecti`) bunu ortaya cikardi. Desen guncellendi.
    'M16 donanim geri istegi (backRequest) dinlenmez',
    GAME,
    '    if (backRequest > backRequestBaselineRef.current) {',
    '    if (false) { // MUTANT: dinlenmiyor',
  ],
  [
    'M17 "<- Back" secimi sifirlamaz (eski davranis)',
    PREGAME,
    'onPress={cancel} style={styles.cancelBtn}',
    'onPress={onCancel} style={styles.cancelBtn}',
  ],
  [
    'M18 nextSelection cancel dalinda susar',
    PREGAME,
    "    case 'cancel':\n",
    '',
  ],
  [
    'M19 modal acilista temizlenmez (ikinci katman yok)',
    PREGAME,
    "if (visible) setSelected((s) => nextSelection(s, 'open'));",
    '// MUTANT: temizlik yok',
  ],
  [
    'M20 PreGameBoosterModal Modal\'inda onRequestClose yok',
    PREGAME,
    'onRequestClose={cancel}',
    '',
  ],

  // ------------------------------------------------------------------
  // OLU MODAL KAPILARI (bu tur). Android'de gorunur bir Modal donanim geri
  // tusunu KENDISI yutar; `onRequestClose` yoksa tus HICBIR yere gitmez ve
  // oyuncu modalda sikisir. Asagidaki dortu 2026-08-07'de duzeltildi.
  // ------------------------------------------------------------------
  [
    'M21 HowToPlayModal kapisi OLU (onRequestClose kaldirildi)',
    HOWTO,
    '<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>',
    '<Modal visible={visible} transparent animationType="fade">',
  ],
  [
    'M22 DailyQuestsModal kapisi OLU',
    QUESTS,
    '<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>',
    '<Modal visible={visible} transparent animationType="fade">',
  ],
  [
    'M23 BoosterShopModal kapisi OLU',
    SHOP,
    '<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>',
    '<Modal visible={visible} transparent animationType="fade">',
  ],
  [
    'M24 AchievementsModal kapisi OLU',
    ACH,
    '<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>',
    '<Modal visible={visible} transparent animationType="fade">',
  ],
  [
    // TERS YONLU KONTROL: muafiyet BAYATLARSA da kirilmali. DailyLogin'e
    // onRequestClose eklenirse "kasitli istisna" gerekcesi coker; sinav
    // muafiyeti sessizce tasimamali, KALDIRILMASINI istemeli.
    'M25 (TERS) DailyLoginModal onRequestClose KAZANIR -> muafiyet bayatlar',
    LOGIN,
    '<Modal visible={visible} transparent animationType="fade">',
    '<Modal visible={visible} transparent animationType="fade" onRequestClose={onClaim}>',
  ],
  [
    // OLCUMUN KENDISI: kesif testi gercekten isiriyor mu? Kayit defterinden
    // bir dosya dusurulurse "Modal tasiyan ama SINANMAYAN dosya" cikmali.
    // (Bu olmadan defter sessizce kucultulup tarama kor edilebilirdi.)
    'M26 (OLCUM) kayit defterinden HowToPlay dusuruldu -> kesif kor kalmamali',
    SINAV_ABS,
    "  { dosya: HOWTO, mount: () => mount(HOWTO, { visible: true, onClose: () => {} }) },",
    '',
  ],
];

function kosSinav() {
  const r = spawnSync(process.execPath, ['--test', SINAV], {
    cwd: KOK,
    encoding: 'utf8',
    shell: false,
  });
  const cikti = `${r.stdout || ''}${r.stderr || ''}`;
  const fail = /^ℹ fail (\d+)$/m.exec(cikti);
  const pass = /^ℹ pass (\d+)$/m.exec(cikti);
  return {
    kod: r.status,
    fail: fail ? Number(fail[1]) : -1,
    pass: pass ? Number(pass[1]) : -1,
  };
}

const temiz = kosSinav();
console.log(`TEMIZ HAL: pass=${temiz.pass} fail=${temiz.fail} (cikis ${temiz.kod})`);
if (temiz.kod !== 0 || temiz.fail !== 0) {
  console.error('Temiz halde suite YESIL degil — mutasyon sinavi anlamsiz.');
  process.exit(1);
}

let hata = 0;
for (const [ad, dosya, bul, degistir] of MUTASYONLAR) {
  const o = readFileSync(dosya, 'utf8');
  const re = desen(bul);
  // ⚠️ ARAMA METNI KAC KEZ GECIYOR: 0 ise mutasyon hic uygulanmaz (sessiz
  // basari tuzagi), 1'den fazlaysa `replace` YALNIZCA ILKINI degistirir ve
  // "neyi bozdugumuzu" bilmeyiz. Ikisi de sinavi GECERSIZ kilar.
  const kez = (o.match(new RegExp(re.source, 'g')) || []).length;
  if (kez !== 1) {
    console.log(`✖ ${ad}\n   arama metni ${kez} kez gecti (1 olmali) -> sinav GECERSIZ`);
    hata += 1;
    continue;
  }
  const s = o.replace(re, degistir);
  const uygulandi = s !== o;
  writeFileSync(dosya, s);
  const r = kosSinav();
  writeFileSync(dosya, o);
  const geri = readFileSync(dosya, 'utf8') === o;
  const y = kosSinav();

  const kirmizi = r.kod !== 0 && r.fail > 0;
  const durum = uygulandi && kirmizi && geri && y.kod === 0 ? '✔' : '✖';
  if (durum === '✖') hata += 1;
  console.log(
    `${durum} ${ad}\n   gecis=${kez} | uygulandi(s!==o)=${uygulandi} | mutantta fail=${r.fail} `
    + `(cikis ${r.kod}) | geri alindi=${geri} | geri alinca fail=${y.fail}`,
  );
}

console.log(`\nSONUC: ${MUTASYONLAR.length - hata}/${MUTASYONLAR.length} mutasyon KIRMIZI oldu.`);
process.exit(hata === 0 ? 0 : 1);
