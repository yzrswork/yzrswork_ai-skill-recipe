// ==UserScript==
// @name         note PV Logger
// @name:ja      note ページビュー取得
// @namespace    https://yzrswork.github.io/yzrswork_ai-skill-recipe/
// @version      1.0.0
// @description  Extract per-article pageview stats from your note.com dashboard API and export as CSV/TSV.
// @description:ja noteのダッシュボードAPIから記事ごとのビュー・スキ・コメント数を全件取得し、CSVダウンロード/TSVコピーできるようにします。
// @author       yzrswork
// @match        https://note.com/*
// @run-at       document-idle
// @inject-into  content
// @grant        none
// @noframes
// @homepageURL  https://yzrswork.github.io/yzrswork_ai-skill-recipe/
// @downloadURL  https://yzrswork.github.io/yzrswork_ai-skill-recipe/note-pv-logger.user.js
// @updateURL    https://yzrswork.github.io/yzrswork_ai-skill-recipe/note-pv-logger.user.js
// ==/UserScript==

/*
 * noteにログインした状態で任意のnote.comページを開くと右下に「📊 PV」ボタンが出る。
 * 押すとパネルが開き、「取得」でダッシュボード非公式API
 *   https://note.com/api/v1/stats/pv?filter=<all|weekly|monthly>&page=N&sort=pv
 * を last_page まで順に叩いて全記事のビュー数を集める。
 * 結果はパネル内の表で確認でき、CSVダウンロード / TSVコピー（スプレッドシート貼り付け用）ができる。
 * 認証はブラウザのログインセッション(クッキー)をそのまま使うのでトークン設定は不要。
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

  let lastResult = null; // { fetchedAt, filter, rows: [...] }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function tsLocal(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
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

  function toRow(item, fetchedAt, filter) {
    const user = item.user || {};
    const key = item.key || '';
    const urlname = user.urlname || '';
    return {
      fetched_at: fetchedAt,
      filter: filter,
      id: item.id != null ? String(item.id) : '',
      title: item.name || item.title || '(無題)',
      url: (urlname && key) ? 'https://note.com/' + urlname + '/n/' + key : '',
      pv: Number(item.read_count != null ? item.read_count : (item.pv != null ? item.pv : 0)),
      like: Number(item.like_count || 0),
      comment: Number(item.comment_count || 0),
    };
  }

  async function fetchAll(filter, onProgress) {
    const fetchedAt = tsLocal(new Date());
    const rows = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      onProgress('取得中… ' + page + 'ページ目 (' + rows.length + '記事)');
      const json = await fetchPage(filter, page);
      const data = json && json.data ? json.data : {};
      const stats = Array.isArray(data.note_stats) ? data.note_stats : [];
      for (const item of stats) rows.push(toRow(item, fetchedAt, filter));
      // last_page === false のときだけ続行。true/欠落、または空ページなら終了
      if (data.last_page !== false || stats.length === 0) break;
      await sleep(PAGE_WAIT_MS);
    }
    return { fetchedAt: fetchedAt, filter: filter, rows: rows };
  }

  // ── 出力 ──

  const HEADER = ['取得日時', '期間', '記事ID', 'タイトル', 'URL', 'ビュー', 'スキ', 'コメント'];

  function rowToArray(r) { return [r.fetched_at, r.filter, r.id, r.title, r.url, r.pv, r.like, r.comment]; }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCSV(result) {
    const lines = [HEADER.map(csvCell).join(',')];
    for (const r of result.rows) lines.push(rowToArray(r).map(csvCell).join(','));
    return '\uFEFF' + lines.join('\r\n') + '\r\n'; // BOM付き(Excel対策)
  }
  function buildTSV(result) {
    const lines = [HEADER.join('\t')];
    for (const r of result.rows) {
      lines.push(rowToArray(r).map((v) => String(v == null ? '' : v).replace(/[\t\r\n]/g, ' ')).join('\t'));
    }
    return lines.join('\n');
  }

  function downloadCSV(result) {
    const blob = new Blob([buildCSV(result)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'note-pv_' + result.filter + '_' + tsFile(new Date()) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
  }

  async function copyTSV(result) {
    const text = buildTSV(result);
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // クリップボードAPIが使えない環境向けフォールバック
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
    '#npv-fab{position:fixed;right:16px;bottom:16px;z-index:99999;background:#41c9b4;color:#fff;border:none;border-radius:24px;padding:10px 16px;font-size:14px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer;}',
    '#npv-panel{position:fixed;right:16px;bottom:64px;z-index:99999;width:min(420px,calc(100vw - 32px));max-height:70vh;background:#fff;color:#222;border:1px solid #ccc;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.3);display:none;flex-direction:column;font-size:13px;font-family:sans-serif;}',
    '#npv-panel.open{display:flex;}',
    '#npv-panel header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #eee;flex-wrap:wrap;}',
    '#npv-panel header strong{margin-right:auto;}',
    '#npv-panel select,#npv-panel button.npv-btn{font-size:13px;padding:5px 10px;border-radius:6px;border:1px solid #bbb;background:#f7f7f7;cursor:pointer;}',
    '#npv-panel button.npv-btn.primary{background:#41c9b4;border-color:#41c9b4;color:#fff;font-weight:bold;}',
    '#npv-panel button.npv-btn:disabled{opacity:.5;cursor:default;}',
    '#npv-status{padding:6px 12px;color:#555;border-bottom:1px solid #eee;min-height:1.4em;}',
    '#npv-body{overflow:auto;padding:0 0 8px;}',
    '#npv-body table{width:100%;border-collapse:collapse;}',
    '#npv-body th,#npv-body td{padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:left;white-space:nowrap;}',
    '#npv-body td.title{max-width:200px;overflow:hidden;text-overflow:ellipsis;}',
    '#npv-body td.num,#npv-body th.num{text-align:right;}',
  ].join('\n');

  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    return node;
  }

  function buildUI() {
    if (document.getElementById('npv-fab')) return;

    const style = el('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const fab = el('button', { id: 'npv-fab', type: 'button' }, '📊 PV');
    const panel = el('div', { id: 'npv-panel' });

    const header = el('header');
    header.appendChild(el('strong', null, 'note PV'));
    const select = el('select');
    for (const f of FILTERS) {
      const opt = el('option', { value: f.value }, f.label);
      select.appendChild(opt);
    }
    const btnFetch = el('button', { class: 'npv-btn primary', type: 'button' }, '取得');
    const btnCSV = el('button', { class: 'npv-btn', type: 'button', disabled: '' }, 'CSV保存');
    const btnTSV = el('button', { class: 'npv-btn', type: 'button', disabled: '' }, 'コピー');
    header.appendChild(select);
    header.appendChild(btnFetch);
    header.appendChild(btnCSV);
    header.appendChild(btnTSV);

    const status = el('div', { id: 'npv-status' }, 'ログイン済みのnoteで「取得」を押してください');
    const body = el('div', { id: 'npv-body' });

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
        const tdTitle = el('td', { class: 'title', title: r.title }, r.title);
        tr.appendChild(tdTitle);
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
      btnCSV.disabled = true;
      btnTSV.disabled = true;
      try {
        const result = await fetchAll(select.value, setStatus);
        lastResult = result;
        const totalPV = result.rows.reduce((a, r) => a + r.pv, 0);
        const totalLike = result.rows.reduce((a, r) => a + r.like, 0);
        setStatus('取得完了: ' + result.rows.length + '記事 / 合計ビュー ' + totalPV.toLocaleString() +
          ' / 合計スキ ' + totalLike.toLocaleString() + ' (' + result.fetchedAt + ')');
        renderTable(result);
        btnCSV.disabled = false;
        btnTSV.disabled = false;
      } catch (e) {
        setStatus('エラー: ' + (e && e.message ? e.message : e));
      } finally {
        btnFetch.disabled = false;
      }
    });

    btnCSV.addEventListener('click', () => { if (lastResult) downloadCSV(lastResult); });
    btnTSV.addEventListener('click', async () => {
      if (!lastResult) return;
      const ok = await copyTSV(lastResult);
      setStatus(ok ? 'TSVをコピーしました（スプレッドシートに貼り付けできます）' : 'コピーに失敗しました');
    });
  }

  buildUI();
})();
