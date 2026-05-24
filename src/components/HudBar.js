import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { msUntilNextLife, formatMsClock } from '../utils/lives';
import { LIVES_MAX } from '../constants/economy';

export default function HudBar({ save, onTapCoins, onTapLives, style }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const lives = save?.lives ?? LIVES_MAX;
  const coins = save?.coins ?? 0;
  const ms = msUntilNextLife(save || {});
  const showTimer = lives < LIVES_MAX && ms > 0;

  return (
    <View style={[styles.bar, style]}>
      <TouchableOpacity style={styles.slot} onPress={onTapLives} activeOpacity={0.7}>
        <Text style={styles.icon}>❤️</Text>
        <Text style={styles.value}>{lives}/{LIVES_MAX}</Text>
        {showTimer && (
          <Text style={styles.timer}>{formatMsClock(ms)}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.slot} onPress={onTapCoins} activeOpacity={0.7}>
        <Text style={styles.icon}>🪙</Text>
        <Text style={styles.value}>{coins.toLocaleString()}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  icon: {
    fontSize: 16,
    marginRight: 6,
  },
  value: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
  },
  timer: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffd700',
    marginLeft: 8,
    fontVariant: ['tabular-nums'],
  },
});
