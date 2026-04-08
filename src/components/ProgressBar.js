import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME } from '../constants/game';

export default function ProgressBar({ score, target1, target2, target3 }) {
  const percent = Math.min(100, (score / target3) * 100);
  const star1Pct = (target1 / target3) * 100;
  const star2Pct = (target2 / target3) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.barBg}>
        <LinearGradient
          colors={[THEME.accent, THEME.accent2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.barFill, { width: `${percent}%` }]}
        />
      </View>
      <View style={styles.markers}>
        <StarMarker position={star1Pct} earned={score >= target1} />
        <StarMarker position={star2Pct} earned={score >= target2} />
        <StarMarker position={97} earned={score >= target3} />
      </View>
    </View>
  );
}

function StarMarker({ position, earned }) {
  return (
    <Text
      style={[
        styles.star,
        { left: `${position}%` },
        earned && styles.starEarned,
      ]}
    >
      ★
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  barBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  markers: {
    position: 'relative',
    height: 20,
    marginTop: -2,
  },
  star: {
    position: 'absolute',
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    transform: [{ translateX: -7 }],
  },
  starEarned: {
    color: '#ffd700',
    fontSize: 16,
    textShadowColor: 'rgba(255, 215, 0, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
