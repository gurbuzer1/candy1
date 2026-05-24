import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BOOSTER_LIST } from '../constants/economy';

export default function BoosterShopModal({ visible, coins, inventory, onBuy, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <LinearGradient colors={['#3d1f8a', '#2d1260']} style={styles.box}>
          <Text style={styles.title}>Booster Shop</Text>
          <Text style={styles.subtitle}>You have 🪙 {coins.toLocaleString()}</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {BOOSTER_LIST.map((b) => {
              const owned = inventory?.[b.id] || 0;
              const canAfford = coins >= b.cost;
              return (
                <View key={b.id} style={styles.row}>
                  <View style={[styles.iconBox, { backgroundColor: b.color + '33', borderColor: b.color }]}>
                    <Text style={styles.iconText}>{b.icon}</Text>
                  </View>
                  <View style={styles.rowMid}>
                    <Text style={styles.name}>{b.name}</Text>
                    <Text style={styles.typeTag}>{b.type === 'pregame' ? 'Pre-game' : 'In-game'}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.owned}>×{owned}</Text>
                    <TouchableOpacity
                      onPress={() => canAfford && onBuy(b.id)}
                      activeOpacity={canAfford ? 0.7 : 1}
                      style={[styles.buyBtn, !canAfford && styles.buyBtnDisabled]}
                    >
                      <Text style={styles.buyText}>🪙 {b.cost}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
            <LinearGradient colors={['#7c4dff', '#6200ea']} style={styles.closeBtn}>
              <Text style={styles.closeText}>Close</Text>
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
    maxHeight: '80%',
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
    fontSize: 13,
    color: '#fff',
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
    padding: 10,
    marginBottom: 8,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  iconText: {
    fontSize: 24,
  },
  rowMid: {
    flex: 1,
    marginLeft: 10,
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  typeTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b388ff',
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  owned: {
    fontSize: 11,
    color: '#b388ff',
    marginBottom: 4,
    fontWeight: '700',
  },
  buyBtn: {
    backgroundColor: '#ffd700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  buyBtnDisabled: {
    opacity: 0.35,
  },
  buyText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#4d2e00',
  },
  closeBtn: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});
