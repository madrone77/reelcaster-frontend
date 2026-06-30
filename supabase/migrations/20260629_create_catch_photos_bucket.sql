-- Private Supabase Storage bucket for angler catch photos.
-- Objects are namespaced by user id:  ${auth.uid()}/${uuid}.${ext}
-- Owner-only RLS; the app reads via short-lived signed URLs.
-- (Applied to project pehcvwiwtubzfgahuzuz on 2026-06-29.)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catch-photos',
  'catch-photos',
  false,
  26214400, -- 25 MB
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do nothing;

create policy "catch-photos owner read"
  on storage.objects for select to authenticated
  using (bucket_id = 'catch-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "catch-photos owner insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'catch-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "catch-photos owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'catch-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'catch-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "catch-photos owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'catch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
