import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bookmark,
  Check,
  Eye,
  EyeOff,
  FolderPlus,
  Layers,
  Quote,
  RotateCcw,
  X,
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { renderHighlightedSentence } from '../lib/highlight';
import { formatGrammarLabel } from '../lib/parser';
import { AudioControls } from './AudioControls';

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  learning: 'Learning',
  needs_revision: 'Needs revision',
  remembered: 'Remembered',
};

export const VocabularyDetail: React.FC = () => {
  const {
    selectedEntryId,
    closeEntryDetail,
    entriesById,
    progressMap,
    groups,
    toggleBookmark,
    toggleDifficult,
    toggleSavedSentence,
    saveNote,
    toggleEntryGroup,
    createGroup,
    recordReview,
    openReaderAtLine,
    startRevisionForEntry,
  } = useLab();

  const entry = selectedEntryId ? entriesById.get(selectedEntryId) : undefined;
  const progress = selectedEntryId ? progressMap.get(selectedEntryId) : undefined;

  const [hideGermanWord, setHideGermanWord] = useState(false);
  const [hideEnglish, setHideEnglish] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSavedNotice, setNoteSavedNotice] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [recallFeedback, setRecallFeedback] = useState<string | null>(null);

  useEffect(() => {
    setHideGermanWord(false);
    setHideEnglish(false);
    setRecallFeedback(null);
    setNoteSavedNotice(false);
    setNoteDraft(progress?.note ?? '');
  }, [selectedEntryId]);

  if (!entry) return null;

  const grammarDisplay = formatGrammarLabel(entry.grammarTag);
  const status = progress?.status ?? 'new';

  const handleSaveNote = async () => {
    await saveNote(entry.id, noteDraft);
    setNoteSavedNotice(true);
    setTimeout(() => setNoteSavedNotice(false), 2000);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const g = await createGroup(newGroupName.trim());
    await toggleEntryGroup(entry.id, g.id);
    setNewGroupName('');
  };

  const handleMemoryTest = async (outcome: 'remembered' | 'again') => {
    await recordReview(entry.id, outcome);
    setRecallFeedback(
      outcome === 'remembered'
        ? 'Recorded as remembered and scheduled for spaced repetition.'
        : 'Marked as needing revision and added to your priority queue.'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vocab-detail-title"
    >
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top metadata & close bar */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {entry.sectionLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">
              #{entry.orderIndex} · Lines {entry.sourceLineStart}–{entry.sourceLineEnd}
            </span>
            <span aria-hidden="true">·</span>
            <span>Status: {STATUS_LABELS[status]}</span>
          </div>
          <button
            type="button"
            onClick={closeEntryDetail}
            className="rounded-lg p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Close vocabulary detail"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 sm:p-8 space-y-8">
          {/* Primary Word & Meaning Block */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  German word
                </p>
                <h2
                  id="vocab-detail-title"
                  className="font-serif-de font-bold text-scale-word text-slate-900 dark:text-slate-100"
                >
                  {hideGermanWord ? (
                    <span className="inline-block rounded-lg border border-dashed border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 px-4 py-1 text-slate-400 dark:text-slate-500 select-none">
                      [Hidden for recall]
                    </span>
                  ) : (
                    entry.germanWord
                  )}
                </h2>
                {grammarDisplay && !hideGermanWord && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Book gender/form label: <span className="font-medium">{grammarDisplay}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHideGermanWord((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                >
                  {hideGermanWord ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {hideGermanWord ? 'Show German' : 'Hide German'}
                </button>
                <button
                  type="button"
                  onClick={() => setHideEnglish((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                >
                  {hideEnglish ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {hideEnglish ? 'Show English' : 'Hide English'}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                English meaning
              </p>
              <p className="text-scale-translation font-semibold text-slate-800 dark:text-slate-200">
                {hideEnglish ? (
                  <span className="inline-block rounded-lg border border-dashed border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 px-3 py-0.5 text-slate-400 dark:text-slate-500 select-none">
                    [Hidden for recall]
                  </span>
                ) : (
                  entry.englishMeaning
                )}
              </p>
            </div>
          </div>

          {/* Original Book Context */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-6 space-y-5">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Original German example sentence
              </p>
              <p className="font-serif-de text-scale-sentence text-slate-900 dark:text-slate-100">
                {renderHighlightedSentence(entry.germanSentence, entry.germanWord, {
                  hideTarget: hideGermanWord,
                })}
              </p>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Original English translation
              </p>
              <p className="text-scale-translation text-slate-700 dark:text-slate-300">
                {hideEnglish ? (
                  <span className="text-slate-400 dark:text-slate-500 italic">
                    Translation hidden — recall the meaning before revealing.
                  </span>
                ) : (
                  entry.englishSentence
                )}
              </p>
            </div>

            <div className="pt-2">
              <AudioControls
                germanWord={entry.germanWord}
                germanSentence={entry.germanSentence}
                hideWordButton={hideGermanWord}
              />
            </div>
          </div>

          {entry.sourceAnomaly && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              <span className="font-semibold">Source text note: </span>
              {entry.sourceAnomaly} Original book wording is preserved verbatim.
            </div>
          )}

          {/* Quick Memory Check & Actions */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-1">
                  Test memory:
                </span>
                <button
                  type="button"
                  onClick={() => handleMemoryTest('remembered')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Remembered
                </button>
                <button
                  type="button"
                  onClick={() => handleMemoryTest('again')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3.5 py-2 text-sm font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Needs Revision
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openReaderAtLine(entry.sourceLineStart)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  View in Book
                </button>
                <button
                  type="button"
                  onClick={() => startRevisionForEntry(entry.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  Revise Flashcard
                </button>
              </div>
            </div>

            {recallFeedback && (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {recallFeedback}
              </p>
            )}
          </div>

          {/* Bookmark, Difficult, Save Sentence */}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 dark:border-slate-800 pt-6">
            <button
              type="button"
              onClick={() => toggleBookmark(entry.id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer ${
                progress?.bookmarked
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${progress?.bookmarked ? 'fill-current' : ''}`} />
              {progress?.bookmarked ? 'Bookmarked' : 'Bookmark'}
            </button>

            <button
              type="button"
              onClick={() => toggleDifficult(entry.id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer ${
                progress?.difficult
                  ? 'border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              {progress?.difficult ? 'Marked Difficult' : 'Mark as Difficult'}
            </button>

            <button
              type="button"
              onClick={() => toggleSavedSentence(entry.id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer ${
                progress?.savedSentence
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Quote className="w-4 h-4" />
              {progress?.savedSentence ? 'Sentence Saved' : 'Save Useful Sentence'}
            </button>
          </div>

          {/* Personal Notes & Vocabulary Groups */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-200 dark:border-slate-800 pt-6">
            <div className="space-y-2.5">
              <label
                htmlFor="entry-personal-note"
                className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Personal Notes
              </label>
              <textarea
                id="entry-personal-note"
                rows={3}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Write a memory cue, grammar reminder, or personal example..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveNote}
                  className="rounded-lg bg-slate-900 dark:bg-slate-100 px-3.5 py-2 text-sm font-medium text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 cursor-pointer"
                >
                  Save Note
                </button>
                {noteSavedNotice && (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved locally</span>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Personal Vocabulary Groups
              </p>
              {groups.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No custom groups yet. Create one below.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => {
                    const active = progress?.groups.includes(g.id) ?? false;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleEntryGroup(entry.id, g.id)}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              )}

              <form onSubmit={handleCreateGroup} className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="New group name..."
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                  Add
                </button>
              </form>
            </div>
          </div>

          {/* Learning Stats Footer */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 dark:border-slate-800 pt-4 text-sm text-slate-500 dark:text-slate-400 font-mono-num">
            <span>Reviews: {progress?.reviewCount ?? 0}</span>
            <span>Correct: {progress?.correctCount ?? 0}</span>
            <span>Incorrect: {progress?.incorrectCount ?? 0}</span>
            {progress?.nextReviewAt && (
              <span>Next review: {new Date(progress.nextReviewAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
