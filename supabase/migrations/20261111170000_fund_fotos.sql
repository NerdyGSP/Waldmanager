-- Paket 3: privater Speicher für Fund-Fotos. Pfad: <betrieb_id>/<fund_id>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fund-fotos', 'fund-fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Erster Pfadteil ist die Betriebs-ID; ungültige Pfade ergeben keinen Zugriff
create function private.fotopfad_betrieb(p_name text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end $$;

grant execute on function private.fotopfad_betrieb(text) to authenticated;

-- Mitglieder sehen und laden Fotos ihres Betriebs hoch; ersetzen und löschen dürfen Inhaber und der Hochlader
create policy fund_fotos_lesen on storage.objects for select to authenticated
  using (bucket_id = 'fund-fotos' and private.ist_mitglied(private.fotopfad_betrieb(name)));
create policy fund_fotos_hochladen on storage.objects for insert to authenticated
  with check (bucket_id = 'fund-fotos' and private.ist_mitglied(private.fotopfad_betrieb(name)));
create policy fund_fotos_ersetzen on storage.objects for update to authenticated
  using (bucket_id = 'fund-fotos' and (private.ist_inhaber(private.fotopfad_betrieb(name)) or owner_id = (select auth.uid())::text))
  with check (bucket_id = 'fund-fotos' and private.ist_mitglied(private.fotopfad_betrieb(name)));
create policy fund_fotos_loeschen on storage.objects for delete to authenticated
  using (bucket_id = 'fund-fotos' and (private.ist_inhaber(private.fotopfad_betrieb(name)) or owner_id = (select auth.uid())::text));
