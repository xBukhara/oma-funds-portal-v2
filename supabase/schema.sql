-- ============================================================
-- OMA FUNDS PORTAL — SUPABASE SCHEMA
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- ── INVESTORS ───────────────────────────────────────────────
create table if not exists investors (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade,
  name             text not null,
  email            text not null unique,
  slug             text not null unique,
  starting_capital numeric(18,2) not null default 0,
  share_pct        numeric(8,4) not null default 0,  -- % of total fund they own
  created_at       timestamptz default now()
);

-- ── MONTHLY NAV RECORDS ─────────────────────────────────────
create table if not exists nav_records (
  id                  uuid primary key default gen_random_uuid(),
  investor_id         uuid references investors(id) on delete cascade,
  year                int not null,
  month               int not null check (month between 1 and 12),
  nav                 numeric(18,2) not null,
  monthly_return_pct  numeric(8,4) not null,
  created_at          timestamptz default now(),
  unique(investor_id, year, month)
);

-- ── FUND MONTHLY RETURNS (fund-level, powers charts) ────────
create table if not exists fund_returns (
  id                  uuid primary key default gen_random_uuid(),
  year                int not null,
  month               int not null check (month between 1 and 12),
  monthly_return_pct  numeric(8,4) not null,
  nav_total           numeric(18,2) not null,
  ytd_roi             numeric(8,4),
  created_at          timestamptz default now(),
  unique(year, month)
);

-- ── STATEMENTS (uploaded PDFs) ───────────────────────────────
create table if not exists statements (
  id             uuid primary key default gen_random_uuid(),
  year           int not null,
  month          int not null,
  file_path      text not null,   -- Supabase Storage path
  file_url       text,            -- signed URL (refreshed on demand)
  uploaded_at    timestamptz default now(),
  email_sent_at  timestamptz,     -- null until email blast fires
  unique(year, month)
);

-- ── EMAIL LOG ────────────────────────────────────────────────
create table if not exists email_log (
  id            uuid primary key default gen_random_uuid(),
  statement_id  uuid references statements(id),
  investor_id   uuid references investors(id),
  sent_at       timestamptz default now(),
  status        text default 'sent',  -- 'sent' | 'failed'
  error_msg     text
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table investors   enable row level security;
alter table nav_records enable row level security;
alter table fund_returns enable row level security;
alter table statements  enable row level security;

-- Investors: can only read their own row
create policy "investor_read_self" on investors
  for select using (auth.uid() = user_id);

-- NAV Records: can only read their own records
create policy "nav_read_self" on nav_records
  for select using (
    investor_id in (
      select id from investors where user_id = auth.uid()
    )
  );

-- Fund returns: all authenticated users can read (powers charts)
create policy "fund_returns_read" on fund_returns
  for select using (auth.role() = 'authenticated');

-- Statements: all authenticated users can read (for download links)
create policy "statements_read" on statements
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- STORAGE BUCKET (run separately in Storage settings OR here)
-- ============================================================
-- insert into storage.buckets (id, name, public)
-- values ('statements', 'statements', false);

-- Allow authenticated users to read from statements bucket
-- create policy "statements_read" on storage.objects
--   for select using (bucket_id = 'statements' and auth.role() = 'authenticated');

-- Allow service role to write (used by API route)
-- create policy "statements_write" on storage.objects
--   for insert using (bucket_id = 'statements' and auth.role() = 'service_role');
