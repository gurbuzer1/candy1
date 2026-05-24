import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { THEME } from '../constants/game';
import HudBar from '../components/HudBar';
import AnimatedBackground from '../components/AnimatedBackground';

export default function HomeScreen({
  save,
  onPlay,
  onHowToPlay,
  onOpenQuests,
  onOpenShop,
  onOpenAchievements,
}) {
  return (
    <LinearGradient
      colors={['#4a1f8a', '#2d1b69', '#1a0533', '#0d021a']}
      locations={[0, 0.3, 0.7, 1]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#4a1f8a" />

      <AnimatedBackground />


      <View style={styles.hudWrap}>
        <HudBar save={save} onTapCoins={onOpenShop} onTapLives={onOpenShop} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <BounceTitle delayMs={120} style={styles.titleSugar}>Sugar</BounceTitle>
          <BounceTitle delayMs={300} style={styles.titleBlast}>Blast</BounceTitle>
        </View>
        <FadeInText delayMs={520} style={styles.subtitle}>MATCH 3 PUZZLE</FadeInText>

        <View style={styles.buttonContainer}>
          <BreathingPlayButton onPress={onPlay} />

          <View style={styles.actionsRow}>
            <ActionPill icon="📜" label="Quests" onPress={onOpenQuests} />
            <ActionPill icon="🛒" label="Shop" onPress={onOpenShop} />
            <ActionPill icon="🏆" label="Awards" onPress={onOpenAchievements} />
          </View>

          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8} onPress={onHowToPlay}>
            <LinearGradient colors={['#7c4dff', '#6200ea']} style={styles.secondaryButtonInner}>
              <Text style={styles.secondaryButtonText}>How to Play</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

function BounceTitle({ children, delayMs, style }) {
  const scale = useSharedValue(0.2);
  const opacity = useSharedValue(0);
  const ty = useSharedValue(-24);

  useEffect(() => {
    scale.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1.18, { duration: 360, easing: Easing.out(Easing.back(1.8)) }),
        withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }),
      ),
    );
    opacity.value = withDelay(delayMs, withTiming(1, { duration: 280 }));
    ty.value = withDelay(delayMs, withTiming(0, { duration: 380, easing: Easing.out(Easing.back(1.5)) }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }, { scale: scale.value }],
  }));

  return <Animated.Text style={[style, animStyle]}>{children}</Animated.Text>;
}

function FadeInText({ children, delayMs, style }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withDelay(delayMs, withTiming(1, { duration: 420 }));
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.Text style={[style, animStyle]}>{children}</Animated.Text>;
}

function BreathingPlayButton({ onPress }) {
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(620, withTiming(1, { duration: 300 }));
    scale.value = withDelay(
      620,
      withSequence(
        withTiming(1.08, { duration: 340, easing: Easing.out(Easing.back(1.6)) }),
        withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
        withRepeat(
          withSequence(
            withTiming(1.03, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
            withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
          ),
          -1,
          true,
        ),
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity style={styles.playButton} activeOpacity={0.85} onPress={onPress}>
        <LinearGradient colors={['#4cff50', '#00c853']} style={styles.playButtonInner}>
          <Text style={styles.playButtonText}>Play!</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ActionPill({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.pill} activeOpacity={0.75} onPress={onPress}>
      <Text style={styles.pillIcon}>{icon}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  decorContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  decorDot: {
    position: 'absolute',
    backgroundColor: '#fff',
  },
  hudWrap: {
    paddingTop: 48,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  titleSugar: {
    fontFamily: 'System',
    fontSize: 52,
    fontWeight: '900',
    color: '#ff6bcb',
    textShadowColor: '#d4237a',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
    letterSpacing: 2,
  },
  titleBlast: {
    fontFamily: 'System',
    fontSize: 68,
    fontWeight: '900',
    color: '#ffd700',
    textShadowColor: '#cc8800',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
    marginTop: -10,
    letterSpacing: 3,
  },
  subtitle: {
    color: '#b388ff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 5,
    marginBottom: 40,
  },
  buttonContainer: {
    alignItems: 'center',
  },
  playButton: {
    borderRadius: 30,
    marginBottom: 16,
    elevation: 6,
    shadowColor: '#00c853',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  playButtonInner: {
    paddingHorizontal: 60,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  playButtonText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#004d00',
    letterSpacing: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  pillIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  pillLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryButton: {
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#6200ea',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  secondaryButtonInner: {
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
});
