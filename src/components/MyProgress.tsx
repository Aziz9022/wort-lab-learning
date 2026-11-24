import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Download,
  FolderPlus,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { isDueForRevision } from '../lib/srs';
import type { CategoryName } from '../types';

type NotebookTab = 'bookmarked' | 'difficult' | 'sentences' | 'notes' | 'groups';

const CATEGORIES: CategoryName[] = ['NOUNS', 'ADJECTIVES', 'VERBS', 'COMPOUND WORDS'];

export const MyProgress: React.FC = () => {
  const {
    book,
    entriesById,
    progressMap,
    groups,
    tests,
    listeningHistory,
    dailyLogs,
    createGroup,
    deleteGroup,
    openEntryDetail,
    speech,
  } = useLab();

  const [notebookTab, setNotebookTab] = useState<NotebookTab>('bookmarked');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');

  const summary = useMemo(() => {
    const entries = book?.entries ?? [];
    const now = Date.now();
    let studied = 0;
    let remembered = 0;
    let needsRevision = 0;
    let difficult = 0;

    const catStats: Record<CategoryName, { total: number; studied: number; remembered: number }> = {
      NOUNS: { total: 0, studied: 0, remembered: 0 },
      ADJECTIVES: { total: 0, studied: 0, remembered: 0 },
      VERBS: { total: 0, studied: 0, remembered: 0 },
      'COMPOUND WORDS': { total: 0, studied: 0, remembered: 0 },
    };

    for (const e of entries) {
      catStats[e.category].total += 1;
      const p = progressMap.get(e.id);
      if (!p) continue;
      if (p.firstStudiedAt !== null || p.reviewCount > 0) {
        studied += 1;
        catStats[e.category].studied += 1;
      }
      if (p.status === 'remembered') {
        remembered += 1;
        catStats[e.category].remembered += 1;
      }
      if (p.status === 'needs_revision' || isDueForRevision(p, now)) needsRevision += 1;
      if (p.difficult) difficult += 1;
    }

    const avgTestAccuracy =
      tests.length > 0
        ? Math.round(tests.reduce((s, t) => s + t.scorePercent, 0) / tests.length)
        : null;

    return {
      total: entries.length,
      studied,
      remembered,
      needsRevision,
      difficult,
      catStats,
      avgTestAccuracy,
    };
  }, [book, progressMap, tests]);

  const notebookEntries = useMemo(() => {
    const all = Array.from(progressMap.values());
    if (notebookTab === 'bookmarked') {
      return all.filter((p) => p.bookmarked);
    }
    if (notebookTab === 'difficult') {
      return all.filter((p) => p.difficult);
    }
    if (notebookTab === 'sentences') {
      return all.filter((p) => p.savedSentence);
    }
    if (notebookTab === 'notes') {
      return all.filter((p) => p.note.trim().length > 0);
    }
    if (selectedGroupId !== 'ALL') {
      return all.filter((p) => p.groups.includes(selectedGroupId));
    }
    return all.filter((p) => p.groups.length > 0);
  }, [progressMap, notebookTab, selectedGroupId]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    await createGroup(newGroupName.trim());
    setNewGroupName('');
  };

  const handleExportPersonalNotebook = (format: 'json' | 'txt') => {
    const personal = Array.from(progressMap.values())
      .filter((p) => p.bookmarked || p.difficult || p.savedSentence || p.note.trim() || p.groups.length > 0)
      .map((p) => {
        const entry = entriesById.get(p.entryId);
        return {
          germanWord: entry?.germanWord ?? p.entryId,
          englishMeaning: entry?.englishMeaning ?? '',
          germanSentence: entry?.germanSentence ?? '',
          englishSentence: entry?.englishSentence ?? '',
          category: entry?.sectionLabel ?? '',
          bookmarked: p.bookmarked,
          difficult: p.difficult,
          savedSentence: p.savedSentence,
          note: p.note,
          groups: p.groups.map((gid) => groups.find((g) => g.id === gid)?.name ?? gid),
        };
      });

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(personal, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wortlabor-personal-notebook-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const lines = personal.map(
        (item) =>
          `${item.germanWord} — ${item.englishMeaning} [${item.category}]\n` +
          `  DE: ${item.germanSentence}\n` +
          `  EN: ${item.englishSentence}\n` +
          (item.note ? `  Note: ${item.note}\n` : '') +
          (item.groups.length ? `  Groups: ${item.groups.join(', ')}\n` : '')
      );
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wortlabor-personal-notebook-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-scale-heading font-bold text-slate-900 dark:text-slate-100">
          My Progress & Personal Notebook
        </h1>
        <p className="text-scale-body text-slate-600 dark:text-slate-400">
          Track vocabulary retention, category mastery, test accuracy, and your saved study notes.
        </p>
      </div>

      {/* Key Metrics */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Imported</div>
          <div className="font-mono-num text-2xl font-bold mt-1">{summary.total}</div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Studied</div>
          <div className="font-mono-num text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">
            {summary.studied}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Remembered</div>
          <div className="font-mono-num text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            {summary.remembered}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Needs Revision</div>
          <div className="font-mono-num text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">
            {summary.needsRevision}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Difficult</div>
          <div className="font-mono-num text-2xl font-bold text-red-700 dark:text-red-400 mt-1">
            {summary.difficult}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Avg Test Accuracy</div>
          <div className="font-mono-num text-2xl font-bold mt-1">
            {summary.avgTestAccuracy !== null ? `${summary.avgTestAccuracy}%` : '—'}
          </div>
        </div>
      </section>

      {/* Category-Wise Progress */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Category-Wise Progress
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CATEGORIES.map((cat) => {
            const c = summary.catStats[cat];
            const pctRemembered = c.total > 0 ? Math.round((c.remembered / c.total) * 100) : 0;
            const pctStudied = c.total > 0 ? Math.round((c.studied / c.total) * 100) : 0;
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{cat}</span>
                  <span className="font-mono-num text-slate-600 dark:text-slate-400">
                    {c.remembered} remembered · {c.studied} studied / {c.total}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                  <div
                    className="h-full bg-blue-200 dark:bg-blue-900/70 absolute left-0 top-0"
                    style={{ width: `${pctStudied}%` }}
                  />
                  <div
                    className="h-full bg-emerald-600 relative z-10"
                    style={{ width: `${pctRemembered}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Personal Vocabulary Notebook */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Personal Vocabulary Notebook
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleExportPersonalNotebook('txt')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export TXT
            </button>
            <button
              type="button"
              onClick={() => handleExportPersonalNotebook('json')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export JSON
            </button>
          </div>
        </div>

        {/* Notebook Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit">
          {(
            [
              ['bookmarked', 'Bookmarked'],
              ['difficult', 'Difficult Words'],
              ['sentences', 'Saved Sentences'],
              ['notes', 'Personal Notes'],
              ['groups', 'Custom Groups'],
            ] as Array<[NotebookTab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setNotebookTab(id)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                notebookTab === id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Group Management when on Custom Groups tab */}
        {notebookTab === 'groups' && (
          <div className="space-y-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <form onSubmit={handleCreateGroup} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Create a personal vocabulary group..."
                className="flex-1 min-w-[220px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                Create Group
              </button>
            </form>

            {groups.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedGroupId('ALL')}
                  className={`rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
                    selectedGroupId === 'ALL'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  All Groups
                </button>
                {groups.map((g) => (
                  <div
                    key={g.id}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                      selectedGroupId === g.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedGroupId(g.id)}
                      className="font-medium cursor-pointer"
                    >
                      {g.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteGroup(g.id)}
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                      aria-label={`Delete group ${g.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Saved Entries List */}
        {notebookEntries.length === 0 ? (
          <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
            No entries saved in this section yet. Open any vocabulary word to bookmark, add notes,
            save useful sentences, or assign groups.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {notebookEntries.map((p) => {
              const entry = entriesById.get(p.entryId);
              if (!entry) return null;
              return (
                <li key={p.entryId} className="py-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-[220px]">
                    <button
                      type="button"
                      onClick={() => openEntryDetail(entry.id)}
                      className="text-left group cursor-pointer"
                    >
                      <span className="font-serif-de text-xl font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                        {entry.germanWord}
                      </span>
                      <span className="ml-2 text-base text-slate-600 dark:text-slate-400">
                        — {entry.englishMeaning}
                      </span>
                    </button>
                    <p className="font-serif-de text-base text-slate-800 dark:text-slate-200">
                      {entry.germanSentence}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {entry.englishSentence}
                    </p>
                    {p.note && (
                      <p className="text-sm text-blue-800 dark:text-blue-300 pt-1">
                        Note: {p.note}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => speech.speak(entry.germanWord)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      aria-label={`Pronounce ${entry.germanWord}`}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEntryDetail(entry.id)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Open
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* History Tables: Revision, Written Tests, Listening */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Written Test History
          </h2>
          {tests.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No written translation tests completed yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Scope</th>
                    <th className="py-2 pr-3 font-medium">Result</th>
                    <th className="py-2 font-medium text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono-num">
                  {tests.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2.5 pr-3">{new Date(t.date).toLocaleDateString()}</td>
                      <td className="py-2.5 pr-3 font-sans">{t.configLabel}</td>
                      <td className="py-2.5 pr-3">
                        {t.correctCount}✓ / {t.partialCount}~ / {t.incorrectCount}✗
                      </td>
                      <td className="py-2.5 text-right font-bold">{t.scorePercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Revision & Listening History
          </h2>
          {dailyLogs.length === 0 && listeningHistory.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Daily flashcard reviews and listening sessions will appear here.
            </p>
          ) : (
            <div className="space-y-4">
              {dailyLogs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-2">Daily Reviews</h3>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800 font-mono-num text-sm">
                    {dailyLogs.slice(0, 7).map((log) => (
                      <li key={log.dateKey} className="py-2 flex justify-between">
                        <span>{log.dateKey}</span>
                        <span>
                          {log.reviewedCount} reviewed ({log.rememberedCount} remembered)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {listeningHistory.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-2">Listening Sessions</h3>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800 font-mono-num text-sm">
                    {listeningHistory.slice(0, 7).map((l) => (
                      <li key={l.id} className="py-2 flex justify-between">
                        <span className="font-sans">
                          {new Date(l.date).toLocaleDateString()} · {l.mode.replace(/_/g, ' ')}
                        </span>
                        <span className="font-bold">
                          {l.correctCount}/{l.totalQuestions} ({l.scorePercent}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
