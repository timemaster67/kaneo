# Issue tracker: Kaneo

Issues and PRDs for this repo live as tasks in a Kaneo project. Use the `kaneo` MCP tools for all operations. No `gh` CLI is involved.

- **Workspace**: Work — `9zZh1e94cpUb39k4RVuET89qG169Qz3P`
- **Project**: Kaneo, key `KAN` — `fefw6ckq3p1qah0ru5d40bqd`
- **Ticket IDs**: `KAN-<number>` (e.g. `KAN-12`)
- **Columns (status slugs)**: `to-do` → `in-progress` → `in-review` → `done` (final). Re-check with `list_project_columns` if a status is rejected.

## Conventions

- **Create an issue**: `create_task` with `projectId`, `title`, `description` (markdown), `priority` (`no-priority` unless known), `status: "to-do"`. Then attach labels.
- **Read an issue**: `get_task_by_ticket_id` with `ticketId: "KAN-<n>"` and `projectId`. Fetch the discussion with `list_task_comments` and history with `list_task_activity` if needed.
- **List issues**: `list_tasks` with `projectId`, optionally `status`. It is paginated (50 per page, max 100); follow `pagination.totalPages`, and `relatedPage` through `pagination.relatedTotalPages` for complete labels. Filter by label client-side.
- **Search**: `search` for free-text lookups across the workspace.
- **Comment on an issue**: `create_task_comment` with `taskId` and `content`.
- **Apply a label**: `attach_label_to_task` with `taskId` and the **workspace label's** ID (the label row with `taskId: null` from `list_workspace_labels`; IDs are in `triage-labels.md`). Never create a duplicate label with `create_label` when one with that name exists.
- **Remove a label**: `detach_label_from_task` with the **task's own label ID**. Kaneo copies a label onto each task it is attached to, so read the task (or `list_workspace_labels` and match `taskId`) to find that ID; the workspace label ID will not work.
- **Close**: `update_task_status` to `done`, with a closing comment explaining why.
- **Sub-issues and dependencies**: `create_task_relation` — `subtask` (source = parent PRD, target = child), `blocks` (source blocks target), or `related`.
- **Attach files**: the MCP server cannot upload; use the `kaneo-http` skill.

## When a skill says "publish to the issue tracker"

Create a task in project `KAN` with status `to-do`, apply the relevant triage label (and a `type:*` label if obvious), and report the resulting `KAN-<n>` ticket ID.

## When a skill says "fetch the relevant ticket"

Call `get_task_by_ticket_id` with the `KAN-<n>` ID, then `list_task_comments` for its discussion.
