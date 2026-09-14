// No production dependency: install Playwright separately and set PLAYWRIGHT_MODULE.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const modulePath = process.env.PLAYWRIGHT_MODULE;
const pw = await import(
  modulePath ? pathToFileURL(modulePath).href : "playwright"
);
const root = fileURLToPath(new URL("../../", import.meta.url));
const evidence = "/tmp/spam-blocker-evidence";
await mkdir(evidence, { recursive: true });
const prefix = "/yzrswork_ai-skill-recipe/";
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (!pathname.startsWith(prefix)) throw new Error("bad prefix");
    let path = resolve(root, "." + sep + pathname.slice(prefix.length));
    if (pathname.endsWith("/")) path += "/index.html";
    if (!path.startsWith(root)) throw new Error("outside root");
    const mime = {
      ".html": "text/html; charset=utf-8",
      ".mjs": "text/javascript",
      ".css": "text/css",
      ".png": "image/png",
    }[extname(path)];
    res.writeHead(200, { "Content-Type": mime || "application/octet-stream" });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}${prefix}spam-blocker/`;
let checks = 0;
const check = (value, description) => {
  assert.ok(value, description);
  checks++;
};
try {
  for (const engine of ["chromium", "webkit"]) {
    const browser = await pw[engine].launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
        acceptDownloads: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      const errors = [],
        outbound = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (!r.url().startsWith(base.split(prefix)[0])) outbound.push(r.url());
      });
      await page.goto(base);
      await page.waitForFunction(
        () => !document.getElementById("batchAdd").disabled,
      );
      check(
        await page.locator("#quickExport").isDisabled(),
        "empty input blocked",
      );
      await page.locator("#quickInput").fill("TEL: 090-1234-5678");
      check(
        (await page.locator("#quickNumber").innerText()) === "090-1234-5678",
        "normalization in UI",
      );
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#quickExport").click();
      const download = await downloadPromise;
      check(
        download.suggestedFilename() === "spam-09012345678.vcf",
        "download filename",
      );
      const content = await readFile(await download.path(), "utf8");
      check(
        content.includes("TEL;TYPE=CELL:+819012345678\r\n"),
        "downloaded VCF TEL",
      );
      check(
        await page.locator("#quickResult").isVisible(),
        "post-export instructions visible",
      );
      check(
        (await page.locator("#quickInput").inputValue()) ===
          "TEL: 090-1234-5678",
        "number retained for retry",
      );
      await page.locator("#nextNumber").click();
      check(
        (await page.locator("#quickInput").inputValue()) === "",
        "next number clears",
      );
      check(
        await page
          .locator("#quickInput")
          .evaluate((e) => e === document.activeElement),
        "focus returns to input",
      );
      for (const query of [
        "?num=09012345678",
        "?num=+819012345678",
        "?num=%2B81%2090%201234%205678",
      ]) {
        await page.goto(base + query);
        await page.waitForFunction(
          () => !document.getElementById("batchAdd").disabled,
        );
        check(
          await page.locator("#quickExport").isEnabled(),
          "URL immediately ready",
        );
        check(
          (await page.locator("#quickNumber").innerText()) === "090-1234-5678",
          "URL exact number",
        );
        check(!page.url().includes("num="), "number removed from URL");
        check(
          await page.evaluate(() => document.activeElement.tagName !== "INPUT"),
          "URL does not open keyboard",
        );
      }
      for (const query of [
        "?num=",
        "?num=%ZZ",
        "?num=%2B8109012345678",
        "?num=09012%0A345678",
        "?num=09012345678&num=08012345678",
        "?num=%3Cimg%20src=x%3E",
      ]) {
        await page.goto(base + query);
        await page.waitForFunction(
          () => !document.getElementById("batchAdd").disabled,
        );
        check(
          await page.locator("#quickExport").isDisabled(),
          "invalid URL blocked: " + query,
        );
      }
      await page.goto(base);
      await page.waitForFunction(
        () => !document.getElementById("batchAdd").disabled,
      );
      // Clipboard available, denied, and multiline paste are all explicit paths.
      await page.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { readText: async () => "+81 90 1234 5678" },
        }),
      );
      await page.locator("#quickPaste").click();
      check(
        (await page.locator("#quickNumber").innerText()) === "090-1234-5678",
        "clipboard button",
      );
      await page.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { readText: async () => "09012\n345678" },
        }),
      );
      await page.locator("#quickPaste").click();
      check(
        await page.locator("#quickExport").isDisabled(),
        "multiline clipboard cannot join",
      );
      await page.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            readText: async () => {
              throw Error("denied");
            },
          },
        }),
      );
      await page.locator("#quickPaste").click();
      check(
        (await page.locator("#quickMessage").innerText()).includes("長押し"),
        "clipboard denial fallback",
      );
      await page.locator("#quickInput").fill("09012345678");
      await page.locator("#quickInput").evaluate((el) => {
        const data = new DataTransfer();
        data.setData("text", "09012\n345678");
        el.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData: data,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      check(
        await page.locator("#quickExport").isDisabled(),
        "native multiline paste blocked",
      );
      await page.getByRole("button", { name: "一括登録", exact: true }).click();
      await page
        .locator("#batchInput")
        .fill("09012345678\n+819012345678\n0312345678");
      await page.locator("#batchAdd").click();
      check(
        (await page.locator("#batchCount").innerText()) === "2件",
        "batch dedup",
      );
      check(
        (await page.locator("#batchMessage").innerText()).includes("重複1件"),
        "duplicate feedback",
      );
      await page.locator("#batchInput").fill("0612345678\ninvalid");
      await page.locator("#batchAdd").click();
      check(
        (await page.locator("#batchCount").innerText()) === "2件",
        "invalid batch atomic",
      );
      check(
        await page.locator("#batchExport").isDisabled(),
        "pending invalid input blocks export",
      );
      await page.locator("#batchInput").fill("");
      const batchDownloadPromise = page.waitForEvent("download");
      await page.locator("#batchExport").click();
      const batchDownload = await batchDownloadPromise;
      const batchContent = await readFile(await batchDownload.path(), "utf8");
      check(
        (batchContent.match(/TEL;TYPE=CELL:/g) || []).length === 2,
        "batch TEL count",
      );
      check(
        (batchContent.match(/BEGIN:VCARD/g) || []).length === 1,
        "batch single contact",
      );
      await page
        .getByRole("button", { name: "090-1234-5678を削除", exact: true })
        .click();
      check(
        (await page.locator("#batchCount").innerText()) === "1件",
        "delete row",
      );
      check(
        await page
          .getByRole("button", { name: "03-1234-5678を削除" })
          .evaluate((e) => e === document.activeElement),
        "delete keeps focus",
      );
      page.once("dialog", (dialog) => dialog.dismiss());
      await page.locator("#batchClear").click();
      check(
        (await page.locator("#batchCount").innerText()) === "1件",
        "cancel clear",
      );
      page.once("dialog", (dialog) => dialog.accept());
      await page.locator("#batchClear").click();
      check(
        (await page.locator("#batchCount").innerText()) === "0件",
        "confirm clear",
      );
      await page.locator("#batchInput").fill("09012345678");
      await page.locator("#batchAdd").click();
      await page.reload();
      await page.waitForFunction(
        () => !document.getElementById("batchAdd").disabled,
      );
      await page.getByRole("button", { name: "一括登録", exact: true }).click();
      check(
        (await page.locator("#batchCount").innerText()) === "0件",
        "reload clears list",
      );
      await page.evaluate(() =>
        localStorage.setItem(
          "spam-blocker-numbers",
          JSON.stringify(["09012345678", "<img src=x>"]),
        ),
      );
      await page.reload();
      await page.waitForFunction(
        () => !document.getElementById("batchAdd").disabled,
      );
      await page.getByRole("button", { name: "一括登録", exact: true }).click();
      check(
        (await page.locator("#batchCount").innerText()) === "0件",
        "legacy list never auto-imported",
      );
      await page
        .getByRole("button", { name: "使い方・設定", exact: true })
        .click();
      check(
        (await page.locator("details").count()) === 7,
        "help retained and grouped",
      );
      check(
        (await page.locator("details[open]").count()) === 0,
        "help collapsed",
      );
      await page.getByText("番号の確認・プライバシー", { exact: true }).click();
      page.once("dialog", (dialog) => dialog.accept());
      await page.locator("#legacyClear").click();
      check(
        (await page.evaluate(() =>
          localStorage.getItem("spam-blocker-numbers"),
        )) === null,
        "legacy delete",
      );
      // All widths cover all views. Layout measurements use actual browser layout.
      for (const [width, height] of [
        [320, 568],
        [375, 667],
        [390, 844],
        [667, 375],
        [1280, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page
          .getByRole("button", { name: "Quick Block", exact: true })
          .click();
        await page.locator("#quickInput").fill("+123456789012345");
        await page.screenshot({
          path: `${evidence}/${engine}-${width}x${height}-quick.png`,
          fullPage: true,
        });
        for (const view of ["quick", "batch", "help"]) {
          await page.locator(`[data-view="${view}"]`).click();
          if (view === "help")
            await page
              .locator("details")
              .evaluateAll((es) => es.forEach((e) => (e.open = true)));
          check(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${engine} ${width} ${view} overflow`,
          );
          const small = await page
            .locator(
              "button:visible, input:visible, textarea:visible, summary:visible",
            )
            .evaluateAll((es) =>
              es
                .filter((e) => e.getBoundingClientRect().height < 44)
                .map((e) => e.id || e.textContent),
            );
          check(small.length === 0, `touch targets ${JSON.stringify(small)}`);
          const tinyInputs = await page
            .locator("input:visible,textarea:visible")
            .evaluateAll((es) =>
              es.some((e) => parseFloat(getComputedStyle(e).fontSize) < 16),
            );
          check(!tinyInputs, "no input autozoom");
        }
      }
      await page
        .getByRole("button", { name: "Quick Block", exact: true })
        .click();
      await page.locator("#quickInput").focus();
      await page.keyboard.press("Tab");
      check(
        await page
          .locator("#quickPaste")
          .evaluate((e) => e === document.activeElement),
        "keyboard tab order",
      );
      check(errors.length === 0, JSON.stringify(errors));
      check(
        outbound.length === 0,
        "no third-party requests: " + JSON.stringify(outbound),
      );
      await context.close();
      console.log(
        `PASS ${engine}: URL, clipboard, VCF downloads, batch, storage, keyboard, 5 viewport layouts`,
      );
    } finally {
      await browser.close();
    }
  }
  console.log(`PASS ${checks} browser assertions`);
} finally {
  server.close();
}
