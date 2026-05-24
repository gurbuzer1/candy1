import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function DailyQuestsModal({ visible, quests, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <LinearGradient colors={['#3d1f8a', '#2d1260']} style={styles.box}>
          <Text style={styles.title}>Daily Quests</Text>
          <Text style={styles.subtitle}>Reset at midnight</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {(quests || []).map((q) => (
              <QuestRow key={q.id} q={q} />
            ))}
            {(!quests || quests.length === 0) && (
              <Text style={styles.empty}>No quests today</Text>
            )}
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

function QuestRow({ q }) {
  const pct = Math.min(100, (q.progress / q.target) * 100);
  return (
    <View style={[styles.row, q.claimed && styles.rowDone]}>
      <View style={styles.rowText}>
        <Text style={styles.rowDesc}>{q.desc}</Text>
        <Text style={styles.rowProgress}>
          {q.progress.toLocaleString()} / {q.target.toLocaleString()}
        </Text>
      </View>
      <View style={styles.reward}>
        <Text style={styles.rewardText}>🪙 {q.reward}</Text>
        {q.claimed && <Text style={styles.claimedTag}>✓</Text>}
      </View>
      <View style={styles.barWrap}>
        <View style={[styles.barFill, { width: `${pct}%` }, q.claimed && styles.barFillDone]} />
      </View>
    </View>
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
    width: '88%',
    maxHeight: '80%',
    borderRadius: 22,
    padding: 22,
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
  empty: {
    color: '#b388ff',
    textAlign: 'center',
    padding: 20,
  },
  row: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  rowDone: {
    backgroundColor: 'rgba(76, 255, 80, 0.1)',
    borderColor: 'rgba(76, 255, 80, 0.3)',
  },
  rowText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rowDesc: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
    flex: 1,
  },
  rowProgress: {
    fontSize: 11,
    color: '#b388ff',
    fontWeight: '700',
  },
  reward: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardText: {
    fontSize: 11,
    color: '#ffd700',
    fontWeight: '800',
  },
  claimedTag: {
    fontSize: 14,
    color: '#4cff50',
    marginLeft: 4,
    fontWeight: '900',
  },
  barWrap: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#ff6bcb',
  },
  barFillDone: {
    backgroundColor: '#4cff50',
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
