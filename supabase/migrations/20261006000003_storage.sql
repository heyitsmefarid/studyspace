-- supabase/migrations/20261006000003_storage.sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', false, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('note-files', 'note-files', false, 10485760, null),
  ('card-images', 'card-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('chat-files', 'chat-files', false, 10485760, null),
  ('market-images', 'market-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "ss own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'note-files', 'card-images', 'chat-files', 'market-images')
              and (storage.foldername(name))[1] = (select auth.uid())::text and private.is_member());
create policy "ss own folder update" on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'note-files', 'card-images', 'chat-files', 'market-images')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "ss own folder delete" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'note-files', 'card-images', 'chat-files', 'market-images')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "ss member read" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'chat-files', 'market-images') and private.is_member());
create policy "ss note files read" on storage.objects for select to authenticated
  using (bucket_id = 'note-files' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.note_attachments a where a.storage_path = name and private.can_view_note(a.note_id))));
create policy "ss card images read" on storage.objects for select to authenticated
  using (bucket_id = 'card-images' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or private.can_view_deck(private.deck_from_path(name))));
