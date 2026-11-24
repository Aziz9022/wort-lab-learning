import type { EntryProgress, VocabEntry } from '../types';

export function createInitialProgress(entryId: string): EntryProgress {
  return {
    entryId,
    status: 'new',
    viewedAt: null,
    firstStudiedAt: null,
    lastReviewedAt: null,
    nextReviewAt: null,
    intervalDays: 0,
    easeFactor: 2.5,
    correctCount: 0,
    incorrectCount: 0,
    reviewCount: 0,
    difficult: false,
    bookmarked: false,
    savedSentence: false,
    note: '',
    groups: [],
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Lightweight spaced-repetition update.
 * Viewing alone NEVER calls this function — only active recall / testing / practice does.
 */
export function applyReviewOutcome(
  existing: EntryProgress | undefined,
  entryId: string,
  outcome: 'remembered' | 'again' | 'partial',
  now = Date.now()
): EntryProgress {
  const prev = existing ? { ...existing } : createInitialProgress(entryId);
  const firstStudiedAt = prev.firstStudiedAt ?? now;
  const reviewCount = prev.reviewCount + 1;

  if (outcome === 'again') {
    const incorrectCount = prev.incorrectCount + 1;
    const easeFactor = Math.max(1.3, prev.easeFactor - 0.2);
    // Schedule quick follow-up review (4 hours / same day)
    return {
      ...prev,
      status: 'needs_revision',
      viewedAt: prev.viewedAt ?? now,
      firstStudiedAt,
      lastReviewedAt: now,
      nextReviewAt: now + 4 * 60 * 60 * 1000,
      intervalDays: 0,
      easeFactor,
      incorrectCount,
      reviewCount,
    };
  }

  if (outcome === 'partial') {
    const intervalDays = Math.max(1, Math.round((prev.intervalDays || 1) * 0.8));
    return {
      ...prev,
      status: 'learning',
      viewedAt: prev.viewedAt ?? now,
      firstStudiedAt,
      lastReviewedAt: now,
      nextReviewAt: now + intervalDays * DAY_MS,
      intervalDays,
      reviewCount,
    };
  }

  // outcome === 'remembered'
  const correctCount = prev.correctCount + 1;
  let intervalDays = 1;
  if (prev.intervalDays === 0) {
    intervalDays = 1;
  } else if (prev.intervalDays === 1) {
    intervalDays = 3;
  } else {
    intervalDays = Math.min(60, Math.round(prev.intervalDays * prev.easeFactor));
  }
  const easeFactor = Math.min(2.8, prev.easeFactor + 0.08);
  const nextStatus = correctCount >= 1 && intervalDays >= 1 ? 'remembered' : 'learning';

  return {
    ...prev,
    status: nextStatus,
    viewedAt: prev.viewedAt ?? now,
    firstStudiedAt,
    lastReviewedAt: now,
    nextReviewAt: now + intervalDays * DAY_MS,
    intervalDays,
    easeFactor,
    correctCount,
    reviewCount,
  };
}

export function isDueForRevision(p: EntryProgress | undefined, now = Date.now()): boolean {
  if (!p) return false;
  if (p.status === 'needs_revision') return true;
  if (p.status === 'learning' || p.status === 'remembered') {
    return p.nextReviewAt !== null && p.nextReviewAt <= now;
  }
  return false;
}

/**
 * Prioritizes:
 * 1. Incorrect / needs_revision words
 * 2. Difficult words
 * 3. Due words (oldest due first)
 * 4. Words not reviewed recently
 * 5. New words in book order
 */
export function buildPrioritizedRevisionQueue(
  entries: VocabEntry[],
  progressMap: Map<string, EntryProgress>,
  now = Date.now()
): VocabEntry[] {
  const scored = entries.map((entry) => {
    const p = progressMap.get(entry.id);
    let priority = 1000;

    if (p) {
      if (p.status === 'needs_revision') priority = 1;
      else if (p.difficult && p.status !== 'remembered') priority = 2;
      else if (isDueForRevision(p, now)) priority = 3;
      else if (p.incorrectCount > p.correctCount) priority = 4;
      else if (p.difficult) priority = 5;
      else if (p.status === 'learning') priority = 6;
      else if (p.status === 'new') priority = 10;
      else priority = 50; // remembered & not yet due
    } else {
      priority = 10; // new
    }

    const lastRev = p?.lastReviewedAt ?? 0;
    return { entry, priority, lastRev };
  });

  scored.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.lastRev !== b.lastRev) return a.lastRev - b.lastRev;
    return a.entry.orderIndex - b.entry.orderIndex;
  });

  return scored.map((s) => s.entry);
}

export function getTodayDateKey(now = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
