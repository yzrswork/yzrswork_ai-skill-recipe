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
import { VISUAL_ASSETS, assetUrl, assetName } from './assets.js';

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
  let currentScreen = 'home', collectionTab = 'monsters', pendingQuest = null, questOpener = null, nextAfterResult = null;
  const stageAccents = { grass: '#397951', forest: '#2f7259', mine: '#785a1d', machine: '#3d668e', volcano: '#a44c38', desert: '#795727', snow: '#326881', sky: '#435f9b', castle: '#604c88', abyss: '#604b86' };
  const audio = createAudio(save.settings);
  const persist = () => { store.persist(save); text('save-status', store.status); };
  const profile = createProfileUI(save, persist, value => {
    modal = value;
    document.querySelector('.app-header').inert = value;
    $('game').inert = value;
    $('bottom-nav').inert = value;
    updatePause();
  });
  text('save-status', store.status);

  function nextStoryAction() {
    for (const stage of STAGES) {
      if (!isStageUnlocked(save.story, stage.id)) continue;
      const progress = stageProgress(save.story, stage.id);
      if (stage.id <= 8) {
        for (const route of ROUTES) {
          if (!progress.routes[route.id]?.clear && isRouteUnlocked(save.story, stage.id, route.id)) {
            return { stageId: stage.id, kind: 'route', route: route.id };
          }
        }
      }
      if (!progress.bossClear && isBossUnlocked(save.story, stage.id)) return { stageId: stage.id, kind: 'boss' };
      if (stage.id === 4 && progress.bossClear && !save.story.midbossClear) return { stageId: 4, kind: 'midboss' };
    }
    return { kind: 'dungeon' };
  }

  function showScreen(name) {
    currentScreen = name;
    document.body.dataset.screen = name;
    $('home-panel').hidden = name !== 'home';
    $('map-panel').hidden = name !== 'map';
    $('quiz-panel').hidden = name !== 'battle';
    $('finish-panel').hidden = name !== 'result';
    $('collection-panel').hidden = name !== 'collection';
    $('abyss-panel').hidden = name !== 'abyss';
    $('gentle-note').hidden = name !== 'home';
    $('bottom-nav').hidden = name === 'battle' || name === 'result';
    for (const node of $('bottom-nav').querySelectorAll('[data-nav]')) {
      const active = (name === 'home' || name === 'map' || name === 'abyss') ? node.dataset.nav === 'home'
        : name === 'collection' ? node.dataset.nav === (collectionTab === 'badges' ? 'badges' : 'monsters') : false;
      if (active) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
    }
    document.body.classList.toggle('is-battle', name === 'battle');
  }

  function showCollection(tab) {
    collectionTab = tab;
    $('monster-collection').hidden = tab !== 'monsters';
    $('badge-collection').hidden = tab !== 'badges';
    $('collection-monsters-tab').setAttribute('aria-pressed', String(tab === 'monsters'));
    $('collection-badges-tab').setAttribute('aria-pressed', String(tab === 'badges'));
    text('collection-title', tab === 'monsters' ? 'モンスターずかん' : 'バッジずかん');
    if (tab === 'badges') profile.renderBadges(); else renderCollection();
    showScreen('collection');
  }

  function hasStoryProgress() {
    return save.story.midbossClear || save.story.endingSeen || save.dungeon.highestFloor > 0 ||
      Object.values(save.story.stages).some(stage => stage.bossClear || Object.values(stage.routes || {}).some(route => route.clear));
  }

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
  const settingsSheet = $('settings-sheet');
  $('settings-open').addEventListener('click', () => {
    settingsSheet.showModal(); modal = true; updatePause();
    $('settings-close').focus({ preventScroll: true });
  });
  $('settings-close').addEventListener('click', () => settingsSheet.close());
  settingsSheet.addEventListener('click', event => { if (event.target === settingsSheet) settingsSheet.close(); });
  settingsSheet.addEventListener('close', () => {
    modal = false; updatePause();
    $('settings-open').focus({ preventScroll: true });
  });
  $('untimed-toggle').checked = save.settings.untimed;
  $('untimed-toggle').addEventListener('change', () => {
    save.settings.untimed = $('untimed-toggle').checked; persist();
    if (battle && !locked) { stopTimer(); startTimer(); }
  });
  $('home-continue').addEventListener('click', () => {
    const action = nextStoryAction();
    if (action.kind === 'dungeon') { renderAbyss(); showScreen('abyss'); $('dungeon-title').focus({ preventScroll: true }); }
    else startStory(action);
  });
  $('home-map-open').addEventListener('click', () => {
    renderMap(); showScreen('map'); $('map-title').focus({ preventScroll: true });
  });
  $('home-abyss-open').addEventListener('click', event => {
    event.preventDefault(); renderAbyss(); showScreen('abyss'); $('dungeon-title').focus({ preventScroll: true });
  });
  $('bottom-nav').addEventListener('click', event => {
    const item = event.target.closest('[data-nav]');
    if (!item) return;
    if (item.dataset.nav === 'home') { renderHome(); showScreen('home'); }
    else showCollection(item.dataset.nav === 'badges' ? 'badges' : 'monsters');
  });
  $('collection-monsters-tab').addEventListener('click', () => showCollection('monsters'));
  $('collection-badges-tab').addEventListener('click', () => showCollection('badges'));
  $('route-sheet-close').addEventListener('click', () => $('route-sheet').close());
  $('route-sheet').addEventListener('click', event => { if (event.target === $('route-sheet')) $('route-sheet').close(); });
  $('route-sheet').addEventListener('close', () => {
    if (currentScreen === 'map' && questOpener?.isConnected) questOpener.focus({ preventScroll: true });
  });
  $('route-sheet-start').addEventListener('click', () => {
    const options = pendingQuest;
    pendingQuest = null;
    $('route-sheet').close();
    if (options) startStory(options);
  });
  $('leave-battle').addEventListener('click', () => {
    stopTimer(); clearTimeout(advance); questionToken++; battle = null; locked = false;
    renderMap(); showScreen('map'); $('map-title').focus({ preventScroll: true });
  });
  $('restart-button').addEventListener('click', () => {
    if (battle?.kind === 'dungeon' && !save.dungeon.completed) { startDungeon(); return; }
    const action = nextStoryAction();
    if (action.kind === 'dungeon') { battle = null; renderAbyss(); showScreen('abyss'); $('dungeon-title').focus({ preventScroll: true }); }
    else startStory(action);
  });
  $('result-map-button').addEventListener('click', () => {
    battle = null; selectedStage = nextStoryAction().stageId || 9;
    renderMap(); showScreen('map'); $('map-title').focus({ preventScroll: true });
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
      $('quiz-panel').classList.toggle('is-timer-urgent', rest > 0 && rest <= 3000);
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
  function setStageTheme(theme) {
    const accent = stageAccents[theme] || stageAccents.abyss;
    document.documentElement.style.setProperty('--stage-accent', accent);
    document.documentElement.style.setProperty('--accent', accent);
    document.body.dataset.theme = theme;
  }

  function renderHome() {
    profile.render();
    const action = nextStoryAction();
    const stage = STAGES[(action.stageId || 9) - 1];
    const isAbyss = action.kind === 'dungeon';
    const theme = isAbyss ? 'abyss' : action.kind === 'midboss' ? 'machine' : stage.theme;
    const background = isAbyss ? 'abyss' : action.kind === 'midboss' ? 'reactor' : stage.theme;
    const source = isAbyss
      ? save.dungeon.completed ? 'boss-zero' : `enemy-abyss-${generateFloor(save.dungeon.seed, save.dungeon.floor, save.dungeon.generationVersion).variant}`
      : action.kind === 'midboss' ? 'boss-mid'
        : action.kind === 'boss' ? `boss-${stage.id}`
          : action.route === 'random' ? `guardian-${stage.id}` : `enemy-${stage.id}-0`;
    const route = action.kind === 'dungeon' ? `${save.dungeon.floor}F`
      : action.kind === 'midboss' ? 'ちゅうボス'
        : action.kind === 'boss' ? stage.id === 9 ? 'ラスボス' : 'エリアボス'
          : ROUTES.find(item => item.id === action.route)?.name || '';
    setStageTheme(theme);
    $('home-hero').dataset.theme = theme;
    $('home-background').src = assetUrl(`bg-${background}`);
    $('home-enemy').src = assetUrl(source);
    $('home-enemy').alt = assetName(source, isAbyss ? '深淵のモンスター' : stage.boss);
    text('home-stage', isAbyss ? 'ENDLESS' : `STAGE ${stage.id}`);
    text('home-route-label', route);
    text('home-dan', isAbyss ? save.dungeon.completed ? '深淵を せいは！' : '九九のちからを ためそう' : stage.dan ? `${stage.dan}の段` : '九九ミックス');
    text('home-area', isAbyss ? '九九の深淵' : action.kind === 'midboss' ? 'きかいのまち地下' : stage.name);
    text('home-next', isAbyss ? save.dungeon.completed ? STORY.awakened : `${save.dungeon.floor}Fへ ちょうせん！` : action.kind === 'route' ? '9もんに ちょうせん！' : action.kind === 'midboss' ? '8もんの ちゅうボスせん！' : stage.id === 9 ? 'ラストバトルに ちょうせん！' : 'エリアボスに ちょうせん！');
    weaponIndex = unlockedWeapon(save.story, save.dungeon);
    text('home-equipment-name', WEAPONS[weaponIndex]);
    $('home-weapon').src = assetUrl(`weapon-${weaponIndex}`);
    $('home-weapon').alt = '';
    text('home-continue', '');
    $('home-continue').append(document.createTextNode(isAbyss ? save.dungeon.completed ? '深淵を もういちど' : '深淵を つづける' : hasStoryProgress() ? 'つづきから' : 'ぼうけんを はじめる'));
    const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '›'; $('home-continue').append(arrow);
    $('home-abyss-open').hidden = !save.story.endingSeen;
    return action;
  }

  function renderMap() {
    const action = nextStoryAction();
    selectedStage = action.stageId || 9;
    profile.render();
    const path = $('stage-list'); path.replaceChildren();
    for (const stage of STAGES) {
      const progress = stageProgress(save.story, stage.id), unlocked = isStageUnlocked(save.story, stage.id);
      const node = button('', () => { selectedStage = stage.id; renderRoutes(); });
      const marker = document.createElement('span'); marker.className = 'stage-node-marker'; marker.textContent = progress.bossClear ? '✓' : unlocked ? String(stage.id) : '🔒'; marker.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('span'); copy.className = 'stage-node-copy';
      const title = document.createElement('strong'); title.textContent = stage.name;
      const subtitle = document.createElement('small'); subtitle.textContent = stage.dan ? `${stage.dan}の段` : '九九ミックス';
      const state = document.createElement('span'); state.className = 'stage-node-state';
      state.textContent = progress.bossClear ? 'CLEAR' : unlocked ? stage.id === action.stageId ? 'ここから' : 'すすむ' : 'とびらは まだ';
      copy.append(title, subtitle); node.append(marker, copy, state);
      node.className = 'stage-node'; node.dataset.state = progress.bossClear ? 'complete' : unlocked ? 'open' : 'locked';
      node.classList.toggle('is-current', stage.id === selectedStage);
      node.disabled = !unlocked;
      node.setAttribute('aria-pressed', String(stage.id === selectedStage));
      node.setAttribute('aria-label', `${stage.name}、${stage.dan ? `${stage.dan}の段` : '九九ミックス'}、${progress.bossClear ? 'クリア' : unlocked ? '入れる' : '鍵がかかっている'}`);
      if (stage.id === selectedStage) node.setAttribute('aria-current', 'step');
      path.append(node);
    }
    text('map-stage-count', `STAGE ${selectedStage} / 9`);
    text('story-intro', save.story.endingSeen ? STORY.ending : save.story.midbossClear ? STORY.tutorial : STORY.opening);
    text('legacy-best', save.profile.legacyBest ? `むかしの記録　${save.profile.legacyBest} / 10` : '');
    renderRoutes();
  }

  function makeRouteNode({ label, detail, state, marker, options }) {
    const node = button('', () => openQuestSheet(options, node), state === 'locked');
    node.className = 'route-node'; node.dataset.state = state;
    const icon = document.createElement('span'); icon.className = 'route-node-marker'; icon.textContent = marker; icon.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span'); copy.className = 'route-node-copy';
    const title = document.createElement('strong'); title.textContent = label;
    const subtitle = document.createElement('small'); subtitle.textContent = detail;
    copy.append(title, subtitle);
    const stateText = document.createElement('span'); stateText.className = 'route-node-state';
    stateText.textContent = state === 'complete' ? 'CLEAR' : state === 'locked' ? '🔒' : state === 'current' ? 'つぎ' : 'もういちど';
    node.append(icon, copy, stateText);
    node.setAttribute('aria-label', `${label}。${detail}${state === 'complete' ? ' クリアずみ' : state === 'locked' ? ' まだ入れない' : ''}`);
    return node;
  }

  function openQuestSheet(options, opener) {
    pendingQuest = options; questOpener = opener;
    const stage = STAGES[options.stageId - 1];
    const route = ROUTES.find(item => item.id === options.route);
    const routeLabel = options.kind === 'midboss' ? 'こんらんまじん' : options.kind === 'boss' ? stage.boss : route.name;
    text('route-sheet-kicker', options.kind === 'midboss' ? 'STAGE 4 • MID BOSS' : `STAGE ${stage.id} • ${stage.name}`);
    text('route-sheet-title', routeLabel);
    const range = options.kind === 'route' ? route.id === 'ascending'
      ? `${stage.dan} × 1　→　${stage.dan} × 9`
      : route.id === 'descending' ? `${stage.dan} × 9　→　${stage.dan} × 1` : `${stage.dan} × 1〜9を シャッフル`
      : options.kind === 'midboss' ? '2・3・5・4の段 ミックス' : stage.id === 9 ? '2〜9の段 ミックス' : `${stage.dan}の段`;
    text('route-sheet-facts', range);
    text('route-sheet-description', options.kind === 'route' ? '9もんの バトル！' : options.kind === 'midboss' ? '8もんの ちゅうボスせん！' : stage.id === 9 ? '12もんの ラストバトル！' : '9もんの ボスバトル！');
    $('route-sheet').showModal(); $('route-sheet-start').focus({ preventScroll: true });
  }

  function renderRoutes() {
    const stage = STAGES[selectedStage - 1], progress = stageProgress(save.story, selectedStage), action = nextStoryAction();
    setStageTheme(stage.theme);
    text('area-title', stage.name);
    $('route-list').replaceChildren();
    if (stage.id <= 8) for (let index = 0; index < ROUTES.length; index++) {
      const route = ROUTES[index], record = progress.routes[route.id], unlocked = isRouteUnlocked(save.story, stage.id, route.id);
      const state = record?.clear ? 'complete' : !unlocked ? 'locked' : action.stageId === stage.id && action.kind === 'route' && action.route === route.id ? 'current' : 'available';
      const detail = route.id === 'ascending' ? `${stage.dan} × 1 から × 9` : route.id === 'descending' ? `${stage.dan} × 9 から × 1` : `${stage.dan} × 1〜9を 1かいずつ`;
      const node = makeRouteNode({ label: route.name, detail: record?.clear ? `${'★'.repeat(record.stars)}　${detail}` : detail, state, marker: String(index + 1), options: { stageId: stage.id, kind: 'route', route: route.id } });
      $('route-list').append(node);
    }
    const bossState = progress.bossClear ? 'complete' : isBossUnlocked(save.story, stage.id) ? action.kind === 'boss' && action.stageId === stage.id ? 'current' : 'available' : 'locked';
    const boss = makeRouteNode({ label: stage.id === 9 ? `ラスボス　${stage.boss}` : stage.boss, detail: progress.bossClear ? 'やっつけた！' : stage.id === 9 ? '12もんの ラストバトル' : '3つのみちを CLEARすると あえる', state: bossState, marker: '★', options: { stageId: stage.id, kind: 'boss' } });
    boss.classList.add('is-boss-node'); $('route-list').append(boss);
    if (stage.id === 4) {
      const state = save.story.midbossClear ? 'complete' : progress.bossClear ? action.kind === 'midboss' ? 'current' : 'available' : 'locked';
      $('route-list').append(makeRouteNode({ label: 'こんらんまじん', detail: '2・3・5・4の段 ミックス', state, marker: '◆', options: { stageId: 4, kind: 'midboss' } }));
    }
    text('route-guide', stage.id === 9 ? '8つの国の 九九の力をあわせよう。' : 'みちをひとつずつ すすもう。★の数は 進み方に関係ないよ。');
    for (const node of $('stage-list').children) {
      const active = node.querySelector('.stage-node-copy strong')?.textContent === stage.name;
      node.setAttribute('aria-pressed', String(active));
      node.classList.toggle('is-current', active);
      if (active) node.setAttribute('aria-current', 'step'); else node.removeAttribute('aria-current');
    }
    text('map-stage-count', `STAGE ${selectedStage} / 9`);
    text('equipment', WEAPONS[unlockedWeapon(save.story, save.dungeon)]);
  }

  function renderCollection() {
    profile.renderBadges();
    const abyssVariants = new Set();
    for (let floor = 1; floor <= save.dungeon.highestFloor; floor++) {
      const metadata = generateFloor(save.dungeon.seed, floor, save.dungeon.generationVersion);
      if (metadata.kind === 'normal') abyssVariants.add(metadata.variant);
    }
    const catalog = VISUAL_ASSETS.filter(item => item.kind === 'boss' || item.kind === 'guardian' || (item.kind === 'enemy' && (item.stage <= 8 || item.stage === 10)));
    const grid = $('monster-grid'); grid.replaceChildren();
    let metCount = 0;
    for (const asset of catalog) {
      let met = false, defeated = false;
      if (asset.id === 'boss-mid') { met = save.story.midbossClear; defeated = met; }
      else if (asset.id === 'boss-zero') { met = save.dungeon.completed; defeated = met; }
      else if (asset.stage === 10) { met = abyssVariants.has(Number(asset.id.split('-').at(-1))); defeated = met; }
      else {
        const progress = stageProgress(save.story, asset.stage);
        if (asset.kind === 'boss') { met = asset.stage === 9 ? save.story.endingSeen : progress.bossClear; defeated = met; }
        else if (asset.kind === 'guardian') { met = progress.routes.random?.clear === true; defeated = met; }
        else { met = Object.values(progress.routes).some(route => route.clear); defeated = met; }
      }
      const card = document.createElement('article'); card.className = 'monster-card'; card.classList.toggle('is-unknown', !met);
      const image = document.createElement('img'); image.src = assetUrl(asset.id); image.alt = met ? asset.name : 'まだ会っていないモンスター'; image.loading = 'lazy';
      const name = document.createElement('strong'); name.textContent = met ? asset.name : '？？？';
      const kind = document.createElement('span'); kind.className = 'monster-kind'; kind.textContent = asset.kind === 'boss' ? 'ボス' : asset.kind === 'guardian' ? '守護者' : 'モンスター';
      const status = document.createElement('small'); status.textContent = defeated ? 'たおした！' : met ? '出会った' : 'まだひみつ';
      card.append(image, name, kind, status); grid.append(card);
      if (met) metCount++;
    }
    text('collection-total', `${metCount} / ${catalog.length}ひき`);
  }

  function renderAbyss() {
    if (!save.story.endingSeen) return;
    setStageTheme('abyss');
    const metadata = generateFloor(save.dungeon.seed, save.dungeon.floor, save.dungeon.generationVersion);
    const source = metadata.kind === 'final' ? 'boss-zero' : metadata.kind === 'normal' ? `enemy-abyss-${metadata.variant}` : 'boss-9';
    $('abyss-art').src = assetUrl(source); $('abyss-art').alt = assetName(source, '深淵のモンスター');
    text('abyss-floor-pill', `${save.dungeon.floor} / 100F`);
    text('dungeon-guide', save.dungeon.completed ? STORY.awakened : STORY.abyss);
    text('abyss-current-copy', save.dungeon.completed ? '100Fを せいは！' : `${save.dungeon.floor}F　${metadata.kind === 'normal' ? 'ふつうの階' : metadata.kind === 'elite' ? '強敵' : metadata.kind === 'final' ? 'ラスボス' : 'ボス'}`);
    text('dungeon-start', save.dungeon.completed ? '100Fに もういちど' : `${save.dungeon.floor}Fから つづける`);
    $('tower-panel').hidden = false;
    renderTower();
  }

  function startDungeon() {
    if (!save.story.endingSeen) return;
    selectedStage = 9;
    const metadata = generateFloor(save.dungeon.seed, save.dungeon.floor, save.dungeon.generationVersion);
    battle = createBattle({ kind: 'dungeon', stageId: 9, metadata, questions: buildFloorQuestions(metadata, save.dungeon, save.mastery), guardian: false, waves: false, maxHp: metadata.count, seconds: metadata.seconds, reward: metadata.reward });
    weaponIndex = metadata.floor === 100 ? 4 : 3;
    beginBattle();
  }
  function startStory(options) {
    if (options.kind === 'route' ? !isRouteUnlocked(save.story, options.stageId, options.route) : options.kind === 'midboss' ? !stageProgress(save.story, 4).bossClear : !isBossUnlocked(save.story, options.stageId)) return;
    selectedStage = options.stageId;
    battle = createStoryBattle(options, save.mastery);
    weaponIndex = STAGES[selectedStage - 1].weapon;
    beginBattle();
  }
  $('dungeon-start').addEventListener('click', startDungeon);
  function beginBattle() {
    stopTimer(); clearTimeout(advance); paused = false; locked = false; roundCrystals = 0; choiceFallback = false;
    showScreen('battle');
    $('battle-log').replaceChildren(); text('pause-button', 'ひとやすみ');
    $('pause-button').setAttribute('aria-pressed', 'false');
    const stage = STAGES[selectedStage - 1];
    text('battle-place', battle.kind === 'dungeon' ? `九九の深淵 ${battle.metadata.floor}F` : battle.kind === 'midboss' ? 'きかいのまち地下' : stage.name);
    text('battle-route', battle.kind === 'route' ? ROUTES.find(route => route.id === battle.route).name : 'ボスの しれん');
    text('weapon-name', WEAPONS[weaponIndex]);
    $('weapon-art').src = assetUrl(`weapon-${weaponIndex}`);
    $('weapon-art').alt = WEAPONS[weaponIndex];
    $('weapon-beads').hidden = weaponIndex !== 0;
    $('battle-scene').style.backgroundImage = `url("${assetUrl(`bg-${battle.kind === 'dungeon' ? 'abyss' : battle.kind === 'midboss' ? 'reactor' : stage.theme}`)}")`;
    $('fallback-button').hidden = selectedStage !== 5;
    log(battle.kind === 'midboss' ? STORY.midboss : selectedStage === 5 ? STORY.tutorial : '九九の力で こうげきしよう！');
    renderTower(); renderQuestion(true);
  }
  function renderTower() {
    const dungeon = battle?.kind === 'dungeon';
    $('tower-panel').hidden = !save.story.endingSeen;
    if (!save.story.endingSeen) return;
    const floor = dungeon ? battle.metadata.floor : save.dungeon.floor, start = Math.floor((floor - 1) / 10) * 10 + 1;
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
    if (battle.kind !== 'dungeon') name = assetName(source, name);
    text('enemy-name', name); $('enemy-art').src = assetUrl(source); $('enemy-art').alt = name;
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
    const showTimer = battle.seconds > 0 && !save.settings.untimed && !battle.timedOut;
    $('best-score').hidden = !showTimer;
    $('quiz-panel').classList.toggle('has-timer', showTimer);
    $('quiz-panel').classList.remove('is-timer-urgent');
    text('score', battle.firstCorrect);
    text('streak-chip', `${battle.streak}もん れんぞく`);
    $('streak-chip').classList.toggle('is-hot', weaponIndex >= 2 && battle.streak >= 3);
    const completed = battle.completedFacts.size;
    $('progress').setAttribute('aria-valuemax', battle.originalCount);
    $('progress').setAttribute('aria-valuenow', completed);
    $('progress-fill').style.width = `${completed / battle.originalCount * 100}%`;
    text('feedback', battle.timedOut ? 'さっきの問題だよ。今度は 時間なしで こたえよう。' : selectedStage === 5 && !choiceFallback ? STORY.tutorial : 'こたえで こうげきしよう！');
    text('hint', ''); $('timer-meter').style.width = '100%';
    $('battle-scene').classList.remove('is-attacking', 'is-critical');
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
    $('battle-scene').classList.remove('is-critical', 'is-attacking'); $('weapon-beads').classList.remove('is-click');
    void $('enemy-art').offsetWidth;
    $('enemy-art').classList.add('is-hit'); $('weapon-art').classList.add('is-attack'); $('battle-scene').classList.add('is-attacking'); audio.play('correct', outcome.firstTry);
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
    $('badge-book-button').disabled = false;
    const stars = battleStars(battle);
    const oldWeapon = weaponIndex;
    grant(battle.reward);
    if (battle.kind === 'dungeon') completeFloor(save.dungeon, battle.questions);
    else completeStoryBattle(save.story, battle, stars);
    persist(); profile.render(); profile.renderFinish();
    const stageClear = battle.kind === 'boss';
    const newWeapon = unlockedWeapon(save.story, save.dungeon);
    text('finish-kicker', stageClear ? 'STAGE CLEAR!' : 'QUEST CLEAR!');
    text('finish-title', battle.kind === 'dungeon' ? `${battle.metadata.floor}F クリア！` : stageClear ? 'STAGE CLEAR!' : 'クリア！');
    let message = '考えて こたえた！ 九九の力が アップしたね。';
    if (battle.stageId === 9 && battle.kind === 'boss') message = STORY.ending;
    else if (battle.metadata?.floor === 100) message = STORY.awakened;
    else if (battle.kind === 'midboss') message = STORY.tutorial;
    else if (battle.kind === 'boss' && selectedStage === 6) message = STORY.hero;
    else if (battle.kind === 'boss' && selectedStage === 8) message = STORY.legendary;
    else if (stageClear) message = `${STAGES[battle.stageId - 1].name}を クリア！`;
    const weaponUpgrade = battle.kind === 'boss' && newWeapon > oldWeapon;
    if (weaponUpgrade) message = 'あたらしい ぶきを てにいれた！';
    text('finish-message', message);
    $('finish-weapon').hidden = !weaponUpgrade;
    if (weaponUpgrade) {
      $('finish-weapon-art').src = assetUrl(`weapon-${newWeapon}`);
      text('finish-weapon-name', WEAPONS[newWeapon]);
    }
    text('final-score', battle.firstCorrect); text('final-count', battle.originalCount);
    text('final-streak', battle.maxStreak); text('final-crystals', roundCrystals); text('final-total-crystals', save.profile.crystals);
    document.querySelectorAll('.finish-star').forEach((node, i) => node.classList.toggle('is-filled', i < stars));
    $('finish-medal').setAttribute('aria-label', `${stars}つ星のクリアメダル`);
    text('best-message', '★の数や 時間で、つぎへ進めなくなることは ないよ。');
    $('finish-panel').classList.toggle('is-stage-clear', stageClear);
    $('finish-panel').classList.toggle('is-abyss-final', battle.kind === 'dungeon' && battle.metadata.floor === 100);
    nextAfterResult = nextStoryAction();
    let nextLabel = battle.kind === 'dungeon' ? save.dungeon.completed ? '100Fを もういちど' : 'つぎの階へ'
      : nextAfterResult.kind === 'dungeon' ? '深淵へすすむ'
        : nextAfterResult.kind === 'midboss' ? 'ちゅうボスへ'
          : nextAfterResult.kind === 'boss' ? 'ボスへすすむ' : 'つぎの みちへ';
    const nextButton = $('restart-button'); nextButton.replaceChildren(document.createTextNode(nextLabel));
    const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '›'; nextButton.append(arrow);
    showScreen('result');
    $('restart-button').focus({ preventScroll: true });
  }
  syncSound();
  renderCollection(); renderMap(); renderHome(); renderAbyss();
  showScreen('home');
}
