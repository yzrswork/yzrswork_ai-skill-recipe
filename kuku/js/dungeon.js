import { GENERATION_VERSION } from './config.js';
import { seededRng } from './rng.js';
import { sampleFacts } from './questions.js';
export function generateFloor(seed, floor, generationVersion = GENERATION_VERSION) {
  if (!Number.isInteger(floor) || floor < 1 || floor > 100) throw new RangeError('floor must be 1–100');
  if (generationVersion !== GENERATION_VERSION) throw new RangeError('unsupported generation version');
  const rng = seededRng(`${seed}:${floor}:${generationVersion}`);
  const kind = floor === 100 ? 'final' : floor === 50 ? 'midboss' : floor % 10 === 0 ? 'boss' : floor % 5 === 0 ? 'elite' : 'normal';
  const count = kind === 'final' ? 12 : kind === 'elite' ? 5 : kind === 'normal' ? (floor <= 50 ? 3 : floor <= 90 ? 4 : 5) : 6 + Math.floor(rng() * 4);
  const seconds = floor === 100 ? 8 : floor === 50 ? 9 : floor % 10 === 0 ? 10 : floor % 5 === 0 ? 12 : 0;
  return { floor, kind, count, seconds, generationVersion, variant: Math.floor(rng() * 3), reward: kind === 'final' ? 20 : kind === 'normal' ? 1 : kind === 'elite' ? 3 : 5 };
}
export function buildFloorQuestions(metadata, dungeon, mastery) {
  return sampleFacts(metadata.count, { mastery, recentFacts: dungeon.recentFacts,
    rng: seededRng(`${dungeon.seed}:${metadata.floor}:${metadata.generationVersion}:questions`) });
}
export function completeFloor(dungeon, facts) {
  dungeon.recentFacts = [...dungeon.recentFacts, ...facts.map(fact => fact.id)].slice(-18);
  dungeon.highestFloor = Math.max(dungeon.highestFloor, dungeon.floor);
  if (dungeon.floor === 100) dungeon.completed = true;
  else dungeon.floor++;
}
