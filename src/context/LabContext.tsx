import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { dbStore, DEFAULT_SETTINGS, type BackupPayload } from '../lib/db';
import { parseBookTxt } from '../lib/parser';
import { applyReviewOutcome, createInitialProgress, getTodayDateKey } from '../lib/srs';
import { useSpeech } from '../hooks/useSpeech';
import type {
  ActiveFlashcardSession,
  AppSection,
  DailyReviewLog,
  EntryProgress,
  ListeningTestRecord,
  ParsedBook,
  PersonalGroup,
  UserSettings,
  VocabEntry,
  WrittenTestRecord,
} from '../types';

interface LabContextValue {
  loading: boolean;
  loadError: string | null;
  book: ParsedBook | null;
  entriesById: Map<string, VocabEntry>;
  progressMap: Map<string, EntryProgress>;
  groups: PersonalGroup[];
  tests: WrittenTestRecord[];
  listeningHistory: ListeningTestRecord[];
  dailyLogs: DailyReviewLog[];
  settings: UserSettings;
  flashcardSession: ActiveFlashcardSession | null;
  activeSection: AppSection;
  setActiveSection: (s: AppSection) => void;
  selectedEntryId: string | null;
  openEntryDetail: (entryId: string) => void;
  closeEntryDetail: () => void;
  openReaderAtLine: (lineNumber: number) => void;
  readerTargetLine: number | null;
  clearReaderTargetLine: () => void;
  startRevisionForEntry: (entryId: string) => void;
  revisionPresetEntryId: string | null;
  clearRevisionPresetEntryId: () => void;
  speech: ReturnType<typeof useSpeech>;
  markViewed: (entryId: string) => Promise<void>;
  recordReview: (entryId: string, outcome: 'remembered' | 'again' | 'partial') => Promise<void>;
  toggleBookmark: (entryId: string) => Promise<void>;
  toggleDifficult: (entryId: string) => Promise<void>;
  toggleSavedSentence: (entryId: string) => Promise<void>;
  saveNote: (entryId: string, note: string) => Promise<void>;
  toggleEntryGroup: (entryId: string, groupId: string) => Promise<void>;
  createGroup: (name: string) => Promise<PersonalGroup>;
  deleteGroup: (groupId: string) => Promise<void>;
  saveWrittenTest: (record: WrittenTestRecord) => Promise<void>;
  saveListeningResult: (record: ListeningTestRecord) => Promise<void>;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  saveFlashcardSession: (session: ActiveFlashcardSession | null) => Promise<void>;
  exportBackup: () => BackupPayload;
  importBackup: (payload: BackupPayload, mode: 'replace' | 'merge') => Promise<void>;
  importCustomTxt: (rawText: string, fileName: string) => Promise<ParsedBook>;
}

const LabContext = createContext<LabContextValue | null>(null);

export const LabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [book, setBook] = useState<ParsedBook | null>(null);
  const [progressMap, setProgressMap] = useState<Map<string, EntryProgress>>(new Map());
  const [groups, setGroups] = useState<PersonalGroup[]>([]);
  const [tests, setTests] = useState<WrittenTestRecord[]>([]);
  const [listeningHistory, setListeningHistory] = useState<ListeningTestRecord[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyReviewLog[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [flashcardSession, setFlashcardSession] = useState<ActiveFlashcardSession | null>(null);

  const [activeSection, setActiveSection] = useState<AppSection>('dashboard');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [readerTargetLine, setReaderTargetLine] = useState<number | null>(null);
  const [revisionPresetEntryId, setRevisionPresetEntryId] = useState<string | null>(null);

  const speech = useSpeech(settings.preferredVoiceURI, settings.speechRate);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [
          storedBook,
          storedProgress,
          storedGroups,
          storedTests,
          storedListening,
          storedDailyLogs,
          storedSettings,
          storedSession,
        ] = await Promise.all([
          dbStore.getBook(),
          dbStore.getAllProgress(),
          dbStore.getGroups(),
          dbStore.getTests(),
          dbStore.getListeningHistory(),
          dbStore.getDailyLogs(),
          dbStore.getSettings(),
          dbStore.getFlashcardSession(),
        ]);

        let activeBook =
          storedBook && storedBook.entries.length > 0 ? storedBook : null;
        if (!activeBook) {
          const base = import.meta.env.BASE_URL || './';
          const assetUrl = `${base.endsWith('/') ? base : `${base}/`}assets/aistudio/German_Vocabul_4275d79f.txt`;
          const resp = await fetch(assetUrl);
          if (!resp.ok) {
            throw new Error(`Could not load source book (${resp.status}).`);
          }
          const contentType = resp.headers.get('content-type') || '';
          const rawText = await resp.text();
          if (contentType.includes('text/html') || /^\s*<!doctype|^\s*<html|^\s*</i.test(rawText)) {
            throw new Error('No bundled TXT book file was found. Please select your local TXT file.');
          }
          const parsedBook = parseBookTxt(rawText, 'German_Vocabul_4275d79f.txt');
          if (parsedBook.entries.length === 0) {
            throw new Error('No vocabulary entries could be extracted from the bundled file.');
          }
          activeBook = parsedBook;
          await dbStore.saveBook(activeBook);
        }

        if (cancelled) return;

        const pMap = new Map<string, EntryProgress>();
        for (const item of storedProgress) {
          pMap.set(item.entryId, item);
        }

        setBook(activeBook);
        setProgressMap(pMap);
        setGroups(storedGroups);
        setTests(storedTests);
        setListeningHistory(storedListening);
        setDailyLogs(storedDailyLogs);
        setSettings(storedSettings);
        setFlashcardSession(storedSession ?? null);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to initialize learning database.');
        setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync theme and font scale to document root
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    root.setAttribute('data-font-scale', settings.fontScale);
  }, [settings.theme, settings.fontScale]);

  const entriesById = useMemo(() => {
    const map = new Map<string, VocabEntry>();
    if (book) {
      for (const e of book.entries) map.set(e.id, e);
    }
    return map;
  }, [book]);

  const updateSettings = useCallback(async (patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      dbStore.saveSettings(next).catch(console.error);
      return next;
    });
  }, []);

  const upsertProgress = useCallback(async (next: EntryProgress) => {
    setProgressMap((prev) => {
      const copy = new Map(prev);
      copy.set(next.entryId, next);
      return copy;
    });
    await dbStore.saveProgress(next);
  }, []);

  // Viewing marks viewedAt and lastStudiedEntryId for "Continue learning" — NEVER marks remembered!
  const markViewed = useCallback(
    async (entryId: string) => {
      const existing = progressMap.get(entryId);
      const now = Date.now();
      const next: EntryProgress = existing
        ? { ...existing, viewedAt: existing.viewedAt ?? now }
        : { ...createInitialProgress(entryId), viewedAt: now };
      await upsertProgress(next);
      await updateSettings({ lastStudiedEntryId: entryId });
    },
    [progressMap, upsertProgress, updateSettings]
  );

  const recordReview = useCallback(
    async (entryId: string, outcome: 'remembered' | 'again' | 'partial') => {
      const now = Date.now();
      const existing = progressMap.get(entryId);
      const next = applyReviewOutcome(existing, entryId, outcome, now);
      await upsertProgress(next);
      await updateSettings({ lastStudiedEntryId: entryId });

      const dateKey = getTodayDateKey(now);
      setDailyLogs((prev) => {
        const idx = prev.findIndex((l) => l.dateKey === dateKey);
        const current: DailyReviewLog =
          idx >= 0
            ? { ...prev[idx] }
            : { dateKey, reviewedCount: 0, rememberedCount: 0, againCount: 0 };
        current.reviewedCount += 1;
        if (outcome === 'remembered') current.rememberedCount += 1;
        if (outcome === 'again') current.againCount += 1;
        dbStore.saveDailyLog(current).catch(console.error);
        const copy = [...prev];
        if (idx >= 0) copy[idx] = current;
        else copy.unshift(current);
        return copy;
      });
    },
    [progressMap, upsertProgress, updateSettings]
  );

  const toggleBookmark = useCallback(
    async (entryId: string) => {
      const existing = progressMap.get(entryId) ?? createInitialProgress(entryId);
      await upsertProgress({ ...existing, bookmarked: !existing.bookmarked });
    },
    [progressMap, upsertProgress]
  );

  const toggleDifficult = useCallback(
    async (entryId: string) => {
      const existing = progressMap.get(entryId) ?? createInitialProgress(entryId);
      await upsertProgress({ ...existing, difficult: !existing.difficult });
    },
    [progressMap, upsertProgress]
  );

  const toggleSavedSentence = useCallback(
    async (entryId: string) => {
      const existing = progressMap.get(entryId) ?? createInitialProgress(entryId);
      await upsertProgress({ ...existing, savedSentence: !existing.savedSentence });
    },
    [progressMap, upsertProgress]
  );

  const saveNote = useCallback(
    async (entryId: string, note: string) => {
      const existing = progressMap.get(entryId) ?? createInitialProgress(entryId);
      await upsertProgress({ ...existing, note });
    },
    [progressMap, upsertProgress]
  );

  const toggleEntryGroup = useCallback(
    async (entryId: string, groupId: string) => {
      const existing = progressMap.get(entryId) ?? createInitialProgress(entryId);
      const has = existing.groups.includes(groupId);
      const nextGroups = has
        ? existing.groups.filter((g) => g !== groupId)
        : [...existing.groups, groupId];
      await upsertProgress({ ...existing, groups: nextGroups });
    },
    [progressMap, upsertProgress]
  );

  const createGroup = useCallback(async (name: string) => {
    const clean = name.trim();
    const g: PersonalGroup = {
      id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: clean,
      createdAt: Date.now(),
    };
    setGroups((prev) => [...prev, g]);
    await dbStore.saveGroup(g);
    return g;
  }, []);

  const deleteGroup = useCallback(
    async (groupId: string) => {
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      await dbStore.deleteGroup(groupId);
      // Remove group reference from entries
      const updated: EntryProgress[] = [];
      progressMap.forEach((p) => {
        if (p.groups.includes(groupId)) {
          updated.push({ ...p, groups: p.groups.filter((id) => id !== groupId) });
        }
      });
      for (const item of updated) {
        await upsertProgress(item);
      }
    },
    [progressMap, upsertProgress]
  );

  const saveWrittenTest = useCallback(async (record: WrittenTestRecord) => {
    setTests((prev) => [record, ...prev]);
    await dbStore.saveTest(record);
  }, []);

  const saveListeningResult = useCallback(async (record: ListeningTestRecord) => {
    setListeningHistory((prev) => [record, ...prev]);
    await dbStore.saveListening(record);
  }, []);

  const saveFlashcardSession = useCallback(async (session: ActiveFlashcardSession | null) => {
    setFlashcardSession(session);
    await dbStore.saveFlashcardSession(session);
  }, []);

  const openEntryDetail = useCallback(
    (entryId: string) => {
      setSelectedEntryId(entryId);
      markViewed(entryId).catch(console.error);
    },
    [markViewed]
  );

  const closeEntryDetail = useCallback(() => {
    setSelectedEntryId(null);
  }, []);

  const openReaderAtLine = useCallback((lineNumber: number) => {
    setSelectedEntryId(null);
    setReaderTargetLine(lineNumber);
    setActiveSection('reader');
  }, []);

  const startRevisionForEntry = useCallback((entryId: string) => {
    setSelectedEntryId(null);
    setRevisionPresetEntryId(entryId);
    setActiveSection('revision');
  }, []);

  const exportBackup = useCallback((): BackupPayload => {
    return {
      schemaVersion: 1,
      exportedAt: Date.now(),
      app: 'WortLabor',
      progress: Array.from(progressMap.values()),
      groups,
      tests,
      listening: listeningHistory,
      dailyLogs,
      settings,
    };
  }, [progressMap, groups, tests, listeningHistory, dailyLogs, settings]);

  const importBackup = useCallback(
    async (payload: BackupPayload, mode: 'replace' | 'merge') => {
      if (mode === 'replace') {
        const nextMap = new Map<string, EntryProgress>();
        for (const p of payload.progress || []) nextMap.set(p.entryId, p);
        await dbStore.bulkReplaceProgress(payload.progress || []);
        await dbStore.bulkReplaceGroups(payload.groups || []);
        await dbStore.bulkReplaceTests(payload.tests || []);
        await dbStore.bulkReplaceListening(payload.listening || []);
        await dbStore.bulkReplaceDailyLogs(payload.dailyLogs || []);
        const mergedSettings = { ...DEFAULT_SETTINGS, ...(payload.settings || {}) };
        await dbStore.saveSettings(mergedSettings);

        setProgressMap(nextMap);
        setGroups(payload.groups || []);
        setTests((payload.tests || []).sort((a, b) => b.date - a.date));
        setListeningHistory((payload.listening || []).sort((a, b) => b.date - a.date));
        setDailyLogs((payload.dailyLogs || []).sort((a, b) => b.dateKey.localeCompare(a.dateKey)));
        setSettings(mergedSettings);
      } else {
        // Merge safely without erasing existing notes or higher review counts
        const nextMap = new Map(progressMap);
        for (const inc of payload.progress || []) {
          const cur = nextMap.get(inc.entryId);
          if (!cur) {
            nextMap.set(inc.entryId, inc);
          } else {
            nextMap.set(inc.entryId, {
              ...cur,
              ...inc,
              bookmarked: cur.bookmarked || inc.bookmarked,
              difficult: cur.difficult || inc.difficult,
              savedSentence: cur.savedSentence || inc.savedSentence,
              note: cur.note && inc.note && cur.note !== inc.note
                ? `${cur.note}\n---\n${inc.note}`
                : cur.note || inc.note,
              reviewCount: Math.max(cur.reviewCount, inc.reviewCount),
              correctCount: Math.max(cur.correctCount, inc.correctCount),
              incorrectCount: Math.max(cur.incorrectCount, inc.incorrectCount),
              groups: Array.from(new Set([...cur.groups, ...(inc.groups || [])])),
            });
          }
        }
        const mergedProgress = Array.from(nextMap.values());
        await dbStore.bulkReplaceProgress(mergedProgress);
        setProgressMap(nextMap);

        const groupById = new Map(groups.map((g) => [g.id, g]));
        for (const g of payload.groups || []) groupById.set(g.id, g);
        const mergedGroups = Array.from(groupById.values());
        await dbStore.bulkReplaceGroups(mergedGroups);
        setGroups(mergedGroups);

        const testById = new Map(tests.map((t) => [t.id, t]));
        for (const t of payload.tests || []) testById.set(t.id, t);
        const mergedTests = Array.from(testById.values()).sort((a, b) => b.date - a.date);
        await dbStore.bulkReplaceTests(mergedTests);
        setTests(mergedTests);

        const listenById = new Map(listeningHistory.map((l) => [l.id, l]));
        for (const l of payload.listening || []) listenById.set(l.id, l);
        const mergedListening = Array.from(listenById.values()).sort((a, b) => b.date - a.date);
        await dbStore.bulkReplaceListening(mergedListening);
        setListeningHistory(mergedListening);
      }
    },
    [progressMap, groups, tests, listeningHistory]
  );

  const importCustomTxt = useCallback(async (rawText: string, fileName: string) => {
    if (/^\s*<!doctype\s+html|^\s*<html/i.test(rawText)) {
      throw new Error('Please choose a plain text (.txt) German vocabulary book rather than an HTML file.');
    }
    const parsed = parseBookTxt(rawText, fileName);
    if (parsed.entries.length === 0) {
      throw new Error('No German vocabulary entries were detected in that TXT file.');
    }
    await dbStore.saveBook(parsed);
    setBook(parsed);
    setLoadError(null);
    return parsed;
  }, []);

  const value: LabContextValue = {
    loading,
    loadError,
    book,
    entriesById,
    progressMap,
    groups,
    tests,
    listeningHistory,
    dailyLogs,
    settings,
    flashcardSession,
    activeSection,
    setActiveSection,
    selectedEntryId,
    openEntryDetail,
    closeEntryDetail,
    openReaderAtLine,
    readerTargetLine,
    clearReaderTargetLine: () => setReaderTargetLine(null),
    startRevisionForEntry,
    revisionPresetEntryId,
    clearRevisionPresetEntryId: () => setRevisionPresetEntryId(null),
    speech,
    markViewed,
    recordReview,
    toggleBookmark,
    toggleDifficult,
    toggleSavedSentence,
    saveNote,
    toggleEntryGroup,
    createGroup,
    deleteGroup,
    saveWrittenTest,
    saveListeningResult,
    updateSettings,
    saveFlashcardSession,
    exportBackup,
    importBackup,
    importCustomTxt,
  };

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
};

export function useLab() {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error('useLab must be used inside LabProvider');
  return ctx;
}
