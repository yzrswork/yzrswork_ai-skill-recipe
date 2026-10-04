// Responsive UI, navigation, mobile interaction and screenshot evidence.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const axeModule = await import(process.env.AXE_MODULE ? pathToFileURL(process.env.AXE_MODULE).href : '@axe-core/playwright');
const AxeBuilder = axeModule.default?.default || axeModule.default;
const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const evidence = process.env.KUKU_EVIDENCE || resolve(root, 'kuku/evidence/modern-ui');
await mkdir(evidence, { recursive: true });
const prefix = '/yzrswork_ai-skill-recipe/';
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!pathname.startsWith(prefix)) throw Error('bad path');
    let path = resolve(root, pathname.slice(prefix.length));
    if (pathname.endsWith('/')) path = resolve(path, 'index.html');
    if (!path.startsWith(root + sep)) throw Error('outside root');
    const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.webp':'image/webp' }[extname(path)];
    res.writeHead(200, { 'Content-Type': mime || 'application/octet-stream' }); res.end(await readFile(path));
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}${prefix}kuku/`;
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };
const snap = async (page, name) => page.screenshot({ path: resolve(evidence, `${name}.png`), fullPage: true });
async function audit(page, name) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  check(report.violations.length === 0, `${name} axe violations: ${JSON.stringify(report.violations.map(v => ({id:v.id, targets:v.nodes.map(n => n.target)})))}`);
}
async function noOverflow(page, label) {
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: no horizontal overflow`);
}
async function fixture(page, { stage = 1, routesClear = false, encounter = false, floor = null } = {}) {
  await page.goto(base);
  await page.evaluate(async ({ stage, routesClear, encounter, floor }) => {
    const { newSave } = await import('./js/save.js');
    const { SAVE_KEY } = await import('./js/config.js');
    const save = newSave(`modern-ui-${stage}-${floor || 'story'}`);
    const routes = ['ascending','descending','random'];
    for (let id = 1; id < stage; id++) save.story.stages[id] = {
      routes: Object.fromEntries(routes.map(route => [route, { clear:true, stars:2 }])), bossClear:true,
    };
    if (stage >= 5 || floor) save.story.midbossClear = true;
    if (routesClear) save.story.stages[stage] = {
      routes: Object.fromEntries(routes.map(route => [route, { clear:true, stars:2 }])), bossClear:false,
    };
    if (encounter) save.story.stages[1] = { routes:{ ascending:{clear:true,stars:3} }, bossClear:false };
    if (floor) {
      for (let id = 1; id <= 9; id++) save.story.stages[id] ||= { routes:Object.fromEntries(routes.map(route => [route,{clear:true,stars:2}])), bossClear:true };
      save.story.endingSeen = true; save.dungeon.floor = floor; save.dungeon.highestFloor = floor - 1;
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, { stage, routesClear, encounter, floor });
  await page.reload();
  if (floor) { await page.locator('#home-continue').click(); await page.locator('#abyss-panel').waitFor({ state:'visible' }); }
  else { await page.locator('#home-map-open').click(); await page.locator('#route-list button').first().waitFor({ state:'visible' }); }
}
async function startNode(page, index = 0) {
  const node = page.locator('#route-list button').nth(index);
  await node.click();
  await page.locator('#route-sheet-start').click();
  await page.locator('#quiz-panel').waitFor({ state:'visible' });
}
async function solveBattle(page) {
  let answered = 0;
  while (await page.locator('#quiz-panel').isVisible()) {
    const a = Number(await page.locator('#factor-a').innerText());
    const b = Number(await page.locator('#factor-b').innerText());
    if (await page.locator('#keypad-display').isVisible()) {
      for (const digit of String(a * b)) await page.getByRole('button', { name:`${digit}を入力`, exact:true }).click();
      await page.getByRole('button', { name:'こたえで こうげき', exact:true }).click();
    } else await page.getByRole('button', { name:`${a * b}を選ぶ`, exact:true }).click();
    await page.waitForTimeout(220);
    assert.ok(++answered <= 25, 'battle completes in a bounded number of answers');
  }
  await page.locator('#finish-panel').waitFor({ state:'visible' });
  return answered;
}

try {
  const engines = (process.env.KUKU_ENGINES || 'chromium,webkit').split(',');
  for (const engine of engines) {
    const browser = await pw[engine].launch({ headless:true });
    try {
      const context = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, reducedMotion:'reduce' });
      const page = await context.newPage(), errors = [], failed = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });

      await page.goto(base); await page.locator('#home-continue').waitFor();
      check((await page.locator('#home-continue').innerText()).includes('ぼうけんを はじめる'), `${engine}: clear first-run action`);
      await noOverflow(page, `${engine} HOME`); await audit(page, `${engine} HOME`);
      if (engine === 'chromium') await snap(page, 'home-after');

      await page.locator('#home-map-open').click();
      check(await page.locator('#route-list button').count() === 4, `${engine}: map shows route path and locked boss`);
      check(await page.locator('#route-list button').nth(1).isDisabled(), `${engine}: locked route has no action`);
      await noOverflow(page, `${engine} MAP`); await audit(page, `${engine} MAP`);
      if (engine === 'chromium') await snap(page, 'adventure-map');

      const firstRoute = page.locator('#route-list button').first();
      await firstRoute.click();
      check(await page.locator('#route-sheet').evaluate(el => el.open), `${engine}: route opens bottom sheet`);
      check(await page.locator('#route-sheet').evaluate(el => el.matches(':modal')), `${engine}: route sheet is modal`);
      await noOverflow(page, `${engine} route sheet`); await audit(page, `${engine} route sheet`);
      if (engine === 'chromium') await snap(page, 'route-sheet');
      await page.keyboard.press('Escape');
      check(await firstRoute.evaluate(el => el === document.activeElement), `${engine}: Escape closes sheet and restores focus`);
      await firstRoute.click(); await page.locator('#route-sheet-start').click();
      await page.locator('#enemy-art').evaluate(img => img.decode());
      const enemyBox = await page.locator('#enemy-art').boundingBox();
      check(enemyBox.height >= 200 && enemyBox.width >= 200, `${engine}: battle enemy is large enough`);
      check(await page.locator('#quiz-panel .screen-reader-log').evaluate(el => getComputedStyle(el).position === 'absolute'), `${engine}: visible battle log is removed from the primary UI`);
      await noOverflow(page, `${engine} battle`); await audit(page, `${engine} battle`);
      if (engine === 'chromium') await snap(page, 'stage-1-battle');
      check(await solveBattle(page) === 9, `${engine}: route result follows the full nine-question bag`);
      check(await page.locator('#finish-title').innerText() === 'クリア！', `${engine}: normal result stays concise`);
      await audit(page, `${engine} result`);
      if (engine === 'chromium') await snap(page, 'result');

      await fixture(page, { stage:1, routesClear:true });
      await startNode(page, 3);
      check((await page.locator('#enemy-art').getAttribute('src')).endsWith('boss-1.webp'), `${engine}: boss node starts its own battle`);
      await solveBattle(page);
      check(await page.locator('#finish-panel').evaluate(el => el.classList.contains('is-stage-clear')), `${engine}: only the route-gated boss gets Stage Clear celebration`);
      check((await page.locator('#finish-title').innerText()).includes('STAGE CLEAR'), `${engine}: boss result is distinct`);
      check((await page.locator('#finish-panel').boundingBox()).height >= 700, `${engine}: Stage Clear fills the mobile view`);
      check(await page.locator('#finish-weapon').isHidden(), `${engine}: no false equipment reveal before an upgrade`);
      await audit(page, `${engine} Stage Clear`);
      if (engine === 'chromium') await snap(page, 'stage-clear');

      await fixture(page, { stage:6, routesClear:true });
      await startNode(page, 3);
      await solveBattle(page);
      check(await page.locator('#finish-weapon').isVisible(), `${engine}: newly earned weapon gets a visual reveal`);
      check((await page.locator('#finish-weapon-name').innerText()).includes('ゆうしゃの電卓'), `${engine}: reveal matches the existing Stage 6 weapon progression`);
      await page.locator('#finish-weapon-art').evaluate(img => img.decode());
      await audit(page, `${engine} Stage 6 weapon reward`);
      if (engine === 'chromium') await snap(page, 'stage-6-weapon-clear');
      for (const width of [320,375,390,430]) {
        await page.setViewportSize({ width, height:844 });
        await noOverflow(page, `${engine} Stage Clear ${width}px`);
      }
      await page.setViewportSize({ width:390, height:844 });

      await fixture(page, { stage:4, routesClear:true });
      await startNode(page, 3);
      check((await page.locator('#enemy-name').innerText()).includes('しさんゴーレム'), `${engine}: Stage 4 boss name`);
      if (engine === 'chromium') await snap(page, 'stage-4-boss');
      await audit(page, `${engine} Stage 4 boss`);

      await fixture(page, { stage:5 });
      await startNode(page, 0);
      check(await page.locator('#answers button').count() === 12, `${engine}: Stage 5 renders a 3×4 in-game keypad`);
      check(await page.locator('#quiz-panel input').count() === 0, `${engine}: keypad does not invoke an OS keyboard`);
      await noOverflow(page, `${engine} keypad`); await audit(page, `${engine} keypad`);
      if (engine === 'chromium') await snap(page, 'stage-5-keypad');

      await fixture(page, { stage:7 });
      await startNode(page, 0);
      check((await page.locator('#timer-label').textContent()).includes('20'), `${engine}: Stage 7 shows the 20-second timer`);
      if (engine === 'chromium') await snap(page, 'stage-7-timer');
      await page.locator('#pause-button').click();
      await audit(page, `${engine} timed battle`);

      await fixture(page, { stage:1, encounter:true });
      await page.locator('[data-nav="monsters"]').click();
      check(await page.locator('#monster-grid .monster-card').count() === 46, `${engine}: collection keeps the complete WebP roster`);
      check((await page.locator('#collection-total').innerText()).startsWith('3 / 46'), `${engine}: collection shows only persisted encounters`);
      await page.locator('#monster-grid img').evaluateAll(images => Promise.all(images.map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); })));
      await noOverflow(page, `${engine} monster collection`); await audit(page, `${engine} monster collection`);
      if (engine === 'chromium') await snap(page, 'collection-monsters');
      await page.locator('#collection-badges-tab').click();
      check(await page.locator('#main-badge-grid .badge-card').count() === 20, `${engine}: collection keeps all 20 existing badges`);
      await audit(page, `${engine} badge collection`);
      if (engine === 'chromium') await snap(page, 'collection-badges');

      await fixture(page, { stage:9, floor:51 });
      check(await page.locator('.tower-node').count() === 10, `${engine}: abyss retains the 10-node floor block`);
      check((await page.locator('#tower-title').innerText()).includes('51〜60F'), `${engine}: abyss shows the current 10-floor segment`);
      await noOverflow(page, `${engine} abyss`); await audit(page, `${engine} abyss`);
      if (engine === 'chromium') await snap(page, 'abyss-51f');

      await page.locator('#settings-open').click(); await audit(page, `${engine} settings sheet`);
      await page.keyboard.press('Escape');
      check(await page.locator('#settings-open').evaluate(el => el === document.activeElement), `${engine}: settings restores focus`);

      await fixture(page, { stage:1 });
      for (const width of [320,375,390,430,768,1280]) {
        await page.setViewportSize({ width, height:844 });
        await noOverflow(page, `${engine} ${width}px`);
      }
      check(errors.length === 0, `${engine} JavaScript errors: ${errors}`);
      check(failed.length === 0, `${engine} failed network requests: ${failed}`);
      await context.close();
      console.log(`${engine}: modern mobile navigation, gameplay shell, responsive sizing, axe and evidence passed`);
    } finally { await browser.close(); }
  }
  console.log(`${checks} modern UI browser checks passed`);
} finally { await new Promise(done => server.close(done)); }
