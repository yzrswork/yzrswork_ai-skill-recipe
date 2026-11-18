/* なろう夜読み / Narou Night Reader
 * 小説家になろうの話ページ上で実行し、ダークモードの読書画面に差し替える。
 * ブックマークレットとして配布する（index.html が javascript: URL に変換する）。
 * もう一度実行すると元のページに戻る。データは syosetu.com 側の localStorage にだけ残る。
 */
(function () {
  'use strict';
  var VERSION = '1.6.0';
  var NS = 'ndr';
  var W = window, D = document;

  if (W.__ndr) { W.__ndr.toggle(); return; }

  var THEMES = {
    dark:  { label: 'ダーク', bg: '#17171a', fg: '#d6d2c8', mute: '#8b867c', line: '#2c2c31', accent: '#d08a52', panel: 'rgba(28,28,32,.96)' },
    black: { label: '黒',     bg: '#000000', fg: '#c9c5bb', mute: '#7d786f', line: '#222222', accent: '#c98149', panel: 'rgba(14,14,14,.96)' },
    sepia: { label: 'セピア', bg: '#1d1813', fg: '#ddcdb2', mute: '#93836b', line: '#352c22', accent: '#d9925a', panel: 'rgba(36,30,23,.96)' }
  };
  var FONTS = {
    mincho: '"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP",serif',
    gothic: '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","Noto Sans JP",sans-serif'
  };
  var DEFAULTS = { theme: 'dark', font: 'mincho', size: 18, lh: 1.95, mode: 'scroll', tap: 'side', blank: 'keep', dim: 0 };

  /* ---------- storage (Private Browsing などで失敗しても動くように) ---------- */
  function load(key, fallback) {
    try { var v = W.localStorage.getItem(NS + ':' + key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { W.localStorage.setItem(NS + ':' + key, JSON.stringify(value)); } catch (e) {}
  }
  var settings = Object.assign({}, DEFAULTS, load('settings', {}));
  if (!THEMES[settings.theme]) settings.theme = DEFAULTS.theme;
  if (!FONTS[settings.font]) settings.font = DEFAULTS.font;
  if (settings.mode !== 'page') settings.mode = 'scroll';

  function posKey(url) { var u = new URL(url, location.href); return u.pathname + u.search; }
  function getPos(url) { var m = load('pos', {}); return m[posKey(url)]; }
  function setPos(url, ratio) {
    var m = load('pos', {}), k = posKey(url);
    delete m[k]; m[k] = Math.round(ratio * 10000) / 10000;
    var keys = Object.keys(m);
    while (keys.length > 300) { delete m[keys.shift()]; }
    save('pos', m);
  }

  /* ---------- parse: 新レイアウト(p-novel) と旧レイアウト(novel_honbun) の両対応 ---------- */
  function text(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function abs(href, base) { try { return new URL(href, base).href; } catch (e) { return null; } }

  function findPager(doc, base) {
    var prev = null, next = null, toc = null, last = null;
    var p = doc.querySelector('.c-pager__item--before'), n = doc.querySelector('.c-pager__item--next');
    var l = doc.querySelector('.c-pager__item--last');
    if (l && l.getAttribute('href')) last = abs(l.getAttribute('href'), base);
    if (p && p.getAttribute('href')) prev = abs(p.getAttribute('href'), base);
    if (n && n.getAttribute('href')) next = abs(n.getAttribute('href'), base);
    var links = doc.querySelectorAll('.c-pager a, .novel_bn a, a');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], t = text(a), h = a.getAttribute('href');
      if (!h) continue;
      if (!prev && /^(<<\s*)?前(へ|の話)/.test(t)) prev = abs(h, base);
      if (!next && /^次(へ|の話)/.test(t)) next = abs(h, base);
      if (!toc && /^目次$/.test(t)) toc = abs(h, base);
      if (!last && /^最後へ/.test(t)) last = abs(h, base);
    }
    /* URL から推測（/ncode/N/ 形式）。リンクとして実在するものだけ採用する */
    var m = new URL(base).pathname.match(/^(.*\/)(\d+)\/?$/);
    if (m) {
      var num = +m[2], want = {}, all = doc.querySelectorAll('a[href]');
      want.prev = m[1] + (num - 1) + '/'; want.next = m[1] + (num + 1) + '/';
      for (var j = 0; j < all.length; j++) {
        var u = abs(all[j].getAttribute('href'), base); if (!u) continue;
        var path = new URL(u).pathname.replace(/\/?$/, '/');
        if (!prev && path === want.prev) prev = u;
        if (!next && path === want.next) next = u;
        if (!toc && path === m[1]) toc = u;
      }
    }
    return { prev: prev, next: next, toc: toc, last: last };
  }

  function parse(doc, url) {
    var body = [], preface = [], after = [];
    var parts = doc.querySelectorAll('.p-novel__text');
    for (var i = 0; i < parts.length; i++) {
      var c = parts[i].className;
      if (/--preface/.test(c)) preface.push(parts[i]);
      else if (/--afterword/.test(c)) after.push(parts[i]);
      else body.push(parts[i]);
    }
    if (!body.length) {
      var hb = doc.querySelector('#novel_honbun');
      if (hb) body.push(hb);
      var np = doc.querySelector('#novel_p'); if (np) preface.push(np);
      var na = doc.querySelector('#novel_a'); if (na) after.push(na);
    }
    if (!body.length) {
      /* スマホ版など別構成でも、なろうの本文行は p#L1, 前書き p#Lp1, 後書き p#La1 */
      var l1 = doc.getElementById('L1');
      if (l1 && l1.parentElement) body.push(l1.parentElement);
      var lp = doc.getElementById('Lp1');
      if (lp && lp.parentElement && preface.indexOf(lp.parentElement) < 0) preface.push(lp.parentElement);
      var la = doc.getElementById('La1');
      if (la && la.parentElement && after.indexOf(la.parentElement) < 0) after.push(la.parentElement);
    }
    if (!body.length) return null;

    var subtitle = text(doc.querySelector('.p-novel__title, .novel_subtitle, .novel_title'));
    if (!subtitle) { var dt = (doc.title || '').split(' - '); if (dt.length > 1) subtitle = dt.slice(1).join(' - ').trim(); }
    var number = text(doc.querySelector('.p-novel__number, #novel_no'));
    var work = text(doc.querySelector('.c-announce a[href], .contents1 a[href]'));
    if (!work) {
      var t = (doc.title || '').split(' - ');
      work = t.length > 1 ? t[0].trim() : '';
    }
    if (work === subtitle) work = '';
    var pager = findPager(doc, url);
    var nm = number.match(/(\d+)\s*\/\s*(\d+)/);
    return { kind: 'ep', url: url, work: work, subtitle: subtitle, number: number,
             base: tocBase(url), cur: nm ? +nm[1] : 0, total: nm ? +nm[2] : 0,
             preface: preface, body: body, after: after,
             prev: pager.prev, next: pager.next, toc: pager.toc };
  }

  /* 目次ページ: 話へのリンク（目次のパス + 数字/）と章タイトルを文書順に拾う */
  function parseToc(doc, url) {
    var u = new URL(url), base = u.pathname;
    if (!/\/$/.test(base) || /\/\d+\/$/.test(base)) return null;
    var re = new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)/?$');
    var sel = '.p-eplist__chapter-title, .chapter_title, .p-eplist__subtitle, .index_box .subtitle a, dl.novel_sublist2 a';
    var nodes = doc.querySelectorAll(sel);
    if (!nodes.length) nodes = doc.querySelectorAll('.p-eplist__chapter-title, .chapter_title, a[href]');
    var items = [], seen = {}, eps = 0;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.tagName !== 'A') { var ct = text(n); if (ct) items.push({ type: 'chapter', text: ct }); continue; }
      var h = abs(n.getAttribute('href') || '', url); if (!h) continue;
      var hu = new URL(h), m = hu.origin === u.origin && hu.pathname.match(re);
      if (!m || seen[hu.pathname]) continue;
      var t = text(n); if (!t) continue;
      seen[hu.pathname] = 1; eps++;
      items.push({ type: 'ep', url: hu.origin + hu.pathname.replace(/\/?$/, '/'), title: t, num: +m[1], date: epDate(n, doc) });
    }
    if (eps < 1) return null;
    var work = text(doc.querySelector('.p-novel__title, .novel_title'));
    if (!work) work = (doc.title || '').split(' - ')[0].trim();
    var pager = findPager(doc, url);
    var pageNo = +(u.searchParams.get('p') || 1);
    var maxNum = 0;
    items.forEach(function (it) { if (it.num > maxNum) maxNum = it.num; });
    return { kind: 'toc', url: url, base: base, work: work, items: items, page: pageNo,
             prev: pager.prev, next: pager.next, lastPage: pager.last, maxNum: maxNum };
  }
  /* 目次の各話の投稿日（新: .p-eplist__update / 旧: .long_update）。「改」は改稿あり */
  function epDate(a, doc) {
    var box = a.closest('.p-eplist__sublist, dl.novel_sublist2, li, tr, dl') || a.parentElement;
    if (!box || box === doc.body) return null;
    var d = box.querySelector('.p-eplist__update, .long_update');
    var t = d ? text(d) : (text(box).length < 200 ? text(box) : '');
    var m = t.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    return m ? { ymd: m[1] + '/' + ('0' + m[2]).slice(-2) + '/' + ('0' + m[3]).slice(-2), rev: /改/.test(t) } : null;
  }
  function parseAny(doc, url) { return parse(doc, url) || parseToc(doc, url); }

  /* 作品ごとに最後に読んだ話（目次の「続きから」用） */
  function tocBase(url) { var m = new URL(url, location.href).pathname.match(/^(.*\/)\d+\/?$/); return m ? m[1] : null; }
  function rememberLast(data) {
    var b = tocBase(data.url); if (!b) return;
    var m = load('last', {}), old = m[b] || {}; delete m[b];
    m[b] = { url: data.url, title: data.subtitle || '', num: data.number || '', work: data.work || old.work || '', at: Date.now() };
    var k = Object.keys(m); while (k.length > 200) delete m[k.shift()];
    save('last', m);
  }

  /* ---------- styles ---------- */
  var UI_FONT = '-apple-system,"Hiragino Sans",sans-serif';
  var CSS = [
    'html.ndr-on,html.ndr-on body{background:var(--ndr-bg)!important;margin:0!important;padding:0!important;min-height:100%;}',
    'html.ndr-on body>*:not(#ndr-root){display:none!important;}',
    'html.ndr-paged,html.ndr-paged body{overflow:hidden!important;height:100%!important;overscroll-behavior:none;}',
    'html.ndr-dim{filter:invert(.9) hue-rotate(180deg);background:#fff;}',
    'html.ndr-dim img,html.ndr-dim video,html.ndr-dim iframe{filter:invert(1) hue-rotate(180deg);}',
    '#ndr-root{all:initial;display:block;background:var(--ndr-bg);color:var(--ndr-fg);font-family:var(--ndr-font);font-size:var(--ndr-size);line-height:var(--ndr-lh);',
    '  -webkit-text-size-adjust:100%;text-size-adjust:100%;min-height:100vh;-webkit-tap-highlight-color:transparent;}',
    '#ndr-root *{box-sizing:border-box;}',
    '#ndr-root :where(p,h1,div,span,ruby,rt,article,section,header,nav,hr,ul,li){font-size:inherit;line-height:inherit;color:inherit;font-family:inherit;font-weight:inherit;letter-spacing:normal;background:none;text-align:left;}',
    '#ndr-progress{position:fixed;top:0;left:0;height:2px;width:0;background:var(--ndr-accent);z-index:3;opacity:.8;}',
    '#ndr-shade{position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:3;}',
    '#ndr-page{max-width:38em;margin:0 auto;padding:calc(env(safe-area-inset-top) + 28px) calc(env(safe-area-inset-right) + 20px) calc(env(safe-area-inset-bottom) + 120px) calc(env(safe-area-inset-left) + 20px);}',
    'html.ndr-paged #ndr-page{position:fixed;top:calc(env(safe-area-inset-top) + 26px);bottom:calc(env(safe-area-inset-bottom) + 34px);left:var(--ndr-side);right:var(--ndr-side);',
    '  max-width:none;margin:0;padding:0;column-width:var(--ndr-colw);column-gap:var(--ndr-gap);column-fill:auto;overflow:hidden;}',
    'html.ndr-paged #ndr-root .ndr-text img{max-height:calc(100vh - 160px);width:auto;break-inside:avoid;}',
    'html.ndr-paged #ndr-root .ndr-foot{break-inside:avoid;}',
    '#ndr-pageno{display:none;position:fixed;left:0;right:0;bottom:calc(env(safe-area-inset-bottom) + 10px);text-align:center;font:11px ' + UI_FONT + ';color:var(--ndr-mute);z-index:2;pointer-events:none;font-variant-numeric:tabular-nums;}',
    'html.ndr-paged #ndr-pageno{display:block;}',
    '#ndr-root .ndr-ep+.ndr-ep{border-top:1px solid var(--ndr-line);margin-top:3.5em;padding-top:3em;}',
    '#ndr-root .ndr-head{margin:0 0 2.2em;}',
    '#ndr-root .ndr-work{font-size:.72em;line-height:1.6;color:var(--ndr-mute);margin:0 0 .6em;letter-spacing:.02em;}',
    '#ndr-root .ndr-num{font:500 .66em/1 ui-monospace,Menlo,monospace;color:var(--ndr-accent);letter-spacing:.08em;margin:0 0 .7em;}',
    '#ndr-root .ndr-sub{font-size:1.28em;line-height:1.5;font-weight:600;margin:0;color:var(--ndr-fg);}',
    '#ndr-root .ndr-time{font:12px ' + UI_FONT + ';color:var(--ndr-mute);margin:.9em 0 0;}',
    '#ndr-root .ndr-text p{margin:0;min-height:1em;word-break:normal;overflow-wrap:anywhere;}',
    '#ndr-root .ndr-text img{max-width:100%;height:auto;display:block;margin:1em auto;}',
    '#ndr-root .ndr-text a{color:var(--ndr-accent);}',
    '#ndr-root .ndr-text rt{font-size:.5em;line-height:1;color:var(--ndr-mute);}',
    '#ndr-root .ndr-note{font-size:.88em;color:var(--ndr-mute);border-left:2px solid var(--ndr-line);padding-left:1em;margin:0 0 2.4em;}',
    '#ndr-root .ndr-note.ndr-after{margin:3em 0 0;}',
    '#ndr-root .ndr-sep{border:0;border-top:1px solid var(--ndr-line);margin:3em 0 0;}',
    '#ndr-root .ndr-foot{display:flex;gap:10px;margin:2.4em 0 0;font-family:' + UI_FONT + ';font-size:15px;}',
    '#ndr-root .ndr-more{margin:2em 0 0;font:13px ' + UI_FONT + ';color:var(--ndr-mute);text-align:center;}',
    '.ndr-btn{appearance:none;-webkit-appearance:none;border:1px solid var(--ndr-line);background:transparent;color:var(--ndr-fg);',
    '  font:inherit;font-family:' + UI_FONT + ';font-size:15px;line-height:1;padding:14px 12px;border-radius:12px;text-align:center;text-decoration:none;cursor:pointer;flex:1;min-height:48px;display:flex;align-items:center;justify-content:center;}',
    '.ndr-btn[disabled]{opacity:.3;pointer-events:none;}',
    '.ndr-btn.ndr-primary{border-color:var(--ndr-accent);color:var(--ndr-accent);flex:2;font-weight:600;}',
    '#ndr-bar{position:fixed;left:0;right:0;bottom:0;z-index:4;background:var(--ndr-panel);border-top:1px solid var(--ndr-line);max-height:85vh;overflow-y:auto;',
    '  -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);padding:12px calc(env(safe-area-inset-right) + 14px) calc(env(safe-area-inset-bottom) + 12px) calc(env(safe-area-inset-left) + 14px);',
    '  transform:translateY(110%);transition:transform .22s ease;font-family:' + UI_FONT + ';font-size:14px;color:var(--ndr-fg);}',
    '#ndr-root.ndr-ui #ndr-bar{transform:none;}',
    '#ndr-bar .ndr-row{display:flex;gap:8px;max-width:38rem;margin:0 auto 8px;}',
    '#ndr-bar .ndr-row:last-child{margin-bottom:0;}',
    '#ndr-bar .ndr-label{flex:0 0 3.2em;display:flex;align-items:center;font-size:11px;color:var(--ndr-mute);}',
    '#ndr-bar .ndr-opts{display:none;border-top:1px solid var(--ndr-line);margin:4px auto 8px;padding-top:12px;max-width:38rem;}',
    '#ndr-root.ndr-opts-on #ndr-bar .ndr-opts{display:block;}',
    '#ndr-bar .ndr-btn{padding:10px 4px;min-height:42px;font-size:14px;white-space:nowrap;}',
    '#ndr-bar .ndr-btn.ndr-sel{border-color:var(--ndr-accent);color:var(--ndr-accent);}',
    '#ndr-bar .ndr-info{flex:2.4;display:flex;align-items:center;justify-content:center;color:var(--ndr-mute);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap;}',
    '#ndr-toast{position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 14px);transform:translateX(-50%);z-index:5;background:var(--ndr-panel);color:var(--ndr-fg);',
    '  border:1px solid var(--ndr-line);border-radius:999px;padding:8px 16px;font:13px ' + UI_FONT + ';opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap;}',
    '#ndr-toast.ndr-show{opacity:1;}',
    '#ndr-root .ndr-toc{list-style:none;margin:0;padding:0;font-family:' + UI_FONT + ';font-size:16px;line-height:1.5;}',
    '#ndr-root .ndr-toc li{margin:0;border-bottom:1px solid var(--ndr-line);}',
    '#ndr-root .ndr-toc a{display:flex;gap:12px;align-items:baseline;padding:11px 2px;color:var(--ndr-fg);text-decoration:none;}',
    '#ndr-root .ndr-toc a .ndr-t{flex:1;}',
    '#ndr-root .ndr-toc .ndr-d{display:block;margin-top:3px;font-size:11px;line-height:1.3;color:var(--ndr-mute);font-variant-numeric:tabular-nums;letter-spacing:.02em;}',
    '#ndr-root .ndr-tocstat{margin:1.4em 0 0;font-family:' + UI_FONT + ';font-size:12px;color:var(--ndr-mute);text-align:center;}',
    '#ndr-root .ndr-toc a .ndr-s{font-size:12px;color:var(--ndr-accent);white-space:nowrap;}',
    '#ndr-root .ndr-toc a.ndr-done{color:var(--ndr-mute);}',
    '#ndr-root .ndr-toc a.ndr-done .ndr-s{color:var(--ndr-mute);}',
    '#ndr-root .ndr-toc .ndr-ch{padding:26px 2px 8px;font-size:13px;font-weight:600;color:var(--ndr-mute);border-bottom:1px solid var(--ndr-line);}',
    '#ndr-root .ndr-resume{display:block;margin:0 0 1.6em;padding:14px 16px;border:1px solid var(--ndr-accent);border-radius:12px;color:var(--ndr-fg);text-decoration:none;font-family:' + UI_FONT + ';font-size:15px;line-height:1.5;}',
    '#ndr-root .ndr-resume small{display:block;color:var(--ndr-accent);font-size:12px;margin-bottom:2px;}',
    '#ndr-root .ndr-gh{display:flex;align-items:center;gap:10px;width:100%;padding:15px 2px;border:0;background:none;color:var(--ndr-fg);font:600 15px ' + UI_FONT + ';text-align:left;cursor:pointer;}',
    '#ndr-root .ndr-gh .ndr-chev{flex:none;width:1em;color:var(--ndr-accent);}',
    '#ndr-root .ndr-gh .ndr-t{flex:1;}',
    '#ndr-root .ndr-gh .ndr-s{font-weight:400;font-size:12px;color:var(--ndr-mute);}',
    '#ndr-root .ndr-gb{list-style:none;margin:0 0 12px;padding:0 0 0 1.1em;border-top:1px solid var(--ndr-line);}',
    '#ndr-root .ndr-gb li:last-child{border-bottom:0;}',
    '#ndr-root .ndr-jump{display:flex;gap:8px;margin:0 0 1.6em;font-size:14px;}',
    '#ndr-root .ndr-jump .ndr-btn{font-size:14px;padding:12px 6px;white-space:nowrap;}',
    '#ndr-root .ndr-find{display:flex;gap:8px;margin:0 0 1.8em;}',
    '#ndr-root .ndr-find input{flex:1;min-width:0;height:48px;padding:0 14px;border:1px solid var(--ndr-line);border-radius:12px;background:rgba(255,255,255,.04);color:var(--ndr-fg);font:16px ' + UI_FONT + ';outline:none;-webkit-appearance:none;}',
    '#ndr-root .ndr-find input:focus{border-color:var(--ndr-accent);}',
    '#ndr-root .ndr-find .ndr-btn{flex:0 0 4.5em;}',
    '#ndr-root .ndr-cap{margin:2.2em 0 .6em;font:600 12px ' + UI_FONT + ';color:var(--ndr-mute);letter-spacing:.04em;}',
    '#ndr-root .ndr-shelf li{display:flex;align-items:center;gap:6px;}',
    '#ndr-root .ndr-shelf li>a:first-child{flex:1;min-width:0;}',
    '#ndr-root .ndr-shelf .ndr-mini{flex:none;padding:8px 10px;border:1px solid var(--ndr-line);border-radius:10px;color:var(--ndr-mute);font:12px ' + UI_FONT + ';text-decoration:none;background:none;}',
    '#ndr-root .ndr-links{display:flex;flex-wrap:wrap;gap:8px;}',
    '#ndr-root .ndr-links a{flex:1 1 40%;}',
    '#ndr-root .ndr-empty{font:14px ' + UI_FONT + ';color:var(--ndr-mute);padding:1em 0;}'
  ].join('\n');

  /* ---------- DOM helpers ---------- */
  function el(tag, attrs, kids) {
    var e = D.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'on') for (var ev in attrs.on) e.addEventListener(ev, attrs.on[ev]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function cloneClean(src) {
    var c = D.importNode(src, true);
    c.removeAttribute('id'); c.removeAttribute('class');
    var bad = c.querySelectorAll('script,style,iframe,form,button');
    for (var i = 0; i < bad.length; i++) bad[i].remove();
    return c;
  }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function clamp(v) { return Math.min(1, Math.max(0, v)); }

  /* ---------- state ---------- */
  var root, page, bar, info, toast, progress, shade, pageno, styleEl, metaVp, metaTheme;
  var current = null, loading = false, appending = false, saveTimer = 0, toastTimer = 0;
  var segs = [], active = 0;              /* スクロール表示で縦につながった話 */
  var pg = { idx: 0, pages: 1, step: 1 };  /* ページめくり表示 */
  var saved = { scroll: 0 };
  var CPM = 500;                            /* 1分あたりに読む文字数の目安 */

  function paged() { return settings.mode === 'page' && current && current.kind === 'ep'; }

  function applyVars() {
    var t = THEMES[settings.theme], s = D.documentElement.style;
    s.setProperty('--ndr-bg', t.bg); s.setProperty('--ndr-fg', t.fg); s.setProperty('--ndr-mute', t.mute);
    s.setProperty('--ndr-line', t.line); s.setProperty('--ndr-accent', t.accent); s.setProperty('--ndr-panel', t.panel);
    s.setProperty('--ndr-font', FONTS[settings.font]);
    s.setProperty('--ndr-size', settings.size + 'px'); s.setProperty('--ndr-lh', String(settings.lh));
    if (metaTheme) metaTheme.setAttribute('content', t.bg);
    if (shade) shade.style.opacity = String(settings.dim || 0);
    if (!bar) return;
    each(bar.querySelectorAll('[data-theme]'), function (b) { b.classList.toggle('ndr-sel', b.getAttribute('data-theme') === settings.theme); });
    each(bar.querySelectorAll('[data-mode]'), function (b) { b.classList.toggle('ndr-sel', b.getAttribute('data-mode') === settings.mode); });
    var q = function (sel) { return bar.querySelector(sel); };
    q('[data-font]').textContent = settings.font === 'mincho' ? '明朝' : 'ゴシック';
    q('[data-dim]').textContent = settings.dim ? '減光 ' + Math.round(settings.dim * 100) + '%' : '減光';
    q('[data-dim]').classList.toggle('ndr-sel', !!settings.dim);
    q('[data-blank]').textContent = settings.blank === 'squash' ? '空行を詰める' : '空行そのまま';
    q('[data-tap]').textContent = settings.tap === 'any' ? 'タップ:全面で次' : 'タップ:左右';
    toggleDisabled(q('[data-tap]'), settings.mode !== 'page');
  }
  /* 表示を変えても、読んでいる位置（割合）は保つ */
  function setSetting(k, v, rerender) {
    var r = ratio();
    settings[k] = v; save('settings', settings); applyVars();
    if (rerender && current && current.kind === 'ep') render(current, { r: r });
    else if (paged()) layoutPaged(r);
    else scrollToRatio(r);
  }

  function showToast(msg) {
    toast.textContent = msg; toast.classList.add('ndr-show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove('ndr-show'); }, 1400);
  }

  /* ---------- 位置（話ごとの割合 0〜1） ---------- */
  function segBox(seg) {
    var top = seg.sec.getBoundingClientRect().top + W.scrollY;
    return { top: top, max: seg.sec.offsetHeight - W.innerHeight };
  }
  function ratio() {
    if (!current || current.kind !== 'ep') {
      var m = D.documentElement.scrollHeight - W.innerHeight;
      return m > 0 ? clamp(W.scrollY / m) : 0;
    }
    if (paged()) return pg.pages > 1 ? pg.idx / (pg.pages - 1) : 0;
    var seg = segs[active]; if (!seg) return 0;
    var b = segBox(seg);
    return b.max > 0 ? clamp((W.scrollY - b.top) / b.max) : (W.scrollY >= b.top ? 1 : 0);
  }
  function scrollToRatio(r) {
    if (paged()) return setPage(Math.round(r * (pg.pages - 1)));
    var seg = segs[active];
    if (!seg || !current || current.kind !== 'ep') {
      W.scrollTo(0, Math.round((D.documentElement.scrollHeight - W.innerHeight) * r)); return;
    }
    if (active === 0 && r === 0) { W.scrollTo(0, 0); return; }
    var b = segBox(seg);
    W.scrollTo(0, Math.max(0, Math.round(b.top + Math.max(0, b.max) * r)));
  }
  function minutesLeft(r) {
    var seg = segs[active]; if (!seg) return '';
    var m = seg.chars * (1 - r) / CPM;
    return m < 1 ? '残り1分未満' : '残り約' + Math.round(m) + '分';
  }
  function updateInfo() {
    if (!current) return;
    var r = ratio();
    progress.style.width = (r * 100).toFixed(2) + '%';
    if (current.kind !== 'ep') { info.textContent = current.kind === 'shelf' ? '本棚' : '目次'; return; }
    var left = minutesLeft(r);
    if (paged()) {
      pageno.textContent = (pg.idx + 1) + ' / ' + pg.pages;
      info.textContent = (pg.idx + 1) + '/' + pg.pages + 'ページ · ' + left;
    } else {
      info.textContent = Math.round(r * 100) + '% · ' + left;
    }
    clearTimeout(saveTimer);
    var url = current.url;
    saveTimer = setTimeout(function () { setPos(url, r); }, 250);
  }

  /* ---------- スクロール表示: 読み進めると次の話が下につながる ---------- */
  function onScroll() {
    if (!current || paged()) return;
    if (current.kind === 'ep' && segs.length) {
      var line = W.innerHeight * 0.35, idx = 0;
      for (var i = 0; i < segs.length; i++) if (segs[i].sec.getBoundingClientRect().top <= line) idx = i;
      if (idx !== active) setActive(idx);
      var lastSeg = segs[segs.length - 1];
      var rest = D.documentElement.scrollHeight - (W.scrollY + W.innerHeight);
      if (!appending && lastSeg.data.next && rest < W.innerHeight * 1.5) appendNext(lastSeg.data.next);
    }
    updateInfo();
  }
  function setActive(idx) {
    if (segs[active]) setPos(segs[active].data.url, idx > active ? 1 : ratio());
    active = idx;
    current = segs[idx].data;
    if (location.href !== current.url) history.replaceState({ ndr: true }, '', current.url);
    rememberLast(current);
    syncBar();
    /* 上の話が増えすぎたら外す（スクロール位置は保つ） */
    if (segs.length > 3 && active >= 2) {
      var gone = segs.shift(), before = segs[0].sec.getBoundingClientRect().top;
      gone.sec.remove(); active--;
      W.scrollBy(0, segs[0].sec.getBoundingClientRect().top - before);
    }
  }
  function appendNext(url) {
    appending = true;
    var more = el('p', { 'class': 'ndr-more', text: '次の話を読み込み中…' });
    page.appendChild(more);
    fetchDoc(url).then(function (doc) {
      var data = parseAny(doc, url);
      more.remove();
      if (!data || data.kind !== 'ep' || paged() || !segs.length || segs[segs.length - 1].data.next !== url) return;
      var seg = buildSection(data);
      page.appendChild(seg.sec); segs.push(seg);
      if (data.next) prefetch(data.next);
    }).catch(function () {
      more.textContent = '次の話を読み込めませんでした';
    }).then(function () { appending = false; });
  }

  /* ---------- ページめくり表示 ---------- */
  function layoutPaged(r) {
    var vw = W.innerWidth, side = Math.max(22, Math.round((vw - settings.size * 34) / 2));
    var colw = vw - side * 2, gap = side * 2, s = root.style;
    s.setProperty('--ndr-side', side + 'px'); s.setProperty('--ndr-colw', colw + 'px'); s.setProperty('--ndr-gap', gap + 'px');
    pg.step = colw + gap;
    pg.pages = Math.max(1, Math.round((page.scrollWidth + gap) / pg.step));
    setPage(Math.round((r || 0) * (pg.pages - 1)));
  }
  function setPage(i) {
    pg.idx = Math.max(0, Math.min(pg.pages - 1, i));
    page.scrollLeft = pg.idx * pg.step;
    updateInfo();
  }
  function turn(d) {
    if (!current || current.kind !== 'ep') return;
    var i = pg.idx + d;
    if (i < 0) { if (current.prev) go(current.prev, true, { atEnd: true }); else showToast('最初のページです'); return; }
    if (i >= pg.pages) { if (current.next) go(current.next, true); else showToast('最新話の最後です'); return; }
    setPage(i);
  }

  /* ---------- render ---------- */
  function buildSection(data) {
    var sec = el('section', { 'class': 'ndr-ep', 'data-url': data.url });
    var head = el('header', { 'class': 'ndr-head' }, [
      data.work ? el('p', { 'class': 'ndr-work', text: data.work }) : null,
      data.number ? el('p', { 'class': 'ndr-num', text: data.number }) : null,
      data.subtitle ? el('h1', { 'class': 'ndr-sub', text: data.subtitle }) : null
    ]);
    sec.appendChild(head);
    var box = el('div', { 'class': 'ndr-text' });
    data.preface.forEach(function (p) { var n = cloneClean(p); n.className = 'ndr-note'; box.appendChild(n); });
    var main = el('div');
    data.body.forEach(function (b) { main.appendChild(cloneClean(b)); });
    if (settings.blank === 'squash') squashBlank(main);
    box.appendChild(main);
    if (data.after.length) {
      box.appendChild(el('hr', { 'class': 'ndr-sep' }));
      data.after.forEach(function (a) { var n = cloneClean(a); n.className = 'ndr-note ndr-after'; box.appendChild(n); });
    }
    sec.appendChild(box);
    var chars = main.textContent.replace(/\s+/g, '').length;
    head.appendChild(el('p', { 'class': 'ndr-time', text: chars.toLocaleString() + '字 · 約' + Math.max(1, Math.round(chars / CPM)) + '分' }));
    sec.appendChild(el('nav', { 'class': 'ndr-foot' }, [
      navBtn('前へ', data.prev),
      navBtn('目次', data.base ? location.origin + data.base : data.toc),
      navBtn(data.next ? '次の話へ' : '最新話です', data.next, true)
    ]));
    each(sec.querySelectorAll('img'), function (img) {
      img.addEventListener('load', function () { if (paged()) layoutPaged(ratio()); });
    });
    return { data: data, sec: sec, chars: chars };
  }
  /* 連続する空行を1行にまとめる */
  function squashBlank(box) {
    var prevEmpty = false;
    each([].slice.call(box.querySelectorAll('p')), function (p) {
      var empty = !p.textContent.replace(/[\s　]+/g, '') && !p.querySelector('img');
      if (empty && prevEmpty) p.remove(); else prevEmpty = empty;
    });
  }
  function syncBar() {
    var d = current, ep = d && d.kind === 'ep';
    toggleDisabled(bar.querySelector('[data-nav=prev]'), !(ep && d.prev));
    toggleDisabled(bar.querySelector('[data-nav=next]'), !(ep && d.next));
    each(bar.querySelectorAll('[data-jump]'), function (j) { toggleDisabled(j, !(d && d.base)); });
    D.title = ep ? (d.subtitle || d.work || 'なろう夜読み') + (d.work && d.subtitle ? ' - ' + d.work : '')
                 : d.kind === 'shelf' ? '本棚 - なろう夜読み' : (d.work || '目次') + ' - 目次';
  }

  /* opts: { restore: 保存位置へ, r: この割合へ, atEnd: 最後へ } */
  function render(data, opts) {
    opts = opts || {};
    if (data.kind === 'toc') return renderToc(data);
    current = data;
    rememberLast(data);
    page.textContent = '';
    var seg = buildSection(data);
    segs = [seg]; active = 0;
    page.appendChild(seg.sec);
    D.documentElement.classList.toggle('ndr-paged', settings.mode === 'page');
    syncBar();
    var sp = opts.restore ? getPos(data.url) : undefined;
    var r = opts.atEnd ? 1 : (opts.r !== undefined ? opts.r : (sp && sp < 0.98 ? sp : 0));
    W.scrollTo(0, 0);
    if (paged()) {
      page.scrollLeft = 0;
      layoutPaged(r);
      requestAnimationFrame(function () { layoutPaged(r); });
    } else {
      requestAnimationFrame(function () { if (r) scrollToRatio(r); onScroll(); });
    }
    if (opts.restore && sp && sp < 0.98 && sp > 0.01) showToast('続きから ' + Math.round(sp * 100) + '%');
    if (data.next) prefetch(data.next);
  }
  function renderToc(data) {
    /* 2ページ目以降で開いたときは、1ページ目から全話を並べ直す */
    if (data.page > 1) {
      var firstUrl = location.origin + data.base;
      return fetchDoc(firstUrl).then(function (d) {
        var t = parseToc(d, firstUrl);
        if (!t) throw new Error('toc');
        if (location.href === data.url) history.replaceState({ ndr: true }, '', firstUrl);
        renderToc(t);
      }).catch(function () { data.page = 1; renderToc(data); });
    }
    current = data; segs = []; active = 0;
    D.documentElement.classList.remove('ndr-paged');
    page.textContent = '';
    page.appendChild(el('header', { 'class': 'ndr-head' }, [
      el('p', { 'class': 'ndr-num', text: '目次' }),
      data.work ? el('h1', { 'class': 'ndr-sub', text: data.work }) : null
    ]));
    var last = load('last', {})[data.base];
    if (last) {
      page.appendChild(el('a', { 'class': 'ndr-resume', href: last.url }, [
        el('small', { text: '続きから読む' }),
        D.createTextNode((last.num ? last.num + '  ' : '') + (last.title || last.url))
      ]));
    }
    page.appendChild(el('nav', { 'class': 'ndr-jump' }, [
      navBtn('1話目', epUrl(data.base, 1)),
      jumpBtn('話数指定', jumpTo),
      jumpBtn('最新話へ »', jumpLatest, true)
    ]));
    var pos = load('pos', {}), list = el('ul', { 'class': 'ndr-toc' });
    var status = el('p', { 'class': 'ndr-tocstat' }), count = 0, seenEp = {}, curCh = '', pendingCh = null;
    /* 100話ごとの区切り。読書中の話がある区切りだけ開いておく */
    var GROUP = 100, groups = {};
    var lm = last && last.url.match(/\/(\d+)\/?$/), openG = lm ? Math.floor((+lm[1] - 1) / GROUP) : 0;
    function group(num) {
      var g = Math.floor((Math.max(1, num) - 1) / GROUP);
      if (groups[g]) return groups[g];
      var range = el('span', { 'class': 'ndr-t' }), meta = el('span', { 'class': 'ndr-s' });
      var head = el('button', { type: 'button', 'class': 'ndr-gh', 'aria-expanded': 'false' }, [
        el('span', { 'class': 'ndr-chev', text: '▸' }), range, meta
      ]);
      var body = el('ul', { 'class': 'ndr-gb' });
      body.hidden = true;
      var G = groups[g] = { from: 0, to: 0, n: 0, done: 0, lastCh: '', head: head, body: body, range: range, meta: meta };
      head.addEventListener('click', function (e) { e.stopPropagation(); setOpen(G, body.hidden); });
      /* 区切りは話数の順に並べる */
      var li = el('li', { 'class': 'ndr-grp', 'data-g': String(g) }, [head, body]), after = null;
      each(list.children, function (c) { if (!after && +c.getAttribute('data-g') > g) after = c; });
      list.insertBefore(li, after);
      if (g === openG) setOpen(G, true);
      return G;
    }
    function setOpen(G, on) {
      G.body.hidden = !on;
      G.head.setAttribute('aria-expanded', String(on));
      G.head.firstChild.textContent = on ? '▾' : '▸';
    }
    function add(items) {
      items.forEach(function (it) {
        if (it.type === 'chapter') { pendingCh = it.text; return; }
        if (seenEp[it.url]) return;
        if (pendingCh !== null) { curCh = pendingCh; pendingCh = null; }
        seenEp[it.url] = 1; count++;
        var G = group(it.num);
        /* 章名は区切りの中で変わったときだけ出す（区切りの頭では今の章名をもう一度出す） */
        if (curCh && curCh !== G.lastCh) { G.body.appendChild(el('li', { 'class': 'ndr-ch', text: curCh })); G.lastCh = curCh; }
        var r = pos[posKey(it.url)], cls = '', st = '';
        if (r >= 0.95) { cls = 'ndr-done'; st = '既読'; G.done++; } else if (r >= 0.01) { st = Math.round(r * 100) + '%'; }
        if (last && posKey(last.url) === posKey(it.url)) { st = '読書中' + (st && cls !== 'ndr-done' ? ' ' + st : ''); G.reading = true; }
        G.body.appendChild(el('li', null, [el('a', { href: it.url, 'class': cls }, [
          el('span', { 'class': 'ndr-t' }, [
            D.createTextNode(it.title),
            it.date ? el('span', { 'class': 'ndr-d', text: it.date.ymd + (it.date.rev ? '（改）' : '') }) : null
          ]),
          st ? el('span', { 'class': 'ndr-s', text: st }) : null
        ])]));
        G.n++;
        G.from = G.from ? Math.min(G.from, it.num) : it.num; G.to = Math.max(G.to, it.num);
        G.range.textContent = G.from + '〜' + G.to + '話';
        G.meta.textContent = (G.reading ? '読書中 · ' : '') + (G.done ? '既読 ' + G.done + '/' + G.n : G.n + '話');
      });
    }
    add(data.items);
    page.appendChild(list);
    page.appendChild(status);
    syncBar();
    W.scrollTo(0, 0); updateInfo();

    /* 続きの目次ページを順に読み込んで、1つの一覧につなげる（最大100ページ） */
    var hops = 0;
    (function more(t) {
      if (current !== data) return;
      if (!t.next || ++hops > 100) {
        status.textContent = '全' + count + '話' + (t.next ? '（ここまで表示）' : '');
        if (!t.next) { data.next = null; data.lastPage = null; }
        return;
      }
      status.textContent = count + '話まで表示・続きを読み込み中…';
      fetchDoc(t.next).then(function (d) {
        if (current !== data) return;
        var n = parseToc(d, t.next);
        if (!n) { status.textContent = count + '話まで表示（続きを読み込めませんでした）'; return; }
        add(n.items);
        if (n.maxNum > data.maxNum) data.maxNum = n.maxNum;
        more(n);
      }, function () { status.textContent = count + '話まで表示（続きを読み込めませんでした）'; });
    })(data);
  }
  /* ---------- 本棚: 最近読んだ作品・URLやNコードで開く・なろうで探す ---------- */
  function ago(t) {
    if (!t) return '';
    var m = (Date.now() - t) / 60000;
    if (m < 60) return 'さっき';
    if (m < 60 * 24) return Math.floor(m / 60) + '時間前';
    if (m < 60 * 24 * 30) return Math.floor(m / 1440) + '日前';
    var d = new Date(t); return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
  }
  function openQuery(q) {
    q = String(q || '').trim();
    if (!q) return;
    var m = q.match(/(ncode|novel18)\.syosetu\.com\/(n\d{4}[a-z]{1,3})(?:\/(\d+))?/i);
    if (m) {
      var url = 'https://' + m[1].toLowerCase() + '.syosetu.com/' + m[2].toLowerCase() + '/' + (m[3] ? m[3] + '/' : '');
      if (new URL(url).origin === location.origin) go(url, true); else location.href = url;
      return;
    }
    if (/^n\d{4}[a-z]{1,3}$/i.test(q)) { go(location.origin + '/' + q.toLowerCase() + '/', true); return; }
    location.href = 'https://yomou.syosetu.com/search.php?word=' + encodeURIComponent(q);
  }
  function renderShelf() {
    if (current && current.kind === 'ep') setPos(current.url, ratio());
    var back = current && current.kind !== 'shelf' ? current : current && current.back;
    var data = { kind: 'shelf', back: back };
    current = data; segs = []; active = 0;
    D.documentElement.classList.remove('ndr-paged');
    page.textContent = '';
    page.appendChild(el('header', { 'class': 'ndr-head' }, [
      el('p', { 'class': 'ndr-num', text: '本棚' }),
      el('h1', { 'class': 'ndr-sub', text: '作品を選ぶ' })
    ]));
    if (back) page.appendChild(el('nav', { 'class': 'ndr-jump' }, [
      jumpBtn('‹ ' + (back.kind === 'ep' ? (back.subtitle || '読書') : (back.work || '目次')) + ' に戻る', function () { render(back, { restore: true }); })
    ]));
    var input = el('input', { type: 'search', placeholder: 'URL・Nコード・キーワード', enterkeyhint: 'go', autocapitalize: 'off', autocomplete: 'off', 'aria-label': 'URL・Nコード・キーワード' });
    var form = el('form', { 'class': 'ndr-find' }, [input, el('button', { type: 'submit', 'class': 'ndr-btn ndr-primary', text: '開く' })]);
    form.addEventListener('submit', function (e) { e.preventDefault(); input.blur(); openQuery(input.value); });
    page.appendChild(form);

    page.appendChild(el('p', { 'class': 'ndr-cap', text: '最近読んだ作品' }));
    var last = load('last', {}), keys = Object.keys(last).reverse();
    if (!keys.length) page.appendChild(el('p', { 'class': 'ndr-empty', text: 'まだありません。読んだ作品がここに並びます。' }));
    var list = el('ul', { 'class': 'ndr-toc ndr-shelf' });
    keys.forEach(function (k) {
      var it = last[k], li;
      var del = el('button', { type: 'button', 'class': 'ndr-mini', 'aria-label': '本棚から外す', text: '×' });
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        var m = load('last', {}); delete m[k]; save('last', m); li.remove();
      });
      li = el('li', null, [
        el('a', { href: it.url }, [el('span', { 'class': 'ndr-t' }, [
          D.createTextNode(it.work || k.replace(/\//g, '')),
          el('span', { 'class': 'ndr-d', text: '続き：' + [it.num, it.title].filter(Boolean).join(' ') + (it.at ? ' · ' + ago(it.at) : '') })
        ])]),
        el('a', { href: location.origin + k, 'class': 'ndr-mini', text: '目次' }),
        del
      ]);
      list.appendChild(li);
    });
    page.appendChild(list);

    page.appendChild(el('p', { 'class': 'ndr-cap', text: 'なろうで探す（なろうのページへ移動）' }));
    page.appendChild(el('nav', { 'class': 'ndr-links' }, [
      el('a', { 'class': 'ndr-btn', href: 'https://yomou.syosetu.com/rank/top/', text: 'ランキング' }),
      el('a', { 'class': 'ndr-btn', href: 'https://yomou.syosetu.com/search.php?order=new', text: '新着' }),
      el('a', { 'class': 'ndr-btn', href: 'https://syosetu.com/favnovelmain/list/', text: 'ブックマーク' }),
      el('a', { 'class': 'ndr-btn', href: 'https://syosetu.com/', text: 'なろうトップ' })
    ]));
    syncBar();
    W.scrollTo(0, 0); updateInfo();
  }

  /* ---------- 話数ジャンプ（大作向け） ---------- */
  function epUrl(base, n) { return location.origin + base + n + '/'; }
  function knownTotal(data, cb) {
    if (!data) return cb(0);
    if (data.kind === 'ep') {
      if (data.total) return cb(data.total);
      if (!data.toc) return cb(0);
      return fetchDoc(data.toc).then(function (d) { knownTotal(parseToc(d, data.toc), cb); }, function () { cb(0); });
    }
    var lp = data.lastPage;
    if (lp && lp !== data.url) {
      return fetchDoc(lp).then(function (d) {
        var t = parseToc(d, lp); cb(t ? t.maxNum : 0);
      }, function () { cb(0); });
    }
    if (!data.next) return cb(data.maxNum);
    /* 「最後へ」が無い目次は、次のページをたどる（最大60ページ） */
    var hops = 0;
    (function walk(t) {
      if (!t.next || ++hops > 60) return cb(t.next ? 0 : t.maxNum);
      fetchDoc(t.next).then(function (d) { var n = parseToc(d, t.next); if (n) walk(n); else cb(0); }, function () { cb(0); });
    })(data);
  }
  function jumpLatest() {
    var data = current; if (!data || !data.base) return;
    showToast('最新話を探しています…');
    knownTotal(data, function (n) {
      if (n) go(epUrl(data.base, n), true);
      else showToast('最新話を見つけられませんでした');
    });
  }
  function jumpTo() {
    var data = current; if (!data || !data.base) return;
    knownTotal(data, function (n) {
      var cur = data.kind === 'ep' && data.cur ? data.cur : '';
      var ans = W.prompt('何話へ移動しますか？' + (n ? '（1〜' + n + '）' : ''), cur);
      if (ans === null) return;
      var k = parseInt(String(ans).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }), 10);
      if (!k || k < 1 || (n && k > n)) { showToast('1〜' + (n || '最新話') + ' の数字を入れてください'); return; }
      go(epUrl(data.base, k), true);
    });
  }
  function toggleDisabled(b, off) { if (b) { if (off) b.setAttribute('disabled', ''); else b.removeAttribute('disabled'); } }
  function jumpBtn(label, fn, primary) {
    var b = el('button', { type: 'button', 'class': 'ndr-btn' + (primary ? ' ndr-primary' : ''), text: label });
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    return b;
  }
  function navBtn(label, url, primary) {
    var b = el('button', { type: 'button', 'class': 'ndr-btn' + (primary ? ' ndr-primary' : ''), text: label });
    if (!url) b.setAttribute('disabled', '');
    else b.addEventListener('click', function (e) { e.stopPropagation(); go(url, true); });
    return b;
  }

  /* ---------- navigation (同一オリジンで次話を取得し、読書画面のまま進む) ---------- */
  var cache = {};
  function fetchDoc(url) {
    if (cache[url]) return cache[url];
    var p = fetch(url, { credentials: 'include' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    }).then(function (html) {
      return new DOMParser().parseFromString(html, 'text/html');
    });
    p.catch(function () { delete cache[url]; });
    cache[url] = p;
    return p;
  }
  function prefetch(url) { fetchDoc(url).catch(function () {}); }

  function go(url, push, opts) {
    if (loading) return;
    var target = new URL(url, location.href);
    if (target.origin !== location.origin) { location.href = target.href; return; }
    if (current && current.kind === 'ep') setPos(current.url, ratio());
    loading = true; showToast('読み込み中…');
    fetchDoc(target.href).then(function (doc) {
      var data = parseAny(doc, target.href);
      if (!data) throw new Error('not readable');
      if (push) history.pushState({ ndr: true }, '', target.href);
      setUI(false);
      var o = opts || {}; o.restore = !o.atEnd;
      render(data, o);
      if (!(o.restore && getPos(data.url) > 0.01)) toast.classList.remove('ndr-show');
    }).catch(function () {
      /* 年齢確認・レイアウト変更などは普通に遷移する */
      location.href = target.href;
    }).then(function () { loading = false; });
  }
  function onPop() { if (W.__ndr && W.__ndr.on) go(location.href, false); }

  /* ---------- toolbar ---------- */
  function setUI(on) { root.classList.toggle('ndr-ui', on); if (!on) root.classList.remove('ndr-opts-on'); }
  function buildBar() {
    function b(label, attrs, fn) {
      attrs = attrs || {}; attrs.type = 'button'; attrs['class'] = 'ndr-btn'; attrs.text = label;
      attrs.on = { click: function (e) { e.stopPropagation(); fn(); } };
      return el('button', attrs);
    }
    function row(label, kids) { return el('div', { 'class': 'ndr-row' }, [label ? el('span', { 'class': 'ndr-label', text: label }) : null].concat(kids)); }
    info = el('span', { 'class': 'ndr-info', text: '' });
    var LH = [1.6, 1.8, 1.95, 2.2, 2.5], DIM = [0, 0.25, 0.45, 0.6];
    bar = el('div', { id: 'ndr-bar', role: 'toolbar', 'aria-label': '読書メニュー' }, [
      row(null, [
        b('‹ 前', { 'data-nav': 'prev' }, function () { if (current && current.prev) go(current.prev, true); }),
        info,
        b('次 ›', { 'data-nav': 'next' }, function () { if (current && current.next) go(current.next, true); })
      ]),
      row(null, [
        b('1話目', { 'data-jump': '' }, function () { if (current && current.base) go(epUrl(current.base, 1), true); }),
        b('話数指定', { 'data-jump': '' }, jumpTo),
        b('目次', { 'data-jump': '' }, function () { if (current && current.base) go(location.origin + current.base, true); }),
        b('最新話 »', { 'data-jump': '' }, jumpLatest)
      ]),
      el('div', { 'class': 'ndr-opts' }, [
        row('文字', [
          b('A−', null, function () { setSetting('size', Math.max(13, settings.size - 1)); showToast(settings.size + 'px'); }),
          b('A＋', null, function () { setSetting('size', Math.min(30, settings.size + 1)); showToast(settings.size + 'px'); }),
          b('行間', null, function () { var i = LH.indexOf(settings.lh); setSetting('lh', LH[(i + 1) % LH.length]); showToast('行間 ' + settings.lh); }),
          b('書体', { 'data-font': '' }, function () { setSetting('font', settings.font === 'mincho' ? 'gothic' : 'mincho'); })
        ]),
        row('配色', Object.keys(THEMES).map(function (k) {
          return b(THEMES[k].label, { 'data-theme': k }, function () { setSetting('theme', k); });
        }).concat([b('減光', { 'data-dim': '' }, function () {
          var i = DIM.indexOf(settings.dim || 0); setSetting('dim', DIM[(i + 1) % DIM.length]);
        })])),
        row('読み方', [
          b('スクロール', { 'data-mode': 'scroll' }, function () { setSetting('mode', 'scroll', true); }),
          b('ページ', { 'data-mode': 'page' }, function () { setSetting('mode', 'page', true); showToast('画面の右をタップで次のページ'); })
        ]),
        row('', [
          b('空行', { 'data-blank': '' }, function () { setSetting('blank', settings.blank === 'squash' ? 'keep' : 'squash', true); }),
          b('タップ', { 'data-tap': '' }, function () { setSetting('tap', settings.tap === 'any' ? 'side' : 'any'); })
        ])
      ]),
      row(null, [
        b('本棚', null, function () { setUI(false); renderShelf(); }),
        b('表示設定', null, function () { root.classList.toggle('ndr-opts-on'); }),
        b('閉じる', null, function () { api.toggle(); })
      ])
    ]);
    bar.addEventListener('click', function (e) { e.stopPropagation(); });
    return bar;
  }

  /* ---------- 操作: タップ・スワイプ・キー ---------- */
  var touch = null, swallowClick = 0;
  function onClick(e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a && page.contains(a) && !a.target && !e.metaKey && !e.ctrlKey) {
      var href = abs(a.getAttribute('href'), current ? current.url : location.href);
      if (href && new URL(href).origin === location.origin) { e.preventDefault(); go(href, true); return; }
    }
    if (e.target.closest && e.target.closest('a,img,button,input,form')) return;
    if (Date.now() - swallowClick < 500) return;
    var sel = W.getSelection && W.getSelection();
    if (sel && String(sel).length) return;
    if (root.classList.contains('ndr-ui')) { setUI(false); return; }
    if (paged()) {
      var x = e.clientX / W.innerWidth;
      if (x > 0.3 && x < 0.7) { setUI(true); return; }
      if (settings.tap === 'any') turn(1); else turn(x >= 0.7 ? 1 : -1);
      return;
    }
    setUI(true);
  }
  function onTouchStart(e) {
    if (!paged() || e.touches.length !== 1 || bar.contains(e.target)) { touch = null; return; }
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e) {
    if (!touch || !paged()) return;
    var t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swallowClick = Date.now();
      if (root.classList.contains('ndr-ui')) setUI(false);
      turn(dx < 0 ? 1 : -1);
    }
  }
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea/i.test(e.target.tagName)) return;
    var k = e.key;
    if (paged()) {
      if (k === 'ArrowRight' || k === ' ' || k === 'PageDown') { e.preventDefault(); turn(1); }
      else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); turn(-1); }
    } else if (k === 'ArrowRight' && current && current.next) go(current.next, true);
    else if (k === 'ArrowLeft' && current && current.prev) go(current.prev, true);
  }
  var resizeTimer = 0;
  function onResize() {
    if (!paged()) return;
    var r = ratio();
    clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { layoutPaged(r); }, 120);
  }

  /* ---------- on / off ---------- */
  function ensureMeta(name, content) {
    var m = D.querySelector('meta[name="' + name + '"]'), had = !!m;
    if (!m) { m = D.createElement('meta'); m.setAttribute('name', name); D.head.appendChild(m); }
    var old = m.getAttribute('content');
    m.setAttribute('content', content);
    return { el: m, had: had, old: old };
  }
  function onHide() { if (current && current.kind === 'ep' && api.on) setPos(current.url, ratio()); }

  function enable(data) {
    saved.scroll = W.scrollY;
    styleEl = el('style', { id: 'ndr-style' }); styleEl.textContent = CSS; D.head.appendChild(styleEl);
    metaVp = ensureMeta('viewport', 'width=device-width,initial-scale=1,viewport-fit=cover');
    metaTheme = ensureMeta('theme-color', THEMES[settings.theme].bg).el;
    progress = el('div', { id: 'ndr-progress' });
    shade = el('div', { id: 'ndr-shade' });
    pageno = el('div', { id: 'ndr-pageno' });
    page = el('article', { id: 'ndr-page' });
    toast = el('div', { id: 'ndr-toast', role: 'status', 'aria-live': 'polite' });
    root = el('div', { id: 'ndr-root', lang: 'ja' }, [progress, page, pageno, shade, buildBar(), toast]);
    root.addEventListener('click', onClick);
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchend', onTouchEnd, { passive: true });
    D.body.appendChild(root);
    D.documentElement.classList.add('ndr-on');
    D.documentElement.style.colorScheme = 'dark';
    applyVars();
    W.addEventListener('scroll', onScroll, { passive: true });
    W.addEventListener('popstate', onPop);
    W.addEventListener('pagehide', onHide);
    W.addEventListener('resize', onResize);
    D.addEventListener('keydown', onKey);
    api.on = true;
    render(data, { restore: true });
  }

  function disable() {
    onHide();
    W.removeEventListener('scroll', onScroll);
    W.removeEventListener('popstate', onPop);
    W.removeEventListener('pagehide', onHide);
    W.removeEventListener('resize', onResize);
    D.removeEventListener('keydown', onKey);
    root.remove(); styleEl.remove();
    if (metaVp) { if (metaVp.had) metaVp.el.setAttribute('content', metaVp.old || ''); else metaVp.el.remove(); }
    if (metaTheme) metaTheme.remove();
    D.documentElement.classList.remove('ndr-on', 'ndr-paged');
    D.documentElement.style.colorScheme = '';
    api.on = false;
    /* 読書画面の中で別の話に進んでいたら、その話のページを開き直す */
    if (posKey(location.href) !== posKey(startUrl)) { location.reload(); return; }
    W.scrollTo(0, saved.scroll);
  }

  var startUrl = location.href;
  var api = { version: VERSION, on: false, toggle: function () {
    if (dimMode) { D.documentElement.classList.toggle('ndr-dim'); return; }
    if (api.on) disable(); else enable(parseAny(D, location.href) || current);
  } };
  W.__ndr = api;

  var dimMode = false;
  var first = parseAny(D, location.href);
  if (first) {
    enable(first);
  } else {
    /* 話ページ・目次以外（トップ・ランキングなど）は色を反転するだけの簡易ダークにする */
    dimMode = true;
    D.documentElement.classList.add('ndr-dim');
    styleEl = el('style', { id: 'ndr-style' }); styleEl.textContent = CSS; D.head.appendChild(styleEl);
  }
})();
