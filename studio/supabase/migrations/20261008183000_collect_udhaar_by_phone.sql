-- A client pays off udhaar in one go, even if it built up over several visits:
-- the money settles her oldest udhaar first. All or nothing.
create or replace function public.collect_udhaar_for_phone(p_phone text, p_amount integer, p_mode text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_owed integer;
  v_left integer := p_amount;
  v_take integer;
begin
  if not (public.is_owner() or public.is_staff()) then raise exception 'Not allowed.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount.'; end if;
  if p_mode is null or p_mode not in ('cash', 'upi', 'card') then raise exception 'Choose how it was paid.'; end if;

  -- Lock her udhaar entries so two phones can't collect the same rupees.
  perform 1 from public.visits
    where client_phone = p_phone and paid_udhaar > 0 and not voided for update;
  select coalesce(sum(outstanding), 0) into v_owed from public.udhaar_for_phone(p_phone);
  if v_owed = 0 then raise exception 'There is no udhaar for this number.'; end if;
  if p_amount > v_owed then raise exception 'Only % is still owed.', v_owed; end if;

  for r in select * from public.udhaar_for_phone(p_phone) loop
    exit when v_left = 0;
    v_take := least(v_left, r.outstanding);
    insert into public.udhaar_collections (visit_id, amount, mode, collected_by)
    values (r.visit_id, v_take, p_mode, auth.uid());
    v_left := v_left - v_take;
  end loop;
  return p_amount;
end $$;

revoke execute on function public.collect_udhaar_for_phone(text, integer, text) from public, anon;
grant execute on function public.collect_udhaar_for_phone(text, integer, text) to authenticated, service_role;
