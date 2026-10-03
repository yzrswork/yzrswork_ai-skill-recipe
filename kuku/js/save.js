import { SAVE_KEY, LEGACY_KEYS, SCHEMA_VERSION, GENERATION_VERSION, ROUTES } from './config.js';
import { FACT_IDS } from './questions.js';
const integer = (value, max = Number.MAX_SAFE_INTEGER) => Math.min(max, Math.max(0, Math.trunc(Number(value)) || 0));
export function newSave(seed = String(Date.now())) {
  return { schemaVersion: SCHEMA_VERSION, profile: { crystals: 0, selectedBadge: '', legacyBest: 0 },
    settings: { sound: false, untimed: false }, story: { stages: {}, midbossClear: false, endingSeen: false },
    mastery: {}, dungeon: { seed: String(seed), generationVersion: GENERATION_VERSION, floor: 1, highestFloor: 0, completed: false, recentFacts: [] } };
}
export function normalizeSave(raw) {
  const save = newSave();
  if (!raw || typeof raw !== 'object') return save;
  save.profile.crystals = integer(raw.profile?.crystals);
  save.profile.selectedBadge = typeof raw.profile?.selectedBadge === 'string' ? raw.profile.selectedBadge.slice(0, 80) : '';
  save.profile.legacyBest = integer(raw.profile?.legacyBest, 10);
  save.settings.sound = raw.settings?.sound === true;
  save.settings.untimed = raw.settings?.untimed === true;
  for (let stageId = 1; stageId <= 9; stageId++) {
    const old = raw.story?.stages?.[stageId];
    if (!old || typeof old !== 'object') continue;
    const routes = {};
    for (const { id } of ROUTES) if (old.routes?.[id]?.clear === true) routes[id] = { clear: true, stars: Math.max(1, integer(old.routes[id].stars, 3)) };
    save.story.stages[stageId] = { routes, bossClear: old.bossClear === true };
  }
  save.story.midbossClear = raw.story?.midbossClear === true;
  save.story.endingSeen = raw.story?.endingSeen === true;
  for (const id of FACT_IDS) {
    const record = raw.mastery?.[id];
    if (!record || typeof record !== 'object') continue;
    save.mastery[id] = Object.fromEntries(['attempts', 'correct', 'firstCorrect', 'misses', 'timeouts', 'lastSeen'].map(key => [key, integer(record[key])]));
  }
  const dungeon = raw.dungeon;
  if (dungeon && typeof dungeon === 'object') {
    save.dungeon.seed = typeof dungeon.seed === 'string' ? dungeon.seed.slice(0, 100) : save.dungeon.seed;
    save.dungeon.generationVersion = integer(dungeon.generationVersion) || GENERATION_VERSION;
    save.dungeon.floor = Math.max(1, integer(dungeon.floor, 100));
    save.dungeon.highestFloor = integer(dungeon.highestFloor, 100);
    save.dungeon.completed = dungeon.completed === true;
    save.dungeon.recentFacts = Array.isArray(dungeon.recentFacts) ? dungeon.recentFacts.filter(id => FACT_IDS.has(id)).slice(-18) : [];
  }
  return save;
}
export function migrateV1(best, progress) {
  const save = newSave();
  save.profile.crystals = integer(progress?.crystals);
  save.profile.selectedBadge = typeof progress?.selectedBadge === 'string' ? progress.selectedBadge : '';
  save.profile.legacyBest = integer(Number.parseInt(best, 10), 10);
  // v1 mixed ten-question rounds cannot certify any of the v2 routes.
  return save;
}
export function createSaveStore(storage) {
  let status = '', readOnly = false;
  const read = key => { try { return storage?.getItem(key); } catch { status = '保存を よめないため、この画面で あそべます。'; return null; } };
  const parse = raw => { try { return raw ? JSON.parse(raw) : null; } catch { status = '保存を よみなおしました。むかしの記録は 残しています。'; return null; } };
  function persist(save) {
    if (readOnly) return false;
    try { if (!storage) throw new Error('storage unavailable'); storage.setItem(SAVE_KEY, JSON.stringify(save)); status = ''; return true; }
    catch { status = '保存できません。この画面では あそびつづけられます。'; return false; }
  }
  function load() {
    const current = parse(read(SAVE_KEY));
    if (current?.schemaVersion > SCHEMA_VERSION || current?.dungeon?.generationVersion > GENERATION_VERSION) {
      readOnly = true;
      status = '新しい版の保存です。記録を残して、体験モードで あそべます。';
      return newSave();
    }
    if (current?.schemaVersion === SCHEMA_VERSION) return normalizeSave(current);
    const migrated = migrateV1(read(LEGACY_KEYS[0]), parse(read(LEGACY_KEYS[1])));
    persist(migrated);
    return migrated;
  }
  return { load, persist, get status() { return status; } };
}
