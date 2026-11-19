// Unit tests for attach.mjs helpers. Run: node --test .claude/skills/kaneo-http/attach.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_UPLOAD_BYTES, COMMENT_TEXT_MAX, parseArgs, contentTypeFor, isInlineImage, escapeAttr,
  altText, buildReference, appendBlock, checkSize, isTicketId, readFullDescription,
} from "./attach.mjs";

const URL_ = "http://localhost:5173/api/asset/abc123";

test("parseArgs: task and file", () => {
  assert.deepEqual(parseArgs(["TES-4", "a.pdf"]), { task: "TES-4", file: "a.pdf", comment: undefined });
});
test("parseArgs: --comment before or after", () => {
  assert.deepEqual(parseArgs(["TES-4", "a.pdf", "--comment", "hi"]), { task: "TES-4", file: "a.pdf", comment: "hi" });
  assert.deepEqual(parseArgs(["--comment", "", "TES-4", "a.pdf"]), { task: "TES-4", file: "a.pdf", comment: "" });
});
test("parseArgs: errors", () => {
  assert.throws(() => parseArgs(["TES-4"]), /^Error: Usage:/);
  assert.throws(() => parseArgs(["TES-4", "a.pdf", "--comment"]), /^Error: Usage:/);
  assert.throws(() => parseArgs(["TES-4", "a.pdf", "extra"]), /^Error: Usage:/);
  assert.throws(() => parseArgs(["TES-4", "a.pdf", "--comment", "x".repeat(COMMENT_TEXT_MAX + 1)]), /9000 characters/);
});

test("contentTypeFor: known, upper-case, unknown, none", () => {
  assert.equal(contentTypeFor("scan.PNG"), "image/png");
  assert.equal(contentTypeFor("photo.jpeg"), "image/jpeg");
  assert.equal(contentTypeFor("Devis final & co (é) 'v2'.pdf"), "application/pdf");
  assert.equal(contentTypeFor("sheet.xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(contentTypeFor("plan.dwg"), "application/octet-stream");
  assert.equal(contentTypeFor("notes"), "application/octet-stream");
});
test("isInlineImage follows Kaneo's list", () => {
  assert.equal(isInlineImage("image/png"), true);
  assert.equal(isInlineImage("IMAGE/WEBP"), true);
  assert.equal(isInlineImage("image/svg+xml"), false);
  assert.equal(isInlineImage("application/pdf"), false);
});

test("escapeAttr escapes HTML attribute characters", () => {
  assert.equal(escapeAttr(`a & b "c" 'd' <e>`), "a &amp; b &quot;c&quot; &#39;d&#39; &lt;e&gt;");
});
test("altText strips the extension, separators and brackets", () => {
  assert.equal(altText("my_screen-shot.png"), "my screen shot");
  assert.equal(altText("a[1].png"), "a1");
  assert.equal(altText(".png"), "image");
});

test("buildReference: image is a Markdown image", () => {
  assert.equal(
    buildReference({ url: URL_, filename: "my_screen-shot.png", contentType: "image/png", size: 10 }),
    `![my screen shot](${URL_})`,
  );
});
test("buildReference: other files are a kaneo-attachment tag", () => {
  assert.equal(
    buildReference({ url: URL_, filename: "Devis final & co (é) 'v2'.pdf", contentType: "application/pdf", size: 1234 }),
    `<kaneo-attachment url="${URL_}" filename="Devis final &amp; co (é) &#39;v2&#39;.pdf" mime-type="application/pdf" size="1234" />`,
  );
  assert.match(buildReference({ url: URL_, filename: "logo.svg", contentType: "image/svg+xml", size: 5 }), /^<kaneo-attachment /);
});

test("appendBlock: empty, whitespace-ended and normal descriptions", () => {
  assert.equal(appendBlock(null, "X"), "X\n");
  assert.equal(appendBlock("", "X"), "X\n");
  assert.equal(appendBlock("  \n", "X"), "X\n");
  assert.equal(appendBlock("Hello\n\n\n", "X"), "Hello\n\nX\n");
  assert.equal(appendBlock("Hello", "X"), "Hello\n\nX\n");
});

test("checkSize: 0 refused, exactly 10 MiB allowed, one byte over refused", () => {
  assert.throws(() => checkSize(0), /empty/);
  assert.doesNotThrow(() => checkSize(MAX_UPLOAD_BYTES));
  assert.throws(() => checkSize(MAX_UPLOAD_BYTES + 1), /10 MiB/);
});

test("isTicketId", () => {
  assert.equal(isTicketId("TES-4"), true);
  assert.equal(isTicketId("MTRI-42"), true);
  assert.equal(isTicketId("ep1u38g587kzctbfu8q60dbl"), false);
  assert.equal(isTicketId("TES-"), false);
});

test("readFullDescription joins pages and pins the version", async () => {
  const calls = [];
  const pages = [
    { content: "a".repeat(32768), version: "77", nextOffset: 32768 },
    { content: "b", version: "77", nextOffset: null },
  ];
  const api = async (method, path) => { calls.push(`${method} ${path}`); return pages[calls.length - 1]; };
  const text = await readFullDescription(api, "task1");
  assert.equal(text, "a".repeat(32768) + "b");
  assert.deepEqual(calls, [
    "GET /task/task1/description?offset=0",
    "GET /task/task1/description?offset=32768&version=77",
  ]);
});
test("readFullDescription: empty description", async () => {
  const api = async () => ({ content: "", version: "5", nextOffset: null });
  assert.equal(await readFullDescription(api, "t"), "");
});
