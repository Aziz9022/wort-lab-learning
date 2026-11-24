import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Layers,
  Search,
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { renderHighlightedSentence } from '../lib/highlight';
import { formatGrammarLabel } from '../lib/parser';
import type { CategoryName, LearningStatus, SubcategoryName } from '../types';
import { AudioControls } from './AudioControls';

const PAGE_SIZE = 30;

function foldGerman(str: string): string {
  return str
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

const STATUS_LABEL: Record<LearningStatus, string> = {
  new: 'New',
  learning: 'Learning',
  needs_revision: 'Needs revision',
  remembered: 'Remembered',
};

export const VocabularyExplorer: React.FC = () => {
  const {
    book,
    progressMap,
    groups,
    openEntryDetail,
    toggleBookmark,
    toggleDifficult,
    startRevisionForEntry,
  } = useLab();

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LearningStatus>('ALL');
  const [onlyDifficult, setOnlyDifficult] = useState(false);
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'book' | 'de_asc' | 'de_desc' | 'en_asc'>('book');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const entries = book?.entries ?? [];
    const q = query.trim().toLowerCase();
    const qFolded = foldGerman(q);

    const list = entries.filter((e) => {
      if (categoryFilter !== 'ALL') {
        if (categoryFilter === 'THINGS' || categoryFilter === 'PLACES' || categoryFilter === 'PEOPLE') {
          if (e.subcategory !== (categoryFilter as SubcategoryName)) return false;
        } else if (e.category !== (categoryFilter as CategoryName)) {
          return false;
        }
      }

      const p = progressMap.get(e.id);
      const status: LearningStatus = p?.status ?? 'new';
      if (statusFilter !== 'ALL' && status !== statusFilter) return false;
      if (onlyDifficult && !p?.difficult) return false;
      if (onlyBookmarked && !p?.bookmarked) return false;
      if (groupFilter !== 'ALL' && !(p?.groups.includes(groupFilter))) return false;

      if (q) {
        const deMatch =
          e.germanWord.toLowerCase().includes(q) ||
          foldGerman(e.germanWord).includes(qFolded) ||
          e.germanSentence.toLowerCase().includes(q);
        const enMatch =
          e.englishMeaning.toLowerCase().includes(q) ||
          e.englishSentence.toLowerCase().includes(q);
        if (!deMatch && !enMatch) return false;
      }
      return true;
    });

    if (sortBy === 'de_asc') {
      return [...list].sort((a, b) => a.germanWord.localeCompare(b.germanWord, 'de'));
    }
    if (sortBy === 'de_desc') {
      return [...list].sort((a, b) => b.germanWord.localeCompare(a.germanWord, 'de'));
    }
    if (sortBy === 'en_asc') {
      return [...list].sort((a, b) => a.englishMeaning.localeCompare(b.englishMeaning, 'en'));
    }
    return list;
  }, [
    book,
    query,
    categoryFilter,
    statusFilter,
    onlyDifficult,
    onlyBookmarked,
    groupFilter,
    sortBy,
    progressMap,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const resetPage = () => setPage(0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-scale-heading font-bold text-slate-900 dark:text-slate-100">
            Vocabulary Explorer
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 font-mono-num">
            Showing {filtered.length.toLocaleString()} of{' '}
            {(book?.entries.length ?? 0).toLocaleString()} book entries
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                resetPage();
              }}
              placeholder="Search German word, English meaning, or sentence..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2.5 text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                resetPage();
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-base text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">All Categories</option>
              <option value="NOUNS">Nouns (All)</option>
              <option value="THINGS">Nouns — Things</option>
              <option value="PLACES">Nouns — Places</option>
              <option value="PEOPLE">Nouns — People</option>
              <option value="ADJECTIVES">Adjectives</option>
              <option value="VERBS">Verbs</option>
              <option value="COMPOUND WORDS">Compound Words</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Filter by learning status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'ALL' | LearningStatus);
                resetPage();
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-base text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">All Statuses</option>
              <option value="new">New</option>
              <option value="learning">Learning</option>
              <option value="needs_revision">Needs Revision</option>
              <option value="remembered">Remembered</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Sort vocabulary"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as typeof sortBy);
                resetPage();
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-base text-slate-900 dark:text-slate-100"
            >
              <option value="book">Book Order</option>
              <option value="de_asc">German A–Z</option>
              <option value="de_desc">German Z–A</option>
              <option value="en_asc">English A–Z</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setOnlyDifficult((v) => !v);
              resetPage();
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              onlyDifficult
                ? 'border-red-500 bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Difficult Only
          </button>

          <button
            type="button"
            onClick={() => {
              setOnlyBookmarked((v) => !v);
              resetPage();
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              onlyBookmarked
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            Bookmarked Only
          </button>

          {groups.length > 0 && (
            <select
              aria-label="Filter by personal group"
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
                resetPage();
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Personal Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  Group: {g.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Vocabulary List */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
          <p className="text-lg font-medium text-slate-800 dark:text-slate-200">
            No matching vocabulary entries found.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCategoryFilter('ALL');
              setStatusFilter('ALL');
              setOnlyDifficult(false);
              setOnlyBookmarked(false);
              setGroupFilter('ALL');
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {visible.map((entry) => {
            const p = progressMap.get(entry.id);
            const status = p?.status ?? 'new';
            const grammar = formatGrammarLabel(entry.grammarTag);

            return (
              <article
                key={entry.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 space-y-4"
              >
                {/* Quiet metadata header — zero-pill discipline */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {entry.sectionLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">
                      #{entry.orderIndex} (Lines {entry.sourceLineStart}–{entry.sourceLineEnd})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{STATUS_LABEL[status]}</span>
                    {p?.difficult && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-red-700 dark:text-red-400 font-medium">Difficult</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleBookmark(entry.id)}
                      className={`rounded-lg border p-2 transition-colors cursor-pointer ${
                        p?.bookmarked
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title={p?.bookmarked ? 'Remove bookmark' : 'Bookmark word'}
                      aria-label={`Bookmark ${entry.germanWord}`}
                    >
                      <Bookmark className={`w-4 h-4 ${p?.bookmarked ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleDifficult(entry.id)}
                      className={`rounded-lg border p-2 transition-colors cursor-pointer ${
                        p?.difficult
                          ? 'border-red-400 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title={p?.difficult ? 'Unmark difficult' : 'Mark as difficult'}
                      aria-label={`Mark ${entry.germanWord} as difficult`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Word & Meaning */}
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => openEntryDetail(entry.id)}
                    className="text-left group cursor-pointer"
                  >
                    <h2 className="font-serif-de font-bold text-scale-word text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                      {entry.germanWord}
                      {grammar && (
                        <span className="ml-3 text-base font-sans font-normal text-slate-500 dark:text-slate-400">
                          {grammar}
                        </span>
                      )}
                    </h2>
                    <p className="mt-1 text-scale-translation font-semibold text-slate-700 dark:text-slate-300">
                      {entry.englishMeaning}
                    </p>
                  </button>
                </div>

                {/* Example Sentences */}
                <div className="space-y-1.5 pt-1">
                  <p className="font-serif-de text-scale-sentence text-slate-900 dark:text-slate-100">
                    {renderHighlightedSentence(entry.germanSentence, entry.germanWord)}
                  </p>
                  <p className="text-scale-translation text-slate-600 dark:text-slate-400">
                    {entry.englishSentence}
                  </p>
                </div>

                {p?.note && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                    Note: {p.note}
                  </p>
                )}

                {/* Audio + Detail + Revise Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <AudioControls
                    germanWord={entry.germanWord}
                    germanSentence={entry.germanSentence}
                    compact
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startRevisionForEntry(entry.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Layers className="w-4 h-4" />
                      Revise
                    </button>
                    <button
                      type="button"
                      onClick={() => openEntryDetail(entry.id)}
                      className="rounded-lg bg-slate-900 dark:bg-slate-100 px-3.5 py-1.5 text-sm font-medium text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 cursor-pointer"
                    >
                      Open Detail
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => {
              setPage((p) => Math.max(0, p - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <span className="font-mono-num text-sm text-slate-600 dark:text-slate-400">
            Page {safePage + 1} of {totalPages}
          </span>

          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => {
              setPage((p) => Math.min(totalPages - 1, p + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
