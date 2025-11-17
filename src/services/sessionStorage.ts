import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'sb-auth-token';
const PERSIST_PREFERENCE_KEY = 'persist_session_preference';

// In-memory storage for non-persistent sessions
let memoryStorage: { [key: string]: string | null } = {};

class ConditionalStorage {
  private shouldPersist: boolean = true;

  async initialize() {
    // Check if user wants to persist session (default to true)
    const preference = await AsyncStorage.getItem(PERSIST_PREFERENCE_KEY);
    this.shouldPersist = preference !== 'false';
  }

  setPersistPreference(persist: boolean) {
    this.shouldPersist = persist;
    AsyncStorage.setItem(PERSIST_PREFERENCE_KEY, persist ? 'true' : 'false');
  }

  async getItem(key: string): Promise<string | null> {
    if (this.shouldPersist) {
      return await AsyncStorage.getItem(key);
    } else {
      return memoryStorage[key] || null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.shouldPersist) {
      await AsyncStorage.setItem(key, value);
    } else {
      memoryStorage[key] = value;
    }
  }

  async removeItem(key: string): Promise<void> {
    if (this.shouldPersist) {
      await AsyncStorage.removeItem(key);
    } else {
      delete memoryStorage[key];
    }
  }

  // Remove item from both storages (used during logout)
  async removeItemFromAll(key: string): Promise<void> {
    // Clear from persistent storage
    await AsyncStorage.removeItem(key);
    // Clear from memory storage
    delete memoryStorage[key];
  }

  // Clear in-memory storage (call when app closes if not persisting)
  clearMemoryStorage() {
    memoryStorage = {};
  }
}

export const conditionalStorage = new ConditionalStorage();

