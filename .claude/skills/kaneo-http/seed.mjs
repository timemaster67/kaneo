// Seed Kaneo over its HTTP API from a JSON spec. Node 18+ (global fetch), no deps.
// Usage: node seed.mjs spec.json          -> create (re-uses project/labels/tasks that already exist by name/title)
//        node seed.mjs spec.json --verify -> read back only
// Spec shape (see SKILL.md): { workspace, project:{name,slug,icon?,description?}, labels:[{name,color}],
//   tasks:[{key,title,status,priority?,startDate?,dueDate?,description?,labels?:[name]}],
//   subtasks:[[parentKey,childKey]], relations:[[sourceKey,"blocks"|"related",targetKey]] }
import fs from "node:fs";

const KEY_FILE = process.env.KANEO_KEY_FILE || "~/kaneo/.claude/kaneo-api-key.txt";
const BASE = process.env.KANEO_API || "http://localhost:5173/api";
const KEY = fs.readFileSync(KEY_FILE, "utf8").trim();
const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const verifyOnly = process.argv.includes("--verify");
let calls = 0, failures = 0;

// API keys are limited to 100 requests per 60 s window. Over the limit, every route answers
// 429 {"code":"RATE_LIMITED"} with a Retry-After header (seconds). Retry after that; a 401 is a real auth error.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, path, body, attempt = 0) {
  calls++;
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (r.status === 429 && attempt < 6) {
    failures++;
    const wait = (Number(r.headers.get("retry-after")) || 15) * 1000 + 500;
    console.error(`rate limited on ${method} ${path}; waiting ${Math.round(wait / 1000)}s`);
    await sleep(wait);
    return api(method, path, body, attempt + 1);
  }
  if (!r.ok) { failures++; throw new Error(`${method} ${path} -> ${r.status} ${t.slice(0, 300)}`); }
  return t ? JSON.parse(t) : null;
}
// "YYYY-MM-DD" -> local midnight as ISO (run with TZ set if the machine zone differs)
const day = (d) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined);
const localDay = (iso) => {
  if (!iso) return "";
  const x = new Date(iso);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

// --- workspace + project
const orgs = await api("GET", "/auth/organization/list");
const ws = orgs.find((o) => o.id === spec.workspace || o.name === spec.workspace);
if (!ws) throw new Error(`workspace ${spec.workspace} not found: ${orgs.map((o) => o.name)}`);
const projects = await api("GET", `/project?workspaceId=${ws.id}`);
let project = projects.find((p) => p.name === spec.project.name);
if (!project && !verifyOnly) {
  const { name, slug, icon = "Layout", description } = spec.project;
  project = await api("POST", "/project", { name, slug, icon, workspaceId: ws.id });
  if (description) project = await api("PUT", `/project/${project.id}`, { name, slug, icon, description, isPublic: false });
}
if (!project) throw new Error("project not found");

// --- labels (workspace-level)
const labelsByName = {};
// attaching a label copies it into a per-task row (taskId set); the definitions are the taskId=null rows
for (const l of await api("GET", `/label/workspace/${ws.id}`)) if (!l.taskId) labelsByName[l.name] = l;
if (!verifyOnly)
  for (const l of spec.labels || [])
    if (!labelsByName[l.name]) labelsByName[l.name] = await api("POST", "/label", { name: l.name, color: l.color, workspaceId: ws.id });

// --- tasks: list existing (board view nests tasks under columns)
async function listTasks() {
  const out = []; // limit max is 100; paginate
  for (let page = 1; ; page++) {
    const res = await api("GET", `/task/tasks/${project.id}?limit=100&page=${page}`);
    out.push(...res.data.columns.flatMap((c) => c.tasks || []), ...(res.data.archivedTasks || []), ...(res.data.plannedTasks || []));
    if (page >= (res.pagination?.totalPages || 1)) return out;
  }
}
const existing = Object.fromEntries((await listTasks()).map((t) => [t.title, t]));
const ids = {};
for (const t of spec.tasks) {
  if (existing[t.title]) { ids[t.key] = existing[t.title].id; continue; }
  if (verifyOnly) continue;
  const created = await api("POST", `/task/${project.id}`, {
    title: t.title,
    description: t.description ?? "",
    status: t.status,
    priority: t.priority || "no-priority",
    startDate: day(t.startDate),
    dueDate: day(t.dueDate),
  });
  ids[t.key] = created.id;
}

if (!verifyOnly) {
  // --- labels: one bulk call per label
  for (const l of spec.labels || []) {
    const taskIds = spec.tasks.filter((t) => (t.labels || []).includes(l.name)).map((t) => ids[t.key]);
    // board rows already carry labels, so only pre-existing tasks can have it
    const has = (id) => Object.values(existing).some((e) => e.id === id && (e.labels || []).some((x) => x.name === l.name));
    const todo = taskIds.filter((id) => !has(id));
    if (todo.length) await api("PATCH", "/task/bulk", { taskIds: todo, operation: "addLabel", value: labelsByName[l.name].id });
  }
  // --- relations: subtask = source parent -> target child
  const rels = [...(spec.subtasks || []).map(([p, c]) => [p, "subtask", c]), ...(spec.relations || [])];
  const seen = new Set();
  const old = new Set(Object.values(existing).map((e) => e.id)); // only pre-existing tasks can have relations
  for (const id of new Set(rels.map((r) => ids[r[0]]).filter((id) => old.has(id))))
    for (const x of await api("GET", `/task-relation/${id}`)) seen.add(`${x.sourceTaskId}|${x.relationType}|${x.targetTaskId}`);
  for (const [s, type, t] of rels) {
    if (seen.has(`${ids[s]}|${type}|${ids[t]}`)) continue;
    await api("POST", "/task-relation", { sourceTaskId: ids[s], targetTaskId: ids[t], relationType: type });
  }
}

// --- read-back
const keyOf = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
const tasks = await listTasks();
const relSet = new Set();
let problems = 0;
console.log(`project ${project.name} ${project.id} (${project.slug}) desc=${JSON.stringify(project.description)}`);
for (const st of spec.tasks) {
  const t = tasks.find((x) => x.id === ids[st.key]);
  if (!t) { console.log(`MISSING ${st.key} ${st.title}`); problems++; continue; }
  const labels = (t.labels || []).map((l) => l.name).sort();
  for (const r of await api("GET", `/task-relation/${t.id}`)) relSet.add(`${keyOf[r.sourceTaskId] || r.sourceTaskId} ${r.relationType} ${keyOf[r.targetTaskId] || r.targetTaskId}`);
  const got = [t.status, t.priority, localDay(t.startDate), localDay(t.dueDate), labels.join(",")];
  const want = [st.status, st.priority || "no-priority", st.startDate || "", st.dueDate || "", [...(st.labels || [])].sort().join(",")];
  const ok = JSON.stringify(got) === JSON.stringify(want) && (st.description === undefined || t.description === st.description);
  if (!ok) problems++;
  console.log(`${ok ? "ok " : "BAD"} ${st.key.padEnd(5)} #${t.number} ${got.join(" | ")}${ok ? "" : `   want ${want.join(" | ")} desc=${JSON.stringify(t.description)}`}`);
}
const wantRels = [...(spec.subtasks || []).map(([p, c]) => `${p} subtask ${c}`), ...(spec.relations || []).map((r) => r.join(" "))];
for (const r of wantRels) if (!relSet.has(r)) { console.log(`MISSING relation ${r}`); problems++; }
for (const r of relSet) if (!wantRels.includes(r)) console.log(`extra relation ${r}`);
console.log(`relations found ${relSet.size}/${wantRels.length}; problems ${problems}; HTTP calls ${calls}; failed ${failures}`);
