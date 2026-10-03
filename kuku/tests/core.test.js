import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTS, buildDanQuestions, buildChoices, sampleFacts, masteryWeight, recordMastery } from '../js/questions.js';
import { seededRng } from '../js/rng.js';
import { STAGES, SAVE_KEY, LEGACY_KEYS, GENERATION_VERSION } from '../js/config.js';
import { newSave, createSaveStore, normalizeSave } from '../js/save.js';
import { generateFloor, buildFloorQuestions, completeFloor } from '../js/dungeon.js';
import { isStageUnlocked, isRouteUnlocked, isBossUnlocked, completeStoryBattle, starsFor, unlockedWeapon } from '../js/progression.js';
import { createStoryBattle, createBattle, answerQuestion, timeoutQuestion, currentQuestion, criticalChance, battleStars } from '../js/battle.js';
const memory = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
};
function solve(battle) {
  let count = 0;
  while (!battle.complete && count++ < 100) answerQuestion(battle, currentQuestion(battle).answer);
  assert.ok(battle.complete);
  return count;
}
test('72 directed facts include ×1 and preserve 2×3 / 3×2 separately', () => {
  assert.equal(FACTS.length, 72);
  assert.equal(new Set(FACTS.map(f => f.id)).size, 72);
  for (let dan = 2; dan <= 9; dan++) for (let second = 1; second <= 9; second++) {
    assert.equal(FACTS.find(f => f.id === `${dan}x${second}`).answer, dan * second);
  }
});
test('every dan has exact ascending, reversed descending and complete shuffled bag', () => {
  for (let dan = 2; dan <= 9; dan++) {
    const asc = buildDanQuestions(dan), desc = buildDanQuestions(dan, 'descending');
    assert.deepEqual(asc.map(f => f.second), [1,2,3,4,5,6,7,8,9]);
    assert.deepEqual(desc, [...asc].reverse());
    for (let seed = 0; seed < 100; seed++) assert.deepEqual(buildDanQuestions(dan, 'random', seededRng(seed)).map(f => f.second).sort(), [1,2,3,4,5,6,7,8,9]);
  }
  assert.throws(() => buildDanQuestions(1));
  assert.throws(() => buildDanQuestions(2, 'invalid'));
});
test('choices retain a correct answer and two distinct positive distractors', () => {
  for (const fact of FACTS) for (let seed = 0; seed < 10; seed++) {
    const choices = buildChoices(fact, seededRng(seed));
    assert.equal(choices.length, 3); assert.equal(new Set(choices).size, 3);
    assert.ok(choices.includes(fact.answer)); assert.ok(choices.every(x => x > 0 && x <= 81));
  }
});
test('same RNG seed repeats exactly; streams remain bounded', () => {
  const a = seededRng('same'), b = seededRng('same');
  for (let i = 0; i < 100; i++) { const v = a(); assert.equal(v, b()); assert.ok(v >= 0 && v < 1); }
});
test('all floor metadata repeats with seed + floor + generationVersion', () => {
  for (let floor = 1; floor <= 100; floor++) {
    const metadata = generateFloor('seed', floor, GENERATION_VERSION);
    assert.deepEqual(metadata, generateFloor('seed', floor, GENERATION_VERSION));
    assert.ok(metadata.count >= 3 && metadata.count <= 12);
  }
  assert.throws(() => generateFloor('seed', 0)); assert.throws(() => generateFloor('seed', 101));
  assert.throws(() => generateFloor('seed', 10, 999));
});
test('5/10/50/100F kinds, timers and normal-floor question boundaries', () => {
  for (const [floor, kind, seconds] of [[1,'normal',0],[5,'elite',12],[10,'boss',10],[50,'midboss',9],[100,'final',8]]) {
    assert.equal(generateFloor('seed', floor).kind, kind); assert.equal(generateFloor('seed', floor).seconds, seconds);
  }
  for (const [floor, count] of [[1,3],[49,3],[51,4],[89,4],[91,5],[99,5],[5,5],[100,12]]) assert.equal(generateFloor('seed', floor).count, count);
});
test('weighted sampling is without replacement for every dungeon encounter', () => {
  const save = newSave('replay');
  for (let floor = 1; floor <= 100; floor++) {
    const metadata = generateFloor(save.dungeon.seed, floor);
    const questions = buildFloorQuestions(metadata, save.dungeon, save.mastery);
    assert.equal(questions.length, metadata.count); assert.equal(new Set(questions.map(f => f.id)).size, metadata.count);
    assert.deepEqual(questions, buildFloorQuestions(metadata, save.dungeon, save.mastery));
  }
  const all = sampleFacts(100, { rng: seededRng(1) }); assert.equal(all.length, 72);
});
test('mastery weighting favours less-secure facts and reduces recent facts', () => {
  const fact = FACTS[0], learned = { [fact.id]: { attempts: 10, firstCorrect: 10 } };
  assert.ok(masteryWeight(fact) > masteryWeight(fact, learned));
  assert.ok(masteryWeight(fact, {}, [fact.id]) < masteryWeight(fact));
  const mastery = {};
  recordMastery(mastery, fact, { firstTry: false, misses: 2, timedOut: true }, 100);
  assert.deepEqual(mastery[fact.id], { attempts:1, correct:1, firstCorrect:0, misses:2, timeouts:1, lastSeen:100 });
  recordMastery(mastery, { id: '1x1' }, { firstTry: true }); assert.equal(Object.keys(mastery).length, 1);
});
test('v1 migration keeps crystals, badge, best; never fabricates v2 route progress', () => {
  const storage = memory({ [LEGACY_KEYS[0]]:'8', [LEGACY_KEYS[1]]:JSON.stringify({ crystals:182, selectedBadge:'crystal-master' }) });
  const store = createSaveStore(storage), save = store.load();
  assert.equal(save.schemaVersion, 2); assert.equal(save.profile.crystals, 182);
  assert.equal(save.profile.selectedBadge, 'crystal-master'); assert.equal(save.profile.legacyBest, 8);
  assert.deepEqual(save.story.stages, {}); assert.equal(save.dungeon.floor, 1);
  assert.equal(storage.getItem(LEGACY_KEYS[0]), '8'); assert.ok(storage.getItem(SAVE_KEY));
  save.profile.crystals++; store.persist(save);
  assert.equal(createSaveStore(storage).load().profile.crystals, 183);
});
test('corrupt / denied storage keeps boot alive and preserves old keys', () => {
  const broken = memory({ [SAVE_KEY]:'{bad', [LEGACY_KEYS[1]]:'{also bad', [LEGACY_KEYS[0]]:'7' });
  assert.equal(createSaveStore(broken).load().profile.legacyBest, 7);
  assert.equal(broken.getItem(LEGACY_KEYS[1]), '{also bad');
  for (const storage of [undefined, { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } }, { getItem: () => null, setItem() { throw Error('quota'); } }]) {
    const store = createSaveStore(storage), save = store.load();
    assert.equal(save.schemaVersion, 2); assert.equal(store.persist(save), false); assert.ok(store.status);
  }
});
test('normalization bounds mastery to 72 facts and clamps invalid fields', () => {
  const save = normalizeSave({ profile:{ crystals:-100 }, mastery:Object.fromEntries([...FACTS.map(f => [f.id, { attempts:2 }]), ['9x99', { attempts:10 }]]), dungeon:{ floor:300, recentFacts:['2x1','bad'], seed:'abc' } });
  assert.equal(save.profile.crystals, 0); assert.equal(Object.keys(save.mastery).length,72);
  assert.equal(save.dungeon.floor,100); assert.deepEqual(save.dungeon.recentFacts,['2x1']);
  assert.equal(normalizeSave(null).schemaVersion,2);
});
test('future schema / generation does not overwrite a newer save', () => {
  for (const raw of [{ schemaVersion:99 }, { schemaVersion:2, dungeon:{ generationVersion:99 } }]) {
    const original = JSON.stringify(raw), storage = memory({ [SAVE_KEY]: original });
    const store = createSaveStore(storage), save = store.load(); assert.equal(store.persist(save),false);
    assert.equal(storage.getItem(SAVE_KEY),original); assert.ok(store.status);
  }
});
test('star boundaries: 9=>3; 7–8=>2; 0–6 eventual answers=>1', () => {
  for (let score = 0; score <= 9; score++) assert.equal(starsFor(score), score === 9 ? 3 : score >= 7 ? 2 : 1);
});
test('unlocks require route CLEAR only, all three routes, midboss after stage 4', () => {
  const { story } = newSave();
  assert.ok(isStageUnlocked(story,1)); assert.ok(!isStageUnlocked(story,2));
  assert.ok(!isBossUnlocked(story,1)); assert.ok(!isRouteUnlocked(story,1,'random'));
  for (const stage of STAGES.slice(0,8)) {
    if (stage.id === 5) { assert.ok(!isStageUnlocked(story,5)); completeStoryBattle(story,{ kind:'midboss' },1); }
    assert.ok(isStageUnlocked(story,stage.id));
    for (const route of ['ascending','descending','random']) {
      assert.ok(isRouteUnlocked(story,stage.id,route));
      completeStoryBattle(story,{ stageId:stage.id, kind:'route', route },1);
    }
    assert.ok(isBossUnlocked(story,stage.id)); completeStoryBattle(story,{ stageId:stage.id, kind:'boss' },1);
  }
  assert.ok(isBossUnlocked(story,9)); assert.ok(!isStageUnlocked(story,10));
});
test('ordered routes have three HP3 waves, never critical, and exactly 9 solved facts', () => {
  for (let stageId = 1; stageId <= 8; stageId++) for (const route of ['ascending','descending']) {
    const battle = createStoryBattle({ stageId, route }, {}, () => 0);
    for (let i = 1; i <= 9; i++) {
      const result = answerQuestion(battle, currentQuestion(battle).answer);
      assert.equal(result.critical,false); assert.equal(result.waveReward, i % 3 === 0 ? 1 : 0);
    }
    assert.ok(battle.complete); assert.equal(battle.waveRewards,3); assert.equal(battle.firstCorrect,9);
  }
});
test('guardian cannot clear before all 9 facts even with every hit critical', () => {
  const battle = createStoryBattle({ stageId:1, route:'random' },{},() => 0);
  for (let i = 0; i < 8; i++) answerQuestion(battle,currentQuestion(battle).answer);
  assert.equal(battle.hp,0); assert.equal(battle.complete,false);
  answerQuestion(battle,currentQuestion(battle).answer); assert.equal(battle.complete,true); assert.equal(battle.completedFacts.size,9);
});
test('guardian worst case is 12 successful answers, every bag fact before extras', () => {
  const battle = createStoryBattle({ stageId:1, route:'random' },{},() => 0.99);
  for (let i = 0; i < 9; i++) answerQuestion(battle,currentQuestion(battle).answer);
  assert.equal(battle.hp,3); assert.equal(battle.completedFacts.size,9); assert.equal(battle.complete,false);
  assert.equal(solve(battle),3); assert.equal(battle.solved,12); assert.equal(battle.firstCorrect,9);
});
test('guardian completion is robust across 1000 seeds and misses do not hurt HP or rewards', () => {
  assert.deepEqual([criticalChance(0),criticalChance(2),criticalChance(3)], [.1,.15,.25]);
  for (let seed = 0; seed < 1000; seed++) {
    const battle = createStoryBattle({ stageId:7, route:'random' },{},seededRng(seed));
    const hp = battle.hp;
    const wrong = answerQuestion(battle,-1); assert.equal(wrong.correct,false); assert.equal(battle.hp,hp);
    solve(battle); assert.ok(battle.solved >= 9 && battle.solved <= 12); assert.equal(battle.completedFacts.size,9);
  }
});
test('three hints reveal answer but require an actual correct submission', () => {
  const battle = createStoryBattle({stageId:5,route:'ascending'}), question = currentQuestion(battle);
  for (let i = 0; i < 3; i++) answerQuestion(battle,0);
  assert.equal(battle.solved,0); assert.equal(battle.hp,3); assert.equal(currentQuestion(battle),question);
  answerQuestion(battle,question.answer); assert.equal(battle.solved,1); assert.equal(battle.firstCorrect,0);
});
test('timeouts defer facts, break combo, preserve misses and recover without timer loops', () => {
  const battle = createStoryBattle({stageId:7,route:'ascending'}), first = currentQuestion(battle);
  answerQuestion(battle,0); timeoutQuestion(battle); assert.equal(battle.hp,3); assert.equal(battle.streak,0);
  for (let i = 0; i < 8; i++) answerQuestion(battle,currentQuestion(battle).answer);
  assert.equal(currentQuestion(battle),first); assert.equal(battle.timedOut,true);
  assert.equal(timeoutQuestion(battle),null);
  const outcome = answerQuestion(battle,first.answer); assert.equal(outcome.misses,1); assert.equal(outcome.timedOut,true);
  assert.equal(battle.complete,true); assert.equal(battleStars(battle),2);
});
test('all guardian questions can time out once and still complete', () => {
  const battle = createStoryBattle({stageId:8,route:'random'}, {}, () => .99);
  for (let i = 0; i < 9; i++) timeoutQuestion(battle);
  assert.equal(solve(battle),12); assert.equal(battle.firstCorrect,9); assert.equal(battleStars(battle),3);
});
test('bosses and final boss decks are unique; adaptation never changes story routes', () => {
  const mastery = Object.fromEntries(FACTS.map(f => [f.id,{attempts:100,firstCorrect:100}]));
  for (const stage of STAGES) {
    const boss = createStoryBattle({stageId:stage.id,kind:'boss'},mastery,seededRng(stage.id));
    assert.equal(new Set(boss.questions.map(f=>f.id)).size,boss.originalCount); solve(boss);
    if (stage.dan) assert.deepEqual(createStoryBattle({stageId:stage.id,route:'random'},mastery,seededRng(1)).questions,createStoryBattle({stageId:stage.id,route:'random'},{},seededRng(1)).questions);
  }
  const mid = createStoryBattle({stageId:4,kind:'midboss'},mastery); assert.equal(mid.originalCount,8);
  assert.ok(mid.questions.every(f=>[2,3,4,5].includes(f.first)));
});
test('whole story and 100 floors finish; weapon evolution and compact save are preserved', () => {
  const save = newSave('complete');
  for (const stage of STAGES) {
    if (stage.id === 5) { const mid=createStoryBattle({stageId:4,kind:'midboss'}); solve(mid); completeStoryBattle(save.story,mid,1); }
    if (stage.dan) for (const route of ['ascending','descending','random']) {
      const battle=createStoryBattle({stageId:stage.id,route}); solve(battle); completeStoryBattle(save.story,battle,1);
    }
    const boss=createStoryBattle({stageId:stage.id,kind:'boss'}); solve(boss); completeStoryBattle(save.story,boss,1);
    if (stage.id === 6) assert.equal(unlockedWeapon(save.story,save.dungeon),2);
    if (stage.id === 8) assert.equal(unlockedWeapon(save.story,save.dungeon),3);
  }
  assert.equal(save.story.endingSeen,true);
  for (let floor=1;floor<=100;floor++) {
    assert.equal(save.dungeon.floor,floor);
    const metadata=generateFloor(save.dungeon.seed,floor);
    const questions=buildFloorQuestions(metadata,save.dungeon,save.mastery);
    const battle=createBattle({questions,maxHp:questions.length}); solve(battle);
    completeFloor(save.dungeon,questions);
  }
  assert.equal(save.dungeon.completed,true); assert.equal(save.dungeon.highestFloor,100); assert.equal(unlockedWeapon(save.story,save.dungeon),4);
  assert.ok(save.dungeon.recentFacts.length<=18); assert.ok(JSON.stringify(save).length<5000);
});
