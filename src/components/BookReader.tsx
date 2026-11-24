import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Moon,
  Search,
  Sun,
  Volume2,
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import type { BookLine } from '../types';

const LINES_PER_PAGE = 220;

export const BookReader: React.FC = () => {
  const {
    book,
    entriesById,
    progressMap,
    settings,
    updateSettings,
    openEntryDetail,
    speech,
    readerTargetLine,
    clearReaderTargetLine,
  } = useLab();

  const [activeSectionId, setActiveSectionId] = useState<string>('section-intro');
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);

  const sections = book?.sections ?? [];
  const currentSection =
    sections.find((s) => s.id === activeSectionId) ?? sections[0];

  // Jump to a requested line from Vocabulary Detail
  useEffect(() => {
    if (!readerTargetLine || !book) return;
    const sec =
      book.sections.find(
        (s) => readerTargetLine >= s.startLine && readerTargetLine <= s.endLine
      ) ?? book.sections[0];
    if (sec) {
      setActiveSectionId(sec.id);
      const offsetInSec = Math.max(0, readerTargetLine - sec.startLine);
      setPageIndex(Math.floor(offsetInSec / LINES_PER_PAGE));
      const lineObj = book.lines[readerTargetLine - 1];
      if (lineObj?.entryId) setHighlightedEntryId(lineObj.entryId);
    }
    clearReaderTargetLine();
  }, [readerTargetLine, book, clearReaderTargetLine]);

  // Extract lines belonging to the active section
  const sectionLines = useMemo(() => {
    if (!book || !currentSection) return [];
    return book.lines.slice(currentSection.startLine - 1, currentSection.endLine);
  }, [book, currentSection]);

  const totalPages = Math.max(1, Math.ceil(sectionLines.length / LINES_PER_PAGE));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);

  const visibleLines = useMemo(() => {
    const start = safePageIndex * LINES_PER_PAGE;
    return sectionLines.slice(start, start + LINES_PER_PAGE);
  }, [sectionLines, safePageIndex]);

  // Track reading progress automatically
  useEffect(() => {
    if (!book || visibleLines.length === 0) return;
    const maxVisible = visibleLines[visibleLines.length - 1].lineNumber;
    if (maxVisible > settings.readerMaxLineVisited) {
      updateSettings({ readerMaxLineVisited: maxVisible });
    }
  }, [visibleLines, book, settings.readerMaxLineVisited, updateSettings]);

  // Global in-book search
  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !book || q.length < 2) return [];
    const results: BookLine[] = [];
    for (const line of book.lines) {
      if (line.text && line.text.toLowerCase().includes(q)) {
        results.push(line);
        if (results.length >= 250) break;
      }
    }
    return results;
  }, [searchQuery, book]);

  const jumpToLine = (lineNumber: number) => {
    if (!book) return;
    const sec =
      book.sections.find((s) => lineNumber >= s.startLine && lineNumber <= s.endLine) ??
      book.sections[0];
    if (sec) {
      setActiveSectionId(sec.id);
      const offset = Math.max(0, lineNumber - sec.startLine);
      setPageIndex(Math.floor(offset / LINES_PER_PAGE));
      const lineObj = book.lines[lineNumber - 1];
      if (lineObj?.entryId) setHighlightedEntryId(lineObj.entryId);
    }
  };

  const handleSelectSection = (secId: string) => {
    setActiveSectionId(secId);
    setPageIndex(0);
    setHighlightedEntryId(null);
  };

  const handleBookmarkHere = () => {
    const lineNum = visibleLines[0]?.lineNumber ?? currentSection?.startLine ?? 1;
    updateSettings({ readerBookmarkLine: lineNum });
  };

  if (!book) return null;

  const readingProgressPercent = Math.min(
    100,
    Math.round((settings.readerMaxLineVisited / Math.max(1, book.lines.length)) * 100)
  );

  const isReaderDark = settings.readerTheme === 'dark';

  // Group visibleLines into coherent visual items (entry triplets vs headings vs prose) while preserving exact order & blanks
  const renderedBlocks = useMemo(() => {
    const blocks: Array<
      | { type: 'heading'; line: BookLine }
      | { type: 'subheading'; line: BookLine }
      | { type: 'prose'; line: BookLine }
      | { type: 'entry'; lines: BookLine[]; entryId: string }
    > = [];

    let i = 0;
    while (i < visibleLines.length) {
      const l = visibleLines[i];
      if (l.kind === 'blank') {
        i += 1;
        continue;
      }
      if (l.kind === 'heading') {
        blocks.push({ type: 'heading', line: l });
        i += 1;
        continue;
      }
      if (l.kind === 'subheading') {
        blocks.push({ type: 'subheading', line: l });
        i += 1;
        continue;
      }
      if (l.entryId) {
        const eid = l.entryId;
        const grouped: BookLine[] = [l];
        let j = i + 1;
        while (j < visibleLines.length && (visibleLines[j].entryId === eid || visibleLines[j].kind === 'blank')) {
          if (visibleLines[j].entryId === eid) grouped.push(visibleLines[j]);
          else if (
            j + 1 < visibleLines.length &&
            visibleLines[j + 1].entryId !== eid
          ) {
            break;
          }
          j += 1;
        }
        blocks.push({ type: 'entry', lines: grouped, entryId: eid });
        i = j;
        continue;
      }
      blocks.push({ type: 'prose', line: l });
      i += 1;
    }
    return blocks;
  }, [visibleLines]);

  return (
    <div className="space-y-6">
      {/* Reader Header & Controls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-scale-heading font-bold text-slate-900 dark:text-slate-100">
              Original Book Reader
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-mono-num">
              {book.fileName} · {book.report.totalLines.toLocaleString()} lines · Reading progress:{' '}
              {readingProgressPercent}%
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Independent Reader Font Size */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5">
              <label
                htmlFor="reader-font-range"
                className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap"
              >
                Reader text: {settings.readerFontSize}px
              </label>
              <input
                id="reader-font-range"
                type="range"
                min={16}
                max={30}
                step={1}
                value={settings.readerFontSize}
                onChange={(e) => updateSettings({ readerFontSize: Number(e.target.value) })}
                className="w-24 accent-blue-600"
              />
            </div>

            {/* Independent Reader Theme */}
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  readerTheme: isReaderDark ? 'light' : 'dark',
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {isReaderDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {isReaderDark ? 'Light Paper' : 'Dark Paper'}
            </button>

            <button
              type="button"
              onClick={handleBookmarkHere}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Bookmark className="w-4 h-4 text-blue-600" />
              Bookmark Line {visibleLines[0]?.lineNumber ?? 1}
            </button>

            {settings.readerBookmarkLine > 1 && (
              <button
                type="button"
                onClick={() => jumpToLine(settings.readerBookmarkLine)}
                className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Go to bookmark (L{settings.readerBookmarkLine})
              </button>
            )}
          </div>
        </div>

        {/* In-Book Search */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveMatchIdx(0);
              }}
              placeholder="Search original book text (German or English)..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {searchQuery.trim().length >= 2 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono-num text-slate-600 dark:text-slate-400">
                {searchMatches.length === 0
                  ? '0 matches'
                  : `${activeMatchIdx + 1} / ${searchMatches.length}`}
              </span>
              {searchMatches.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const next =
                        (activeMatchIdx - 1 + searchMatches.length) % searchMatches.length;
                      setActiveMatchIdx(next);
                      jumpToLine(searchMatches[next].lineNumber);
                    }}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = (activeMatchIdx + 1) % searchMatches.length;
                      setActiveMatchIdx(next);
                      jumpToLine(searchMatches[next].lineNumber);
                    }}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Next
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Reader Grid: Section Navigation + Book Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Section Navigation */}
        <aside className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2 lg:sticky lg:top-20">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 px-2 pb-1">
            Original Book Sections
          </h2>
          <nav className="space-y-1">
            {sections.map((sec) => {
              const active = sec.id === currentSection?.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => handleSelectSection(sec.id)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{sec.title}</span>
                  {sec.entryCount > 0 && (
                    <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400 shrink-0">
                      {sec.entryCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Reader Paper Surface */}
        <div
          className={`lg:col-span-9 rounded-xl border p-6 sm:p-10 space-y-6 transition-colors ${
            isReaderDark
              ? 'border-slate-800 bg-slate-950 text-slate-100'
              : 'border-slate-200 bg-white text-slate-900'
          }`}
        >
          {/* Section & Page Controls */}
          <div
            className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b ${
              isReaderDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <div>
              <h2 className="text-xl font-bold">{currentSection?.title}</h2>
              <p
                className={`text-xs font-mono-num ${
                  isReaderDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Lines {visibleLines[0]?.lineNumber ?? currentSection?.startLine}–
                {visibleLines[visibleLines.length - 1]?.lineNumber ?? currentSection?.endLine} · Page{' '}
                {safePageIndex + 1} of {totalPages}
              </p>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePageIndex === 0}
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40 cursor-pointer ${
                    isReaderDark
                      ? 'border-slate-700 hover:bg-slate-800'
                      : 'border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={safePageIndex >= totalPages - 1}
                  onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40 cursor-pointer ${
                    isReaderDark
                      ? 'border-slate-700 hover:bg-slate-800'
                      : 'border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Preserved Original Text */}
          <div
            className="space-y-6 leading-relaxed"
            style={{ fontSize: `${settings.readerFontSize}px` }}
          >
            {renderedBlocks.map((block, idx) => {
              if (block.type === 'heading') {
                return (
                  <h2
                    key={`h-${block.line.lineNumber}`}
                    className="font-bold tracking-tight pt-2 text-[1.45em]"
                  >
                    {block.line.text}
                  </h2>
                );
              }
              if (block.type === 'subheading') {
                return (
                  <h3
                    key={`sh-${block.line.lineNumber}`}
                    className={`font-semibold pt-2 text-[1.2em] ${
                      isReaderDark ? 'text-blue-300' : 'text-blue-800'
                    }`}
                  >
                    {block.line.text}
                  </h3>
                );
              }
              if (block.type === 'prose') {
                return (
                  <p
                    key={`p-${block.line.lineNumber}-${idx}`}
                    className={`max-w-[70ch] leading-[1.75] ${
                      isReaderDark ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    {block.line.text}
                  </p>
                );
              }

              // Vocabulary entry block
              const entry = entriesById.get(block.entryId);
              const isSelected = highlightedEntryId === block.entryId;
              const isBookmarked = progressMap.get(block.entryId)?.bookmarked;
              const matchesSearch =
                searchQuery.trim().length >= 2 &&
                block.lines.some((l) =>
                  l.text.toLowerCase().includes(searchQuery.trim().toLowerCase())
                );

              return (
                <div
                  key={block.entryId}
                  onClick={() => setHighlightedEntryId(block.entryId)}
                  className={`rounded-lg border p-4 sm:p-5 transition-colors ${
                    isSelected || matchesSearch
                      ? isReaderDark
                        ? 'border-blue-500 bg-blue-950/30'
                        : 'border-blue-400 bg-blue-50/70'
                      : isReaderDark
                      ? 'border-slate-800/80 hover:border-slate-700 bg-slate-900/40'
                      : 'border-slate-200/80 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2 flex-1 min-w-0">
                      {block.lines.map((line) => {
                        if (line.kind === 'entry_header') {
                          return (
                            <p
                              key={line.lineNumber}
                              className="font-serif-de font-bold text-[1.15em]"
                            >
                              {line.text}
                            </p>
                          );
                        }
                        if (line.kind === 'entry_de') {
                          return (
                            <p
                              key={line.lineNumber}
                              className={`font-serif-de ${
                                isReaderDark ? 'text-slate-100' : 'text-slate-900'
                              }`}
                            >
                              {line.text}
                            </p>
                          );
                        }
                        return (
                          <p
                            key={line.lineNumber}
                            className={`text-[0.92em] ${
                              isReaderDark ? 'text-slate-400' : 'text-slate-600'
                            }`}
                          >
                            {line.text}
                          </p>
                        );
                      })}
                    </div>

                    {entry && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            speech.speak(entry.germanWord);
                          }}
                          className={`rounded-lg border p-2 cursor-pointer ${
                            isReaderDark
                              ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                              : 'border-slate-300 text-slate-700 hover:bg-white'
                          }`}
                          title="Play German word"
                          aria-label={`Play ${entry.germanWord}`}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEntryDetail(entry.id);
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-medium cursor-pointer ${
                            isReaderDark
                              ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                              : 'border-slate-300 text-slate-700 hover:bg-white'
                          }`}
                          title="Open vocabulary detail"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Detail{isBookmarked ? ' · Saved' : ''}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Pagination */}
          {totalPages > 1 && (
            <div
              className={`flex items-center justify-between pt-4 border-t ${
                isReaderDark ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <button
                type="button"
                disabled={safePageIndex === 0}
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                className={`inline-flex items-center gap-1 rounded-lg border px-3.5 py-2 text-sm font-medium disabled:opacity-40 cursor-pointer ${
                  isReaderDark
                    ? 'border-slate-700 hover:bg-slate-800'
                    : 'border-slate-300 hover:bg-slate-100'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Page
              </button>
              <span className="font-mono-num text-sm">
                {safePageIndex + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePageIndex >= totalPages - 1}
                onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                className={`inline-flex items-center gap-1 rounded-lg border px-3.5 py-2 text-sm font-medium disabled:opacity-40 cursor-pointer ${
                  isReaderDark
                    ? 'border-slate-700 hover:bg-slate-800'
                    : 'border-slate-300 hover:bg-slate-100'
                }`}
              >
                Next Page
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
