import React, { useMemo, useState } from 'react';
import { CheckCircle2, Volume2, XCircle } from 'lucide-react';
import { useLab } from '../context/LabContext';
import { evaluateGermanWordAnswer, normalizeEnglishText } from '../lib/evaluator';
import type { CategoryName, VocabEntry } from '../types';
import { AudioControls } from './AudioControls';

type PracticeActivity =
  | 'de_to_en'
  | 'en_to_de'
  | 'fill_blank'
  | 'multiple_choice'
  | 'matching'
  | 'identify_from_sentence'
  | 'listening_id'
  | 'sentence_completion';

const ACTIVITIES: Array<{ id: PracticeActivity; title: string; desc: string }> = [
  { id: 'de_to_en', title: '1. German → English', desc: 'Translate German word into English' },
  { id: 'en_to_de', title: '2. English → German', desc: 'Type the German word from English' },
  { id: 'fill_blank', title: '3. Fill Missing Word', desc: 'Type the missing word in sentence' },
  { id: 'multiple_choice', title: '4. Multiple Choice', desc: 'Pick the right English meaning' },
  { id: 'matching', title: '5. Match Pairs', desc: 'Match 5 German words with English' },
  { id: 'identify_from_sentence', title: '6. Identify in Sentence', desc: 'Identify word from context' },
  { id: 'listening_id', title: '7. Listening Identification', desc: 'Hear German and pick word' },
  { id: 'sentence_completion', title: '8. Sentence Completion', desc: 'Choose best word to complete' },
];

const GERMAN_CHARS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'];

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeClozeSentence(sentence: string, target: string): { masked: string; answer: string } {
  const clean = target.replace(/^sich\s+/i, '').replace(/\([^)]*\)/g, '').replace(/-$/, '').trim();
  const candidates = [clean];
  if (clean.length > 4 && clean.toLowerCase().endsWith('en')) candidates.push(clean.slice(0, -2));
  if (clean.length > 3 && clean.toLowerCase().endsWith('e')) candidates.push(clean.slice(0, -1));

  for (const c of candidates) {
    if (c.length < 2) continue;
    const re = new RegExp(`([A-Za-zÄÖÜäöüß]*${escapeRegex(c)}[A-Za-zÄÖÜäöüß]*)`, 'i');
    const match = sentence.match(re);
    if (match && match[1]) {
      return {
        masked: sentence.replace(match[1], '________'),
        answer: match[1],
      };
    }
  }
  return { masked: `${sentence} (______)`, answer: clean };
}

export const PracticeCentre: React.FC = () => {
  const { book, progressMap, speech, recordReview } = useLab();

  const [activity, setActivity] = useState<PracticeActivity>('multiple_choice');
  const [scope, setScope] = useState<string>('ALL');

  const [items, setItems] = useState<VocabEntry[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [mcChoices, setMcChoices] = useState<VocabEntry[]>([]);
  const [feedback, setFeedback] = useState<{ correct: boolean; expected: string } | null>(null);
  const [score, setScore] = useState(0);

  // Matching board state
  const [matchLeftSelected, setMatchLeftSelected] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [matchShuffledRight, setMatchShuffledRight] = useState<VocabEntry[]>([]);
  const [matchWrongPair, setMatchWrongPair] = useState<string | null>(null);

  const pool = useMemo(() => {
    const all = book?.entries ?? [];
    if (scope === 'DIFFICULT') return all.filter((e) => progressMap.get(e.id)?.difficult);
    if (scope === 'BOOKMARKED') return all.filter((e) => progressMap.get(e.id)?.bookmarked);
    if (scope === 'ALL' || scope === 'MIXED') return all;
    return all.filter((e) => e.category === (scope as CategoryName));
  }, [book, progressMap, scope]);

  const prepareChoices = (target: VocabEntry, allPool: VocabEntry[]): VocabEntry[] => {
    const others = allPool.filter((e) => e.id !== target.id);
    const distractors: VocabEntry[] = [];
    const seen = new Set<string>([target.germanWord.toLowerCase()]);
    for (let i = 0; i < 40 && distractors.length < 3; i++) {
      const c = others[Math.floor(Math.random() * others.length)];
      if (c && !seen.has(c.germanWord.toLowerCase())) {
        seen.add(c.germanWord.toLowerCase());
        distractors.push(c);
      }
    }
    return [target, ...distractors].sort(() => Math.random() - 0.5);
  };

  const startActivity = () => {
    if (pool.length < 4) return;
    const count = activity === 'matching' ? 5 : 10;
    const chosen = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
    setItems(chosen);
    setIdx(0);
    setScore(0);
    setTypedAnswer('');
    setFeedback(null);

    if (activity === 'matching') {
      setMatchedIds(new Set());
      setMatchLeftSelected(null);
      setMatchShuffledRight([...chosen].sort(() => Math.random() - 0.5));
    } else {
      setMcChoices(prepareChoices(chosen[0], book?.entries ?? pool));
      if (activity === 'listening_id') {
        speech.speak(chosen[0].germanWord);
      }
    }
  };

  const current = items?.[idx];

  const handleTypedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || feedback) return;

    let isCorrect = false;
    let expected = '';

    if (activity === 'de_to_en') {
      const normUser = normalizeEnglishText(typedAnswer);
      const variants = current.englishMeaning
        .split(/[\/,;]+/)
        .map((v) => normalizeEnglishText(v.replace(/\([^)]*\)/g, '').trim()))
        .filter(Boolean);
      isCorrect = variants.some((v) => v === normUser || (normUser.length >= 3 && v.includes(normUser)));
      expected = current.englishMeaning;
    } else if (activity === 'en_to_de') {
      isCorrect = evaluateGermanWordAnswer(typedAnswer, current.germanWord);
      expected = current.germanWord;
    } else if (activity === 'fill_blank') {
      const cloze = makeClozeSentence(current.germanSentence, current.germanWord);
      isCorrect =
        evaluateGermanWordAnswer(typedAnswer, cloze.answer) ||
        evaluateGermanWordAnswer(typedAnswer, current.germanWord);
      expected = `${cloze.answer} (${current.germanWord})`;
    }

    if (isCorrect) {
      setScore((s) => s + 1);
      await recordReview(current.id, 'remembered');
    } else {
      await recordReview(current.id, 'again');
    }
    setFeedback({ correct: isCorrect, expected });
  };

  const handleChoicePick = async (picked: VocabEntry) => {
    if (!current || feedback) return;
    const isCorrect = picked.id === current.id;
    if (isCorrect) {
      setScore((s) => s + 1);
      await recordReview(current.id, 'remembered');
    } else {
      await recordReview(current.id, 'again');
    }
    setFeedback({
      correct: isCorrect,
      expected: `${current.germanWord} — ${current.englishMeaning}`,
    });
  };

  const handleNext = () => {
    if (!items) return;
    const nextIdx = idx + 1;
    setIdx(nextIdx);
    setTypedAnswer('');
    setFeedback(null);
    if (nextIdx < items.length) {
      setMcChoices(prepareChoices(items[nextIdx], book?.entries ?? pool));
      if (activity === 'listening_id') {
        speech.speak(items[nextIdx].germanWord);
      }
    }
  };

  const handleMatchRight = async (rightEntry: VocabEntry) => {
    if (!matchLeftSelected || matchedIds.has(rightEntry.id)) return;
    if (matchLeftSelected === rightEntry.id) {
      const next = new Set(matchedIds);
      next.add(rightEntry.id);
      setMatchedIds(next);
      setMatchLeftSelected(null);
      setMatchWrongPair(null);
      setScore((s) => s + 1);
      await recordReview(rightEntry.id, 'remembered');
    } else {
      setMatchWrongPair(rightEntry.id);
      await recordReview(matchLeftSelected, 'again');
      setTimeout(() => setMatchWrongPair(null), 700);
    }
  };

  // Setup View
  if (!items) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-scale-heading font-bold text-slate-900 dark:text-slate-100">
              Practice Centre
            </h2>
            <p className="text-scale-body text-slate-600 dark:text-slate-400">
              Eight interactive exercises using real vocabulary and sentences from your book.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ACTIVITIES.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setActivity(a.id)}
                className={`rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                  activity === a.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="text-sm font-semibold">{a.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{a.desc}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 pt-5">
            <div className="flex items-center gap-3">
              <label htmlFor="practice-scope" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Vocabulary set:
              </label>
              <select
                id="practice-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="MIXED">Mixed Categories</option>
                <option value="NOUNS">Nouns</option>
                <option value="ADJECTIVES">Adjectives</option>
                <option value="VERBS">Verbs</option>
                <option value="COMPOUND WORDS">Compound Words</option>
                <option value="DIFFICULT">Difficult Words</option>
                <option value="BOOKMARKED">Bookmarked Words</option>
              </select>
              <span className="text-xs text-slate-500 font-mono-num">
                ({pool.length} words)
              </span>
            </div>

            <button
              type="button"
              disabled={pool.length < 4}
              onClick={startActivity}
              className="rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
            >
              Start Practice
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Matching Activity Board
  if (activity === 'matching') {
    const allMatched = matchedIds.size === items.length;
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Match German Words with English Meanings
          </h2>
          <button
            type="button"
            onClick={() => setItems(null)}
            className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
          >
            Back to Practice Menu
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500">German</p>
            {items.map((e) => {
              const done = matchedIds.has(e.id);
              const selected = matchLeftSelected === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  disabled={done}
                  onClick={() => {
                    setMatchLeftSelected(e.id);
                    speech.speak(e.germanWord);
                  }}
                  className={`w-full rounded-lg border p-4 text-left font-serif-de text-xl font-bold transition-colors flex items-center justify-between cursor-pointer ${
                    done
                      ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 opacity-70'
                      : selected
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{e.germanWord}</span>
                  <Volume2 className="w-4 h-4 text-slate-400" />
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500">English</p>
            {matchShuffledRight.map((e) => {
              const done = matchedIds.has(e.id);
              const wrong = matchWrongPair === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  disabled={done}
                  onClick={() => handleMatchRight(e)}
                  className={`w-full rounded-lg border p-4 text-left text-lg font-medium transition-colors cursor-pointer ${
                    done
                      ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 opacity-70'
                      : wrong
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {e.englishMeaning}
                </button>
              );
            })}
          </div>
        </div>

        {allMatched && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-6 flex flex-wrap items-center justify-between gap-4">
            <span className="font-semibold text-emerald-900 dark:text-emerald-200">
              All 5 pairs matched!
            </span>
            <button
              type="button"
              onClick={startActivity}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              Play New Set
            </button>
          </div>
        )}
      </div>
    );
  }

  // Practice Round Complete
  if (!current) {
    return (
      <div className="max-w-2xl mx-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-5">
        <h2 className="text-scale-heading font-bold text-slate-900 dark:text-slate-100">
          Practice Complete
        </h2>
        <p className="font-mono-num text-4xl font-bold text-blue-700 dark:text-blue-400">
          {score} / {items.length}
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={startActivity}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            New Round
          </button>
          <button
            type="button"
            onClick={() => setItems(null)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-base font-medium cursor-pointer"
          >
            Change Activity
          </button>
        </div>
      </div>
    );
  }

  const cloze = makeClozeSentence(current.germanSentence, current.germanWord);
  const isTypedMode =
    activity === 'de_to_en' || activity === 'en_to_de' || activity === 'fill_blank';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 font-mono-num">
        <span>
          Item {idx + 1} of {items.length} · Score: {score}
        </span>
        <button
          type="button"
          onClick={() => setItems(null)}
          className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
        >
          Back to Menu
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        {/* Prompt Display */}
        {activity === 'de_to_en' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Translate this German word into English:</p>
            <h3 className="font-serif-de font-bold text-scale-word">{current.germanWord}</h3>
            <AudioControls
              germanWord={current.germanWord}
              germanSentence={current.germanSentence}
            />
          </div>
        )}

        {activity === 'en_to_de' && (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Type the German word for:</p>
            <h3 className="text-scale-word font-bold text-blue-800 dark:text-blue-300">
              {current.englishMeaning}
            </h3>
            <p className="text-base text-slate-600 dark:text-slate-400">{current.englishSentence}</p>
          </div>
        )}

        {(activity === 'fill_blank' || activity === 'sentence_completion') && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              {activity === 'fill_blank'
                ? 'Type the missing German word:'
                : 'Choose the German word that completes this sentence:'}
            </p>
            <p className="font-serif-de text-scale-sentence font-semibold">{cloze.masked}</p>
            <p className="text-scale-translation text-slate-600 dark:text-slate-400">
              {current.englishSentence}
            </p>
          </div>
        )}

        {activity === 'multiple_choice' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Select the correct English meaning:</p>
            <h3 className="font-serif-de font-bold text-scale-word">{current.germanWord}</h3>
            <AudioControls
              germanWord={current.germanWord}
              germanSentence={current.germanSentence}
              compact
            />
          </div>
        )}

        {activity === 'identify_from_sentence' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Which German word in this sentence means "{current.englishMeaning}"?
            </p>
            <p className="font-serif-de text-scale-sentence">{current.germanSentence}</p>
            <AudioControls
              germanWord={current.germanWord}
              germanSentence={current.germanSentence}
              hideWordButton
              compact
            />
          </div>
        )}

        {activity === 'listening_id' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Listen to the German pronunciation and select the matching German word:
            </p>
            <button
              type="button"
              onClick={() => speech.speak(current.germanWord)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              <Volume2 className="w-5 h-5" />
              Play Word Again
            </button>
          </div>
        )}

        {/* Answer Input */}
        {isTypedMode ? (
          <form onSubmit={handleTypedSubmit} className="space-y-3">
            <input
              type="text"
              disabled={feedback !== null}
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              placeholder={
                activity === 'de_to_en'
                  ? 'Type English meaning...'
                  : 'Type German word...'
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {activity !== 'de_to_en' && !feedback && (
              <div className="flex flex-wrap gap-1.5">
                {GERMAN_CHARS.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setTypedAnswer((v) => v + ch)}
                    className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1 text-base font-serif-de hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {ch}
                  </button>
                ))}
              </div>
            )}
            {!feedback && (
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                Check Answer
              </button>
            )}
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mcChoices.map((choice) => {
              const label =
                activity === 'multiple_choice' ? choice.englishMeaning : choice.germanWord;
              const isRight = choice.id === current.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={feedback !== null}
                  onClick={() => handleChoicePick(choice)}
                  className={`rounded-lg border p-4 text-left text-lg font-medium transition-colors cursor-pointer ${
                    feedback
                      ? isRight
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100'
                        : 'border-slate-200 dark:border-slate-700 opacity-60'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Immediate Feedback */}
        {feedback && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              {feedback.correct ? (
                <span className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5" /> Correct
                </span>
              ) : (
                <span className="text-red-700 dark:text-red-400 inline-flex items-center gap-1.5">
                  <XCircle className="w-5 h-5" /> Incorrect
                </span>
              )}
            </div>
            <p className="text-base">
              Answer: <strong>{feedback.expected}</strong>
            </p>
            <p className="font-serif-de text-base text-slate-700 dark:text-slate-300">
              {current.germanSentence} — {current.englishSentence}
            </p>
            <button
              type="button"
              onClick={handleNext}
              className="mt-2 rounded-lg bg-slate-900 dark:bg-slate-100 px-5 py-2 text-sm font-semibold text-white dark:text-slate-900 cursor-pointer"
            >
              {idx + 1 >= items.length ? 'See Final Score' : 'Next'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
