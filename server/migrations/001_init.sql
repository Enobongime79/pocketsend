-- PocketSend schema. Amounts are integer kobo (100 kobo = ₦1). Run with `npm run migrate`.

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now()
);

-- One-time codes. Only a keyed hash of the code is stored, never the code itself.
create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('login', 'withdrawal')),
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index otp_codes_lookup on otp_codes (email, purpose, created_at desc);

-- Sign-in sessions. The cookie holds a random token; only its hash is stored.
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- A payment group = one Kora virtual account. The organizer's BVN is NOT stored anywhere.
create table groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null,
  description text not null default '',
  amount_type text not null check (amount_type in ('fixed', 'open')),
  amount_kobo bigint not null default 0,
  target_kobo bigint,
  closes_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  kora_account_reference text not null unique,
  account_number text not null unique,
  account_name text not null,
  bank_name text not null,
  bank_code text,
  created_at timestamptz not null default now()
);
create index groups_user on groups (user_id, created_at desc);

-- Money in. kora_reference is unique, so a webhook that arrives twice is recorded once.
create table payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  kora_reference text not null unique,
  payer_key text not null,
  payer_name text not null,
  sender_bank text not null,
  sender_account_last4 text not null,
  amount_kobo bigint not null,
  fee_kobo bigint not null default 0,
  status text not null check (status in ('pending', 'confirmed', 'failed', 'expired')),
  paid_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index payments_group on payments (group_id, paid_at desc);

-- Money out. The group's available balance is confirmed payments minus withdrawals that are processing or successful.
create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  user_id uuid not null references users (id),
  idempotency_key text not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  fee_kobo bigint not null default 0,
  bank_code text not null,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  kora_reference text not null unique,
  status text not null check (status in ('processing', 'success', 'failed')),
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);
create index withdrawals_group on withdrawals (group_id, created_at desc);

-- Every verified webhook, kept for debugging and audit.
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  reference text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  unique (event, reference)
);
