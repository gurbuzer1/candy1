import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, AppState } from 'react-native';
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
      next.winStreak = result.won ? (prev.winStreak || 0) + 1 : 0;
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
    const nextNum = currentLevel + 1;
    if (nextNum > LEVELS.length) {
      setScreen('levels');
      return;
    }
    // Open pre-game booster modal for next level
    setPendingLevelNum(nextNum);
    setScreen('levels');
  }

  function handleReplayLevel() {
    // Same level, fresh attempt. Need to consume a life.
    if ((save?.lives ?? 0) <= 0) {
      setScreen('levels');
      return;
    }
    setPendingLevelNum(currentLevel);
    setScreen('levels');
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
        />
      )}

      <HowToPlayModal visible={showHowTo} onClose={() => setShowHowTo(false)} />

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
});
