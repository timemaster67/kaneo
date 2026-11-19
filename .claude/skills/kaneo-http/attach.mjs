// Attach a file to a Kaneo task over the HTTP API. Node 18+ (global fetch), no deps.
// Usage: node attach.mjs <taskId | TICKET-N> <file> [--comment "text"]
//   no --comment -> the link is appended to the task description; --comment -> a new comment holds the text and the link.
// Flow: PUT /task/image-upload/{id} -> PUT bytes to the presigned URL (Silo, localhost:5174) -> POST .../finalize -> link it.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // Kaneo's default S3_MAX_IMAGE_UPLOAD_BYTES
export const COMMENT_TEXT_MAX = 9000; // Kaneo comments max 10,000 chars; leave room for the reference

const USAGE = 'Usage: node attach.mjs <taskId | TICKET-N> <file> [--comment "text"]';

// Kaneo shows these inline (apps/api/src/storage/s3.ts); anything else becomes an attachment card.
const INLINE_IMAGE_TYPES = new Set([
  "image/apng", "image/avif", "image/gif", "image/heic", "image/heif",
  "image/jpeg", "image/jpg", "image/png", "image/webp",
]);

const TYPES = {
  ".apng": "image/apng", ".avif": "image/avif", ".gif": "image/gif", ".heic": "image/heic", ".heif": "image/heif",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".bmp": "image/bmp", ".tif": "image/tiff", ".tiff": "image/tiff",
  ".pdf": "application/pdf", ".txt": "text/plain", ".log": "text/plain", ".md": "text/markdown",
  ".csv": "text/csv", ".json": "application/json", ".xml": "application/xml", ".html": "text/html",
  ".zip": "application/zip", ".7z": "application/x-7z-compressed", ".gz": "application/gzip",
  ".doc": "application/msword", ".xls": "application/vnd.ms-excel", ".ppt": "application/vnd.ms-powerpoint",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".msg": "application/vnd.ms-outlook", ".eml": "message/rfc822",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".mp3": "audio/mpeg", ".wav": "audio/wav",
};

export function parseArgs(argv) {
  const rest = [];
  let comment;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--comment") {
      if (i + 1 >= argv.length) throw new Error(USAGE);
      comment = argv[++i];
    } else rest.push(argv[i]);
  }
  if (rest.length !== 2) throw new Error(USAGE);
  if (comment !== undefined && comment.length > COMMENT_TEXT_MAX)
    throw new Error(`Comment text is limited to ${COMMENT_TEXT_MAX} characters.`);
  return { task: rest[0], file: rest[1], comment };
}

export function contentTypeFor(filename) {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return "application/octet-stream";
  return TYPES[filename.slice(dot).toLowerCase()] || "application/octet-stream";
}

export const isInlineImage = (contentType) => INLINE_IMAGE_TYPES.has(contentType.toLowerCase());

export const escapeAttr = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Same rule as the web editor's getImageAltText, minus brackets that would break Markdown.
export function altText(filename) {
  const alt = filename.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").replace(/[[\]]/g, "").trim();
  return alt || "image";
}

export function buildReference({ url, filename, contentType, size }) {
  if (isInlineImage(contentType)) return `![${altText(filename)}](${url})`;
  return `<kaneo-attachment url="${escapeAttr(url)}" filename="${escapeAttr(filename)}" mime-type="${escapeAttr(contentType)}" size="${size}" />`;
}

export function appendBlock(existing, block) {
  const base = (existing || "").replace(/\s+$/, "");
  return base ? `${base}\n\n${block}\n` : `${block}\n`;
}

export function checkSize(size) {
  if (!size) throw new Error("The file is empty; Kaneo refuses empty uploads.");
  if (size > MAX_UPLOAD_BYTES) throw new Error(`The file is ${size} bytes; Kaneo's upload limit is 10 MiB (${MAX_UPLOAD_BYTES} bytes).`);
}

export const isTicketId = (value) => /^[A-Za-z][A-Za-z0-9]*-\d+$/.test(value);

// Descriptions over 32,768 characters come back in pages; `version` pins all pages to one revision.
export async function readFullDescription(api, taskId) {
  let offset = 0, version, text = "";
  for (;;) {
    const q = new URLSearchParams({ offset: String(offset) });
    if (version) q.set("version", version);
    const page = await api("GET", `/task/${taskId}/description?${q}`);
    text += page.content;
    version = page.version;
    if (page.nextOffset == null) return text;
    offset = page.nextOffset;
  }
}

const KEY_FILE = process.env.KANEO_KEY_FILE || "~/kaneo/.claude/kaneo-api-key.txt";
const BASE = process.env.KANEO_API || "http://localhost:5173/api";

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Same rate-limit handling as seed.mjs: a 429 waits for its Retry-After header (seconds), then retries.
function makeApi(key) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  return async function api(method, p, body, attempt = 0) {
    const r = await fetch(BASE + p, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const t = await r.text();
    if (r.status === 429 && attempt < 6) {
      const wait = (Number(r.headers.get("retry-after")) || 15) * 1000 + 500;
      console.error(`rate limited on ${method} ${p}; waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      return api(method, p, body, attempt + 1);
    }
    if (!r.ok) throw new ApiError(r.status, `${method} ${p} -> ${r.status} ${t.slice(0, 300)}`);
    return t ? JSON.parse(t) : null;
  };
}

async function main() {
  const { task, file, comment } = parseArgs(process.argv.slice(2));
  const size = fs.statSync(file).size;
  checkSize(size);
  const filename = path.basename(file);
  const contentType = contentTypeFor(filename);
  const surface = comment === undefined ? "description" : "comment";
  const api = makeApi(fs.readFileSync(KEY_FILE, "utf8").trim());

  const t = isTicketId(task)
    ? await api("GET", `/task/by-ticket-id/${encodeURIComponent(task.toUpperCase())}`)
    : await api("GET", `/task/${encodeURIComponent(task)}`);
  const taskId = t.id;

  let up;
  try {
    up = await api("PUT", `/task/image-upload/${taskId}`, { filename, contentType, size, surface });
  } catch (e) {
    if (e.status === 503) throw new Error("Kaneo has no file storage configured. Run scripts\\setup-storage.ps1 and check the S3_* keys in .env.");
    throw e;
  }

  let put;
  try {
    put = await fetch(up.uploadUrl, { method: "PUT", headers: up.headers, body: fs.readFileSync(file) });
  } catch {
    throw new Error(`Cannot reach file storage at ${new URL(up.uploadUrl).origin}. Kaneo's Silo container is stopped, or (remote machine) the SSH tunnel lacks -R 5174:127.0.0.1:5174. Nothing was attached.`);
  }
  if (!put.ok) {
    const code = /<Code>([^<]+)<\/Code>/.exec(await put.text())?.[1] || "no error code";
    throw new Error(`File storage refused the upload: HTTP ${put.status} (${code}). Nothing was attached.`);
  }

  const asset = await api("POST", `/task/image-upload/${taskId}/finalize`, { key: up.key, filename, contentType, size, surface });
  const ref = buildReference({ url: asset.url, filename, contentType, size });

  if (surface === "description") {
    const current = await readFullDescription(api, taskId);
    await api("PUT", `/task/description/${taskId}`, { description: appendBlock(current, ref) });
  } else {
    await api("POST", `/comment/${taskId}`, { content: comment ? `${comment}\n\n${ref}` : ref });
  }
  console.log(`${task}  ${filename}  ${size} B  ${surface}  ${asset.url}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
