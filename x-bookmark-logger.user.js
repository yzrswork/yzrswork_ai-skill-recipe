// ==UserScript==
// @name         X Bookmark Logger
// @name:ja      X ブックマークロガー
// @namespace    https://yzrswork.github.io/yzrswork_ai-skill-recipe/
// @version      1.0.0
// @description  Log your X (Twitter) bookmarks to a GitHub repository (Obsidian vault) as Markdown files.
// @description:ja Xでブックマークしたツイートを自動的にGitHubリポジトリ（Obsidian Vault）へMarkdownとして保存します。
// @author       yzrswork
// @match        https://x.com/*
// @match        https://twitter.com/*
// @match        https://mobile.twitter.com/*
// @run-at       document-start
// @inject-into  page
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      api.github.com
// @noframes
// @homepageURL  https://yzrswork.github.io/yzrswork_ai-skill-recipe/x-bookmark-logger.html
// @downloadURL  https://yzrswork.github.io/yzrswork_ai-skill-recipe/x-bookmark-logger.user.js
// @updateURL    https://yzrswork.github.io/yzrswork_ai-skill-recipe/x-bookmark-logger.user.js
// ==/UserScript==

/*
 * 仕組み:
 *   x.com の GraphQL 通信(XHR/fetch)を傍受し、
 *   - CreateBookmark ミューテーション → リアルタイムでブックマークを記録
 *   - Bookmarks タイムライン(/i/bookmarks のスクロール) → 差分同期
 *   タイムライン系レスポンスから「ツイートキャッシュ」を作り、本文・作者を補完。
 *   記録は localStorage キューに積み、GitHub contents API で1件=1 Markdownファイルとして
 *   直列コミットする。GM_xmlhttpRequest が使えない環境(iOS Userscripts の page ワールド)では
 *   キューに積むだけにし、コンパニオンスクリプト(x-bookmark-uploader.user.js)が送信を担当する。
 */

(function () {
  'use strict';

  // ───────────────────────── 環境検出 ─────────────────────────

  const W = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;

  const gmRequest =
    (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest :
    (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') ? GM.xmlHttpRequest :
    null;

  const GRAPHQL_RE = /\/i\/api\/graphql\/[^/]+\/([A-Za-z0-9_]+)/;

  const LS = {
    CONFIG: 'xbm.config',
    QUEUE: 'xbm.queue',
    LOGGED: 'xbm.logged',
    CACHE: 'xbm.tweetcache',
    STATUS: 'xbm.status',
    LOCK: 'xbm.lock',
    CAP: 'xbm.cap_gm',
  };

  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota/private mode */ }
  }

  // コンパニオン(uploader)に「メイン側でGM送信できるか」を伝える
  lsSet(LS.CAP, gmRequest ? '1' : '0');

  // ───────────────────────── 設定 ─────────────────────────

  const DEFAULT_CONFIG = {
    owner: '',
    repo: '',
    branch: 'main',
    folder: 'X Bookmarks',
    token: '',
    enabled: true,
  };

  function getConfig() { return Object.assign({}, DEFAULT_CONFIG, lsGet(LS.CONFIG, {})); }
  function configValid(c) { return !!(c.owner && c.repo && c.token && c.enabled); }

  // ───────────────────────── 純関数: 抽出・整形 ─────────────────────────

  function decodeEntities(s) {
    return String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  // t.co短縮URLを展開し、メディア用t.coリンクを除去する
  function expandText(text, urls, mediaEntities) {
    let t = String(text || '');
    for (const u of urls || []) {
      if (u && u.url && u.expanded_url) t = t.split(u.url).join(u.expanded_url);
    }
    for (const m of mediaEntities || []) {
      if (m && m.url) t = t.split(m.url).join('');
    }
    return decodeEntities(t).trim();
  }

  // "Wed Oct 10 20:19:24 +0000 2018" → ISO 8601 (UTC)
  function parseTwitterDate(s) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // タイムゾーンオフセット付きローカルISO文字列
  function localISO(d) {
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? '+' : '-';
    const p = (n) => String(Math.abs(n)).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) +
      sign + p(Math.floor(Math.abs(off) / 60)) + ':' + p(Math.abs(off) % 60);
  }

  // GraphQLのtweetノード(__typename: Tweet / TweetWithVisibilityResults)を正規化する。
  // 抽出できない(Tombstone等)場合は null。
  function extractTweet(node) {
    if (!node || typeof node !== 'object') return null;
    let t = node;
    if (t.__typename === 'TweetWithVisibilityResults' && t.tweet) t = t.tweet;
    if (!t.rest_id || !t.legacy) return null;

    const legacy = t.legacy;
    const userResult = t.core && t.core.user_results && t.core.user_results.result;
    // screen_name は旧 legacy 配下と新 core 配下の両対応
    const userLegacy = (userResult && userResult.legacy) || {};
    const userCore = (userResult && userResult.core) || {};
    const screenName = userLegacy.screen_name || userCore.screen_name || '';
    const authorName = userLegacy.name || userCore.name || '';

    // 長文ツイート(note_tweet)があればそちらを優先。URL展開はそれぞれのentity setで行う
    let text;
    const note = t.note_tweet && t.note_tweet.note_tweet_results && t.note_tweet.note_tweet_results.result;
    if (note && note.text) {
      const noteUrls = (note.entity_set && note.entity_set.urls) || [];
      text = expandText(note.text, noteUrls, legacy.entities && legacy.entities.media);
    } else {
      text = expandText(legacy.full_text, legacy.entities && legacy.entities.urls, legacy.entities && legacy.entities.media);
    }

    const media = [];
    const mediaEntities = (legacy.extended_entities && legacy.extended_entities.media) || [];
    for (const m of mediaEntities) {
      if (!m) continue;
      if (m.type === 'photo' && m.media_url_https) {
        media.push(m.media_url_https);
      } else if ((m.type === 'video' || m.type === 'animated_gif') && m.video_info && Array.isArray(m.video_info.variants)) {
        let best = null;
        for (const v of m.video_info.variants) {
          if (v && v.content_type === 'video/mp4' && (!best || (v.bitrate || 0) > (best.bitrate || 0))) best = v;
        }
        if (best && best.url) media.push(best.url);
        else if (m.media_url_https) media.push(m.media_url_https);
      }
    }

    let quote = null;
    const quotedNode = t.quoted_status_result && t.quoted_status_result.result;
    if (quotedNode) {
      const q = extractTweet(quotedNode);
      if (q) quote = { screen_name: q.screen_name, author_name: q.author_name, text: q.text, url: q.url };
    }

    return {
      id: t.rest_id,
      url: 'https://x.com/' + (screenName || 'i/web') + '/status/' + t.rest_id,
      screen_name: screenName,
      author_name: authorName,
      text: text,
      posted_at: parseTwitterDate(legacy.created_at),
      media: media,
      quote: quote,
    };
  }

  // GraphQLレスポンスJSONを深さ優先で走査し、tweetノードを全て収集(キャッシュ用)
  function collectTweets(json) {
    const out = [];
    const seen = new Set();
    (function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 40) return;
      if (Array.isArray(node)) {
        for (const v of node) walk(v, depth + 1);
        return;
      }
      if (node.rest_id && node.legacy && node.core && !seen.has(node.rest_id)) {
        const t = extractTweet(node);
        if (t) { seen.add(t.id); out.push(t); }
      }
      for (const k in node) walk(node[k], depth + 1);
    })(json, 0);
    return out;
  }

  // Bookmarksタイムラインレスポンスから「ブックマーク本体」のツイートIDのみを抽出。
  // (deep walkだと引用元ツイートまで拾ってしまうため、entries の entryId で判定する)
  function bookmarkEntryIds(json) {
    const ids = [];
    (function findInstructions(node, depth) {
      if (!node || typeof node !== 'object' || depth > 20) return;
      if (Array.isArray(node)) {
        for (const v of node) findInstructions(v, depth + 1);
        return;
      }
      if (Array.isArray(node.instructions)) {
        for (const ins of node.instructions) {
          if (!ins || !Array.isArray(ins.entries)) continue;
          for (const entry of ins.entries) {
            if (!entry || typeof entry.entryId !== 'string' || !entry.entryId.startsWith('tweet-')) continue;
            const result = entry.content && entry.content.itemContent &&
              entry.content.itemContent.tweet_results && entry.content.itemContent.tweet_results.result;
            const t = extractTweet(result);
            if (t) ids.push(t.id);
          }
        }
        return;
      }
      for (const k in node) findInstructions(node[k], depth + 1);
    })(json && json.data, 0);
    return ids;
  }

  // ───────────────────────── 純関数: Markdown生成 ─────────────────────────

  function yamlQuote(s) {
    return '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ') + '"';
  }

  function datePart(iso) {
    return (iso || '').slice(0, 10) || 'unknown-date';
  }

  // ファイル名はツイート固有の値(投稿日+screen_name+ID)のみで決定的に作る。
  // → どの端末・経路から記録しても同名になり、リモートの422(file exists)が重複防止として機能する
  function buildFilename(record) {
    const name = /^[A-Za-z0-9_]{1,20}$/.test(record.screen_name) ? record.screen_name : 'unknown';
    return datePart(record.posted_at) + '_' + name + '_' + record.id + '.md';
  }

  function buildMarkdown(record) {
    const lines = [];
    lines.push('---');
    lines.push('id: ' + yamlQuote(record.id));
    lines.push('url: ' + record.url);
    lines.push('author: ' + yamlQuote('@' + (record.screen_name || 'unknown')));
    lines.push('author_name: ' + yamlQuote(record.author_name || ''));
    lines.push('posted_at: ' + (record.posted_at || 'unknown'));
    lines.push('bookmarked_at: ' + record.bookmarked_at);
    lines.push('source: ' + record.source);
    if (record.media && record.media.length) {
      lines.push('media:');
      for (const m of record.media) lines.push('  - ' + m);
    }
    lines.push('tags: [x-bookmark]');
    lines.push('---');
    lines.push('');
    lines.push(record.text || '(本文を取得できませんでした: ' + record.url + ' )');
    if (record.quote) {
      lines.push('');
      lines.push('> [!quote] 引用元 @' + (record.quote.screen_name || 'unknown') +
        (record.quote.author_name ? '（' + record.quote.author_name + '）' : ''));
      for (const ql of String(record.quote.text || '').split('\n')) lines.push('> ' + ql);
      if (record.quote.url) lines.push('> ' + record.quote.url);
    }
    if (record.media && record.media.length) {
      lines.push('');
      for (const m of record.media) {
        lines.push(/\.(jpg|jpeg|png|webp)/i.test(m) ? '![](' + m + ')' : m);
      }
    }
    lines.push('');
    return lines.join('\n');
  }

  // UTF-8文字列 → base64 (GitHub contents API用)
  function b64encodeUTF8(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  // ───────────────────────── ツイートキャッシュ ─────────────────────────

  const CACHE_MAX = 500;
  const tweetCache = new Map(); // id → record

  (function loadCache() {
    const arr = lsGet(LS.CACHE, []);
    if (Array.isArray(arr)) for (const t of arr) if (t && t.id) tweetCache.set(t.id, t);
  })();

  let cacheSaveTimer = null;
  function persistCacheSoon() {
    if (cacheSaveTimer) return;
    cacheSaveTimer = setTimeout(() => {
      cacheSaveTimer = null;
      lsSet(LS.CACHE, Array.from(tweetCache.values()).slice(-CACHE_MAX));
    }, 3000);
  }

  function cacheTweet(t) {
    if (!t || !t.id) return;
    tweetCache.delete(t.id);
    tweetCache.set(t.id, t);
    while (tweetCache.size > CACHE_MAX) {
      tweetCache.delete(tweetCache.keys().next().value);
    }
    persistCacheSoon();
  }

  // ───────────────────────── キュー & 記録済みインデックス ─────────────────────────

  function getQueue() { return lsGet(LS.QUEUE, []); }
  function setQueue(q) { lsSet(LS.QUEUE, q); updateBadge(); }

  function getLogged() { return lsGet(LS.LOGGED, []); }
  function isLogged(id) { return getLogged().indexOf(id) !== -1; }
  function markLogged(id) {
    const arr = getLogged();
    if (arr.indexOf(id) === -1) {
      arr.push(id);
      if (arr.length > 5000) arr.splice(0, arr.length - 5000);
      lsSet(LS.LOGGED, arr);
    }
  }

  const pendingStub = new Map(); // id → timer (キャッシュ未ヒット時の待機)

  function enqueueBookmark(tweetId, source) {
    if (!tweetId) return;
    if (isLogged(tweetId)) return;
    const queue = getQueue();
    if (queue.some((r) => r.id === tweetId)) return;

    const cached = tweetCache.get(tweetId);
    if (!cached) {
      // ブックマーク直後はツイート本体が別レスポンスで届いている途中の可能性があるので少し待つ
      if (!pendingStub.has(tweetId)) {
        pendingStub.set(tweetId, setTimeout(() => {
          pendingStub.delete(tweetId);
          enqueueRecord(tweetCache.get(tweetId) || stubRecord(tweetId), source);
        }, 8000));
      }
      return;
    }
    enqueueRecord(cached, source);
  }

  function stubRecord(tweetId) {
    return {
      id: tweetId,
      url: 'https://x.com/i/web/status/' + tweetId,
      screen_name: '',
      author_name: '',
      text: '',
      posted_at: null,
      media: [],
      quote: null,
    };
  }

  function enqueueRecord(tweet, source) {
    if (isLogged(tweet.id)) return;
    const queue = getQueue();
    if (queue.some((r) => r.id === tweet.id)) return;
    const record = Object.assign({}, tweet, {
      bookmarked_at: localISO(new Date()),
      source: source,
    });
    queue.push(record);
    setQueue(queue);
    log('queued', tweet.id, source);
    notifyQueue();
    flushQueue();
  }

  // コンパニオン(contentワールド)へキュー追加を通知(DOMイベントはワールド間で共有される)
  function notifyQueue() {
    try { document.dispatchEvent(new CustomEvent('xbm:queue')); } catch (e) { /* noop */ }
  }

  // ───────────────────────── GitHub コミット層 ─────────────────────────

  function gmFetch(method, url, headers, body) {
    return new Promise((resolve, reject) => {
      gmRequest({
        method: method,
        url: url,
        headers: headers,
        data: body,
        timeout: 30000,
        onload: (res) => resolve({ status: res.status, text: res.responseText }),
        onerror: () => reject(new Error('network error')),
        ontimeout: () => reject(new Error('timeout')),
      });
    });
  }

  function githubHeaders(token) {
    return {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
  }

  function putFile(config, path, content, message) {
    const url = 'https://api.github.com/repos/' + encodeURIComponent(config.owner) + '/' +
      encodeURIComponent(config.repo) + '/contents/' +
      path.split('/').map(encodeURIComponent).join('/');
    return gmFetch('PUT', url, githubHeaders(config.token), JSON.stringify({
      message: message,
      content: b64encodeUTF8(content),
      branch: config.branch || 'main',
    }));
  }

  // 多重フラッシュ防止ロック(タブ間・メイン/コンパニオン間で共有)
  function acquireLock() {
    const now = Date.now();
    const lock = lsGet(LS.LOCK, 0);
    if (lock && now - lock < 25000) return false;
    lsSet(LS.LOCK, now);
    return true;
  }
  function refreshLock() { lsSet(LS.LOCK, Date.now()); }
  function releaseLock() { lsSet(LS.LOCK, 0); }

  function setStatus(state, msg) {
    lsSet(LS.STATUS, { state: state, msg: msg || '', ts: Date.now(), queued: getQueue().length });
    updateBadge();
  }

  let flushing = false;

  async function flushQueue() {
    if (!gmRequest) return; // iOS等: コンパニオンが送信を担当
    if (flushing) return;
    const config = getConfig();
    if (!configValid(config)) {
      if (getQueue().length) setStatus('idle', '設定が未完了です（⚙ボタンから設定）');
      return;
    }
    if (!navigator.onLine) return;
    if (!getQueue().length) return;
    if (!acquireLock()) return;

    flushing = true;
    try {
      let backoff = 2000;
      while (true) {
        const queue = getQueue();
        if (!queue.length) { setStatus('ok', '送信完了'); break; }
        const record = queue[0];
        refreshLock();
        const folder = (config.folder || '').replace(/^\/+|\/+$/g, '');
        const path = (folder ? folder + '/' : '') + buildFilename(record);
        let res;
        try {
          res = await putFile(config, path, buildMarkdown(record), 'x-bookmark: @' + (record.screen_name || 'unknown') + ' ' + record.id);
        } catch (e) {
          setStatus('error', '通信エラー: 後で再送します');
          break; // キューに残す
        }
        if (res.status === 201 || res.status === 200) {
          markLogged(record.id);
          setQueue(getQueue().filter((r) => r.id !== record.id));
          setStatus('ok', '保存: ' + path);
          backoff = 2000;
        } else if (res.status === 422) {
          // 同名ファイルが既に存在 = 記録済み(正常系)
          markLogged(record.id);
          setQueue(getQueue().filter((r) => r.id !== record.id));
          setStatus('ok', '既に記録済み: ' + record.id);
        } else if (res.status === 401 || res.status === 403) {
          setStatus('error', '認証エラー(' + res.status + '): PATを確認してください');
          break;
        } else if (res.status === 404) {
          setStatus('error', 'リポジトリが見つかりません(404): owner/repo/PAT権限を確認');
          break;
        } else if (res.status === 409 && backoff <= 8000) {
          await sleep(backoff);
          backoff *= 2;
        } else {
          setStatus('error', 'GitHub APIエラー(' + res.status + '): 後で再送します');
          break;
        }
        await sleep(1100); // 直列コミット間隔(並列PUTの409回避)
      }
    } finally {
      flushing = false;
      releaseLock();
      updateBadge();
    }
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  async function testConnection(config) {
    if (!gmRequest) return { ok: false, msg: 'この環境からは送信不可(iOSはアップローダー側が送信します)' };
    try {
      const url = 'https://api.github.com/repos/' + encodeURIComponent(config.owner) + '/' + encodeURIComponent(config.repo);
      const res = await gmFetch('GET', url, githubHeaders(config.token));
      if (res.status === 200) {
        const json = JSON.parse(res.text);
        if (json.permissions && json.permissions.push === false) {
          return { ok: false, msg: '接続OKですが書き込み権限がありません(PATのContents権限を確認)' };
        }
        return { ok: true, msg: '接続OK: ' + json.full_name };
      }
      if (res.status === 401) return { ok: false, msg: 'PATが無効です(401)' };
      return { ok: false, msg: 'エラー(' + res.status + '): owner/repo/PATを確認' };
    } catch (e) {
      return { ok: false, msg: '通信エラー: ' + e.message };
    }
  }

  // ───────────────────────── 傍受層 ─────────────────────────

  function opName(url) {
    const m = GRAPHQL_RE.exec(url || '');
    return m ? m[1] : null;
  }

  function tweetIdFromBody(body) {
    try {
      const json = JSON.parse(body);
      return (json && json.variables && json.variables.tweet_id) || null;
    } catch (e) { return null; }
  }

  function route(meta, responseText) {
    const op = opName(meta.url);
    if (!op || !responseText) return;
    let json;
    try { json = JSON.parse(responseText); } catch (e) { return; }

    // 全GraphQLレスポンスからツイートを収集してキャッシュ(本文・作者の補完用)
    const tweets = collectTweets(json);
    for (const t of tweets) cacheTweet(t);

    if (op === 'CreateBookmark') {
      const tid = tweetIdFromBody(meta.body);
      if (tid) {
        log('CreateBookmark detected', tid);
        enqueueBookmark(tid, 'realtime');
      }
    } else if (op === 'Bookmarks' || /^Bookmark.*Timeline$/.test(op)) {
      const ids = bookmarkEntryIds(json);
      log('Bookmarks timeline:', ids.length, 'entries');
      for (const id of ids) enqueueBookmark(id, 'bookmarks-sync');
    }
  }

  function installInterceptor() {
    const XHR = W.XMLHttpRequest;
    if (!XHR || !XHR.prototype) return;
    const origOpen = XHR.prototype.open;
    const origSend = XHR.prototype.send;

    XHR.prototype.open = function (method, url) {
      try { this.__xbm = { method: method, url: String(url) }; } catch (e) { /* noop */ }
      return origOpen.apply(this, arguments);
    };
    XHR.prototype.send = function (body) {
      try {
        const meta = this.__xbm;
        if (meta && GRAPHQL_RE.test(meta.url)) {
          if (typeof body === 'string') meta.body = body;
          this.addEventListener('load', () => {
            try { route(meta, this.responseText); } catch (e) { log('route error', e); }
          });
        }
      } catch (e) { /* noop */ }
      return origSend.apply(this, arguments);
    };

    // 保険: fetch経由のGraphQLも捕捉
    const origFetch = W.fetch;
    if (typeof origFetch === 'function') {
      W.fetch = function (input, init) {
        const url = (typeof input === 'string') ? input : (input && input.url) || '';
        const p = origFetch.apply(this, arguments);
        try {
          if (GRAPHQL_RE.test(url)) {
            const body = init && typeof init.body === 'string' ? init.body : undefined;
            p.then((res) => {
              try {
                res.clone().text().then((t) => {
                  try { route({ url: url, body: body }, t); } catch (e) { log('route error', e); }
                });
              } catch (e) { /* noop */ }
            }).catch(() => { /* noop */ });
          }
        } catch (e) { /* noop */ }
        return p;
      };
    }
    log('interceptor installed (gm:', !!gmRequest, ')');
  }

  // ───────────────────────── UI(フローティングボタン+設定パネル) ─────────────────────────

  let badgeEl = null;
  let panelEl = null;

  const UI_CSS = [
    '#xbm-fab{position:fixed;left:14px;bottom:18px;z-index:99999;width:42px;height:42px;border-radius:50%;',
    'background:#15202b;color:#8b98a5;border:1.5px solid #38444d;font-size:18px;line-height:40px;text-align:center;',
    'cursor:pointer;user-select:none;box-shadow:0 2px 10px rgba(0,0,0,.45);font-family:sans-serif;}',
    '#xbm-fab.xbm-ok{color:#00ba7c;border-color:#00ba7c;}',
    '#xbm-fab.xbm-busy{color:#ffad1f;border-color:#ffad1f;}',
    '#xbm-fab.xbm-err{color:#f4212e;border-color:#f4212e;}',
    '#xbm-fab .xbm-count{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;border-radius:9px;',
    'background:#ffad1f;color:#15202b;font-size:11px;font-weight:700;line-height:18px;padding:0 4px;display:none;}',
    '#xbm-panel{position:fixed;left:14px;bottom:70px;z-index:99999;width:300px;max-width:calc(100vw - 28px);',
    'background:#15202b;color:#e7e9ea;border:1px solid #38444d;border-radius:14px;padding:14px;',
    'font-family:sans-serif;font-size:13px;box-shadow:0 4px 24px rgba(0,0,0,.6);display:none;}',
    '#xbm-panel h3{margin:0 0 10px;font-size:14px;color:#e7e9ea;}',
    '#xbm-panel label{display:block;margin:7px 0 2px;color:#8b98a5;font-size:11px;}',
    '#xbm-panel input{width:100%;box-sizing:border-box;background:#273340;border:1px solid #38444d;',
    'border-radius:6px;color:#e7e9ea;padding:6px 8px;font-size:13px;}',
    '#xbm-panel .xbm-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;}',
    '#xbm-panel button{flex:1;background:#1d9bf0;color:#fff;border:none;border-radius:8px;padding:7px 6px;',
    'font-size:12px;cursor:pointer;white-space:nowrap;}',
    '#xbm-panel button.xbm-sub{background:#273340;color:#8b98a5;}',
    '#xbm-panel .xbm-status{margin-top:10px;font-size:11px;color:#8b98a5;word-break:break-all;min-height:14px;}',
    '#xbm-panel .xbm-toggle{display:flex;align-items:center;gap:6px;margin-top:10px;color:#8b98a5;font-size:12px;}',
    '#xbm-panel .xbm-toggle input{width:auto;}',
  ].join('');

  function buildUI() {
    if (!document.body || document.getElementById('xbm-fab')) return;

    const style = document.createElement('style');
    style.textContent = UI_CSS;
    document.head.appendChild(style);

    badgeEl = document.createElement('div');
    badgeEl.id = 'xbm-fab';
    badgeEl.title = 'X Bookmark Logger 設定';
    badgeEl.innerHTML = '&#128278;<span class="xbm-count"></span>';
    badgeEl.addEventListener('click', togglePanel);
    document.body.appendChild(badgeEl);

    panelEl = document.createElement('div');
    panelEl.id = 'xbm-panel';
    panelEl.innerHTML = [
      '<h3>&#128278; X Bookmark Logger</h3>',
      '<label>GitHub オーナー名 (owner)</label><input id="xbm-owner" autocomplete="off" placeholder="yourname">',
      '<label>リポジトリ名 (Obsidian Vault)</label><input id="xbm-repo" autocomplete="off" placeholder="my-vault">',
      '<label>ブランチ</label><input id="xbm-branch" autocomplete="off" placeholder="main">',
      '<label>保存先フォルダ</label><input id="xbm-folder" autocomplete="off" placeholder="X Bookmarks">',
      '<label>Fine-grained PAT (Contents: Read and write)</label><input id="xbm-token" type="password" autocomplete="off" placeholder="github_pat_...">',
      '<div class="xbm-toggle"><input type="checkbox" id="xbm-enabled"><label for="xbm-enabled" style="display:inline;margin:0;">記録を有効にする</label></div>',
      '<div class="xbm-row"><button id="xbm-save">保存</button><button id="xbm-test" class="xbm-sub">接続テスト</button></div>',
      '<div class="xbm-row"><button id="xbm-flush" class="xbm-sub">今すぐ送信</button><button id="xbm-clearidx" class="xbm-sub">記録済み索引クリア</button></div>',
      '<div class="xbm-status" id="xbm-statusline"></div>',
    ].join('');
    document.body.appendChild(panelEl);

    panelEl.querySelector('#xbm-save').addEventListener('click', () => {
      const c = readPanelConfig();
      lsSet(LS.CONFIG, c);
      setPanelStatus(configValid(c) ? '保存しました' : '保存しました（未入力の項目があります）');
      flushQueue();
    });
    panelEl.querySelector('#xbm-test').addEventListener('click', async () => {
      setPanelStatus('接続テスト中…');
      const r = await testConnection(readPanelConfig());
      setPanelStatus((r.ok ? '✅ ' : '❌ ') + r.msg);
    });
    panelEl.querySelector('#xbm-flush').addEventListener('click', () => {
      setPanelStatus('送信中… (' + getQueue().length + '件)');
      notifyQueue();
      flushQueue();
    });
    panelEl.querySelector('#xbm-clearidx').addEventListener('click', () => {
      lsSet(LS.LOGGED, []);
      setPanelStatus('記録済みインデックスをクリアしました（重複はGitHub側の同名ファイル検知で防止されます）');
    });

    updateBadge();
    setInterval(updateBadge, 2500);
  }

  function readPanelConfig() {
    return {
      owner: panelEl.querySelector('#xbm-owner').value.trim(),
      repo: panelEl.querySelector('#xbm-repo').value.trim(),
      branch: panelEl.querySelector('#xbm-branch').value.trim() || 'main',
      folder: panelEl.querySelector('#xbm-folder').value.trim(),
      token: panelEl.querySelector('#xbm-token').value.trim(),
      enabled: panelEl.querySelector('#xbm-enabled').checked,
    };
  }

  function togglePanel() {
    if (!panelEl) return;
    const visible = panelEl.style.display === 'block';
    if (!visible) {
      const c = getConfig();
      panelEl.querySelector('#xbm-owner').value = c.owner;
      panelEl.querySelector('#xbm-repo').value = c.repo;
      panelEl.querySelector('#xbm-branch').value = c.branch;
      panelEl.querySelector('#xbm-folder').value = c.folder;
      panelEl.querySelector('#xbm-token').value = c.token;
      panelEl.querySelector('#xbm-enabled').checked = !!c.enabled;
      refreshPanelStatus();
    }
    panelEl.style.display = visible ? 'none' : 'block';
  }

  function setPanelStatus(msg) {
    const el = panelEl && panelEl.querySelector('#xbm-statusline');
    if (el) el.textContent = msg;
  }

  function refreshPanelStatus() {
    const st = lsGet(LS.STATUS, null);
    const q = getQueue().length;
    let msg = '未送信: ' + q + '件';
    if (st && st.msg) msg += ' / ' + st.msg;
    if (!gmRequest) msg += ' / この環境(iOS等)ではアップローダーが送信します';
    setPanelStatus(msg);
  }

  function updateBadge() {
    if (!badgeEl) return;
    const q = getQueue().length;
    const st = lsGet(LS.STATUS, null);
    const c = getConfig();
    const count = badgeEl.querySelector('.xbm-count');
    count.style.display = q > 0 ? 'block' : 'none';
    count.textContent = q;
    badgeEl.className = '';
    if (!configValid(c)) badgeEl.className = '';
    else if (st && st.state === 'error') badgeEl.className = 'xbm-err';
    else if (q > 0) badgeEl.className = 'xbm-busy';
    else badgeEl.className = 'xbm-ok';
    if (panelEl && panelEl.style.display === 'block') refreshPanelStatus();
  }

  // ───────────────────────── 起動 ─────────────────────────

  function log() {
    try { console.debug.apply(console, ['[XBM]'].concat(Array.prototype.slice.call(arguments))); } catch (e) { /* noop */ }
  }

  installInterceptor();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }

  window.addEventListener('online', flushQueue);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flushQueue();
  });
  setInterval(flushQueue, 60000);
  setTimeout(flushQueue, 5000); // 起動直後に未送信分を再送

  // デバッグ用フック: コンソールからフィクスチャJSONを食わせて検証できる
  W.__XBM_DEBUG = {
    extractTweet: extractTweet,
    collectTweets: collectTweets,
    bookmarkEntryIds: bookmarkEntryIds,
    buildMarkdown: buildMarkdown,
    buildFilename: buildFilename,
    b64encodeUTF8: b64encodeUTF8,
    route: route,
    flushQueue: flushQueue,
    state: () => ({
      config: Object.assign({}, getConfig(), { token: '(hidden)' }),
      queue: getQueue(),
      logged: getLogged(),
      cacheSize: tweetCache.size,
      gm: !!gmRequest,
    }),
  };
})();
