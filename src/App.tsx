import React, { useRef, useState } from 'react';
import { FileText, Menu, SlidersHorizontal, X } from 'lucide-react';
import { LabProvider, useLab } from './context/LabContext';
import { Dashboard } from './components/Dashboard';
import { BookReader } from './components/BookReader';
import { VocabularyExplorer } from './components/VocabularyExplorer';
import { FlashcardRevision } from './components/FlashcardRevision';
import { PracticeAndTests } from './components/PracticeAndTests';
import { MyProgress } from './components/MyProgress';
import { VocabularyDetail } from './components/VocabularyDetail';
import { PreferencesModal } from './components/PreferencesModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import type { AppSection } from './types';

const NAV_ITEMS: Array<{ id: AppSection; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'reader', label: 'Book Reader' },
  { id: 'explorer', label: 'Vocabulary' },
  { id: 'revision', label: 'Revision' },
  { id: 'practice', label: 'Practice & Tests' },
  { id: 'progress', label: 'My Progress' },
];

const LabShell: React.FC = () => {
  const { loading, book, importCustomTxt, activeSection, setActiveSection } = useLab();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fallbackTxtRef = useRef<HTMLInputElement>(null);

  const hasBook = Boolean(book && book.entries.length > 0);

  const handleNav = (id: AppSection) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
  };

  const handleFallbackTxt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importCustomTxt(text, file.name);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to parse TXT file.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Three-Zone Single-Row Top Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleNav('dashboard')}
            className="font-serif-de text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            WortLabor
          </button>

          {/* Zone 2: Clean Single-Line Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-scale-control font-medium">
            {NAV_ITEMS.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-blue-600 text-blue-700 dark:text-blue-400 font-semibold'
                      : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Utility Action + Mobile Drawer Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => setPrefsOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Preferences</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Navigation Drawer */}
        {mobileMenuOpen && (
          <nav className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {NAV_ITEMS.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Loading your German vocabulary book...
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Indexing entries into local storage for offline study.
            </p>
          </div>
        ) : !hasBook ? (
          <div className="max-w-xl mx-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 space-y-4">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Import Your German Vocabulary Book (.txt)
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select your local <code>.txt</code> book file to store and index all vocabulary
              entries privately in your browser (IndexedDB). Your book never leaves your device.
            </p>
            {importError && (
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                {importError}
              </p>
            )}
            <button
              type="button"
              onClick={() => fallbackTxtRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              Select TXT Book File
            </button>
            <input
              ref={fallbackTxtRef}
              type="file"
              accept=".txt,text/plain"
              onChange={handleFallbackTxt}
              className="hidden"
            />
          </div>
        ) : (
          <>
            {activeSection === 'dashboard' && <Dashboard />}
            {activeSection === 'reader' && <BookReader />}
            {activeSection === 'explorer' && <VocabularyExplorer />}
            {activeSection === 'revision' && <FlashcardRevision />}
            {activeSection === 'practice' && <PracticeAndTests />}
            {activeSection === 'progress' && <MyProgress />}
          </>
        )}
      </main>

      <VocabularyDetail />
      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <LabProvider>
      <LabShell />
    </LabProvider>
  );
}
