import test from "node:test";
import assert from "node:assert/strict";
import { parsePhone, readLaunch, addBatch } from "../phone.mjs";
import { makeVcf, VCF_MIME } from "../vcf.mjs";
const phone = (raw) => {
  const p = parsePhone(raw);
  assert.equal(p.ok, true, raw);
  return p;
};
test("supported input representations preserve one number", () => {
  for (const raw of [
    "09012345678",
    "090-1234-5678",
    "090 1234 5678",
    "090（1234）5678",
    "TEL: 090-1234-5678",
    "電話 090-1234-5678",
    "電話番号：０９０－１２３４－５６７８",
    "+81 90 1234 5678",
  ]) {
    assert.equal(phone(raw).canonical, "+819012345678");
    assert.equal(phone(raw).display, "090-1234-5678");
  }
});
test("safe formatting, unknown area code stays unsplit", () => {
  for (const [raw, display] of Object.entries({
    "0312345678": "03-1234-5678",
    "0612345678": "06-1234-5678",
    "0421234567": "0421234567",
    "0120123456": "0120-123-456",
    "08001234567": "0800-123-4567",
    "05012345678": "050-1234-5678",
    "+442079460958": "+442079460958",
  }))
    assert.equal(phone(raw).display, display);
});
test("invalid and ambiguous values cannot reach vCard", () => {
  for (const raw of [
    "",
    " ",
    "090",
    "110",
    "9012345678",
    "0901234567",
    "090123456789",
    "01201234567",
    "+8109012345678",
    "+81(0)9012345678",
    "+012345678",
    "+12345",
    "+1234567890123456",
    "09012\n345678",
    "09012345678,08012345678",
    "09012345678 / 08012345678",
    "09012345678 内線1",
    "090<img src=x>",
    "+81\r\nFN:Injected",
    "090(1234)5678)",
    "090((1234))5678",
    "⓪9012345678",
  ])
    assert.equal(parsePhone(raw).ok, false, JSON.stringify(raw));
  assert.throws(() => makeVcf([{ canonical: "+81\r\nFN:Injected" }]));
  assert.throws(() => makeVcf([]));
});
test("URL handles legacy plus, encoded plus, empty, malformed, repeats", () => {
  for (const query of [
    "?num=09012345678",
    "?num=%2B81%2090%201234%205678",
    "?num=+819012345678",
    "?num=TEL%3A+090-1234-5678",
  ])
    assert.equal(phone(readLaunch(query).raw).canonical, "+819012345678");
  assert.equal(readLaunch("?num=").raw, "");
  assert.ok(readLaunch("?num=%ZZ").error);
  assert.ok(readLaunch("?num=09012345678&num=08012345678").error);
});
test("batch deduplicates domestic and international; rejects atomically", () => {
  const first = addBatch([], "09012345678\n+819012345678\r\n03-1234-5678");
  assert.equal(first.numbers.length, 2);
  assert.equal(first.duplicates, 1);
  const second = addBatch(first.numbers, "0612345678\ninvalid");
  assert.deepEqual(second.numbers, first.numbers);
  assert.equal(second.added, 0);
  assert.match(second.errors[0], /2行目/);
  assert.ok(addBatch([], "").errors.length);
  assert.ok(
    addBatch(
      [],
      Array.from(
        { length: 201 },
        (_, i) => "090" + String(i).padStart(8, "0"),
      ).join("\n"),
    ).errors.length,
  );
});
test("single VCF matches legacy identity, MIME, filename and CRLF", () => {
  const vcf = makeVcf([phone("09012345678")]);
  assert.equal(vcf.filename, "spam-09012345678.vcf");
  assert.equal(VCF_MIME, "text/vcard;charset=utf-8");
  assert.equal(
    vcf.content,
    "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:SPAM 090-1234-5678\r\nN:090-1234-5678;SPAM;;;\r\nTEL;TYPE=CELL:+819012345678\r\nNOTE:Spam blocker - ya-jirushi\r\nEND:VCARD\r\n",
  );
  assert.equal(makeVcf([phone("+819012345678")]).filename, vcf.filename);
});
test("batch retains one contact with multiple TEL properties", () => {
  const vcf = makeVcf([phone("09012345678"), phone("0312345678")], true);
  assert.equal(vcf.filename, "spam-blocker.vcf");
  assert.equal(vcf.content.match(/BEGIN:VCARD/g).length, 1);
  assert.equal(vcf.content.match(/TEL;TYPE=CELL:/g).length, 2);
  assert.match(vcf.content, /FN:Spam Blocker\r\nN:Blocker;Spam;;;/);
  assert.equal(vcf.content.replace(/\r\n/g, "").includes("\n"), false);
  for (const line of vcf.content.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
});
