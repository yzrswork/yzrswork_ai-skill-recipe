import { ROUTES, STAGES } from './config.js';
export function stageProgress(story, stageId) {
  return story.stages[stageId] || { routes: {}, bossClear: false };
}
export function isStageUnlocked(story, stageId) {
  if (!STAGES.some(stage => stage.id === stageId)) return false;
  if (stageId === 1) return true;
  if (stageId === 5 && !story.midbossClear) return false;
  return stageProgress(story, stageId - 1).bossClear === true;
}
export function isBossUnlocked(story, stageId) {
  return isStageUnlocked(story, stageId) && (stageId === 9 || ROUTES.every(route => stageProgress(story, stageId).routes[route.id]?.clear));
}
export function isRouteUnlocked(story, stageId, routeId) {
  const index = ROUTES.findIndex(route => route.id === routeId);
  return stageId <= 8 && isStageUnlocked(story, stageId) && index >= 0 &&
    (index === 0 || stageProgress(story, stageId).routes[ROUTES[index - 1].id]?.clear === true);
}
export function starsFor(firstCorrect, total = 9) {
  if (firstCorrect === total) return 3;
  return firstCorrect >= Math.ceil(total * 7 / 9) ? 2 : 1;
}
export function completeStoryBattle(story, { stageId, kind, route }, stars) {
  if (kind === 'midboss') { story.midbossClear = true; return; }
  const progress = story.stages[stageId] ||= { routes: {}, bossClear: false };
  if (kind === 'route') {
    progress.routes[route] = { clear: true, stars: Math.max(stars, progress.routes[route]?.stars || 0) };
  } else {
    progress.bossClear = true;
    if (stageId === 9) story.endingSeen = true;
  }
}
export function unlockedWeapon(story, dungeon) {
  if (dungeon.completed) return 4;
  if (stageProgress(story, 8).bossClear) return 3;
  if (stageProgress(story, 6).bossClear) return 2;
  return story.midbossClear ? 1 : 0;
}
