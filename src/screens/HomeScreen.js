import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME } from '../constants/game';

export default function HomeScreen({ onPlay, onHowToPlay }) {
  return (
    <LinearGradient
      colors={['#4a1f8a', '#2d1b69', '#1a0533', '#0d021a']}
      locations={[0, 0.3, 0.7, 1]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#4a1f8a" />

      {/* Background decorative elements */}
      <View style={styles.decorContainer}>
        {[...Array(12)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.decorDot,
              {
                left: `${(i * 23) % 100}%`,
                top: `${(i * 17 + 10) % 80}%`,
                width: 4 + (i % 3) * 3,
                height: 4 + (i % 3) * 3,
                borderRadius: 6,
                opacity: 0.1 + (i % 4) * 0.05,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={styles.titleSugar}>Sugar</Text>
          <Text style={styles.titleBlast}>Blast</Text>
        </View>
        <Text style={styles.subtitle}>MATCH 3 PUZZLE</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.playButton}
            activeOpacity={0.8}
            onPress={onPlay}
          >
            <LinearGradient
              colors={['#4cff50', '#00c853']}
              style={styles.playButtonInner}
            >
              <Text style={styles.playButtonText}>Play!</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={onHowToPlay}
          >
            <LinearGradient
              colors={['#7c4dff', '#6200ea']}
              style={styles.secondaryButtonInner}
            >
              <Text style={styles.secondaryButtonText}>How to Play</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decorContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  decorDot: {
    position: 'absolute',
    backgroundColor: '#fff',
  },
  content: {
    alignItems: 'center',
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
    marginBottom: 60,
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
