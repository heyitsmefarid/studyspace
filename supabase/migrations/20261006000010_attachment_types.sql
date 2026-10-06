-- supabase/migrations/20261006000010_attachment_types.sql
-- Security review follow-up: enforce safe attachment types in Storage itself (not just the client).
-- Script-capable types (HTML, SVG, XML, JavaScript) can never be stored in the file buckets, so an object's
-- real content type can't be dangerous whatever metadata a client writes; the app maps such uploads to
-- application/octet-stream (allowed) and downloads everything except images and PDFs.
update storage.buckets
set allowed_mime_types = array[
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/heic',
  'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
  'application/zip', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'video/mp4',
  'application/octet-stream'
]
where id in ('note-files', 'chat-files');
