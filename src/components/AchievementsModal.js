import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ACHIEVEMENT_DEFS } from '../constants/economy';

export default function AchievementsModal({ visible, unlocked, onClose }) {
  const total = ACHIEVEMENT_DEFS.length;
  const won = Object.keys(unlocked || {}).filter((id) => unlocked[id]).length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient colors={['#3d1f8a', '#2d1260']} style={styles.box}>
          <Text style={styles.title}>Achievements</Text>
          <Text style={styles.subtitle}>{won} of {total} unlocked</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {ACHIEVEMENT_DEFS.map((a) => {
              const isUnlocked = !!unlocked?.[a.id];
              return (
                <View key={a.id} style={[styles.row, isUnlocked && styles.rowUnlocked]}>
                  <Text style={[styles.badge, !isUnlocked && styles.badgeLocked]}>
                    {isUnlocked ? '🏆' : '🔒'}
                  </Text>
                  <View style={styles.rowText}>
                    <Text style={[styles.name, !isUnlocked && styles.nameLocked]}>{a.name}</Text>
                    <Text style={styles.desc}>{a.desc}</Text>
                  </View>
                  <Text style={[styles.reward, isUnlocked && styles.rewardEarned]}>
                    🪙 {a.reward}
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
            <LinearGradient colors={['#7c4dff', '#6200ea']} style={styles.btn}>
              <Text style={styles.btnText}>Close</Text>
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
  box: {
    width: '90%',
    maxHeight: '82%',
    borderRadius: 22,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffd700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#b388ff',
    textAlign: 'center',
    marginBottom: 14,
    fontWeight: '700',
  },
  list: {
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  rowUnlocked: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  badge: {
    fontSize: 24,
    marginRight: 12,
  },
  badgeLocked: {
    opacity: 0.5,
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
  },
  nameLocked: {
    color: 'rgba(255,255,255,0.55)',
  },
  desc: {
    fontSize: 11,
    color: '#b388ff',
    marginTop: 2,
    fontWeight: '600',
  },
  reward: {
    fontSize: 12,
    color: '#888',
    fontWeight: '800',
  },
  rewardEarned: {
    color: '#ffd700',
  },
  btn: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});
