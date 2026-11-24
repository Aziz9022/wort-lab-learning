import React, { useMemo, useState } from 'react';
import { CheckCircle2, HelpCircle, Layers, RotateCcw, XCircle } from 'lucide-react';
import { useLab } from '../context/LabContext';
import { evaluateEnglishTranslation } from '../lib/evaluator';
import type { CategoryName, VocabEntry, WrittenTestQuestionResult, WrittenTestRecord } from '../types';
import { AudioControls } from './AudioControls';

type TestSourceMode =
  | 'MIXED'
  | 'NOUNS'
  | 'ADJECTIVES'
  | 'VERBS'
  | 'COMPOUND WORDS'
  | 'DIFFICULT'
  | 'INCORRECT'
  | 'RANDOM';

function pickUniqueQuestions(pool: VocabEntry[], count: number): VocabEntry[] {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  // Avoid repeating identical German words within one test
  const seenWords = new Set<string>();
  const picked: VocabEntry[] = [];
  for (const e of copy) {
    const key = e.germanWord.toLowerCase();
    if (!seenWords.has(key)) {
      seenWords.add(key);
      picked.push(e);
      if (picked.length >= count) break;
    }
  }
  return picked;
}

export const WrittenTest: React.FC = () => {
  const {
    book,
    progressMap,
    recordReview,
    saveWrittenTest,
    setActiveSection,
  } = useLab();

  const [questionCountChoice, setQuestionCountChoice] = useState<'10' | '20' | '30' | 'custom'>('10');
  const [customCount, setCustomCount] = useState<number>(15);
  const [sourceMode, setSourceMode] = useState<TestSourceMode>('MIXED');

  const [questions, setQuestions] = useState<VocabEntry[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerInput, setAnswerInput] = useState('');
  const [submittedResult, setSubmittedResult] = useState<WrittenTestQuestionResult | null>(null);
  const [results, setResults] = useState<WrittenTestQuestionResult[]>([]);
  const [finishedRecord, setFinishedRecord] = useState<WrittenTestRecord | null>(null);

  const pool = useMemo(() => {
    const all = book?.entries ?? [];
    if (sourceMode === 'DIFFICULT') {
      return all.filter((e) => progressMap.get(e.id)?.difficult);
    }
    if (sourceMode === 'INCORRECT') {
      return all.filter((e) => {
        const p = progressMap.get(e.id);
        return p && (p.incorrectCount > 0 || p.status === 'needs_revision');
      });
    }
    if (
      sourceMode === 'NOUNS' ||
      sourceMode === 'ADJECTIVES' ||
      sourceMode === 'VERBS' ||
      sourceMode === 'COMPOUND WORDS'
    ) {
      return all.filter((e) => e.category === (sourceMode as CategoryName));
    }
    return all;
  }, [book, progressMap, sourceMode]);

  const targetCount =
    questionCountChoice === 'custom'
      ? Math.max(1, Math.min(100, customCount))
      : Number(questionCountChoice);

  const startTest = () => {
    const picked = pickUniqueQuestions(pool, targetCount);
    if (picked.length === 0) return;
    setQuestions(picked);
    setCurrentIndex(0);
    setAnswerInput('');
    setSubmittedResult(null);
    setResults([]);
    setFinishedRecord(null);
  };

  const currentQuestion = questions ? questions[currentIndex] : undefined;

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuestion || submittedResult) return;

    const evalRes = evaluateEnglishTranslation(
      answerInput,
      currentQuestion.englishSentence,
      currentQuestion.englishMeaning
    );

    const qRes: WrittenTestQuestionResult = {
      entryId: currentQuestion.id,
      germanWord: currentQuestion.germanWord,
      germanSentence: currentQuestion.germanSentence,
      expectedEnglish: currentQuestion.englishSentence,
      userAnswer: answerInput.trim(),
      outcome: evalRes.outcome,
      marks: evalRes.marks,
      feedback: evalRes.feedback,
      missingKeywords: evalRes.missingKeywords,
    };

    setSubmittedResult(qRes);

    // Automatically log SRS outcome (manual check is deferred until user confirms or moves on)
    if (evalRes.outcome === 'correct') {
      await recordReview(currentQuestion.id, 'remembered');
    } else if (evalRes.outcome === 'partially_correct') {
      await recordReview(currentQuestion.id, 'partial');
    } else if (evalRes.outcome === 'incorrect') {
      await recordReview(currentQuestion.id, 'again');
    }
  };

  const handleManualOverride = async (
    chosen: 'correct' | 'partially_correct' | 'incorrect'
  ) => {
    if (!submittedResult || !currentQuestion) return;
    const marks = chosen === 'correct' ? 1 : chosen === 'partially_correct' ? 0.5 : 0;
    const updated: WrittenTestQuestionResult = {
      ...submittedResult,
      outcome: chosen,
      marks,
      feedback:
        chosen === 'correct'
          ? 'Confirmed correct by learner.'
          : chosen === 'partially_correct'
          ? 'Confirmed partially correct by learner.'
          : 'Marked incorrect for additional revision.',
    };
    setSubmittedResult(updated);

    if (chosen === 'correct') await recordReview(currentQuestion.id, 'remembered');
    else if (chosen === 'partially_correct') await recordReview(currentQuestion.id, 'partial');
    else await recordReview(currentQuestion.id, 'again');
  };

  const handleNextQuestion = async () => {
    if (!questions || !submittedResult) return;

    // If still needs_manual_check and user clicks next, record as partial
    if (submittedResult.outcome === 'needs_manual_check' && currentQuestion) {
      await recordReview(currentQuestion.id, 'partial');
    }

    const updatedResults = [...results, submittedResult];
    setResults(updatedResults);

    if (currentIndex + 1 >= questions.length) {
      const correctCount = updatedResults.filter((r) => r.outcome === 'correct').length;
      const partialCount = updatedResults.filter(
        (r) => r.outcome === 'partially_correct' || r.outcome === 'needs_manual_check'
      ).length;
      const incorrectCount = updatedResults.filter((r) => r.outcome === 'incorrect').length;
      const totalMarks = updatedResults.reduce((sum, r) => sum + r.marks, 0);
      const scorePercent = Math.round((totalMarks / updatedResults.length) * 100);

      const record: WrittenTestRecord = {
        id: `test-${Date.now()}`,
        date: Date.now(),
        configLabel: `${sourceMode} (${updatedResults.length} Q)`,
        totalQuestions: updatedResults.length,
        correctCount,
        partialCount,
        incorrectCount,
        scorePercent,
        results: updatedResults,
      };
      await saveWrittenTest(record);
      setFinishedRecord(record);
      setQuestions(null);
      setSubmittedResult(null);
    } else {
      setCurrentIndex((i) => i + 1);
      setAnswerInput('');
      setSubmittedResult(null);
    }
  };

  // Results Screen
  if (finishedRecord) {
    const missedWords = finishedRecord.results.filter(
      (r) => r.outcome === 'incorrect' || r.outcome === 'partially_correct'
    );

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <h2 className="text-scale-heading font-bold text-slate-900 dark:text-slate-100">
                Written Translation Test Results
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {finishedRecord.configLabel} · Saved to your test history
              </p>
            </div>
            <div className="font-mono-num text-4xl font-bold text-blue-700 dark:text-blue-400">
              {finishedRecord.scorePercent}%
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-xs text-slate-500">Total Questions</div>
              <div className="font-mono-num text-2xl font-bold">{finishedRecord.totalQuestions}</div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-xs text-emerald-700 dark:text-emerald-400">Correct</div>
              <div className="font-mono-num text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {finishedRecord.correctCount}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-xs text-amber-700 dark:text-amber-400">Partially Correct</div>
              <div className="font-mono-num text-2xl font-bold text-amber-700 dark:text-amber-400">
                {finishedRecord.partialCount}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-xs text-red-700 dark:text-red-400">Incorrect</div>
              <div className="font-mono-num text-2xl font-bold text-red-700 dark:text-red-400">
                {finishedRecord.incorrectCount}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setFinishedRecord(null)}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              Configure Another Test
            </button>
            {missedWords.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveSection('revision')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-base font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                Revise Missed Words ({missedWords.length})
              </button>
            )}
          </div>
        </div>

        {/* Individual Question Breakdown */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Question-by-Question Review
          </h3>
          {finishedRecord.results.map((r, i) => (
            <div
              key={`${r.entryId}-${i}`}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-serif-de text-xl font-bold text-slate-900 dark:text-slate-100">
                  {i + 1}. {r.germanWord}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    r.outcome === 'correct'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : r.outcome === 'incorrect'
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {r.outcome.replace(/_/g, ' ')} ({r.marks} mark{r.marks === 1 ? '' : 's'})
                </span>
              </div>
              <p className="font-serif-de text-lg text-slate-800 dark:text-slate-200">
                {r.germanSentence}
              </p>
              <div className="text-sm space-y-1 pt-1">
                <p>
                  <span className="text-slate-500 dark:text-slate-400">Your answer: </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {r.userAnswer || '(blank)'}
                  </span>
                </p>
                <p>
                  <span className="text-slate-500 dark:text-slate-400">
                    Original English translation:{' '}
                  </span>
                  <span className="font-semibold text-blue-800 dark:text-blue-300">
                    {r.expectedEnglish}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Configuration View
  if (!questions || !currentQuestion) {
    return (
      <div className="max-w-3xl mx-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-scale-heading font-bold text-slate-900 dark:text-slate-100">
            Written German-to-English Translation Test
          </h2>
          <p className="text-scale-body text-slate-600 dark:text-slate-400">
            Translate the complete German example sentence into English. Synonyms and minor
            punctuation or capitalization differences are accepted.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Number of questions
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['10', '10 Questions'],
                ['20', '20 Questions'],
                ['30', '30 Questions'],
                ['custom', 'Custom'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setQuestionCountChoice(val)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium cursor-pointer ${
                  questionCountChoice === val
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {questionCountChoice === 'custom' && (
            <div className="flex items-center gap-3 pt-1">
              <label htmlFor="custom-q-count" className="text-sm text-slate-600 dark:text-slate-400">
                Custom count (1–100):
              </label>
              <input
                id="custom-q-count"
                type="number"
                min={1}
                max={100}
                value={customCount}
                onChange={(e) => setCustomCount(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm"
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Vocabulary scope
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(
              [
                ['MIXED', 'Mixed Categories (All Book Words)'],
                ['NOUNS', 'Nouns Only'],
                ['ADJECTIVES', 'Adjectives Only'],
                ['VERBS', 'Verbs Only'],
                ['COMPOUND WORDS', 'Compound Words Only'],
                ['DIFFICULT', 'Difficult Words Only'],
                ['INCORRECT', 'Previously Incorrect Words'],
                ['RANDOM', 'Random Selection'],
              ] as Array<[TestSourceMode, string]>
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSourceMode(mode)}
                className={`rounded-lg border px-4 py-2.5 text-left text-sm font-medium cursor-pointer ${
                  sourceMode === mode
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
            Available matching words: {pool.length.toLocaleString()}
          </p>
        </div>

        <button
          type="button"
          disabled={pool.length === 0}
          onClick={startTest}
          className="rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
        >
          Start Written Test ({Math.min(targetCount, pool.length)} Questions)
        </button>
      </div>
    );
  }

  // Active Question View
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 font-mono-num">
        <span>
          Question {currentIndex + 1} of {questions.length} · {currentQuestion.sectionLabel}
        </span>
        <button
          type="button"
          onClick={() => setQuestions(null)}
          className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
        >
          Cancel Test
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">German word</p>
          <h2 className="font-serif-de font-bold text-scale-word text-slate-900 dark:text-slate-100">
            {currentQuestion.germanWord}
          </h2>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">German sentence</p>
          <p className="font-serif-de text-scale-sentence text-slate-900 dark:text-slate-100">
            {currentQuestion.germanSentence}
          </p>
        </div>

        <AudioControls
          germanWord={currentQuestion.germanWord}
          germanSentence={currentQuestion.germanSentence}
        />

        <form onSubmit={handleSubmitAnswer} className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
          <label
            htmlFor="written-translation-input"
            className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
          >
            Your English translation
          </label>
          <textarea
            id="written-translation-input"
            rows={3}
            disabled={submittedResult !== null}
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            placeholder="Write your English translation here."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-scale-translation text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-80"
          />

          {!submittedResult && (
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              Submit Answer
            </button>
          )}
        </form>

        {/* Post-Submission Feedback */}
        {submittedResult && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-base">
              {submittedResult.outcome === 'correct' && (
                <span className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Correct ({submittedResult.marks} mark)
                </span>
              )}
              {submittedResult.outcome === 'partially_correct' && (
                <span className="text-amber-700 dark:text-amber-400 inline-flex items-center gap-2">
                  <RotateCcw className="w-5 h-5" />
                  Partially Correct ({submittedResult.marks} mark)
                </span>
              )}
              {submittedResult.outcome === 'needs_manual_check' && (
                <span className="text-amber-700 dark:text-amber-400 inline-flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" />
                  Manual Check Recommended
                </span>
              )}
              {submittedResult.outcome === 'incorrect' && (
                <span className="text-red-700 dark:text-red-400 inline-flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Incorrect (0 marks)
                </span>
              )}
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-300">{submittedResult.feedback}</p>

            <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Original English translation (and book word meaning: {currentQuestion.englishMeaning})
              </p>
              <p className="text-scale-translation font-semibold text-slate-900 dark:text-slate-100">
                {submittedResult.expectedEnglish}
              </p>
              {submittedResult.missingKeywords.length > 0 && (
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Missing or differing key words: {submittedResult.missingKeywords.join(', ')}
                </p>
              )}
            </div>

            {submittedResult.outcome === 'needs_manual_check' && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Self-check your translation:
                </span>
                <button
                  type="button"
                  onClick={() => handleManualOverride('correct')}
                  className="rounded-lg border border-emerald-400 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                >
                  Mark Correct
                </button>
                <button
                  type="button"
                  onClick={() => handleManualOverride('partially_correct')}
                  className="rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 cursor-pointer"
                >
                  Mark Partial
                </button>
                <button
                  type="button"
                  onClick={() => handleManualOverride('incorrect')}
                  className="rounded-lg border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-800 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                >
                  Mark Incorrect
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleNextQuestion}
              className="rounded-lg bg-slate-900 dark:bg-slate-100 px-5 py-2.5 text-base font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 cursor-pointer"
            >
              {currentIndex + 1 >= questions.length ? 'Finish & View Score' : 'Next Question'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
