import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DAILY_LOGIN_REWARDS, BOOSTER_DEFS } from '../constants/economy';

export default function DailyLoginModal({ visible, day, onClaim }) {
  return (
    // ⚠️ `onRequestClose` BILEREK YOK — bu tek KASITLI istisna.
    // Android'de gorunur bir Modal donanim geri tusunu kendisi yutar; burada
    // yutmasi ISTENEN davranis: gunluk giris odulu ALINMADAN modal kapanmamali
    // (App.backTarget da ayni kurali soyluyor: showLogin -> 'blocked').
    // Kapanisin TEK yolu asagidaki "Claim" dugmesi -> onClaim.
    // Baska bir modalde onRequestClose'un olmamasi HATADIR: bkz.
    // tests/akis_butunlugu.test.js "OLU MODAL KAPILARI" taramasi (muafiyet
    // listesi yalnizca bu dosyayi icerir).
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <LinearGradient colors={['#3d1f8a', '#2d1260']} style={styles.box}>
          <Text style={styles.title}>Daily Reward</Text>
          <Text style={styles.subtitle}>Day {day} of 7</Text>

          <View style={styles.grid}>
            {DAILY_LOGIN_REWARDS.map((r) => {
              const isToday = r.day === day;
              const isPast = r.day < day;
              return (
                <View
                  key={r.day}
                  style={[
                    styles.slot,
                    isToday && styles.slotActive,
                    isPast && styles.slotPast,
                  ]}
                >
                  <Text style={styles.slotDay}>Day {r.day}</Text>
                  <Text style={styles.slotCoin}>🪙 {r.coins}</Text>
                  {r.booster && (
                    <Text style={styles.slotBooster}>
                      {BOOSTER_DEFS[r.booster.id].icon} ×{r.booster.count}
                    </Text>
                  )}
                  {isPast && <Text style={styles.check}>✓</Text>}
                </View>
              );
            })}
          </View>

          <TouchableOpacity onPress={onClaim} activeOpacity={0.8}>
            <LinearGradient colors={['#4cff50', '#00c853']} style={styles.btn}>
              <Text style={styles.btnText}>Claim Day {day}</Text>
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
    width: '88%',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffd700',
  },
  subtitle: {
    fontSize: 13,
    color: '#b388ff',
    marginBottom: 14,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 18,
  },
  slot: {
    width: '23%',
    aspectRatio: 0.85,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    margin: '1%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  slotActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.18)',
    borderColor: '#ffd700',
  },
  slotPast: {
    opacity: 0.4,
  },
  slotDay: {
    fontSize: 10,
    color: '#b388ff',
    fontWeight: '700',
  },
  slotCoin: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '800',
    marginTop: 2,
  },
  slotBooster: {
    fontSize: 10,
    color: '#ffd700',
    marginTop: 1,
  },
  check: {
    position: 'absolute',
    fontSize: 24,
    color: '#4cff50',
  },
  btn: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 24,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#004d00',
  },
});
