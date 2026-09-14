import { parsePhone, readLaunch, addBatch } from "./phone.mjs";
import { makeVcf, downloadVcf } from "./vcf.mjs";
const $ = (id) => document.getElementById(id);
let numbers = [];
let quickPhone = null;
function message(id, text, error = false) {
  $(id).textContent = text;
  $(id).classList.toggle("error", error);
}
function showView(view) {
  for (const name of ["quick", "batch", "help"]) $(name).hidden = name !== view;
  document.querySelectorAll("[data-view]").forEach((button) => {
    if (button.dataset.view === view)
      button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $(view + "Title").focus();
}
document
  .querySelectorAll("[data-view]")
  .forEach((button) =>
    button.addEventListener("click", () => showView(button.dataset.view)),
  );
function updateQuick(showEmpty = false) {
  quickPhone = parsePhone($("quickInput").value);
  $("quickExport").disabled = !quickPhone.ok;
  $("quickPreview").hidden = !quickPhone.ok;
  $("quickResult").hidden = true;
  const invalid =
    !quickPhone.ok && (showEmpty || Boolean($("quickInput").value));
  $("quickInput").setAttribute("aria-invalid", String(invalid));
  message("quickMessage", invalid ? quickPhone.error : "", invalid);
  if (quickPhone.ok) {
    $("quickNumber").textContent = quickPhone.display;
    $("quickCanonical").textContent = "VCF: " + quickPhone.canonical;
  }
}
$("quickInput").addEventListener("paste", (event) => {
  const text = event.clipboardData?.getData("text");
  if (text && /[\r\n\u2028\u2029]/.test(text)) {
    event.preventDefault();
    $("quickInput").value = "";
    updateQuick();
    message("quickMessage", "複数行は一括登録に貼り付けてください。", true);
  }
});
$("quickInput").addEventListener("input", () => updateQuick());
function clearQuick() {
  $("quickInput").value = "";
  updateQuick();
  $("quickInput").focus();
}
$("quickClear").addEventListener("click", clearQuick);
$("nextNumber").addEventListener("click", clearQuick);
async function paste(inputId, statusId, after) {
  const input = $(inputId),
    previous = input.value;
  try {
    if (!navigator.clipboard?.readText) throw new Error("unavailable");
    const text = await navigator.clipboard.readText();
    // Do not overwrite edits made while permission was pending.
    if (input.value !== previous) return;
    if (!text.trim()) {
      message(statusId, "クリップボードが空です。", true);
      return;
    }
    if (inputId === "quickInput" && /[\r\n\u2028\u2029]/.test(text)) {
      input.value = "";
      updateQuick();
      message(
        statusId,
        "複数行の入力は貼り付けていません。一括登録を使ってください。",
        true,
      );
      return;
    }
    input.value = text;
    after();
  } catch {
    input.focus();
    message(statusId, "入力欄を長押しして「ペースト」を選んでください。");
  }
}
$("quickPaste").addEventListener("click", () =>
  paste("quickInput", "quickMessage", () => updateQuick(true)),
);
$("batchPaste").addEventListener("click", () =>
  paste("batchInput", "batchMessage", batchEdited),
);
function exportNumbers(list, batch) {
  const prefix = batch ? "batch" : "quick";
  try {
    const vcf = makeVcf(list, batch);
    downloadVcf(vcf);
    const result = $(prefix + "Result");
    result.querySelector(".export-summary").textContent =
      `${list.length}件 / ${vcf.filename} のダウンロードを開始しました。`;
    result.hidden = false;
    result.focus();
  } catch {
    message(
      prefix + "Message",
      "VCFを作成できませんでした。番号を確認して、もう一度お試しください。",
      true,
    );
  }
}
$("quickForm").addEventListener("submit", (event) => {
  event.preventDefault();
  updateQuick(true);
  if (!quickPhone.ok) {
    $("quickInput").focus();
    return;
  }
  exportNumbers([quickPhone], false);
});
function renderBatch(focusIndex = null) {
  $("batchList").replaceChildren();
  numbers.forEach((phone, i) => {
    const li = document.createElement("li"),
      span = document.createElement("span"),
      button = document.createElement("button");
    span.className = "phone";
    span.textContent = phone.display;
    button.type = "button";
    button.textContent = "削除";
    button.setAttribute("aria-label", phone.display + "を削除");
    button.addEventListener("click", () => {
      numbers.splice(i, 1);
      renderBatch(i);
      message("batchMessage", "1件削除しました。");
    });
    li.append(span, button);
    $("batchList").append(li);
  });
  $("batchCount").textContent = numbers.length + "件";
  $("batchEmpty").hidden = numbers.length > 0;
  $("batchClear").disabled = numbers.length === 0;
  $("batchExport").disabled =
    numbers.length === 0 || Boolean($("batchInput").value.trim());
  $("batchExport").textContent = numbers.length + "件の連絡先を作成（VCF）";
  $("batchResult").hidden = true;
  if (focusIndex !== null) {
    const buttons = $("batchList").querySelectorAll("button");
    (
      buttons[Math.min(focusIndex, buttons.length - 1)] || $("batchInput")
    ).focus();
  }
}
function batchEdited() {
  $("batchResult").hidden = true;
  $("batchInput").setAttribute("aria-invalid", "false");
  message(
    "batchMessage",
    $("batchInput").value.trim()
      ? "「リストへ追加」で番号を確認してください。未追加の入力がある間はVCFを作成できません。"
      : "",
  );
  $("batchExport").disabled =
    numbers.length === 0 || Boolean($("batchInput").value.trim());
}
$("batchInput").addEventListener("input", batchEdited);
$("batchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const result = addBatch(numbers, $("batchInput").value);
  $("batchInput").setAttribute(
    "aria-invalid",
    String(result.errors.length > 0),
  );
  if (result.errors.length) {
    message(
      "batchMessage",
      "追加していません。\n" + result.errors.join("\n"),
      true,
    );
    $("batchInput").focus();
    return;
  }
  numbers = result.numbers;
  $("batchInput").value = "";
  renderBatch();
  message(
    "batchMessage",
    `${result.added}件追加しました。` +
      (result.duplicates ? ` 重複${result.duplicates}件は除外しました。` : ""),
  );
});
function clearBatch() {
  if (!window.confirm(`${numbers.length}件のリストと入力を消しますか？`))
    return;
  numbers = [];
  $("batchInput").value = "";
  $("batchInput").setAttribute("aria-invalid", "false");
  renderBatch();
  message("batchMessage", "リストを消しました。");
  $("batchInput").focus();
}
$("batchClear").addEventListener("click", clearBatch);
$("batchDone").addEventListener("click", clearBatch);
$("batchExport").addEventListener("click", () => {
  if (numbers.length && !$("batchInput").value.trim())
    exportNumbers(numbers, true);
});
$("legacyClear").addEventListener("click", () => {
  if (!window.confirm("旧版がこのブラウザに保存した番号リストを削除しますか？"))
    return;
  try {
    localStorage.removeItem("spam-blocker-numbers");
    message("legacyMessage", "旧版の保存リストを削除しました。");
  } catch {
    message(
      "legacyMessage",
      "ブラウザの保存領域にアクセスできませんでした。",
      true,
    );
  }
});
const launch = readLaunch(location.search);
// Remove sensitive input for valid, invalid and empty URLs alike; never put it in history.state.
try {
  const url = new URL(location.href);
  url.searchParams.delete("num");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
} catch {
  /* The form still works when history is unavailable. */
}
if (/[\r\n\u2028\u2029]/.test(launch.raw)) {
  launch.raw = "";
  launch.error = "URLに複数行が含まれています。番号を1件ずつ入力してください。";
}
$("quickInput").value = launch.raw;
updateQuick();
if (launch.error) message("quickMessage", launch.error, true);
else if (quickPhone.ok && launch.raw)
  message(
    "quickMessage",
    "URLから受け取りました。番号を確認して作成してください。",
  );
$("batchAdd").disabled = false;
renderBatch();
