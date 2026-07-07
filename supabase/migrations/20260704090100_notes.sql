-- Example entity: notes, scoped to their owner. This is the reference pattern —
-- copy it for every new table (table + RLS here; API route, page, and test
-- elsewhere). A note belongs to one user; RLS proves user A can't touch user B's.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_author_id_idx on public.notes (author_id);

alter table public.notes enable row level security;

-- Table privileges for the API roles. RLS (below) governs WHICH rows they touch;
-- the anon grant stays so the "anon reads nothing" test proves RLS, not a missing grant.
grant select on public.notes to anon;
grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;

-- All four verbs scoped to the owner. `(select auth.uid())` is evaluated once
-- per query (faster than a bare auth.uid() in the policy).
create policy "read own notes"
  on public.notes for select
  using (author_id = (select auth.uid()));

create policy "create own notes"
  on public.notes for insert
  with check (author_id = (select auth.uid()));

create policy "update own notes"
  on public.notes for update
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "delete own notes"
  on public.notes for delete
  using (author_id = (select auth.uid()));

-- Keep updated_at fresh on every update.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();
