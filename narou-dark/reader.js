/* なろう夜読み / Narou Night Reader
 * 小説家になろうの話ページ上で実行し、ダークモードの読書画面に差し替える。
 * ブックマークレットとして配布する（index.html が javascript: URL に変換する）。
 * もう一度実行すると元のページに戻る。データは syosetu.com 側の localStorage にだけ残る。
 */
(function () {
  'use strict';
  var VERSION = '1.2.0';
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
  var DEFAULTS = { theme: 'dark', font: 'mincho', size: 18, lh: 1.95 };

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
      items.push({ type: 'ep', url: hu.origin + hu.pathname.replace(/\/?$/, '/'), title: t, num: +m[1] });
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
  function parseAny(doc, url) { return parse(doc, url) || parseToc(doc, url); }

  /* 作品ごとに最後に読んだ話（目次の「続きから」用） */
  function tocBase(url) { var m = new URL(url, location.href).pathname.match(/^(.*\/)\d+\/?$/); return m ? m[1] : null; }
  function rememberLast(data) {
    var b = tocBase(data.url); if (!b) return;
    var m = load('last', {}); delete m[b];
    m[b] = { url: data.url, title: data.subtitle || '', num: data.number || '' };
    var k = Object.keys(m); while (k.length > 200) delete m[k.shift()];
    save('last', m);
  }

  /* ---------- styles ---------- */
  var CSS = [
    'html.ndr-on,html.ndr-on body{background:var(--ndr-bg)!important;margin:0!important;padding:0!important;min-height:100%;}',
    'html.ndr-on body>*:not(#ndr-root){display:none!important;}',
    'html.ndr-dim{filter:invert(.9) hue-rotate(180deg);background:#fff;}',
    'html.ndr-dim img,html.ndr-dim video,html.ndr-dim iframe{filter:invert(1) hue-rotate(180deg);}',
    '#ndr-root{all:initial;display:block;background:var(--ndr-bg);color:var(--ndr-fg);font-family:var(--ndr-font);font-size:var(--ndr-size);line-height:var(--ndr-lh);',
    '  -webkit-text-size-adjust:100%;text-size-adjust:100%;min-height:100vh;-webkit-tap-highlight-color:transparent;}',
    '#ndr-root *{box-sizing:border-box;}',
    '#ndr-root :where(p,h1,div,span,ruby,rt,article,header,nav,hr){font-size:inherit;line-height:inherit;color:inherit;font-family:inherit;font-weight:inherit;letter-spacing:normal;background:none;text-align:left;}',
    '#ndr-progress{position:fixed;top:0;left:0;height:2px;width:0;background:var(--ndr-accent);z-index:3;opacity:.8;}',
    '#ndr-page{max-width:38em;margin:0 auto;padding:calc(env(safe-area-inset-top) + 28px) calc(env(safe-area-inset-right) + 20px) calc(env(safe-area-inset-bottom) + 120px) calc(env(safe-area-inset-left) + 20px);}',
    '#ndr-head{margin:0 0 2.2em;}',
    '#ndr-work{font-size:.72em;line-height:1.6;color:var(--ndr-mute);margin:0 0 .6em;letter-spacing:.02em;}',
    '#ndr-num{font:500 .66em/1 ui-monospace,Menlo,monospace;color:var(--ndr-accent);letter-spacing:.08em;margin:0 0 .7em;}',
    '#ndr-sub{font-size:1.28em;line-height:1.5;font-weight:600;margin:0;color:var(--ndr-fg);}',
    '#ndr-text p{margin:0;min-height:1em;word-break:normal;overflow-wrap:anywhere;}',
    '#ndr-text img{max-width:100%;height:auto;display:block;margin:1em auto;}',
    '#ndr-text a{color:var(--ndr-accent);}',
    '#ndr-text rt{font-size:.5em;line-height:1;color:var(--ndr-mute);}',
    '#ndr-root .ndr-note{font-size:.88em;color:var(--ndr-mute);border-left:2px solid var(--ndr-line);padding-left:1em;margin:0 0 2.4em;}',
    '#ndr-root .ndr-note.ndr-after{margin:3em 0 0;}',
    '#ndr-root .ndr-sep{border:0;border-top:1px solid var(--ndr-line);margin:3em 0 0;}',
    '#ndr-foot{display:flex;gap:10px;margin:2.4em 0 0;font-family:-apple-system,"Hiragino Sans",sans-serif;font-size:15px;}',
    '.ndr-btn{appearance:none;-webkit-appearance:none;border:1px solid var(--ndr-line);background:transparent;color:var(--ndr-fg);',
    '  font:inherit;font-family:-apple-system,"Hiragino Sans",sans-serif;font-size:15px;line-height:1;padding:14px 12px;border-radius:12px;text-align:center;text-decoration:none;cursor:pointer;flex:1;min-height:48px;display:flex;align-items:center;justify-content:center;}',
    '.ndr-btn[disabled]{opacity:.3;pointer-events:none;}',
    '.ndr-btn.ndr-primary{border-color:var(--ndr-accent);color:var(--ndr-accent);flex:2;font-weight:600;}',
    '#ndr-bar{position:fixed;left:0;right:0;bottom:0;z-index:4;background:var(--ndr-panel);border-top:1px solid var(--ndr-line);',
    '  -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);padding:12px calc(env(safe-area-inset-right) + 14px) calc(env(safe-area-inset-bottom) + 12px) calc(env(safe-area-inset-left) + 14px);',
    '  transform:translateY(110%);transition:transform .22s ease;font-family:-apple-system,"Hiragino Sans",sans-serif;font-size:14px;color:var(--ndr-fg);}',
    '#ndr-root.ndr-ui #ndr-bar{transform:none;}',
    '#ndr-bar .ndr-row{display:flex;gap:8px;max-width:38rem;margin:0 auto 8px;}',
    '#ndr-bar .ndr-row:last-child{margin-bottom:0;}',
    '#ndr-bar .ndr-btn{padding:10px 4px;min-height:42px;font-size:14px;white-space:nowrap;}',
    '#ndr-bar .ndr-btn[data-font]{flex:1.5;}',
    '#ndr-bar .ndr-btn.ndr-sel{border-color:var(--ndr-accent);color:var(--ndr-accent);}',
    '#ndr-bar .ndr-info{flex:2;display:flex;align-items:center;justify-content:center;color:var(--ndr-mute);font-size:12px;font-variant-numeric:tabular-nums;}',
    '#ndr-toast{position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 14px);transform:translateX(-50%);z-index:5;background:var(--ndr-panel);color:var(--ndr-fg);',
    '  border:1px solid var(--ndr-line);border-radius:999px;padding:8px 16px;font:13px -apple-system,"Hiragino Sans",sans-serif;opacity:0;transition:opacity .2s;pointer-events:none;}',
    '#ndr-toast.ndr-show{opacity:1;}',
    '#ndr-root .ndr-toc{list-style:none;margin:0;padding:0;font-family:-apple-system,"Hiragino Sans",sans-serif;font-size:16px;line-height:1.5;}',
    '#ndr-root .ndr-toc li{margin:0;border-bottom:1px solid var(--ndr-line);}',
    '#ndr-root .ndr-toc a{display:flex;gap:12px;align-items:baseline;padding:15px 2px;color:var(--ndr-fg);text-decoration:none;}',
    '#ndr-root .ndr-toc a .ndr-t{flex:1;}',
    '#ndr-root .ndr-toc a .ndr-s{font-size:12px;color:var(--ndr-accent);white-space:nowrap;}',
    '#ndr-root .ndr-toc a.ndr-done{color:var(--ndr-mute);}',
    '#ndr-root .ndr-toc a.ndr-done .ndr-s{color:var(--ndr-mute);}',
    '#ndr-root .ndr-toc .ndr-ch{padding:26px 2px 8px;font-size:13px;font-weight:600;color:var(--ndr-mute);border-bottom:1px solid var(--ndr-line);}',
    '#ndr-root .ndr-resume{display:block;margin:0 0 1.6em;padding:14px 16px;border:1px solid var(--ndr-accent);border-radius:12px;color:var(--ndr-fg);text-decoration:none;font-family:-apple-system,"Hiragino Sans",sans-serif;font-size:15px;line-height:1.5;}',
    '#ndr-jump{display:flex;gap:8px;margin:0 0 1.6em;font-size:14px;}',
    '#ndr-jump .ndr-btn{font-size:14px;padding:12px 6px;white-space:nowrap;}',
    '#ndr-root .ndr-resume small{display:block;color:var(--ndr-accent);font-size:12px;margin-bottom:2px;}'
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

  /* ---------- state ---------- */
  var root, page, bar, info, toast, progress, styleEl, metaVp, metaTheme;
  var current = null, loading = false, saveTimer = 0, toastTimer = 0;
  var saved = { viewport: null, scroll: 0, hadVp: false };

  function applyVars() {
    var t = THEMES[settings.theme], s = D.documentElement.style;
    s.setProperty('--ndr-bg', t.bg); s.setProperty('--ndr-fg', t.fg); s.setProperty('--ndr-mute', t.mute);
    s.setProperty('--ndr-line', t.line); s.setProperty('--ndr-accent', t.accent); s.setProperty('--ndr-panel', t.panel);
    s.setProperty('--ndr-font', FONTS[settings.font]);
    s.setProperty('--ndr-size', settings.size + 'px'); s.setProperty('--ndr-lh', String(settings.lh));
    if (metaTheme) metaTheme.setAttribute('content', t.bg);
    if (bar) {
      var sel = bar.querySelectorAll('[data-theme]');
      for (var i = 0; i < sel.length; i++) sel[i].classList.toggle('ndr-sel', sel[i].getAttribute('data-theme') === settings.theme);
      var fb = bar.querySelector('[data-font]');
      if (fb) fb.textContent = settings.font === 'mincho' ? '明朝' : 'ゴシック';
    }
  }
  function setSetting(k, v) { var r = ratio(); settings[k] = v; save('settings', settings); applyVars(); scrollToRatio(r); }

  function showToast(msg) {
    toast.textContent = msg; toast.classList.add('ndr-show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove('ndr-show'); }, 1400);
  }

  function ratio() {
    var max = D.documentElement.scrollHeight - W.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, W.scrollY / max)) : 0;
  }
  function scrollToRatio(r) {
    var max = D.documentElement.scrollHeight - W.innerHeight;
    W.scrollTo(0, Math.max(0, Math.round(max * r)));
  }
  function onScroll() {
    if (!current) return;
    var r = ratio();
    progress.style.width = (r * 100).toFixed(2) + '%';
    if (info) info.textContent = Math.round(r * 100) + '%';
    if (current.kind !== 'ep') return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { setPos(current.url, r); }, 250);
  }

  /* ---------- render ---------- */
  function render(data, restore) {
    if (data.kind === 'toc') return renderToc(data);
    current = data;
    rememberLast(data);
    page.textContent = '';
    var head = el('header', { id: 'ndr-head' }, [
      data.work ? el('p', { id: 'ndr-work', text: data.work }) : null,
      data.number ? el('p', { id: 'ndr-num', text: data.number }) : null,
      data.subtitle ? el('h1', { id: 'ndr-sub', text: data.subtitle }) : null
    ]);
    page.appendChild(head);
    var textBox = el('div', { id: 'ndr-text' });
    data.preface.forEach(function (p) { var n = cloneClean(p); n.className = 'ndr-note'; textBox.appendChild(n); });
    data.body.forEach(function (b) { textBox.appendChild(cloneClean(b)); });
    if (data.after.length) {
      textBox.appendChild(el('hr', { 'class': 'ndr-sep' }));
      data.after.forEach(function (a) { var n = cloneClean(a); n.className = 'ndr-note ndr-after'; textBox.appendChild(n); });
    }
    page.appendChild(textBox);
    page.appendChild(el('nav', { id: 'ndr-foot' }, [
      navBtn('前へ', data.prev),
      navBtn('目次', data.toc),
      navBtn(data.next ? '次の話へ' : '最新話です', data.next, true)
    ]));
    var bp = bar.querySelector('[data-nav=prev]'), bn = bar.querySelector('[data-nav=next]');
    toggleDisabled(bp, !data.prev); toggleDisabled(bn, !data.next);
    [].forEach.call(bar.querySelectorAll('[data-jump]'), function (j) { toggleDisabled(j, !data.base); });
    D.title = (data.subtitle || data.work || 'なろう夜読み') + (data.work && data.subtitle ? ' - ' + data.work : '');

    var r = restore ? getPos(data.url) : 0;
    W.scrollTo(0, 0);
    if (r) requestAnimationFrame(function () { scrollToRatio(r); onScroll(); showToast('続きから ' + Math.round(r * 100) + '%'); });
    else onScroll();
    if (data.next) prefetch(data.next);
  }
  function renderToc(data) {
    current = data;
    page.textContent = '';
    page.appendChild(el('header', { id: 'ndr-head' }, [
      el('p', { id: 'ndr-num', text: data.page > 1 ? '目次 ' + data.page + 'ページ' : '目次' }),
      data.work ? el('h1', { id: 'ndr-sub', text: data.work }) : null
    ]));
    var last = load('last', {})[data.base];
    if (last) {
      page.appendChild(el('a', { 'class': 'ndr-resume', href: last.url }, [
        el('small', { text: '続きから読む' }),
        D.createTextNode((last.num ? last.num + '  ' : '') + (last.title || last.url))
      ]));
    }
    page.appendChild(el('nav', { id: 'ndr-jump' }, [
      navBtn('1話目', epUrl(data.base, 1)),
      jumpBtn('話数指定', jumpTo),
      jumpBtn('最新話へ »', jumpLatest, true)
    ]));
    var pos = load('pos', {}), list = el('ul', { 'class': 'ndr-toc' });
    data.items.forEach(function (it) {
      if (it.type === 'chapter') { list.appendChild(el('li', { 'class': 'ndr-ch', text: it.text })); return; }
      var r = pos[posKey(it.url)], cls = '', st = '';
      if (r >= 0.95) { cls = 'ndr-done'; st = '既読'; } else if (r >= 0.01) { st = Math.round(r * 100) + '%'; }
      if (last && posKey(last.url) === posKey(it.url)) st = '読書中' + (st && cls !== 'ndr-done' ? ' ' + st : '');
      list.appendChild(el('li', null, [el('a', { href: it.url, 'class': cls }, [
        el('span', { 'class': 'ndr-t', text: it.title }), st ? el('span', { 'class': 'ndr-s', text: st }) : null
      ])]));
    });
    page.appendChild(list);
    if (data.prev || data.next) page.appendChild(el('nav', { id: 'ndr-foot' }, [
      navBtn('前のページ', data.prev), navBtn('次のページ', data.next, true)
    ]));
    var bp = bar.querySelector('[data-nav=prev]'), bn = bar.querySelector('[data-nav=next]');
    toggleDisabled(bp, !data.prev); toggleDisabled(bn, !data.next);
    [].forEach.call(bar.querySelectorAll('[data-jump]'), function (j) { toggleDisabled(j, false); });
    D.title = (data.work || '目次') + ' - 目次';
    W.scrollTo(0, 0); onScroll();
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
    if (data.lastPage && data.lastPage !== data.url) {
      return fetchDoc(data.lastPage).then(function (d) {
        var t = parseToc(d, data.lastPage); cb(t ? t.maxNum : 0);
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

  function go(url, push) {
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
      render(data, true);
      toast.classList.remove('ndr-show');
    }).catch(function () {
      /* 目次ページ・年齢確認・レイアウト変更などは普通に遷移する */
      location.href = target.href;
    }).then(function () { loading = false; });
  }
  function onPop() { if (W.__ndr && W.__ndr.on) go(location.href, false); }

  /* ---------- toolbar ---------- */
  function setUI(on) { root.classList.toggle('ndr-ui', on); }
  function buildBar() {
    function b(label, attrs, fn) {
      attrs = attrs || {}; attrs.type = 'button'; attrs['class'] = 'ndr-btn'; attrs.text = label;
      attrs.on = { click: function (e) { e.stopPropagation(); fn(); } };
      return el('button', attrs);
    }
    info = el('span', { 'class': 'ndr-info', text: '0%' });
    bar = el('div', { id: 'ndr-bar', role: 'toolbar', 'aria-label': '読書設定' }, [
      el('div', { 'class': 'ndr-row' }, [
        b('‹ 前', { 'data-nav': 'prev' }, function () { if (current && current.prev) go(current.prev, true); }),
        info,
        b('次 ›', { 'data-nav': 'next' }, function () { if (current && current.next) go(current.next, true); })
      ]),
      el('div', { 'class': 'ndr-row' }, [
        b('A−', null, function () { setSetting('size', Math.max(13, settings.size - 1)); showToast(settings.size + 'px'); }),
        b('A＋', null, function () { setSetting('size', Math.min(30, settings.size + 1)); showToast(settings.size + 'px'); }),
        b('行間', null, function () {
          var steps = [1.6, 1.8, 1.95, 2.2, 2.5], i = steps.indexOf(settings.lh);
          setSetting('lh', steps[(i + 1) % steps.length]); showToast('行間 ' + settings.lh);
        }),
        b('書体', { 'data-font': '' }, function () { setSetting('font', settings.font === 'mincho' ? 'gothic' : 'mincho'); })
      ]),
      el('div', { 'class': 'ndr-row' }, [
        b('1話目', { 'data-jump': '' }, function () { if (current && current.base) go(epUrl(current.base, 1), true); }),
        b('話数指定', { 'data-jump': '' }, jumpTo),
        b('最新話 »', { 'data-jump': '' }, jumpLatest)
      ]),
      el('div', { 'class': 'ndr-row' }, Object.keys(THEMES).map(function (k) {
        return b(THEMES[k].label, { 'data-theme': k }, function () { setSetting('theme', k); });
      }).concat([b('閉じる', null, function () { api.toggle(); })]))
    ]);
    bar.addEventListener('click', function (e) { e.stopPropagation(); });
    return bar;
  }

  /* ---------- on / off ---------- */
  function ensureMeta(name, content) {
    var m = D.querySelector('meta[name="' + name + '"]'), had = !!m;
    if (!m) { m = D.createElement('meta'); m.setAttribute('name', name); D.head.appendChild(m); }
    var old = m.getAttribute('content');
    m.setAttribute('content', content);
    return { el: m, had: had, old: old };
  }

  function enable(data) {
    saved.scroll = W.scrollY;
    styleEl = el('style', { id: 'ndr-style' }); styleEl.textContent = CSS; D.head.appendChild(styleEl);
    metaVp = ensureMeta('viewport', 'width=device-width,initial-scale=1,viewport-fit=cover');
    metaTheme = ensureMeta('theme-color', THEMES[settings.theme].bg).el;
    progress = el('div', { id: 'ndr-progress' });
    page = el('article', { id: 'ndr-page' });
    toast = el('div', { id: 'ndr-toast', role: 'status', 'aria-live': 'polite' });
    root = el('div', { id: 'ndr-root', lang: 'ja' }, [progress, page, buildBar(), toast]);
    root.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (a && page.contains(a) && !a.target && !e.metaKey && !e.ctrlKey) {
        var href = abs(a.getAttribute('href'), current ? current.url : location.href);
        if (href && new URL(href).origin === location.origin) { e.preventDefault(); go(href, true); return; }
      }
      if (e.target.closest && e.target.closest('a,img,button')) return;
      var sel = W.getSelection && W.getSelection();
      if (sel && String(sel).length) return;
      setUI(!root.classList.contains('ndr-ui'));
    });
    D.body.appendChild(root);
    D.documentElement.classList.add('ndr-on');
    D.documentElement.style.colorScheme = 'dark';
    applyVars();
    W.addEventListener('scroll', onScroll, { passive: true });
    W.addEventListener('popstate', onPop);
    W.addEventListener('pagehide', function () { if (current && current.kind === 'ep' && api.on) setPos(current.url, ratio()); });
    render(data, true);
    api.on = true;
  }

  function disable() {
    if (current && current.kind === 'ep') setPos(current.url, ratio());
    W.removeEventListener('scroll', onScroll);
    W.removeEventListener('popstate', onPop);
    root.remove(); styleEl.remove();
    if (metaVp) { if (metaVp.had) metaVp.el.setAttribute('content', metaVp.old || ''); else metaVp.el.remove(); }
    if (metaTheme) metaTheme.remove();
    D.documentElement.classList.remove('ndr-on');
    D.documentElement.style.colorScheme = '';
    api.on = false;
    /* 読書画面の中で別の話に進んでいたら、その話のページを開き直す */
    if (current && posKey(current.url) !== posKey(startUrl)) { location.reload(); return; }
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
