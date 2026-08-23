import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME } from '../constants/game';
import { LEVELS } from '../constants/levels';
import HudBar from '../components/HudBar';
import AnimatedBackground from '../components/AnimatedBackground';

export default function LevelSelectScreen({ save, onSelectLevel, onBack, onOpenShop }) {
  const [noLivesFlash, setNoLivesFlash] = useState(false);
  const noLives = (save?.lives ?? 5) <= 0;

  function handleTap(num, unlocked) {
    if (!unlocked) return;
    if (noLives) {
      setNoLivesFlash(true);
      setTimeout(() => setNoLivesFlash(false), 1600);
      return;
    }
    onSelectLevel(num);
  }

  return (
    <LinearGradient
      colors={[THEME.bg2, THEME.bg1, THEME.bg3]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />

      <AnimatedBackground />

      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Select Level</Text>
        <View style={{ width: 44 }} />
      </View>

      <HudBar save={save} onTapCoins={onOpenShop} onTapLives={onOpenShop} />

      {noLivesFlash && (
        <View style={styles.noLivesPill}>
          <Text style={styles.noLivesText}>Out of lives — a life comes back every 20 minutes</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {LEVELS.map((level, i) => {
          const num = i + 1;
          const unlocked = num <= (save?.maxLevel || 1);
          const stars = save?.stars?.[num] || 0;
          const isCurrent = num === (save?.maxLevel || 1);
          const dimmed = unlocked && noLives;

          return (
            <TouchableOpacity
              key={num}
              style={[
                styles.levelBtn,
                unlocked && styles.levelUnlocked,
                isCurrent && styles.levelCurrent,
                dimmed && styles.levelDimmed,
              ]}
              activeOpacity={unlocked ? 0.7 : 1}
              onPress={() => handleTap(num, unlocked)}
            >
              <LinearGradient
                colors={
                  isCurrent
                    ? ['#ff6bcb', '#d4237a']
                    : unlocked
                    ? ['#7c4dff', '#5e35b1']
                    : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']
                }
                style={styles.levelBtnGradient}
              >
                <Text style={[styles.levelNum, !unlocked && styles.levelNumLocked]}>
                  {unlocked ? num : '🔒'}
                </Text>
                {unlocked && (
                  <View style={styles.starsRow}>
                    {[1, 2, 3].map((s) => (
                      <Text
                        key={s}
                        style={[
                          styles.starIcon,
                          s <= stars ? styles.starEarned : styles.starEmpty,
                        ]}
                      >
                        ★
                      </Text>
                    ))}
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 22,
    color: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
  },
  noLivesPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 71, 87, 0.95)',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: 8,
  },
  noLivesText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },
  levelBtn: {
    width: '18.4%',
    aspectRatio: 1,
    margin: '0.8%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  levelBtnGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelUnlocked: {
    elevation: 4,
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  levelCurrent: {
    elevation: 6,
    shadowColor: '#ff6bcb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  levelDimmed: {
    opacity: 0.5,
  },
  levelNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
  },
  levelNumLocked: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },
  starsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  starIcon: {
    fontSize: 8,
    marginHorizontal: 0.5,
  },
  starEarned: {
    color: '#ffd700',
  },
  starEmpty: {
    color: 'rgba(255,255,255,0.2)',
  },
});
