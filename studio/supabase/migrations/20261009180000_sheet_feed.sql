-- The Google Sheet of records: one tab each for students, the daily log, the
-- monthly log, clients and employees. Each tab is an array of rows (the first
-- is the header), read by the sheet-feed Edge Function, which the sheet calls
-- with a secret key. Only the server (service_role) may run this.

create or replace function public.sheet_phone(p text) returns text
language sql immutable as $$
  -- '98111 00001': with the space, Google Sheets keeps it as text, not a number.
  select case when p ~ '^[0-9]{10}$' then substr(p, 1, 5) || ' ' || substr(p, 6) else p end
$$;

create or replace function public.sheet_feed(p_tab text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_header jsonb;
  v_rows jsonb;
  v_month date := date_trunc('month', public.today_ist())::date;
begin
  if p_tab = 'students' then
    v_header := jsonb_build_array('Student', 'Phone', 'WhatsApp', 'Course', 'Batch', 'Days', 'Started', 'Ends',
      'Status', 'Agreed fee', 'Paid', 'Balance', 'Overdue', 'Next due date', 'Next due amount', 'Last paid',
      'Joined', 'Source');
    select coalesce(jsonb_agg(r order by sort_name, started), '[]') into v_rows from (
      select s.full_name as sort_name, e.start_date as started, jsonb_build_array(
        s.full_name, sheet_phone(s.phone), sheet_phone(s.whatsapp), c.name_en,
        case when t.id is null then null
          else to_char(t.start_time, 'FMHH12:MI AM') || ' to ' || to_char(t.end_time, 'FMHH12:MI AM') end,
        (select string_agg((array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[d + 1], ', '
                           order by case when d = 0 then 7 else d end)
           from unnest(e.days_of_week) d),
        e.start_date, coalesce(e.completed_on, e.expected_end_date), coalesce(e.status, s.status),
        f.agreed_fee, f.paid, f.balance, f.overdue_amount, f.next_due_date, f.next_due_amount, f.last_paid_on,
        s.joined_on, s.source) as r
      from students s
      left join enrollments e on e.student_id = s.id
      left join courses c on c.id = e.course_id
      left join time_slots t on t.id = e.slot_id
      left join enrollment_fee_status f on f.enrollment_id = e.id
    ) x;

  elsif p_tab = 'daily' then
    -- Every salon entry, fee payment, udhaar collection and booking advance, newest first.
    v_header := jsonb_build_array('Date', 'Time', 'Type', 'Name', 'Phone', 'Details', 'Amount', 'Discount',
      'Cash', 'UPI', 'Card', 'Bank', 'Udhaar given', 'Advance used', 'Receipt no', 'Entered by', 'Status');
    select coalesce(jsonb_agg(r order by day desc, at desc), '[]') into v_rows from (
      select v.visit_date as day, v.created_at as at, jsonb_build_array(
        v.visit_date, to_char(v.created_at at time zone 'Asia/Kolkata', 'HH24:MI'), 'Salon',
        v.client_name, sheet_phone(v.client_phone),
        (select string_agg(l.service_name || ' (' || coalesce(p.display_name, '?') || ')', ', ' order by l.sort)
           from visit_lines l left join profiles p on p.id = l.staff_id where l.visit_id = v.id),
        v.total, v.discount, v.paid_cash, v.paid_upi, v.paid_card, 0, v.paid_udhaar, v.paid_advance, null,
        cb.display_name, case when v.voided then 'Cancelled: ' || v.void_reason else 'OK' end) as r
      from visits v left join profiles cb on cb.id = v.created_by
      union all
      select pm.paid_on, pm.created_at, jsonb_build_array(
        pm.paid_on, to_char(pm.created_at at time zone 'Asia/Kolkata', 'HH24:MI'), 'Fee',
        s.full_name, sheet_phone(s.phone), c.name_en, pm.amount, 0,
        case when pm.mode = 'cash' then pm.amount else 0 end, case when pm.mode = 'upi' then pm.amount else 0 end,
        case when pm.mode = 'card' then pm.amount else 0 end, case when pm.mode = 'bank' then pm.amount else 0 end,
        0, 0, pm.receipt_no, rb.display_name,
        case when pm.voided then 'Cancelled: ' || pm.void_reason else 'OK' end)
      from payments pm
      join enrollments e on e.id = pm.enrollment_id
      join students s on s.id = e.student_id
      join courses c on c.id = e.course_id
      left join profiles rb on rb.id = pm.received_by
      union all
      select u.collected_on, u.created_at, jsonb_build_array(
        u.collected_on, to_char(u.created_at at time zone 'Asia/Kolkata', 'HH24:MI'), 'Udhaar collected',
        v.client_name, sheet_phone(v.client_phone), 'For the visit on ' || to_char(v.visit_date, 'DD Mon YYYY'),
        u.amount, 0,
        case when u.mode = 'cash' then u.amount else 0 end, case when u.mode = 'upi' then u.amount else 0 end,
        case when u.mode = 'card' then u.amount else 0 end, 0, 0, 0, null, cb.display_name,
        case when u.voided then 'Cancelled: ' || u.void_reason else 'OK' end)
      from udhaar_collections u
      join visits v on v.id = u.visit_id
      left join profiles cb on cb.id = u.collected_by
      union all
      select a.paid_on, a.created_at, jsonb_build_array(
        a.paid_on, to_char(a.created_at at time zone 'Asia/Kolkata', 'HH24:MI'), 'Booking advance',
        ap.client_name, sheet_phone(ap.client_phone),
        'Booking on ' || to_char(ap.day, 'DD Mon YYYY') || coalesce(': ' || ap.services_text, ''),
        a.amount, 0,
        case when a.mode = 'cash' then a.amount else 0 end, case when a.mode = 'upi' then a.amount else 0 end,
        case when a.mode = 'card' then a.amount else 0 end, case when a.mode = 'bank' then a.amount else 0 end,
        0, 0, null, rb.display_name,
        case when a.voided then 'Cancelled: ' || a.void_reason else 'OK' end)
      from appointment_advances a
      join appointments ap on ap.id = a.appointment_id
      left join profiles rb on rb.id = a.received_by
    ) x(day, at, r);

  elsif p_tab = 'monthly' then
    -- One row per month, newest first; cancelled entries left out.
    v_header := jsonb_build_array('Month', 'Salon billed', 'Salon entries', 'Discounts', 'Cash', 'UPI', 'Card',
      'Udhaar given', 'Udhaar collected', 'Booking advances', 'Fees collected', 'Admissions', 'New clients');
    select coalesce(jsonb_agg(jsonb_build_array(
      to_char(m, 'Mon YYYY'),
      (select coalesce(sum(total), 0) from visits where not voided and visit_date >= m and visit_date < m_next),
      (select count(*) from visits where not voided and visit_date >= m and visit_date < m_next),
      (select coalesce(sum(discount), 0) from visits where not voided and visit_date >= m and visit_date < m_next),
      (select coalesce(sum(paid_cash), 0) from visits where not voided and visit_date >= m and visit_date < m_next),
      (select coalesce(sum(paid_upi), 0) from visits where not voided and visit_date >= m and visit_date < m_next),
      (select coalesce(sum(paid_card), 0) from visits where not voided and visit_date >= m and visit_date < m_next),
      (select coalesce(sum(paid_udhaar), 0) from visits where not voided and visit_date >= m and visit_date < m_next),
      (select coalesce(sum(amount), 0) from udhaar_collections where not voided and collected_on >= m and collected_on < m_next),
      (select coalesce(sum(amount), 0) from appointment_advances where not voided and paid_on >= m and paid_on < m_next),
      (select coalesce(sum(amount), 0) from payments where not voided and paid_on >= m and paid_on < m_next),
      (select count(*) from enrollments where start_date >= m and start_date < m_next),
      (select count(*) from (select client_phone from visits where not voided and client_phone is not null
         group by client_phone having min(visit_date) >= m and min(visit_date) < m_next) n)
    ) order by m desc), '[]') into v_rows
    from (
      select gs::date as m, (gs + interval '1 month')::date as m_next
      from generate_series(
        date_trunc('month', least(v_month, coalesce((select min(d) from (
          select min(visit_date) d from visits union all select min(paid_on) from payments
          union all select min(start_date) from enrollments) f), v_month))::timestamp),
        v_month::timestamp, interval '1 month') gs
    ) months;

  elsif p_tab = 'clients' then
    v_header := jsonb_build_array('Phone', 'Name', 'Visits', 'Total spent', 'Average bill', 'First visit',
      'Last visit', 'Udhaar owed', 'Next booking', 'Birthday', 'Notes', 'Review asked on');
    select coalesce(jsonb_agg(jsonb_build_array(
      sheet_phone(c.phone), c.name, coalesce(v.n, 0), coalesce(v.spent, 0),
      case when coalesce(v.n, 0) > 0 then round(v.spent::numeric / v.n) else 0 end,
      v.first_visit, v.last_visit, coalesce(u.owed, 0),
      (select min(day) from appointments where client_phone = c.phone and status = 'booked' and day >= public.today_ist()),
      case when c.birth_day is null then null
        else c.birth_day || ' ' || (array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])[c.birth_month] end,
      c.notes, c.review_asked_on
    ) order by v.last_visit desc nulls last, c.name), '[]') into v_rows
    from clients c
    left join (select client_phone, count(*) n, sum(total) spent, min(visit_date) first_visit, max(visit_date) last_visit
               from visits where not voided group by client_phone) v on v.client_phone = c.phone
    left join (select client_phone, sum(outstanding) owed from udhaar_status group by client_phone) u on u.client_phone = c.phone;

  elsif p_tab = 'employees' then
    -- No PINs or passwords here: those are never stored in readable form.
    v_header := jsonb_build_array('Name', 'Username', 'Roles', 'Login', 'Phone', 'Added on',
      'Services this month', 'Work this month', 'Services last month', 'Work last month');
    select coalesce(jsonb_agg(jsonb_build_array(
      p.display_name, p.username,
      concat_ws(', ', case when p.is_owner then 'Owner' end, case when p.is_trainer then 'Trainer' end,
                case when p.is_staff then 'Salon staff' end),
      case when p.active then 'On' else 'Off' end, sheet_phone(p.phone),
      (p.created_at at time zone 'Asia/Kolkata')::date,
      coalesce(w.n_this, 0), coalesce(w.net_this, 0), coalesce(w.n_last, 0), coalesce(w.net_last, 0)
    ) order by p.active desc, p.display_name), '[]') into v_rows
    from profiles p
    left join (
      select l.staff_id,
        count(*) filter (where v.visit_date >= v_month) n_this,
        sum(l.price - l.discount) filter (where v.visit_date >= v_month) net_this,
        count(*) filter (where v.visit_date < v_month) n_last,
        sum(l.price - l.discount) filter (where v.visit_date < v_month) net_last
      from visit_lines l join visits v on v.id = l.visit_id
      where not v.voided and v.visit_date >= (v_month - interval '1 month')
      group by l.staff_id
    ) w on w.staff_id = p.id;

  else
    raise exception 'Unknown tab: %', p_tab;
  end if;

  return jsonb_build_array(v_header) || v_rows;
end $$;

revoke execute on function public.sheet_feed(text) from public, anon, authenticated;
grant execute on function public.sheet_feed(text) to service_role;
revoke execute on function public.sheet_phone(text) from public, anon, authenticated;
grant execute on function public.sheet_phone(text) to service_role;
