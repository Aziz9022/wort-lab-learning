import React from 'react';

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlights the target German word (or its stem if inflected) inside the German sentence.
 * Optionally masks the matched word when hideTarget is enabled for active recall.
 */
export function renderHighlightedSentence(
  sentence: string,
  targetWord: string,
  options: { hideTarget?: boolean } = {}
): React.ReactNode {
  const cleanTarget = targetWord
    .replace(/^sich\s+/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/-$/, '')
    .trim();

  if (!cleanTarget || cleanTarget.length < 2) {
    return sentence;
  }

  // Try full word match first, then German verb/adjective stem match
  const candidates: string[] = [cleanTarget];
  const lower = cleanTarget.toLowerCase();
  if (lower.endsWith('en') && cleanTarget.length > 4) {
    candidates.push(cleanTarget.slice(0, -2));
  } else if (lower.endsWith('n') && cleanTarget.length > 4) {
    candidates.push(cleanTarget.slice(0, -1));
  } else if (lower.endsWith('e') && cleanTarget.length > 3) {
    candidates.push(cleanTarget.slice(0, -1));
  }

  for (const cand of candidates) {
    if (cand.length < 2) continue;
    // Match word boundaries including German letters & compound prefixes/suffixes cleanly
    const regex = new RegExp(
      `([A-Za-zÄÖÜäöüß]*${escapeRegExp(cand)}[A-Za-zÄÖÜäöüß]*)`,
      'gi'
    );
    const parts = sentence.split(regex);
    if (parts.length > 1) {
      return parts.map((part, idx) => {
        if (idx % 2 === 1) {
          if (options.hideTarget) {
            return (
              <span
                key={idx}
                className="inline-block rounded bg-slate-200 dark:bg-slate-700 px-2.5 py-0.5 text-transparent select-none border border-dashed border-slate-400 dark:border-slate-500 mx-0.5"
                aria-label="Hidden German word"
              >
                {part}
              </span>
            );
          }
          return (
            <mark
              key={idx}
              className="rounded bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-100 px-1 py-0.5 font-semibold"
            >
              {part}
            </mark>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      });
    }
  }

  return sentence;
}
