-- Entorno de desarrollo de Enseñanza Digna.
-- Reduce permisos de Data API y habilita recibos de lectura solo para personas autorizadas.

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all tables in schema public from authenticated;

grant usage on schema public to authenticated;

grant select on table
  public.schools,
  public.school_memberships,
  public.students,
  public.guardian_students,
  public.conversations,
  public.conversation_members
to authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert on table public.messages to authenticated;
grant select, insert, update on table public.message_reads to authenticated;
grant select, update on table public.notifications to authenticated;
grant select on table public.audit_events to authenticated;

drop policy if exists message_reads_select_self on public.message_reads;

create policy message_reads_select_authorized
on public.message_reads
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.messages m
    where m.id = message_reads.message_id
      and m.sender_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.messages m
    where m.id = message_reads.message_id
      and private.has_school_role(
        m.school_id,
        array['owner','director','admin']::text[]
      )
  )
);

create policy message_reads_update_self
on public.message_reads
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
