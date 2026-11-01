-- Reelwise schema. Run with `npm run db:migrate`.
create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table sessions (
  id text primary key,               -- sha256 of the session token (the token itself is never stored)
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  ip text, user_agent text,
  created_at timestamptz not null default now()
);
create index on sessions(user_id);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create type member_role as enum ('owner', 'admin', 'editor', 'viewer');
create table memberships (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role member_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table workspace_settings (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  anthropic_key_enc text,            -- AES-256-GCM, see src/lib/crypto.ts
  timezone text not null default 'UTC',
  updated_at timestamptz not null default now()
);

create table media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid,
  kind text not null check (kind in ('image','video','audio','logo','font','other')),
  source text not null default 'upload' check (source in ('upload','render','thumbnail','recycle','voiceover')),
  filename text not null,
  mime text not null,
  size bigint not null,
  path text not null,                -- relative to STORAGE_DIR
  width int, height int, duration_sec real,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on media(workspace_id, created_at desc);

create table brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text not null default '',
  audience text not null default '',
  language text not null default 'English',
  video_style text not null default 'auto' check (video_style in ('auto','cinematic3d','promo')),
  colors jsonb not null default '["#5b6cff","#a78bfa","#0f172a"]',
  fonts jsonb not null default '{"heading":"Inter","body":"Inter"}',
  characters text not null default '',
  intro_text text not null default '',
  outro_text text not null default '',
  contact text not null default '',
  website text not null default '',
  cta text not null default '',
  duration_sec int not null default 30 check (duration_sec between 5 and 180),
  aspect_ratio text not null default '9:16' check (aspect_ratio in ('9:16','16:9','1:1')),
  music_pref text not null default '',
  voice_pref text not null default '',
  restrictions text not null default '',
  logo_media_id uuid references media(id) on delete set null,
  music_media_id uuid references media(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on brands(workspace_id);
alter table media add constraint media_brand_fk foreign key (brand_id) references brands(id) on delete set null;

create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram','youtube')),
  external_id text not null,
  name text not null,
  avatar_url text,
  access_token_enc text not null,
  refresh_token_enc text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected','expired','error','disconnected')),
  last_error text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, platform, external_id)
);

create table oauth_states (
  state text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  provider text not null,
  code_verifier text,
  created_at timestamptz not null default now()
);

create table autopilot_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  instruction text not null,
  platforms text[] not null,
  per_week int not null check (per_week between 1 and 21),
  publish_times text[] not null default '{10:00}',
  style text not null default 'auto',
  aspect_ratio text not null default '9:16',
  status text not null default 'active' check (status in ('active','paused')),
  next_run_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table autopilot_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references autopilot_rules(id) on delete cascade,
  status text not null,
  message text not null default '',
  video_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table videos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,
  title text not null default 'Untitled video',
  instruction text not null,
  style text not null default 'promo' check (style in ('cinematic3d','promo')),
  aspect_ratio text not null default '9:16' check (aspect_ratio in ('9:16','16:9','1:1')),
  duration_sec int not null default 30,
  storyboard jsonb,
  caption text not null default '',
  hashtags text[] not null default '{}',
  youtube_title text not null default '',
  youtube_description text not null default '',
  thumbnail_text text not null default '',
  video_media_id uuid references media(id) on delete set null,
  thumbnail_media_id uuid references media(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','scripting','rendering','ready','approved','rejected','failed')),
  render_progress real not null default 0,
  render_quality text not null default 'draft' check (render_quality in ('draft','final')),
  error text,
  autopilot_rule_id uuid references autopilot_rules(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  approved_by uuid references users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on videos(workspace_id, created_at desc);

create table publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  platform text not null,
  status text not null default 'waiting_approval' check (status in ('waiting_approval','approved','scheduled','publishing','published','failed','cancelled')),
  scheduled_at timestamptz,
  published_at timestamptz,
  external_id text,
  external_url text,
  error text,
  attempts int not null default 0,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on publications(workspace_id, scheduled_at);

create table jobs (
  id bigserial primary key,
  type text not null,
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  run_at timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 3,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_ready on jobs(status, run_at);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table inbox_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  platform text not null,
  external_id text not null,
  kind text not null default 'comment',
  author text not null default '',
  text text not null,
  permalink text,
  context_title text,
  received_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','replied','resolved')),
  suggested_reply text,
  reply_text text,
  replied_at timestamptz,
  replied_by uuid references users(id) on delete set null,
  unique (social_account_id, external_id)
);

create table analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  day date not null,
  metrics jsonb not null,            -- exactly what the platform returned, normalised keys
  fetched_at timestamptz not null default now(),
  unique (social_account_id, day)
);

create table post_metrics (
  publication_id uuid primary key references publications(id) on delete cascade,
  metrics jsonb not null,
  fetched_at timestamptz not null default now()
);

create table content_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,
  kind text not null,
  tone text not null,
  language text not null,
  input text not null,
  output jsonb not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id bigserial primary key,
  workspace_id uuid,
  user_id uuid,
  action text not null,
  target_type text, target_id text,
  ip text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on audit_logs(workspace_id, created_at desc);

-- Defence in depth for hosted Postgres (e.g. Supabase): with RLS enabled and
-- no policies, roles other than the table owner (the app's role) can read
-- nothing — so public/anon keys can never reach this data directly.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create table schema_migrations (name text primary key, applied_at timestamptz not null default now());
