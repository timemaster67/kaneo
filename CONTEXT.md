# Kaneo

A self-hosted project manager: workspaces hold projects, projects hold tasks on a board of columns.

## Language

### Attachments

**Attachment**:
A file uploaded into a task's description or a comment, shown inline as a card rather than as an image.
_Avoid_: Asset (the storage record behind it), file upload

**Attachment preview**:
Viewing an attachment's contents inside Kaneo without downloading it, for kinds Kaneo knows how to render (Markdown, plain text).
_Avoid_: Markdown viewer, file viewer

**Previewable attachment**:
An attachment Kaneo can show in an attachment preview, either rendered as Markdown or shown as plain text; every other attachment is downloaded.
_Avoid_: Viewable file, text attachment
