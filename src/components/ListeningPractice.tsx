import React, { useMemo, useState } from 'react';
import { CheckCircle2, RotateCw, Turtle, Volume2, XCircle } from 'lucide-react';
import { useLab } from '../context/LabContext';
import type { CategoryName, VocabEntry } from '../types';

type ListeningMode = 'word' | 'word_in_sentence' | 'sentence';

function buildChoices(
  target: VocabEntry,
  pool: VocabEntry[],
  mode: ListeningMode
): Array<{ id: string; label: string }> {
  const others = pool.filter((e) => e.id !== target.id);
  const picked: VocabEntry[] = [];
  const usedLabels = new Set<string>([
    (mode === 'sentence' ? target.englishSentence : target.englishMeaning).toLowerCase(),
  ]);

  for (let i = 0; i < 40 && picked.length < 3; i++) {
    const cand = others[Math.floor(Math.random() * others.length)];
    if (!cand) continue;
    const lbl = (mode === 'sentence' ? cand.englishSentence : cand.englishMeaning).toLowerCase();
    if (!usedLabels.has(lbl)) {
      usedLabels.add(lbl);
      picked.push(cand);
    }
  }

  const allOpts = [
    {
      id: target.id,
      label: mode === 'sentence' ? target.englishSentence : target.englishMeaning,
    },
    ...picked.map((p) => ({
      id: p.id,
      label: mode === 'sentence' ? p.englishSentence : p.englishMeaning,
    })),
  ];

  for (let i = allOpts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allOpts[i], allOpts[j]] = [allOpts[j], allOpts[i]];
  }
  return allOpts;
}

export const ListeningPractice: React.FC = () => {
  const { book, progressMap, speech, recordReview, saveListeningResult } = useLab();

  const [mode, setMode] = useState<ListeningMode>('word');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [questionCount, setQuestionCount] = useState<number>(10);

  const [questions, setQuestions] = useState<Array<{
    entry: VocabEntry;
    choices: Array<{ id: string; label: string }>;
  }> | null>(null);
  const [idx, setIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const pool = useMemo(() => {
    const all = book?.entries ?? [];
    if (categoryFilter === 'DIFFICULT') {
      return all.filter((e) => progressMap.get(e.id)?.difficult);
    }
    if (categoryFilter === 'ALL') return all;
    return all.filter((e) => e.category === (categoryFilter as CategoryName));
  }, [book, progressMap, categoryFilter]);

  const startListening = () => {
    if (pool.length < 4) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, questionCount);
    const built = shuffled.map((entry) => ({
      entry,
      choices: buildChoices(entry, book?.entries ?? pool, mode),
    }));
    setQuestions(built);
    setIdx(0);
    setSelectedId(null);
    setCorrectCount(0);
    setFinished(false);

    const firstText =
      mode === 'word' ? built[0].entry.germanWord : built[0].entry.germanSentence;
    speech.speak(firstText);
  };

  const current = questions?.[idx];

  const handlePick = async (choiceId: string) => {
    if (!current || selectedId !== null) return;
    setSelectedId(choiceId);
    const isCorrect = choiceId === current.entry.id;
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      await recordReview(current.entry.id, 'remembered');
    } else {
      await recordReview(current.entry.id, 'again');
    }
  };

  const handleNext = async () => {
    if (!questions) return;
    if (idx + 1 >= questions.length) {
      const pct = Math.round((correctCount / questions.length) * 100);
      await saveListeningResult({
        id: `listen-${Date.now()}`,
        date: Date.now(),
        mode,
        categoryLabel: categoryFilter,
        totalQuestions: questions.length,
        correctCount,
        scorePercent: pct,
      });
      setFinished(true);
    } else {
      const nextIdx = idx + 1;
      setIdx(nextIdx);
      setSelectedId(null);
      const nextEntry = questions[nextIdx].entry;
      speech.speak(mode === 'word' ? nextEntry.germanWord : nextEntry.germanSentence);
    }
  };

  if (finished && questions) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="max-w-2xl mx-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-5">
        <h2 className="text-scale-heading font-bold text-slate-900 dark:text-slate-100">
          Listening Session Complete
        </h2>
        <p className="font-mono-num text-4xl font-bold text-blue-700 dark:text-blue-400">{pct}%</p>
        <p className="text-base text-slate-600 dark:text-slate-400">
          {correctCount} of {questions.length} identified accurately.
        </p>
        <button
          type="button"
          onClick={() => {
            setQuestions(null);
            setFinished(false);
          }}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-blue-700 cursor-pointer"
        >
          Practice Again
        </button>
      </div>
    );
  }

  if (!questions || !current) {
    return (
      <div className="max-w-3xl mx-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-scale-heading font-bold text-slate-900 dark:text-slate-100">
            Listening Practice
          </h2>
          <p className="text-scale-body text-slate-600 dark:text-slate-400">
            Listen to German audio from your device speech synthesizer and identify the English meaning.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Difficulty level
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                ['word', '1. Individual Word', 'Hear the German word and choose its English meaning.'],
                [
                  'word_in_sentence',
                  '2. Word in Context',
                  'Hear the full German sentence and identify the target word.',
                ],
                [
                  'sentence',
                  '3. Sentence Meaning',
                  'Hear the complete German sentence and match its English translation.',
                ],
              ] as Array<[ListeningMode, string, string]>
            ).map(([m, title, desc]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg border p-4 text-left cursor-pointer ${
                  mode === m
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="listen-cat" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Category
            </label>
            <select
              id="listen-cat"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="ALL">All Categories</option>
              <option value="NOUNS">Nouns</option>
              <option value="ADJECTIVES">Adjectives</option>
              <option value="VERBS">Verbs</option>
              <option value="COMPOUND WORDS">Compound Words</option>
              <option value="DIFFICULT">Difficult Words</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="listen-count" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Questions
            </label>
            <select
              id="listen-count"
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value={10}>10 questions</option>
              <option value={20}>20 questions</option>
              <option value={30}>30 questions</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          disabled={pool.length < 4}
          onClick={startListening}
          className="rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
        >
          Start Listening Exercise
        </button>
      </div>
    );
  }

  const audioText =
    mode === 'word' ? current.entry.germanWord : current.entry.germanSentence;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 font-mono-num">
        <span>
          Listening {idx + 1} of {questions.length} · Score: {correctCount}
        </span>
        <button
          type="button"
          onClick={() => setQuestions(null)}
          className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
        >
          Exit
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        <div className="space-y-3">
          <p className="text-base font-medium text-slate-700 dark:text-slate-300">
            {mode === 'word'
              ? 'Listen to the German word and select its English meaning:'
              : mode === 'word_in_sentence'
              ? `Listen to the sentence. What does "${current.entry.germanWord}" mean here?`
              : 'Listen to the German sentence and choose the matching English translation:'}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => speech.speak(audioText)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              <Volume2 className="w-5 h-5" />
              Play Audio
            </button>
            <button
              type="button"
              onClick={() => speech.speakSlow(audioText)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-3 text-base font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Turtle className="w-5 h-5" />
              Play Slowly
            </button>
            <button
              type="button"
              onClick={() => speech.speak(audioText, { repeat: 2 })}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-3 text-base font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              Repeat 2×
            </button>
          </div>

          {speech.voiceError && (
            <p className="text-sm text-amber-800 dark:text-amber-300">{speech.voiceError}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 pt-2">
          {current.choices.map((c) => {
            const isSelected = selectedId === c.id;
            const isRight = c.id === current.entry.id;
            let style =
              'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100';
            if (selectedId !== null) {
              if (isRight) {
                style =
                  'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100';
              } else if (isSelected) {
                style =
                  'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-100';
              }
            }
            return (
              <button
                key={c.id}
                type="button"
                disabled={selectedId !== null}
                onClick={() => handlePick(c.id)}
                className={`rounded-lg border p-4 text-left text-scale-translation font-medium transition-colors flex items-center justify-between gap-3 cursor-pointer ${style}`}
              >
                <span>{c.label}</span>
                {selectedId !== null && isRight && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                {selectedId !== null && isSelected && !isRight && (
                  <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {selectedId !== null && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2">
            <p className="font-serif-de text-xl font-bold text-slate-900 dark:text-slate-100">
              {current.entry.germanWord} — {current.entry.englishMeaning}
            </p>
            <p className="font-serif-de text-lg text-slate-800 dark:text-slate-200">
              {current.entry.germanSentence}
            </p>
            <p className="text-base text-slate-600 dark:text-slate-400">
              {current.entry.englishSentence}
            </p>
            <button
              type="button"
              onClick={handleNext}
              className="mt-2 rounded-lg bg-slate-900 dark:bg-slate-100 px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-900 cursor-pointer"
            >
              {idx + 1 >= questions.length ? 'Finish Exercise' : 'Next Question'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
