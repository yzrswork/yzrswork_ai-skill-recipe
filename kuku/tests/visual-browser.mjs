// Visual-only checks; the existing gameplay regression suite stays unchanged.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VISUAL_ASSETS } from '../js/assets.js';
const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const axe = await import(process.env.AXE_MODULE ? pathToFileURL(process.env.AXE_MODULE).href : '@axe-core/playwright');
const AxeBuilder = axe.default.default || axe.default;
const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const evidence = process.env.KUKU_EVIDENCE || resolve(root, '../kuku-evidence');
await mkdir(evidence, { recursive:true });
const prefix = '/yzrswork_ai-skill-recipe/';
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!pathname.startsWith(prefix)) throw Error('bad prefix');
    let path = resolve(root, pathname.slice(prefix.length));
    if (pathname.endsWith('/')) path = resolve(path, 'index.html');
    if (!path.startsWith(root + sep)) throw Error('outside root');
    const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.webp':'image/webp' }[extname(path)];
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type':mime || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}${prefix}kuku/`;
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };
const loaded = page => page.waitForFunction(() => Array.from(document.images).filter(image => !image.closest('[hidden]')).every(image => image.complete && image.naturalWidth > 0));
async function fixture(page, stage, floor = null) {
  await page.goto(base);
  await page.evaluate(async ({stage, floor}) => {
    const { newSave } = await import('./js/save.js');
    const save = newSave('visual-evidence'); save.settings.untimed = true;
    for (let i = 1; i <= 9; i++) save.story.stages[i] = {
      routes:Object.fromEntries(['ascending','descending','random'].map(id => [id,{clear:true,stars:1}])), bossClear:true,
    };
    save.story.midbossClear = true;
    if (floor) { save.story.endingSeen = true; save.dungeon.floor = floor; save.dungeon.highestFloor = floor - 1; }
    localStorage.setItem('yzrs-kuku-save-v2',JSON.stringify(save));
  }, {stage, floor});
  await page.reload();
  if (floor) { await page.locator('#home-continue').click(); await page.locator('#abyss-panel').waitFor({state:'visible'}); }
  else { await page.locator('#home-map-open').click(); await page.locator('#stage-list button').first().waitFor({state:'visible'}); }
}
try {
  for (const engine of (process.env.KUKU_ENGINES || 'chromium,webkit').split(',')) {
    const browser = await pw[engine].launch({headless:true});
    try {
      const context = await browser.newContext({viewport:{width:1200,height:900},reducedMotion:'reduce'});
      const page = await context.newPage();
      const errors = [], failed = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
      await page.goto(base + 'visual-pass-2.html'); await loaded(page);
      check(await page.locator('#roster img').count() === 46, '11 bosses + 8 guardians + 27 enemies');
      check(await page.locator('#weapons img').count() === 5, 'five equipment evolutions');
      check(await page.locator('#backgrounds img').count() === 11, 'eleven stage sets');
      for (const asset of VISUAL_ASSETS) check(await page.locator(`img[src$="/${asset.id}.webp"]`).first().evaluate(img => img.naturalWidth >= 400), asset.id + ' decoded by ' + engine);
      const report = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      check(report.violations.length === 0, 'comparison gallery accessible: ' + JSON.stringify(report.violations.map(v=>v.id)));
      await page.locator('#comparison').screenshot({path:resolve(evidence,engine+'-visual-boss-comparison.png')});
      await page.locator('#roster').screenshot({path:resolve(evidence,engine+'-visual-roster.png')});
      await page.locator('#weapons').screenshot({path:resolve(evidence,engine+'-visual-weapons.png')});
      for (const width of [320,390,768]) {
        await page.setViewportSize({width,height:844});
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'gallery no overflow ' + width);
        for (const [stage,id] of [[4,'boss-4'],[3,'boss-3'],[5,'boss-5'],[9,'boss-9'],[9,'boss-zero']]) {
          await fixture(page,stage,id === 'boss-zero' ? 100 : null);
          const saved = await page.evaluate(() => localStorage.getItem('yzrs-kuku-save-v2'));
          if (id === 'boss-zero') await page.locator('#dungeon-start').click();
          else {
            await page.locator('#stage-list button').nth(stage - 1).click();
            await page.locator('#route-list button').nth(stage === 9 ? 0 : 3).click();
            await page.locator('#route-sheet-start').click();
          }
          await loaded(page);
          check((await page.locator('#enemy-art').getAttribute('src')).endsWith(id+'.webp'), 'battle resolves '+id);
          const bounds = await page.locator('#enemy-art').boundingBox(), scene = await page.locator('#battle-scene').boundingBox();
          check(bounds.height >= 200 && bounds.width >= 200, id + ' readable sprite size '+width);
          check(bounds.x >= scene.x && bounds.x+bounds.width <= scene.x+scene.width+1 && bounds.y+bounds.height <= scene.y+scene.height+1, id+' fully contained');
          check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'battle no overflow '+width);
          check(await page.evaluate(() => localStorage.getItem('yzrs-kuku-save-v2')) === saved, 'viewing '+id+' preserves save');
          if (width === 390) await page.screenshot({path:resolve(evidence,engine+'-visual-battle-'+id+'.png'),fullPage:true});
        }
        await page.goto(base+'visual-pass-2.html'); await loaded(page);
      }
      check(errors.length === 0, 'no JavaScript errors: '+errors);
      check(failed.length === 0, 'no missing assets: '+failed);
      console.log(engine+': visual loading, gallery, sprite sizing and save preservation passed');
    } finally { await browser.close(); }
  }
  console.log(checks+' visual browser checks passed');
} finally { await new Promise(done => server.close(done)); }
