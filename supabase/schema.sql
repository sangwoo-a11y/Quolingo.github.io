-- Run once in your Supabase project's SQL Editor. No journals are public.
create table if not exists public.quolingo_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now()
);
alter table public.quolingo_state enable row level security;
alter table public.quolingo_state force row level security;
revoke all on public.quolingo_state from anon, authenticated;
grant select on public.quolingo_state to authenticated;
drop policy if exists "Read own Quolingo records" on public.quolingo_state;
create policy "Read own Quolingo records" on public.quolingo_state
  for select to authenticated using ((select auth.uid()) = user_id);

-- Atomic compare-and-swap prevents one device from silently overwriting another.
-- The owner always comes from the verified JWT, never a browser-supplied user ID.
drop function if exists public.save_quolingo_state(bigint, jsonb);
create or replace function public.save_quolingo_state(p_user_id uuid, p_expected_revision bigint, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := auth.uid();
  next_revision bigint;
begin
  if owner is null then raise exception 'Authentication required'; end if;
  if p_user_id is distinct from owner then raise exception 'Account changed'; end if;
  if p_expected_revision < 0 or p_expected_revision is null or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'Invalid state';
  end if;
  if p_expected_revision = 0 then
    insert into public.quolingo_state(user_id, payload, revision)
    values (owner, p_payload, 1)
    on conflict (user_id) do nothing
    returning revision into next_revision;
  else
    update public.quolingo_state
    set payload = p_payload, revision = revision + 1, updated_at = now()
    where user_id = owner and revision = p_expected_revision
    returning revision into next_revision;
  end if;
  return jsonb_build_object('saved', next_revision is not null, 'revision', next_revision);
end;
$$;
revoke all on function public.save_quolingo_state(uuid, bigint, jsonb) from public, anon;
grant execute on function public.save_quolingo_state(uuid, bigint, jsonb) to authenticated;
