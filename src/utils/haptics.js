import * as Haptics from 'expo-haptics';

export function tapHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function matchHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function specialHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function errorHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
