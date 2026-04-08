import React from 'react';
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

export default function LevelSelectScreen({ progress, onSelectLevel, onBack }) {
  return (
    <LinearGradient
      colors={[THEME.bg2, THEME.bg1, THEME.bg3]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Select Level</Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {LEVELS.map((level, i) => {
          const num = i + 1;
          const unlocked = num <= progress.maxLevel;
          const stars = progress.stars[num] || 0;
          const isCurrent = num === progress.maxLevel;

          return (
            <TouchableOpacity
              key={num}
              style={[
                styles.levelBtn,
                unlocked && styles.levelUnlocked,
                isCurrent && styles.levelCurrent,
                !unlocked && styles.levelLocked,
              ]}
              activeOpacity={unlocked ? 0.7 : 1}
              onPress={() => unlocked && onSelectLevel(num)}
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
                <Text
                  style={[
                    styles.levelNum,
                    !unlocked && styles.levelNumLocked,
                  ]}
                >
                  {unlocked ? num : '🔒'}
                </Text>
                {unlocked && (
                  <View style={styles.starsRow}>
                    {[1, 2, 3].map(s => (
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
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
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
    marginRight: 16,
  },
  backText: {
    fontSize: 22,
    color: '#fff',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
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
  levelLocked: {},
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
