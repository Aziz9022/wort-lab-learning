export type CategoryName = 'NOUNS' | 'ADJECTIVES' | 'VERBS' | 'COMPOUND WORDS';
export type SubcategoryName = 'THINGS' | 'PLACES' | 'PEOPLE';

export type LearningStatus = 'new' | 'learning' | 'needs_revision' | 'remembered';
export type FontScale = 'sm' | 'md' | 'lg' | 'xl';
export type ThemeMode = 'light' | 'dark';

export interface VocabEntry {
  id: string;
  orderIndex: number;
  category: CategoryName;
  subcategory: SubcategoryName | null;
  sectionLabel: string;
  germanRaw: string;
  germanWord: string;
  grammarTag: string | null;
  englishMeaning: string;
  germanSentence: string;
  englishSentence: string;
  sourceLineStart: number;
  sourceLineEnd: number;
  sourceAnomaly: string | null;
}

export interface BookSection {
  id: string;
  title: string;
  category: CategoryName | 'INTRO';
  subcategory: SubcategoryName | null;
  startLine: number;
  endLine: number;
  entryCount: number;
}

export interface BookLine {
  lineNumber: number;
  text: string;
  raw: string;
  kind: 'blank' | 'heading' | 'subheading' | 'prose' | 'entry_header' | 'entry_de' | 'entry_en';
  entryId?: string;
}

export interface InspectionReport {
  totalLines: number;
  totalBytes: number;
  totalEntries: number;
  categoryCounts: Record<string, number>;
  duplicateBaseWords: number;
  flaggedSourceEntries: Array<{
    entryId: string;
    line: number;
    germanWord: string;
    reason: string;
  }>;
  unparsedBlocks: Array<{
    startLine: number;
    lines: string[];
  }>;
}

export interface ParsedBook {
  rawText: string;
  importedAt: number;
  fileName: string;
  sections: BookSection[];
  lines: BookLine[];
  entries: VocabEntry[];
  report: InspectionReport;
}

export interface EntryProgress {
  entryId: string;
  status: LearningStatus;
  viewedAt: number | null;
  firstStudiedAt: number | null;
  lastReviewedAt: number | null;
  nextReviewAt: number | null;
  intervalDays: number;
  easeFactor: number;
  correctCount: number;
  incorrectCount: number;
  reviewCount: number;
  difficult: boolean;
  bookmarked: boolean;
  savedSentence: boolean;
  note: string;
  groups: string[];
}

export interface PersonalGroup {
  id: string;
  name: string;
  createdAt: number;
}

export interface WrittenTestQuestionResult {
  entryId: string;
  germanWord: string;
  germanSentence: string;
  expectedEnglish: string;
  userAnswer: string;
  outcome: 'correct' | 'partially_correct' | 'incorrect' | 'needs_manual_check';
  marks: number;
  feedback: string;
  missingKeywords: string[];
}

export interface WrittenTestRecord {
  id: string;
  date: number;
  configLabel: string;
  totalQuestions: number;
  correctCount: number;
  partialCount: number;
  incorrectCount: number;
  scorePercent: number;
  results: WrittenTestQuestionResult[];
}

export interface ListeningTestRecord {
  id: string;
  date: number;
  mode: 'word' | 'word_in_sentence' | 'sentence';
  categoryLabel: string;
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
}

export interface DailyReviewLog {
  dateKey: string; // YYYY-MM-DD
  reviewedCount: number;
  rememberedCount: number;
  againCount: number;
}

export interface ActiveFlashcardSession {
  deckKey: string;
  queueIds: string[];
  currentIndex: number;
  reviewedIds: string[];
  againIds: string[];
  rememberedIds: string[];
  updatedAt: number;
}

export interface UserSettings {
  theme: ThemeMode;
  fontScale: FontScale;
  readerTheme: ThemeMode;
  readerFontSize: number;
  readerBookmarkLine: number;
  readerMaxLineVisited: number;
  preferredVoiceURI: string;
  speechRate: number;
  dailyGoal: number;
  lastStudiedEntryId: string | null;
}

export type AppSection =
  | 'dashboard'
  | 'reader'
  | 'explorer'
  | 'revision'
  | 'practice'
  | 'progress';
