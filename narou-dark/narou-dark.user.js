// ==UserScript==
// @name         なろう夜読み (自動起動)
// @description  小説家になろうの話ページと目次を開いたら、自動でダークモードの読書画面にする。
// @version      1.2.0
// @match        https://ncode.syosetu.com/*
// @match        https://novel18.syosetu.com/*
// @run-at       document-end
// @noframes
// ==/UserScript==
(function () {
  if (window.__ndr) return;
  var s = document.createElement('script');
  /* 本体は GitHub Pages から読む。日付ごとにキャッシュを更新する */
  s.src = 'https://yzrswork.github.io/yzrswork_ai-skill-recipe/narou-dark/reader.js?d=' + Math.floor(Date.now() / 864e5);
  document.body.appendChild(s);
})();
