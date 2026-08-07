import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ---------------------------------------------------------------------------
// BOZUK KAYIT BU EKRANI COKERTIYORDU.
// storage.js gorev listesini hic dogrulamiyordu; quests.js sadece
// `length === 3` + tarih soruyordu. `{"dailyQuests":[1,2,3]}` bu kapiyi
// geciyor ve asagidaki `q.progress.toLocaleString()` cagrisi
// "TypeError: Cannot read properties of undefined (reading 'toLocaleString')"
// ile uygulamayi cokertiyordu. Ayni tuzak SURUM GECISINDE de kurulu:
// gorev nesnesinin sekli degisirse mevcut oyuncularin ekrani aciliramiyor.
//
// Iki katmanli savunma: (1) storage.js yuklemede `sanitizeQuests` ile bozuk
// listeyi [] yapar, (2) bu ekran yine de HICBIR SEYE guvenmez ve her alani
// normalize eder. Ikinci katman surum gecislerinde tek guvencedir.
// ---------------------------------------------------------------------------
function normalizeQuest(q) {
  const raw = q && typeof q === 'object' && !Array.isArray(q) ? q : {};
  const target = Number.isFinite(Number(raw.target)) && Number(raw.target) > 0
    ? Math.trunc(Number(raw.target))
    : 1;
  const progressNum = Number(raw.progress);
  const progress = Number.isFinite(progressNum)
    ? Math.max(0, Math.min(target, Math.trunc(progressNum)))
    : 0;
  const rewardNum = Number(raw.reward);
  const reward = Number.isFinite(rewardNum) ? Math.max(0, Math.trunc(rewardNum)) : 0;
  const desc = typeof raw.desc === 'string' && raw.desc !== '' ? raw.desc : 'Daily quest';
  return { desc, target, progress, reward, claimed: raw.claimed === true };
}

function rowKey(q, i) {
  return q && typeof q === 'object' && typeof q.id === 'string' && q.id !== '' ? q.id : `quest_${i}`;
}

export default function DailyQuestsModal({ visible, quests, onClose }) {
  const safeQuests = Array.isArray(quests) ? quests : [];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient colors={['#3d1f8a', '#2d1260']} style={styles.box}>
          <Text style={styles.title}>Daily Quests</Text>
          <Text style={styles.subtitle}>Reset at midnight</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {safeQuests.map((q, i) => (
              <QuestRow key={rowKey(q, i)} q={q} />
            ))}
            {safeQuests.length === 0 && (
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
  const { desc, target, progress, reward, claimed } = normalizeQuest(q);
  const pct = Math.max(0, Math.min(100, (progress / target) * 100));
  return (
    <View style={[styles.row, claimed && styles.rowDone]}>
      <View style={styles.rowText}>
        <Text style={styles.rowDesc}>{desc}</Text>
        <Text style={styles.rowProgress}>
          {progress.toLocaleString()} / {target.toLocaleString()}
        </Text>
      </View>
      <View style={styles.reward}>
        <Text style={styles.rewardText}>🪙 {reward}</Text>
        {claimed && <Text style={styles.claimedTag}>✓</Text>}
      </View>
      <View style={styles.barWrap}>
        <View style={[styles.barFill, { width: `${pct}%` }, claimed && styles.barFillDone]} />
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
