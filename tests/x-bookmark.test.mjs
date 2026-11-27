// X Bookmark Logger / Uploader の送信処理を、ブラウザなしで試すテスト。
// ユーザースクリプトを node:vm で読み込み、localStorage・document・GM_xmlhttpRequest を
// 偽物に差し替えて、偽のGitHub(trees API と contents API)に対する送信の動きを確かめる。
// 実行: node --test tests/x-bookmark.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const SOURCES = {
  logger: readFileSync(new URL("x-bookmark-logger.user.js", ROOT), "utf8"),
  uploader: readFileSync(new URL("x-bookmark-uploader.user.js", ROOT), "utf8"),
};
const KINDS = Object.keys(SOURCES);

const CONFIG = { owner: "owner", repo: "vault", branch: "main", folder: "xBookmarks", token: "dummy-token", enabled: true };

function rec(id, screenName, postedAt = "2026-10-22T01:12:25.000Z") {
  return {
    id,
    url: `https://x.com/${screenName}/status/${id}`,
    screen_name: screenName,
    author_name: "name",
    text: "body",
    posted_at: postedAt,
    media: [],
    quote: null,
    bookmarked_at: "2026-11-27T10:00:19+09:00",
    source: "bookmarks-sync",
  };
}

function makeStorage(initial) {
  const m = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    read: (k) => JSON.parse(m.has(k) ? m.get(k) : "null"),
  };
}

// 偽のGitHub。files はリポジトリ直下からのパスの一覧で、そこから trees API の応答を組み立てる。
// fail を渡すと trees API が失敗する("network" は通信エラー、数値はそのHTTPステータス)。
function makeGitHub({ files, fail = null, truncated = false }) {
  const repoFiles = [...files];
  const calls = [];
  const shaOf = new Map(); // キーはフォルダのパス、値は偽のsha
  const dirOf = new Map(); // キーは偽のsha、値はフォルダのパス
  const treeSha = (dir) => {
    if (!shaOf.has(dir)) {
      const sha = "t" + String(shaOf.size).padStart(39, "0");
      shaOf.set(dir, sha);
      dirOf.set(sha, dir);
    }
    return shaOf.get(dir);
  };

  function treeOf(dir, recursive) {
    const prefix = dir ? dir + "/" : "";
    const entries = [];
    const dirs = new Set();
    const addDir = (rel) => {
      if (dirs.has(rel)) return;
      dirs.add(rel);
      entries.push({ path: rel, type: "tree", sha: treeSha(prefix + rel) });
    };
    for (const f of repoFiles) {
      if (!f.startsWith(prefix)) continue;
      const parts = f.slice(prefix.length).split("/");
      if (recursive) {
        for (let i = 1; i < parts.length; i++) addDir(parts.slice(0, i).join("/"));
        entries.push({ path: parts.join("/"), type: "blob", sha: "b" });
      } else if (parts.length > 1) {
        addDir(parts[0]);
      } else {
        entries.push({ path: parts[0], type: "blob", sha: "b" });
      }
    }
    return entries;
  }

  function handle(method, url) {
    const u = new URL(url);
    const tree = u.pathname.match(/^\/repos\/owner\/vault\/git\/trees\/([^/]+)$/);
    if (method === "GET" && tree) {
      if (fail !== null) return fail;
      const ref = decodeURIComponent(tree[1]);
      const dir = ref === "main" ? "" : dirOf.get(ref);
      if (dir === undefined) return { status: 404, body: { message: "Not Found" } };
      return { status: 200, body: { sha: ref, tree: treeOf(dir, u.searchParams.has("recursive")), truncated } };
    }
    const put = u.pathname.match(/^\/repos\/owner\/vault\/contents\/(.+)$/);
    if (method === "PUT" && put) {
      const path = put[1].split("/").map(decodeURIComponent).join("/");
      if (repoFiles.includes(path)) return { status: 422, body: { message: "sha wasn't supplied" } };
      repoFiles.push(path);
      return { status: 201, body: {} };
    }
    return { status: 500, body: {} };
  }

  function gm(details) {
    calls.push({ method: details.method, url: details.url });
    setImmediate(() => {
      const r = handle(details.method, details.url);
      if (r === "network") return details.onerror();
      details.onload({ status: r.status, responseText: JSON.stringify(r.body) });
    });
  }

  const pathOf = (c) => new URL(c.url).pathname.replace("/repos/owner/vault/contents/", "").split("/").map(decodeURIComponent).join("/");
  return {
    gm,
    calls,
    puts: () => calls.filter((c) => c.method === "PUT").map(pathOf),
    treeGets: () => calls.filter((c) => c.method === "GET" && c.url.includes("/git/trees/")).map((c) => new URL(c.url).pathname + new URL(c.url).search),
  };
}

// ユーザースクリプトを読み込み、送信処理(flushQueue)を返す。
// 3秒以上のタイマー(起動直後の再送・定期送信・キャッシュ保存など)は動かさず、テストから送信を直接呼ぶ。
// 短いタイマー(送信間隔の sleep)はすぐに進める。
function load(kind, { storage, gm }) {
  const listeners = {};
  const document = {
    readyState: "complete",
    visibilityState: "visible",
    body: null,
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    dispatchEvent: (ev) => { for (const fn of listeners[ev.type] || []) fn(ev); return true; },
    getElementById: () => null,
  };
  function FakeXHR() {}
  FakeXHR.prototype.open = function () {};
  FakeXHR.prototype.send = function () {};
  const win = { XMLHttpRequest: FakeXHR, addEventListener: () => {} };
  const context = vm.createContext({
    window: win,
    unsafeWindow: win,
    document,
    localStorage: storage,
    navigator: { onLine: true },
    GM_xmlhttpRequest: gm,
    console: { debug() {}, log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => { if (!(ms >= 3000)) setImmediate(fn); return 0; },
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    TextEncoder,
    btoa,
    CustomEvent: class { constructor(type) { this.type = type; } },
  });
  vm.runInContext(SOURCES[kind], context, { filename: `x-bookmark-${kind}.user.js` });
  if (kind === "logger") return { flush: () => win.__XBM_DEBUG.flushQueue(), debug: win.__XBM_DEBUG };
  // uploader は flushQueue そのものを xbm:queue のリスナーに登録している
  const [flush] = listeners["xbm:queue"] || [];
  assert.equal(typeof flush, "function", "uploader が xbm:queue を監視していない");
  return { flush };
}

async function run(kind, { files, queue, logged = [], folder = CONFIG.folder, fail = null, truncated = false }) {
  const gh = makeGitHub({ files, fail, truncated });
  const storage = makeStorage({
    "xbm.config": { ...CONFIG, folder },
    "xbm.queue": queue,
    "xbm.logged": logged,
    "xbm.cap_gm": "0", // uploader が送信を担当する環境として読み込む(logger は読み込み時に "1" に上書きする)
  });
  const { flush } = load(kind, { storage, gm: gh.gm });
  await flush();
  return {
    gh,
    queue: storage.read("xbm.queue"),
    logged: storage.read("xbm.logged"),
    status: storage.read("xbm.status"),
  };
}

for (const kind of KINDS) {
  test(`${kind}: ハンドル名が変わった同じ投稿は保存しない`, async () => {
    const r = await run(kind, {
      files: ["xBookmarks/2026-10-22_fumi_KPFstudio_2113075970681012657.md"],
      queue: [rec("2113075970681012657", "fuminori_rakuda")],
    });
    assert.deepEqual(r.gh.puts(), []);
    assert.deepEqual(r.queue, []);
    assert.deepEqual(r.logged, ["2113075970681012657"]);
    assert.equal(r.status.state, "ok");
  });

  test(`${kind}: archive/ へ移した投稿を直下に作り直さない`, async () => {
    const r = await run(kind, {
      files: ["xBookmarks/archive/2026/2026-09-30_boketejp_2105178683308929452.md"],
      queue: [rec("2105178683308929452", "boketejp", "2026-09-30T00:00:00.000Z")],
    });
    assert.deepEqual(r.gh.puts(), []);
    assert.deepEqual(r.queue, []);
    assert.deepEqual(r.logged, ["2105178683308929452"]);
  });

  test(`${kind}: 保存済みの投稿は飛ばし、新しい投稿だけを1回保存する`, async () => {
    const r = await run(kind, {
      files: [
        "xBookmarks/README.md",
        "xBookmarks/records/2026-10-28_batch01.md",
        "xBookmarks/summaries/00_INDEX.md",
        "xBookmarks/2026-10-22_fumi_KPFstudio_2113075970681012657.md",
        "xBookmarks/archive/2026/2026-09-30_boketejp_2105178683308929452.md",
      ],
      queue: [
        rec("2113075970681012657", "fuminori_rakuda"),
        rec("2123000000000000001", "newcomer", "2026-11-20T09:00:00.000Z"),
        rec("2105178683308929452", "boketejp"),
      ],
    });
    assert.deepEqual(r.gh.puts(), ["xBookmarks/2026-11-20_newcomer_2123000000000000001.md"]);
    assert.deepEqual(r.queue, []);
    assert.deepEqual([...r.logged].sort(), ["2105178683308929452", "2113075970681012657", "2123000000000000001"]);
    // 一覧の取得は送信1回につき、最上位ツリーと保存先フォルダの再帰取得の2本だけ
    assert.equal(r.gh.treeGets().length, 2);
    assert.match(r.gh.treeGets()[0], /\/git\/trees\/main$/);
    assert.match(r.gh.treeGets()[1], /\?recursive=1$/);
  });

  test(`${kind}: 保存先フォルダがまだ無ければ保存する`, async () => {
    const r = await run(kind, {
      files: ["README.md"],
      queue: [rec("2123000000000000001", "newcomer", "2026-11-20T09:00:00.000Z")],
    });
    assert.deepEqual(r.gh.puts(), ["xBookmarks/2026-11-20_newcomer_2123000000000000001.md"]);
    assert.deepEqual(r.queue, []);
  });

  test(`${kind}: 入れ子の保存先フォルダも1段ずつたどって照合する`, async () => {
    const r = await run(kind, {
      folder: "/clips/xBookmarks/",
      files: [
        "xBookmarks/2026-10-22_other_2123000000000000001.md", // 保存先の外にある同じIDは見ない
        "clips/xBookmarks/archive/2026/2026-09-30_boketejp_2105178683308929452.md",
      ],
      queue: [rec("2105178683308929452", "boketejp"), rec("2123000000000000001", "newcomer", "2026-11-20T09:00:00.000Z")],
    });
    assert.deepEqual(r.gh.puts(), ["clips/xBookmarks/2026-11-20_newcomer_2123000000000000001.md"]);
    assert.equal(r.gh.treeGets().length, 3);
  });

  for (const [label, fail, pattern] of [
    ["通信エラー", "network", /通信エラー/],
    ["GitHubの障害(502)", { status: 502, body: {} }, /502/],
    ["認証エラー(401)", { status: 401, body: {} }, /認証エラー\(401\)/],
    ["見つからない(404)", { status: 404, body: {} }, /404/],
  ]) {
    test(`${kind}: 一覧を取れないとき(${label})は送らずキューに残す`, async () => {
      const queue = [rec("2123000000000000001", "newcomer")];
      const r = await run(kind, { files: [], queue, fail });
      assert.deepEqual(r.gh.puts(), []);
      assert.deepEqual(r.queue, queue);
      assert.deepEqual(r.logged, []);
      assert.equal(r.status.state, "error");
      assert.match(r.status.msg, pattern);
    });
  }

  test(`${kind}: 一覧が上限で切り詰められたら送らずキューに残す`, async () => {
    const queue = [rec("2123000000000000001", "newcomer")];
    const r = await run(kind, { files: ["xBookmarks/2026-10-22_a_2113075970681012657.md"], queue, truncated: true });
    assert.deepEqual(r.gh.puts(), []);
    assert.deepEqual(r.queue, queue);
    assert.equal(r.status.state, "error");
  });
}

test("logger と uploader は同じ投稿に同じファイル名を付ける", async () => {
  const queue = [
    rec("2121859339317350516", "Jc_2012_", "2026-11-15T06:54:23.000Z"),
    rec("2123000000000000002", "ハンドル", "2026-11-20T09:00:00.000Z"), // 使えない screen_name は unknown
    { ...rec("2123000000000000003", ""), posted_at: null }, // 本文なしの仮データ相当
  ];
  const paths = {};
  for (const kind of KINDS) paths[kind] = (await run(kind, { files: [], queue })).gh.puts();
  assert.deepEqual(paths.logger, [
    "xBookmarks/2026-11-15_Jc_2012__2121859339317350516.md",
    "xBookmarks/2026-11-20_unknown_2123000000000000002.md",
    "xBookmarks/unknown-date_unknown_2123000000000000003.md",
  ]);
  assert.deepEqual(paths.uploader, paths.logger);
});

test("ファイル名から投稿IDを取り出すのは末尾の _<数字>.md だけ", () => {
  const { debug } = load("logger", { storage: makeStorage({}), gm: makeGitHub({ files: [] }).gm });
  assert.equal(debug.idFromPath("archive/2026/2026-09-30_boketejp_2105178683308929452.md"), "2105178683308929452");
  assert.equal(debug.idFromPath("2026-11-15_Jc_2012__2121859339317350516.md"), "2121859339317350516");
  for (const p of ["README.md", "records/2026-10-28_batch01.md", "summaries/00_INDEX.md", "retention-log.md", "x_123.txt"]) {
    assert.equal(debug.idFromPath(p), null, p);
  }
  const ids = debug.savedIdsFromTree([
    { path: "archive", type: "tree" },
    { path: "archive/2026", type: "tree" },
    { path: "archive/2026/2026-09-30_boketejp_2105178683308929452.md", type: "blob" },
    { path: "records/2026-10-28_batch01.md", type: "blob" },
    { path: "2026-10-22_fuminori_rakuda_2113075970681012657.md", type: "blob" },
  ]);
  assert.deepEqual(Array.from(ids).sort(), ["2105178683308929452", "2113075970681012657"]);
});
