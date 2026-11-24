import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Layers,
  PenLine,
  Volume2,
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { buildPrioritizedRevisionQueue, getTodayDateKey, isDueForRevision } from '../lib/srs';

export const Dashboard: React.FC = () => {
  const {
    book,
    entriesById,
    progressMap,
    tests,
    listeningHistory,
    dailyLogs,
    settings,
    setActiveSection,
    openEntryDetail,
    openReaderAtLine,
    startRevisionForEntry,
    speech,
  } = useLab();

  const stats = useMemo(() => {
    const entries = book?.entries ?? [];
    const totalImported = entries.length;
    let viewedCount = 0;
    let studiedCount = 0;
    let rememberedCount = 0;
    let needsRevisionCount = 0;
    let difficultCount = 0;
    const now = Date.now();

    for (const e of entries) {
      const p = progressMap.get(e.id);
      if (!p) continue;
      if (p.viewedAt !== null) viewedCount += 1;
      if (p.firstStudiedAt !== null || p.reviewCount > 0) studiedCount += 1;
      if (p.status === 'remembered') rememberedCount += 1;
      if (p.status === 'needs_revision' || isDueForRevision(p, now)) needsRevisionCount += 1;
      if (p.difficult) difficultCount += 1;
    }

    const todayKey = getTodayDateKey(now);
    const todayLog = dailyLogs.find((l) => l.dateKey === todayKey);
    const todayReviewed = todayLog?.reviewedCount ?? 0;

    const revisionQueue = buildPrioritizedRevisionQueue(entries, progressMap, now)
      .filter((e) => {
        const p = progressMap.get(e.id);
        return p && (p.status === 'needs_revision' || p.difficult || isDueForRevision(p, now));
      })
      .slice(0, 6);

    const recentlyStudied = Array.from(progressMap.values())
      .filter((p) => p.lastReviewedAt !== null)
      .sort((a, b) => (b.lastReviewedAt ?? 0) - (a.lastReviewedAt ?? 0))
      .slice(0, 6)
      .map((p) => entriesById.get(p.entryId))
      .filter((e): e is NonNullable<typeof e> => Boolean(e));

    return {
      totalImported,
      viewedCount,
      studiedCount,
      rememberedCount,
      needsRevisionCount,
      difficultCount,
      todayReviewed,
      revisionQueue,
      recentlyStudied,
    };
  }, [book, progressMap, dailyLogs, entriesById]);

  const lastEntry = settings.lastStudiedEntryId
    ? entriesById.get(settings.lastStudiedEntryId)
    : book?.entries[0];

  const dailyPercent = Math.min(
    100,
    Math.round((stats.todayReviewed / Math.max(1, settings.dailyGoal)) * 100)
  );

  const recentTests = tests.slice(0, 4);

  return (
    <div className="space-y-10">
      {/* Hero / Continue Learning Header */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
              German Vocabulary Learning Lab · A1 Study Workspace
            </p>
            <h1 className="text-scale-heading font-bold text-slate-900 dark:text-slate-100">
              Learn German words in real sentence context
            </h1>
            <p className="text-scale-body text-slate-600 dark:text-slate-300 max-w-2xl">
              Built directly from your imported book with {stats.totalImported.toLocaleString()} entries
              across Nouns, Adjectives, Verbs, and Compound Words.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActiveSection('revision')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-scale-control font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              Start Flashcard Revision
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('practice')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-scale-control font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <PenLine className="w-4 h-4" />
              Written Translation Test
            </button>
            <button
              type="button"
              onClick={() => openReaderAtLine(settings.readerBookmarkLine || 1)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-3 text-scale-control font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              Resume Book Reader
            </button>
          </div>
        </div>

        {/* Daily Progress & Continue Card */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Daily Learning Progress
              </h2>
              <span className="font-mono-num text-sm font-semibold text-blue-700 dark:text-blue-400">
                {stats.todayReviewed} / {settings.dailyGoal}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${dailyPercent}%` }}
              />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {stats.todayReviewed === 0
                ? 'Review a few flashcards or complete a translation test to log today’s progress.'
                : `${dailyPercent}% of your ${settings.dailyGoal}-word daily goal completed today.`}
            </p>
          </div>

          {lastEntry && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Continue learning
              </p>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => openEntryDetail(lastEntry.id)}
                  className="text-left group cursor-pointer"
                >
                  <div className="font-serif-de text-xl font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                    {lastEntry.germanWord}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {lastEntry.englishMeaning} · #{lastEntry.orderIndex}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => speech.speak(lastEntry.germanWord)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label={`Pronounce ${lastEntry.germanWord}`}
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Core Vocabulary Metrics — Explicitly separating Imported, Viewed, Studied, Remembered */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Imported</p>
          <p className="mt-1 font-mono-num text-2xl font-bold text-slate-900 dark:text-slate-100">
            {stats.totalImported.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">From book TXT</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Viewed</p>
          <p className="mt-1 font-mono-num text-2xl font-bold text-slate-900 dark:text-slate-100">
            {stats.viewedCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Opened only</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Studied</p>
          <p className="mt-1 font-mono-num text-2xl font-bold text-blue-700 dark:text-blue-400">
            {stats.studiedCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Actively tested</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Remembered</p>
          <p className="mt-1 font-mono-num text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {stats.rememberedCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recalled correctly</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Needs Revision</p>
          <p className="mt-1 font-mono-num text-2xl font-bold text-amber-700 dark:text-amber-400">
            {stats.needsRevisionCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Due or missed</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Difficult</p>
          <p className="mt-1 font-mono-num text-2xl font-bold text-red-700 dark:text-red-400">
            {stats.difficultCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Flagged for focus</p>
        </div>
      </section>

      {/* Actionable Lists: Today's Revision, Recently Studied, Recent Tests */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Revision List */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Today’s Revision List
              </h2>
              <button
                type="button"
                onClick={() => setActiveSection('revision')}
                className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                Revise all
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {stats.revisionQueue.length === 0 ? (
              <div className="py-6 text-sm text-slate-500 dark:text-slate-400 space-y-2">
                <p>No words are currently marked as needing revision or difficult.</p>
                <p>Start a flashcard session or explore the book to build your revision queue.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats.revisionQueue.map((entry) => {
                  const p = progressMap.get(entry.id);
                  return (
                    <li key={entry.id} className="py-3 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => openEntryDetail(entry.id)}
                        className="text-left min-w-0 flex-1 cursor-pointer group"
                      >
                        <div className="font-serif-de text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 truncate">
                          {entry.germanWord}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                          {entry.englishMeaning}
                          {p?.difficult ? ' · Difficult' : ''}
                          {p?.status === 'needs_revision' ? ' · Needs revision' : ''}
                        </div>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => speech.speak(entry.germanWord)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          aria-label={`Pronounce ${entry.germanWord}`}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startRevisionForEntry(entry.id)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Revise
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Recently Studied Words */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Recently Studied Words
            </h2>
            <button
              type="button"
              onClick={() => setActiveSection('explorer')}
              className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              Explorer
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {stats.recentlyStudied.length === 0 ? (
            <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
              Words you review in Flashcards, Practice Centre, or Written Tests will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {stats.recentlyStudied.map((entry) => {
                const p = progressMap.get(entry.id);
                return (
                  <li key={entry.id} className="py-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => openEntryDetail(entry.id)}
                      className="text-left min-w-0 flex-1 cursor-pointer group"
                    >
                      <div className="font-serif-de text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 truncate">
                        {entry.germanWord}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {entry.englishMeaning} ·{' '}
                        {p?.status === 'remembered' ? (
                          <span className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 inline" /> Remembered
                          </span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 inline" /> {p?.status.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => speech.speak(entry.germanWord)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
                      aria-label={`Pronounce ${entry.germanWord}`}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent Test Results */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Recent Test Results
            </h2>
            <button
              type="button"
              onClick={() => setActiveSection('progress')}
              className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              History
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentTests.length === 0 && listeningHistory.length === 0 ? (
            <div className="py-6 text-sm text-slate-500 dark:text-slate-400 space-y-3">
              <p>No written translation or listening tests completed yet.</p>
              <button
                type="button"
                onClick={() => setActiveSection('practice')}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Take your first 10-question test
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTests.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Written Test · {t.configLabel}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                      {new Date(t.date).toLocaleDateString()} · {t.correctCount}/{t.totalQuestions} correct
                    </div>
                  </div>
                  <span className="font-mono-num text-base font-bold text-slate-900 dark:text-slate-100">
                    {t.scorePercent}%
                  </span>
                </li>
              ))}
              {listeningHistory.slice(0, 2).map((l) => (
                <li key={l.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Listening · {l.mode.replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                      {new Date(l.date).toLocaleDateString()} · {l.correctCount}/{l.totalQuestions}
                    </div>
                  </div>
                  <span className="font-mono-num text-base font-bold text-slate-900 dark:text-slate-100">
                    {l.scorePercent}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};
