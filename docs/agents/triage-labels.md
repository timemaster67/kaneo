# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker (Kaneo workspace "Work").

| Label in mattpocock/skills | Label in our tracker | Workspace label ID          | Meaning                                  |
| -------------------------- | -------------------- | --------------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | `a7gc7wk4nj6as7yt2c6kzlhv` | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | `nxws9m8cor2elifpzyx48def` | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | `yinbf6t7da8md5x30sp80vzb` | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | `kq4r6afhptndsab38h2legez` | Requires human implementation            |
| `wontfix`                  | `wont-fix`           | `hllh4ucy61pp8ymj9xirqplo` | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table. A task should carry at most one triage label: detach the old one when moving to a new state. For `wont-fix`, also move the task to `done` with a comment explaining why.

The workspace label IDs are the ones to pass to `attach_label_to_task`. If one is rejected, refresh them with `list_workspace_labels` (rows with `taskId: null`).

## Optional categorization labels

Not part of the triage state machine; apply when the kind of work is obvious.

- `type:bug`, `type:feature`, `type:enhancement`, `type:chore`, `type:docs`, `type:task`
- `security`, `dependencies`

Edit the right-hand columns to match whatever vocabulary you actually use.
