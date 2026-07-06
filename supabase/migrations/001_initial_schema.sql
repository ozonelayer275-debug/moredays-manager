-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── TERMS ───────────────────────────────────────────────────────────────────
create table terms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,          -- e.g. "First Term"
  session    text not null,          -- e.g. "2024/2025"
  start_date date not null,
  end_date   date not null,
  created_at timestamptz default now()
);

-- ─── STUDENTS ────────────────────────────────────────────────────────────────
create table students (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  class          text not null,
  guardian_name  text not null,
  guardian_phone text not null,
  admission_date date not null,
  status         text not null default 'active' check (status in ('active','withdrawn')),
  created_at     timestamptz default now()
);

-- ─── FEE STRUCTURES ──────────────────────────────────────────────────────────
create table fee_structures (
  id       uuid primary key default gen_random_uuid(),
  class    text not null,
  term     text not null,
  session  text not null,
  fee_type text not null,   -- e.g. "Tuition", "PTA Levy", "Exam Fee"
  amount   bigint not null, -- kobo
  created_at timestamptz default now()
);

-- ─── FEE PAYMENTS ────────────────────────────────────────────────────────────
create table fee_payments (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references students(id) on delete cascade,
  fee_structure_id uuid not null references fee_structures(id) on delete restrict,
  amount_paid      bigint not null, -- kobo
  method           text not null check (method in ('cash','transfer','pos')),
  date             date not null,
  recorded_by      text not null,
  created_at       timestamptz default now()
);

-- ─── INVENTORY ITEMS ─────────────────────────────────────────────────────────
create table inventory_items (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  cost_price       bigint not null, -- kobo
  selling_price    bigint not null, -- kobo
  quantity_in_stock integer not null default 0,
  created_at       timestamptz default now()
);

-- ─── SALES ───────────────────────────────────────────────────────────────────
create table sales (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references inventory_items(id) on delete restrict,
  quantity   integer not null,
  buyer_name text not null,
  student_id uuid references students(id) on delete set null,
  amount     bigint not null, -- kobo (total for this sale)
  date       date not null,
  created_at timestamptz default now()
);

-- ─── EXPENSE CATEGORIES ──────────────────────────────────────────────────────
create table expense_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz default now()
);

-- Seed default categories
insert into expense_categories (name) values
  ('Staff Salaries'),
  ('Rent / Facility'),
  ('Utilities'),
  ('Teaching Materials'),
  ('Transport'),
  ('Maintenance'),
  ('Food / Feeding'),
  ('Miscellaneous');

-- ─── EXPENSES ────────────────────────────────────────────────────────────────
create table expenses (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references expense_categories(id) on delete restrict,
  description text not null,
  amount      bigint not null, -- kobo
  date        date not null,
  recurring   boolean not null default false,
  recorded_by text not null,
  created_at  timestamptz default now()
);

-- ─── USER ROLES (for future bursar role) ─────────────────────────────────────
create table user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'admin' check (role in ('admin','bursar')),
  created_at timestamptz default now(),
  unique(user_id)
);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
alter table students           enable row level security;
alter table fee_structures     enable row level security;
alter table fee_payments       enable row level security;
alter table inventory_items    enable row level security;
alter table sales              enable row level security;
alter table expense_categories enable row level security;
alter table expenses           enable row level security;
alter table terms              enable row level security;
alter table user_roles         enable row level security;

-- Helper: check if current user has a role
create or replace function is_school_user()
returns boolean language sql security definer as $$
  select exists (
    select 1 from user_roles where user_id = auth.uid()
  );
$$;

-- Policies: authenticated users with a role can read/write all school data
-- (Phase 1: simple — any authenticated user in user_roles can do everything)
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'students','fee_structures','fee_payments',
    'inventory_items','sales','expense_categories',
    'expenses','terms'
  ] loop
    execute format('
      create policy "school_user_all" on %I
      for all to authenticated
      using (is_school_user())
      with check (is_school_user());
    ', tbl);
  end loop;
end $$;

-- user_roles: users can only see their own row
create policy "own_role" on user_roles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
