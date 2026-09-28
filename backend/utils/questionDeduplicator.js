/**
 * Question Deduplication Utility
 * Provides text normalization, concept key extraction, and semantic/token similarity matching.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'what', 'how', 'why', 'where', 'which', 'who', 'when', 'whose',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about',
  'into', 'over', 'after', 'under', 'through', 'between', 'out',
  'do', 'does', 'did', 'doing', 'done',
  'used', 'using', 'use', 'uses', 'you', 'your', 'yours',
  'primary', 'purpose', 'main', 'means', 'mean', 'meaning', 'refers', 'refer',
  'describe', 'explain', 'understand', 'define', 'statement', 'following',
  'based', 'candidate', 'resume', 'listed', 'project', 'system', 'application',
  'portal', 'student', 'technologies', 'technology'
]);

const SYNONYMS = {
  'database': 'dbms',
  'databases': 'dbms',
  'auth': 'authentication',
  'authorization': 'authentication',
  'fns': 'function',
  'funcs': 'function',
  'functions': 'function',
  'methods': 'function',
  'method': 'function'
};

/**
 * Normalizes question text by lowercasing, stripping punctuation, applying synonyms, and removing stopwords.
 */
function normalizeText(text) {
  if (!text) return '';
  const clean = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const rawTokens = clean.split(' ').filter(word => word.length > 1 && !STOP_WORDS.has(word));
  const tokens = rawTokens.map(t => SYNONYMS[t] || t);
  return tokens.join(' ');
}

/**
 * Extracts a sorted concept key from normalized tokens.
 */
function extractConceptKey(text) {
  const norm = normalizeText(text);
  if (!norm) return '';
  const sorted = Array.from(new Set(norm.split(' '))).sort();
  return sorted.join('_');
}

/**
 * Computes Jaccard Similarity index between two question texts.
 */
function calculateJaccardSimilarity(text1, text2) {
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1.0;

  const set1 = new Set(norm1.split(' '));
  const set2 = new Set(norm2.split(' '));

  let intersectionCount = 0;
  set1.forEach(token => {
    if (set2.has(token)) intersectionCount++;
  });

  const unionSize = new Set([...set1, ...set2]).size;
  if (unionSize === 0) return 0;

  return intersectionCount / unionSize;
}

/**
 * Checks if candidateQuestion matches any text in existingQuestions List/Set.
 */
function isDuplicateQuestion(candidateQuestion, existingQuestions, threshold = 0.55) {
  if (!candidateQuestion || !existingQuestions) return false;
  const candidateClean = candidateQuestion.toLowerCase().trim();
  const candidateNorm = normalizeText(candidateQuestion);

  for (const existing of existingQuestions) {
    if (!existing) continue;
    const existingClean = existing.toLowerCase().trim();
    
    // 1. Direct exact match
    if (candidateClean === existingClean) return true;

    // 2. Normalized text exact match
    const existingNorm = normalizeText(existing);
    if (candidateNorm && candidateNorm === existingNorm) return true;

    // 3. High Jaccard similarity (token overlap ratio >= threshold)
    const sim = calculateJaccardSimilarity(candidateQuestion, existing);
    if (sim >= threshold) return true;
  }

  return false;
}

module.exports = {
  normalizeText,
  extractConceptKey,
  calculateJaccardSimilarity,
  isDuplicateQuestion
};
