import type {
  ActiveFlashcardSession,
  DailyReviewLog,
  EntryProgress,
  ListeningTestRecord,
  ParsedBook,
  PersonalGroup,
  UserSettings,
  WrittenTestRecord,
} from '../types';

const DB_NAME = 'wortlabor-german-lab-v1';
const DB_VERSION = 1;

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'light',
  fontScale: 'md',
  readerTheme: 'light',
  readerFontSize: 20,
  readerBookmarkLine: 1,
  readerMaxLineVisited: 1,
  preferredVoiceURI: '',
  speechRate: 0.95,
  dailyGoal: 20,
  lastStudiedEntryId: null,
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('book')) db.createObjectStore('book');
      if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'entryId' });
      if (!db.objectStoreNames.contains('groups')) db.createObjectStore('groups', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('tests')) db.createObjectStore('tests', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('listening')) db.createObjectStore('listening', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('dailyLogs')) db.createObjectStore('dailyLogs', { keyPath: 'dateKey' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStoreValue<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function setStoreValue<T>(storeName: string, value: T, key?: IDBValidKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    if (key !== undefined) store.put(value, key);
    else store.put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
  });
}

async function deleteFromStore(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const dbStore = {
  async getBook(): Promise<ParsedBook | undefined> {
    return getStoreValue<ParsedBook>('book', 'primary');
  },
  async saveBook(book: ParsedBook): Promise<void> {
    return setStoreValue('book', book, 'primary');
  },

  async getAllProgress(): Promise<EntryProgress[]> {
    return getAllFromStore<EntryProgress>('progress');
  },
  async saveProgress(p: EntryProgress): Promise<void> {
    return setStoreValue('progress', p);
  },
  async bulkReplaceProgress(items: EntryProgress[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('progress', 'readwrite');
      const store = tx.objectStore('progress');
      store.clear();
      for (const item of items) store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getGroups(): Promise<PersonalGroup[]> {
    return getAllFromStore<PersonalGroup>('groups');
  },
  async saveGroup(g: PersonalGroup): Promise<void> {
    return setStoreValue('groups', g);
  },
  async deleteGroup(id: string): Promise<void> {
    return deleteFromStore('groups', id);
  },
  async bulkReplaceGroups(items: PersonalGroup[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('groups', 'readwrite');
      const store = tx.objectStore('groups');
      store.clear();
      for (const item of items) store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getTests(): Promise<WrittenTestRecord[]> {
    const list = await getAllFromStore<WrittenTestRecord>('tests');
    return list.sort((a, b) => b.date - a.date);
  },
  async saveTest(t: WrittenTestRecord): Promise<void> {
    return setStoreValue('tests', t);
  },
  async bulkReplaceTests(items: WrittenTestRecord[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tests', 'readwrite');
      const store = tx.objectStore('tests');
      store.clear();
      for (const item of items) store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getListeningHistory(): Promise<ListeningTestRecord[]> {
    const list = await getAllFromStore<ListeningTestRecord>('listening');
    return list.sort((a, b) => b.date - a.date);
  },
  async saveListening(r: ListeningTestRecord): Promise<void> {
    return setStoreValue('listening', r);
  },
  async bulkReplaceListening(items: ListeningTestRecord[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('listening', 'readwrite');
      const store = tx.objectStore('listening');
      store.clear();
      for (const item of items) store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getDailyLogs(): Promise<DailyReviewLog[]> {
    const list = await getAllFromStore<DailyReviewLog>('dailyLogs');
    return list.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  },
  async saveDailyLog(log: DailyReviewLog): Promise<void> {
    return setStoreValue('dailyLogs', log);
  },
  async bulkReplaceDailyLogs(items: DailyReviewLog[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('dailyLogs', 'readwrite');
      const store = tx.objectStore('dailyLogs');
      store.clear();
      for (const item of items) store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getSettings(): Promise<UserSettings> {
    const saved = await getStoreValue<Partial<UserSettings>>('meta', 'settings');
    return { ...DEFAULT_SETTINGS, ...(saved || {}) };
  },
  async saveSettings(s: UserSettings): Promise<void> {
    return setStoreValue('meta', s, 'settings');
  },

  async getFlashcardSession(): Promise<ActiveFlashcardSession | undefined> {
    return getStoreValue<ActiveFlashcardSession>('meta', 'flashcardSession');
  },
  async saveFlashcardSession(s: ActiveFlashcardSession | null): Promise<void> {
    if (s === null) return deleteFromStore('meta', 'flashcardSession');
    return setStoreValue('meta', s, 'flashcardSession');
  },
};

export interface BackupPayload {
  schemaVersion: 1;
  exportedAt: number;
  app: 'WortLabor';
  progress: EntryProgress[];
  groups: PersonalGroup[];
  tests: WrittenTestRecord[];
  listening: ListeningTestRecord[];
  dailyLogs: DailyReviewLog[];
  settings: UserSettings;
}
