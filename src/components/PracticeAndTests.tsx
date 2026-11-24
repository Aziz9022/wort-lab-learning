import React, { useState } from 'react';
import { Headphones, Layers, PenLine } from 'lucide-react';
import { ListeningPractice } from './ListeningPractice';
import { PracticeCentre } from './PracticeCentre';
import { WrittenTest } from './WrittenTest';

type PracticeTab = 'written' | 'centre' | 'listening';

export const PracticeAndTests: React.FC = () => {
  const [tab, setTab] = useState<PracticeTab>('written');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-2 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setTab('written')}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'written'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PenLine className="w-4 h-4" />
            Written Translation Test
          </button>

          <button
            type="button"
            onClick={() => setTab('centre')}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'centre'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            Practice Centre (8 Activities)
          </button>

          <button
            type="button"
            onClick={() => setTab('listening')}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'listening'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Headphones className="w-4 h-4" />
            Listening Practice
          </button>
        </div>
      </div>

      {tab === 'written' && <WrittenTest />}
      {tab === 'centre' && <PracticeCentre />}
      {tab === 'listening' && <ListeningPractice />}
    </div>
  );
};
