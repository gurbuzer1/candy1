import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME } from '../constants/game';

export default function HowToPlayModal({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient colors={['#3d1f8a', '#2d1260']} style={styles.content}>
          <Text style={styles.title}>How to Play</Text>

          <View style={styles.instructions}>
            <Text style={styles.instruction}>
              <Text style={styles.bold}>Swap </Text>
              adjacent candies to make matches of 3 or more!
            </Text>
            <Text style={styles.instruction}>
              <Text style={styles.bold}>4 in a row </Text>
              creates a Striped candy that clears a whole row or column!
            </Text>
            <Text style={styles.instruction}>
              <Text style={styles.bold}>L or T shape </Text>
              creates a Wrapped candy that explodes in a 3×3 area!
            </Text>
            <Text style={styles.instruction}>
              <Text style={styles.bold}>5 in a row </Text>
              creates a Color Bomb that removes all candies of one color!
            </Text>
            <Text style={styles.instruction}>
              Reach the <Text style={styles.bold}>target score</Text> before
              you run out of moves!
            </Text>
          </View>

          <TouchableOpacity onPress={onClose}>
            <LinearGradient colors={['#4cff50', '#00c853']} style={styles.btn}>
              <Text style={styles.btnText}>Got it!</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '85%',
    borderRadius: 24,
    padding: 28,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffd700',
    textAlign: 'center',
    marginBottom: 20,
  },
  instructions: {
    marginBottom: 24,
  },
  instruction: {
    fontSize: 15,
    color: '#d4c0ff',
    lineHeight: 22,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '800',
    color: THEME.accent,
  },
  btn: {
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#004d00',
  },
});
