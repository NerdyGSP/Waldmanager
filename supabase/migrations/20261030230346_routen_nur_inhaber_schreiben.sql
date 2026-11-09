drop policy pirschwege_insert on public.pirschwege;
drop policy pirschwege_update on public.pirschwege;
drop policy pirschwege_delete on public.pirschwege;
create policy pirschwege_insert on public.pirschwege for insert to authenticated with check (private.ist_inhaber(revier_id));
create policy pirschwege_update on public.pirschwege for update to authenticated using (private.ist_inhaber(revier_id)) with check (private.ist_inhaber(revier_id));
create policy pirschwege_delete on public.pirschwege for delete to authenticated using (private.ist_inhaber(revier_id));
