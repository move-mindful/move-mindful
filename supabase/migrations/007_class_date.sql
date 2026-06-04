-- Move Mindful — Admin-controlled class date
-- Run in the Supabase SQL Editor.

-- A display date the admin sets per class (shown on browse cards and the class
-- play page). Distinct from created_at (row-insert time) and published_at
-- (publish toggle). New classes default to the import/add date; the admin can
-- change it on the class form.
alter table public.classes
  add column class_date date;

-- Backfill existing rows so nothing renders blank: use the day the row was created.
update public.classes
set class_date = created_at::date
where class_date is null;

-- Going forward, default to today and require a value (the form always sends one).
alter table public.classes
  alter column class_date set default current_date,
  alter column class_date set not null;

comment on column public.classes.class_date is
  'Admin-set display date for the class, shown on cards and the play page. Defaults to the import/add date.';
