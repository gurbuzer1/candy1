import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BOOSTER_LIST } from '../constants/economy';

const PREGAME = BOOSTER_LIST.filter((b) => b.type === 'pregame');

/**
 * SECIM DURUMU YASAM DONGUSU (bulgu: "<- Back" secimi SIFIRLAMIYOR).
 *
 * ESKI DAVRANIS: `setSelected({})` yalnizca confirm() ve skip() icindeydi;
 * "<- Back" dogrudan `onCancel`i cagiriyordu. Bilesen App.js'te KOSULSUZ
 * render edildigi (yalnizca `visible` degisiyor) icin durum ASLA sifirlanmiyor,
 * modal bir sonraki seviye icin acildiginda ayni booster'lar SECILI geliyordu.
 * "Start Level"a basan oyuncu istemedigi booster'i envanterinden HARCIYORDU.
 *
 * Karar saf bir fonksiyona alindi ki React'siz sinanabilsin.
 * `open` = modal gorunur oldu (ikinci katman: cancel bir sekilde kacsa bile
 * her acilis TEMIZ baslar).
 */
export function nextSelection(prev, event, id) {
  switch (event) {
    case 'confirm':
    case 'skip':
    case 'cancel':
    case 'open':
      return {};
    case 'toggle':
      return { ...prev, [id]: !prev[id] };
    default:
      return prev;
  }
}

export default function PreGameBoosterModal({
  visible,
  levelNum,
  inventory,
  onConfirm,
  onCancel,
}) {
  const [selected, setSelected] = useState({});

  // Modal her ACILISINDA secim temizlenir.
  useEffect(() => {
    if (visible) setSelected((s) => nextSelection(s, 'open'));
  }, [visible]);

  function toggle(id) {
    setSelected((s) => nextSelection(s, 'toggle', id));
  }

  function confirm() {
    onConfirm(selected);
    setSelected((s) => nextSelection(s, 'confirm'));
  }

  function skip() {
    onConfirm({});
    setSelected((s) => nextSelection(s, 'skip'));
  }

  function cancel() {
    // ONCE sifirla, SONRA kapat: geri donen oyuncu temiz bir modal bulur.
    setSelected((s) => nextSelection(s, 'cancel'));
    onCancel?.();
  }

  return (
    // onRequestClose: Android donanim geri tusu. Eskiden tanimsizdi ve tus
    // OLU idi -- oyuncu bu modalda sikisiyordu.
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <View style={styles.overlay}>
        <LinearGradient colors={['#3d1f8a', '#2d1260']} style={styles.box}>
          <Text style={styles.title}>Level {levelNum}</Text>
          <Text style={styles.subtitle}>Use a pre-game booster?</Text>

          <View style={styles.row}>
            {PREGAME.map((b) => {
              const owned = inventory?.[b.id] || 0;
              const sel = !!selected[b.id];
              const disabled = owned <= 0;
              return (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={disabled ? 1 : 0.7}
                  onPress={() => !disabled && toggle(b.id)}
                  style={[
                    styles.slot,
                    sel && styles.slotSelected,
                    disabled && styles.slotDisabled,
                  ]}
                >
                  <Text style={styles.icon}>{b.icon}</Text>
                  <Text style={styles.name}>{b.name}</Text>
                  <Text style={[styles.count, disabled && styles.countEmpty]}>×{owned}</Text>
                  {sel && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={confirm} activeOpacity={0.8}>
            <LinearGradient colors={['#4cff50', '#00c853']} style={styles.btn}>
              <Text style={styles.btnText}>Start Level</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={skip} style={styles.skipBtn} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip & Start</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={cancel} style={styles.cancelBtn} activeOpacity={0.7}>
            <Text style={styles.cancelText}>← Back</Text>
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
    padding: 24,
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
    marginBottom: 16,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  slot: {
    flex: 1,
    aspectRatio: 0.85,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    margin: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  slotSelected: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderColor: '#ffd700',
  },
  slotDisabled: {
    opacity: 0.35,
  },
  icon: {
    fontSize: 26,
  },
  name: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
  },
  count: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffd700',
    marginTop: 2,
  },
  countEmpty: {
    color: '#888',
  },
  checkmark: {
    position: 'absolute',
    top: 4,
    right: 6,
    fontSize: 16,
    color: '#4cff50',
    fontWeight: '900',
  },
  btn: {
    paddingHorizontal: 50,
    paddingVertical: 14,
    borderRadius: 26,
    minWidth: 220,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#004d00',
  },
  skipBtn: {
    marginTop: 10,
    padding: 6,
  },
  skipText: {
    fontSize: 12,
    color: '#b388ff',
    fontWeight: '700',
  },
  cancelBtn: {
    marginTop: 8,
    padding: 6,
  },
  cancelText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
});
