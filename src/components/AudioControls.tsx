import React from 'react';
import { RotateCw, Square, Turtle, Volume2 } from 'lucide-react';
import { useLab } from '../context/LabContext';

interface AudioControlsProps {
  germanWord: string;
  germanSentence: string;
  compact?: boolean;
  hideWordButton?: boolean;
  hideSentenceButton?: boolean;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  germanWord,
  germanSentence,
  compact = false,
  hideWordButton = false,
  hideSentenceButton = false,
}) => {
  const { speech } = useLab();

  const btnBase = compact
    ? 'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer'
    : 'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-scale-control font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[42px]';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!hideWordButton && (
          <button
            type="button"
            onClick={() => speech.speak(germanWord)}
            className={`${btnBase} border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/70`}
            title="Play German word"
          >
            <Volume2 className="w-4 h-4 shrink-0" />
            <span>{compact ? 'Word' : 'Play Word'}</span>
          </button>
        )}

        {!hideSentenceButton && (
          <button
            type="button"
            onClick={() => speech.speak(germanSentence)}
            className={`${btnBase} border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700`}
            title="Play German example sentence"
          >
            <Volume2 className="w-4 h-4 shrink-0" />
            <span>{compact ? 'Sentence' : 'Play Sentence'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => speech.speakSlow(hideSentenceButton ? germanWord : germanSentence)}
          className={`${btnBase} border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700`}
          title="Play slowly (0.65x speed)"
        >
          <Turtle className="w-4 h-4 shrink-0" />
          <span>Slow</span>
        </button>

        {!compact && (
          <button
            type="button"
            onClick={() =>
              speech.speak(hideSentenceButton ? germanWord : germanSentence, { repeat: 2 })
            }
            className={`${btnBase} border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700`}
            title="Repeat twice"
          >
            <RotateCw className="w-4 h-4 shrink-0" />
            <span>Repeat 2×</span>
          </button>
        )}

        {speech.isSpeaking && (
          <button
            type="button"
            onClick={speech.stop}
            className={`${btnBase} border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60`}
            title="Stop audio playback"
          >
            <Square className="w-3.5 h-3.5 shrink-0 fill-current" />
            <span>Stop</span>
          </button>
        )}
      </div>

      {speech.voiceError && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3 py-2 text-sm text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3"
        >
          <span>{speech.voiceError}</span>
          <button
            type="button"
            onClick={speech.clearVoiceError}
            className="text-xs font-semibold underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
