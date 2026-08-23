import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator,
  AppState, BackHandler,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import HomeScreen from './src/screens/HomeScreen';
import LevelSelectScreen from './src/screens/LevelSelectScreen';
import GameScreen from './src/screens/GameScreen';
import HowToPlayModal from './src/screens/HowToPlayModal';
import DailyLoginModal from './src/components/DailyLoginModal';
import DailyQuestsModal from './src/components/DailyQuestsModal';
import BoosterShopModal from './src/components/BoosterShopModal';
import PreGameBoosterModal from './src/components/PreGameBoosterModal';
import AchievementsModal from './src/components/AchievementsModal';
import AchievementToast from './src/components/AchievementToast';
import {
  loadProgress, saveProgress, localDateStr, daysBetween,
  evaluateDailyLogin, needsQuestRefresh,
} from './src/utils/storage';
import { settleLives, takeLife } from './src/utils/lives';
import { ensureDailyQuests, applyQuestEvents } from './src/utils/quests';
import { checkUnlocks } from './src/utils/achievements';
import {
  DAILY_LOGIN_REWARDS, BOOSTER_DEFS, LIVES_MAX,
} from './src/constants/economy';
import { LEVELS } from './src/constants/levels';

// ====================================================================
// AKIS KARARLARI — SAF FONKSIYONLAR
//
// Bunlar bilerek bilesenin DISINA alindi: bir seviyenin baslayip
// baslamayacagi, "Next Level"in ne yapacagi ve donanim geri tusunun nereye
// gidecegi artik React'siz sinanabilir (tests/akis_butunlugu.test.js).
// Eskiden bu kararlar handleNextLevel / handleReplayLevel / handleConfirmBoosters
// govdelerine gomuluydu ve hicbiri sinanamiyordu.
// ====================================================================

export const AKIS = {
  START: 'start',
  NO_LIVES: 'noLives',
  FINISHED: 'finished',
};

/**
 * CAN KAPISI (bulgu: "Next Level can kapisini atliyor").
 * Tek dogru kaynak: `settleLives` ile TURETILMIS can sayisi. Kayittaki ham
 * `save.lives` alanina bakilmaz — regen zamani da hesaba katilir.
 */
export function canStartLevel(save, now = Date.now()) {
  if (!save) return false;
  return settleLives(save, now).lives > 0;
}

/**
 * "Next Level" dugmesinin kararli.
 * - son seviyeden sonrasi YOK  -> FINISHED (oyuncuya oyunun bittigi soylenir;
 *   eskiden sessizce seviye listesine dusuruluyordu, dugme yalan soyluyordu)
 * - can yok                     -> NO_LIVES (eskiden HIC sorulmuyordu)
 * - aksi halde                  -> START
 */
export function nextLevelDecision(currentLevel, save, now = Date.now()) {
  const cur = Number(currentLevel);
  const nextNum = (Number.isFinite(cur) ? Math.trunc(cur) : 0) + 1;
  if (nextNum > LEVELS.length) return { action: AKIS.FINISHED, levelNum: null };
  if (!canStartLevel(save, now)) return { action: AKIS.NO_LIVES, levelNum: nextNum };
  return { action: AKIS.START, levelNum: nextNum };
}

/** "Try Again" karari — ayni kapidan gecer. */
export function replayDecision(currentLevel, save, now = Date.now()) {
  const cur = Number(currentLevel);
  const num = Number.isFinite(cur) ? Math.trunc(cur) : 1;
  if (!canStartLevel(save, now)) return { action: AKIS.NO_LIVES, levelNum: num };
  return { action: AKIS.START, levelNum: num };
}

/**
 * ANDROID DONANIM GERI TUSU (bulgu: hicbir yerde tanimli degil).
 * En ustteki katmandan basa dogru: acik modal -> oyun -> seviye listesi -> ana
 * ekran -> uygulamadan cikis. `blocked` = tusu YUT, hicbir sey yapma
 * (gunluk giris odulu alinmadan kapanmamali).
 */
export function backTarget(ui) {
  const u = ui || {};
  if (u.showLogin) return 'blocked';
  if (u.showGameOver) return 'closeGameOver';
  if (u.showNoLives) return 'closeNoLives';
  if (u.showHowTo) return 'closeHowTo';
  if (u.showQuests) return 'closeQuests';
  if (u.showShop) return 'closeShop';
  if (u.showAchievements) return 'closeAchievements';
  if (u.pendingLevelNum != null) return 'closePreGame';
  if (u.screen === 'game') return 'quitGame';
  if (u.screen === 'levels') return 'toHome';
  return 'exit';
}

export default function App() {
  const [save, setSave] = useState(null);
  const [screen, setScreen] = useState('home');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [gameSessionId, setGameSessionId] = useState(0);
  const [gameBoosters, setGameBoosters] = useState({});

  const [showHowTo, setShowHowTo] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingLoginDay, setPendingLoginDay] = useState(0);
  const [pendingLevelNum, setPendingLevelNum] = useState(null);
  const [toastQueue, setToastQueue] = useState([]);
  // Oyunun SONU (30. seviyeden sonra) ve CAN KAPISI reddi artik ekranda
  // gorunur bir cevap uretir; ikisi de eskiden sessizdi.
  const [showGameOver, setShowGameOver] = useState(false);
  const [showNoLives, setShowNoLives] = useState(false);
  // Donanim geri tusu oyun ekranindayken GameScreen'in "cikmak istiyor musun"
  // onayini acar; sayac artinca GameScreen tepki verir.
  const [gameBackRequest, setGameBackRequest] = useState(0);

  // Tick to refresh life regen display every minute (UI only).
  const [, setMinuteTick] = useState(0);

  // ------------------------------------------------------------------
  // GECE YARISI DEVRI
  //
  // Eskiden gunluk gorev yenilemesi ve gunluk giris karari SADECE mount
  // aninda (deps `[]`) calisiyordu ve depoda AppState dinleyicisi HIC YOKTU.
  // Mobil uygulama gunlerce bellekte kalir: arka plandan donen oyuncu dunun
  // gorevlerini (cogu `claimed: true`) gormeye devam ediyor ve gunluk giris
  // odulunu HIC goremiyordu -- DailyQuestsModal ekranda "Reset at midnight"
  // yazarken.
  //
  // Cozum: gun dizesi bir STATE. Dakikalik tik ve AppState 'active' olayi onu
  // tazeler; degistiginde asagidaki tek devir efekti calisir. Soguk acilis ile
  // gece yarisi devri ARTIK AYNI KOD YOLU.
  // ------------------------------------------------------------------
  const [dayStr, setDayStr] = useState(() => localDateStr());
  const rolledDayRef = useRef(null);

  useEffect(() => {
    const refresh = () => {
      setMinuteTick((n) => n + 1);
      setDayStr((d) => {
        const today = localDateStr();
        return today === d ? d : today;
      });
    };
    const t = setInterval(refresh, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(t);
      if (sub && typeof sub.remove === 'function') sub.remove();
    };
  }, []);

  // ------------------------------------------------------------------
  // DONANIM GERI TUSU (Android)
  //
  // Depoda TEK BIR BackHandler yoktu: oyunun ortasinda geri tusu dogrudan
  // UYGULAMADAN CIKIS demekti (harcanan can + o eldeki tum ilerleme gider).
  // Karar `backTarget` icinde, saf ve sinanabilir; burada yalnizca uygulanir.
  //
  // ⚠️ KAPSAM: RN'de gorunur bir <Modal> Android geri tusunu KENDISI yutar ve
  // buraya HIC ulasmaz. Yani asagidaki switch'in modal dallari (closeHowTo,
  // closeQuests, closeShop, closeAchievements) gercek cihazda TEK BASINA
  // yetmez: her modalin KENDI `onRequestClose`'u olmak ZORUNDA.
  //
  // OLCULDU (bir onceki tur bu comment "5 modal kapsam disi" diyordu ve
  // OLU KAPI birakiyordu): depoda 11 gercek <Modal> var.
  //   App.js .............. 2  (asagida, ikisinde de onRequestClose)
  //   GameScreen .......... 3  (quit + complete + failed)
  //   PreGameBooster ...... 1
  //   HowToPlay ........... 1  ← bu turda eklendi (onClose)
  //   DailyQuests ......... 1  ← bu turda eklendi (onClose)
  //   BoosterShop ......... 1  ← bu turda eklendi (onClose)
  //   Achievements ........ 1  ← bu turda eklendi (onClose)
  //   DailyLogin .......... 1  ← KASITLI ISTISNA, asagiya bak
  // Tarama artik sabit sayi degil: tests/akis_butunlugu.test.js kaynaktaki
  // TUM <Modal>'leri bulur, tasiyan dosyayi mount eder ve prop'u OKUR; yeni
  // eklenen bir modal kendiliginden yakalanir.
  // ------------------------------------------------------------------
  useEffect(() => {
    const onBack = () => {
      const target = backTarget({
        showLogin, showGameOver, showNoLives, showHowTo, showQuests, showShop,
        showAchievements, pendingLevelNum, screen,
      });
      switch (target) {
        case 'blocked': return true;
        case 'closeGameOver': setShowGameOver(false); return true;
        case 'closeNoLives': setShowNoLives(false); return true;
        case 'closeHowTo': setShowHowTo(false); return true;
        case 'closeQuests': setShowQuests(false); return true;
        case 'closeShop': setShowShop(false); return true;
        case 'closeAchievements': setShowAchievements(false); return true;
        case 'closePreGame': setPendingLevelNum(null); return true;
        case 'quitGame': setGameBackRequest((n) => n + 1); return true;
        case 'toHome': setScreen('home'); return true;
        default: return false; // 'exit' -> isletim sistemi devrali
      }
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => {
      if (sub && typeof sub.remove === 'function') sub.remove();
      else if (BackHandler.removeEventListener) {
        BackHandler.removeEventListener('hardwareBackPress', onBack);
      }
    };
  }, [
    showLogin, showGameOver, showNoLives, showHowTo, showQuests, showShop,
    showAchievements, pendingLevelNum, screen,
  ]);

  useEffect(() => {
    (async () => {
      let s = await loadProgress();
      const livesUpd = settleLives(s);
      s = { ...s, ...livesUpd };
      setSave(s);
      saveProgress(s);
    })();
  }, []);

  // Gunluk devir: soguk acilista (save ilk geldiginde) VE her gun degisiminde.
  useEffect(() => {
    if (!save) return;
    if (rolledDayRef.current === dayStr) return;
    rolledDayRef.current = dayStr;

    let next = save;
    if (needsQuestRefresh(next, dayStr)) {
      next = ensureDailyQuests(next);
    }
    if (next !== save) commit(next);

    const decision = evaluateDailyLogin(next, dayStr);
    if (decision.showModal) {
      setPendingLoginDay(decision.nextDay);
      setShowLogin(true);
    }
  }, [dayStr, save]);

  function commit(updater) {
    setSave((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      saveProgress(next);
      return next;
    });
  }

  function claimDailyLogin() {
    const day = pendingLoginDay;
    const reward = DAILY_LOGIN_REWARDS.find((r) => r.day === day);
    commit((prev) => {
      // `lastLoginDateStr` GERIYE gitmez: cihaz saati geri alinip odul yeniden
      // alinmaya calisildiginda evaluateDailyLogin zaten reddediyor, burada da
      // gorulmus en yuksek gun korunuyor (iki katmanli).
      const claimedOn = prev.lastLoginDateStr && prev.lastLoginDateStr > dayStr
        ? prev.lastLoginDateStr
        : dayStr;
      const next = {
        ...prev,
        coins: prev.coins + (reward?.coins || 0),
        loginDay: day,
        lastLoginDateStr: claimedOn,
        stats: {
          ...prev.stats,
          lifetimeCoinsEarned: (prev.stats.lifetimeCoinsEarned || 0) + (reward?.coins || 0),
        },
      };
      if (reward?.booster) {
        next.inventory = {
          ...prev.inventory,
          [reward.booster.id]: (prev.inventory?.[reward.booster.id] || 0) + reward.booster.count,
        };
      }
      return next;
    });
    setShowLogin(false);
    setPendingLoginDay(0);
  }

  function handlePlay() {
    setScreen('levels');
  }

  function handleSelectLevel(num) {
    setPendingLevelNum(num);
  }

  function handleConfirmBoosters(selected) {
    // CAN KAPISI — TEK GECIT.
    // Eskiden burada `const lifeUpd = takeLife(next); if (lifeUpd) {...}` vardi
    // ve ELSE DALI YOKTU: takeLife 0 canda null donuyor, sessizce yutuluyor,
    // asagidaki setScreen('game') KOSULSUZ calisiyordu. Sonuc: "Next Level"
    // zincirine giren oyuncu 0 canla sinirsiz oynuyordu.
    if (!canStartLevel(save)) {
      setPendingLevelNum(null);
      setShowNoLives(true);
      return;
    }

    // Consume the chosen pre-game boosters from inventory + 1 life, then start.
    commit((prev) => {
      const next = { ...prev, inventory: { ...prev.inventory } };
      for (const id of Object.keys(selected)) {
        if (selected[id] && (next.inventory[id] || 0) > 0) {
          next.inventory[id] = next.inventory[id] - 1;
        } else {
          delete selected[id];
        }
      }
      const lifeUpd = takeLife(next);
      if (lifeUpd) {
        next.lives = lifeUpd.lives;
        next.lastLifeRegenMs = lifeUpd.lastLifeRegenMs;
      }
      // NOT: else dali yok cunku kapi YUKARIDA (canStartLevel). Buraya
      // gelindiginde can >= 1 oldugu zaten dogrulanmistir.
      return next;
    });
    setGameBoosters({ ...selected });
    setCurrentLevel(pendingLevelNum);
    setPendingLevelNum(null);
    setGameSessionId((n) => n + 1);
    setScreen('game');
  }

  function handleCancelBoosters() {
    setPendingLevelNum(null);
  }

  function handleLevelEnd(result) {
    commit((prev) => {
      let next = { ...prev };

      // Stats
      next.stats = { ...prev.stats };
      for (const k of Object.keys(result.statsDelta)) {
        if (k === 'bestCascadeLevel') {
          next.stats[k] = Math.max(prev.stats[k] || 0, result.statsDelta[k]);
        } else {
          next.stats[k] = (prev.stats[k] || 0) + result.statsDelta[k];
        }
      }
      next.stats.lifetimeCoinsEarned = (prev.stats.lifetimeCoinsEarned || 0) + result.coinsEarned;

      // Streak
      // YARIM BIRAKILAN EL (result.abandoned): oyuncu seviyeyi bitirmeden
      // cikti. O ana kadarki istatistik/gorev ilerlemesi KAYDEDILIR (eskiden
      // tamami sessizce siliniyordu) ama kazanma serisi KIRILMAZ — birakmak
      // kaybetmek degildir, kaybetmenin tek olcusu hamlelerin bitmesidir.
      if (result.abandoned) {
        next.winStreak = prev.winStreak || 0;
      } else {
        next.winStreak = result.won ? (prev.winStreak || 0) + 1 : 0;
      }
      next.stats.bestWinStreak = Math.max(prev.stats.bestWinStreak || 0, next.winStreak);

      // Coins
      next.coins = (prev.coins || 0) + result.coinsEarned;

      // Progression (win only)
      if (result.won) {
        next.stars = { ...prev.stars };
        const prevStars = next.stars[result.levelNum] || 0;
        if (result.stars > prevStars) next.stars[result.levelNum] = result.stars;

        next.highScores = { ...prev.highScores };
        const prevHigh = next.highScores[result.levelNum] || 0;
        if (result.score > prevHigh) next.highScores[result.levelNum] = result.score;

        if (result.levelNum >= (prev.maxLevel || 1) && result.levelNum < LEVELS.length) {
          next.maxLevel = result.levelNum + 1;
        }
      }

      // Quest progress + auto-claim coins
      const { quests, earnedCoins } = applyQuestEvents(next, result.questEvents);
      next.dailyQuests = quests;
      next.coins += earnedCoins;
      if (earnedCoins > 0) {
        next.stats.lifetimeCoinsEarned += earnedCoins;
      }

      // Achievement unlocks
      const { newlyUnlocked, rewardCoins } = checkUnlocks(next);
      if (newlyUnlocked.length > 0) {
        next.achievements = { ...prev.achievements };
        for (const a of newlyUnlocked) next.achievements[a.id] = true;
        next.coins += rewardCoins;
        next.stats.lifetimeCoinsEarned += rewardCoins;
        // queue toasts AFTER commit completes
        setTimeout(() => {
          setToastQueue((q) => [...q, ...newlyUnlocked]);
        }, 600);
      }

      return next;
    });
  }

  function handleNextLevel() {
    const d = nextLevelDecision(currentLevel, save);
    setScreen('levels');
    if (d.action === AKIS.FINISHED) {
      // OYUNUN SONU. Eskiden burada sadece `setScreen('levels')` vardi:
      // yesil "Next Level" dugmesine basan oyuncu hicbir aciklama gormeden
      // listeye dusuyor ve dugmenin bozuk oldugunu saniyordu.
      setShowGameOver(true);
      return;
    }
    if (d.action === AKIS.NO_LIVES) {
      setShowNoLives(true);
      return;
    }
    // Open pre-game booster modal for next level
    setPendingLevelNum(d.levelNum);
  }

  function handleReplayLevel() {
    // Same level, fresh attempt. Need to consume a life.
    const d = replayDecision(currentLevel, save);
    setScreen('levels');
    if (d.action === AKIS.NO_LIVES) {
      setShowNoLives(true);
      return;
    }
    setPendingLevelNum(d.levelNum);
  }

  function handleBackToLevels() {
    setScreen('levels');
  }

  function handleUseBooster(id) {
    commit((prev) => {
      const inv = { ...prev.inventory };
      if ((inv[id] || 0) > 0) inv[id] -= 1;
      return { ...prev, inventory: inv };
    });
  }

  function handleBuyBooster(id) {
    const def = BOOSTER_DEFS[id];
    if (!def) return;
    commit((prev) => {
      if ((prev.coins || 0) < def.cost) return prev;
      return {
        ...prev,
        coins: prev.coins - def.cost,
        inventory: {
          ...prev.inventory,
          [id]: (prev.inventory?.[id] || 0) + 1,
        },
      };
    });
  }

  if (!save) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#ff6bcb" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      {screen === 'home' && (
        <HomeScreen
          save={save}
          onPlay={handlePlay}
          onHowToPlay={() => setShowHowTo(true)}
          onOpenQuests={() => setShowQuests(true)}
          onOpenShop={() => setShowShop(true)}
          onOpenAchievements={() => setShowAchievements(true)}
        />
      )}

      {screen === 'levels' && (
        <LevelSelectScreen
          save={save}
          onSelectLevel={handleSelectLevel}
          onOpenShop={() => setShowShop(true)}
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'game' && (
        <GameScreen
          key={`level_${currentLevel}_${gameSessionId}`}
          levelNum={currentLevel}
          save={save}
          boosters={gameBoosters}
          onLevelEnd={handleLevelEnd}
          onNextLevel={handleNextLevel}
          onReplay={handleReplayLevel}
          onBack={handleBackToLevels}
          onUseBooster={handleUseBooster}
          backRequest={gameBackRequest}
        />
      )}

      <HowToPlayModal visible={showHowTo} onClose={() => setShowHowTo(false)} />

      {/*
        KASITLI ISTISNA — DailyLoginModal'in `onRequestClose`'u YOK ve
        OLMAYACAK. Odul ALINMADAN kapanmamali; Android geri tusunun modal
        tarafindan yutulmasi burada ISTENEN davranistir ve `backTarget`
        ayni seyi soyler (showLogin -> 'blocked'). Kapanisin tek yolu
        `onClaim`. Muafiyet tests/akis_butunlugu.test.js'te ADIYLA yazilidir;
        BASKA hicbir modal muaf degildir.
      */}
      <DailyLoginModal
        visible={showLogin}
        day={pendingLoginDay}
        onClaim={claimDailyLogin}
      />

      <DailyQuestsModal
        visible={showQuests}
        quests={save.dailyQuests}
        onClose={() => setShowQuests(false)}
      />

      <BoosterShopModal
        visible={showShop}
        coins={save.coins}
        inventory={save.inventory}
        onBuy={handleBuyBooster}
        onClose={() => setShowShop(false)}
      />

      <PreGameBoosterModal
        visible={pendingLevelNum != null}
        levelNum={pendingLevelNum || 1}
        inventory={save.inventory}
        onConfirm={handleConfirmBoosters}
        onCancel={handleCancelBoosters}
      />

      <AchievementsModal
        visible={showAchievements}
        unlocked={save.achievements}
        onClose={() => setShowAchievements(false)}
      />

      {/*
        OYUNU BITIRME EKRANI (bulgu: seviye 30'da "Next Level" yalan soyluyor).
        KAPSAM: yeni seviye uretimi / sonsuz mod YOK. Var olan bitis akisi
        DURUST hale getirildi: dugme artik oyunun bittigini soyluyor ve
        oyuncuyu seviye listesine donduruyor.
      */}
      <Modal
        visible={showGameOver}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGameOver(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>You Beat Sugar Blast!</Text>
            <Text style={styles.modalBody}>
              All {LEVELS.length} levels complete. There is no Level {LEVELS.length + 1} yet —
              replay any level to chase 3 stars and a higher score.
            </Text>
            <TouchableOpacity
              style={styles.modalBtn}
              activeOpacity={0.8}
              onPress={() => setShowGameOver(false)}
            >
              <Text style={styles.modalBtnText}>Back to Levels</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/*
        CAN KAPISI REDDI (bulgu: "Next Level" can kapisini atliyor).
        Eskiden can 0 iken de seviye basliyordu; artik reddin bir sesi var.
      */}
      <Modal
        visible={showNoLives}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNoLives(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Out of Lives</Text>
            <Text style={styles.modalBody}>
              You need 1 life to start a level. A life comes back every 20 minutes,
              up to {LIVES_MAX}. The shop sells boosters, not lives.
            </Text>
            <TouchableOpacity
              style={styles.modalBtn}
              activeOpacity={0.8}
              onPress={() => setShowNoLives(false)}
            >
              <Text style={styles.modalBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {toastQueue.length > 0 && (
        <AchievementToast
          key={toastQueue[0].id}
          ach={toastQueue[0]}
          onDone={() => setToastQueue((q) => q.slice(1))}
        />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1a0533',
  },
  loading: {
    flex: 1,
    backgroundColor: '#1a0533',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '84%',
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
    backgroundColor: '#2d1260',
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.35)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffd700',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d7c4ff',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalBtn: {
    paddingHorizontal: 40,
    paddingVertical: 13,
    borderRadius: 26,
    minWidth: 200,
    alignItems: 'center',
    backgroundColor: '#6200ea',
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
  },
});
