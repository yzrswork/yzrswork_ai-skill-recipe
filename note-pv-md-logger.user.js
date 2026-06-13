// ==UserScript==
// @name         note PV Markdown Logger
// @name:ja      note ページビュー取得 (Markdown)
// @namespace    https://yzrswork.github.io/yzrswork_ai-skill-recipe/
// @version      1.0.0
// @description  Extract per-article pageview stats from your note.com dashboard API and export a single Markdown snapshot for Obsidian.
// @description:ja noteのダッシュボードAPIから記事ごとのビュー・スキ・コメント数を全件取得し、Obsidian向けに1スナップショット=1ファイルのMarkdownとしてダウンロードします。
// @author       yzrswork
// @match        https://note.com/*
// @run-at       document-idle
// @inject-into  content
// @grant        none
// @noframes
// @homepageURL  https://yzrswork.github.io/yzrswork_ai-skill-recipe/
// @downloadURL  https://yzrswork.github.io/yzrswork_ai-skill-recipe/note-pv-md-logger.user.js
// @updateURL    https://yzrswork.github.io/yzrswork_ai-skill-recipe/note-pv-md-logger.user.js
// ==/UserScript==

/*
 * noteにログインした状態で任意のnote.comページを開くと右下に「📝 PV→MD」ボタンが出る。
 * 押すとパネルが開き、「取得」でダッシュボード非公式API
 *   https://note.com/api/v1/stats/pv?filter=<all|weekly|monthly>&page=N&sort=pv
 * を last_page まで順に叩いて全記事のビュー数を集める。
 * 結果は「.mdダウンロード」で 1スナップショット=1ファイル のMarkdownとして保存でき、
 * そのままObsidian vaultフォルダに置けばDataview等で集計できる。
 * 認証はブラウザのログインセッション(クッキー)をそのまま使うのでトークン設定は不要。
 *
 * CSV/TSV出力が欲しい場合は note-pv-logger.user.js を使う。
 */

(function () {
  'use strict';

  const API_BASE = 'https://note.com/api/v1/stats/pv';
  const PAGE_WAIT_MS = 400;   // 連続アクセスを避けるためのページ間ウェイト
  const MAX_PAGES = 300;      // 暴走防止の上限(12件/ページ × 300 = 3600記事)

  const FILTERS = [
    { value: 'all', label: '全期間' },
    { value: 'monthly', label: '月間' },
    { value: 'weekly', label: '週間' },
  ];
  function filterLabel(value) {
    const f = FILTERS.find((x) => x.value === value);
    return f ? f.label : value;
  }

  let lastResult = null; // { fetchedAt, fetchedAtFile, filter, rows: [...] }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function tsLocal(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function dateLocal(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function tsFile(d) {
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes());
  }

  // ── API取得 ──

  async function fetchPage(filter, page) {
    const url = API_BASE + '?filter=' + encodeURIComponent(filter) + '&page=' + page + '&sort=pv';
    const res = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
    if (res.status === 401 || res.status === 403) throw new Error('認証エラー: noteにログインしてください');
    if (!res.ok) throw new Error('APIエラー (HTTP ' + res.status + ')');
    return res.json();
  }

  function toRow(item) {
    const user = item.user || {};
    const key = item.key || '';
    const urlname = user.urlname || '';
    return {
      id: item.id != null ? String(item.id) : '',
      title: item.name || item.title || '(無題)',
      url: (urlname && key) ? 'https://note.com/' + urlname + '/n/' + key : '',
      pv: Number(item.read_count != null ? item.read_count : (item.pv != null ? item.pv : 0)),
      like: Number(item.like_count || 0),
      comment: Number(item.comment_count || 0),
    };
  }

  async function fetchAll(filter, onProgress) {
    const now = new Date();
    const rows = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      onProgress('取得中… ' + page + 'ページ目 (' + rows.length + '記事)');
      const json = await fetchPage(filter, page);
      const data = json && json.data ? json.data : {};
      const stats = Array.isArray(data.note_stats) ? data.note_stats : [];
      for (const item of stats) rows.push(toRow(item));
      // last_page === false のときだけ続行。true/欠落、または空ページなら終了
      if (data.last_page !== false || stats.length === 0) break;
      await sleep(PAGE_WAIT_MS);
    }
    return { fetchedAt: tsLocal(now), date: dateLocal(now), fetchedAtFile: tsFile(now), filter: filter, rows: rows };
  }

  // ── Markdown出力 ──

  function yamlQuote(s) {
    return '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ') + '"';
  }
  // Markdownの表セル内で安全になるようパイプ・改行をエスケープ
  function mdCell(s) {
    return String(s == null ? '' : s).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
  }
  // リンクテキスト内の角括弧を全角に逃がして表示崩れを防ぐ
  function mdLinkText(s) {
    return mdCell(s).replace(/\[/g, '［').replace(/\]/g, '］');
  }

  function buildMarkdown(result) {
    const totalPV = result.rows.reduce((a, r) => a + r.pv, 0);
    const totalLike = result.rows.reduce((a, r) => a + r.like, 0);
    const totalComment = result.rows.reduce((a, r) => a + r.comment, 0);

    const lines = [];
    lines.push('---');
    lines.push('type: note-pv-snapshot');
    lines.push('fetched_at: ' + yamlQuote(result.fetchedAt));
    lines.push('date: ' + result.date);
    lines.push('filter: ' + result.filter);
    lines.push('filter_label: ' + yamlQuote(filterLabel(result.filter)));
    lines.push('articles: ' + result.rows.length);
    lines.push('total_pv: ' + totalPV);
    lines.push('total_like: ' + totalLike);
    lines.push('total_comment: ' + totalComment);
    lines.push('tags: [note, pv, stats]');
    lines.push('---');
    lines.push('');
    lines.push('# note PV スナップショット (' + result.fetchedAt + ' / ' + filterLabel(result.filter) + ')');
    lines.push('');
    lines.push('- 記事数: ' + result.rows.length);
    lines.push('- 合計ビュー: ' + totalPV.toLocaleString());
    lines.push('- 合計スキ: ' + totalLike.toLocaleString());
    lines.push('- 合計コメント: ' + totalComment.toLocaleString());
    lines.push('');
    lines.push('| タイトル | ビュー | スキ | コメント |');
    lines.push('| --- | ---: | ---: | ---: |');
    for (const r of result.rows) {
      const title = r.url ? '[' + mdLinkText(r.title) + '](' + r.url + ')' : mdCell(r.title);
      lines.push('| ' + title + ' | ' + r.pv + ' | ' + r.like + ' | ' + r.comment + ' |');
    }
    lines.push('');
    return lines.join('\n');
  }

  function downloadMarkdown(result) {
    const blob = new Blob([buildMarkdown(result)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'note-pv_' + result.filter + '_' + result.fetchedAtFile + '.md';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
  }

  async function copyMarkdown(result) {
    const text = buildMarkdown(result);
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  // ── UI ──

  const CSS = [
    '#npvm-fab{position:fixed;right:16px;bottom:16px;z-index:99999;background:#2d8c7f;color:#fff;border:none;border-radius:24px;padding:10px 16px;font-size:14px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer;}',
    '#npvm-panel{position:fixed;right:16px;bottom:64px;z-index:99999;width:min(420px,calc(100vw - 32px));max-height:70vh;background:#fff;color:#222;border:1px solid #ccc;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.3);display:none;flex-direction:column;font-size:13px;font-family:sans-serif;}',
    '#npvm-panel.open{display:flex;}',
    '#npvm-panel header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #eee;flex-wrap:wrap;}',
    '#npvm-panel header strong{margin-right:auto;}',
    '#npvm-panel select,#npvm-panel button.npvm-btn{font-size:13px;padding:5px 10px;border-radius:6px;border:1px solid #bbb;background:#f7f7f7;cursor:pointer;}',
    '#npvm-panel button.npvm-btn.primary{background:#2d8c7f;border-color:#2d8c7f;color:#fff;font-weight:bold;}',
    '#npvm-panel button.npvm-btn:disabled{opacity:.5;cursor:default;}',
    '#npvm-status{padding:6px 12px;color:#555;border-bottom:1px solid #eee;min-height:1.4em;}',
    '#npvm-body{overflow:auto;padding:0 0 8px;}',
    '#npvm-body table{width:100%;border-collapse:collapse;}',
    '#npvm-body th,#npvm-body td{padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:left;white-space:nowrap;}',
    '#npvm-body td.title{max-width:200px;overflow:hidden;text-overflow:ellipsis;}',
    '#npvm-body td.num,#npvm-body th.num{text-align:right;}',
  ].join('\n');

  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    return node;
  }

  function buildUI() {
    if (document.getElementById('npvm-fab')) return;

    const style = el('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const fab = el('button', { id: 'npvm-fab', type: 'button' }, '📝 PV→MD');
    const panel = el('div', { id: 'npvm-panel' });

    const header = el('header');
    header.appendChild(el('strong', null, 'note PV → Markdown'));
    const select = el('select');
    for (const f of FILTERS) select.appendChild(el('option', { value: f.value }, f.label));
    const btnFetch = el('button', { class: 'npvm-btn primary', type: 'button' }, '取得');
    const btnMD = el('button', { class: 'npvm-btn', type: 'button', disabled: '' }, '.md保存');
    const btnCopy = el('button', { class: 'npvm-btn', type: 'button', disabled: '' }, 'MDコピー');
    header.appendChild(select);
    header.appendChild(btnFetch);
    header.appendChild(btnMD);
    header.appendChild(btnCopy);

    const status = el('div', { id: 'npvm-status' }, 'ログイン済みのnoteで「取得」を押してください');
    const body = el('div', { id: 'npvm-body' });

    panel.appendChild(header);
    panel.appendChild(status);
    panel.appendChild(body);
    document.body.appendChild(panel);
    document.body.appendChild(fab);

    fab.addEventListener('click', () => panel.classList.toggle('open'));

    function setStatus(msg) { status.textContent = msg; }

    function renderTable(result) {
      body.textContent = '';
      const table = el('table');
      const thead = el('thead');
      const trh = el('tr');
      trh.appendChild(el('th', null, 'タイトル'));
      trh.appendChild(el('th', { class: 'num' }, 'ビュー'));
      trh.appendChild(el('th', { class: 'num' }, 'スキ'));
      trh.appendChild(el('th', { class: 'num' }, 'コメント'));
      thead.appendChild(trh);
      table.appendChild(thead);
      const tbody = el('tbody');
      for (const r of result.rows) {
        const tr = el('tr');
        tr.appendChild(el('td', { class: 'title', title: r.title }, r.title));
        tr.appendChild(el('td', { class: 'num' }, r.pv.toLocaleString()));
        tr.appendChild(el('td', { class: 'num' }, r.like.toLocaleString()));
        tr.appendChild(el('td', { class: 'num' }, r.comment.toLocaleString()));
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      body.appendChild(table);
    }

    btnFetch.addEventListener('click', async () => {
      btnFetch.disabled = true;
      btnMD.disabled = true;
      btnCopy.disabled = true;
      try {
        const result = await fetchAll(select.value, setStatus);
        lastResult = result;
        const totalPV = result.rows.reduce((a, r) => a + r.pv, 0);
        const totalLike = result.rows.reduce((a, r) => a + r.like, 0);
        setStatus('取得完了: ' + result.rows.length + '記事 / 合計ビュー ' + totalPV.toLocaleString() +
          ' / 合計スキ ' + totalLike.toLocaleString() + ' (' + result.fetchedAt + ')');
        renderTable(result);
        btnMD.disabled = false;
        btnCopy.disabled = false;
      } catch (e) {
        setStatus('エラー: ' + (e && e.message ? e.message : e));
      } finally {
        btnFetch.disabled = false;
      }
    });

    btnMD.addEventListener('click', () => { if (lastResult) downloadMarkdown(lastResult); });
    btnCopy.addEventListener('click', async () => {
      if (!lastResult) return;
      const ok = await copyMarkdown(lastResult);
      setStatus(ok ? 'Markdownをコピーしました（Obsidianに貼り付けできます）' : 'コピーに失敗しました');
    });
  }

  buildUI();
})();
