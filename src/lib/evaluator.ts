export interface EvaluationResult {
  outcome: 'correct' | 'partially_correct' | 'incorrect' | 'needs_manual_check';
  marks: number;
  feedback: string;
  missingKeywords: string[];
}

const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bi'm\b/g, 'i am'],
  [/\byou're\b/g, 'you are'],
  [/\bhe's\b/g, 'he is'],
  [/\bshe's\b/g, 'she is'],
  [/\bit's\b/g, 'it is'],
  [/\bwe're\b/g, 'we are'],
  [/\bthey're\b/g, 'they are'],
  [/\bthat's\b/g, 'that is'],
  [/\bthere's\b/g, 'there is'],
  [/\bdon't\b/g, 'do not'],
  [/\bdoesn't\b/g, 'does not'],
  [/\bdidn't\b/g, 'did not'],
  [/\bcan't\b/g, 'cannot'],
  [/\bcannot\b/g, 'can not'],
  [/\bwon't\b/g, 'will not'],
  [/\bwouldn't\b/g, 'would not'],
  [/\bcouldn't\b/g, 'could not'],
  [/\bshouldn't\b/g, 'should not'],
  [/\bisn't\b/g, 'is not'],
  [/\baren't\b/g, 'are not'],
  [/\bwasn't\b/g, 'was not'],
  [/\bweren't\b/g, 'were not'],
  [/\bhaven't\b/g, 'have not'],
  [/\bhasn't\b/g, 'has not'],
  [/\blet's\b/g, 'let us'],
  [/\bi'll\b/g, 'i will'],
  [/\bi've\b/g, 'i have'],
  [/\bi'd\b/g, 'i would'],
];

const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by', 'from',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'that', 'this', 'these', 'those',
  'and', 'or', 'but', 'very', 'really', 'so', 'please', 'today',
]);

// Canonical English synonym equivalents for A1 translation fairness
const SYNONYM_GROUPS: string[][] = [
  ['like', 'enjoy', 'love', 'fond'],
  ['big', 'large', 'huge', 'great'],
  ['small', 'little', 'tiny'],
  ['fast', 'quick', 'rapid', 'swift'],
  ['slow', 'sluggish'],
  ['happy', 'glad', 'joyful', 'cheerful'],
  ['sad', 'unhappy', 'sorrowful'],
  ['angry', 'mad', 'furious'],
  ['afraid', 'scared', 'frightened', 'fearful'],
  ['sick', 'ill', 'unwell'],
  ['car', 'automobile', 'vehicle'],
  ['bicycle', 'bike'],
  ['movie', 'film', 'cinema'],
  ['shop', 'store'],
  ['pants', 'trousers'],
  ['coat', 'jacket'],
  ['couch', 'sofa'],
  ['bag', 'purse', 'handbag', 'sack'],
  ['gift', 'present'],
  ['garbage', 'trash', 'rubbish'],
  ['flat', 'apartment'],
  ['street', 'road'],
  ['train', 'rail'],
  ['begin', 'start'],
  ['finish', 'end', 'complete'],
  ['speak', 'talk'],
  ['look', 'watch', 'see'],
  ['buy', 'purchase'],
  ['walk', 'stroll'],
  ['phone', 'telephone', 'cellphone', 'mobile'],
  ['photo', 'picture', 'photograph'],
  ['smart', 'clever', 'intelligent'],
  ['dumb', 'stupid', 'silly'],
  ['quiet', 'silent', 'calm'],
  ['tasty', 'delicious', 'yummy'],
  ['cold', 'chilly'],
  ['warm', 'hot'],
  ['clean', 'tidy', 'neat'],
  ['dirty', 'messy'],
  ['easy', 'simple'],
  ['difficult', 'hard', 'tough'],
  ['help', 'assist'],
  ['answer', 'reply'],
  ['ask', 'question'],
  ['need', 'require'],
  ['want', 'wish', 'would like'],
  ['always', 'constantly'],
  ['often', 'frequently'],
  ['sometimes', 'occasionally'],
  ['usually', 'normally', 'generally'],
  ['colour', 'color'],
  ['favourite', 'favorite'],
  ['neighbour', 'neighbor'],
  ['flavour', 'flavor'],
  ['centre', 'center'],
  ['theatre', 'theater'],
  ['travelling', 'traveling'],
  ['aeroplane', 'airplane', 'plane'],
  ['autumn', 'fall'],
  ['holidays', 'vacation'],
  ['holiday', 'vacation'],
  ['chips', 'fries'],
  ['biscuit', 'cookie'],
  ['sweets', 'candy'],
];

const SYNONYM_MAP = new Map<string, string>();
SYNONYM_GROUPS.forEach((group, idx) => {
  const canonical = group[0];
  for (const word of group) {
    SYNONYM_MAP.set(word, canonical);
    if (word.endsWith('e')) SYNONYM_MAP.set(`${word}s`, canonical);
    else SYNONYM_MAP.set(`${word}s`, canonical);
    SYNONYM_MAP.set(`${word}ing`, canonical);
    SYNONYM_MAP.set(`${word}ed`, canonical);
    void idx;
  }
});

// Common phrase equivalences
const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\blike to go for a walk\b/g, 'enjoy walking'],
  [/\bgo for a walk\b/g, 'walk'],
  [/\bgoing for walks\b/g, 'walking'],
  [/\btake a walk\b/g, 'walk'],
  [/\blike going\b/g, 'like to go'],
  [/\benjoy going\b/g, 'like to go'],
  [/\blove to\b/g, 'like to'],
  [/\benjoy to\b/g, 'like to'],
  [/\bwould like\b/g, 'want'],
  [/\bhave to\b/g, 'must'],
  [/\bneed to\b/g, 'must'],
  [/\ba lot of\b/g, 'many'],
  [/\blots of\b/g, 'many'],
  [/\bon weekends\b/g, 'at the weekend'],
  [/\bat night\b/g, 'in the night'],
  [/\bin the morning\b/g, 'every morning'],
  [/\bfrench fries\b/g, 'fries'],
  [/\bcell phone\b/g, 'mobile phone'],
];

export function normalizeEnglishText(input: string): string {
  let s = input
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[“”"]/g, '')
    .trim();

  for (const [pattern, replacement] of CONTRACTIONS) {
    s = s.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    s = s.replace(pattern, replacement);
  }
  s = s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function stemToken(token: string): string {
  if (SYNONYM_MAP.has(token)) return SYNONYM_MAP.get(token)!;
  let t = token;
  if (t.length > 4 && t.endsWith('ing')) t = t.slice(0, -3);
  else if (t.length > 4 && t.endsWith('ies')) t = `${t.slice(0, -3)}y`;
  else if (t.length > 3 && t.endsWith('ed')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
  if (SYNONYM_MAP.has(t)) return SYNONYM_MAP.get(t)!;
  return t;
}

function getContentTokens(normalized: string): string[] {
  return normalized
    .split(' ')
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
    .map(stemToken);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function evaluateEnglishTranslation(
  userInput: string,
  expectedSentence: string,
  expectedWordMeaning: string
): EvaluationResult {
  const trimmed = userInput.trim();
  if (!trimmed) {
    return {
      outcome: 'incorrect',
      marks: 0,
      feedback: 'No translation was entered.',
      missingKeywords: getContentTokens(normalizeEnglishText(expectedSentence)),
    };
  }

  // Handle alternatives separated by "/" in source translations (e.g. "funny/weird", "clock/watch")
  const normUser = normalizeEnglishText(trimmed);
  const expectedVariants = expectedSentence.includes('/')
    ? [expectedSentence, ...expectedSentence.split('/').map((s) => s.trim())]
    : [expectedSentence];

  for (const variant of expectedVariants) {
    const normExp = normalizeEnglishText(variant);
    if (normUser === normExp) {
      return {
        outcome: 'correct',
        marks: 1,
        feedback: 'Exact or equivalent match.',
        missingKeywords: [],
      };
    }
    const maxLen = Math.max(normUser.length, normExp.length);
    if (maxLen > 0 && levenshtein(normUser, normExp) / maxLen <= 0.12) {
      return {
        outcome: 'correct',
        marks: 1,
        feedback: 'Accepted with minor spelling or wording difference.',
        missingKeywords: [],
      };
    }
  }

  // Keyword coverage analysis
  const normExpected = normalizeEnglishText(expectedSentence);
  const expectedWordsRaw = normExpected.split(' ').filter((w) => w && !STOPWORDS.has(w));
  const expectedTokens = expectedWordsRaw.map(stemToken);
  const userTokens = getContentTokens(normUser);
  const userSet = new Set(userTokens);

  // Also check target vocabulary word meaning tokens
  const meaningParts = expectedWordMeaning
    .split(/[\/,;]+/)
    .map((m) => normalizeEnglishText(m.replace(/\([^)]*\)/g, '').trim()))
    .filter(Boolean);
  const meaningTokens = meaningParts.flatMap((m) => getContentTokens(m));

  const matchedExpected: string[] = [];
  const missingKeywords: string[] = [];

  expectedTokens.forEach((tok, idx) => {
    const rawWord = expectedWordsRaw[idx];
    const matched =
      userSet.has(tok) ||
      userTokens.some((ut) => ut.length >= 4 && tok.length >= 4 && levenshtein(ut, tok) <= 1);
    if (matched) {
      matchedExpected.push(rawWord);
    } else {
      missingKeywords.push(rawWord);
    }
  });

  const coverage = expectedTokens.length > 0 ? matchedExpected.length / expectedTokens.length : 0;
  const hasTargetMeaning =
    meaningTokens.length === 0 ||
    meaningTokens.some(
      (mt) => userSet.has(mt) || userTokens.some((ut) => ut.length >= 4 && levenshtein(ut, mt) <= 1)
    );

  // Negation mismatch guard (if expected has "not"/"never" and user doesn't, or vice versa)
  const expNeg = /\b(not|never|no|nobody|nothing|cannot)\b/.test(normExpected);
  const userNeg = /\b(not|never|no|nobody|nothing|cannot)\b/.test(normUser);
  if (expNeg !== userNeg) {
    return {
      outcome: 'incorrect',
      marks: 0,
      feedback: 'Negation differs from the German sentence meaning.',
      missingKeywords,
    };
  }

  if (coverage >= 0.8 && hasTargetMeaning) {
    return {
      outcome: 'correct',
      marks: 1,
      feedback: 'All key meanings translated accurately.',
      missingKeywords: [],
    };
  }

  if (coverage >= 0.55) {
    return {
      outcome: 'needs_manual_check',
      marks: 0.5,
      feedback:
        'Your phrasing differs from the book translation. Compare below and confirm whether your meaning matches.',
      missingKeywords,
    };
  }

  if (coverage >= 0.35 || (hasTargetMeaning && userTokens.length >= 2)) {
    return {
      outcome: 'partially_correct',
      marks: 0.5,
      feedback: 'Partially correct — some key parts of the sentence are missing or differ.',
      missingKeywords,
    };
  }

  return {
    outcome: 'incorrect',
    marks: 0,
    feedback: 'Key vocabulary or sentence meaning was not matched.',
    missingKeywords,
  };
}

export function normalizeGermanInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:"'()]/g, '')
    .replace(/\s+/g, ' ');
}

export function evaluateGermanWordAnswer(userInput: string, targetWord: string): boolean {
  const u = normalizeGermanInput(userInput);
  const t = normalizeGermanInput(targetWord);
  if (!u) return false;
  if (u === t) return true;
  // Also accept stripped "sich " if reflexive verb or vice versa when close
  if (t.startsWith('sich ') && u === t.slice(5)) return true;
  return false;
}
