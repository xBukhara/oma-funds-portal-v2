-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS account_transactions (
  id           uuid primary key default gen_random_uuid(),
  investor_id  uuid references investors(id) on delete cascade,
  type         text not null check (type in ('deposit', 'withdrawal')),
  amount       numeric(18,2) not null,
  nav_before   numeric(18,2) not null,
  nav_after    numeric(18,2) not null,
  note         text,
  created_at   timestamptz default now()
);

ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;

-- Investors can only see their own transactions
CREATE POLICY "transactions_read_self" ON account_transactions
  FOR SELECT USING (
    investor_id IN (
      SELECT id FROM investors WHERE user_id = auth.uid()
    )
  );
