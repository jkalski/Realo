-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ACCOUNTS (one per agency/realtor business)
create table accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_email text not null,
  subscription_status text not null default 'trial',
  subscription_tier text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz default (now() + interval '14 days'),
  working_hours_start int not null default 8,
  working_hours_end int not null default 20,
  timezone text not null default 'America/New_York',
  cadence_preset text not null default 'conservative',
  created_at timestamptz default now()
);

-- ACCOUNT MEMBERS (realtors who belong to an account)
create table account_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'agent',
  created_at timestamptz default now(),
  unique(account_id, user_id)
);

-- CONTACTS (leads and past clients)
create table contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  birthday date,
  source text default 'manual',
  status text not null default 'new',
  lead_score int not null default 0,
  is_dnc boolean not null default false,
  last_contacted_at timestamptz,
  last_replied_at timestamptz,
  notes text,
  crm_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- WORKFLOW INSTANCES (one per contact per workflow run)
create table workflow_instances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  workflow_type text not null,
  status text not null default 'active',
  current_step int not null default 0,
  next_step_at timestamptz,
  stopped_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MESSAGES (every SMS or email sent or received)
create table messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  workflow_instance_id uuid references workflow_instances(id),
  direction text not null default 'outbound',
  channel text not null,
  status text not null default 'pending',
  subject text,
  body text not null,
  twilio_sid text,
  sendgrid_message_id text,
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  delivered_at timestamptz,
  failed_reason text,
  deduplication_key text unique,
  created_at timestamptz default now()
);

-- EVENTS (immutable audit trail of everything)
create table events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  contact_id uuid references contacts(id),
  message_id uuid references messages(id),
  event_type text not null,
  payload jsonb default '{}',
  created_at timestamptz default now()
);

-- DNC LIST
create table dnc_list (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  phone text,
  email text,
  reason text,
  created_at timestamptz default now()
);

-- USAGE COUNTERS (monthly rollups)
create table usage_counters (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  month text not null,
  sms_sent int not null default 0,
  emails_sent int not null default 0,
  calls_made int not null default 0,
  unique(account_id, month)
);

-- INDEXES
create index on contacts(account_id);
create index on contacts(account_id, status);
create index on contacts(account_id, last_contacted_at);
create index on contacts(account_id, birthday);
create index on messages(account_id);
create index on messages(contact_id);
create index on messages(deduplication_key);
create index on events(account_id);
create index on events(contact_id);
create index on workflow_instances(account_id, status);
create index on workflow_instances(next_step_at);

-- UPDATED AT trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger contacts_updated_at
  before update on contacts
  for each row execute function update_updated_at();

create trigger workflow_instances_updated_at
  before update on workflow_instances
  for each row execute function update_updated_at();