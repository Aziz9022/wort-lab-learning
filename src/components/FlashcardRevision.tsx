import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Check,
  Eye,
  RotateCcw,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { renderHighlightedSentence } from '../lib/highlight';
import { formatGrammarLabel } from '../lib/parser';
import { buildPrioritizedRevisionQueue, isDueForRevision } from '../lib/srs';
import type { ActiveFlashcardSession, CategoryName } from '../types';
import { AudioControls } from './AudioControls';

type DeckFilter =
  | 'PRIORITY'
  | 'NEW'
  | 'DIFFICULT'
  | 'BOOKMARKED'
  | 'INCORRECT'
  | 'NOUNS'
  | 'ADJECTIVES'
  | 'VERBS'
  | 'COMPOUND WORDS'
  | 'ALL';

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const FlashcardRevision: React.FC = () => {
  const {
    book,
    entriesById,
    progressMap,
    flashcardSession,
    saveFlashcardSession,
    recordReview,
    toggleDifficult,
    toggleBookmark,
    openEntryDetail,
    revisionPresetEntryId,
    clearRevisionPresetEntryId,
  } = useLab();

  const [deckFilter, setDeckFilter] = useState<DeckFilter>('PRIORITY');
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [sessionLimit, setSessionLimit] = useState<number>(25);
  const [activeSession, setActiveSession] = useState<ActiveFlashcardSession | null>(null);
  const [revealed, setRevealed] = useState(false);

  // If user clicked "Revise" on a specific entry
  useEffect(() => {
    if (!revisionPresetEntryId || !entriesById.has(revisionPresetEntryId)) return;
    const singleSession: ActiveFlashcardSession = {
      deckKey: `Single word`,
      queueIds: [revisionPresetEntryId],
      currentIndex: 0,
      reviewedIds: [],
      againIds: [],
      rememberedIds: [],
      updatedAt: Date.now(),
    };
    setActiveSession(singleSession);
    setRevealed(false);
    clearRevisionPresetEntryId();
  }, [revisionPresetEntryId, entriesById, clearRevisionPresetEntryId]);

  const deckCounts = useMemo(() => {
    const entries = book?.entries ?? [];
    const now = Date.now();
    let priority = 0;
    let newCount = 0;
    let difficult = 0;
    let bookmarked = 0;
    let incorrect = 0;

    for (const e of entries) {
      const p = progressMap.get(e.id);
      if (!p || p.status === 'new') newCount += 1;
      if (p?.difficult) difficult += 1;
      if (p?.bookmarked) bookmarked += 1;
      if (p && (p.incorrectCount > 0 || p.status === 'needs_revision')) incorrect += 1;
      if (p && (p.status === 'needs_revision' || p.difficult || isDueForRevision(p, now))) {
        priority += 1;
      }
    }
    return { priority, newCount, difficult, bookmarked, incorrect, all: entries.length };
  }, [book, progressMap]);

  const buildDeck = (filter: DeckFilter, shuffle: boolean): string[] => {
    const entries = book?.entries ?? [];
    const now = Date.now();
    let selected = entries;

    if (filter === 'PRIORITY') {
      selected = buildPrioritizedRevisionQueue(entries, progressMap, now);
    } else if (filter === 'NEW') {
      selected = entries.filter((e) => {
        const p = progressMap.get(e.id);
        return !p || p.status === 'new';
      });
    } else if (filter === 'DIFFICULT') {
      selected = entries.filter((e) => progressMap.get(e.id)?.difficult);
    } else if (filter === 'BOOKMARKED') {
      selected = entries.filter((e) => progressMap.get(e.id)?.bookmarked);
    } else if (filter === 'INCORRECT') {
      selected = entries.filter((e) => {
        const p = progressMap.get(e.id);
        return p && (p.incorrectCount > 0 || p.status === 'needs_revision');
      });
    } else if (
      filter === 'NOUNS' ||
      filter === 'ADJECTIVES' ||
      filter === 'VERBS' ||
      filter === 'COMPOUND WORDS'
    ) {
      selected = buildPrioritizedRevisionQueue(
        entries.filter((e) => e.category === (filter as CategoryName)),
        progressMap,
        now
      );
    }

    const list = shuffle ? shuffleArray(selected) : selected;
    const limited = sessionLimit > 0 ? list.slice(0, sessionLimit) : list;
    return limited.map((e) => e.id);
  };

  const startNewSession = async () => {
    const ids = buildDeck(deckFilter, shuffleEnabled);
    if (ids.length === 0) return;
    const s: ActiveFlashcardSession = {
      deckKey: deckFilter,
      queueIds: ids,
      currentIndex: 0,
      reviewedIds: [],
      againIds: [],
      rememberedIds: [],
      updatedAt: Date.now(),
    };
    setActiveSession(s);
    setRevealed(false);
    await saveFlashcardSession(s);
  };

  const resumeSavedSession = () => {
    if (!flashcardSession) return;
    setActiveSession(flashcardSession);
    setRevealed(false);
  };

  const handleAnswer = async (outcome: 'again' | 'remembered') => {
    if (!activeSession) return;
    const currentId = activeSession.queueIds[activeSession.currentIndex];
    if (!currentId) return;

    await recordReview(currentId, outcome);

    const nextQueue = [...activeSession.queueIds];
    const reviewedIds = Array.from(new Set([...activeSession.reviewedIds, currentId]));
    const againIds =
      outcome === 'again'
        ? Array.from(new Set([...activeSession.againIds, currentId]))
        : activeSession.againIds;
    const rememberedIds =
      outcome === 'remembered'
        ? Array.from(new Set([...activeSession.rememberedIds, currentId]))
        : activeSession.rememberedIds;

    // Repeat incorrectly answered cards within the same session (re-queue 3 cards later or at end)
    if (outcome === 'again') {
      const insertAt = Math.min(nextQueue.length, activeSession.currentIndex + 4);
      nextQueue.splice(insertAt, 0, currentId);
    }

    const nextIndex = activeSession.currentIndex + 1;
    const updated: ActiveFlashcardSession = {
      ...activeSession,
      queueIds: nextQueue,
      currentIndex: nextIndex,
      reviewedIds,
      againIds,
      rememberedIds,
      updatedAt: Date.now(),
    };

    setActiveSession(updated);
    setRevealed(false);

    if (nextIndex >= nextQueue.length) {
      await saveFlashcardSession(null);
    } else {
      await saveFlashcardSession(updated);
    }
  };

  const currentEntry =
    activeSession && activeSession.currentIndex < activeSession.queueIds.length
      ? entriesById.get(activeSession.queueIds[activeSession.currentIndex])
      : undefined;

  const isSessionFinished =
    activeSession !== null && activeSession.currentIndex >= activeSession.queueIds.length;

  // Deck Setup View
  if (!activeSession) {
    const previewCount = buildDeck(deckFilter, false).length;

    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-scale-heading font-bold text-slate-900 dark:text-slate-100">
            Flashcard Revision
          </h1>
          <p className="text-scale-body text-slate-600 dark:text-slate-400">
            Active recall with original German sentences. Prioritizes difficult, missed, and due words.
          </p>
        </div>

        {flashcardSession && flashcardSession.currentIndex < flashcardSession.queueIds.length && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Continue previous revision session
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-mono-num">
                Deck: {flashcardSession.deckKey} · Card {flashcardSession.currentIndex + 1} of{' '}
                {flashcardSession.queueIds.length}
              </p>
            </div>
            <button
              type="button"
              onClick={resumeSavedSession}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              Continue Session
            </button>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              1. Choose Vocabulary Deck
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(
                [
                  ['PRIORITY', 'Smart Revision Queue', `${deckCounts.priority} due / priority`],
                  ['NEW', 'New Vocabulary', `${deckCounts.newCount} unstudied`],
                  ['DIFFICULT', 'Difficult Words', `${deckCounts.difficult} marked`],
                  ['INCORRECT', 'Previously Incorrect', `${deckCounts.incorrect} words`],
                  ['BOOKMARKED', 'Bookmarked Words', `${deckCounts.bookmarked} saved`],
                  ['NOUNS', 'Nouns', '645 entries'],
                  ['ADJECTIVES', 'Adjectives', '630 entries'],
                  ['VERBS', 'Verbs', '547 entries'],
                  ['COMPOUND WORDS', 'Compound Words', '645 entries'],
                  ['ALL', 'All Imported Vocabulary', `${deckCounts.all} entries`],
                ] as Array<[DeckFilter, string, string]>
              ).map(([key, label, sub]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDeckFilter(key)}
                  className={`rounded-lg border p-3.5 text-left transition-colors cursor-pointer ${
                    deckFilter === key
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num mt-0.5">
                    {sub}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 pt-5">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shuffleEnabled}
                  onChange={(e) => setShuffleEnabled(e.target.checked)}
                  className="rounded border-slate-300 accent-blue-600 w-4 h-4"
                />
                <Shuffle className="w-4 h-4" />
                Shuffle cards
              </label>

              <div className="flex items-center gap-2">
                <label htmlFor="session-limit" className="text-sm text-slate-600 dark:text-slate-400">
                  Cards per session:
                </label>
                <select
                  id="session-limit"
                  value={sessionLimit}
                  onChange={(e) => setSessionLimit(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value={10}>10 cards</option>
                  <option value={25}>25 cards</option>
                  <option value={50}>50 cards</option>
                  <option value={0}>All matching</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              disabled={previewCount === 0}
              onClick={startNewSession}
              className="rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
            >
              Start Revision ({previewCount} {previewCount === 1 ? 'card' : 'cards'})
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Session Complete View
  if (isSessionFinished) {
    return (
      <div className="max-w-2xl mx-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-6">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 mx-auto">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-scale-heading font-bold text-slate-900 dark:text-slate-100">
            Revision Session Complete
          </h1>
          <p className="text-scale-body text-slate-600 dark:text-slate-400 font-mono-num">
            Reviewed {activeSession.reviewedIds.length} unique words ·{' '}
            {activeSession.rememberedIds.length} remembered · {activeSession.againIds.length} marked
            for repeat
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setActiveSession(null)}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            Choose Another Deck
          </button>
          {activeSession.againIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveSession({
                  deckKey: 'Missed in session',
                  queueIds: [...activeSession.againIds],
                  currentIndex: 0,
                  reviewedIds: [],
                  againIds: [],
                  rememberedIds: [],
                  updatedAt: Date.now(),
                });
                setRevealed(false);
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-base font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Revise Missed Words ({activeSession.againIds.length})
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!currentEntry) return null;

  const progress = progressMap.get(currentEntry.id);
  const grammar = formatGrammarLabel(currentEntry.grammarTag);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Progress Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-slate-600 dark:text-slate-400 font-mono-num">
          Card {activeSession.currentIndex + 1} of {activeSession.queueIds.length} ·{' '}
          {currentEntry.sectionLabel}
        </div>
        <button
          type="button"
          onClick={() => setActiveSession(null)}
          className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
        >
          End & Save Progress
        </button>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-200"
          style={{
            width: `${Math.round(
              ((activeSession.currentIndex + 1) / activeSession.queueIds.length) * 100
            )}%`,
          }}
        />
      </div>

      {/* Anki-Style Flashcard */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-10 space-y-8">
        {/* Card Header Actions */}
        <div className="flex items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
          <span className="font-mono-num">
            #{currentEntry.orderIndex} · Reviews: {progress?.reviewCount ?? 0}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleBookmark(currentEntry.id)}
              className={`rounded-lg border p-2 cursor-pointer ${
                progress?.bookmarked
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Bookmark word"
            >
              <Bookmark className={`w-4 h-4 ${progress?.bookmarked ? 'fill-current' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => toggleDifficult(currentEntry.id)}
              className={`rounded-lg border p-2 cursor-pointer ${
                progress?.difficult
                  ? 'border-red-500 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Mark as difficult"
            >
              <AlertTriangle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* FRONT: German word + sentence + audio */}
        <div className="space-y-5">
          <div>
            <h2 className="font-serif-de font-bold text-scale-word text-slate-900 dark:text-slate-100">
              {currentEntry.germanWord}
            </h2>
            {grammar && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{grammar}</p>
            )}
          </div>

          <p className="font-serif-de text-scale-sentence text-slate-800 dark:text-slate-200">
            {renderHighlightedSentence(currentEntry.germanSentence, currentEntry.germanWord)}
          </p>

          <AudioControls
            germanWord={currentEntry.germanWord}
            germanSentence={currentEntry.germanSentence}
          />
        </div>

        {/* Reveal / Back */}
        {!revealed ? (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 px-6 py-4 text-lg font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Eye className="w-5 h-5" />
              Reveal Answer
            </button>
          </div>
        ) : (
          <div className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  English meaning
                </p>
                <p className="text-scale-word font-bold text-blue-800 dark:text-blue-300">
                  {currentEntry.englishMeaning}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Original English sentence translation
                </p>
                <p className="text-scale-sentence text-slate-800 dark:text-slate-200">
                  {currentEntry.englishSentence}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleAnswer('again')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 px-5 py-4 text-lg font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
                Again (Repeat)
              </button>

              <button
                type="button"
                onClick={() => handleAnswer('remembered')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500 bg-emerald-600 px-5 py-4 text-lg font-semibold text-white hover:bg-emerald-700 cursor-pointer"
              >
                <Check className="w-5 h-5" />
                Remembered
              </button>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => openEntryDetail(currentEntry.id)}
                className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Open full word detail & notes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
