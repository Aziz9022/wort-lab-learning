import type {
  BookLine,
  BookSection,
  CategoryName,
  InspectionReport,
  ParsedBook,
  SubcategoryName,
  VocabEntry,
} from '../types';

const MAIN_CATEGORIES = new Set<CategoryName>([
  'NOUNS',
  'ADJECTIVES',
  'VERBS',
  'COMPOUND WORDS',
]);

const SUB_CATEGORIES = new Set<SubcategoryName>(['THINGS', 'PLACES', 'PEOPLE']);

const GRAMMAR_TAG_REGEX =
  /^(male|female|neutral|masculine|feminine|neuter|m|f|n|masc\.|fem\.|neut\.|plural|pl|pl\.|m pl|pl n|f, pl|n, pl|pl, n|pl\., fem\.|pl\., n|plural, male|plural, female|plural, neutral|plural, masculine|plural, feminine|plural, neuter|plural, no gender)$/i;

const KNOWN_ENGLISH_LEFT_SWAPS = new Set([
  'airy-fairy',
  'bonkers',
  'cold',
  'cool',
  'cute',
  'cutesy',
  'dainty',
  'fresh',
  'hot',
  'moldy',
  'spicy',
]);

export function parseBookTxt(rawText: string, fileName = 'German_Vocabul_4275d79f.txt'): ParsedBook {
  const rawLines = rawText.split(/\r?\n/);
  const totalBytes = new Blob([rawText]).size;

  const sections: BookSection[] = [];
  const entries: VocabEntry[] = [];
  const lines: BookLine[] = rawLines.map((raw, idx) => ({
    lineNumber: idx + 1,
    text: raw.trim(),
    raw,
    kind: raw.trim() === '' ? 'blank' : 'prose',
  }));

  // Track intro section up to first main category
  let firstHeadingLine = rawLines.length;
  for (let i = 0; i < rawLines.length; i++) {
    if (MAIN_CATEGORIES.has(rawLines[i].trim() as CategoryName)) {
      firstHeadingLine = i + 1;
      break;
    }
  }

  if (firstHeadingLine > 1) {
    sections.push({
      id: 'section-intro',
      title: 'How This Book is Formatted',
      category: 'INTRO',
      subcategory: null,
      startLine: 1,
      endLine: firstHeadingLine - 1,
      entryCount: 0,
    });
  }

  let currentCategory: CategoryName = 'NOUNS';
  let currentSubcategory: SubcategoryName | null = null;
  let currentSection: BookSection | null = null;

  interface NonEmptyItem {
    lineNumber: number;
    text: string;
  }

  let curGroup: NonEmptyItem[] = [];
  const unparsedBlocks: Array<{ startLine: number; lines: string[] }> = [];
  const flaggedSourceEntries: InspectionReport['flaggedSourceEntries'] = [];
  const categoryCounts: Record<string, number> = {};
  const baseWordCounts = new Map<string, number>();

  const flushSection = (endLine: number) => {
    if (currentSection) {
      currentSection.endLine = endLine;
      sections.push(currentSection);
      currentSection = null;
    }
  };

  const flushGroup = () => {
    if (curGroup.length === 0) return;

    if (curGroup.length !== 3) {
      unparsedBlocks.push({
        startLine: curGroup[0].lineNumber,
        lines: curGroup.map((g) => g.text),
      });
      curGroup = [];
      return;
    }

    const [hItem, deItem, enItem] = curGroup;
    const headerSep = hItem.text.match(/^(.+?)\s+[-–]\s+(.+)$/);

    if (!headerSep) {
      unparsedBlocks.push({
        startLine: hItem.lineNumber,
        lines: curGroup.map((g) => g.text),
      });
      curGroup = [];
      return;
    }

    const germanRaw = headerSep[1].trim();
    const englishMeaning = headerSep[2].trim();
    let germanWord = germanRaw;
    let grammarTag: string | null = null;

    const parenMatch = germanRaw.match(/\(([^)]+)\)\s*$/);
    if (parenMatch && GRAMMAR_TAG_REGEX.test(parenMatch[1].trim())) {
      grammarTag = parenMatch[1].trim();
      germanWord = germanRaw.replace(/\s*\([^)]+\)\s*$/, '').trim();
    }

    const germanSentence = deItem.text;
    const englishSentence = enItem.text;

    const orderIndex = entries.length + 1;
    const id = `entry-${String(orderIndex).padStart(4, '0')}`;
    const sectionLabel = currentSubcategory
      ? `${currentCategory} · ${currentSubcategory}`
      : currentCategory;

    // Flag genuine source quirks without altering original text
    const anomalies: string[] = [];
    if (germanSentence.endsWith(' -') || germanSentence.endsWith('-')) {
      anomalies.push('Source German sentence ends with a stray hyphen.');
    }
    if (/\s[a-z]\s/.test(englishSentence) && englishSentence.includes(' b ')) {
      anomalies.push('Original source text contains an isolated "b" typo.');
    }
    if (englishSentence.includes('Declaration of was')) {
      anomalies.push('Original source sentence omits a word ("Declaration of was").');
    }
    if (KNOWN_ENGLISH_LEFT_SWAPS.has(germanWord.toLowerCase())) {
      anomalies.push('Source entry lists English term on the left side.');
    }

    const sourceAnomaly = anomalies.length > 0 ? anomalies.join(' ') : null;
    if (sourceAnomaly) {
      flaggedSourceEntries.push({
        entryId: id,
        line: hItem.lineNumber,
        germanWord,
        reason: sourceAnomaly,
      });
    }

    const entry: VocabEntry = {
      id,
      orderIndex,
      category: currentCategory,
      subcategory: currentSubcategory,
      sectionLabel,
      germanRaw,
      germanWord,
      grammarTag,
      englishMeaning,
      germanSentence,
      englishSentence,
      sourceLineStart: hItem.lineNumber,
      sourceLineEnd: enItem.lineNumber,
      sourceAnomaly,
    };

    entries.push(entry);

    // Annotate book lines for reader linking & highlighting
    lines[hItem.lineNumber - 1].kind = 'entry_header';
    lines[hItem.lineNumber - 1].entryId = id;
    lines[deItem.lineNumber - 1].kind = 'entry_de';
    lines[deItem.lineNumber - 1].entryId = id;
    lines[enItem.lineNumber - 1].kind = 'entry_en';
    lines[enItem.lineNumber - 1].entryId = id;

    categoryCounts[sectionLabel] = (categoryCounts[sectionLabel] || 0) + 1;
    const baseKey = germanWord.toLowerCase();
    baseWordCounts.set(baseKey, (baseWordCounts.get(baseKey) || 0) + 1);

    if (currentSection) {
      currentSection.entryCount += 1;
    }

    curGroup = [];
  };

  for (let i = firstHeadingLine - 1; i < rawLines.length; i++) {
    const lineNumber = i + 1;
    const trimmed = rawLines[i].trim();
    if (!trimmed) continue;

    if (MAIN_CATEGORIES.has(trimmed as CategoryName)) {
      flushGroup();
      flushSection(lineNumber - 1);
      currentCategory = trimmed as CategoryName;
      currentSubcategory = null;
      lines[i].kind = 'heading';

      // For NOUNS, the actual entries live under THINGS/PLACES/PEOPLE
      if (currentCategory !== 'NOUNS') {
        currentSection = {
          id: `section-${currentCategory.toLowerCase().replace(/\s+/g, '-')}`,
          title: currentCategory,
          category: currentCategory,
          subcategory: null,
          startLine: lineNumber,
          endLine: rawLines.length,
          entryCount: 0,
        };
      } else {
        currentSection = {
          id: 'section-nouns',
          title: 'NOUNS',
          category: 'NOUNS',
          subcategory: null,
          startLine: lineNumber,
          endLine: lineNumber,
          entryCount: 0,
        };
      }
      continue;
    }

    if (SUB_CATEGORIES.has(trimmed as SubcategoryName)) {
      flushGroup();
      flushSection(lineNumber - 1);
      currentSubcategory = trimmed as SubcategoryName;
      lines[i].kind = 'subheading';
      currentSection = {
        id: `section-${currentCategory.toLowerCase()}-${currentSubcategory.toLowerCase()}`,
        title: `${currentCategory} — ${currentSubcategory}`,
        category: currentCategory,
        subcategory: currentSubcategory,
        startLine: lineNumber,
        endLine: rawLines.length,
        entryCount: 0,
      };
      continue;
    }

    const prev = curGroup[curGroup.length - 1];
    if (prev && lineNumber - prev.lineNumber >= 3) {
      flushGroup();
    }
    curGroup.push({ lineNumber, text: trimmed });
  }

  flushGroup();
  flushSection(rawLines.length);

  let duplicateBaseWords = 0;
  baseWordCounts.forEach((count) => {
    if (count > 1) duplicateBaseWords += 1;
  });

  return {
    rawText,
    importedAt: Date.now(),
    fileName,
    sections,
    lines,
    entries,
    report: {
      totalLines: rawLines.length,
      totalBytes,
      totalEntries: entries.length,
      categoryCounts,
      duplicateBaseWords,
      flaggedSourceEntries,
      unparsedBlocks,
    },
  };
}

export function formatGrammarLabel(grammarTag: string | null): string | null {
  if (!grammarTag) return null;
  const t = grammarTag.toLowerCase().trim();
  if (t === 'm' || t === 'male' || t === 'masculine' || t === 'masc.') {
    return `${grammarTag} (der)`;
  }
  if (t === 'f' || t === 'female' || t === 'feminine' || t === 'fem.') {
    return `${grammarTag} (die)`;
  }
  if (t === 'n' || t === 'neutral' || t === 'neuter' || t === 'neut.') {
    return `${grammarTag} (das)`;
  }
  return grammarTag;
}
