import { buildDanQuestions, sampleFacts, FACTS } from './questions.js';
import { ROUTES, STAGES } from './config.js';
import { starsFor } from './progression.js';
export function createStoryBattle({ stageId, kind = 'route', route = 'ascending' }, mastery = {}, rng = Math.random) {
  const stage = STAGES.find(item => item.id === stageId);
  if (!stage) throw new RangeError('unknown stage');
  const pool = kind === 'midboss' ? FACTS.filter(f => [2, 3, 5, 4].includes(f.first)) : stage.dan ? FACTS.filter(f => f.first === stage.dan) : FACTS;
  const questions = kind === 'route' ? buildDanQuestions(stage.dan, route, rng) : sampleFacts(stageId === 9 ? 12 : kind === 'midboss' ? 8 : 9, { pool, mastery, rng });
  const guardian = kind === 'route' && route === 'random';
  return createBattle({ stageId, kind, route, questions, guardian, waves: kind === 'route' && !guardian,
    maxHp: guardian ? 12 : kind === 'route' ? 3 : questions.length, seconds: stage.seconds,
    reward: kind === 'route' ? ROUTES.find(r => r.id === route).reward : kind === 'midboss' ? 10 : stageId === 9 ? 20 : 5 }, rng);
}
export function createBattle(options, rng = Math.random) {
  return { ...options, queue: [...options.questions], originalCount: options.questions.length, index: 0,
    hp: options.maxHp, attempts: 0, misses: 0, timedOut: false, streak: 0, maxStreak: 0,
    firstCorrect: 0, completedFacts: new Set(), recoveryFacts: new Set(), recoveryMisses: new Map(),
    damageTotal: 0, solved: 0, wave: 1, waveRewards: 0, complete: false, rng };
}
export function currentQuestion(battle) { return battle.queue[battle.index]; }
export function criticalChance(streak) { return streak >= 3 ? 0.25 : streak === 2 ? 0.15 : 0.1; }
export function hintFor(fact, level) {
  if (level <= 1) return `${fact.first}が ${fact.second}こ。${fact.first}ずつ たしてみよう。`;
  if (level === 2) return fact.second === 1 ? `1こぶんは ${fact.first}だよ。` : `${fact.first} × ${fact.second - 1} = ${fact.first * (fact.second - 1)}。あと ${fact.first}を たそう。`;
  return `${fact.first} × ${fact.second} = ${fact.answer}。${fact.answer}を もういちど こたえてね。`;
}
export function timeoutQuestion(battle) {
  if (battle.complete || battle.timedOut) return null;
  const question = currentQuestion(battle);
  battle.streak = 0;
  battle.recoveryFacts.add(question.id);
  battle.recoveryMisses.set(question.id, battle.misses);
  // Defer once; its recovery is untimed, preventing an endless timeout loop.
  battle.queue.push(question);
  battle.index++;
  resetAttempts(battle);
  return { question, deferred: true };
}
function resetAttempts(battle) {
  battle.attempts = 0;
  battle.misses = battle.recoveryMisses.get(currentQuestion(battle)?.id) || 0;
  battle.timedOut = battle.recoveryFacts.has(currentQuestion(battle)?.id);
}
export function answerQuestion(battle, answer) {
  if (battle.complete) return null;
  const question = currentQuestion(battle);
  battle.attempts++;
  if (answer !== question.answer) {
    battle.misses++;
    battle.streak = 0;
    return { correct: false, hint: hintFor(question, battle.misses) };
  }
  // Stars depend on the first submitted answer, never on elapsed time.
  // Misses before a timeout are carried into the deferred attempt.
  const firstTry = battle.attempts === 1 && battle.misses === 0;
  if (firstTry) battle.streak++; else battle.streak = 0;
  battle.maxStreak = Math.max(battle.maxStreak, battle.streak);
  if (firstTry && !battle.completedFacts.has(question.id)) battle.firstCorrect++;
  const critical = battle.guardian && battle.rng() < criticalChance(battle.streak);
  const damage = critical ? 2 : 1;
  battle.hp = Math.max(0, battle.hp - damage);
  battle.damageTotal += damage;
  battle.solved++;
  battle.completedFacts.add(question.id);
  const outcome = { correct: true, critical, damage, question, firstTry, misses: battle.misses, timedOut: battle.timedOut, waveReward: 0 };
  if (battle.waves && battle.solved % 3 === 0) {
    outcome.waveReward = 1;
    battle.waveRewards++;
    if (battle.solved < battle.originalCount) { battle.wave++; battle.hp = battle.maxHp; }
  }
  battle.index++;
  if (battle.index >= battle.queue.length && battle.guardian && battle.hp > 0) {
    // Only after every bag fact is solved. At most three extra successful answers.
    const candidates = battle.questions;
    battle.queue.push(candidates[(battle.solved - battle.originalCount) % candidates.length]);
  }
  battle.complete = battle.index >= battle.queue.length && battle.completedFacts.size === battle.originalCount && battle.hp === 0;
  resetAttempts(battle);
  return outcome;
}
export function battleStars(battle) { return starsFor(battle.firstCorrect, battle.originalCount); }
