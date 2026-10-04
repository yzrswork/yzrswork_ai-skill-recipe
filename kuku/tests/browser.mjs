// Test-only dependencies live outside the production app (see README).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const axe = await import(process.env.AXE_MODULE ? pathToFileURL(process.env.AXE_MODULE).href : '@axe-core/playwright');
const AxeBuilder = axe.default.default || axe.default;
const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const evidence = process.env.KUKU_EVIDENCE || resolve(root, '../kuku-evidence');
await mkdir(evidence, { recursive: true });
const prefix = '/yzrswork_ai-skill-recipe/';
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!pathname.startsWith(prefix)) throw Error('bad prefix');
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
async function fixture(page, stage = 1, floor = null) {
  await page.evaluate(async ({stage, floor}) => {
    const { newSave } = await import('./js/save.js');
    const { SAVE_KEY } = await import('./js/config.js');
    const save = newSave('browser-seed');
    for (let i = 1; i <= (floor ? 9 : stage - 1); i++) save.story.stages[i] = {
      routes: Object.fromEntries(['ascending','descending','random'].map(id => [id,{clear:true,stars:1}])), bossClear:true,
    };
    save.story.midbossClear = stage > 4 || !!floor;
    if (floor) { save.story.endingSeen = true; save.dungeon.floor = floor; save.dungeon.highestFloor = floor - 1; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, {stage, floor});
  await page.reload(); await page.locator('#home-continue').waitFor();
  if (floor) { await page.locator('#home-continue').click(); await page.locator('#abyss-panel').waitFor({state:'visible'}); }
  else { await page.locator('#home-map-open').click(); await page.locator('#stage-list button').first().waitFor({state:'visible'}); }
}
async function openMap(page) {
  if (!(await page.locator('#map-panel').isVisible())) await page.locator('[data-nav="home"]').click();
  if (!(await page.locator('#map-panel').isVisible())) await page.locator('#home-map-open').click();
  await page.locator('#route-list button').first().waitFor({state:'visible'});
}
async function startRoute(page, index = 0) {
  await openMap(page);
  await page.locator('#route-list button').nth(index).click();
  await page.locator('#route-sheet-start').click();
  await page.locator('#quiz-panel').waitFor({state:'visible'});
}
async function returnToMap(page) {
  await page.locator('#result-map-button').click();
  await page.locator('#route-list button').first().waitFor({state:'visible'});
}
async function startHomeQuest(page) {
  await page.locator('#home-continue').click();
  await page.locator('#quiz-panel').waitFor({state:'visible'});
}
async function solveUI(page, { wrong = false } = {}) {
  let answered = 0;
  while (await page.locator('#quiz-panel').isVisible()) {
    const a = Number(await page.locator('#factor-a').innerText()), b = Number(await page.locator('#factor-b').innerText());
    if (await page.locator('#keypad-display').isVisible()) {
      if (wrong) {
        await page.getByRole('button', {name:'0を入力', exact:true}).click();
        await page.getByRole('button', {name:'こたえで こうげき', exact:true}).click();
      }
      for (const digit of String(a*b)) await page.getByRole('button', {name:`${digit}を入力`, exact:true}).click();
      await page.getByRole('button', {name:'こたえで こうげき', exact:true}).click();
    } else {
      if (wrong) {
        const labels = await page.locator('#answers button').allTextContents();
        const incorrect = labels.find(label => Number(label) !== a*b);
        await page.getByRole('button', {name:`${incorrect}を選ぶ`, exact:true}).click();
      }
      await page.getByRole('button', {name:`${a*b}を選ぶ`, exact:true}).click();
    }
    answered++;
    await page.waitForTimeout(240); // reduced-motion uses a 200ms reveal.
    assert.ok(answered <= 25, 'battle must terminate');
  }
  return answered;
}
async function noOverflow(page, name) {
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name}: no horizontal overflow`);
}
async function a11y(page, name) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  check(report.violations.length === 0, `${name}: ${JSON.stringify(report.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,checks:n.any.map(check=>check.data)}))})))}`);
}
try {
  for (const engine of (process.env.KUKU_ENGINES || 'chromium,webkit').split(',')) {
    const browser = await pw[engine].launch({ headless:true });
    try {
      const context = await browser.newContext({ viewport:{width:375,height:812}, hasTouch:true, reducedMotion:'reduce' });
      await context.addInitScript(() => {
        window.testAudioContexts = 0;
        const Original = window.AudioContext || window.webkitAudioContext;
        window.testAudioAvailable = Boolean(Original);
        if (Original) {
          const Wrapped = function(...args) { window.testAudioContexts++; return new Original(...args); };
          Wrapped.prototype = Original.prototype;
          window.AudioContext = Wrapped;
          window.webkitAudioContext = Wrapped;
        }
      });
      const page = await context.newPage(), errors=[], failed=[], requests=[];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
      page.on('request', request => requests.push(request.url()));
      const response = await page.goto(base);
      check(response.status() === 200, 'test server serves app');
      await page.evaluate(() => {
        localStorage.clear(); localStorage.setItem('yzrs-kuku-best-v1','8');
        localStorage.setItem('yzrs-kuku-progress-v1', JSON.stringify({crystals:182,selectedBadge:'crystal-master'}));
      });
      await page.reload();
      check(await page.locator('#crystal-total').innerText()==='182', `${engine} migration crystals`);
      check(await page.locator('#sound-label').textContent()==='おと OFF', `${engine} sound off by default`);
      check(await page.evaluate(()=>!window.AudioContext || document.querySelector('#sound-toggle').getAttribute('aria-pressed')==='false'), 'sound off does not opt in');
      await noOverflow(page,'home'); await a11y(page,'home');
      await page.screenshot({path:resolve(evidence,`${engine}-modern-home.png`),fullPage:true});
      await page.locator('#home-map-open').click();
      check((await page.locator('#legacy-best').innerText()).includes('8 / 10'), `${engine} migration best`);
      await noOverflow(page,'map'); await a11y(page,'map');
      await page.screenshot({path:resolve(evidence,`${engine}-modern-map.png`),fullPage:true});
      await page.locator('[data-nav="home"]').click();
      await page.locator('#badge-book-button').click();
      check(await page.locator('#badge-grid .badge-card').count()===20, '20 original badges');
      check(await page.locator('#game').evaluate(el=>el.inert), 'modal background inert');
      await page.locator('#badge-book-close').focus();
      await page.keyboard.press('Shift+Tab');
      check(await page.locator('.badge-book-sheet button:not(:disabled)').last().evaluate(el=>el===document.activeElement), 'modal Shift+Tab wraps inside dialog');
      await page.keyboard.press('Tab');
      check(await page.locator('#badge-book-close').evaluate(el=>el===document.activeElement), 'modal Tab returns to close');
      await a11y(page,'badge book');
      await page.keyboard.press('Escape');
      check(await page.locator('#badge-book').isHidden(), 'Escape closes book');
      check(await page.locator('#badge-book-button').evaluate(el=>el===document.activeElement), 'modal restores focus');
      await page.locator('#home-map-open').click();
      await page.locator('#route-list button').first().click();
      await a11y(page,'route sheet');
      await page.locator('#route-sheet-start').click();
      await page.locator('#quiz-panel').waitFor({state:'visible'});
      await noOverflow(page,'choices'); await a11y(page,'choices');
      await page.screenshot({path:resolve(evidence,`${engine}-choices.png`),fullPage:true});
      check(await page.locator('#enemy-art').evaluate(el=>el.complete && el.naturalWidth>0), 'enemy loads');
      check(await page.locator('#enemy-art').evaluate(el=>getComputedStyle(el).animationName==='none'), 'reduced motion respected');
      check(await solveUI(page,{wrong:true})===9, 'ordered route solves all nine');
      check(await page.locator('.finish-star.is-filled').count()===1, 'wrong-answer recovery earns one star');
      check(Number(await page.locator('#crystal-total').innerText())===187, 'wave + route rewards, no per-question grants');
      await a11y(page,'finish');
      await returnToMap(page);
      check(!(await page.locator('#route-list button').nth(1).isDisabled()), 'one-star clear opens descending');
      check(await page.locator('#route-list button').last().isDisabled(), 'boss requires three routes');
      await page.reload(); await openMap(page);
      check(!(await page.locator('#route-list button').nth(1).isDisabled()), 'route clear survives reload');
      await startRoute(page,1); check(await solveUI(page)===9,'descending complete');
      await returnToMap(page);
      await startRoute(page,2);
      const answers = await solveUI(page); check(answers>=9 && answers<=12,'guardian complete after bag');
      await returnToMap(page);
      check(!(await page.locator('#route-list button').last().isDisabled()),'all three routes open boss');
      await startRoute(page,3); await solveUI(page);
      await returnToMap(page); check(!(await page.locator('#stage-list button').nth(1).isDisabled()),'boss opens next stage');
      await fixture(page,5);
      await page.locator('#stage-list button').nth(4).click(); await startRoute(page,0);
      check(await page.locator('#answers button').count()===12,'in-game keypad');
      check(await page.locator('#quiz-panel input').count()===0,'no OS keyboard input');
      await page.locator('#fallback-button').click(); check(await page.locator('#answers button').count()===3,'stage 5 fallback');
      await page.locator('#fallback-button').click();
      for (let i=0;i<3;i++) { await page.getByRole('button',{name:'0を入力',exact:true}).click(); await page.getByRole('button',{name:'こたえで こうげき',exact:true}).click(); }
      check((await page.locator('#hint').innerText()).includes('もういちど'),'hint ultimately shows answer');
      check(await page.locator('#factor-b').innerText()==='1','hint does not auto-solve');
      await noOverflow(page,'keypad'); await a11y(page,'keypad');
      await page.screenshot({path:resolve(evidence,`${engine}-keypad.png`),fullPage:true});
      await solveUI(page);
      await page.clock.install();
      await fixture(page,7); await page.locator('#stage-list button').nth(6).click(); await startRoute(page,0);
      await page.bringToFront(); await page.waitForTimeout(300);
      check((await page.locator('#timer-label').textContent()).includes('20'),'stage7 timer');
      await page.locator('#pause-button').click();
      check(await page.locator('#answers').evaluate(el=>el.inert),'pause disables answers');
      check((await page.locator('#timer-label').innerText()).includes('ひとやすみ'),'pause suspends timer');
      await page.clock.fastForward(25000);
      check(await page.locator('#factor-b').innerText()==='1','manual pause preserves the question past the deadline');
      await page.locator('#pause-button').click();
      await page.locator('#settings-open').click();
      await page.clock.fastForward(25000);
      check(await page.locator('#factor-b').innerText()==='1','settings sheet suspends timer');
      await page.locator('#settings-close').click();
      await page.waitForFunction(() => document.querySelector('#timer-label').textContent.includes('秒'));
      // Advance a real clock for timeout once per engine (not a production test hook).
      await page.clock.fastForward(21000);
      check(await page.locator('#factor-b').innerText()==='2','timeout moves to next fact');
      check((await page.locator('#battle-log').innerText()).includes('時間になった'),'timeout log');
      await solveUI(page);
      await fixture(page,9); await page.locator('#stage-list button').nth(8).click(); await startRoute(page,0);
      check((await page.locator('#timer-label').textContent()).includes('12'),'final boss timer');
      await solveUI(page);
      check((await page.locator('#finish-message').innerText()).includes('九九の深淵'),'ending');
      await page.locator('#restart-button').click(); check(await page.locator('#abyss-panel').isVisible(),'dungeon unlock');
      await fixture(page,9,51); await page.locator('#dungeon-start').click();
      check(await page.locator('#tower-title').innerText()==='九九の深淵 51〜60F','ten-node block reused');
      check(await page.locator('.tower-node').count()===10,'ten floor nodes');
      check(await page.locator('#question-count').innerText()==='1 / 4','51F four unique questions');
      check(await page.locator('#timer-label').textContent()==='時間なし','normal floor untimed');
      await solveUI(page); await page.locator('#restart-button').click();
      check(await page.locator('#quiz-panel').isVisible(),'next-floor CTA starts the following floor');
      check((await page.locator('#battle-place').innerText()).includes('52F'),'next floor persistence');
      await fixture(page,9,100); await page.locator('#dungeon-start').click();
      check((await page.locator('#timer-label').textContent()).includes('8'),'100F timer');
      check(await page.locator('#enemy-name').innerText()==='九九喰らい ゼロ','hidden final boss');
      await page.screenshot({path:resolve(evidence,`${engine}-100F.png`),fullPage:true});
      await solveUI(page); check((await page.locator('#finish-message').innerText()).includes('覚醒'),'100F ending');
      await page.locator('#restart-button').click(); check(await page.locator('#abyss-panel').isVisible(),'100F returns to abyss screen');
      await a11y(page,'abyss');
      await page.locator('[data-nav="home"]').click(); check((await page.locator('#home-equipment-name').innerText()).includes('覚醒'),'awakened weapon saved');
      await page.locator('#home-map-open').click(); await a11y(page,'completed map');
      for (const width of [320,375,390,430,768,1280]) { await page.setViewportSize({width,height:812}); await noOverflow(page,`width ${width}`); }
      check(errors.length===0,`${engine} JS errors: ${errors}`); check(failed.length===0,`${engine} missing assets: ${failed}`);
      check(requests.every(url=>url.startsWith(base.split(prefix)[0])), 'no external production resources');
      check(await page.evaluate(()=>window.testAudioContexts===0), 'sound OFF creates no audio context throughout play');
      await page.locator('#settings-open').click(); await page.locator('#sound-toggle').click();
      const audioAttempts = await page.evaluate(()=>window.testAudioContexts);
      const audioAvailable = await page.evaluate(()=>window.testAudioAvailable);
      check(audioAvailable ? audioAttempts >= 1 && audioAttempts <= 3 : audioAttempts === 0, `sound ON handles platform audio capability: ${audioAvailable}, attempts: ${audioAttempts}`);
       check(await page.locator('#sound-label').innerText()==='おと ON', 'sound ON remains usable without an audio device');
      await page.locator('#sound-toggle').click();
      check(await page.locator('#sound-label').innerText()==='おと OFF', 'sound turns off again');
      await page.locator('#settings-close').click();
      check(errors.length===0,`${engine} audio toggle does not throw: ${errors}`);
      await context.close();
      // Storage getter refusal and malformed saves must both boot and play.
      for (const mode of ['denied','corrupt','quota']) {
        const c=await browser.newContext({reducedMotion:'reduce'});
        await c.addInitScript(mode==='denied' ? `Object.defineProperty(window,'localStorage',{get(){throw new Error('denied')}});` : mode==='quota' ? `Storage.prototype.setItem = function(){throw new Error('quota')};` : `localStorage.setItem('yzrs-kuku-save-v2','{broken'); localStorage.setItem('yzrs-kuku-progress-v1','{broken');`);
        const p=await c.newPage(); await p.goto(base); await startHomeQuest(p);
        check(await p.locator('#answers button').count()===3,`${engine} ${mode} boot`);
        if(mode==='denied') { await p.locator('#settings-open').click(); check((await p.locator('#save-status').innerText()).includes('保存できません'),'storage refusal message'); }
        await c.close();
      }
      console.log(`${engine}: browser regression and WCAG checks passed`);
    } finally { await browser.close(); }
  }
  console.log(`${checks} browser checks passed`);
} finally { server.close(); }
