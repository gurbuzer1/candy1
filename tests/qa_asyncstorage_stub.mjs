// In-memory stand-in for @react-native-async-storage/async-storage.
// ONLY the storage backend is stubbed; storage.js/quests.js run verbatim.
const mem = new Map();
const AsyncStorage = {
  async getItem(k) { return mem.has(k) ? mem.get(k) : null; },
  async setItem(k, v) { mem.set(k, v); },
  async removeItem(k) { mem.delete(k); },
};
export function __seed(k, v) { mem.set(k, v); }
export function __raw(k) { return mem.get(k); }
export function __clear() { mem.clear(); }
export default AsyncStorage;
