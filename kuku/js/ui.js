import { STAGES, ROUTES, WEAPONS } from './config.js';
import { createSaveStore } from './save.js';
import { createProfileUI } from './profile.js';
import { createAudio } from './audio.js';
import { createStoryBattle, createBattle, currentQuestion, answerQuestion, timeoutQuestion, battleStars } from './battle.js';
import { buildChoices, recordMastery } from './questions.js';
import { isStageUnlocked, isRouteUnlocked, isBossUnlocked, stageProgress, completeStoryBattle, unlockedWeapon } from './progression.js';
import { generateFloor, buildFloorQuestions, completeFloor } from './dungeon.js';
import { STORY } from './story.ja.js';
import { MESSAGES } from './messages.ja.js';
import { TITLE_BADGES } from './badges.js';

const $ = id => document.getElementById(id);
const text = (id, value) => { $(id).textContent = String(value); };
const button = (label, action, disabled = false) => {
  const node = document.createElement('button');
  node.type = 'button'; node.textContent = label; node.disabled = disabled;
  node.addEventListener('click', action);
  return node;
};
export function startApp() {
  let storage;
  try { storage = window.localStorage; } catch { /* Private mode may deny the getter itself. */ }
  const store = createSaveStore(storage), save = store.load();
  let battle = null, selectedStage = 1, input = '', choiceFallback = false, locked = false;
  let tick = null, deadline = 0, remaining = 0, advance = null, modal = false, questionToken = 0;
  let weaponIndex = 0, roundCrystals = 0, paused = false;
  const audio = createAudio(save.settings);
  const persist = () => { store.persist(save); text('save-status', store.status); };
  const profile = createProfileUI(save, persist, value => {
    modal = value;
    document.querySelector('.app-header').inert = value;
    $('game').inert = value;
    updatePause();
  });
  text('save-status', store.status);

  function syncSound() {
    $('sound-toggle').setAttribute('aria-pressed', String(save.settings.sound));
    $('sound-toggle').setAttribute('aria-label', save.settings.sound ? '効果音をオフにする' : '効果音をオンにする');
    text('sound-label', save.settings.sound ? 'おと ON' : 'おと OFF');
  }
  $('sound-toggle').addEventListener('click', () => {
    save.settings.sound = !save.settings.sound;
    syncSound(); persist();
    if (save.settings.sound) audio.play('correct'); else audio.stop();
  });
  $('untimed-toggle').checked = save.settings.untimed;
  $('untimed-toggle').addEventListener('change', () => {
    save.settings.untimed = $('untimed-toggle').checked; persist();
    if (battle && !locked) { stopTimer(); startTimer(); }
  });
  $('leave-battle').addEventListener('click', () => {
    stopTimer(); clearTimeout(advance); questionToken++; battle = null; locked = false;
    $('quiz-panel').hidden = true; $('finish-panel').hidden = true; $('map-panel').hidden = false;
    renderMap(); $('map-title').focus({ preventScroll: true });
  });
  $('restart-button').addEventListener('click', () => {
    $('finish-panel').hidden = true; $('map-panel').hidden = false; battle = null;
    renderMap(); $('map-title').focus({ preventScroll: true });
  });
  $('fallback-button').addEventListener('click', () => {
    if (!battle || locked) return;
    choiceFallback = !choiceFallback; input = ''; renderAnswers(true);
    text('feedback', choiceFallback ? '3つの こたえから えらんでね。' : STORY.tutorial);
  });
  $('pause-button').addEventListener('click', () => { paused = !paused; updatePause(); });
  document.addEventListener('visibilitychange', updatePause);
  window.addEventListener('blur', updatePause);
  window.addEventListener('focus', updatePause);
  // Keypad consists of buttons, never an input that can summon an OS keyboard.
  document.addEventListener('keydown', event => {
    if (!battle || locked || modal || paused || document.hidden || $('quiz-panel').hidden || event.ctrlKey || event.metaKey || event.altKey) return;
    if (STAGES[selectedStage - 1].input !== 'keypad' || choiceFallback) return;
    if (/^[0-9]$/.test(event.key)) { event.preventDefault(); enterDigit(event.key); }
    else if (event.key === 'Backspace') { event.preventDefault(); enterDigit('⌫'); }
    else if (event.key === 'Enter' && !document.activeElement?.matches('button')) { event.preventDefault(); submit(Number(input)); }
  });
  function stopTimer() { clearInterval(tick); tick = null; }
  function updatePause() {
    if (!battle || locked) return;
    const suspended = modal || paused || document.hidden || !document.hasFocus();
    $('answers').inert = suspended;
    $('pause-button').setAttribute('aria-pressed', String(paused));
    text('pause-button', paused ? 'つづける' : 'ひとやすみ');
    if (suspended && tick) { remaining = Math.max(0, deadline - performance.now()); stopTimer(); text('timer-label', 'ひとやすみ'); }
    if (!suspended && !tick && remaining > 0) runTimer();
  }
  function startTimer() {
    const seconds = save.settings.untimed || battle.timedOut ? 0 : battle.seconds;
    remaining = seconds * 1000;
    text('timer-label', seconds ? `あと ${seconds}秒` : '時間なし');
    if (seconds && !modal && !paused && !document.hidden && document.hasFocus()) runTimer();
    updatePause();
  }
  function runTimer() {
    deadline = performance.now() + remaining;
    tick = setInterval(() => {
      const rest = Math.max(0, deadline - performance.now());
      text('timer-label', `あと ${Math.ceil(rest / 1000)}秒`);
      $('timer-meter').style.width = `${Math.min(100, rest / (battle.seconds * 10))}%`;
      if (rest <= 0) {
        stopTimer(); timeoutQuestion(battle); input = '';
        log(MESSAGES.timeout); renderQuestion(true); text('feedback', MESSAGES.timeout);
      }
    }, 150);
  }
  function grant(amount) {
    if (!amount) return;
    const before = save.profile.crystals;
    save.profile.crystals += amount; roundCrystals += amount;
    const badge = TITLE_BADGES.filter(item => item.start > before && item.start <= save.profile.crystals).at(-1);
    if (badge) { save.profile.selectedBadge = badge.id; log(`あたらしい称号「${badge.title}」！`); audio.play('badge'); }
    profile.render();
  }
  function renderMap() {
    document.body.classList.remove('is-battle');
    $('badge-book-button').disabled = false;
    profile.render();
    $('stage-list').replaceChildren();
    for (const stage of STAGES) {
      const progress = stageProgress(save.story, stage.id), unlocked = isStageUnlocked(save.story, stage.id);
      const node = button(`${stage.id}. ${stage.name}　${stage.dan ? stage.dan + 'の段' : '九九ミックス'}${progress.bossClear ? ' ✓' : unlocked ? '' : ' 🔒'}`, () => { selectedStage = stage.id; renderRoutes(); }, !unlocked);
      node.setAttribute('aria-pressed', String(selectedStage === stage.id));
      $('stage-list').append(node);
    }
    renderRoutes();
    $('dungeon-entry').hidden = !save.story.endingSeen;
    text('dungeon-guide', save.dungeon.completed ? STORY.awakened : STORY.abyss);
    text('dungeon-start', save.dungeon.completed ? '100Fに もういちど ちょうせん' : `${save.dungeon.floor}Fから つづける`);
    text('equipment', WEAPONS[unlockedWeapon(save.story, save.dungeon)]);
    text('legacy-best', `むかしの10もんクエストの じこベスト：${save.profile.legacyBest} / 10`);
    text('story-intro', save.story.endingSeen ? STORY.ending : save.story.midbossClear ? STORY.tutorial : STORY.opening);
  }
  function renderRoutes() {
    const stage = STAGES[selectedStage - 1], progress = stageProgress(save.story, selectedStage);
    text('area-title', stage.name);
    $('route-list').replaceChildren();
    if (stage.id <= 8) for (const route of ROUTES) {
      const record = progress.routes[route.id];
      const node = button(`${route.name} ${record?.clear ? 'CLEAR ' + '★'.repeat(record.stars) : '9もん'}`, () => startStory({ stageId: stage.id, kind: 'route', route: route.id }), !isRouteUnlocked(save.story, stage.id, route.id));
      $('route-list').append(node);
    }
    $('route-list').append(button(`${stage.boss}${progress.bossClear ? ' CLEAR' : 'と たたかう'}`, () => startStory({ stageId: stage.id, kind: 'boss' }), !isBossUnlocked(save.story, stage.id)));
    if (stage.id === 4) $('route-list').append(button(`こんらんまじん${save.story.midbossClear ? ' CLEAR' : '（2・3・5・4ミックス）'}`, () => startStory({ stageId: 4, kind: 'midboss' }), !progress.bossClear));
    text('route-guide', stage.id === 9 ? '8つの国の 九九の力をあわせよう。' : 'のぼり → くだり → まよい。3つクリアで ボスへ！ ★は いくつでも 進めるよ。');
    for (const node of $('stage-list').children) node.setAttribute('aria-pressed', String(node.textContent.startsWith(`${stage.id}.`)));
  }
  function startStory(options) {
    if (options.kind === 'route' ? !isRouteUnlocked(save.story, options.stageId, options.route) : options.kind === 'midboss' ? !stageProgress(save.story, 4).bossClear : !isBossUnlocked(save.story, options.stageId)) return;
    selectedStage = options.stageId;
    battle = createStoryBattle(options, save.mastery);
    weaponIndex = STAGES[selectedStage - 1].weapon;
    beginBattle();
  }
  $('dungeon-start').addEventListener('click', () => {
    if (!save.story.endingSeen) return;
    selectedStage = 9;
    const metadata = generateFloor(save.dungeon.seed, save.dungeon.floor, save.dungeon.generationVersion);
    battle = createBattle({ kind: 'dungeon', stageId: 9, metadata, questions: buildFloorQuestions(metadata, save.dungeon, save.mastery), guardian: false, waves: false, maxHp: metadata.count, seconds: metadata.seconds, reward: metadata.reward });
    weaponIndex = metadata.floor === 100 ? 4 : 3;
    beginBattle();
  });
  function beginBattle() {
    document.body.classList.add('is-battle');
    stopTimer(); clearTimeout(advance); paused = false; locked = false; roundCrystals = 0; choiceFallback = false;
    $('map-panel').hidden = true; $('finish-panel').hidden = true; $('quiz-panel').hidden = false;
    $('battle-log').replaceChildren(); text('pause-button', 'ひとやすみ');
    $('pause-button').setAttribute('aria-pressed', 'false');
    const stage = STAGES[selectedStage - 1];
    text('battle-place', battle.kind === 'dungeon' ? `九九の深淵 ${battle.metadata.floor}F` : battle.kind === 'midboss' ? 'きかいのまち地下' : stage.name);
    text('battle-route', battle.kind === 'route' ? ROUTES.find(route => route.id === battle.route).name : 'ボスの しれん');
    text('weapon-name', WEAPONS[weaponIndex]);
    $('weapon-art').src = `assets/weapon-${weaponIndex}.svg`;
    $('weapon-art').alt = WEAPONS[weaponIndex];
    $('weapon-beads').hidden = weaponIndex !== 0;
    $('battle-scene').style.backgroundImage = `url("assets/bg-${battle.kind === 'dungeon' ? 'abyss' : battle.kind === 'midboss' ? 'reactor' : stage.theme}.svg")`;
    $('fallback-button').hidden = selectedStage !== 5;
    log(battle.kind === 'midboss' ? STORY.midboss : selectedStage === 5 ? STORY.tutorial : '九九の力で こうげきしよう！');
    renderTower(); renderQuestion(true);
  }
  function renderTower() {
    const dungeon = battle.kind === 'dungeon';
    $('tower-panel').hidden = !dungeon;
    if (!dungeon) return;
    const floor = battle.metadata.floor, start = Math.floor((floor - 1) / 10) * 10 + 1;
    text('tower-title', `九九の深淵 ${start}〜${start + 9}F`);
    for (const node of $('tower-path').children) {
      const step = Number(node.dataset.step), actual = start + step - 1;
      node.querySelector('.tower-node-label').textContent = actual;
      node.querySelector('.tower-node-marker').textContent = step === 10 ? '王' : step === 5 ? '強' : step;
      node.classList.toggle('is-current', actual === floor);
      node.classList.toggle('is-complete', actual <= save.dungeon.highestFloor);
      node.setAttribute('aria-label', `${actual}階 ${step === 10 ? 'ボス' : step === 5 ? '強敵' : '通常'}${actual === floor ? ' いまここ' : actual <= save.dungeon.highestFloor ? ' クリア' : ''}`);
      if (actual === floor) node.setAttribute('aria-current', 'step'); else node.removeAttribute('aria-current');
    }
  }
  function renderEnemy() {
    const stage = STAGES[selectedStage - 1];
    let name, source;
    if (battle.kind === 'midboss') { name = 'こんらんまじん'; source = 'boss-mid'; }
    else if (battle.kind === 'dungeon') {
      name = battle.metadata.floor === 100 ? '九九喰らい ゼロ' : `${battle.metadata.kind === 'normal' ? 'しんえんの番人' : 'しんえんの守護者'} ${battle.metadata.floor}F`;
      source = battle.metadata.floor === 100 ? 'boss-zero' : battle.metadata.kind === 'normal' ? `enemy-abyss-${battle.metadata.variant}` : 'boss-9';
    } else if (battle.kind === 'boss') { name = stage.boss; source = `boss-${stage.id}`; }
    else if (battle.guardian) { name = 'まよいの守護者'; source = `guardian-${stage.id}`; }
    else { name = stage.enemies[battle.wave - 1]; source = `enemy-${stage.id}-${battle.wave - 1}`; }
    text('enemy-name', name); $('enemy-art').src = `assets/${source}.svg`; $('enemy-art').alt = name;
    renderHp();
  }
  function renderHp(hp = battle.hp) {
    text('enemy-hp', `HP ${hp} / ${battle.maxHp}`);
    $('hp-meter').max = battle.maxHp; $('hp-meter').value = hp;
  }
  function renderQuestion(focus = false) {
    questionToken++; locked = false; input = '';
    $('badge-book-button').disabled = false;
    const fact = currentQuestion(battle);
    text('factor-a', fact.first); text('factor-b', fact.second);
    text('question-count', `${Math.min(battle.completedFacts.size + 1, battle.originalCount)} / ${battle.originalCount}${battle.index >= battle.originalCount ? '・おかわり' : ''}`);
    text('score', battle.firstCorrect);
    text('streak-chip', `${battle.streak}もん れんぞく`);
    $('streak-chip').classList.toggle('is-hot', weaponIndex >= 2 && battle.streak >= 3);
    const completed = battle.completedFacts.size;
    $('progress').setAttribute('aria-valuemax', battle.originalCount);
    $('progress').setAttribute('aria-valuenow', completed);
    $('progress-fill').style.width = `${completed / battle.originalCount * 100}%`;
    text('feedback', battle.timedOut ? 'さっきの問題だよ。今度は 時間なしで こたえよう。' : selectedStage === 5 && !choiceFallback ? STORY.tutorial : 'こたえで こうげきしよう！');
    text('hint', ''); $('timer-meter').style.width = '100%';
    renderEnemy(); renderAnswers(focus); startTimer();
  }
  function renderAnswers(focus = false) {
    const keypad = STAGES[selectedStage - 1].input === 'keypad' && !choiceFallback;
    const container = $('answers'); container.replaceChildren(); container.classList.toggle('is-keypad', keypad);
    container.setAttribute('aria-label', keypad ? '電卓のテンキー' : '3つの答え');
    text('question-label', keypad ? '数字を おして「＝」で こうげき！' : 'こたえは どれ？');
    text('fallback-button', choiceFallback ? '電卓にもどる' : '3択で ためす');
    $('keypad-display').hidden = !keypad;
    if (keypad) {
      for (const label of ['7','8','9','4','5','6','1','2','3','⌫','0','＝']) {
        const node = button(label, () => label === '＝' ? (input !== '' && submit(Number(input))) : enterDigit(label));
        node.className = 'answer-button'; node.setAttribute('aria-label', label === '⌫' ? '1けた けす' : label === '＝' ? 'こたえで こうげき' : `${label}を入力`);
        if (label === '＝') node.dataset.submit = '';
        container.append(node);
      }
      syncInput();
    } else for (const value of buildChoices(currentQuestion(battle))) {
      const node = button(String(value), () => submit(value)); node.className = 'answer-button'; node.setAttribute('aria-label', `${value}を選ぶ`); container.append(node);
    }
    if (focus) container.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }
  function syncInput() {
    text('keypad-display', input || '？');
    const equal = $('answers').querySelector('[data-submit]'); if (equal) equal.disabled = !input;
  }
  function enterDigit(value) {
    if (locked || paused || modal) return;
    input = value === '⌫' ? input.slice(0, -1) : (input + value).slice(0, 2); syncInput();
  }
  function submit(value) {
    if (locked || paused || modal || document.hidden) return;
    const outcome = answerQuestion(battle, value);
    if (!outcome) return;
    if (!outcome.correct) {
      text('feedback', MESSAGES.guard); text('hint', outcome.hint);
      text('streak-chip', '0もん れんぞく'); log(outcome.hint); audio.play('wrong'); input = ''; syncInput();
      $('streak-chip').classList.remove('is-hot');
      return;
    }
    locked = true; stopTimer();
    $('badge-book-button').disabled = true;
    for (const node of $('answers').querySelectorAll('button')) node.disabled = true;
    recordMastery(save.mastery, outcome.question, outcome);
    grant(outcome.waveReward); persist();
    const message = outcome.critical ? MESSAGES.critical : outcome.firstTry && !outcome.timedOut ? MESSAGES.correct : MESSAGES.retry;
    text('feedback', message); log(`${outcome.question.first} × ${outcome.question.second} = ${outcome.question.answer}。${message}${outcome.waveReward ? ' ウェーブ撃破 +1◇' : ''}`);
    text('streak-chip', `${battle.streak}もん れんぞく`); text('score', battle.firstCorrect);
    $('streak-chip').classList.toggle('is-hot', weaponIndex >= 2 && battle.streak >= 3);
    renderHp(outcome.waveReward ? 0 : battle.hp);
    $('enemy-art').classList.remove('is-hit'); $('weapon-art').classList.remove('is-attack');
    $('battle-scene').classList.remove('is-critical'); $('weapon-beads').classList.remove('is-click');
    void $('enemy-art').offsetWidth;
    $('enemy-art').classList.add('is-hit'); $('weapon-art').classList.add('is-attack'); audio.play('correct', outcome.firstTry);
    $('weapon-beads').classList.add('is-click');
    if (outcome.critical) $('battle-scene').classList.add('is-critical');
    const token = questionToken;
    advance = setTimeout(() => {
      if (token !== questionToken || !battle) return;
      if (battle.complete) finishBattle(); else renderQuestion(true);
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 200 : 650);
  }
  function log(message) {
    const item = document.createElement('li'); item.textContent = message; $('battle-log').append(item);
    while ($('battle-log').children.length > 4) $('battle-log').firstChild.remove();
  }
  function finishBattle() {
    stopTimer();
    document.body.classList.remove('is-battle');
    $('badge-book-button').disabled = false;
    const stars = battleStars(battle);
    grant(battle.reward);
    if (battle.kind === 'dungeon') completeFloor(save.dungeon, battle.questions);
    else completeStoryBattle(save.story, battle, stars);
    persist(); profile.render(); profile.renderFinish();
    text('finish-title', battle.kind === 'dungeon' ? `${battle.metadata.floor}F クリア！` : 'クリア！');
    let message = '考えて こたえた！ 九九の力が アップしたね。';
    if (battle.stageId === 9 && battle.kind === 'boss') message = STORY.ending;
    else if (battle.metadata?.floor === 100) message = STORY.awakened;
    else if (battle.kind === 'midboss') message = STORY.tutorial;
    else if (battle.kind === 'boss' && selectedStage === 6) message = STORY.hero;
    else if (battle.kind === 'boss' && selectedStage === 8) message = STORY.legendary;
    text('finish-message', message);
    text('final-score', battle.firstCorrect); text('final-count', battle.originalCount);
    text('final-streak', battle.maxStreak); text('final-crystals', roundCrystals); text('final-total-crystals', save.profile.crystals);
    document.querySelectorAll('.finish-star').forEach((node, i) => node.classList.toggle('is-filled', i < stars));
    $('finish-medal').setAttribute('aria-label', `${stars}つ星のクリアメダル`);
    text('best-message', '★の数や 時間で、つぎへ進めなくなることは ないよ。');
    $('quiz-panel').hidden = true; $('finish-panel').hidden = false;
    $('restart-button').focus({ preventScroll: true });
  }
  syncSound(); renderMap();
}
