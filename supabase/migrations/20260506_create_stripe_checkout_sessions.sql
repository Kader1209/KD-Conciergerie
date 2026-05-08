create table if not exists public.stripe_checkout_sessions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  stripe_session_id text not null unique,
  amount_eur numeric not null,
  amount_cents integer not null,
  currency text not null default 'eur',
  description text,
  payment_status text,
  session_status text,
  checkout_url text,
  customer_email text,
  booking_id text
);

create index if not exists idx_stripe_checkout_sessions_created_at
  on public.stripe_checkout_sessions (created_at desc);
