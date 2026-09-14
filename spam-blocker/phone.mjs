// Conservative syntax validation, not a directory or a number-allocation lookup.
const invalid = (error) => ({ ok: false, error });
function domesticValid(n) {
  if (n.startsWith("0120")) return /^0120\d{6}$/.test(n);
  if (n.startsWith("0800")) return /^0800\d{7}$/.test(n);
  if (/^0(?:70|80|90|50)/.test(n)) return /^0(?:70|80|90|50)\d{8}$/.test(n);
  return /^0[1-9]\d{8}$/.test(n);
}
function domesticDisplay(n) {
  if (/^(0120\d{6}|0800\d{7})$/.test(n))
    return `${n.slice(0, 4)}-${n.slice(4, 7)}-${n.slice(7)}`;
  if (/^0[5789]0\d{8}$/.test(n))
    return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7)}`;
  // Only 03 / 06 have a known two-digit area code here. Never guess other areas.
  if (/^0[36]\d{8}$/.test(n))
    return `${n.slice(0, 2)}-${n.slice(2, 6)}-${n.slice(6)}`;
  return n;
}
export function parsePhone(raw) {
  if (typeof raw !== "string" || !raw.trim())
    return invalid("電話番号を入力してください。");
  if (raw.length > 160 || /[\r\n\u2028\u2029]/.test(raw))
    return invalid(
      "番号は1件ずつ入力してください。一括登録では改行で区切れます。",
    );
  // Convert only known full-width characters; NFKC would also convert circled digits, etc.
  let s = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/＋/g, "+")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/：/g, ":")
    .trim();
  s = s.replace(/^(?:TEL\s*:?|電話(?:番号)?\s*:?)[ \t\u3000]*/i, "");
  if (!/^\+?[0-9 ()\t\u3000\u00a0\u202f\-‐‑‒–—―−－]+$/.test(s))
    return invalid(
      "数字と区切り記号だけで入力してください。内線・複数番号・説明文は含められません。",
    );
  if (
    (s.match(/\(/g) || []).length > 1 ||
    (s.includes("(") && !/\(\d+\)/.test(s)) ||
    (s.match(/\(/g) || []).length !== (s.match(/\)/g) || []).length
  )
    return invalid("括弧の位置を確認してください。");
  const n = s.replace(/[ ()\t\u3000\u00a0\u202f\-‐‑‒–—―−－]/g, "");
  let domestic = n;
  if (n.startsWith("+81")) {
    if (n[3] === "0")
      return invalid(
        "+81の後に国内用の先頭0を含めないでください。元の番号を確認してください。",
      );
    domestic = "0" + n.slice(3);
  } else if (n.startsWith("+")) {
    if (!/^\+[1-9]\d{5,14}$/.test(n))
      return invalid(
        "国際番号は + と国番号を含む6〜15桁の数字で入力してください。",
      );
    return { ok: true, canonical: n, display: n, international: true };
  }
  if (!domesticValid(domestic))
    return invalid(
      "国内番号の先頭0と桁数を確認してください。短縮番号・内線には対応していません。",
    );
  return {
    ok: true,
    canonical: "+81" + domestic.slice(1),
    display: domesticDisplay(domestic),
    international: n.startsWith("+"),
  };
}
export function readLaunch(search) {
  // Preserve legacy unescaped leading +; elsewhere + retains form-encoding space semantics.
  const values = [];
  try {
    for (const part of search.replace(/^\?/, "").split("&")) {
      const at = part.indexOf("=");
      const key = decodeURIComponent(
        (at < 0 ? part : part.slice(0, at)).replace(/\+/g, " "),
      );
      if (key !== "num") continue;
      let value = at < 0 ? "" : part.slice(at + 1);
      if (value.startsWith("+")) value = "%2B" + value.slice(1);
      values.push(decodeURIComponent(value.replace(/\+/g, " ")));
    }
  } catch {
    return {
      raw: "",
      error: "URLの文字コードが不正です。番号を入力し直してください。",
    };
  }
  if (values.length > 1)
    return {
      raw: "",
      error: "URLに番号が複数あります。1件ずつ指定してください。",
    };
  return { raw: values[0] || "", error: "" };
}
export function addBatch(current, raw) {
  const lines = raw.split(/\r\n|[\n\r\u2028\u2029]/);
  const next = [...current],
    errors = [];
  let duplicates = 0;
  const seen = new Set(current.map((p) => p.canonical));
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    const p = parsePhone(line);
    if (!p.ok) errors.push(`${i + 1}行目: ${p.error}`);
    else if (seen.has(p.canonical)) duplicates++;
    else {
      seen.add(p.canonical);
      next.push(p);
    }
  });
  if (!raw.trim()) errors.push("電話番号を入力してください。");
  if (next.length > 200) errors.push("一度に登録できる番号は200件までです。");
  // Atomic: never silently export only the valid subset of pasted input.
  return {
    numbers: errors.length ? current : next,
    errors,
    duplicates,
    added: errors.length ? 0 : next.length - current.length,
  };
}
