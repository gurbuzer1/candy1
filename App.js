import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import HomeScreen from './src/screens/HomeScreen';
import LevelSelectScreen from './src/screens/LevelSelectScreen';
import GameScreen from './src/screens/GameScreen';
import HowToPlayModal from './src/screens/HowToPlayModal';
import { loadProgress } from './src/utils/storage';
import { LEVELS } from './src/constants/levels';

export default function App() {
  const [screen, setScreen] = useState('home'); // home | levels | game
  const [currentLevel, setCurrentLevel] = useState(1);
  const [progress, setProgress] = useState({ maxLevel: 1, stars: {}, highScores: {} });
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    loadProgress().then(p => setProgress(p));
  }, []);

  const refreshProgress = async () => {
    const p = await loadProgress();
    setProgress(p);
  };

  const handlePlay = () => {
    refreshProgress();
    setScreen('levels');
  };

  const handleSelectLevel = (num) => {
    setCurrentLevel(num);
    setScreen('game');
  };

  const handleLevelComplete = async (levelNum) => {
    await refreshProgress();
    if (levelNum < LEVELS.length) {
      setCurrentLevel(levelNum + 1);
      setScreen('game');
    } else {
      setScreen('levels');
    }
  };

  const handleBackToLevels = async () => {
    await refreshProgress();
    setScreen('levels');
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      {screen === 'home' && (
        <HomeScreen
          onPlay={handlePlay}
          onHowToPlay={() => setShowHowTo(true)}
        />
      )}

      {screen === 'levels' && (
        <LevelSelectScreen
          progress={progress}
          onSelectLevel={handleSelectLevel}
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'game' && (
        <GameScreen
          key={`level_${currentLevel}_${Date.now()}`}
          levelNum={currentLevel}
          progress={progress}
          onComplete={handleLevelComplete}
          onBack={handleBackToLevels}
        />
      )}

      <HowToPlayModal visible={showHowTo} onClose={() => setShowHowTo(false)} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1a0533',
  },
});
