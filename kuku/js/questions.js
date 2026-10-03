import { shuffle } from './rng.js';
export const FACTS = Object.freeze(Array.from({ length: 72 }, (_, i) => {
  const first = 2 + Math.floor(i / 9), second = i % 9 + 1;
  return Object.freeze({ id: `${first}x${second}`, first, second, answer: first * second });
}));
export const FACT_IDS = new Set(FACTS.map(fact => fact.id));
export function buildDanQuestions(dan, route = 'ascending', rng = Math.random) {
  const questions = FACTS.filter(fact => fact.first === dan);
  if (questions.length !== 9) throw new RangeError('dan must be 2–9');
  if (route === 'descending') return questions.reverse();
  if (route === 'random') return shuffle(questions, rng);
  if (route !== 'ascending') throw new RangeError('unknown route');
  return questions;
}
// Retained neighbouring-product distractors from v1, now injectable for tests.
export function buildChoices({ first, second, answer }, rng = Math.random) {
  const candidates = shuffle([first * (second - 1), first * (second + 1), (first - 1) * second,
    (first + 1) * second, answer - first, answer + first, answer - second, answer + second,
    answer - 2, answer + 2, answer - 1, answer + 1], rng);
  const choices = [answer];
  for (const candidate of candidates) {
    if (candidate > 0 && candidate <= 81 && !choices.includes(candidate)) choices.push(candidate);
    if (choices.length === 3) break;
  }
  return shuffle(choices, rng);
}
export function masteryWeight(fact, mastery = {}, recentFacts = []) {
  const record = mastery[fact.id] || {};
  const attempts = record.attempts || 0;
  const success = attempts ? (record.firstCorrect || 0) / attempts : 0;
  return (1 + (1 - success) * 3 + Math.min(3, (record.misses || 0) * 0.25))
    * (recentFacts.includes(fact.id) ? 0.15 : 1);
}
export function sampleFacts(count, { pool = FACTS, mastery = {}, recentFacts = [], rng = Math.random } = {}) {
  const remaining = [...new Map(pool.map(fact => [fact.id, fact])).values()];
  const selected = [];
  while (selected.length < count && remaining.length) {
    const weights = remaining.map(fact => masteryWeight(fact, mastery, recentFacts));
    let target = rng() * weights.reduce((a, b) => a + b, 0);
    let index = weights.length - 1;
    for (let i = 0; i < weights.length; i++) {
      target -= weights[i];
      if (target < 0) { index = i; break; }
    }
    selected.push(...remaining.splice(index, 1));
  }
  return selected;
}
export function recordMastery(mastery, fact, { firstTry, misses = 0, timedOut = false }, now = Date.now()) {
  if (!FACT_IDS.has(fact.id)) return;
  const previous = mastery[fact.id] || {};
  mastery[fact.id] = {
    attempts: (previous.attempts || 0) + 1,
    correct: (previous.correct || 0) + 1,
    firstCorrect: (previous.firstCorrect || 0) + Number(firstTry),
    misses: (previous.misses || 0) + misses,
    timeouts: (previous.timeouts || 0) + Number(timedOut),
    lastSeen: now,
  };
}
