-- Posting rule: trusted members' posts can go live right away; group posts need membership in that group.
-- Replaces "post threads for review" (pending only, any group).
drop policy if exists "post threads for review" on public.threads;
drop policy if exists "post threads" on public.threads;
create policy "post threads" on public.threads for insert to authenticated
  with check (
    author_id = auth.uid()
    and reviewed_at is null and reviewed_by is null
    and (status = 'pending' or (status = 'approved' and private.is_trusted_poster(auth.uid())))
    and (group_id is null or exists (
      select 1 from public.group_members gm where gm.group_id = threads.group_id and gm.user_id = auth.uid()))
  );
