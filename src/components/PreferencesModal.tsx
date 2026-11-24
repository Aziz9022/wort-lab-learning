import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileText,
  Moon,
  RefreshCw,
  Sun,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import type { BackupPayload } from '../lib/db';
import type { FontScale } from '../types';

interface PreferencesModalProps {
  open: boolean;
  onClose: () => void;
}

const FONT_SCALES: Array<{ id: FontScale; label: string }> = [
  { id: 'sm', label: 'Small' },
  { id: 'md', label: 'Medium' },
  { id: 'lg', label: 'Large' },
  { id: 'xl', label: 'Extra Large' },
];

export const PreferencesModal: React.FC<PreferencesModalProps> = ({ open, onClose }) => {
  const {
    book,
    settings,
    updateSettings,
    speech,
    exportBackup,
    importBackup,
    importCustomTxt,
  } = useLab();

  const backupInputRef = useRef<HTMLInputElement>(null);
  const txtInputRef = useRef<HTMLInputElement>(null);

  const [pendingBackup, setPendingBackup] = useState<BackupPayload | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showInspection, setShowInspection] = useState(false);

  if (!open) return null;

  const handleExportJson = () => {
    const payload = exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wortlabor-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Backup JSON downloaded.');
    setErrorMessage(null);
  };

  const handleBackupFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupPayload;
      if (!parsed || !Array.isArray(parsed.progress)) {
        throw new Error('This file does not look like a valid WortLabor backup JSON.');
      }
      setPendingBackup(parsed);
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid backup file.');
    } finally {
      e.target.value = '';
    }
  };

  const confirmBackupImport = async (mode: 'merge' | 'replace') => {
    if (!pendingBackup) return;
    await importBackup(pendingBackup, mode);
    setPendingBackup(null);
    setStatusMessage(
      mode === 'merge'
        ? 'Backup merged safely with your existing learning progress.'
        : 'Learning progress restored from backup.'
    );
  };

  const handleTxtFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = await importCustomTxt(text, file.name);
      setStatusMessage(
        `Imported "${file.name}" (${parsed.entries.length} vocabulary entries, ${parsed.report.unparsedBlocks.length} unparsed blocks).`
      );
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to parse TXT file.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preferences-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <h2 id="preferences-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Preferences, Voice & Data Backup
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Close preferences"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-8">
          {/* Display & Typography */}
          <section className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Appearance & Global Typography
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="block text-sm text-slate-600 dark:text-slate-400">Theme</span>
                <div className="flex items-center gap-2 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => updateSettings({ theme: 'light' })}
                    className={`flex-1 inline-flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors cursor-pointer ${
                      settings.theme === 'light'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ theme: 'dark' })}
                    className={`flex-1 inline-flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors cursor-pointer ${
                      settings.theme === 'dark'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    Dark
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="daily-goal-select"
                  className="block text-sm text-slate-600 dark:text-slate-400"
                >
                  Daily study goal (words)
                </label>
                <select
                  id="daily-goal-select"
                  value={settings.dailyGoal}
                  onChange={(e) => updateSettings({ dailyGoal: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value={10}>10 words / day</option>
                  <option value={20}>20 words / day</option>
                  <option value={30}>30 words / day</option>
                  <option value={50}>50 words / day</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-sm text-slate-600 dark:text-slate-400">
                Global font size
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FONT_SCALES.map((fs) => (
                  <button
                    key={fs.id}
                    type="button"
                    onClick={() => updateSettings({ fontScale: fs.id })}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                      settings.fontScale === fs.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {fs.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* German Text-to-Speech Voice */}
          <section className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                German Pronunciation (Device SpeechSynthesis)
              </h3>
              <button
                type="button"
                onClick={speech.refreshVoices}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Voices
              </button>
            </div>

            {!speech.hasGermanVoice ? (
              <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-900 dark:text-amber-200 space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>No German (de-DE) system voice detected</span>
                </div>
                <p>
                  WortLabor never substitutes an English voice for German pronunciation. Install a
                  German voice pack in your operating system or Android Text-to-Speech settings,
                  then click Refresh Voices.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="german-voice-select"
                    className="block text-sm text-slate-600 dark:text-slate-400"
                  >
                    Available German voices ({speech.germanVoices.length} detected)
                  </label>
                  <select
                    id="german-voice-select"
                    value={settings.preferredVoiceURI || speech.germanVoices[0]?.voiceURI || ''}
                    onChange={(e) => updateSettings({ preferredVoiceURI: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {speech.germanVoices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang}) {v.localService ? '· Offline' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex-1 min-w-[200px] space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <label htmlFor="speech-rate-range" className="text-slate-600 dark:text-slate-400">
                        Default playback speed
                      </label>
                      <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                        {settings.speechRate.toFixed(2)}×
                      </span>
                    </div>
                    <input
                      id="speech-rate-range"
                      type="range"
                      min={0.5}
                      max={1.25}
                      step={0.05}
                      value={settings.speechRate}
                      onChange={(e) => updateSettings({ speechRate: Number(e.target.value) })}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => speech.speak('Ich gehe gerne allein spazieren.')}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 px-3.5 py-2 text-sm font-medium text-blue-800 dark:text-blue-200 hover:bg-blue-100 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                    Test German Voice
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Backup, Restore & Source TXT */}
          <section className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Backup, Restore & Book Source
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-medium text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export Progress Backup (JSON)
              </button>

              <button
                type="button"
                onClick={() => backupInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Restore Backup (JSON)
              </button>
              <input
                ref={backupInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleBackupFileChosen}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => txtInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                Import Local TXT Book
              </button>
              <input
                ref={txtInputRef}
                type="file"
                accept=".txt,text/plain"
                onChange={handleTxtFileChosen}
                className="hidden"
              />
            </div>

            {pendingBackup && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-4 space-y-3 text-sm">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  Backup ready: {pendingBackup.progress.length} vocabulary records,{' '}
                  {pendingBackup.tests?.length ?? 0} written tests,{' '}
                  {pendingBackup.groups?.length ?? 0} personal groups.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => confirmBackupImport('merge')}
                    className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
                  >
                    Merge with Current Data (Safer)
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmBackupImport('replace')}
                    className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-3.5 py-1.5 text-sm font-medium text-red-800 dark:text-red-200 hover:bg-red-100 cursor-pointer"
                  >
                    Replace All Progress
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingBackup(null)}
                    className="rounded-lg px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {statusMessage && (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {statusMessage}
              </p>
            )}
            {errorMessage && (
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{errorMessage}</p>
            )}

            {book && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowInspection((v) => !v)}
                  className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {showInspection ? 'Hide Source Inspection Report' : 'View Source Inspection Report'}
                </button>
                {showInspection && (
                  <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-sm space-y-2">
                    <div className="font-mono-num text-slate-700 dark:text-slate-300">
                      File: {book.fileName} · {book.report.totalLines.toLocaleString()} lines ·{' '}
                      {book.report.totalEntries.toLocaleString()} entries ·{' '}
                      {book.report.unparsedBlocks.length} unparsed blocks ·{' '}
                      {book.report.duplicateBaseWords} repeated base words preserved
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono-num text-xs text-slate-600 dark:text-slate-400">
                      {Object.entries(book.report.categoryCounts).map(([cat, count]) => (
                        <div key={cat}>
                          {cat}: <strong className="text-slate-900 dark:text-slate-100">{count}</strong>
                        </div>
                      ))}
                    </div>
                    {book.report.flaggedSourceEntries.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                        <p className="font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Source anomalies preserved verbatim ({book.report.flaggedSourceEntries.length}):
                        </p>
                        <ul className="max-h-36 overflow-y-auto space-y-1 text-xs text-slate-600 dark:text-slate-400">
                          {book.report.flaggedSourceEntries.map((f) => (
                            <li key={f.entryId}>
                              Line {f.line} ({f.germanWord}): {f.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
