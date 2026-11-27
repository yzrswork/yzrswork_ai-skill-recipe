// ==UserScript==
// @name         X Bookmark Logger – Uploader (iOS companion)
// @name:ja      X ブックマークロガー – アップローダー (iOS用)
// @namespace    https://yzrswork.github.io/yzrswork_ai-skill-recipe/
// @version      1.1.0
// @description  Companion uploader for X Bookmark Logger. Required on iOS Userscripts app, where GM APIs are unavailable in the page world.
// @description:ja X Bookmark Logger のコンパニオン。iOSのUserscriptsアプリではpageワールドでGM APIが使えないため、こちらがGitHubへの送信を担当します。
// @author       yzrswork
// @match        https://x.com/*
// @match        https://twitter.com/*
// @match        https://mobile.twitter.com/*
// @run-at       document-idle
// @inject-into  content
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @connect      api.github.com
// @noframes
// @homepageURL  https://yzrswork.github.io/yzrswork_ai-skill-recipe/x-bookmark-logger.html
// @downloadURL  https://yzrswork.github.io/yzrswork_ai-skill-recipe/x-bookmark-uploader.user.js
// @updateURL    https://yzrswork.github.io/yzrswork_ai-skill-recipe/x-bookmark-uploader.user.js
// ==/UserScript==

/*
 * 本体(x-bookmark-logger.user.js)が localStorage に積んだキューを監視し、
 * GitHub contents API へ直列コミットする。本体側でGM送信が可能な環境
 * (PCのTampermonkey/Violentmonkey等)では何もしない。
 * 送信前に保存先フォルダ(archive/ などを含む)の投稿IDを GitHub trees API で集め、
 * 同じIDが既にあれば保存しない(本体と同じ照合)。
 */

(function () {
  'use strict';

  const gmRequest =
    (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest :
    (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') ? GM.xmlHttpRequest :
    null;
  if (!gmRequest) return; // この環境では何もできない

  const LS = { CONFIG: 'xbm.config', QUEUE: 'xbm.queue', LOGGED: 'xbm.logged', STATUS: 'xbm.status', LOCK: 'xbm.lock', CAP: 'xbm.cap_gm' };

  function lsGet(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch (e) { return fallback; }
  }
  function lsSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* noop */ } }

  function mainHandlesUpload() { return lsGet(LS.CAP, '0') === '1'; }

  function getConfig() { return Object.assign({ branch: 'main', folder: '', enabled: true }, lsGet(LS.CONFIG, {})); }
  function configValid(c) { return !!(c.owner && c.repo && c.token && c.enabled); }
  function getQueue() { return lsGet(LS.QUEUE, []); }
  function setQueue(q) { lsSet(LS.QUEUE, q); }
  function markLogged(id) {
    const arr = lsGet(LS.LOGGED, []);
    if (arr.indexOf(id) === -1) { arr.push(id); if (arr.length > 5000) arr.splice(0, arr.length - 5000); lsSet(LS.LOGGED, arr); }
  }
  function setStatus(state, msg) { lsSet(LS.STATUS, { state: state, msg: msg || '', ts: Date.now(), queued: getQueue().length }); }

  // ── 本体と同一ロジックのMarkdown生成(キューのレコードから決定的に生成) ──

  function yamlQuote(s) {
    return '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ') + '"';
  }
  function datePart(iso) { return (iso || '').slice(0, 10) || 'unknown-date'; }
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
  function b64encodeUTF8(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    return btoa(bin);
  }

  // ── GitHubクライアント ──

  function gmFetch(method, url, headers, body) {
    return new Promise((resolve, reject) => {
      gmRequest({
        method: method, url: url, headers: headers, data: body, timeout: 30000,
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
  function repoApiBase(config) {
    return 'https://api.github.com/repos/' + encodeURIComponent(config.owner) + '/' + encodeURIComponent(config.repo);
  }
  function normFolder(folder) { return String(folder || '').replace(/^\/+|\/+$/g, ''); }
  function putFile(config, path, content, message) {
    const url = repoApiBase(config) + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
    return gmFetch('PUT', url, githubHeaders(config.token),
      JSON.stringify({ message: message, content: b64encodeUTF8(content), branch: config.branch || 'main' }));
  }

  // 保存済み投稿IDの照合(本体と同一ロジック)。
  // 保存済みファイル名の末尾「_<投稿ID>.md」から投稿IDを取り出す。末尾がIDでないファイルは null。
  function idFromPath(path) {
    const m = /_(\d+)\.md$/.exec(String(path || ''));
    return m ? m[1] : null;
  }
  function savedIdsFromTree(entries) {
    const ids = new Set();
    for (const e of entries || []) {
      if (!e || e.type !== 'blob') continue;
      const id = idFromPath(e.path);
      if (id) ids.add(id);
    }
    return ids;
  }
  function parseJSON(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }
  // 保存先フォルダ(サブフォルダを含む)の投稿IDを trees API で集める。
  // 戻り値: { ok: true, ids: Set } / { ok: false, status, truncated }。通信エラーは reject。
  async function fetchSavedIds(config) {
    const base = repoApiBase(config) + '/git/trees/';
    const headers = githubHeaders(config.token);
    let ref = encodeURIComponent(config.branch || 'main');
    for (const seg of normFolder(config.folder).split('/').filter(Boolean)) {
      const res = await gmFetch('GET', base + ref, headers);
      const json = res.status === 200 ? parseJSON(res.text) : null;
      if (!json || !Array.isArray(json.tree)) return { ok: false, status: res.status };
      const dir = json.tree.find((e) => e && e.type === 'tree' && e.path === seg);
      if (!dir) {
        return json.truncated ? { ok: false, status: res.status, truncated: true } : { ok: true, ids: new Set() };
      }
      ref = encodeURIComponent(dir.sha);
    }
    const res = await gmFetch('GET', base + ref + '?recursive=1', headers);
    const json = res.status === 200 ? parseJSON(res.text) : null;
    if (!json || !Array.isArray(json.tree)) return { ok: false, status: res.status };
    if (json.truncated) return { ok: false, status: res.status, truncated: true };
    return { ok: true, ids: savedIdsFromTree(json.tree) };
  }
  function savedIdsErrorMessage(r) {
    if (r.truncated) return '保存済みの一覧が大きすぎて取得しきれません(trees APIの上限)';
    if (r.status === 401 || r.status === 403) return '認証エラー(' + r.status + '): PATを確認してください';
    if (r.status === 404) return 'リポジトリかブランチが見つかりません(404): owner/repo/branch/PAT権限を確認';
    return '保存済みの一覧を取得できません(' + r.status + '): 後で再送します';
  }

  function acquireLock() {
    const now = Date.now();
    const lock = lsGet(LS.LOCK, 0);
    if (lock && now - lock < 25000) return false;
    lsSet(LS.LOCK, now);
    return true;
  }
  function refreshLock() { lsSet(LS.LOCK, Date.now()); }
  function releaseLock() { lsSet(LS.LOCK, 0); }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  let flushing = false;

  async function flushQueue() {
    if (mainHandlesUpload()) return; // PC環境: 本体が送信する
    if (flushing) return;
    const config = getConfig();
    if (!configValid(config)) return;
    if (!navigator.onLine) return;
    if (!getQueue().length) return;
    if (!acquireLock()) return;

    flushing = true;
    try {
      // 送る前に保存先の投稿IDを集める。取れなければ重複を防げないので送らない(キューに残す)
      let saved;
      try {
        saved = await fetchSavedIds(config);
      } catch (e) {
        setStatus('error', '通信エラー: 後で再送します');
        return;
      }
      if (!saved.ok) {
        setStatus('error', savedIdsErrorMessage(saved));
        return;
      }
      const savedIds = saved.ids;
      const folder = normFolder(config.folder);
      let backoff = 2000;
      while (true) {
        const queue = getQueue();
        if (!queue.length) { setStatus('ok', '送信完了'); break; }
        const record = queue[0];
        refreshLock();
        if (savedIds.has(String(record.id))) {
          markLogged(record.id);
          setQueue(getQueue().filter((r) => r.id !== record.id));
          setStatus('ok', '既に記録済み: ' + record.id);
          continue;
        }
        const path = (folder ? folder + '/' : '') + buildFilename(record);
        let res;
        try {
          res = await putFile(config, path, buildMarkdown(record), 'x-bookmark: @' + (record.screen_name || 'unknown') + ' ' + record.id);
        } catch (e) {
          setStatus('error', '通信エラー: 後で再送します');
          break;
        }
        if (res.status === 201 || res.status === 200) {
          markLogged(record.id);
          setQueue(getQueue().filter((r) => r.id !== record.id));
          setStatus('ok', '保存: ' + path);
          backoff = 2000;
        } else if (res.status === 422) {
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
        await sleep(1100);
      }
    } finally {
      flushing = false;
      releaseLock();
    }
  }

  document.addEventListener('xbm:queue', flushQueue);
  window.addEventListener('online', flushQueue);
  setInterval(flushQueue, 15000);
  setTimeout(flushQueue, 4000);
})();
