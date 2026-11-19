---
name: kaneo-http
description: Create, change or read Kaneo data (workspaces, projects, columns, tasks, labels, subtasks, blocks/related links) and attach files to tasks through Kaneo's HTTP API with curl or Node, without the kaneo MCP server. Use when seeding or bulk-editing Kaneo from a spec or script, when attaching a file to a task (the MCP server cannot upload), or when the MCP tools are unavailable. Verified on Kaneo 2.46.2.
---

# Kaneo over HTTP

- Base: `http://localhost:5173/api`. Auth: `Authorization: Bearer <key>`, key in `~/kaneo\.claude\kaneo-api-key.txt`. Read it in the command, never print it: `K=$(tr -d '\r\n' < ~/kaneo/.claude/kaneo-api-key.txt)`.
- Full OpenAPI 3.1: `GET /api/openapi` (244 KB). Don't read it into context; save it and query it with a small Node script if you need an endpoint not listed here.
- Kaneo holds real data. Touch only what your task owns.

## Fast path: seed from a JSON spec

`node .claude/skills/kaneo-http/seed.mjs spec.json` creates everything, then prints a read-back table checked against the spec (`ok`/`BAD`, missing relations, problem count). `--verify` only reads. Safe to re-run: it reuses the project by name, labels by name, tasks by title, and skips existing labels and relations. Copy `example-spec.json` (same folder) as a template: 9 tasks, 3 labels, 6 subtasks, 5 relations, roughly 43 requests on a fresh project (counted from the script's code path, not measured). Dates are `YYYY-MM-DD`, converted to local midnight.

## Attach a file to a task

`node .claude/skills/kaneo-http/attach.mjs <TES-4 | taskId> <file> [--comment "text"]`

- No `--comment`: the link is appended to the description. With `--comment`: a new comment holds the text, a blank line and the link. Images show inline; other files show as attachment cards and download when opened (Kaneo serves only images inline, not configurable).
- Prints `task  filename  size  surface  asset-url`; exits 1 with a one-line reason on failure. Unit tests: `node --test .claude/skills/kaneo-http/attach.test.mjs`.
- By hand: `PUT /task/image-upload/{taskId}` `{filename, contentType, size, surface}` (`surface` = `description` or `comment`) gives `{key, uploadUrl, headers}`. `PUT` the bytes to `uploadUrl` with `headers`. `POST /task/image-upload/{taskId}/finalize` with the same fields plus `key` gives `{id, url}`. Then link `url`: `![alt](url)` for images, otherwise `<kaneo-attachment url="…" filename="…" mime-type="…" size="…" />` (HTML-escaped values).

## Endpoints (verified)

| What | Call | Body / notes |
|---|---|---|
| Workspaces | `GET /auth/organization/list` or `GET /workspace` | `[{id,name,slug}]`. Workspace = better-auth organization |
| Projects | `GET /project?workspaceId=W` | array |
| Create project | `POST /project` | `{name, workspaceId, icon, slug}`, all required (`icon` is a lucide name, e.g. `"Layout"`). `slug` becomes the task prefix. No description field |
| Project description | `PUT /project/{id}` | `{name, icon, slug, description, isPublic}`, all required |
| Columns | `GET /column/{projectId}` | new project: `to-do`, `in-progress`, `in-review`, `done` (isFinal). Task `status` = column **slug** |
| Create task | `POST /task/{projectId}` | `{title, description, status, priority, startDate?, dueDate?, userId?}`. `description` and `priority` required (`no-priority/low/medium/high/urgent`). Dates are ISO datetimes, e.g. `new Date('2026-10-05T00:00:00').toISOString()`; read back as UTC (`2026-10-05T04:00:00.000Z`) |
| List tasks (read-back) | `GET /task/tasks/{projectId}?limit=100&page=N` | `limit` max **100** (400 above). Tasks are nested: `data.columns[].tasks[]` (+ `data.archivedTasks`, `data.plannedTasks`); `pagination.totalPages`. Each task has `status, priority, startDate, dueDate, number, description, labels[{id,name,color}], subtaskCounts{completed,total}` |
| Workspace labels | `GET /label/workspace/{W}` | includes per-task copies, see gotchas |
| Create label | `POST /label` | `{name, color, workspaceId}`. Colors are hex; UI palette: blue `#3b82f6`, green `#10b981`, red `#ef4444`, yellow `#f59e0b`, purple `#8b5cf6`, gray `#6b7280` |
| Attach a label to many tasks | `PATCH /task/bulk` | `{taskIds:[...], operation:"addLabel", value:<label id>}` gives `{success, updatedCount}`. One call per label. Other operations: `updateStatus/updatePriority/updateAssignee/updateDueDate/removeLabel/delete` (not tested) |
| Relation | `POST /task-relation` | `{sourceTaskId, targetTaskId, relationType}` with `subtask` (source = **parent**, target = child; the parent's `subtaskCounts.total` goes up), `blocks` (source blocks target) or `related` |
| Read relations | `GET /task-relation/{taskId}` | `[{id, sourceTaskId, targetTaskId, relationType}]`. Not in the board listing: query each task and dedupe |
| Task by ticket | `GET /task/by-ticket-id/{TICKET-N}` | e.g. `TES-4`; returns the task with `id` |
| Read description | `GET /task/{id}/description?offset=N&version=V` | `{content, version, nextOffset}`; pages of 32,768 characters; pass `version` from page 1 on later pages |
| Replace description | `PUT /task/description/{id}` | `{description}` (Markdown) |
| Comment | `POST /comment/{taskId}` | `{content}`, max 10,000 characters |
| Download a file | `GET /asset/{id}` | needs the key or a session (401 without); non-image files come back as `application/octet-stream` |
| Attach one label | `PUT /label/{id}/task` | `{taskId}` |
| Import tasks | `POST /task/import/{projectId}` | `{tasks:[{title,status,priority?,startDate?,dueDate?,description?}]}`; no labels or relations |

Untested but present: `PUT /task/{id}` (full update; needs title, priority, status, projectId, position).

## Gotchas

- **Rate limit: 100 requests per 60 s window per API key.** Over it, every route answers `429 {"code":"RATE_LIMITED"}` with a `Retry-After` header in seconds (also `X-RateLimit-Limit/Remaining/Reset`). `seed.mjs` and `attach.mjs` wait for `Retry-After` and retry. A `401` means a missing or bad key. Avoid per-task GETs: the board listing already carries labels.
- Attaching a label creates a **per-task copy** of the label row (`taskId` set, new id), and `GET /label/workspace` returns those copies too. Take label definitions from the rows where `taskId == null`, and match task labels by name, not id.
- Only `/api/openapi` exists. `/openapi.json`, `/docs` and `/swagger` all return 404.
- On Windows Git Bash, multi-line `node -e "..."` printed nothing. Write the script to a file instead.
- Kaneo deletes an uploaded file that no description, comment or activity links to. Always link the asset URL after finalize (`attach.mjs` does).
- Uploads: max 10 MiB per file; the upload URL expires after 300 s; finalize compares the stored size and content type with what you declared, so send the same `contentType` to all three calls.
- The upload URL points at `http://localhost:5174` (Silo). On a remote machine the SSH tunnel must also forward 5174 (`-R 5174:127.0.0.1:5174`), or the PUT fails while every other call works.
- Saving a description in the web editor rewrites attachment tags with an empty `mime-type`. The file still downloads; only the card's type label goes.
