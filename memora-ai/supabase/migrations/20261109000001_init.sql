-- =====================================================================
-- MEMORA AI — core schema
-- Every user-owned table has Row Level Security: a row is visible and
-- writable only by the user whose id is in user_id (auth.uid()).
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- builds a forgiving "any of these words" full-text query from free text
create or replace function public.any_words_query(q text)
returns tsquery language sql immutable set search_path = '' as $$
  select case
    when coalesce(trim(q), '') = '' then null
    else websearch_to_tsquery('simple',
      array_to_string(array(
        select w from regexp_split_to_table(lower(regexp_replace(q, '[^[:alnum:][:space:]]', ' ', 'g')), '\s+') as w
        where length(w) > 1
      ), ' or '))
  end
$$;

-- ---------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_path text,
  study_level text not null default 'inter1' check (study_level in ('inter1', 'inter2', 'eapcet')),
  language_pref text not null default 'en' check (language_pref in ('en', 'te', 'en_te')),
  explanation_style text not null default 'simple',
  timezone text not null default 'Asia/Kolkata',
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  exam_name text,
  exam_date date,
  daily_goal_minutes int not null default 120 check (daily_goal_minutes between 0 and 960),
  notify_in_app boolean not null default true,
  notify_browser boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- memories
-- ---------------------------------------------------------------------
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  content text not null default '' check (length(content) <= 20000),
  category text not null default 'General Notes' check (category in (
    'Personal', 'Education', 'Mathematics', 'Physics', 'Chemistry', 'Assignments', 'Teachers',
    'Important Information', 'Ideas', 'Reminders', 'Projects', 'General Notes')),
  tags text[] not null default '{}',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  pinned boolean not null default false,
  archived boolean not null default false,
  source text not null default 'text' check (source in ('text', 'voice', 'chat')),
  search tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz
);
create index memories_user_idx on public.memories (user_id, archived, pinned desc, updated_at desc);
create index memories_search_idx on public.memories using gin (search);
create index memories_title_trgm on public.memories using gin (title extensions.gin_trgm_ops);

create or replace function public.memories_search_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.tags, ' '), '') || ' ' || new.category), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.content, '')), 'C');
  return new;
end $$;
create trigger memories_search before insert or update of title, content, tags, category on public.memories
  for each row execute function public.memories_search_update();
create trigger memories_updated before update of title, content, category, tags, priority, pinned, archived on public.memories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- AI conversations
-- ---------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'New conversation' check (length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_idx on public.conversations (user_id, updated_at desc);
create trigger conversations_updated before update on public.conversations for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) <= 60000),
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------
-- syllabus (shared, read-only reference data) + per-user progress
-- ---------------------------------------------------------------------
create table public.chapters (
  id text primary key,
  subject text not null check (subject in ('mathematics', 'physics', 'chemistry')),
  year int not null check (year in (1, 2)),
  paper text not null,
  position int not null,
  title text not null
);
create index chapters_subject_idx on public.chapters (subject, year, position);

create table public.chapter_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chapter_id text not null references public.chapters (id) on delete cascade,
  track text not null default 'inter' check (track in ('inter', 'eapcet')),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  important boolean not null default false,
  personal_notes text not null default '' check (length(personal_notes) <= 20000),
  revision_due date,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id, track)
);
create trigger chapter_progress_updated before update on public.chapter_progress for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- planner: tasks, assignments, study sessions, revisions, exams, reminders
-- ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'task' check (kind in ('task', 'assignment', 'study_session', 'revision', 'exam', 'reminder')),
  title text not null check (length(title) between 1 and 200),
  description text not null default '' check (length(description) <= 10000),
  subject text,
  chapter_id text references public.chapters (id) on delete set null,
  start_at timestamptz,
  due_at timestamptz,
  duration_minutes int check (duration_minutes is null or duration_minutes between 5 and 240),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  recurrence_until date,
  remind_at timestamptz,
  attachment_path text,
  plan_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_due_idx on public.tasks (user_id, due_at);
create index tasks_user_start_idx on public.tasks (user_id, start_at);
create index tasks_user_kind_idx on public.tasks (user_id, kind, status);
create trigger tasks_updated before update on public.tasks for each row execute function public.set_updated_at();

-- time actually studied (from the study-session timer)
create table public.study_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject text,
  chapter_id text references public.chapters (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  minutes int not null check (minutes between 1 and 600),
  started_at timestamptz not null default now(),
  note text not null default ''
);
create index study_logs_user_idx on public.study_logs (user_id, started_at desc);

-- ---------------------------------------------------------------------
-- notes and documents
-- ---------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Untitled note' check (length(title) <= 200),
  content text not null default '' check (length(content) <= 200000),
  subject text,
  tags text[] not null default '{}',
  pinned boolean not null default false,
  favourite boolean not null default false,
  search tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_user_idx on public.notes (user_id, pinned desc, updated_at desc);
create index notes_search_idx on public.notes using gin (search);

create or replace function public.notes_search_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.tags, ' '), '') || ' ' || coalesce(new.subject, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.content, '')), 'C');
  return new;
end $$;
create trigger notes_search before insert or update of title, content, tags, subject on public.notes
  for each row execute function public.notes_search_update();
create trigger notes_updated before update on public.notes for each row execute function public.set_updated_at();

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  file_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  page_count int,
  subject text,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'failed')),
  error text,
  summary text,
  created_at timestamptz not null default now()
);
create index documents_user_idx on public.documents (user_id, created_at desc);

create table public.document_chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  page int,
  chunk_index int not null,
  content text not null,
  search tsvector generated always as (to_tsvector('simple', content)) stored
);
create index document_chunks_doc_idx on public.document_chunks (document_id, chunk_index);
create index document_chunks_search_idx on public.document_chunks using gin (search);

-- ---------------------------------------------------------------------
-- flashcards with spaced repetition (SM-2 style)
-- ---------------------------------------------------------------------
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  front text not null check (length(front) between 1 and 2000),
  back text not null check (length(back) between 1 and 4000),
  subject text,
  chapter_id text references public.chapters (id) on delete set null,
  deck text not null default 'General' check (length(deck) <= 80),
  favourite boolean not null default false,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  source text not null default 'manual' check (source in ('manual', 'ai', 'note', 'document', 'video')),
  srs_state text not null default 'new' check (srs_state in ('new', 'learning', 'review', 'mastered')),
  ease real not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  lapses int not null default 0,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index flashcards_user_due_idx on public.flashcards (user_id, due_at);

create table public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  flashcard_id uuid not null references public.flashcards (id) on delete cascade,
  rating int not null check (rating between 0 and 3),
  reviewed_at timestamptz not null default now()
);
create index flashcard_reviews_user_idx on public.flashcard_reviews (user_id, reviewed_at desc);

-- ---------------------------------------------------------------------
-- quizzes
-- ---------------------------------------------------------------------
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(title) <= 200),
  subject text,
  chapter_id text references public.chapters (id) on delete set null,
  level text not null default 'inter1' check (level in ('inter1', 'inter2', 'eapcet')),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  time_limit_seconds int not null default 600 check (time_limit_seconds between 60 and 10800),
  ai_generated boolean not null default true,
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  created_at timestamptz not null default now()
);
create index quizzes_user_idx on public.quizzes (user_id, created_at desc);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  marked jsonb not null default '[]'::jsonb,
  score int not null,
  total int not null,
  correct int not null,
  incorrect int not null,
  unanswered int not null,
  time_taken_seconds int not null,
  topic_breakdown jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, submitted_at desc);

-- ---------------------------------------------------------------------
-- YouTube learning centre
-- ---------------------------------------------------------------------
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null,
  channel_title text not null default '',
  thumbnail_url text,
  subject text,
  chapter_id text references public.chapters (id) on delete set null,
  saved boolean not null default false,
  last_position_seconds real not null default 0,
  duration_seconds real,
  watched boolean not null default false,
  last_watched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);
create index videos_user_idx on public.videos (user_id, last_watched_at desc nulls last);

create table public.video_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  timestamp_seconds real,
  content text not null check (length(content) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index video_notes_user_idx on public.video_notes (user_id, video_id, timestamp_seconds);

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  description text not null default '',
  subject text,
  created_at timestamptz not null default now()
);

create table public.playlist_items (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null,
  channel_title text not null default '',
  thumbnail_url text,
  position int not null default 0,
  added_at timestamptz not null default now(),
  primary key (playlist_id, video_id)
);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null default 'system' check (type in ('reminder', 'assignment', 'revision', 'study', 'exam', 'system', 'achievement')),
  title text not null,
  body text not null default '',
  link text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, read_at nulls first, created_at desc);

-- =====================================================================
-- Row Level Security
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'memories', 'conversations', 'chapter_progress', 'tasks', 'study_logs', 'notes', 'documents',
    'document_chunks', 'flashcards', 'flashcard_reviews', 'quizzes', 'quiz_attempts', 'videos', 'video_notes',
    'playlists', 'playlist_items', 'notifications']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows: select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- messages: own rows, and only inside the user's own conversations
alter table public.messages enable row level security;
create policy "own messages: select" on public.messages for select to authenticated using (user_id = (select auth.uid()));
create policy "own messages: insert" on public.messages for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
create policy "own messages: delete" on public.messages for delete to authenticated using (user_id = (select auth.uid()));

-- children must point at parents the user owns
create policy "own parent: playlist items" on public.playlist_items as restrictive for insert to authenticated
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));
create policy "own parent: quiz attempts" on public.quiz_attempts as restrictive for insert to authenticated
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = (select auth.uid())));
create policy "own parent: flashcard reviews" on public.flashcard_reviews as restrictive for insert to authenticated
  with check (exists (select 1 from public.flashcards f where f.id = flashcard_id and f.user_id = (select auth.uid())));
create policy "own parent: document chunks" on public.document_chunks as restrictive for insert to authenticated
  with check (exists (select 1 from public.documents d where d.id = document_id and d.user_id = (select auth.uid())));

alter table public.profiles enable row level security;
create policy "own profile: select" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "own profile: update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "own profile: insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()));

alter table public.chapters enable row level security;
create policy "syllabus is readable" on public.chapters for select to authenticated using (true);

-- the anonymous role gets nothing
revoke all on all tables in schema public from anon;

-- =====================================================================
-- search functions (security invoker: RLS still applies)
-- =====================================================================
create or replace function public.search_memories(q text, lim int default 8, include_archived boolean default false)
returns table (id uuid, title text, content text, category text, tags text[], priority text, pinned boolean,
               created_at timestamptz, updated_at timestamptz, rank real)
language sql stable security invoker set search_path = '' as $$
  with query as (select public.any_words_query(q) as tsq)
  select m.id, m.title, m.content, m.category, m.tags, m.priority, m.pinned, m.created_at, m.updated_at,
         (coalesce(ts_rank_cd(m.search, query.tsq), 0)
          + extensions.similarity(m.title, q) * 0.6
          + case when m.content ilike '%' || q || '%' or m.title ilike '%' || q || '%' then 0.5 else 0 end)::real as rank
  from public.memories m, query
  where m.user_id = (select auth.uid())
    and (include_archived or not m.archived)
    and (m.search @@ query.tsq or extensions.similarity(m.title, q) > 0.2 or m.content ilike '%' || q || '%' or m.title ilike '%' || q || '%')
  order by rank desc, m.updated_at desc
  limit greatest(1, least(lim, 50));
$$;

create or replace function public.search_notes(q text, lim int default 8)
returns table (id uuid, title text, snippet text, subject text, updated_at timestamptz, rank real)
language sql stable security invoker set search_path = '' as $$
  with query as (select public.any_words_query(q) as tsq)
  select n.id, n.title, left(n.content, 400) as snippet, n.subject, n.updated_at,
         (coalesce(ts_rank_cd(n.search, query.tsq), 0)
          + case when n.title ilike '%' || q || '%' then 0.5 else 0 end)::real as rank
  from public.notes n, query
  where n.user_id = (select auth.uid())
    and (n.search @@ query.tsq or n.title ilike '%' || q || '%' or n.content ilike '%' || q || '%')
  order by rank desc, n.updated_at desc
  limit greatest(1, least(lim, 50));
$$;

create or replace function public.search_document_chunks(doc uuid, q text, lim int default 6)
returns table (id bigint, page int, chunk_index int, content text, rank real)
language sql stable security invoker set search_path = '' as $$
  with query as (select public.any_words_query(q) as tsq)
  select c.id, c.page, c.chunk_index, c.content, coalesce(ts_rank_cd(c.search, query.tsq), 0)::real as rank
  from public.document_chunks c, query
  where c.user_id = (select auth.uid()) and c.document_id = doc and c.search @@ query.tsq
  order by rank desc, c.chunk_index
  limit greatest(1, least(lim, 30));
$$;

grant execute on function public.search_memories(text, int, boolean), public.search_notes(text, int),
  public.search_document_chunks(uuid, text, int), public.any_words_query(text) to authenticated;
revoke execute on function public.search_memories(text, int, boolean), public.search_notes(text, int),
  public.search_document_chunks(uuid, text, int) from anon, public;

-- =====================================================================
-- Storage: private bucket, each user may only touch files under "<uid>/..."
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-files', 'user-files', false, 20971520,
        array['application/pdf', 'text/plain', 'text/markdown', 'image/png', 'image/jpeg', 'image/webp',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy "user files: read own" on storage.objects for select to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user files: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user files: update own" on storage.objects for update to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user files: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
