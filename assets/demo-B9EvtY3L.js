const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/nodefs-CSRXKdhZ.js","assets/index-BrblgM7Y.js","assets/index-hggXy5Dh.css","assets/opfs-ahp-D59yiVbY.js","assets/memfs2opfs-Dz1r7vX_.js"])))=>i.map(i=>d[i]);
import{_ as __vitePreload}from"./index-BrblgM7Y.js";class ApiError extends Error{code;constructor(r,M){super(r),this.code=M}}function toApiError(e){if(e instanceof ApiError)return e;const r=e;return new ApiError(r?.message??"Something went wrong.",r?.code)}const __vite_glob_0_0=`-- PGlite-only shim: recreates the small part of Supabase that the migrations rely on.
-- Never run this against a real Supabase project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  banned_until timestamptz,
  created_at timestamptz default now()
);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select auth.jwt() ->> 'role'
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
`,__vite_glob_1_0=`-- Ritestand portal · core schema
-- Every table: uuid key, timestamps in UTC. People and evidence are never deleted.

create schema if not exists app;

create type public.employee_status as enum ('pending', 'active', 'suspended', 'left');
create type public.app_role       as enum ('content_editor', 'company_admin', 'group_admin');
create type public.programme_kind as enum ('onboarding', 'refresher', 'department', 'certification');
create type public.programme_status as enum ('draft', 'active', 'archived');
create type public.content_status as enum ('draft', 'in_review', 'published', 'retired');
create type public.item_kind      as enum ('module', 'policy', 'task');
create type public.milestone      as enum ('day_1', 'week_1', 'month_1', 'later');
create type public.question_type  as enum ('single_choice', 'multi_choice', 'true_false', 'image_choice', 'written');
create type public.feedback_mode  as enum ('score_only', 'show_mistakes', 'show_answers');
create type public.attempt_status as enum ('in_progress', 'submitted', 'marked');
create type public.rule_trigger   as enum ('on_start', 'manual', 'recurring');
create type public.message_status as enum ('queued', 'sent', 'failed', 'skipped');

-- ───────────────────────── Organisation & people
create table public.companies (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  short_name     text,
  country        text not null default 'ZA' check (country ~ '^[A-Z]{2}$'),
  default_locale text not null default 'en' check (default_locale in ('en', 'pt')),
  logo_path      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz
);

create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies,
  parent_id   uuid references public.departments,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);

create table public.sites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies,
  name        text not null,
  country     text not null default 'ZA' check (country ~ '^[A-Z]{2}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);

create table public.positions (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies,
  title       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);

create table public.employees (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid unique references auth.users (id) on delete set null,
  employee_no    text,
  first_name     text not null check (length(trim(first_name)) > 0),
  last_name      text not null check (length(trim(last_name)) > 0),
  preferred_name text,
  email          text check (email is null or email ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'),  -- null until known; needed for Microsoft sign-in
  phone          text,
  company_id     uuid not null references public.companies,
  department_id  uuid references public.departments,
  site_id        uuid references public.sites,
  position_id    uuid references public.positions,
  manager_id     uuid references public.employees,
  buddy_id       uuid references public.employees,
  start_date     date,                    -- null = existing employee, date unknown
  status         public.employee_status not null default 'pending',
  locale         text not null default 'en' check (locale in ('en', 'pt')),
  first_sign_in_at timestamptz,
  tour_seen_at   timestamptz,             -- first-time tour finished or skipped
  left_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (manager_id is null or manager_id <> id)
);
create unique index employees_email_key on public.employees (lower(email));
create unique index employees_no_key on public.employees (company_id, employee_no) where employee_no is not null;

create table public.role_assignments (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees,
  role        public.app_role not null,
  company_id  uuid references public.companies,  -- null = whole group
  created_by  uuid references public.employees,
  created_at  timestamptz not null default now(),
  check (role <> 'company_admin' or company_id is not null),
  check (role <> 'group_admin' or company_id is null)
);
create unique index role_assignments_key
  on public.role_assignments (employee_id, role, coalesce(company_id, '00000000-0000-0000-0000-000000000000'));

-- ───────────────────────── Content
create table public.media_assets (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references public.companies,
  bucket        text not null default 'media',
  path          text not null unique,
  original_name text,
  mime          text,
  bytes         bigint,
  sha256        text,
  uploaded_by   uuid references public.employees,
  created_at    timestamptz not null default now()
);

create table public.modules (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid references public.companies,  -- null = group-wide
  code                text,                               -- e.g. "01"
  title               text not null,
  summary             text,
  owner_department_id uuid references public.departments,
  cover_asset_id      uuid references public.media_assets,
  review_by           date,
  current_version_id  uuid,
  created_by          uuid references public.employees,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz
);

create table public.module_versions (
  id              uuid primary key default gen_random_uuid(),
  module_id       uuid not null references public.modules,
  version_no      int not null,
  status          public.content_status not null default 'draft',
  title           text not null,
  summary         text,
  est_minutes     int not null default 0,
  change_note     text,
  material_change boolean not null default false,
  review_note     text,
  created_by      uuid references public.employees,
  submitted_by    uuid references public.employees,
  submitted_at    timestamptz,
  published_by    uuid references public.employees,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (module_id, version_no)
);
create unique index module_versions_one_open_draft on public.module_versions (module_id) where status in ('draft', 'in_review');
alter table public.modules add constraint modules_current_version_fk
  foreign key (current_version_id) references public.module_versions (id);

create table public.lessons (
  id                uuid primary key default gen_random_uuid(),
  module_version_id uuid not null references public.module_versions on delete cascade,
  lesson_key        uuid not null default gen_random_uuid(),  -- stable across versions; progress is tracked on it
  position          int not null,
  title             text not null,
  content           jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  est_minutes       int not null default 5,
  unique (module_version_id, lesson_key)
);

-- ───────────────────────── Assessments
create table public.assessments (
  id                 uuid primary key default gen_random_uuid(),
  module_version_id  uuid not null unique references public.module_versions on delete cascade,
  title              text not null,
  instructions       text,
  pass_mark          int not null default 80 check (pass_mark between 0 and 100),
  max_attempts       int default 3 check (max_attempts is null or max_attempts > 0),
  time_limit_minutes int check (time_limit_minutes is null or time_limit_minutes > 0),
  feedback_mode      public.feedback_mode not null default 'show_mistakes',
  draw_count         int check (draw_count is null or draw_count > 0),
  shuffle_questions  boolean not null default true,
  shuffle_options    boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.questions (
  id             uuid primary key default gen_random_uuid(),
  assessment_id  uuid not null references public.assessments on delete cascade,
  question_key   uuid not null default gen_random_uuid(),
  type           public.question_type not null,
  prompt         text not null,
  image_asset_id uuid references public.media_assets,
  points         int not null default 1 check (points > 0),
  explanation    text,
  position       int not null
);

create table public.question_options (
  id             uuid primary key default gen_random_uuid(),
  question_id    uuid not null references public.questions on delete cascade,
  label          text not null default '',
  image_asset_id uuid references public.media_assets,
  position       int not null
);

-- Never readable by employees: marking happens in the database.
create table public.answer_keys (
  question_id        uuid primary key references public.questions on delete cascade,
  correct_option_ids uuid[] not null default '{}',
  marking_guide      text
);

create table public.attempt_grants (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees,
  assessment_id  uuid not null references public.assessments,
  extra_attempts int not null default 1 check (extra_attempts > 0),
  reason         text,
  granted_by     uuid references public.employees,
  created_at     timestamptz not null default now()
);

create table public.attempts (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments,
  employee_id   uuid not null references public.employees,
  attempt_no    int not null,
  started_at    timestamptz not null default now(),
  expires_at    timestamptz,
  submitted_at  timestamptz,
  status        public.attempt_status not null default 'in_progress',
  question_ids  uuid[] not null,
  option_order  jsonb not null default '{}'::jsonb,
  score_points  numeric,
  max_points    numeric,
  score_pct     numeric(5, 2),
  passed        boolean,
  marked_by     uuid references public.employees,
  marked_at     timestamptz,
  unique (assessment_id, employee_id, attempt_no)
);

create table public.attempt_answers (
  attempt_id     uuid not null references public.attempts,
  question_id    uuid not null references public.questions,
  option_ids     uuid[] not null default '{}',
  text_answer    text,
  is_correct     boolean,
  points_awarded numeric,
  marker_comment text,
  updated_at     timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

-- ───────────────────────── Policies
create table public.policies (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid references public.companies,  -- null = group-wide
  title               text not null,
  category            text,
  owner_department_id uuid references public.departments,
  ack_required        boolean not null default true,
  current_version_id  uuid,
  created_by          uuid references public.employees,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz
);

create table public.policy_versions (
  id               uuid primary key default gen_random_uuid(),
  policy_id        uuid not null references public.policies,
  version_label    text not null,
  status           public.content_status not null default 'draft',
  body             jsonb,
  file_asset_id    uuid references public.media_assets,
  sha256           text,
  effective_date   date,
  change_summary   text,
  requires_reack   boolean not null default true,
  min_read_seconds int not null default 0 check (min_read_seconds >= 0),
  created_by       uuid references public.employees,
  published_by     uuid references public.employees,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (policy_id, version_label)
);
create unique index policy_versions_one_open_draft on public.policy_versions (policy_id) where status in ('draft', 'in_review');
alter table public.policies add constraint policies_current_version_fk
  foreign key (current_version_id) references public.policy_versions (id);

create table public.policy_audiences (
  id            uuid primary key default gen_random_uuid(),
  policy_id     uuid not null references public.policies on delete cascade,
  company_id    uuid references public.companies,
  department_id uuid references public.departments,
  position_id   uuid references public.positions,
  site_id       uuid references public.sites
);

create table public.policy_acknowledgements (
  id                uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references public.policy_versions,
  employee_id       uuid not null references public.employees,
  acknowledged_at   timestamptz not null default now(),
  statement         text not null,
  document_sha256   text,
  seconds_viewed    int not null default 0,
  user_agent        text,
  ip                text,
  unique (policy_version_id, employee_id)
);

-- ───────────────────────── Practical tasks
create table public.practical_tasks (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references public.companies,
  title        text not null,
  instructions text,
  created_by   uuid references public.employees,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz
);

create table public.sign_offs (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees,
  task_id     uuid not null references public.practical_tasks,
  signed_by   uuid not null references public.employees,
  signed_at   timestamptz not null default now(),
  note        text
);

-- ───────────────────────── Programmes & assignments
create table public.programmes (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid references public.companies,  -- null = group-wide
  title               text not null,
  description         text,
  kind                public.programme_kind not null default 'onboarding',
  status              public.programme_status not null default 'draft',
  sequential          boolean not null default true,
  certificate_enabled boolean not null default true,
  created_by          uuid references public.employees,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.programme_items (
  id              uuid primary key default gen_random_uuid(),
  programme_id    uuid not null references public.programmes,
  kind            public.item_kind not null,
  module_id       uuid references public.modules,
  policy_id       uuid references public.policies,
  task_id         uuid references public.practical_tasks,
  position        int not null,
  required        boolean not null default true,
  milestone       public.milestone not null default 'week_1',
  removed_at      timestamptz,
  created_at      timestamptz not null default now(),
  check ((kind = 'module') = (module_id is not null)),
  check ((kind = 'policy') = (policy_id is not null)),
  check ((kind = 'task')   = (task_id   is not null))
);

create table public.assignment_rules (
  id                uuid primary key default gen_random_uuid(),
  programme_id      uuid not null references public.programmes,
  company_id        uuid references public.companies,
  department_id     uuid references public.departments,
  position_id       uuid references public.positions,
  site_id           uuid references public.sites,
  trigger           public.rule_trigger not null default 'on_start',
  due_days          int not null default 30 check (due_days > 0),
  recurrence_months int check (recurrence_months is null or recurrence_months > 0),
  starts_on_or_after date,              -- only people starting on/after this date (new hires)
  starts_before      date,              -- only people who started before this date, or whose start date is unknown (existing staff)
  active            boolean not null default true,
  created_by        uuid references public.employees,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.assignments (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees,
  programme_id uuid not null references public.programmes,
  rule_id      uuid references public.assignment_rules on delete set null,
  cycle_no     int not null default 1,
  assigned_by  uuid references public.employees,
  assigned_at  timestamptz not null default now(),
  due_on       date not null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  unique (employee_id, programme_id, cycle_no)
);

create table public.lesson_progress (
  employee_id       uuid not null references public.employees,
  module_id         uuid not null references public.modules,
  lesson_key        uuid not null,
  module_version_id uuid references public.module_versions,
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  primary key (employee_id, module_id, lesson_key)
);

create table public.item_completions (
  id                 uuid primary key default gen_random_uuid(),
  assignment_id      uuid not null references public.assignments,
  programme_item_id  uuid not null references public.programme_items,
  completed_at       timestamptz not null default now(),
  module_version_id  uuid references public.module_versions,
  policy_version_id  uuid references public.policy_versions,
  attempt_id         uuid references public.attempts,
  acknowledgement_id uuid references public.policy_acknowledgements,
  sign_off_id        uuid references public.sign_offs,
  company_id         uuid references public.companies,      -- snapshot at completion
  department_id      uuid references public.departments,    -- snapshot at completion
  unique (assignment_id, programme_item_id)
);

create sequence public.certificate_no_seq start 1001;
create table public.certificates (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees,
  assignment_id  uuid not null unique references public.assignments,
  programme_id   uuid not null references public.programmes,
  title          text not null,
  certificate_no text not null unique,
  verify_code    text not null unique,
  issued_at      timestamptz not null default now(),
  expires_on     date
);

-- ───────────────────────── System
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees,
  kind        text not null,
  title       text not null,
  body        text,
  link        text,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

create table public.outbound_messages (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees,
  channel     text not null default 'email' check (channel in ('email', 'teams')),
  to_email    text not null,
  subject     text not null,
  body_text   text not null,
  template    text,
  dedupe_key  text unique,
  status      public.message_status not null default 'queued',
  error       text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create table public.activity_events (
  id          bigint generated always as identity primary key,
  employee_id uuid not null references public.employees,
  actor_id    uuid references public.employees,
  verb        text not null,
  object_type text,
  object_id   uuid,
  title       text,
  meta        jsonb not null default '{}'::jsonb,
  at          timestamptz not null default now()
);

create table public.audit_log (
  id                bigint generated always as identity primary key,
  actor_employee_id uuid,
  actor_user_id     uuid,
  company_id        uuid,
  action            text not null,
  table_name        text not null,
  row_id            uuid,
  before            jsonb,
  after             jsonb,
  at                timestamptz not null default now()
);

create table public.settings (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies,  -- null = group default
  key        text not null,
  value      jsonb not null,
  updated_by uuid references public.employees,
  updated_at timestamptz not null default now()
);
create unique index settings_key on public.settings (coalesce(company_id, '00000000-0000-0000-0000-000000000000'), key);

create table public.content_translations (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id   uuid not null,
  locale      text not null check (locale in ('en', 'pt')),
  fields      jsonb not null,
  updated_at  timestamptz not null default now(),
  unique (entity_type, entity_id, locale)
);

-- ───────────────────────── Indexes on foreign keys and permission columns
create index on public.departments (company_id);
create index on public.sites (company_id);
create index on public.positions (company_id);
create index on public.employees (company_id);
create index on public.employees (department_id);
create index on public.employees (manager_id);
create index on public.employees (user_id);
create index on public.role_assignments (employee_id);
create index on public.modules (company_id);
create index on public.module_versions (module_id);
create index on public.lessons (module_version_id);
create index on public.questions (assessment_id);
create index on public.question_options (question_id);
create index on public.attempts (employee_id);
create index on public.attempts (assessment_id);
create index on public.attempt_grants (employee_id, assessment_id);
create index on public.policies (company_id);
create index on public.policy_versions (policy_id);
create index on public.policy_audiences (policy_id);
create index on public.policy_acknowledgements (employee_id);
create index on public.sign_offs (employee_id, task_id);
create index on public.programmes (company_id);
create index on public.programme_items (programme_id);
create index on public.assignment_rules (programme_id);
create index on public.assignments (employee_id);
create index on public.assignments (programme_id);
create index on public.item_completions (assignment_id);
create index on public.certificates (employee_id);
create index on public.notifications (employee_id, read_at);
create index on public.activity_events (employee_id, at desc);
create index on public.audit_log (company_id, at desc);
`,__vite_glob_1_1=`-- Ritestand portal · permission helpers, Row Level Security, protective triggers, audit log.
-- Rule of thumb: reads go through RLS; writes only through security-definer functions that check the step.

-- ───────────────────────── Helpers (all security definer, fixed search_path)
create or replace function app.current_employee_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select e.id from public.employees e
  where e.user_id = auth.uid() and e.status in ('pending', 'active')
  limit 1
$$;

create or replace function app.current_company_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select e.company_id from public.employees e where e.id = app.current_employee_id()
$$;

create or replace function app.is_group_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.role_assignments r
    where r.employee_id = app.current_employee_id() and r.role = 'group_admin'
  )
$$;

-- null company = group-wide item: only group admins administer it.
create or replace function app.can_admin_company(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_group_admin() or exists (
    select 1 from public.role_assignments r
    where r.employee_id = app.current_employee_id()
      and r.role = 'company_admin' and r.company_id = p_company
  )
$$;

create or replace function app.is_any_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.role_assignments r
    where r.employee_id = app.current_employee_id() and r.role in ('company_admin', 'group_admin')
  )
$$;

-- Content editors scoped to a company edit that company's content; unscoped editors edit group-wide content too.
create or replace function app.can_edit_content(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.can_admin_company(p_company) or exists (
    select 1 from public.role_assignments r
    where r.employee_id = app.current_employee_id() and r.role = 'content_editor'
      and (r.company_id is null or r.company_id = p_company)
  )
$$;

create or replace function app.is_content_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.role_assignments r where r.employee_id = app.current_employee_id())
$$;

create or replace function app.manages(p_employee uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.employees e
    where e.id = p_employee and e.manager_id = app.current_employee_id()
  )
$$;

create or replace function app.can_view_employee(p_employee uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_employee = app.current_employee_id()
      or app.manages(p_employee)
      or exists (select 1 from public.employees e where e.id = p_employee and app.can_admin_company(e.company_id))
$$;

-- Visible to a learner: group-wide items, own company's items, or anything they administer/edit.
create or replace function app.can_see_company_item(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.current_employee_id() is not null
     and (p_company is null or p_company = app.current_company_id() or app.can_edit_content(p_company))
$$;

create or replace function app.require(p_ok boolean, p_message text default 'You do not have permission to do this.')
returns void language plpgsql as $$
begin
  if p_ok is not true then
    raise exception '%', p_message using errcode = '42501';
  end if;
end $$;

-- Every public API function starts with this. Returns the signed-in employee id.
create or replace function app.require_employee() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v uuid := app.current_employee_id();
begin
  if v is null then
    raise exception 'Sign in with your Ritestand Microsoft account first.' using errcode = '42501';
  end if;
  return v;
end $$;

-- ───────────────────────── Triggers
create or replace function app.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$ declare t text;
begin
  foreach t in array array['companies','departments','sites','positions','employees','modules','module_versions',
    'assessments','policies','policy_versions','practical_tasks','programmes','assignment_rules','settings','content_translations']
  loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;

-- Add-only evidence tables: no updates, no deletes, for anyone (administrators and service role included).
create or replace function app.prevent_change() returns trigger language plpgsql as $$
begin
  raise exception 'Records in % can only be added, never changed or deleted.', tg_table_name using errcode = '42501';
end $$;

do $$ declare t text;
begin
  foreach t in array array['policy_acknowledgements','item_completions','sign_offs','certificates','audit_log']
  loop
    execute format('create trigger add_only before update or delete on public.%I for each row execute function app.prevent_change()', t);
  end loop;
end $$;

-- Attempts freeze once marked; never deleted.
create or replace function app.guard_attempt() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Test attempts are never deleted.' using errcode = '42501';
  end if;
  if old.status = 'marked' then
    raise exception 'A marked test attempt cannot change.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_attempt before update or delete on public.attempts
  for each row execute function app.guard_attempt();

create or replace function app.guard_attempt_answer() returns trigger language plpgsql as $$
declare v_status public.attempt_status;
begin
  select a.status into v_status from public.attempts a where a.id = coalesce(old.attempt_id, new.attempt_id);
  if tg_op = 'DELETE' or v_status = 'marked' then
    raise exception 'Answers on a marked attempt cannot change.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_attempt_answer before update or delete on public.attempt_answers
  for each row execute function app.guard_attempt_answer();

-- Published module content is frozen. Edit = new draft version.
create or replace function app.version_is_open(p_version uuid) returns boolean
language sql stable as $$
  select exists (select 1 from public.module_versions v where v.id = p_version and v.status in ('draft', 'in_review'))
$$;

create or replace function app.guard_version_content() returns trigger language plpgsql as $$
declare v_version uuid;
begin
  if tg_table_name = 'lessons' or tg_table_name = 'assessments' then
    v_version := coalesce(new.module_version_id, old.module_version_id);
  elsif tg_table_name = 'questions' then
    select a.module_version_id into v_version from public.assessments a where a.id = coalesce(new.assessment_id, old.assessment_id);
  elsif tg_table_name = 'question_options' or tg_table_name = 'answer_keys' then
    select a.module_version_id into v_version
    from public.questions q join public.assessments a on a.id = q.assessment_id
    where q.id = coalesce(new.question_id, old.question_id);
  end if;
  if v_version is not null and not app.version_is_open(v_version) then
    raise exception 'Published content cannot change. Create a new draft version instead.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

do $$ declare t text;
begin
  foreach t in array array['lessons','assessments','questions','question_options','answer_keys']
  loop
    execute format('create trigger guard_version_content before insert or update or delete on public.%I for each row execute function app.guard_version_content()', t);
  end loop;
end $$;

create or replace function app.guard_published_version() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('published', 'retired') then
      raise exception 'Published versions are never deleted.' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status in ('published', 'retired') then
    -- Only allowed change: published → retired.
    if new.status = 'retired' and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
      return new;
    end if;
    raise exception 'Published versions cannot change. Create a new draft version instead.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_published_version before update or delete on public.module_versions
  for each row execute function app.guard_published_version();
create trigger guard_published_version before update or delete on public.policy_versions
  for each row execute function app.guard_published_version();

-- Audit log: who changed what, before and after.
create or replace function app.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_after  jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row    jsonb := coalesce(v_after, v_before);
begin
  if tg_op = 'UPDATE' and (v_before - 'updated_at') = (v_after - 'updated_at') then
    return new;
  end if;
  insert into public.audit_log (actor_employee_id, actor_user_id, company_id, action, table_name, row_id, before, after)
  values (app.current_employee_id(), auth.uid(),
          coalesce((v_row ->> 'company_id')::uuid,
                   case when tg_table_name = 'role_assignments'
                        then (select e.company_id from public.employees e where e.id = (v_row ->> 'employee_id')::uuid) end),
          lower(tg_op), tg_table_name, (v_row ->> 'id')::uuid, v_before, v_after);
  return coalesce(new, old);
end $$;

do $$ declare t text;
begin
  foreach t in array array['companies','departments','sites','positions','employees','role_assignments','modules',
    'module_versions','policies','policy_versions','policy_audiences','practical_tasks','programmes','programme_items',
    'assignment_rules','assignments','attempt_grants','settings']
  loop
    execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function app.audit_row()', t);
  end loop;
end $$;

-- ───────────────────────── Row Level Security (reads). No table accepts direct writes from the browser.
alter table public.companies               enable row level security;
alter table public.departments             enable row level security;
alter table public.sites                   enable row level security;
alter table public.positions               enable row level security;
alter table public.employees               enable row level security;
alter table public.role_assignments        enable row level security;
alter table public.media_assets            enable row level security;
alter table public.modules                 enable row level security;
alter table public.module_versions         enable row level security;
alter table public.lessons                 enable row level security;
alter table public.assessments             enable row level security;
alter table public.questions               enable row level security;
alter table public.question_options        enable row level security;
alter table public.answer_keys             enable row level security;
alter table public.attempt_grants          enable row level security;
alter table public.attempts                enable row level security;
alter table public.attempt_answers         enable row level security;
alter table public.policies                enable row level security;
alter table public.policy_versions         enable row level security;
alter table public.policy_audiences        enable row level security;
alter table public.policy_acknowledgements enable row level security;
alter table public.practical_tasks         enable row level security;
alter table public.sign_offs               enable row level security;
alter table public.programmes              enable row level security;
alter table public.programme_items         enable row level security;
alter table public.assignment_rules        enable row level security;
alter table public.assignments             enable row level security;
alter table public.lesson_progress         enable row level security;
alter table public.item_completions        enable row level security;
alter table public.certificates            enable row level security;
alter table public.notifications           enable row level security;
alter table public.outbound_messages       enable row level security;
alter table public.activity_events         enable row level security;
alter table public.audit_log               enable row level security;
alter table public.settings                enable row level security;
alter table public.content_translations    enable row level security;

-- Organisation structure is not sensitive: every signed-in employee can read it.
create policy read_org on public.companies   for select to authenticated using (app.current_employee_id() is not null);
create policy read_org on public.departments for select to authenticated using (app.current_employee_id() is not null);
create policy read_org on public.sites       for select to authenticated using (app.current_employee_id() is not null);
create policy read_org on public.positions   for select to authenticated using (app.current_employee_id() is not null);
create policy read_org on public.settings    for select to authenticated using (app.current_employee_id() is not null);
create policy read_org on public.media_assets for select to authenticated using (app.current_employee_id() is not null);
create policy read_org on public.content_translations for select to authenticated using (app.current_employee_id() is not null);

-- People: yourself, your direct reports, or the companies you administer.
create policy read_people on public.employees for select to authenticated using (app.can_view_employee(id));
create policy read_roles on public.role_assignments for select to authenticated using (app.can_view_employee(employee_id));

-- Content: learners read published content of their company and group-wide; editors read drafts they may edit.
create policy read_content on public.modules for select to authenticated using (app.can_see_company_item(company_id));
create policy read_content on public.module_versions for select to authenticated using (
  exists (select 1 from public.modules m where m.id = module_id
          and ((status in ('published', 'retired') and app.can_see_company_item(m.company_id)) or app.can_edit_content(m.company_id))));
create policy read_content on public.lessons for select to authenticated using (
  exists (select 1 from public.module_versions v join public.modules m on m.id = v.module_id where v.id = module_version_id
          and ((v.status in ('published', 'retired') and app.can_see_company_item(m.company_id)) or app.can_edit_content(m.company_id))));
create policy read_content on public.assessments for select to authenticated using (
  exists (select 1 from public.module_versions v join public.modules m on m.id = v.module_id where v.id = module_version_id
          and ((v.status in ('published', 'retired') and app.can_see_company_item(m.company_id)) or app.can_edit_content(m.company_id))));
-- Questions, options and keys: editors only. Learners receive questions through start_attempt/get_attempt, without keys.
create policy edit_only on public.questions for select to authenticated using (
  exists (select 1 from public.assessments a join public.module_versions v on v.id = a.module_version_id
          join public.modules m on m.id = v.module_id where a.id = assessment_id and app.can_edit_content(m.company_id)));
create policy edit_only on public.question_options for select to authenticated using (
  exists (select 1 from public.questions q join public.assessments a on a.id = q.assessment_id join public.module_versions v on v.id = a.module_version_id
          join public.modules m on m.id = v.module_id where q.id = question_id and app.can_edit_content(m.company_id)));
create policy edit_only on public.answer_keys for select to authenticated using (
  exists (select 1 from public.questions q join public.assessments a on a.id = q.assessment_id join public.module_versions v on v.id = a.module_version_id
          join public.modules m on m.id = v.module_id where q.id = question_id and app.can_edit_content(m.company_id)));

create policy read_own on public.attempts        for select to authenticated using (app.can_view_employee(employee_id));
create policy read_own on public.attempt_answers for select to authenticated using (
  exists (select 1 from public.attempts a where a.id = attempt_id and app.can_view_employee(a.employee_id)));
create policy read_own on public.attempt_grants  for select to authenticated using (app.can_view_employee(employee_id));

create policy read_content on public.policies for select to authenticated using (app.can_see_company_item(company_id));
create policy read_content on public.policy_versions for select to authenticated using (
  exists (select 1 from public.policies p where p.id = policy_id
          and ((status in ('published', 'retired') and app.can_see_company_item(p.company_id)) or app.can_admin_company(p.company_id))));
create policy read_content on public.policy_audiences for select to authenticated using (
  exists (select 1 from public.policies p where p.id = policy_id and app.can_see_company_item(p.company_id)));
create policy read_own on public.policy_acknowledgements for select to authenticated using (app.can_view_employee(employee_id));

create policy read_content on public.practical_tasks for select to authenticated using (app.can_see_company_item(company_id));
create policy read_own on public.sign_offs for select to authenticated using (app.can_view_employee(employee_id));

create policy read_content on public.programmes for select to authenticated using (app.can_see_company_item(company_id));
create policy read_content on public.programme_items for select to authenticated using (
  exists (select 1 from public.programmes p where p.id = programme_id and app.can_see_company_item(p.company_id)));
create policy admin_only on public.assignment_rules for select to authenticated using (
  exists (select 1 from public.programmes p where p.id = programme_id and (app.can_admin_company(p.company_id) or app.can_admin_company(company_id))));

create policy read_own on public.assignments      for select to authenticated using (app.can_view_employee(employee_id));
create policy read_own on public.lesson_progress  for select to authenticated using (app.can_view_employee(employee_id));
create policy read_own on public.item_completions for select to authenticated using (
  exists (select 1 from public.assignments a where a.id = assignment_id and app.can_view_employee(a.employee_id)));
create policy read_own on public.certificates     for select to authenticated using (app.can_view_employee(employee_id));
create policy read_own on public.activity_events  for select to authenticated using (app.can_view_employee(employee_id));
create policy read_self on public.notifications   for select to authenticated using (employee_id = app.current_employee_id());
create policy admin_only on public.outbound_messages for select to authenticated using (
  exists (select 1 from public.employees e where e.id = employee_id and app.can_admin_company(e.company_id)));
create policy admin_only on public.audit_log for select to authenticated using (
  app.is_group_admin() or (company_id is not null and app.can_admin_company(company_id)));

-- ───────────────────────── Grants. Run at the end of every migration.
-- Supabase grants everything to anon/authenticated by default; this takes it back.
create or replace function app.lock_down() returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p') loop
    execute format('alter table public.%I enable row level security', r.relname);
    execute format('revoke all on public.%I from anon, authenticated', r.relname);
    execute format('grant select on public.%I to authenticated', r.relname);
    execute format('grant all on public.%I to service_role', r.relname);
  end loop;
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'S' loop
    execute format('revoke all on sequence public.%I from anon, authenticated', r.relname);
  end loop;
  -- API functions: callable by signed-in users only (each one also calls app.require_employee()).
  for r in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f' loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    if r.proname like 'hook\\_%' or r.proname = 'custom_access_token_hook' then
      execute format('revoke execute on function %s from authenticated', r.sig);
      execute format('grant execute on function %s to supabase_auth_admin', r.sig);
    elsif r.proname like 'public\\_%' then
      execute format('grant execute on function %s to anon, authenticated', r.sig);
    else
      execute format('grant execute on function %s to authenticated, service_role', r.sig);
    end if;
  end loop;
  -- Helpers are used inside RLS policies, so signed-in users may execute them (they only return booleans/ids).
  grant usage on schema app to authenticated, service_role;
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'app' and p.prokind = 'f' loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;

select app.lock_down();
`,__vite_glob_1_2=`-- Ritestand portal · core logic (assignment, notifications, activity) and sign-in hooks.

create or replace function app.log_activity(p_employee uuid, p_verb text, p_object_type text, p_object_id uuid,
                                            p_title text, p_meta jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.activity_events (employee_id, actor_id, verb, object_type, object_id, title, meta)
  values (p_employee, app.current_employee_id(), p_verb, p_object_type, p_object_id, p_title, coalesce(p_meta, '{}'::jsonb))
$$;

create or replace function app.notify(p_employee uuid, p_kind text, p_title text, p_body text default null, p_link text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (employee_id, kind, title, body, link) values (p_employee, p_kind, p_title, p_body, p_link)
$$;

create or replace function app.queue_email(p_employee uuid, p_subject text, p_body text, p_template text, p_dedupe text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  select e.email into v_email from public.employees e where e.id = p_employee and e.status in ('pending', 'active');
  if v_email is null then return; end if;
  insert into public.outbound_messages (employee_id, to_email, subject, body_text, template, dedupe_key)
  values (p_employee, v_email, p_subject, p_body, p_template, p_dedupe)
  on conflict (dedupe_key) do nothing;
end $$;

create or replace function app.setting(p_company uuid, p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select s.value from public.settings s
  where s.key = p_key and (s.company_id = p_company or s.company_id is null)
  order by s.company_id nulls last limit 1
$$;

create or replace function app.display_name(e public.employees) returns text
language sql immutable as $$ select coalesce(nullif(e.preferred_name, ''), e.first_name) || ' ' || e.last_name $$;

-- ───────────────────────── Assignment
create or replace function app.rule_matches(r public.assignment_rules, e public.employees) returns boolean
language sql stable as $$
  select coalesce(r.active, false)
     and (r.company_id    is null or r.company_id    is not distinct from e.company_id)
     and (r.department_id is null or r.department_id is not distinct from e.department_id)
     and (r.position_id   is null or r.position_id   is not distinct from e.position_id)
     and (r.site_id       is null or r.site_id       is not distinct from e.site_id)
     and (r.starts_on_or_after is null or coalesce(e.start_date >= r.starts_on_or_after, false))
     and (r.starts_before      is null or e.start_date is null or e.start_date < r.starts_before)
$$;

-- Gives one programme to one employee. Returns the open assignment (existing or new).
create or replace function app.assign(p_employee uuid, p_programme uuid, p_due date,
                                      p_rule uuid default null, p_by uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_cycle int;
  v_title text;
begin
  select a.id into v_id from public.assignments a
  where a.employee_id = p_employee and a.programme_id = p_programme
    and a.completed_at is null and a.cancelled_at is null;
  if v_id is not null then return v_id; end if;

  select coalesce(max(a.cycle_no), 0) + 1 into v_cycle from public.assignments a
  where a.employee_id = p_employee and a.programme_id = p_programme;
  -- A completed programme is only re-assigned by a recurring rule or a deliberate manual assignment.
  insert into public.assignments (employee_id, programme_id, rule_id, cycle_no, assigned_by, due_on)
  values (p_employee, p_programme, p_rule, v_cycle, p_by, p_due)
  returning id into v_id;

  select p.title into v_title from public.programmes p where p.id = p_programme;
  perform app.log_activity(p_employee, 'assigned', 'programme', p_programme, v_title, jsonb_build_object('due_on', p_due));
  perform app.notify(p_employee, 'assigned', 'New training: ' || v_title,
                     'Due on ' || to_char(p_due, 'DD Mon YYYY') || '.', '/learning');
  return v_id;
end $$;

-- Applies every matching on-start / recurring rule to one employee (first cycle only).
create or replace function app.auto_assign(p_employee uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  e public.employees;
  r public.assignment_rules;
  n int := 0;
begin
  select * into e from public.employees where id = p_employee;
  if e.id is null or e.status not in ('pending', 'active') then return 0; end if;
  for r in
    select ar.* from public.assignment_rules ar
    join public.programmes p on p.id = ar.programme_id
    where p.status = 'active' and ar.trigger in ('on_start', 'recurring')
      and (p.company_id is null or p.company_id = e.company_id)
  loop
    continue when not app.rule_matches(r, e);
    continue when exists (select 1 from public.assignments a where a.employee_id = e.id and a.programme_id = r.programme_id);
    perform app.assign(e.id, r.programme_id, greatest(coalesce(e.start_date, current_date), current_date) + r.due_days, r.id, null);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function app.employees_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT'
     or new.company_id is distinct from old.company_id or new.department_id is distinct from old.department_id
     or new.position_id is distinct from old.position_id or new.site_id is distinct from old.site_id
     or new.start_date is distinct from old.start_date
     or (new.status in ('pending', 'active') and old.status not in ('pending', 'active')) then
    perform app.auto_assign(new.id);
  end if;
  return null;
end $$;
create trigger employees_after_write after insert or update on public.employees
  for each row execute function app.employees_after_write();

-- Progress of one assignment: completed / total items, per milestone.
create or replace function app.assignment_summary(p_assignment uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with a as (select * from public.assignments where id = p_assignment),
  items as (
    select pi.*, ic.completed_at
    from a join public.programme_items pi on pi.programme_id = a.programme_id and pi.removed_at is null
    left join public.item_completions ic on ic.assignment_id = a.id and ic.programme_item_id = pi.id
  )
  select jsonb_build_object(
    'total',     (select count(*) from items),
    'required',  (select count(*) from items where required),
    'completed', (select count(*) from items where completed_at is not null),
    'pct',       (select case when count(*) = 0 then 0
                          else round(100.0 * count(*) filter (where completed_at is not null) / count(*)) end from items))
$$;

-- ───────────────────────── Sign-in: link the Microsoft account to the employee record
create or replace function app.link_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid;
begin
  update public.employees e
     set user_id = new.id,
         status = case when e.status = 'pending' then 'active'::public.employee_status else e.status end,
         first_sign_in_at = coalesce(e.first_sign_in_at, now())
   where lower(e.email) = lower(new.email) and e.user_id is null and e.status in ('pending', 'active')
  returning e.id into v_emp;
  if v_emp is not null then
    perform app.log_activity(v_emp, 'first_sign_in', 'employee', v_emp, 'Signed in for the first time');
  end if;
  return new;
end $$;
create trigger link_auth_user after insert on auth.users
  for each row execute function app.link_auth_user();

-- Supabase "Before User Created" hook: only people HR has added can get an account.
create or replace function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(event -> 'user' ->> 'email');
begin
  if v_email is not null and exists (
    select 1 from public.employees e where lower(e.email) = v_email and e.status in ('pending', 'active')
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'This Microsoft account is not on the Ritestand employee list. Ask HR to add you.'));
end $$;

-- Supabase "Custom Access Token" hook: adds employee id and roles to the session (for the UI only;
-- permission checks always read the tables).
create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_emp uuid;
  v_roles jsonb;
begin
  select e.id into v_emp from public.employees e
  where e.user_id = (event ->> 'user_id')::uuid and e.status in ('pending', 'active');
  select coalesce(jsonb_agg(distinct r.role), '[]'::jsonb) into v_roles
  from public.role_assignments r where r.employee_id = v_emp;
  v_claims := v_claims || jsonb_build_object('employee_id', v_emp, 'app_roles', v_roles);
  return jsonb_set(event, '{claims}', v_claims);
end $$;

select app.lock_down();
`,__vite_glob_1_3=`-- Ritestand portal · API, basics: session, organisation, dashboard, notifications, people admin.
-- Convention: every API function is public.<name>(p jsonb) returns jsonb and starts with app.require_employee().

create or replace function app.employee_brief(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', e.id, 'name', app.display_name(e), 'email', e.email)
  from public.employees e where e.id = p_id
$$;

create or replace function app.item_title(pi public.programme_items) returns text
language sql stable security definer set search_path = '' as $$
  select case pi.kind
    when 'module' then (select coalesce(m.code || ' · ', '') || m.title from public.modules m where m.id = pi.module_id)
    when 'policy' then (select p.title from public.policies p where p.id = pi.policy_id)
    when 'task'   then (select t.title from public.practical_tasks t where t.id = pi.task_id)
  end
$$;

create or replace function app.assignment_json(p_assignment uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', a.id,
    'programme', jsonb_build_object('id', p.id, 'title', p.title, 'kind', p.kind, 'description', p.description, 'sequential', p.sequential),
    'cycle_no', a.cycle_no,
    'assigned_at', a.assigned_at,
    'due_on', a.due_on,
    'completed_at', a.completed_at,
    'cancelled_at', a.cancelled_at,
    'state', case
      when a.cancelled_at is not null then 'cancelled'
      when a.completed_at is not null then 'completed'
      when a.due_on < current_date then 'overdue'
      when a.due_on <= current_date + 3 then 'due_soon'
      else 'on_track' end,
    'summary', app.assignment_summary(a.id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pi.id, 'kind', pi.kind, 'title', app.item_title(pi), 'milestone', pi.milestone,
        'required', pi.required, 'position', pi.position,
        'ref_id', coalesce(pi.module_id, pi.policy_id, pi.task_id),
        'completed_at', ic.completed_at) order by pi.position)
      from public.programme_items pi
      left join public.item_completions ic on ic.assignment_id = a.id and ic.programme_item_id = pi.id
      where pi.programme_id = a.programme_id and pi.removed_at is null), '[]'::jsonb))
  from public.assignments a join public.programmes p on p.id = a.programme_id
  where a.id = p_assignment
$$;

-- ───────────────────────── Session
create or replace function public.me(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_emp uuid := app.require_employee();
  e public.employees;
begin
  select * into e from public.employees where id = v_emp;
  return jsonb_build_object(
    'employee', jsonb_build_object(
      'id', e.id, 'first_name', e.first_name, 'last_name', e.last_name, 'preferred_name', e.preferred_name,
      'display_name', app.display_name(e), 'email', e.email, 'phone', e.phone, 'employee_no', e.employee_no,
      'start_date', e.start_date, 'status', e.status, 'locale', e.locale, 'tour_seen_at', e.tour_seen_at,
      'company_id', e.company_id, 'department_id', e.department_id, 'position_id', e.position_id, 'site_id', e.site_id),
    'company', (select jsonb_build_object('id', c.id, 'name', c.name, 'short_name', c.short_name, 'country', c.country)
                from public.companies c where c.id = e.company_id),
    'department', (select d.name from public.departments d where d.id = e.department_id),
    'position', (select x.title from public.positions x where x.id = e.position_id),
    'site', (select s.name from public.sites s where s.id = e.site_id),
    'manager', app.employee_brief(e.manager_id),
    'buddy', app.employee_brief(e.buddy_id),
    'roles', (select coalesce(jsonb_agg(jsonb_build_object('role', r.role, 'company_id', r.company_id)), '[]'::jsonb)
              from public.role_assignments r where r.employee_id = v_emp),
    'is_manager', exists (select 1 from public.employees x where x.manager_id = v_emp and x.status in ('pending', 'active')),
    'is_group_admin', app.is_group_admin(),
    'is_admin', app.is_any_admin(),
    'is_content_staff', app.is_content_staff(),
    'admin_company_ids', (select coalesce(jsonb_agg(c.id), '[]'::jsonb) from public.companies c where app.can_admin_company(c.id)),
    'unread_notifications', (select count(*) from public.notifications n where n.employee_id = v_emp and n.read_at is null));
end $$;

create or replace function public.org_lookup(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_employee();
  return jsonb_build_object(
    'companies', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'short_name', c.short_name,
                    'country', c.country, 'default_locale', c.default_locale, 'can_admin', app.can_admin_company(c.id)) order by c.name), '[]'::jsonb)
                  from public.companies c where c.archived_at is null),
    'departments', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'company_id', d.company_id, 'name', d.name, 'parent_id', d.parent_id) order by d.name), '[]'::jsonb)
                    from public.departments d where d.archived_at is null),
    'sites', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'company_id', s.company_id, 'name', s.name, 'country', s.country) order by s.name), '[]'::jsonb)
              from public.sites s where s.archived_at is null),
    'positions', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'company_id', x.company_id, 'title', x.title) order by x.title), '[]'::jsonb)
                  from public.positions x where x.archived_at is null));
end $$;

-- ───────────────────────── Employee dashboard (basic)
create or replace function public.my_dashboard(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_emp uuid := app.require_employee();
  e public.employees;
begin
  select * into e from public.employees where id = v_emp;
  return jsonb_build_object(
    'first_name', coalesce(nullif(e.preferred_name, ''), e.first_name),
    'start_date', e.start_date,
    'day_number', case when e.start_date is not null then greatest(1, current_date - e.start_date + 1) end,
    'assignments', (select coalesce(jsonb_agg(app.assignment_json(a.id) order by (a.completed_at is not null), a.due_on), '[]'::jsonb)
                    from public.assignments a where a.employee_id = v_emp and a.cancelled_at is null),
    'policies_pending', app.pending_policy_count(v_emp),
    'certificates', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'certificate_no', c.certificate_no,
                       'issued_at', c.issued_at) order by c.issued_at desc), '[]'::jsonb)
                     from public.certificates c where c.employee_id = v_emp),
    'manager', app.employee_brief(e.manager_id),
    'buddy', app.employee_brief(e.buddy_id));
end $$;

-- ───────────────────────── Notifications & profile
create or replace function public.my_notifications(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_emp uuid := app.require_employee();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body,
            'link', n.link, 'created_at', n.created_at, 'read_at', n.read_at) order by n.created_at desc), '[]'::jsonb)
          from (select * from public.notifications where employee_id = v_emp order by created_at desc limit 100) n);
end $$;

create or replace function public.mark_notifications_read(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := app.require_employee(); v_n int;
begin
  update public.notifications set read_at = now()
  where employee_id = v_emp and read_at is null
    and (p -> 'ids' is null or id in (select (jsonb_array_elements_text(p -> 'ids'))::uuid));
  get diagnostics v_n = row_count;
  return jsonb_build_object('updated', v_n);
end $$;

create or replace function public.update_my_profile(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := app.require_employee();
begin
  update public.employees set
    preferred_name = case when p ? 'preferred_name' then nullif(trim(p ->> 'preferred_name'), '') else preferred_name end,
    phone          = case when p ? 'phone' then nullif(trim(p ->> 'phone'), '') else phone end,
    locale         = case when p ? 'locale' then p ->> 'locale' else locale end
  where id = v_emp;
  return public.me('{}'::jsonb);
end $$;

create or replace function public.mark_tour_seen(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := app.require_employee();
begin
  update public.employees set tour_seen_at = coalesce(tour_seen_at, now()) where id = v_emp;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── People admin
create or replace function app.employee_row(e public.employees) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'name', app.display_name(e), 'first_name', e.first_name, 'last_name', e.last_name,
    'preferred_name', e.preferred_name, 'email', e.email, 'phone', e.phone, 'employee_no', e.employee_no,
    'company_id', e.company_id, 'department_id', e.department_id, 'site_id', e.site_id, 'position_id', e.position_id,
    'manager_id', e.manager_id, 'buddy_id', e.buddy_id, 'start_date', e.start_date, 'status', e.status, 'locale', e.locale,
    'first_sign_in_at', e.first_sign_in_at, 'left_at', e.left_at,
    'company', (select c.short_name from public.companies c where c.id = e.company_id),
    'department', (select d.name from public.departments d where d.id = e.department_id),
    'position', (select x.title from public.positions x where x.id = e.position_id),
    'site', (select s.name from public.sites s where s.id = e.site_id),
    'manager', (select app.display_name(m) from public.employees m where m.id = e.manager_id),
    'roles', (select coalesce(jsonb_agg(r.role), '[]'::jsonb) from public.role_assignments r where r.employee_id = e.id),
    'open_assignments', (select count(*) from public.assignments a where a.employee_id = e.id and a.completed_at is null and a.cancelled_at is null),
    'overdue', exists (select 1 from public.assignments a where a.employee_id = e.id and a.completed_at is null
                       and a.cancelled_at is null and a.due_on < current_date),
    'progress_pct', (select (app.assignment_summary(a.id) ->> 'pct')::int from public.assignments a
                     where a.employee_id = e.id and a.cancelled_at is null
                     order by (a.completed_at is null) desc, a.assigned_at desc limit 1))
$$;

create or replace function public.admin_list_employees(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := nullif(lower(trim(p ->> 'q')), '');
begin
  perform app.require_employee();
  perform app.require(app.is_any_admin());
  return (select coalesce(jsonb_agg(app.employee_row(e) order by e.last_name, e.first_name), '[]'::jsonb)
          from public.employees e
          where app.can_admin_company(e.company_id)
            and (p ->> 'company_id' is null or e.company_id = (p ->> 'company_id')::uuid)
            and (p ->> 'department_id' is null or e.department_id = (p ->> 'department_id')::uuid)
            and (p ->> 'status' is null or e.status::text = p ->> 'status')
            and (v_q is null or lower(e.first_name || ' ' || e.last_name || ' ' || coalesce(e.preferred_name, '') || ' ' || e.email
                                     || ' ' || coalesce(e.employee_no, '')) like '%' || v_q || '%'));
end $$;

create or replace function public.admin_get_employee(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  e public.employees;
begin
  perform app.require_employee();
  perform app.require(app.can_view_employee(v_id));
  select * into e from public.employees where id = v_id;
  return app.employee_row(e) || jsonb_build_object(
    'can_edit', app.can_admin_company(e.company_id),
    'buddy', app.employee_brief(e.buddy_id),
    'role_assignments', (select coalesce(jsonb_agg(jsonb_build_object('role', r.role, 'company_id', r.company_id)), '[]'::jsonb)
                         from public.role_assignments r where r.employee_id = e.id),
    'assignments', (select coalesce(jsonb_agg(app.assignment_json(a.id) order by a.assigned_at desc), '[]'::jsonb)
                    from public.assignments a where a.employee_id = e.id),
    'certificates', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'certificate_no', c.certificate_no,
                       'issued_at', c.issued_at) order by c.issued_at desc), '[]'::jsonb)
                     from public.certificates c where c.employee_id = e.id),
    'timeline', (select coalesce(jsonb_agg(jsonb_build_object('at', t.at, 'verb', t.verb, 'title', t.title,
                   'object_type', t.object_type, 'actor', (select app.display_name(x) from public.employees x where x.id = t.actor_id))
                   order by t.at desc), '[]'::jsonb)
                 from (select * from public.activity_events where employee_id = e.id order by at desc limit 60) t),
    'direct_reports', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', app.display_name(r))), '[]'::jsonb)
                       from public.employees r where r.manager_id = e.id and r.status in ('pending', 'active')));
end $$;

create or replace function app.check_org_fit(p_company uuid, p_department uuid, p_site uuid, p_position uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_department is not null and not exists (select 1 from public.departments where id = p_department and company_id = p_company) then
    raise exception 'That department belongs to another company.' using errcode = '22023';
  end if;
  if p_site is not null and not exists (select 1 from public.sites where id = p_site and company_id = p_company) then
    raise exception 'That site belongs to another company.' using errcode = '22023';
  end if;
  if p_position is not null and not exists (select 1 from public.positions where id = p_position and company_id = p_company) then
    raise exception 'That position belongs to another company.' using errcode = '22023';
  end if;
end $$;

create or replace function public.admin_save_employee(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_company uuid := (p ->> 'company_id')::uuid;
  v_old public.employees;
  v_department uuid := nullif(p ->> 'department_id', '')::uuid;
  v_site uuid := nullif(p ->> 'site_id', '')::uuid;
  v_position uuid := nullif(p ->> 'position_id', '')::uuid;
begin
  perform app.require(v_company is not null, 'Choose a company.');
  perform app.require(app.can_admin_company(v_company), 'You can only manage people in companies you administer.');
  perform app.check_org_fit(v_company, v_department, v_site, v_position);

  if v_id is null then
    insert into public.employees (first_name, last_name, preferred_name, email, phone, employee_no, company_id,
                                  department_id, site_id, position_id, manager_id, buddy_id, start_date, locale)
    values (trim(p ->> 'first_name'), trim(p ->> 'last_name'), nullif(trim(p ->> 'preferred_name'), ''), nullif(lower(trim(p ->> 'email')), ''),
            nullif(trim(p ->> 'phone'), ''), nullif(trim(p ->> 'employee_no'), ''), v_company, v_department, v_site, v_position,
            nullif(p ->> 'manager_id', '')::uuid, nullif(p ->> 'buddy_id', '')::uuid,
            nullif(p ->> 'start_date', '')::date,
            coalesce(nullif(p ->> 'locale', ''), (select c.default_locale from public.companies c where c.id = v_company)))
    returning id into v_id;
    perform app.log_activity(v_id, 'added', 'employee', v_id, 'Added to the portal');
  else
    select * into v_old from public.employees where id = v_id;
    perform app.require(v_old.id is not null, 'That person no longer exists.');
    perform app.require(app.can_admin_company(v_old.company_id), 'You can only manage people in companies you administer.');
    update public.employees set
      first_name = trim(p ->> 'first_name'), last_name = trim(p ->> 'last_name'),
      preferred_name = nullif(trim(p ->> 'preferred_name'), ''), email = nullif(lower(trim(p ->> 'email')), ''),
      phone = nullif(trim(p ->> 'phone'), ''), employee_no = nullif(trim(p ->> 'employee_no'), ''),
      company_id = v_company, department_id = v_department, site_id = v_site, position_id = v_position,
      manager_id = nullif(p ->> 'manager_id', '')::uuid, buddy_id = nullif(p ->> 'buddy_id', '')::uuid,
      start_date = nullif(p ->> 'start_date', '')::date,
      locale = coalesce(nullif(p ->> 'locale', ''), locale)
    where id = v_id;
  end if;
  return jsonb_build_object('id', v_id);
exception
  when unique_violation then
    raise exception 'Someone with this email or employee number already exists.' using errcode = '23505';
  when check_violation then
    raise exception 'Check the name and email address.' using errcode = '23514';
end $$;

create or replace function public.admin_set_employee_status(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  v_id uuid := (p ->> 'id')::uuid;
  v_status public.employee_status := (p ->> 'status')::public.employee_status;
  e public.employees;
begin
  select * into e from public.employees where id = v_id;
  perform app.require(e.id is not null and app.can_admin_company(e.company_id));
  perform app.require(v_id <> v_me or v_status in ('pending', 'active'), 'You cannot deactivate yourself.');
  update public.employees set
    status = case when v_status = 'active' and user_id is null then 'pending'::public.employee_status else v_status end,
    left_at = case when v_status = 'left' then now() else null end
  where id = v_id;
  if v_status = 'left' then
    update public.assignments set cancelled_at = now() where employee_id = v_id and completed_at is null and cancelled_at is null;
  end if;
  perform app.log_activity(v_id, 'status_' || v_status::text, 'employee', v_id,
    case v_status when 'left' then 'Marked as left' when 'suspended' then 'Access suspended' else 'Access restored' end);
  -- Sessions are revoked by the deactivate-user Edge Function, which the admin screen calls next.
  return jsonb_build_object('id', v_id, 'status', v_status, 'user_id', e.user_id);
end $$;

create or replace function public.admin_set_role(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  v_emp uuid := (p ->> 'employee_id')::uuid;
  v_role public.app_role := (p ->> 'role')::public.app_role;
  v_company uuid := nullif(p ->> 'company_id', '')::uuid;
  v_enabled boolean := coalesce((p ->> 'enabled')::boolean, true);
begin
  if v_role = 'group_admin' then
    perform app.require(app.is_group_admin(), 'Only a group administrator can change group administrators.');
    v_company := null;
  else
    perform app.require(v_role <> 'company_admin' or v_company is not null, 'Choose the company.');
    perform app.require(case when v_company is null then app.is_group_admin() else app.can_admin_company(v_company) end);
  end if;
  perform app.require(exists (select 1 from public.employees e where e.id = v_emp and e.status in ('pending', 'active')),
                      'Roles can only be given to current employees.');
  if v_enabled then
    insert into public.role_assignments (employee_id, role, company_id, created_by)
    values (v_emp, v_role, v_company, v_me) on conflict do nothing;
  else
    if v_role = 'group_admin' and (select count(*) from public.role_assignments where role = 'group_admin') <= 1 then
      raise exception 'The portal needs at least one group administrator.' using errcode = '42501';
    end if;
    delete from public.role_assignments
    where employee_id = v_emp and role = v_role and company_id is not distinct from v_company;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- CSV import. Rows use names (company, department, position, site, manager_email). dry_run validates only.
create or replace function public.admin_import_employees(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  v_dry boolean := coalesce((p ->> 'dry_run')::boolean, true);
  v_create boolean := coalesce((p ->> 'create_missing')::boolean, true);
  r jsonb;
  i int := 0;
  v_results jsonb := '[]'::jsonb;
  v_company uuid; v_department uuid; v_position uuid; v_site uuid; v_existing uuid; v_new uuid;
  v_err text; v_action text;
begin
  perform app.require(app.is_any_admin());
  for r in select * from jsonb_array_elements(coalesce(p -> 'rows', '[]'::jsonb)) loop
    i := i + 1; v_err := null; v_action := null;
    v_department := null; v_position := null; v_site := null;
    select c.id into v_company from public.companies c
    where lower(c.name) = lower(trim(r ->> 'company')) or lower(c.short_name) = lower(trim(r ->> 'company')) limit 1;
    if coalesce(trim(r ->> 'first_name'), '') = '' or coalesce(trim(r ->> 'last_name'), '') = '' then v_err := 'First and last name are required.';
    elsif nullif(trim(r ->> 'email'), '') is null and nullif(trim(r ->> 'employee_no'), '') is null then v_err := 'Give an email address or an employee number.';
    elsif nullif(trim(r ->> 'email'), '') is not null and trim(r ->> 'email') !~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' then v_err := 'Email address is invalid.';
    elsif v_company is null then v_err := 'Unknown company "' || coalesce(r ->> 'company', '') || '".';
    elsif not app.can_admin_company(v_company) then v_err := 'You do not administer this company.';
    elsif nullif(r ->> 'start_date', '') is not null and (r ->> 'start_date') !~ '^\\d{4}-\\d{2}-\\d{2}$' then v_err := 'Start date must be YYYY-MM-DD.';
    end if;
    select e.id into v_existing from public.employees e
    where (nullif(trim(r ->> 'email'), '') is not null and lower(e.email) = lower(trim(r ->> 'email')))
       or (nullif(trim(r ->> 'employee_no'), '') is not null and e.company_id = v_company and e.employee_no = trim(r ->> 'employee_no'))
    limit 1;
    if v_err is null and v_existing is not null and not app.can_admin_company((select company_id from public.employees where id = v_existing)) then
      v_err := 'This email belongs to someone in another company.';
    end if;
    v_action := case when v_err is not null then 'error' when v_existing is null then 'create' else 'update' end;

    if v_err is null and not v_dry then
      begin
        if nullif(trim(r ->> 'department'), '') is not null then
          select d.id into v_department from public.departments d where d.company_id = v_company and lower(d.name) = lower(trim(r ->> 'department'));
          if v_department is null and v_create then
            insert into public.departments (company_id, name) values (v_company, trim(r ->> 'department')) returning id into v_department;
          end if;
        end if;
        if nullif(trim(r ->> 'position'), '') is not null then
          select x.id into v_position from public.positions x where x.company_id = v_company and lower(x.title) = lower(trim(r ->> 'position'));
          if v_position is null and v_create then
            insert into public.positions (company_id, title) values (v_company, trim(r ->> 'position')) returning id into v_position;
          end if;
        end if;
        if nullif(trim(r ->> 'site'), '') is not null then
          select s.id into v_site from public.sites s where s.company_id = v_company and lower(s.name) = lower(trim(r ->> 'site'));
          if v_site is null and v_create then
            insert into public.sites (company_id, name, country) values (v_company, trim(r ->> 'site'),
              (select c.country from public.companies c where c.id = v_company)) returning id into v_site;
          end if;
        end if;
        v_new := (public.admin_save_employee(jsonb_build_object(
          'id', v_existing, 'first_name', r ->> 'first_name', 'last_name', r ->> 'last_name',
          'manager_id', (select m.id from public.employees m
                         where (nullif(trim(r ->> 'manager_email'), '') is not null and lower(m.email) = lower(trim(r ->> 'manager_email')))
                            or (nullif(trim(r ->> 'manager_no'), '') is not null and m.employee_no = trim(r ->> 'manager_no')) limit 1),
          'preferred_name', r ->> 'preferred_name', 'email', r ->> 'email', 'phone', r ->> 'phone',
          'employee_no', r ->> 'employee_no', 'company_id', v_company, 'department_id', v_department,
          'site_id', v_site, 'position_id', v_position, 'start_date', r ->> 'start_date', 'locale', r ->> 'locale'
        )) ->> 'id')::uuid;
      exception when others then
        v_err := sqlerrm; v_action := 'error';
      end;
    end if;
    v_results := v_results || jsonb_build_object('row', i, 'email', coalesce(nullif(r ->> 'email', ''), trim(coalesce(r ->> 'first_name', '') || ' ' || coalesce(r ->> 'last_name', ''))),
                                                 'action', v_action, 'error', v_err);
  end loop;

  -- Second pass: managers that were created in this same file.
  if not v_dry then
    update public.employees e set manager_id = m.id
    from jsonb_array_elements(coalesce(p -> 'rows', '[]'::jsonb)) x
    join public.employees m on (lower(m.email) = lower(trim(x ->> 'manager_email')))
                            or (nullif(trim(x ->> 'manager_no'), '') is not null and m.employee_no = trim(x ->> 'manager_no'))
    where ((nullif(trim(x ->> 'email'), '') is not null and lower(e.email) = lower(trim(x ->> 'email')))
           or (nullif(trim(x ->> 'employee_no'), '') is not null and e.employee_no = trim(x ->> 'employee_no')))
      and e.manager_id is null and m.id <> e.id and app.can_admin_company(e.company_id);
  end if;

  return jsonb_build_object(
    'dry_run', v_dry,
    'created', (select count(*) from jsonb_array_elements(v_results) x where x ->> 'action' = 'create'),
    'updated', (select count(*) from jsonb_array_elements(v_results) x where x ->> 'action' = 'update'),
    'errors',  (select count(*) from jsonb_array_elements(v_results) x where x ->> 'action' = 'error'),
    'rows', v_results);
end $$;

-- Organisation units: company (group admin), department, site, position.
create or replace function public.admin_save_org(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  v_type text := p ->> 'type';
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_company uuid := nullif(p ->> 'company_id', '')::uuid;
  v_name text := nullif(trim(coalesce(p ->> 'name', p ->> 'title')), '');
  v_archive boolean := coalesce((p ->> 'archived')::boolean, false);
begin
  perform app.require(v_name is not null or v_archive, 'Enter a name.');
  if v_type = 'company' then
    perform app.require(app.is_group_admin(), 'Only a group administrator can add or change companies.');
    if v_id is null then
      insert into public.companies (name, short_name, country, default_locale)
      values (v_name, nullif(trim(p ->> 'short_name'), ''), coalesce(nullif(p ->> 'country', ''), 'ZA'), coalesce(nullif(p ->> 'default_locale', ''), 'en'))
      returning id into v_id;
    else
      update public.companies set
        name = coalesce(v_name, name), short_name = coalesce(nullif(trim(p ->> 'short_name'), ''), short_name),
        country = coalesce(nullif(p ->> 'country', ''), country), default_locale = coalesce(nullif(p ->> 'default_locale', ''), default_locale),
        archived_at = case when v_archive then coalesce(archived_at, now()) else null end
      where id = v_id;
    end if;
    return jsonb_build_object('id', v_id);
  end if;

  perform app.require(v_type in ('department', 'site', 'position'), 'Unknown organisation type.');
  if v_id is not null then
    execute format('select company_id from public.%I where id = $1', v_type || 's') into v_company using v_id;
  end if;
  perform app.require(v_company is not null and app.can_admin_company(v_company));

  if v_type = 'department' then
    if v_id is null then
      insert into public.departments (company_id, name, parent_id) values (v_company, v_name, nullif(p ->> 'parent_id', '')::uuid) returning id into v_id;
    else
      update public.departments set name = coalesce(v_name, name), parent_id = nullif(p ->> 'parent_id', '')::uuid,
        archived_at = case when v_archive then coalesce(archived_at, now()) else null end where id = v_id;
    end if;
  elsif v_type = 'site' then
    if v_id is null then
      insert into public.sites (company_id, name, country) values (v_company, v_name,
        coalesce(nullif(p ->> 'country', ''), (select c.country from public.companies c where c.id = v_company))) returning id into v_id;
    else
      update public.sites set name = coalesce(v_name, name), country = coalesce(nullif(p ->> 'country', ''), country),
        archived_at = case when v_archive then coalesce(archived_at, now()) else null end where id = v_id;
    end if;
  else
    if v_id is null then
      insert into public.positions (company_id, title) values (v_company, v_name) returning id into v_id;
    else
      update public.positions set title = coalesce(v_name, title),
        archived_at = case when v_archive then coalesce(archived_at, now()) else null end where id = v_id;
    end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.admin_list_programmes(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_employee();
  perform app.require(app.is_any_admin());
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', g.id, 'title', g.title, 'kind', g.kind, 'status', g.status, 'company_id', g.company_id,
            'items', (select count(*) from public.programme_items i where i.programme_id = g.id and i.removed_at is null),
            'assigned', (select count(*) from public.assignments a where a.programme_id = g.id and a.cancelled_at is null),
            'completed', (select count(*) from public.assignments a where a.programme_id = g.id and a.completed_at is not null))
          order by g.title), '[]'::jsonb)
          from public.programmes g
          where g.company_id is null or app.can_admin_company(g.company_id));
end $$;

create or replace function public.admin_assign_programme(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  v_programme public.programmes;
  v_due date := (p ->> 'due_on')::date;
  v_emp uuid;
  n int := 0;
begin
  select * into v_programme from public.programmes where id = (p ->> 'programme_id')::uuid;
  perform app.require(v_programme.id is not null and v_programme.status = 'active', 'Choose an active programme.');
  perform app.require(v_due is not null and v_due >= current_date, 'Choose a due date from today onwards.');
  for v_emp in select (jsonb_array_elements_text(p -> 'employee_ids'))::uuid loop
    perform app.require(exists (select 1 from public.employees e where e.id = v_emp and e.status in ('pending', 'active')
                                and app.can_admin_company(e.company_id)
                                and (v_programme.company_id is null or v_programme.company_id = e.company_id)),
                        'One of the selected people cannot receive this programme.');
    perform app.assign(v_emp, v_programme.id, v_due, null, v_me);
    n := n + 1;
  end loop;
  return jsonb_build_object('assigned', n);
end $$;

select app.lock_down();
`,__vite_glob_1_4=`-- Ritestand portal · manager view: direct reports with their progress.
create or replace function public.team_overview(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.require_employee();
begin
  return (select coalesce(jsonb_agg(app.employee_row(e) order by e.last_name, e.first_name), '[]'::jsonb)
          from public.employees e
          where e.manager_id = v_me and e.status in ('pending', 'active', 'suspended'));
end $$;

select app.lock_down();
`,__vite_glob_1_5=`-- Ritestand portal · permission check used by the set-access Edge Function before it bans or unbans a sign-in account.
create or replace function public.admin_access_check(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.employees;
begin
  perform app.require_employee();
  select * into e from public.employees where user_id = (p ->> 'user_id')::uuid;
  perform app.require(e.id is not null and app.can_admin_company(e.company_id));
  return jsonb_build_object('employee_id', e.id, 'status', e.status);
end $$;

select app.lock_down();
`,__vite_glob_1_6=`-- Ritestand portal · content helpers.
-- app.md_to_doc turns simple Markdown (## headings, - bullets, 1. numbers, > callouts, **bold**) into a Tiptap document.

create or replace function app.md_inline(p text) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_agg(
           case when ord % 2 = 0
                then jsonb_build_object('type', 'text', 'text', part, 'marks', jsonb_build_array(jsonb_build_object('type', 'bold')))
                else jsonb_build_object('type', 'text', 'text', part) end
           order by ord) filter (where part <> ''), '[]'::jsonb)
  from unnest(string_to_array(coalesce(p, ''), '**')) with ordinality as t(part, ord)
$$;

create or replace function app.md_to_doc(p_md text) returns jsonb
language plpgsql immutable as $$
declare
  v_line text;
  v_content jsonb := '[]'::jsonb;
  v_para text := null;
  v_list jsonb := null;
  v_list_type text := null;
  v_type text;
  v_text text;
begin
  foreach v_line in array string_to_array(replace(coalesce(p_md, ''), E'\\r', ''), E'\\n') || array[''] loop
    v_line := rtrim(v_line);

    if v_line ~ '^\\s*([-*]|\\d+\\.) ' then
      if v_para is not null then
        v_content := v_content || jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', app.md_inline(v_para)));
        v_para := null;
      end if;
      v_type := case when v_line ~ '^\\s*[-*] ' then 'bulletList' else 'orderedList' end;
      v_text := regexp_replace(v_line, '^\\s*([-*]|\\d+\\.) ', '');
      if v_list is not null and v_list_type <> v_type then
        v_content := v_content || jsonb_build_array(jsonb_build_object('type', v_list_type, 'content', v_list));
        v_list := null;
      end if;
      v_list_type := v_type;
      v_list := coalesce(v_list, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('type', 'listItem', 'content',
                  jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', app.md_inline(v_text)))));
      continue;
    end if;

    if v_list is not null then
      v_content := v_content || jsonb_build_array(jsonb_build_object('type', v_list_type, 'content', v_list));
      v_list := null;
    end if;

    if v_line = '' or v_line ~ '^#{1,3} ' or v_line ~ '^> ' then
      if v_para is not null then
        v_content := v_content || jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', app.md_inline(v_para)));
        v_para := null;
      end if;
    end if;

    if v_line ~ '^#{1,3} ' then
      v_content := v_content || jsonb_build_array(jsonb_build_object('type', 'heading',
        'attrs', jsonb_build_object('level', greatest(2, length(substring(v_line from '^#+')))),
        'content', app.md_inline(regexp_replace(v_line, '^#+ ', ''))));
    elsif v_line ~ '^> ' then
      v_content := v_content || jsonb_build_array(jsonb_build_object('type', 'blockquote', 'content',
        jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', app.md_inline(substr(v_line, 3))))));
    elsif v_line <> '' then
      v_para := case when v_para is null then v_line else v_para || ' ' || v_line end;
    end if;
  end loop;
  return jsonb_build_object('type', 'doc', 'content', v_content);
end $$;

-- Plain text of a Tiptap document (search, fingerprints, previews).
create or replace function app.doc_text(p_doc jsonb) returns text
language sql immutable as $$
  select coalesce(string_agg(j #>> '{}', ' '), '')
  from jsonb_path_query(coalesce(p_doc, '{}'::jsonb), 'strict $.**.text') as j
$$;

select app.lock_down();
`,__vite_glob_1_7=`-- Ritestand Induction · doing the work: lessons, policy acknowledgement, practical sign-offs, completion and certificates.

-- ───────────────────────── Status helpers
-- A learner may open a module of their own company or group-wide, or any module in one of their programmes
-- (team training follows reporting lines, which can cross companies).
create or replace function app.can_see_module(p_module uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.modules m where m.id = p_module and app.can_see_company_item(m.company_id))
      or exists (select 1 from public.assignments a join public.programme_items pi on pi.programme_id = a.programme_id
                 where a.employee_id = app.current_employee_id() and a.cancelled_at is null and pi.module_id = p_module and pi.removed_at is null)
$$;

-- 'acknowledged' | 'pending' | 'reack_required' | 'no_version'
create or replace function app.policy_ack_state(p_policy uuid, p_employee uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cur uuid;
  v_last_pub timestamptz;
begin
  select current_version_id into v_cur from public.policies where id = p_policy;
  if v_cur is null then return 'no_version'; end if;
  if exists (select 1 from public.policy_acknowledgements k where k.policy_version_id = v_cur and k.employee_id = p_employee) then
    return 'acknowledged';
  end if;
  select pv.published_at into v_last_pub
  from public.policy_acknowledgements k join public.policy_versions pv on pv.id = k.policy_version_id
  where pv.policy_id = p_policy and k.employee_id = p_employee
  order by pv.published_at desc limit 1;
  if v_last_pub is null then return 'pending'; end if;
  -- An older acknowledgement still counts unless a later version was marked as needing re-acknowledgement.
  if exists (select 1 from public.policy_versions pv where pv.policy_id = p_policy and pv.status in ('published', 'retired')
             and pv.published_at > v_last_pub and pv.requires_reack) then
    return 'reack_required';
  end if;
  return 'acknowledged';
end $$;

create or replace function app.policy_applies(p_policy uuid, p_employee uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.policies p join public.employees e on e.id = p_employee
    where p.id = p_policy and p.archived_at is null and p.ack_required and p.current_version_id is not null
      and (p.company_id is null or p.company_id = e.company_id)
      and (not exists (select 1 from public.policy_audiences a where a.policy_id = p.id)
           or exists (select 1 from public.policy_audiences a where a.policy_id = p.id
                      and (a.company_id is null or a.company_id = e.company_id)
                      and (a.department_id is null or a.department_id = e.department_id)
                      and (a.position_id is null or a.position_id = e.position_id)
                      and (a.site_id is null or a.site_id = e.site_id))))
$$;

-- Progress of one person in one module (current published version).
create or replace function app.module_progress(p_employee uuid, p_module uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with m as (select current_version_id as vid from public.modules where id = p_module),
  l as (
    select ls.lesson_key, lp.completed_at
    from m join public.lessons ls on ls.module_version_id = m.vid
    left join public.lesson_progress lp on lp.employee_id = p_employee and lp.module_id = p_module and lp.lesson_key = ls.lesson_key
  ),
  t as (select exists (select 1 from m join public.assessments s on s.module_version_id = m.vid) as required),
  passed as (
    select a.id from public.attempts a join public.assessments s on s.id = a.assessment_id
    join public.module_versions v on v.id = s.module_version_id
    where v.module_id = p_module and a.employee_id = p_employee and a.passed
    order by a.marked_at desc nulls last limit 1
  )
  select jsonb_build_object(
    'version_id', (select vid from m),
    'total', (select count(*) from l),
    'done', (select count(*) from l where completed_at is not null),
    'pct', (select case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where completed_at is not null) / count(*)) end from l),
    'assessment_required', (select required from t),
    'attempt_id', (select id from passed),
    'complete', (select count(*) > 0 and count(*) = count(completed_at) from l)
                and (not (select required from t) or exists (select 1 from passed)))
$$;

-- Locked = the module only appears in sequential programmes where an earlier required module is still open.
create or replace function app.module_locked(p_employee uuid, p_module uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with items as (
    select a.id as aid, a.programme_id, pi.position, g.sequential
    from public.assignments a
    join public.programme_items pi on pi.programme_id = a.programme_id and pi.removed_at is null and pi.kind = 'module' and pi.module_id = p_module
    join public.programmes g on g.id = a.programme_id
    where a.employee_id = p_employee and a.completed_at is null and a.cancelled_at is null
  )
  select exists (select 1 from items)
     and not exists (
       select 1 from items i
       where not i.sequential
          or not exists (
            select 1 from public.programme_items pj
            where pj.programme_id = i.programme_id and pj.removed_at is null and pj.kind = 'module' and pj.required
              and pj.position < i.position
              and not exists (select 1 from public.item_completions c where c.assignment_id = i.aid and c.programme_item_id = pj.id)))
$$;

-- ───────────────────────── Completion engine
-- Records every newly finished item, closes the programme when all required items are done, issues the certificate.
create or replace function app.refresh_assignment(p_assignment uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  a public.assignments;
  e public.employees;
  g public.programmes;
  it public.programme_items;
  v_mp jsonb;
  v_ack uuid; v_pv uuid; v_so uuid;
  v_missing int;
begin
  select * into a from public.assignments where id = p_assignment for update;
  if a.id is null or a.completed_at is not null or a.cancelled_at is not null then return false; end if;
  select * into e from public.employees where id = a.employee_id;

  for it in select * from public.programme_items where programme_id = a.programme_id and removed_at is null order by position loop
    continue when exists (select 1 from public.item_completions c where c.assignment_id = a.id and c.programme_item_id = it.id);
    if it.kind = 'module' then
      v_mp := app.module_progress(e.id, it.module_id);
      if (v_mp ->> 'complete')::boolean then
        insert into public.item_completions (assignment_id, programme_item_id, module_version_id, attempt_id, company_id, department_id)
        values (a.id, it.id, (v_mp ->> 'version_id')::uuid, (v_mp ->> 'attempt_id')::uuid, e.company_id, e.department_id);
      end if;
    elsif it.kind = 'policy' then
      if app.policy_ack_state(it.policy_id, e.id) = 'acknowledged' then
        select k.id, k.policy_version_id into v_ack, v_pv
        from public.policy_acknowledgements k join public.policy_versions pv on pv.id = k.policy_version_id
        where pv.policy_id = it.policy_id and k.employee_id = e.id
        order by k.acknowledged_at desc limit 1;
        insert into public.item_completions (assignment_id, programme_item_id, policy_version_id, acknowledgement_id, company_id, department_id)
        values (a.id, it.id, v_pv, v_ack, e.company_id, e.department_id);
      end if;
    elsif it.kind = 'task' then
      select s.id into v_so from public.sign_offs s where s.employee_id = e.id and s.task_id = it.task_id order by s.signed_at desc limit 1;
      if v_so is not null then
        insert into public.item_completions (assignment_id, programme_item_id, sign_off_id, company_id, department_id)
        values (a.id, it.id, v_so, e.company_id, e.department_id);
      end if;
    end if;
  end loop;

  select count(*) into v_missing from public.programme_items pi
  where pi.programme_id = a.programme_id and pi.removed_at is null and pi.required
    and not exists (select 1 from public.item_completions c where c.assignment_id = a.id and c.programme_item_id = pi.id);
  if v_missing > 0 or not exists (select 1 from public.programme_items pi where pi.programme_id = a.programme_id and pi.removed_at is null) then
    return false;
  end if;

  update public.assignments set completed_at = now() where id = a.id;
  select * into g from public.programmes where id = a.programme_id;
  if g.certificate_enabled then
    insert into public.certificates (employee_id, assignment_id, programme_id, title, certificate_no, verify_code)
    values (e.id, a.id, g.id, g.title, 'RG-' || to_char(now(), 'YYYY') || '-' || nextval('public.certificate_no_seq'),
            upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));
  end if;
  perform app.log_activity(e.id, 'completed_programme', 'programme', g.id, g.title);
  perform app.notify(e.id, 'completed', 'You finished ' || g.title,
                     case when g.certificate_enabled then 'Your certificate is ready.' end, '/');
  if e.manager_id is not null then
    perform app.notify(e.manager_id, 'team_completed', app.display_name(e) || ' finished ' || g.title, null, '/team/' || e.id);
  end if;
  return true;
end $$;

create or replace function app.refresh_employee(p_employee uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  for v in select id from public.assignments where employee_id = p_employee and completed_at is null and cancelled_at is null loop
    perform app.refresh_assignment(v);
  end loop;
end $$;

-- ───────────────────────── Lessons
create or replace function public.get_module(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_emp uuid := app.require_employee();
  m public.modules;
  v public.module_versions;
  v_next uuid;
begin
  select * into m from public.modules where id = (p ->> 'module_id')::uuid and archived_at is null;
  perform app.require(m.id is not null and app.can_see_module(m.id), 'This module is not available.');
  select * into v from public.module_versions where id = m.current_version_id and status = 'published';
  perform app.require(v.id is not null, 'This module has not been published yet.');
  select l.id into v_next from public.lessons l
  left join public.lesson_progress lp on lp.employee_id = v_emp and lp.module_id = m.id and lp.lesson_key = l.lesson_key
  where l.module_version_id = v.id and lp.completed_at is null order by l.position limit 1;
  return jsonb_build_object(
    'id', m.id, 'code', m.code, 'title', v.title, 'summary', v.summary, 'est_minutes', v.est_minutes, 'version_no', v.version_no,
    'locked', app.module_locked(v_emp, m.id),
    'progress', app.module_progress(v_emp, m.id),
    'next_lesson_id', coalesce(v_next, (select l.id from public.lessons l where l.module_version_id = v.id order by l.position limit 1)),
    'lessons', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'position', l.position, 'est_minutes', l.est_minutes,
                  'completed_at', lp.completed_at) order by l.position), '[]'::jsonb)
                from public.lessons l
                left join public.lesson_progress lp on lp.employee_id = v_emp and lp.module_id = m.id and lp.lesson_key = l.lesson_key
                where l.module_version_id = v.id));
end $$;

create or replace function public.get_lesson(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_emp uuid := app.require_employee();
  l public.lessons;
  m public.modules;
begin
  select * into l from public.lessons where id = (p ->> 'lesson_id')::uuid;
  select mo.* into m from public.modules mo join public.module_versions v on v.module_id = mo.id where v.id = l.module_version_id;
  perform app.require(l.id is not null and m.id is not null and app.can_see_module(m.id), 'This lesson is not available.');
  perform app.require(m.current_version_id = l.module_version_id, 'This lesson was updated. Open the module again.');
  return public.get_module(jsonb_build_object('module_id', m.id)) || jsonb_build_object(
    'lesson', jsonb_build_object(
      'id', l.id, 'title', l.title, 'content', l.content, 'position', l.position, 'est_minutes', l.est_minutes,
      'completed_at', (select lp.completed_at from public.lesson_progress lp
                       where lp.employee_id = v_emp and lp.module_id = m.id and lp.lesson_key = l.lesson_key),
      'prev_id', (select x.id from public.lessons x where x.module_version_id = l.module_version_id and x.position < l.position order by x.position desc limit 1),
      'next_id', (select x.id from public.lessons x where x.module_version_id = l.module_version_id and x.position > l.position order by x.position limit 1)));
end $$;

create or replace function public.complete_lesson(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_emp uuid := app.require_employee();
  l public.lessons;
  m public.modules;
  v_before boolean;
  v_after jsonb;
begin
  select * into l from public.lessons where id = (p ->> 'lesson_id')::uuid;
  select mo.* into m from public.modules mo join public.module_versions v on v.module_id = mo.id where v.id = l.module_version_id;
  perform app.require(l.id is not null and m.id is not null and app.can_see_module(m.id), 'This lesson is not available.');
  perform app.require(m.current_version_id = l.module_version_id, 'This lesson was updated. Open the module again.');
  perform app.require(not app.module_locked(v_emp, m.id), 'Finish the previous module first.');

  v_before := (app.module_progress(v_emp, m.id) ->> 'complete')::boolean;
  insert into public.lesson_progress (employee_id, module_id, lesson_key, module_version_id, completed_at)
  values (v_emp, m.id, l.lesson_key, l.module_version_id, now())
  on conflict (employee_id, module_id, lesson_key)
  do update set completed_at = coalesce(public.lesson_progress.completed_at, now()), module_version_id = excluded.module_version_id;
  v_after := app.module_progress(v_emp, m.id);
  if not v_before and (v_after ->> 'complete')::boolean then
    perform app.log_activity(v_emp, 'completed_module', 'module', m.id, coalesce(m.code || ' · ', '') || m.title);
  end if;
  perform app.refresh_employee(v_emp);
  return jsonb_build_object(
    'module_complete', (v_after ->> 'complete')::boolean,
    'progress', v_after,
    'next_lesson_id', (select x.id from public.lessons x where x.module_version_id = l.module_version_id and x.position > l.position order by x.position limit 1));
end $$;

-- ───────────────────────── Policies
create or replace function app.ack_statement(p_employee uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(s ->> e.locale, s ->> 'en', s #>> '{}')
  from public.employees e cross join lateral (select app.setting(e.company_id, 'ack_statement') as s) x
  where e.id = p_employee
$$;

create or replace function public.get_policy(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_emp uuid := app.require_employee();
  pol public.policies;
  v public.policy_versions;
begin
  select * into pol from public.policies where id = (p ->> 'policy_id')::uuid and archived_at is null;
  perform app.require(pol.id is not null and app.can_see_company_item(pol.company_id), 'This policy is not available.');
  select * into v from public.policy_versions where id = pol.current_version_id;
  perform app.require(v.id is not null, 'This policy has not been published yet.');
  return jsonb_build_object(
    'id', pol.id, 'title', pol.title, 'category', pol.category, 'applies', app.policy_applies(pol.id, v_emp),
    'state', app.policy_ack_state(pol.id, v_emp),
    'statement', app.ack_statement(v_emp),
    'version', jsonb_build_object('id', v.id, 'label', v.version_label, 'effective_date', v.effective_date,
                 'change_summary', v.change_summary, 'body', v.body, 'sha256', v.sha256, 'min_read_seconds', v.min_read_seconds,
                 'published_at', v.published_at, 'requires_reack', v.requires_reack),
    'acknowledgements', (select coalesce(jsonb_agg(jsonb_build_object('at', k.acknowledged_at, 'version_label', pv.version_label,
                           'document_sha256', k.document_sha256, 'id', k.id) order by k.acknowledged_at desc), '[]'::jsonb)
                         from public.policy_acknowledgements k join public.policy_versions pv on pv.id = k.policy_version_id
                         where pv.policy_id = pol.id and k.employee_id = v_emp));
end $$;

create or replace function public.acknowledge_policy(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_emp uuid := app.require_employee();
  v public.policy_versions;
  pol public.policies;
  v_seconds int := greatest(0, coalesce((p ->> 'seconds_viewed')::int, 0));
  v_headers json;
begin
  select * into v from public.policy_versions where id = (p ->> 'version_id')::uuid;
  select * into pol from public.policies where id = v.policy_id;
  perform app.require(v.id is not null and pol.archived_at is null and app.can_see_company_item(pol.company_id), 'This policy is not available.');
  perform app.require(v.status = 'published' and pol.current_version_id = v.id, 'A newer version of this policy exists. Open it again.');
  perform app.require(v_seconds >= v.min_read_seconds,
    format('Please read the policy first (at least %s seconds).', v.min_read_seconds));
  begin v_headers := nullif(current_setting('request.headers', true), '')::json; exception when others then v_headers := null; end;
  insert into public.policy_acknowledgements (policy_version_id, employee_id, statement, document_sha256, seconds_viewed, user_agent, ip)
  values (v.id, v_emp, app.ack_statement(v_emp), v.sha256, v_seconds, left(p ->> 'user_agent', 400),
          split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1))
  on conflict (policy_version_id, employee_id) do nothing;
  if found then
    perform app.log_activity(v_emp, 'acknowledged_policy', 'policy', pol.id, pol.title, jsonb_build_object('version', v.version_label));
  end if;
  perform app.refresh_employee(v_emp);
  return public.get_policy(jsonb_build_object('policy_id', pol.id));
end $$;

create or replace function public.my_policies(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_emp uuid := app.require_employee();
begin
  return (select coalesce(jsonb_agg(x order by (x ->> 'state') = 'acknowledged', x ->> 'title'), '[]'::jsonb) from (
    select jsonb_build_object('id', pol.id, 'title', pol.title, 'category', pol.category, 'version_label', v.version_label,
             'effective_date', v.effective_date, 'state', app.policy_ack_state(pol.id, v_emp),
             'acknowledged_at', (select max(k.acknowledged_at) from public.policy_acknowledgements k
                                 join public.policy_versions pv on pv.id = k.policy_version_id
                                 where pv.policy_id = pol.id and k.employee_id = v_emp)) as x
    from public.policies pol join public.policy_versions v on v.id = pol.current_version_id
    where app.policy_applies(pol.id, v_emp)) s);
end $$;

-- ───────────────────────── Practical sign-offs (manager or company admin; never yourself)
create or replace function public.sign_off_task(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  v_emp uuid := (p ->> 'employee_id')::uuid;
  t public.practical_tasks;
  v_id uuid;
begin
  select * into t from public.practical_tasks where id = (p ->> 'task_id')::uuid;
  perform app.require(t.id is not null, 'That task no longer exists.');
  perform app.require(v_emp <> v_me, 'You cannot sign off your own practical tasks.');
  perform app.require(app.manages(v_emp) or exists (select 1 from public.employees e where e.id = v_emp and app.can_admin_company(e.company_id)),
    'Only their manager or HR can sign this off.');
  perform app.require(exists (select 1 from public.assignments a join public.programme_items pi on pi.programme_id = a.programme_id
                              where a.employee_id = v_emp and a.completed_at is null and a.cancelled_at is null
                                and pi.removed_at is null and pi.kind = 'task' and pi.task_id = t.id),
    'This task is not in any of their open programmes.');
  insert into public.sign_offs (employee_id, task_id, signed_by, note)
  values (v_emp, t.id, v_me, nullif(trim(p ->> 'note'), '')) returning id into v_id;
  perform app.log_activity(v_emp, 'signed_off', 'task', t.id, t.title);
  perform app.notify(v_emp, 'signed_off', 'Signed off: ' || t.title,
                     'Confirmed by ' || (select app.display_name(x) from public.employees x where x.id = v_me) || '.', '/learning');
  perform app.refresh_employee(v_emp);
  return jsonb_build_object('id', v_id);
end $$;

-- Dashboard: count policies the way the Policies page does.
create or replace function app.pending_policy_count(p_employee uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.policies pol
  where app.policy_applies(pol.id, p_employee) and app.policy_ack_state(pol.id, p_employee) in ('pending', 'reack_required')
$$;

select app.lock_down();
`,__vite_glob_1_8=`-- Ritestand Induction · authoring: managers and content editors write training, HR approves and publishes,
-- publishing assigns it to the chosen audience. Every edit is a new draft version; published versions are frozen.

-- A training written in the editor gets its own programme; its audience is that programme's (single) rule.
alter table public.programmes add column source_module_id uuid references public.modules;
create unique index programmes_source_module on public.programmes (source_module_id) where source_module_id is not null;
alter table public.assignment_rules add column manager_id uuid references public.employees;  -- "direct reports of"
create index on public.assignment_rules (manager_id);

-- Empty fields on the person never match a rule that names a value (a NULL comparison would otherwise slip through).
create or replace function app.rule_matches(r public.assignment_rules, e public.employees) returns boolean
language sql stable as $$
  select coalesce(r.active, false)
     and (r.company_id    is null or r.company_id    is not distinct from e.company_id)
     and (r.department_id is null or r.department_id is not distinct from e.department_id)
     and (r.position_id   is null or r.position_id   is not distinct from e.position_id)
     and (r.site_id       is null or r.site_id       is not distinct from e.site_id)
     and (r.manager_id    is null or r.manager_id    is not distinct from e.manager_id)
     and (r.starts_on_or_after is null or coalesce(e.start_date >= r.starts_on_or_after, false))
     and (r.starts_before      is null or e.start_date is null or e.start_date < r.starts_before)
$$;

-- Assigns a rule's programme to everyone it matches who does not have it yet. Returns how many were assigned.
create or replace function app.apply_rule(p_rule uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r public.assignment_rules;
  g public.programmes;
  e public.employees;
  n int := 0;
begin
  select * into r from public.assignment_rules where id = p_rule;
  select * into g from public.programmes where id = r.programme_id;
  if r.id is null or not r.active or g.status <> 'active' then return 0; end if;
  for e in select * from public.employees x
           where x.status in ('pending', 'active') and (g.company_id is null or x.company_id = g.company_id or r.manager_id is not null) loop
    continue when not app.rule_matches(r, e);
    continue when exists (select 1 from public.assignments a where a.employee_id = e.id and a.programme_id = g.id);
    perform app.assign(e.id, g.id, current_date + r.due_days, r.id, app.current_employee_id());
    n := n + 1;
  end loop;
  return n;
end $$;

-- Team rules follow the reporting line, even across companies.
create or replace function app.auto_assign(p_employee uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  e public.employees;
  r public.assignment_rules;
  n int := 0;
begin
  select * into e from public.employees where id = p_employee;
  if e.id is null or e.status not in ('pending', 'active') then return 0; end if;
  for r in
    select ar.* from public.assignment_rules ar
    join public.programmes p on p.id = ar.programme_id
    where p.status = 'active' and ar.trigger in ('on_start', 'recurring')
      and (p.company_id is null or p.company_id = e.company_id or ar.manager_id is not null)
  loop
    continue when not app.rule_matches(r, e);
    continue when exists (select 1 from public.assignments a where a.employee_id = e.id and a.programme_id = r.programme_id);
    perform app.assign(e.id, r.programme_id, greatest(coalesce(e.start_date, current_date), current_date) + r.due_days, r.id, null);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Changing a person's manager also triggers auto-assignment (team trainings follow the team).
create or replace function app.employees_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT'
     or new.company_id is distinct from old.company_id or new.department_id is distinct from old.department_id
     or new.position_id is distinct from old.position_id or new.site_id is distinct from old.site_id
     or new.start_date is distinct from old.start_date or new.manager_id is distinct from old.manager_id
     or (new.status in ('pending', 'active') and old.status not in ('pending', 'active')) then
    perform app.auto_assign(new.id);
  end if;
  return null;
end $$;

-- ───────────────────────── Permissions
create or replace function app.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.employees e where e.manager_id = app.current_employee_id() and e.status in ('pending', 'active'))
$$;

create or replace function app.can_author() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.current_employee_id() is not null and (app.is_manager() or app.is_content_staff())
$$;

create or replace function app.can_edit_module(p_module uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.modules m where m.id = p_module
                 and (m.created_by = app.current_employee_id() or app.can_edit_content(m.company_id)))
$$;

-- HR publishes: company admin of the module's company, or a group admin.
create or replace function app.can_publish_module(p_module uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.modules m where m.id = p_module and app.can_admin_company(m.company_id))
$$;

create or replace function app.open_version(p_module uuid) returns public.module_versions
language sql stable security definer set search_path = '' as $$
  select v.* from public.module_versions v where v.module_id = p_module and v.status in ('draft', 'in_review') limit 1
$$;

-- People who approve a module: company admins of its company, else group admins.
create or replace function app.approvers(p_company uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct r.employee_id from public.role_assignments r join public.employees e on e.id = r.employee_id
  where e.status in ('pending', 'active')
    and ((p_company is not null and r.role = 'company_admin' and r.company_id = p_company) or r.role = 'group_admin')
$$;

-- ───────────────────────── Read
create or replace function app.audience_json(p_module uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'type', case when r.manager_id is not null then 'team' when r.department_id is not null then 'department'
                 when r.company_id is not null or g.company_id is not null then 'company' else 'group' end,
    'manager_id', r.manager_id, 'manager', (select app.display_name(x) from public.employees x where x.id = r.manager_id),
    'department_id', r.department_id, 'department', (select d.name from public.departments d where d.id = r.department_id),
    'company_id', coalesce(r.company_id, g.company_id), 'company', (select c.short_name from public.companies c where c.id = coalesce(r.company_id, g.company_id)),
    'due_days', r.due_days)
  from public.programmes g join public.assignment_rules r on r.programme_id = g.id
  where g.source_module_id = p_module
  limit 1
$$;

create or replace function public.author_list(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.require_employee();
begin
  perform app.require(app.can_author(), 'Only managers, content editors and HR can create training.');
  return (select coalesce(jsonb_agg(x order by (x ->> 'status') = 'in_review' desc, x ->> 'updated_at' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', m.id, 'code', m.code, 'title', coalesce(ov.title, cv.title, m.title),
      'status', coalesce(ov.status::text, cv.status::text, 'draft'),
      'version_no', coalesce(ov.version_no, cv.version_no), 'published_version_no', cv.version_no,
      'author', (select app.display_name(x) from public.employees x where x.id = m.created_by),
      'mine', m.created_by = v_me,
      'company', (select c.short_name from public.companies c where c.id = m.company_id),
      'updated_at', greatest(m.updated_at, ov.updated_at, cv.updated_at),
      'is_training', exists (select 1 from public.programmes g where g.source_module_id = m.id),
      'audience', app.audience_json(m.id),
      'used_in', (select coalesce(jsonb_agg(distinct g.title), '[]'::jsonb) from public.programme_items pi join public.programmes g on g.id = pi.programme_id
                  where pi.module_id = m.id and pi.removed_at is null and g.source_module_id is distinct from m.id),
      'assigned', (select count(distinct a.employee_id) from public.assignments a join public.programme_items pi on pi.programme_id = a.programme_id
                   where pi.module_id = m.id and pi.removed_at is null and a.cancelled_at is null),
      'completed', (select count(distinct a.employee_id) from public.item_completions c join public.programme_items pi on pi.id = c.programme_item_id
                    join public.assignments a on a.id = c.assignment_id where pi.module_id = m.id),
      'can_publish', app.can_publish_module(m.id)) as x
    from public.modules m
    left join public.module_versions cv on cv.id = m.current_version_id
    left join lateral (select * from public.module_versions v where v.module_id = m.id and v.status in ('draft', 'in_review') limit 1) ov on true
    where m.archived_at is null and (m.created_by = v_me or app.can_edit_content(m.company_id))) s);
end $$;

create or replace function public.author_get(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  m public.modules;
  v public.module_versions;
begin
  select * into m from public.modules where id = (p ->> 'module_id')::uuid and archived_at is null;
  perform app.require(m.id is not null and app.can_edit_module(m.id), 'You cannot edit this training.');
  v := app.open_version(m.id);
  if v.id is null then select * into v from public.module_versions where id = m.current_version_id; end if;
  return jsonb_build_object(
    'id', m.id, 'code', m.code, 'company_id', m.company_id,
    'author', (select app.display_name(x) from public.employees x where x.id = m.created_by), 'mine', m.created_by = v_me,
    'version', jsonb_build_object('id', v.id, 'version_no', v.version_no, 'status', v.status, 'title', v.title, 'summary', v.summary,
                 'review_note', v.review_note, 'change_note', v.change_note, 'submitted_at', v.submitted_at, 'published_at', v.published_at,
                 'submitted_by', (select app.display_name(x) from public.employees x where x.id = v.submitted_by)),
    'published_version_no', (select cv.version_no from public.module_versions cv where cv.id = m.current_version_id),
    'editable', v.status in ('draft', 'in_review'),
    'can_publish', app.can_publish_module(m.id),
    'is_training', exists (select 1 from public.programmes g where g.source_module_id = m.id),
    'audience', app.audience_json(m.id),
    'used_in', (select coalesce(jsonb_agg(distinct g.title), '[]'::jsonb) from public.programme_items pi join public.programmes g on g.id = pi.programme_id
                where pi.module_id = m.id and pi.removed_at is null and g.source_module_id is distinct from m.id),
    'lessons', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'lesson_key', l.lesson_key, 'title', l.title, 'content', l.content,
                  'est_minutes', l.est_minutes, 'position', l.position) order by l.position), '[]'::jsonb)
                from public.lessons l where l.module_version_id = v.id));
end $$;

-- ───────────────────────── Write
create or replace function public.author_create(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  v_company uuid := app.current_company_id();
  v_title text := nullif(trim(p ->> 'title'), '');
  v_mod uuid; v_ver uuid; v_prog uuid;
begin
  perform app.require(app.can_author(), 'Only managers, content editors and HR can create training.');
  perform app.require(v_title is not null, 'Give the training a title.');
  insert into public.modules (company_id, title, summary, created_by, review_by)
  values (v_company, v_title, nullif(trim(p ->> 'summary'), ''), v_me, current_date + 365) returning id into v_mod;
  insert into public.module_versions (module_id, version_no, title, summary, created_by)
  values (v_mod, 1, v_title, nullif(trim(p ->> 'summary'), ''), v_me) returning id into v_ver;
  insert into public.lessons (module_version_id, position, title, content, est_minutes)
  values (v_ver, 1, 'Lesson 1', '{"type":"doc","content":[]}'::jsonb, 5);
  insert into public.programmes (company_id, title, description, kind, status, sequential, certificate_enabled, created_by, source_module_id)
  values (v_company, v_title, nullif(trim(p ->> 'summary'), ''), 'department', 'draft', false, false, v_me, v_mod) returning id into v_prog;
  insert into public.programme_items (programme_id, kind, module_id, position, milestone) values (v_prog, 'module', v_mod, 1, 'week_1');
  -- Default audience: a manager's own team; otherwise their company. Inactive until HR publishes.
  insert into public.assignment_rules (programme_id, company_id, manager_id, trigger, due_days, active, created_by)
  values (v_prog, case when app.is_manager() then null else v_company end, case when app.is_manager() then v_me end, 'on_start', 14, false, v_me);
  return jsonb_build_object('id', v_mod);
end $$;

create or replace function public.author_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  m public.modules;
  v public.module_versions;
  g public.programmes;
  r public.assignment_rules;
  v_title text := nullif(trim(p ->> 'title'), '');
  v_aud jsonb := p -> 'audience';
  v_type text := coalesce(p -> 'audience' ->> 'type', '');
  v_company uuid; v_dept uuid; v_manager uuid;
  v_keep uuid[];
  l jsonb;
  i int := 0;
begin
  select * into m from public.modules where id = (p ->> 'module_id')::uuid and archived_at is null;
  perform app.require(m.id is not null and app.can_edit_module(m.id), 'You cannot edit this training.');
  v := app.open_version(m.id);
  perform app.require(v.id is not null, 'This version is published. Start a new version to make changes.');
  perform app.require(v_title is not null, 'Give the training a title.');
  perform app.require(jsonb_array_length(coalesce(p -> 'lessons', '[]'::jsonb)) > 0, 'Add at least one lesson.');

  -- An author who edits while it waits for approval takes it back to draft; HR can fix things in review.
  if v.status = 'in_review' and not app.can_publish_module(m.id) then
    update public.module_versions set status = 'draft', submitted_at = null, submitted_by = null where id = v.id;
  end if;

  update public.module_versions set title = v_title, summary = nullif(trim(p ->> 'summary'), ''),
    change_note = nullif(trim(p ->> 'change_note'), ''),
    est_minutes = (select coalesce(sum(greatest(1, coalesce((x ->> 'est_minutes')::int, 5))), 0) from jsonb_array_elements(p -> 'lessons') x)
  where id = v.id;

  -- Lessons: keep ids (and their progress keys) that are still there, replace the rest.
  select coalesce(array_agg((x ->> 'id')::uuid) filter (where nullif(x ->> 'id', '') is not null), '{}') into v_keep
  from jsonb_array_elements(p -> 'lessons') x;
  delete from public.lessons where module_version_id = v.id and not (id = any (v_keep));
  for l in select * from jsonb_array_elements(p -> 'lessons') loop
    i := i + 1;
    perform app.require(nullif(trim(l ->> 'title'), '') is not null, format('Lesson %s needs a title.', i));
    perform app.require(length(coalesce(l -> 'content', '{}'::jsonb)::text) <= 3000000,
      format('Lesson %s is too large. Use fewer or smaller photos.', i));
    if nullif(l ->> 'id', '') is not null and exists (select 1 from public.lessons x where x.id = (l ->> 'id')::uuid and x.module_version_id = v.id) then
      update public.lessons set title = trim(l ->> 'title'), content = coalesce(l -> 'content', '{"type":"doc","content":[]}'::jsonb),
        est_minutes = greatest(1, coalesce((l ->> 'est_minutes')::int, 5)), position = i
      where id = (l ->> 'id')::uuid;
    else
      insert into public.lessons (module_version_id, position, title, content, est_minutes)
      values (v.id, i, trim(l ->> 'title'), coalesce(l -> 'content', '{"type":"doc","content":[]}'::jsonb), greatest(1, coalesce((l ->> 'est_minutes')::int, 5)));
    end if;
  end loop;

  -- Audience (only for trainings made in the editor).
  select * into g from public.programmes where source_module_id = m.id;
  if g.id is not null and v_aud is not null then
    select * into r from public.assignment_rules where programme_id = g.id limit 1;
    if v_type = 'team' then
      v_manager := coalesce(r.manager_id, case when app.is_manager() then v_me end);
      perform app.require(v_manager is not null, 'Only a manager can give training to their own team.');
      v_company := (select e.company_id from public.employees e where e.id = v_manager);
    elsif v_type = 'department' then
      v_dept := (v_aud ->> 'department_id')::uuid;
      v_company := (select d.company_id from public.departments d where d.id = v_dept);
      perform app.require(v_company is not null and app.can_edit_content(v_company), 'You cannot give training to that department.');
    elsif v_type = 'company' then
      v_company := (v_aud ->> 'company_id')::uuid;
      perform app.require(v_company is not null and app.can_edit_content(v_company), 'You cannot give training to that company.');
    elsif v_type = 'group' then
      perform app.require(app.can_edit_content(null), 'Only group-wide editors and group admins can give training to everyone.');
    else
      raise exception 'Choose who must do this training.' using errcode = '22023';
    end if;
    update public.modules set company_id = v_company where id = m.id;
    update public.programmes set company_id = v_company, title = v_title, description = nullif(trim(p ->> 'summary'), '') where id = g.id;
    update public.assignment_rules set
      company_id = case when v_type = 'company' then v_company end,
      department_id = v_dept, manager_id = case when v_type = 'team' then v_manager end,
      due_days = greatest(1, coalesce((v_aud ->> 'due_days')::int, due_days))
    where id = r.id;
  end if;
  update public.modules set updated_at = now() where id = m.id;
  return public.author_get(jsonb_build_object('module_id', m.id));
end $$;

create or replace function public.author_submit(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  m public.modules;
  v public.module_versions;
  v_to uuid;
begin
  select * into m from public.modules where id = (p ->> 'module_id')::uuid;
  perform app.require(m.id is not null and app.can_edit_module(m.id), 'You cannot edit this training.');
  v := app.open_version(m.id);
  perform app.require(v.id is not null and v.status = 'draft', 'There is no draft to submit.');
  perform app.require(exists (select 1 from public.lessons l where l.module_version_id = v.id and jsonb_array_length(coalesce(l.content -> 'content', '[]'::jsonb)) > 0),
    'Write something in at least one lesson first.');
  update public.module_versions set status = 'in_review', submitted_by = v_me, submitted_at = now(), review_note = null where id = v.id;
  for v_to in select app.approvers(m.company_id) loop
    continue when v_to = v_me;
    perform app.notify(v_to, 'review', 'Training to approve: ' || v.title,
      'Submitted by ' || (select app.display_name(x) from public.employees x where x.id = v_me) || '.', '/manage/training/' || m.id);
  end loop;
  return public.author_get(jsonb_build_object('module_id', m.id));
end $$;

create or replace function public.author_send_back(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  m public.modules;
  v public.module_versions;
begin
  select * into m from public.modules where id = (p ->> 'module_id')::uuid;
  perform app.require(m.id is not null and app.can_publish_module(m.id), 'Only HR can approve or send back training.');
  v := app.open_version(m.id);
  perform app.require(v.id is not null and v.status = 'in_review', 'Nothing is waiting for approval.');
  update public.module_versions set status = 'draft', review_note = nullif(trim(p ->> 'note'), '') where id = v.id;
  if v.submitted_by is not null and v.submitted_by <> v_me then
    perform app.notify(v.submitted_by, 'review', 'Changes requested: ' || v.title, nullif(trim(p ->> 'note'), ''), '/manage/training/' || m.id);
  end if;
  return public.author_get(jsonb_build_object('module_id', m.id));
end $$;

create or replace function public.author_publish(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  m public.modules;
  v public.module_versions;
  g public.programmes;
  v_rule uuid;
  n int := 0;
begin
  select * into m from public.modules where id = (p ->> 'module_id')::uuid;
  perform app.require(m.id is not null and app.can_publish_module(m.id), 'Only HR can approve and publish training.');
  v := app.open_version(m.id);
  perform app.require(v.id is not null and v.status = 'in_review', 'Submit the training for approval first.');
  update public.module_versions set status = 'retired' where module_id = m.id and status = 'published';
  update public.module_versions set status = 'published', published_by = v_me, published_at = now(),
    material_change = coalesce((p ->> 'material_change')::boolean, false) where id = v.id;
  update public.modules set current_version_id = v.id, title = v.title, summary = v.summary where id = m.id;

  select * into g from public.programmes where source_module_id = m.id;
  if g.id is not null then
    update public.programmes set status = 'active', title = v.title where id = g.id;
    update public.assignment_rules set active = true where programme_id = g.id returning id into v_rule;
    n := app.apply_rule(v_rule);
  end if;
  -- People mid-way see the new lessons; finished people keep their completion.
  perform app.refresh_employee(a.employee_id) from public.assignments a
  join public.programme_items pi on pi.programme_id = a.programme_id and pi.module_id = m.id
  where a.completed_at is null and a.cancelled_at is null;
  if v.submitted_by is not null and v.submitted_by <> v_me then
    perform app.notify(v.submitted_by, 'review', 'Published: ' || v.title,
      case when n > 0 then format('Assigned to %s people.', n) end, '/manage/training/' || m.id);
  end if;
  return public.author_get(jsonb_build_object('module_id', m.id)) || jsonb_build_object('assigned_now', n);
end $$;

-- Start a new draft from the published version (lessons keep their keys, so nobody loses progress).
create or replace function public.author_new_version(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  m public.modules;
  cv public.module_versions;
  v_new uuid;
begin
  select * into m from public.modules where id = (p ->> 'module_id')::uuid;
  perform app.require(m.id is not null and app.can_edit_module(m.id), 'You cannot edit this training.');
  if (app.open_version(m.id)).id is not null then
    return public.author_get(jsonb_build_object('module_id', m.id));
  end if;
  select * into cv from public.module_versions where id = m.current_version_id;
  insert into public.module_versions (module_id, version_no, title, summary, est_minutes, created_by)
  values (m.id, (select max(version_no) + 1 from public.module_versions where module_id = m.id), cv.title, cv.summary, cv.est_minutes, v_me)
  returning id into v_new;
  insert into public.lessons (module_version_id, lesson_key, position, title, content, est_minutes)
  select v_new, l.lesson_key, l.position, l.title, l.content, l.est_minutes from public.lessons l where l.module_version_id = cv.id;
  return public.author_get(jsonb_build_object('module_id', m.id));
end $$;

-- Discard a draft that was never published (published versions stay).
create or replace function public.author_discard(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  m public.modules;
  v public.module_versions;
begin
  select * into m from public.modules where id = (p ->> 'module_id')::uuid;
  perform app.require(m.id is not null and app.can_edit_module(m.id), 'You cannot edit this training.');
  v := app.open_version(m.id);
  perform app.require(v.id is not null, 'There is no draft to discard.');
  if m.current_version_id is null then
    update public.modules set archived_at = now() where id = m.id;  -- never published: archive the whole training
    update public.programmes set status = 'archived' where source_module_id = m.id;
    return jsonb_build_object('archived', true);
  end if;
  delete from public.lessons where module_version_id = v.id;
  delete from public.module_versions where id = v.id;
  return public.author_get(jsonb_build_object('module_id', m.id));
end $$;

select app.lock_down();
`,__vite_glob_1_9=`-- Ritestand Induction · tests at the end of a module: authoring, taking, marking in the database, manager unlock.
-- Answer keys never leave the database for learners; feedback shows which answers were wrong, never the right answer.

-- Generated questions stay marked until the author has checked them.
alter table public.questions add column suggested boolean not null default false;

-- ───────────────────────── Helpers
create or replace function app.attempt_stats(p_employee uuid, p_assessment uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with s as (select * from public.assessments where id = p_assessment),
  a as (select * from public.attempts where assessment_id = p_assessment and employee_id = p_employee),
  g as (select coalesce(sum(extra_attempts), 0)::int as extra from public.attempt_grants where assessment_id = p_assessment and employee_id = p_employee)
  select jsonb_build_object(
    'used', (select count(*) from a where status <> 'in_progress'),
    'allowed', (select case when s.max_attempts is null then null else s.max_attempts + g.extra end from s, g),
    'left', (select case when s.max_attempts is null then null
                         else greatest(0, s.max_attempts + g.extra - (select count(*) from a where status <> 'in_progress')) end from s, g),
    'best', (select max(score_pct) from a where status = 'marked'),
    'passed', exists (select 1 from a where passed),
    'in_progress', (select id from a where status = 'in_progress' order by started_at desc limit 1))
$$;

create or replace function app.test_json(p_employee uuid, p_module uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when s.id is null then null else jsonb_build_object(
    'id', s.id, 'title', s.title, 'pass_mark', s.pass_mark, 'max_attempts', s.max_attempts,
    'questions', coalesce(s.draw_count, (select count(*) from public.questions q where q.assessment_id = s.id)),
    'stats', app.attempt_stats(p_employee, s.id)) end
  from public.modules m left join public.assessments s on s.module_version_id = m.current_version_id
  where m.id = p_module
$$;

-- Copies a version's test (questions, options, keys) to another version, keeping question identity.
create or replace function app.copy_assessment(p_from uuid, p_to uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.assessments;
  q public.questions;
  v_ns uuid; v_nq uuid;
begin
  select * into s from public.assessments where module_version_id = p_from;
  if s.id is null then return; end if;
  insert into public.assessments (module_version_id, title, instructions, pass_mark, max_attempts, time_limit_minutes, feedback_mode, draw_count, shuffle_questions, shuffle_options)
  values (p_to, s.title, s.instructions, s.pass_mark, s.max_attempts, s.time_limit_minutes, s.feedback_mode, s.draw_count, s.shuffle_questions, s.shuffle_options)
  returning id into v_ns;
  for q in select * from public.questions where assessment_id = s.id order by position loop
    insert into public.questions (assessment_id, question_key, type, prompt, image_asset_id, points, explanation, position, suggested)
    values (v_ns, q.question_key, q.type, q.prompt, q.image_asset_id, q.points, q.explanation, q.position, q.suggested) returning id into v_nq;
    insert into public.question_options (question_id, label, image_asset_id, position)
    select v_nq, o.label, o.image_asset_id, o.position from public.question_options o where o.question_id = q.id;
    insert into public.answer_keys (question_id, correct_option_ids, marking_guide)
    select v_nq, coalesce(array_agg(n.id) filter (where o.id = any (k.correct_option_ids)), '{}'), k.marking_guide
    from public.answer_keys k
    join public.question_options o on o.question_id = q.id
    join public.question_options n on n.question_id = v_nq and n.position = o.position
    where k.question_id = q.id
    group by k.marking_guide;
  end loop;
end $$;

-- New versions now carry the test along.
create or replace function public.author_new_version(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  m public.modules;
  cv public.module_versions;
  v_new uuid;
begin
  select * into m from public.modules where id = (p ->> 'module_id')::uuid;
  perform app.require(m.id is not null and app.can_edit_module(m.id), 'You cannot edit this training.');
  if (app.open_version(m.id)).id is not null then
    return public.author_get(jsonb_build_object('module_id', m.id));
  end if;
  select * into cv from public.module_versions where id = m.current_version_id;
  insert into public.module_versions (module_id, version_no, title, summary, est_minutes, created_by)
  values (m.id, (select max(version_no) + 1 from public.module_versions where module_id = m.id), cv.title, cv.summary, cv.est_minutes, v_me)
  returning id into v_new;
  insert into public.lessons (module_version_id, lesson_key, position, title, content, est_minutes)
  select v_new, l.lesson_key, l.position, l.title, l.content, l.est_minutes from public.lessons l where l.module_version_id = cv.id;
  perform app.copy_assessment(cv.id, v_new);
  return public.author_get(jsonb_build_object('module_id', m.id));
end $$;

-- ───────────────────────── Authoring
create or replace function public.author_get_test(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  m public.modules;
  v public.module_versions;
  s public.assessments;
begin
  select * into m from public.modules where id = (p ->> 'module_id')::uuid;
  perform app.require(m.id is not null and app.can_edit_module(m.id), 'You cannot edit this training.');
  v := app.open_version(m.id);
  if v.id is null then select * into v from public.module_versions where id = m.current_version_id; end if;
  select * into s from public.assessments where module_version_id = v.id;
  if s.id is null then return jsonb_build_object('enabled', false, 'pass_mark', 80, 'max_attempts', 3, 'questions', '[]'::jsonb); end if;
  return jsonb_build_object('enabled', true, 'pass_mark', s.pass_mark, 'max_attempts', s.max_attempts,
    'questions', (select coalesce(jsonb_agg(jsonb_build_object(
        'type', q.type, 'prompt', q.prompt, 'explanation', q.explanation, 'points', q.points, 'suggested', q.suggested,
        'options', (select coalesce(jsonb_agg(jsonb_build_object('label', o.label, 'correct', o.id = any (k.correct_option_ids)) order by o.position), '[]'::jsonb)
                    from public.question_options o where o.question_id = q.id))
      order by q.position), '[]'::jsonb)
      from public.questions q left join public.answer_keys k on k.question_id = q.id where q.assessment_id = s.id));
end $$;

create or replace function public.author_save_test(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  m public.modules;
  v public.module_versions;
  v_test jsonb := coalesce(p -> 'test', '{}'::jsonb);
  v_sid uuid; v_qid uuid; v_oid uuid;
  q jsonb; o jsonb;
  i int := 0; j int;
  v_correct uuid[];
  v_type public.question_type;
  v_ncorrect int;
begin
  select * into m from public.modules where id = (p ->> 'module_id')::uuid;
  perform app.require(m.id is not null and app.can_edit_module(m.id), 'You cannot edit this training.');
  v := app.open_version(m.id);
  perform app.require(v.id is not null, 'This version is published. Start a new version to make changes.');
  if v.status = 'in_review' and not app.can_publish_module(m.id) then
    update public.module_versions set status = 'draft', submitted_at = null, submitted_by = null where id = v.id;
  end if;

  delete from public.assessments where module_version_id = v.id;   -- questions, options and keys follow (draft only)
  if not coalesce((v_test ->> 'enabled')::boolean, false) then
    return public.author_get_test(jsonb_build_object('module_id', m.id));
  end if;

  perform app.require(jsonb_array_length(coalesce(v_test -> 'questions', '[]'::jsonb)) between 1 and 60, 'A test needs between 1 and 60 questions.');
  insert into public.assessments (module_version_id, title, pass_mark, max_attempts, feedback_mode, shuffle_questions, shuffle_options)
  values (v.id, coalesce(nullif(trim(v_test ->> 'title'), ''), 'Test: ' || v.title),
          least(100, greatest(1, coalesce((v_test ->> 'pass_mark')::int, 80))),
          case when nullif(v_test ->> 'max_attempts', '') is null then null else least(10, greatest(1, (v_test ->> 'max_attempts')::int)) end,
          'show_mistakes', true, true)
  returning id into v_sid;

  for q in select * from jsonb_array_elements(v_test -> 'questions') loop
    i := i + 1;
    v_type := coalesce(nullif(q ->> 'type', ''), 'single_choice')::public.question_type;
    perform app.require(v_type in ('single_choice', 'multi_choice', 'true_false'), format('Question %s has a type that cannot be marked automatically.', i));
    perform app.require(nullif(trim(q ->> 'prompt'), '') is not null, format('Question %s has no question text.', i));
    perform app.require(jsonb_array_length(coalesce(q -> 'options', '[]'::jsonb)) between 2 and 8, format('Question %s needs 2 to 8 answers.', i));
    select count(*) into v_ncorrect from jsonb_array_elements(q -> 'options') x where coalesce((x ->> 'correct')::boolean, false);
    perform app.require(v_ncorrect >= 1, format('Question %s: mark the correct answer.', i));
    perform app.require(v_type = 'multi_choice' or v_ncorrect = 1, format('Question %s: only one answer can be correct.', i));
    perform app.require(not exists (select 1 from jsonb_array_elements(q -> 'options') x where nullif(trim(x ->> 'label'), '') is null),
      format('Question %s has an empty answer.', i));

    insert into public.questions (assessment_id, type, prompt, points, explanation, position, suggested)
    values (v_sid, v_type, trim(q ->> 'prompt'), 1, nullif(trim(q ->> 'explanation'), ''), i, coalesce((q ->> 'suggested')::boolean, false))
    returning id into v_qid;
    v_correct := '{}'; j := 0;
    for o in select * from jsonb_array_elements(q -> 'options') loop
      j := j + 1;
      insert into public.question_options (question_id, label, position) values (v_qid, trim(o ->> 'label'), j) returning id into v_oid;
      if coalesce((o ->> 'correct')::boolean, false) then v_correct := v_correct || v_oid; end if;
    end loop;
    insert into public.answer_keys (question_id, correct_option_ids) values (v_qid, v_correct);
  end loop;
  update public.modules set updated_at = now() where id = m.id;
  return public.author_get_test(jsonb_build_object('module_id', m.id));
end $$;

-- ───────────────────────── Taking a test
create or replace function public.get_module(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_emp uuid := app.require_employee();
  m public.modules;
  v public.module_versions;
  v_next uuid;
begin
  select * into m from public.modules where id = (p ->> 'module_id')::uuid and archived_at is null;
  perform app.require(m.id is not null and app.can_see_module(m.id), 'This module is not available.');
  select * into v from public.module_versions where id = m.current_version_id and status = 'published';
  perform app.require(v.id is not null, 'This module has not been published yet.');
  select l.id into v_next from public.lessons l
  left join public.lesson_progress lp on lp.employee_id = v_emp and lp.module_id = m.id and lp.lesson_key = l.lesson_key
  where l.module_version_id = v.id and lp.completed_at is null order by l.position limit 1;
  return jsonb_build_object(
    'id', m.id, 'code', m.code, 'title', v.title, 'summary', v.summary, 'est_minutes', v.est_minutes, 'version_no', v.version_no,
    'locked', app.module_locked(v_emp, m.id),
    'progress', app.module_progress(v_emp, m.id),
    'test', app.test_json(v_emp, m.id),
    'all_lessons_done', v_next is null,
    'next_lesson_id', coalesce(v_next, (select l.id from public.lessons l where l.module_version_id = v.id order by l.position limit 1)),
    'lessons', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'position', l.position, 'est_minutes', l.est_minutes,
                  'completed_at', lp.completed_at) order by l.position), '[]'::jsonb)
                from public.lessons l
                left join public.lesson_progress lp on lp.employee_id = v_emp and lp.module_id = m.id and lp.lesson_key = l.lesson_key
                where l.module_version_id = v.id));
end $$;

create or replace function public.get_attempt(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_emp uuid := app.require_employee();
  a public.attempts;
  s public.assessments;
begin
  select * into a from public.attempts where id = (p ->> 'attempt_id')::uuid;
  perform app.require(a.id is not null and a.employee_id = v_emp, 'This test attempt is not yours.');
  select * into s from public.assessments where id = a.assessment_id;
  return jsonb_build_object(
    'id', a.id, 'status', a.status, 'attempt_no', a.attempt_no, 'pass_mark', s.pass_mark, 'title', s.title,
    'questions', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'type', q.type, 'prompt', q.prompt,
        'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label)
                       order by coalesce(array_position(array(select jsonb_array_elements_text(a.option_order -> q.id::text))::uuid[], o.id), o.position)), '[]'::jsonb)
                    from public.question_options o where o.question_id = q.id))
      order by array_position(a.question_ids, q.id)), '[]'::jsonb)
      from public.questions q where q.id = any (a.question_ids)));
end $$;

create or replace function public.start_attempt(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_emp uuid := app.require_employee();
  m public.modules;
  s public.assessments;
  v_stats jsonb;
  v_qids uuid[];
  v_order jsonb;
  v_id uuid;
begin
  select * into m from public.modules where id = (p ->> 'module_id')::uuid;
  perform app.require(m.id is not null and app.can_see_module(m.id), 'This module is not available.');
  select * into s from public.assessments where module_version_id = m.current_version_id;
  perform app.require(s.id is not null, 'This module has no test.');
  perform app.require(not app.module_locked(v_emp, m.id), 'Finish the previous module first.');
  perform app.require(not exists (
      select 1 from public.lessons l
      left join public.lesson_progress lp on lp.employee_id = v_emp and lp.module_id = m.id and lp.lesson_key = l.lesson_key
      where l.module_version_id = m.current_version_id and lp.completed_at is null),
    'Finish all the lessons before the test.');
  v_stats := app.attempt_stats(v_emp, s.id);
  perform app.require(not (v_stats ->> 'passed')::boolean, 'You already passed this test.');
  if v_stats ->> 'in_progress' is not null then
    return public.get_attempt(jsonb_build_object('attempt_id', v_stats ->> 'in_progress'));
  end if;
  perform app.require((v_stats ->> 'left') is null or (v_stats ->> 'left')::int > 0,
    'You have used all your attempts. Your manager can give you another one.');

  select array_agg(id order by case when s.shuffle_questions then random() else position end) into v_qids
  from (select id, position from public.questions where assessment_id = s.id
        order by case when s.shuffle_questions then random() else position end
        limit coalesce(s.draw_count, 1000)) x;
  select coalesce(jsonb_object_agg(q.id, (select jsonb_agg(o.id order by case when s.shuffle_options and q.type <> 'true_false' then random() else o.position end)
                                          from public.question_options o where o.question_id = q.id)), '{}'::jsonb)
  into v_order from public.questions q where q.id = any (v_qids);
  insert into public.attempts (assessment_id, employee_id, attempt_no, question_ids, option_order)
  values (s.id, v_emp, (select coalesce(max(attempt_no), 0) + 1 from public.attempts where assessment_id = s.id and employee_id = v_emp), v_qids, v_order)
  returning id into v_id;
  return public.get_attempt(jsonb_build_object('attempt_id', v_id));
end $$;

create or replace function public.get_attempt_result(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_emp uuid := app.require_employee();
  a public.attempts;
  s public.assessments;
  v_module uuid;
begin
  select * into a from public.attempts where id = (p ->> 'attempt_id')::uuid;
  perform app.require(a.id is not null and app.can_view_employee(a.employee_id), 'This result is not available.');
  perform app.require(a.status = 'marked', 'This test has not been marked yet.');
  select * into s from public.assessments where id = a.assessment_id;
  select v.module_id into v_module from public.module_versions v where v.id = s.module_version_id;
  return jsonb_build_object(
    'id', a.id, 'module_id', v_module, 'score_pct', a.score_pct, 'passed', a.passed, 'pass_mark', s.pass_mark,
    'correct', (select count(*) from public.attempt_answers x where x.attempt_id = a.id and x.is_correct),
    'total', array_length(a.question_ids, 1),
    'stats', app.attempt_stats(a.employee_id, s.id),
    -- Which answers were wrong and why to look again; never the right answer.
    'mistakes', (select coalesce(jsonb_agg(jsonb_build_object('prompt', q.prompt, 'explanation', q.explanation)
                   order by array_position(a.question_ids, q.id)), '[]'::jsonb)
                 from public.attempt_answers x join public.questions q on q.id = x.question_id
                 where x.attempt_id = a.id and not x.is_correct));
end $$;

create or replace function public.submit_attempt(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_emp uuid := app.require_employee();
  a public.attempts;
  s public.assessments;
  e public.employees;
  q record;
  v_sel uuid[];
  v_ok boolean;
  v_score numeric := 0; v_max numeric := 0; v_pct numeric;
  v_passed boolean;
  v_title text;
  v_left jsonb;
begin
  select * into a from public.attempts where id = (p ->> 'attempt_id')::uuid for update;
  perform app.require(a.id is not null and a.employee_id = v_emp, 'This test attempt is not yours.');
  perform app.require(a.status = 'in_progress', 'This test was already submitted.');
  select * into s from public.assessments where id = a.assessment_id;

  for q in select qq.id, qq.points, k.correct_option_ids from public.questions qq
           left join public.answer_keys k on k.question_id = qq.id where qq.id = any (a.question_ids) loop
    select coalesce(array_agg(distinct x::uuid), '{}') into v_sel
    from jsonb_array_elements(coalesce(p -> 'answers', '[]'::jsonb)) ans
    cross join lateral jsonb_array_elements_text(coalesce(ans -> 'option_ids', '[]'::jsonb)) x
    where ans ->> 'question_id' = q.id::text
      and exists (select 1 from public.question_options o where o.id = x::uuid and o.question_id = q.id);
    v_ok := v_sel <@ q.correct_option_ids and q.correct_option_ids <@ v_sel and cardinality(v_sel) > 0;
    insert into public.attempt_answers (attempt_id, question_id, option_ids, is_correct, points_awarded)
    values (a.id, q.id, v_sel, v_ok, case when v_ok then q.points else 0 end)
    on conflict (attempt_id, question_id) do update set option_ids = excluded.option_ids, is_correct = excluded.is_correct,
      points_awarded = excluded.points_awarded, updated_at = now();
    v_max := v_max + q.points;
    if v_ok then v_score := v_score + q.points; end if;
  end loop;

  v_pct := case when v_max = 0 then 0 else round(100.0 * v_score / v_max, 2) end;
  v_passed := v_pct >= s.pass_mark;
  update public.attempts set submitted_at = now(), status = 'marked', score_points = v_score, max_points = v_max,
    score_pct = v_pct, passed = v_passed, marked_at = now() where id = a.id;

  select coalesce(m.code || ' · ', '') || v.title into v_title
  from public.module_versions v join public.modules m on m.id = v.module_id where v.id = s.module_version_id;
  perform app.log_activity(v_emp, case when v_passed then 'passed_test' else 'failed_test' end, 'assessment', s.id, v_title,
    jsonb_build_object('score', v_pct, 'attempt', a.attempt_no));
  if v_passed then
    perform app.refresh_employee(v_emp);
  else
    v_left := app.attempt_stats(v_emp, s.id) -> 'left';
    if v_left is not null and (v_left #>> '{}')::int = 0 then
      select * into e from public.employees where id = v_emp;
      if e.manager_id is not null then
        perform app.notify(e.manager_id, 'unlock', app.display_name(e) || ' needs another attempt: ' || v_title,
          format('Best score %s%%. Open their record to give another attempt.', round(v_pct)), '/team/' || e.id);
      end if;
    end if;
  end if;
  return public.get_attempt_result(jsonb_build_object('attempt_id', a.id));
end $$;

-- Manager (direct reports) or HR gives extra attempts.
create or replace function public.grant_attempt(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  v_emp uuid := (p ->> 'employee_id')::uuid;
  m public.modules;
  s public.assessments;
begin
  perform app.require(v_emp <> v_me, 'You cannot give yourself attempts.');
  perform app.require(app.manages(v_emp) or exists (select 1 from public.employees e where e.id = v_emp and app.can_admin_company(e.company_id)),
    'Only their manager or HR can give another attempt.');
  select * into m from public.modules where id = (p ->> 'module_id')::uuid;
  select * into s from public.assessments where module_version_id = m.current_version_id;
  perform app.require(s.id is not null, 'This module has no test.');
  insert into public.attempt_grants (employee_id, assessment_id, extra_attempts, reason, granted_by)
  values (v_emp, s.id, greatest(1, least(5, coalesce((p ->> 'extra')::int, 1))), nullif(trim(p ->> 'reason'), ''), v_me);
  perform app.log_activity(v_emp, 'attempt_granted', 'assessment', s.id, coalesce(m.code || ' · ', '') || m.title);
  perform app.notify(v_emp, 'unlock', 'You can try the test again: ' || coalesce(m.code || ' · ', '') || m.title,
    'Given by ' || (select app.display_name(x) from public.employees x where x.id = v_me) || '.', '/learn/' || m.id);
  return app.attempt_stats(v_emp, s.id);
end $$;

-- Test results on a person's record (manager or HR view).
create or replace function public.employee_tests(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := app.require_employee();
  v_emp uuid := (p ->> 'employee_id')::uuid;
begin
  perform app.require(app.can_view_employee(v_emp));
  return (select coalesce(jsonb_agg(x order by x ->> 'title'), '[]'::jsonb) from (
    select distinct on (m.id) jsonb_build_object(
      'module_id', m.id, 'title', coalesce(m.code || ' · ', '') || m.title, 'pass_mark', s.pass_mark,
      'stats', app.attempt_stats(v_emp, s.id),
      'last_score', (select a.score_pct from public.attempts a where a.assessment_id = s.id and a.employee_id = v_emp and a.status = 'marked'
                     order by a.submitted_at desc limit 1),
      'can_grant', v_emp <> v_me and (app.manages(v_emp) or exists (select 1 from public.employees e where e.id = v_emp and app.can_admin_company(e.company_id)))) as x
    from public.assignments asg
    join public.programme_items pi on pi.programme_id = asg.programme_id and pi.kind = 'module' and pi.removed_at is null
    join public.modules m on m.id = pi.module_id
    join public.assessments s on s.module_version_id = m.current_version_id
    where asg.employee_id = v_emp and asg.cancelled_at is null) t);
end $$;

select app.lock_down();
`,__vite_glob_1_10=`-- Ritestand portal · Supabase-only platform pieces (storage buckets, schedules).
-- Guarded so the same migrations also run in the in-browser demo database, where these schemas do not exist.

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('media', 'media', false, 262144000),       -- lesson images, video, PDFs (250 MB)
           ('policies', 'policies', false, 52428800)    -- policy documents (50 MB)
    on conflict (id) do nothing;

    execute $p$create policy "signed-in employees read content files" on storage.objects for select to authenticated
      using (bucket_id in ('media', 'policies') and app.current_employee_id() is not null)$p$;
    execute $p$create policy "content staff upload files" on storage.objects for insert to authenticated
      with check (bucket_id in ('media', 'policies') and app.is_content_staff())$p$;
  end if;

  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
end $$;
`,__vite_glob_2_0=`-- Ritestand Induction · content seed: settings, practical tasks, programmes, modules and policies (example content).
-- People are loaded separately: supabase/private/staff.sql (real staff, not in git) or supabase/tests/fixtures/people.sql (fictional).
-- Never load into production.
do $seed$
declare
  v_prog uuid; v_field uuid; v_pols uuid;
  v_mod uuid; v_ver uuid; v_pol uuid; v_pver uuid; v_task1 uuid; v_task2 uuid; v_task3 uuid; v_task4 uuid;
  v_pos int := 0;
  r record;
begin
  insert into public.settings (company_id, key, value) values
    (null, 'ack_statement', jsonb_build_object(
      'en', 'I confirm that I have read and understood this policy and that I will follow it.',
      'pt', 'Confirmo que li e compreendi esta política e que irei cumpri-la.')),
    (null, 'reminder_days_before', '3'::jsonb);
  -- ───────────── Practical tasks
  insert into public.practical_tasks (title, instructions) values
    ('PPE issued and fitted', 'Supervisor confirms that safety boots, overalls, eye and hearing protection were issued in the right sizes and fitted.') returning id into v_task1;
  insert into public.practical_tasks (title, instructions) values
    ('Site safety induction completed', 'Walk the site with the new employee: emergency exits, assembly point, first-aid kit, fire equipment and no-go zones.') returning id into v_task2;
  insert into public.practical_tasks (title, instructions) values
    ('Client mine site induction', 'Confirm the employee completed the client''s own site induction and holds a valid access card.') returning id into v_task3;
  insert into public.practical_tasks (title, instructions) values
    ('Vehicle pre-trip inspection', 'Employee completes a pre-trip inspection of a service vehicle while the supervisor observes.') returning id into v_task4;

  -- ───────────── Programmes
  insert into public.programmes (title, description, kind, status, sequential)
  values ('Group onboarding', 'Everything every new Ritestand Group employee needs in their first month: who we are, how we work, how we keep each other safe, and what we sell.', 'onboarding', 'active', true)
  returning id into v_prog;
  insert into public.programmes (title, description, kind, status, sequential)
  values ('Field service induction', 'For technicians who work on client mine sites and service vehicles.', 'department', 'active', false)
  returning id into v_field;
  insert into public.programmes (title, description, kind, status, sequential, certificate_enabled)
  values ('Company policies', 'Read and confirm the company policies. Everyone repeats this once a year.', 'refresher', 'active', false, false)
  returning id into v_pols;

  -- ───────────── Modules (draft → lessons → published)
  for r in select * from (values
    ('01', 'Welcome to Ritestand Group', 'Who we are, how the group fits together and what we stand for.', 'day_1',
     array['Who we are', 'How the group fits together'],
     array[
      E'> Example content. Replace with the approved version before launch.\\n\\nRitestand Group designs, builds and services equipment that protects people and machines in mining and industry. You are joining a group of companies that share people, standards and customers.\\n\\n## What we do\\n- **Fire suppression** for mining vehicles, plant and equipment\\n- **Dust suppression** for haul roads, conveyors and processing plants\\n- **Downhole geophysics** through Wireline\\n\\n## Our values\\n- **Safety first.** Nobody goes home hurt.\\n- **Own the job.** Finish what you start and say when something is wrong.\\n- **Customers can rely on us.** What we promise, we deliver.',
      E'The group operates through several companies. Each has its own management, departments and sites, and all of them share the group''s policies and this portal.\\n\\n- **Ritestand Fire** designs and manufactures fire suppression systems at its Mooinooi factory.\\n- **Wireline** provides downhole geophysical logging services.\\n- **Wireline Africa** sells, installs and services fire and dust suppression products in South Africa, with **Wireline Africa Limitada** in Mozambique.\\n\\n> Ask your manager which company and department you belong to. You can also see it on your profile.']),
    ('02', 'Company policies', 'How we work together: conduct, leave, and the rules everyone follows.', 'week_1',
     array['Why policies matter', 'Leave and working hours'],
     array[
      E'> Example content. Replace with the approved version before launch.\\n\\nPolicies protect you as much as they protect the company. They tell you what you can expect from us, and what we expect from you.\\n\\n## Where to find them\\nEvery policy you must follow is in **Policies** in this portal. When a policy changes, you will see it there and be asked to confirm the new version.',
      E'## Leave\\n1. Request leave through your manager at least two weeks ahead where possible.\\n2. Sick leave longer than two days needs a medical certificate.\\n3. Family responsibility leave is available as set out in the Leave Policy.\\n\\n## Working hours\\nYour contract sets your working hours. Overtime must be approved by your manager before you work it.']),
    ('03', 'Health & safety', 'Workplace safety, emergencies and your responsibilities.', 'week_1',
     array['Your safety responsibilities', 'In an emergency'],
     array[
      E'> Example content. Replace with the SHEQ-approved version before launch.\\n\\nEvery employee has the right to refuse unsafe work, and the duty to report unsafe conditions.\\n\\n## Always\\n- Wear the PPE your task requires.\\n- Report every incident and near miss, the same day.\\n- Never bypass a guard, interlock or isolation.\\n\\n> If you are unsure whether something is safe, stop and ask.',
      E'## When the alarm sounds\\n1. Stop work and make your equipment safe if you can do so quickly.\\n2. Walk to the assembly point. Do not run and do not use lifts.\\n3. Report to the person taking the roll call.\\n4. Wait for the all-clear before going back.\\n\\n## Injuries\\nCall a first-aider and report the injury to your supervisor, however small it seems.']),
    ('04', 'Products & services', 'Fire and dust suppression: what we make, how it works, where it is used.', 'month_1',
     array['Fire suppression', 'Dust suppression'],
     array[
      E'> Example content. Replace with material from the product team before launch.\\n\\nMining vehicles and plant carry fuel, hydraulic oil and hot surfaces. A fire can destroy a machine worth millions and put the operator in danger within seconds.\\n\\n## Our product families\\n- **Vehicle fire suppression** systems that detect and extinguish fires on mobile machines\\n- **Mobile extinguishing units** such as trailer and skid units for larger fires\\n- **Portable extinguishers** for first response\\n\\n## How a suppression system works\\n1. Detection tubing or sensors pick up heat or flame.\\n2. The system releases agent through nozzles aimed at the risk areas.\\n3. The operator is alerted and the engine can be shut down automatically.',
      E'Dust on haul roads and at transfer points harms health, reduces visibility and wears out equipment.\\n\\n## What dust suppression does\\n- Binds fine particles with water or additives\\n- Uses nozzles and mist to catch airborne dust at the source\\n- Reduces water use compared with open spraying\\n\\n> Ask the sales team for the current product catalogue and reference sites.']),
    ('05', 'Internal operations', 'Who does what, how we communicate and how work flows.', 'month_1',
     array['How work flows', 'Communication and reporting'],
     array[
      E'> Example content. Replace with the approved version before launch.\\n\\n## From order to installation\\n1. Sales confirms the customer''s requirement and quote.\\n2. The workshop builds or prepares the system.\\n3. Field services installs and commissions it on site.\\n4. Service contracts keep it inspected and working.',
      E'## Reporting\\nYour manager is your first point of contact. Safety concerns can always go straight to SHEQ.\\n\\n## Communication\\n- Use your company email and Microsoft Teams for work.\\n- Customer information stays in company systems.']),
    ('06', 'IT & security', 'Email, passwords, phishing and the systems you will use.', 'month_1',
     array['Your accounts', 'Spotting phishing'],
     array[
      E'> Example content. Replace with the IT-approved version before launch.\\n\\nYour Microsoft 365 account gives you email, Teams and this portal. Protect it.\\n\\n- Use the Microsoft Authenticator app for sign-in approval.\\n- Never share your password or approve a sign-in you did not start.\\n- Lock your screen when you walk away.',
      E'## Warning signs\\n- Urgent requests to pay, buy gift cards or change bank details\\n- Links that do not match the company they claim to be from\\n- Attachments you did not expect\\n\\n> When in doubt, do not click. Forward the message to IT support.']),
    ('07', 'Final assessment', 'A short assessment that covers the whole programme.', 'month_1',
     array['Before you start'],
     array[E'> Example content. The questions are added once the pass mark and rules are confirmed.\\n\\nThis assessment checks that you understood the key points from modules 01 to 06. You can go back to any module before you start.']),
    ('F1', 'Working on client mine sites', 'Site access, permits and behaviour on a customer''s mine.', 'week_1',
     array['Before you arrive', 'On site'],
     array[
      E'> Example content. Replace with the field services version before launch.\\n\\n- Confirm your site induction and access card are valid.\\n- Carry your medical fitness certificate if the site requires it.\\n- Know the site''s emergency number.',
      E'- Follow the client''s rules first; they are stricter than ours.\\n- Work only under a valid permit.\\n- Report every incident to the client and to your supervisor.'])
  ) as t(code, title, summary, milestone, lesson_titles, lesson_bodies) loop
    insert into public.modules (code, title, summary, review_by)
    values (r.code, r.title, r.summary, current_date + 180) returning id into v_mod;
    insert into public.module_versions (module_id, version_no, title, summary, est_minutes, change_note)
    values (v_mod, 1, r.title, r.summary, 8 * array_length(r.lesson_titles, 1), 'First version') returning id into v_ver;
    for i in 1 .. array_length(r.lesson_titles, 1) loop
      insert into public.lessons (module_version_id, position, title, content, est_minutes)
      values (v_ver, i, r.lesson_titles[i], app.md_to_doc(r.lesson_bodies[i]), 8);
    end loop;
    update public.module_versions set status = 'published', published_at = now() - interval '120 days' where id = v_ver;
    update public.modules set current_version_id = v_ver where id = v_mod;

    if r.code = 'F1' then
      insert into public.programme_items (programme_id, kind, module_id, position, milestone) values (v_field, 'module', v_mod, 1, 'week_1');
    else
      v_pos := v_pos + 10;
      insert into public.programme_items (programme_id, kind, module_id, position, milestone)
      values (v_prog, 'module', v_mod, v_pos, r.milestone::public.milestone);
    end if;
  end loop;

  -- ───────────── Policies (draft → published)
  for r in select * from (values
    ('Code of Conduct', 'Conduct', 'day_1', 5,
     E'> Example text. Replace with the approved policy before launch.\\n\\n## Purpose\\nThis code sets out how every employee of Ritestand Group behaves towards colleagues, customers and suppliers.\\n\\n## We expect you to\\n- Treat everyone with respect, regardless of who they are\\n- Act honestly and declare any conflict of interest\\n- Protect company property and confidential information\\n- Follow the law and the group''s policies\\n\\n## Breaches\\nBreaches are handled through the disciplinary procedure.'),
    ('Privacy notice for employees (POPIA)', 'Privacy', 'day_1', 7,
     E'> Example text. Replace with the approved notice before launch.\\n\\n## What we collect\\nYour name, contact details, employment details and training records.\\n\\n## Why\\nTo employ you, train you and meet our legal duties.\\n\\n## Your rights\\nYou may ask to see the personal information we hold about you and ask us to correct it. Contact the Information Officer through HR.'),
    ('Leave Policy', 'HR', 'week_1', 15,
     E'> Example text. Replace with the approved policy before launch.\\n\\n## Annual leave\\nAnnual leave accrues as set out in your contract and the Basic Conditions of Employment Act.\\n\\n## Sick leave\\nA medical certificate is required for absence of more than two consecutive days.\\n\\n## Requesting leave\\nRequest leave from your manager at least two weeks ahead where possible.'),
    ('SHEQ Policy', 'Health & safety', 'week_1', 25,
     E'> Example text. Replace with the SHEQ-approved policy before launch.\\n\\nRitestand Group is committed to zero harm. Management provides safe equipment, training and procedures. Every employee follows them, reports hazards and incidents, and stops unsafe work.'),
    ('IT Acceptable Use Policy', 'IT', 'month_1', 55,
     E'> Example text. Replace with the IT-approved policy before launch.\\n\\n- Company devices and accounts are for work.\\n- Do not install unapproved software.\\n- Report lost devices and suspicious messages to IT immediately.\\n- Company data stays in company systems.')
  ) as t(title, category, milestone, pos, body) loop
    insert into public.policies (title, category) values (r.title, r.category) returning id into v_pol;
    insert into public.policy_versions (policy_id, version_label, body, effective_date, change_summary, requires_reack, min_read_seconds)
    values (v_pol, '1.0', app.md_to_doc(r.body), current_date - 200, 'First version', true, 10) returning id into v_pver;
    update public.policy_versions set status = 'published', published_at = now() - interval '200 days',
      sha256 = encode(sha256(convert_to(app.doc_text(body), 'UTF8')), 'hex') where id = v_pver;
    update public.policies set current_version_id = v_pver where id = v_pol;
    insert into public.programme_items (programme_id, kind, policy_id, position, milestone)
    values (v_prog, 'policy', v_pol, r.pos, r.milestone::public.milestone),
           (v_pols, 'policy', v_pol, r.pos, 'week_1');
  end loop;

  insert into public.programme_items (programme_id, kind, task_id, position, milestone) values
    (v_prog, 'task', v_task1, 6, 'day_1'),
    (v_prog, 'task', v_task2, 26, 'week_1'),
    (v_field, 'task', v_task3, 2, 'week_1'),
    (v_field, 'task', v_task4, 3, 'week_1');

  -- ───────────── Assignment rules (before people, so new people are assigned automatically)
  insert into public.assignment_rules (programme_id, trigger, due_days) values (v_prog, 'on_start', 30);
end
$seed$;
`,__vite_glob_4_0=`-- Test fixture: fictional companies and people with simulated progress (plus Niel). Used by the database tests,
-- and by the demo when supabase/private/staff.sql does not exist. Never load into production.
do $fx$
declare
  c_rg uuid; c_rf uuid; c_wl uuid; c_wa uuid; c_mz uuid;
  v_prog uuid := (select id from public.programmes where title = 'Group onboarding');
  v_field uuid := (select id from public.programmes where title = 'Field service induction');
  pe record; a record; it record;
  n_items int; n_done int; v_at timestamptz;
begin
  -- ───────────── Companies & structure
  insert into public.companies (name, short_name, country, default_locale) values ('Ritestand Group', 'Ritestand Group', 'ZA', 'en') returning id into c_rg;
  insert into public.companies (name, short_name, country, default_locale) values ('Ritestand Fire', 'Ritestand Fire', 'ZA', 'en') returning id into c_rf;
  insert into public.companies (name, short_name, country, default_locale) values ('Wireline', 'Wireline', 'ZA', 'en') returning id into c_wl;
  insert into public.companies (name, short_name, country, default_locale) values ('Wireline Africa (Pty) Ltd', 'Wireline Africa', 'ZA', 'en') returning id into c_wa;
  insert into public.companies (name, short_name, country, default_locale) values ('Wireline Africa Limitada', 'Wireline Africa MZ', 'MZ', 'pt') returning id into c_mz;

  insert into public.departments (company_id, name)
  select c_rg, unnest(array['Management','Marketing','HR'])
  union all select c_rf, unnest(array['Management','HR & Administration','SHEQ','Sales','Manufacturing & Workshop','Field Services','IT','Finance'])
  union all select c_wl, unnest(array['Management','Logging Operations','Geophysics','SHEQ','Administration'])
  union all select c_wa, unnest(array['Management','Sales','Field Services','Workshop','Administration'])
  union all select c_mz, unnest(array['Operations','Field Services','Administration']);

  insert into public.sites (company_id, name, country) values
    (c_rg, 'Head office', 'ZA'), (c_rf, 'Mooinooi factory', 'ZA'), (c_wl, 'Broederstroom', 'ZA'), (c_wa, 'Broederstroom', 'ZA'), (c_mz, 'Mozambique office', 'MZ');

  insert into public.positions (company_id, title)
  select c_rf, unnest(array['HR Manager','Workshop Manager','SHEQ Officer','Fire Suppression Technician','Workshop Assistant',
                            'Fabricator','Sales Manager','Sales Representative','Finance Clerk','IT Support'])
  union all select c_wl, unnest(array['Logging Engineer','Field Operator','Geophysicist'])
  union all select c_wa, unnest(array['Branch Manager','Field Service Technician','Sales Representative','Administration Officer'])
  union all select c_mz, unnest(array['Operations Manager','Field Technician','Administration Officer']);


  insert into public.assignment_rules (programme_id, company_id, department_id, trigger, due_days)
  select v_field, d.company_id, d.id, 'on_start', 21 from public.departments d where d.name = 'Field Services';

  -- ───────────── People (fictional)
  create temp table seed_people (
    first_name text, last_name text, email text, company uuid, department text, position text,
    start_offset int, manager_email text, locale text, progress numeric, roles text[], signed_in boolean, status text
  ) on commit drop;
  insert into seed_people values
    ('Niel','Viljoen','niel.v@ritestand.com', c_rg,'Marketing',null, -900, null,'en',1,array['group_admin'],true,'active'),
    ('Anika','Botha','anika.botha@ritestand.test', c_rf,'HR & Administration','HR Manager', -2800, null,'en',1,array['group_admin'],true,'active'),
    ('Pieter','van Wyk','pieter.vanwyk@ritestand.test', c_rf,'Manufacturing & Workshop','Workshop Manager', -3500, null,'en',1,array[]::text[],true,'active'),
    ('Thabo','Nkosi','thabo.nkosi@ritestand.test', c_rf,'SHEQ','SHEQ Officer', -1900, null,'en',1,array['content_editor'],true,'active'),
    ('Riaan','du Plessis','riaan.duplessis@ritestand.test', c_rf,'Sales','Sales Manager', -4000, null,'en',1,array[]::text[],true,'active'),
    ('David','Naidoo','david.naidoo@ritestand.test', c_rf,'IT','IT Support', -1200, 'anika.botha@ritestand.test','en',1,array[]::text[],true,'active'),
    ('Lerato','Dlamini','lerato.dlamini@ritestand.test', c_rf,'Field Services','Fire Suppression Technician', -5, 'pieter.vanwyk@ritestand.test','en',0.3,array[]::text[],true,'active'),
    ('Sipho','Mahlangu','sipho.mahlangu@ritestand.test', c_rf,'Manufacturing & Workshop','Workshop Assistant', -40, 'pieter.vanwyk@ritestand.test','en',0.45,array[]::text[],true,'active'),
    ('Johan','Steyn','johan.steyn@ritestand.test', c_rf,'Manufacturing & Workshop','Fabricator', -20, 'pieter.vanwyk@ritestand.test','en',0.6,array[]::text[],true,'active'),
    ('Kabelo','Molefe','kabelo.molefe@ritestand.test', c_rf,'Manufacturing & Workshop','Workshop Assistant', 7, 'pieter.vanwyk@ritestand.test','en',0,array[]::text[],false,'pending'),
    ('Zanele','Khumalo','zanele.khumalo@ritestand.test', c_rf,'Sales','Sales Representative', -60, 'riaan.duplessis@ritestand.test','en',1,array[]::text[],true,'active'),
    ('Nomsa','Zulu','nomsa.zulu@ritestand.test', c_rf,'Sales','Sales Representative', -15, 'riaan.duplessis@ritestand.test','en',0.5,array[]::text[],true,'active'),
    ('Grace','Mokoena','grace.mokoena@ritestand.test', c_rf,'Finance','Finance Clerk', -70, 'anika.botha@ritestand.test','en',1,array[]::text[],true,'active'),
    ('Thomas','Smit','thomas.smit@ritestand.test', c_rf,'Field Services','Fire Suppression Technician', -300, 'pieter.vanwyk@ritestand.test','en',0.8,array[]::text[],true,'left'),
    ('Hendrik','Venter','hendrik.venter@wireline.test', c_wl,'Logging Operations','Logging Engineer', -2400, null,'en',1,array['company_admin'],true,'active'),
    ('Tumi','Sithole','tumi.sithole@wireline.test', c_wl,'Logging Operations','Field Operator', -25, 'hendrik.venter@wireline.test','en',0.55,array[]::text[],true,'active'),
    ('Willem','Coetzee','willem.coetzee@wireline.test', c_wl,'Geophysics','Geophysicist', -3, 'hendrik.venter@wireline.test','en',0.1,array[]::text[],true,'active'),
    ('Marelize','Pretorius','marelize.pretorius@wirelineafrica.test', c_wa,'Administration','Administration Officer', -1500, null,'en',1,array['company_admin'],true,'active'),
    ('Bongani','Ndlovu','bongani.ndlovu@wirelineafrica.test', c_wa,'Field Services','Field Service Technician', -33, 'marelize.pretorius@wirelineafrica.test','en',0.35,array[]::text[],true,'active'),
    ('Chantelle','Fourie','chantelle.fourie@wirelineafrica.test', c_wa,'Sales','Sales Representative', -12, 'marelize.pretorius@wirelineafrica.test','en',0.4,array[]::text[],true,'active'),
    ('Joaquim','Mabunda','joaquim.mabunda@wirelineafrica-mz.test', c_mz,'Operations','Operations Manager', -1700, null,'pt',1,array['company_admin'],true,'active'),
    ('Ana','Machava','ana.machava@wirelineafrica-mz.test', c_mz,'Field Services','Field Technician', -9, 'joaquim.mabunda@wirelineafrica-mz.test','pt',0.25,array[]::text[],true,'active'),
    ('Celso','Nhantumbo','celso.nhantumbo@wirelineafrica-mz.test', c_mz,'Field Services','Field Technician', -45, 'joaquim.mabunda@wirelineafrica-mz.test','pt',0.4,array[]::text[],true,'active'),
    ('Fátima','Cossa','fatima.cossa@wirelineafrica-mz.test', c_mz,'Administration','Administration Officer', -18, 'joaquim.mabunda@wirelineafrica-mz.test','pt',0.5,array[]::text[],true,'active');

  insert into public.employees (first_name, last_name, email, company_id, department_id, position_id, site_id, start_date, locale, employee_no)
  select s.first_name, s.last_name, s.email, s.company,
         (select d.id from public.departments d where d.company_id = s.company and d.name = s.department),
         (select x.id from public.positions x where x.company_id = s.company and x.title = s.position),
         (select si.id from public.sites si where si.company_id = s.company limit 1),
         current_date + s.start_offset, s.locale,
         'E' || lpad((row_number() over ())::text, 4, '0')
  from seed_people s;

  update public.employees e set manager_id = m.id
  from seed_people s join public.employees m on m.email = s.manager_email
  where e.email = s.email;

  update public.employees e set status = 'active'
  from seed_people s where e.email = s.email and s.signed_in and s.status <> 'left';

  update public.employees e set buddy_id = b.id
  from public.employees b
  where (e.email, b.email) in (('lerato.dlamini@ritestand.test', 'sipho.mahlangu@ritestand.test'),
                               ('ana.machava@wirelineafrica-mz.test', 'fatima.cossa@wirelineafrica-mz.test'));

  insert into public.role_assignments (employee_id, role, company_id)
  select e.id, rl.role_name::public.app_role, case when rl.role_name = 'company_admin' then e.company_id end
  from seed_people s join public.employees e on e.email = s.email cross join lateral unnest(s.roles) as rl(role_name);

  -- ───────────── Simulated progress (completions spread between start date and today)
  for pe in select emp.*, s.progress, s.status as target_status from seed_people s join public.employees emp on emp.email = s.email loop
    for a in select * from public.assignments where employee_id = pe.id loop
      select count(*) into n_items from public.programme_items where programme_id = a.programme_id and removed_at is null;
      n_done := floor(n_items * pe.progress);
      for it in select pi.*, row_number() over (order by pi.position) as rn
                from public.programme_items pi where pi.programme_id = a.programme_id and pi.removed_at is null
                order by pi.position limit n_done loop
        v_at := least(now() - interval '1 hour',
                      greatest(pe.start_date::timestamptz, now() - interval '170 days')
                      + (it.rn * interval '1 day' * greatest(1, least(current_date - pe.start_date, 170) / (n_items + 1)))
                      + interval '9 hours');
        if it.kind = 'policy' then
          insert into public.policy_acknowledgements (policy_version_id, employee_id, acknowledged_at, statement, document_sha256, seconds_viewed, user_agent)
          select p.current_version_id, pe.id, v_at, app.setting(pe.company_id, 'ack_statement') ->> pe.locale, v.sha256, 40 + (random() * 200)::int, 'seed'
          from public.policies p join public.policy_versions v on v.id = p.current_version_id where p.id = it.policy_id
          on conflict do nothing;
        elsif it.kind = 'task' then
          insert into public.sign_offs (employee_id, task_id, signed_by, signed_at, note)
          values (pe.id, it.task_id, coalesce(pe.manager_id, pe.id), v_at, null);
        end if;
        insert into public.item_completions (assignment_id, programme_item_id, completed_at, company_id, department_id,
                                             module_version_id, policy_version_id)
        values (a.id, it.id, v_at, pe.company_id, pe.department_id,
                (select m.current_version_id from public.modules m where m.id = it.module_id),
                (select p.current_version_id from public.policies p where p.id = it.policy_id));
        insert into public.activity_events (employee_id, verb, object_type, object_id, title, at)
        values (pe.id, case it.kind when 'module' then 'completed_module' when 'policy' then 'acknowledged_policy' else 'signed_off' end,
                it.kind::text, coalesce(it.module_id, it.policy_id, it.task_id),
                (select app.item_title(x) from public.programme_items x where x.id = it.id), v_at);
      end loop;

      -- Due dates follow the real start date; finished programmes get a certificate.
      update public.assignments set
        assigned_at = least(now(), greatest(pe.start_date::timestamptz, now() - interval '170 days')),
        due_on = greatest(pe.start_date, current_date - 170) + case when a.programme_id = v_field then 21 else 30 end
      where id = a.id;
      if n_done = n_items then
        update public.assignments set completed_at = coalesce(v_at, now()) where id = a.id;
        insert into public.certificates (employee_id, assignment_id, programme_id, title, certificate_no, verify_code, issued_at)
        select pe.id, a.id, a.programme_id, p.title, 'RG-' || to_char(coalesce(v_at, now()), 'YYYY') || '-' || nextval('public.certificate_no_seq'),
               upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)), coalesce(v_at, now())
        from public.programmes p where p.id = a.programme_id;
        insert into public.activity_events (employee_id, verb, object_type, object_id, title, at)
        select pe.id, 'completed_programme', 'programme', a.programme_id, p.title, coalesce(v_at, now())
        from public.programmes p where p.id = a.programme_id;
      end if;
    end loop;

    if pe.target_status = 'left' then
      update public.employees set status = 'left', left_at = now() - interval '20 days' where id = pe.id;
      update public.assignments set cancelled_at = now() - interval '20 days' where employee_id = pe.id and completed_at is null;
    end if;
  end loop;

  -- Assignment notifications were created "now"; age them to match.
  update public.notifications n set created_at = x.assigned_at, read_at = case when x.completed_at is not null then x.assigned_at + interval '1 day' end
  from public.assignments x where n.employee_id = x.employee_id and n.kind = 'assigned';
  update public.activity_events ev set at = x.assigned_at
  from public.assignments x where ev.employee_id = x.employee_id and ev.verb = 'assigned' and ev.object_id = x.programme_id;
end
$fx$;

-- Sign-in accounts for everyone active (the link trigger connects each to their employee record).
insert into auth.users (id, email, created_at)
select gen_random_uuid(), e.email, now() from public.employees e where e.status = 'active' and e.user_id is null;
`,__vite_glob_5_0=`-- Demo only (PGlite in the browser): file store and sign-in by name.
-- In the real portal, Microsoft confirms who you are; here, typing your name stands in for that step.
create table if not exists public.demo_files (
  path text primary key,
  mime text,
  data bytea not null,
  created_at timestamptz not null default now()
);
revoke all on public.demo_files from anon, authenticated;

create schema if not exists demo;

create or replace function demo.sign_in(p_identifier text) returns uuid
language plpgsql as $$
declare
  v text := lower(regexp_replace(trim(coalesce(p_identifier, '')), '\\s+', ' ', 'g'));
  v_ids uuid[];
  e public.employees;
  v_uid uuid;
begin
  if v = '' then
    raise exception 'Type your name or work email.';
  end if;
  -- Full name, preferred name + surname, email or employee number first; first name alone as a fallback.
  select array_agg(x.id) into v_ids from public.employees x
  where lower(x.email) = v or lower(x.first_name || ' ' || x.last_name) = v
     or lower(coalesce(nullif(x.preferred_name, ''), x.first_name) || ' ' || x.last_name) = v
     or lower(x.employee_no) = v;
  if v_ids is null then
    select array_agg(x.id) into v_ids from public.employees x
    where x.status <> 'left' and (lower(x.first_name) = v or lower(x.preferred_name) = v);
  end if;
  if v_ids is null then
    raise exception 'We could not find "%" on the employee list. Check the spelling, or ask HR to add you.', trim(p_identifier);
  end if;
  if array_length(v_ids, 1) > 1 then
    raise exception 'More than one person is called "%". Type your full name.', trim(p_identifier);
  end if;
  select * into e from public.employees where id = v_ids[1];
  if e.status = 'left' then
    raise exception 'You are no longer on the employee list. Contact HR if this is wrong.';
  elsif e.status = 'suspended' then
    raise exception 'Your access is suspended. Contact HR.';
  end if;
  if e.user_id is not null then
    return e.user_id;
  end if;
  -- First sign-in: create the account, then link it (the trigger links by email; people without an email are linked here).
  insert into auth.users (email) values (e.email) returning id into v_uid;
  if not exists (select 1 from public.employees where id = e.id and user_id = v_uid) then
    update public.employees set user_id = v_uid, status = 'active', first_sign_in_at = coalesce(first_sign_in_at, now())
    where id = e.id;
    perform app.log_activity(e.id, 'first_sign_in', 'employee', e.id, 'Signed in for the first time');
  end if;
  return v_uid;
end $$;
`,__vite_glob_5_1=`-- Demo only: test employee with NO admin rights, for trying the normal employee experience.
-- Starts today, so the full onboarding is assigned. Sign in by typing "Nielas" or "Nielas Viljoen".
insert into public.employees (employee_no, first_name, last_name, company_id, position_id, manager_id, start_date, locale)
select 'TEST-001', 'Nielas', 'Viljoen', c.id,
       (select x.id from public.positions x where x.company_id = c.id and x.title = 'Fire Technician'),
       (select m.id from public.employees m where m.employee_no = 'FIR-0064' and m.company_id = c.id),
       current_date, 'en'
from public.companies c
order by (c.name = 'Ritestand (Pty) Ltd') desc, c.name
limit 1
on conflict do nothing;
`;var p$2=Object.create,i=Object.defineProperty,c$2=Object.getOwnPropertyDescriptor,f$2=Object.getOwnPropertyNames,l=Object.getPrototypeOf,s$2=Object.prototype.hasOwnProperty,a$1=e=>{throw TypeError(e)},_$1=(e,r,M)=>r in e?i(e,r,{enumerable:!0,configurable:!0,writable:!0,value:M}):e[r]=M,d$1=(e,r)=>()=>(e&&(r=e(e=0)),r),D$3=(e,r)=>()=>(r||e((r={exports:{}}).exports,r),r.exports),F$2=(e,r)=>{for(var M in r)i(e,M,{get:r[M],enumerable:!0})},g$3=(e,r,M,fe)=>{if(r&&typeof r=="object"||typeof r=="function")for(let $n of f$2(r))!s$2.call(e,$n)&&$n!==M&&i(e,$n,{get:()=>r[$n],enumerable:!(fe=c$2(r,$n))||fe.enumerable});return e},L$1=(e,r,M)=>(M=e!=null?p$2(l(e)):{},g$3(i(M,"default",{value:e,enumerable:!0}),e)),P$2=(e,r,M)=>_$1(e,typeof r!="symbol"?r+"":r,M),n=(e,r,M)=>r.has(e)||a$1("Cannot "+M),h$1=(e,r,M)=>(n(e,r,"read from private field"),M?M.call(e):r.get(e)),R$1=(e,r,M)=>r.has(e)?a$1("Cannot add the same private member more than once"):r instanceof WeakSet?r.add(e):r.set(e,M),x$3=(e,r,M,fe)=>(n(e,r,"write to private field"),r.set(e,M),M),T$2=(e,r,M)=>(n(e,r,"access private method"),M),U$3=(e,r,M,fe)=>({set _($n){x$3(e,r,$n)},get _(){return h$1(e,r,fe)}}),u$1=d$1(()=>{}),yn={};F$2(yn,{ABSTIME:()=>Et,ACLITEM:()=>Ot,BIT:()=>Qt,BOOL:()=>ye$2,BPCHAR:()=>ve,BYTEA:()=>he,CHAR:()=>bt,CID:()=>St$1,CIDR:()=>Rt,CIRCLE:()=>Nt,DATE:()=>ze,FLOAT4:()=>Qe$1,FLOAT8:()=>_e$1,GTSVECTOR:()=>nn,INET:()=>kt,INT2:()=>Ve$1,INT4:()=>Fe$1,INT8:()=>be$2,INTERVAL:()=>Ft,JSON:()=>we$1,JSONB:()=>Ye$1,MACADDR:()=>Lt,MACADDR8:()=>Pt,MONEY:()=>Ut,NUMERIC:()=>vt,OID:()=>Ge$1,PATH:()=>xt,PG_DEPENDENCIES:()=>Zt,PG_LSN:()=>$t,PG_NDISTINCT:()=>Xt,PG_NODE_TREE:()=>Dt,POLYGON:()=>Mt,REFCURSOR:()=>Ht,REGCLASS:()=>jt,REGCONFIG:()=>rn,REGDICTIONARY:()=>sn,REGNAMESPACE:()=>an,REGOPER:()=>qt,REGOPERATOR:()=>Yt,REGPROC:()=>gt,REGPROCEDURE:()=>zt,REGROLE:()=>on,REGTYPE:()=>Wt,RELTIME:()=>Ct,SMGR:()=>It,TEXT:()=>ge$1,TID:()=>wt,TIME:()=>Vt,TIMESTAMP:()=>qe,TIMESTAMPTZ:()=>Ae,TIMETZ:()=>Gt,TINTERVAL:()=>Tt,TSQUERY:()=>tn,TSVECTOR:()=>en,TXID_SNAPSHOT:()=>Jt,UUID:()=>Kt,VARBIT:()=>_t$1,VARCHAR:()=>He$2,XID:()=>At,XML:()=>Bt,arrayParser:()=>mn,arraySerializer:()=>We$1,parseType:()=>se$1,parsers:()=>un,serializers:()=>cn,types:()=>je$1});u$1();var yt=globalThis.JSON.parse,ht=globalThis.JSON.stringify,ye$2=16,he=17,bt=18,be$2=20,Ve$1=21,Fe$1=23,gt=24,ge$1=25,Ge$1=26,wt=27,At=28,St$1=29,we$1=114,Bt=142,Dt=194,It=210,xt=602,Mt=604,Rt=650,Qe$1=700,_e$1=701,Et=702,Ct=703,Tt=704,Nt=718,Pt=774,Ut=790,Lt=829,kt=869,Ot=1033,ve=1042,He$2=1043,ze=1082,Vt=1083,qe=1114,Ae=1184,Ft=1186,Gt=1266,Qt=1560,_t$1=1562,vt=1700,Ht=1790,zt=2202,qt=2203,Yt=2204,jt=2205,Wt=2206,Kt=2950,Jt=2970,$t=3220,Xt=3361,Zt=3402,en=3614,tn=3615,nn=3642,rn=3734,sn=3769,Ye$1=3802,an=4089,on=4096,je$1={string:{to:ge$1,from:[ge$1,He$2,ve],serialize:e=>e instanceof Date?e.toISOString():e.toString(),parse:e=>e},number:{to:0,from:[Ve$1,Fe$1,Ge$1,Qe$1,_e$1],serialize:e=>e.toString(),parse:e=>+e},bigint:{to:be$2,from:[be$2],serialize:e=>e.toString(),parse:e=>{let r=BigInt(e);return r<Number.MIN_SAFE_INTEGER||r>Number.MAX_SAFE_INTEGER?r:Number(r)}},json:{to:we$1,from:[we$1,Ye$1],serialize:e=>typeof e=="string"?e:ht(e,(r,M)=>typeof M=="bigint"?M.toString():M),parse:e=>yt(e)},boolean:{to:ye$2,from:[ye$2],serialize:e=>{if(typeof e=="boolean")return e?"t":"f";if(typeof e=="number"){if(e===1)return"t";if(e===0)return"f"}else if(typeof e=="string"){let r=e.trim().toLowerCase();if(["true","t","yes","y","on","1"].includes(r))return"t";if(["false","f","no","n","off","0"].includes(r))return"f"}throw new Error("Invalid input for boolean type")},parse:e=>e==="t"},date:{to:Ae,from:[ze,qe,Ae],serialize:e=>{if(typeof e=="string")return e;if(e===1/0)return"infinity";if(e===-1/0)return"-infinity";if(typeof e=="number")return new Date(e).toISOString();if(e instanceof Date)return e.toISOString();throw new Error("Invalid input for date type")},parse:e=>e==="infinity"?1/0:e==="-infinity"?-1/0:new Date(e)},bytea:{to:he,from:[he],serialize:e=>{if(!(e instanceof Uint8Array))throw new Error("Invalid input for bytea type");return"\\x"+Array.from(e).map(r=>r.toString(16).padStart(2,"0")).join("")},parse:e=>{let r=e.slice(2);return Uint8Array.from({length:r.length/2},(M,fe)=>parseInt(r.substring(fe*2,(fe+1)*2),16))}}},Se=ln(je$1),un=Se.parsers,cn=Se.serializers;function se$1(e,r,M){if(e===null)return null;let fe=M?.[r]??Se.parsers[r];return fe?fe(e,r):e}function ln(e){return Object.keys(e).reduce(({parsers:r,serializers:M},fe)=>{let{to:$n,from:qn,serialize:jn,parse:Wn}=e[fe];return M[$n]=jn,M[fe]=jn,r[fe]=Wn,Array.isArray(qn)?qn.forEach(Yn=>{r[Yn]=Wn,M[Yn]=jn}):(r[qn]=Wn,M[qn]=jn),{parsers:r,serializers:M}},{parsers:{},serializers:{}})}var pn=/\\/g,dn=/"/g;function fn(e){return e.replace(pn,"\\\\").replace(dn,'\\"')}function We$1(e,r,M){if(Array.isArray(e)===!1)return e;if(!e.length)return"{}";let fe=e[0],$n=M===1020?";":",";return Array.isArray(fe)?`{${e.map(qn=>We$1(qn,r,M)).join($n)}}`:`{${e.map(qn=>(qn===void 0&&(qn=null),qn===null?"null":'"'+fn(r?r(qn):qn.toString())+'"')).join($n)}}`}var me={i:0,char:null,str:"",quoted:!1,last:0,p:null};function mn(e,r,M){return me.i=me.last=0,Ke$1(me,e,r,M)[0]}function Ke$1(e,r,M,fe){let $n=[],qn=fe===1020?";":",";for(;e.i<r.length;e.i++){if(e.char=r[e.i],e.quoted)e.char==="\\"?e.str+=r[++e.i]:e.char==='"'?($n.push(M?M(e.str):e.str),e.str="",e.quoted=r[e.i+1]==='"',e.last=e.i+2):e.str+=e.char;else if(e.char==='"')e.quoted=!0;else if(e.char==="{")e.last=++e.i,$n.push(Ke$1(e,r,M,fe));else if(e.char==="}"){if(e.last<e.i){let jn=r.slice(e.last,e.i);jn==="NULL"&&!e.quoted?$n.push(null):$n.push(M?M(jn):jn)}e.quoted=!1,e.last=e.i+1;break}else if(e.char===qn&&e.p!=="}"&&e.p!=='"'){let jn=r.slice(e.last,e.i);jn==="NULL"&&!e.quoted?$n.push(null):$n.push(M?M(jn):jn),e.last=e.i+1}e.p=e.char}return e.last<e.i&&$n.push(M?M(r.slice(e.last,e.i+1)):r.slice(e.last,e.i+1)),$n}var gn={};F$2(gn,{parseDescribeStatementResults:()=>bn,parseResults:()=>hn});u$1();function hn(e,r,M,fe){let $n=[],qn={rows:[],fields:[]},jn=0,Wn=M?.parsers?{...r,...M.parsers}:r;return e.forEach(Yn=>{switch(Yn.name){case"rowDescription":{let Xn=Yn;qn.fields=Xn.fields.map(Kn=>({name:Kn.name,dataTypeID:Kn.dataTypeID}));break}case"dataRow":{if(!qn)break;let Xn=Yn;M?.rowMode==="array"?qn.rows.push(Xn.fields.map((Kn,er)=>se$1(Kn,qn.fields[er].dataTypeID,Wn))):qn.rows.push(Object.fromEntries(Xn.fields.map((Kn,er)=>[qn.fields[er].name,se$1(Kn,qn.fields[er].dataTypeID,Wn)])));break}case"commandComplete":{let Xn=Yn.text.split(" "),Kn=Xn[0],er=parseInt(Xn[Xn.length-1],10);switch(Kn){case"INSERT":case"UPDATE":case"DELETE":case"COPY":case"MERGE":jn+=er;break}let nr={...qn,command:Kn,affectedRows:jn};Number.isNaN(er)||(nr.rowCount=er),fe&&(nr.blob=fe),$n.push(nr),qn={rows:[],fields:[]};break}}}),$n.length===0&&$n.push({affectedRows:0,rows:[],fields:[]}),$n}function bn(e){let r=e.find(M=>M.name==="parameterDescription");return r?r.dataTypeIDs:[]}u$1();u$1();u$1();function U$2(e){let r=e.length;for(let M=e.length-1;M>=0;M--){let fe=e.charCodeAt(M);fe>127&&fe<=2047?r++:fe>2047&&fe<=65535&&(r+=2),fe>=56320&&fe<=57343&&M--}return r}var g$2,b$1,N$1,ae$2,L,A$1,ie$2,T$1,Je$1,P$1=class{constructor(r=256){this.size=r,R$1(this,A$1),R$1(this,g$2),R$1(this,b$1,5),R$1(this,N$1,!1),R$1(this,ae$2,new TextEncoder),R$1(this,L,0),x$3(this,g$2,T$2(this,A$1,ie$2).call(this,r))}addInt32(r){return T$2(this,A$1,T$1).call(this,4),h$1(this,g$2).setInt32(h$1(this,b$1),r,h$1(this,N$1)),x$3(this,b$1,h$1(this,b$1)+4),this}addInt16(r){return T$2(this,A$1,T$1).call(this,2),h$1(this,g$2).setInt16(h$1(this,b$1),r,h$1(this,N$1)),x$3(this,b$1,h$1(this,b$1)+2),this}addUint16(r){return T$2(this,A$1,T$1).call(this,2),h$1(this,g$2).setUint16(h$1(this,b$1),r,h$1(this,N$1)),x$3(this,b$1,h$1(this,b$1)+2),this}addCString(r){return r&&this.addString(r),T$2(this,A$1,T$1).call(this,1),h$1(this,g$2).setUint8(h$1(this,b$1),0),U$3(this,b$1)._++,this}addString(r=""){let M=U$2(r);return T$2(this,A$1,T$1).call(this,M),h$1(this,ae$2).encodeInto(r,new Uint8Array(h$1(this,g$2).buffer,h$1(this,b$1))),x$3(this,b$1,h$1(this,b$1)+M),this}add(r){return T$2(this,A$1,T$1).call(this,r.byteLength),new Uint8Array(h$1(this,g$2).buffer).set(new Uint8Array(r),h$1(this,b$1)),x$3(this,b$1,h$1(this,b$1)+r.byteLength),this}flush(r){let M=T$2(this,A$1,Je$1).call(this,r);return x$3(this,b$1,5),x$3(this,g$2,T$2(this,A$1,ie$2).call(this,this.size)),new Uint8Array(M)}};g$2=new WeakMap,b$1=new WeakMap,N$1=new WeakMap,ae$2=new WeakMap,L=new WeakMap,A$1=new WeakSet,ie$2=function(e){return new DataView(new ArrayBuffer(e))},T$1=function(e){if(h$1(this,g$2).byteLength-h$1(this,b$1)<e){let r=h$1(this,g$2).buffer,M=r.byteLength+(r.byteLength>>1)+e;x$3(this,g$2,T$2(this,A$1,ie$2).call(this,M)),new Uint8Array(h$1(this,g$2).buffer).set(new Uint8Array(r))}},Je$1=function(e){if(e){h$1(this,g$2).setUint8(h$1(this,L),e);let r=h$1(this,b$1)-(h$1(this,L)+1);h$1(this,g$2).setInt32(h$1(this,L)+1,r,h$1(this,N$1))}return h$1(this,g$2).buffer.slice(e?0:5,h$1(this,b$1))};var f$1=new P$1,wn=e=>{f$1.addInt16(3).addInt16(0);for(let fe of Object.keys(e))f$1.addCString(fe).addCString(e[fe]);f$1.addCString("client_encoding").addCString("UTF8");let r=f$1.addCString("").flush(),M=r.byteLength+4;return new P$1().addInt32(M).add(r).flush()},An=()=>{let e=new DataView(new ArrayBuffer(8));return e.setInt32(0,8,!1),e.setInt32(4,80877103,!1),new Uint8Array(e.buffer)},Sn=e=>f$1.addCString(e).flush(112),Bn=(e,r)=>(f$1.addCString(e).addInt32(U$2(r)).addString(r),f$1.flush(112)),Dn=e=>f$1.addString(e).flush(112),In=e=>f$1.addCString(e).flush(81),xn=[],Mn=e=>{let r=e.name??"";r.length>63&&(console.error("Warning! Postgres only supports 63 characters for query names."),console.error("You supplied %s (%s)",r,r.length),console.error("This can cause conflicts and silent errors executing queries"));let M=f$1.addCString(r).addCString(e.text).addInt16(e.types?.length??0);return e.types?.forEach(fe=>M.addInt32(fe)),f$1.flush(80)},k=new P$1,Rn=(e,r)=>{for(let M=0;M<e.length;M++){let fe=r?r(e[M],M):e[M];if(fe===null)f$1.addInt16(0),k.addInt32(-1);else if(fe instanceof ArrayBuffer||ArrayBuffer.isView(fe)){let $n=ArrayBuffer.isView(fe)?fe.buffer.slice(fe.byteOffset,fe.byteOffset+fe.byteLength):fe;f$1.addInt16(1),k.addInt32($n.byteLength),k.add($n)}else f$1.addInt16(0),k.addInt32(U$2(fe)),k.addString(fe)}},En=(e={})=>{let r=e.portal??"",M=e.statement??"",fe=e.binary??!1,$n=e.values??xn,qn=$n.length;return f$1.addCString(r).addCString(M),f$1.addUint16(qn),Rn($n,e.valueMapper),f$1.addUint16(qn),f$1.add(k.flush()),f$1.addInt16(fe?1:0),f$1.flush(66)},Cn=new Uint8Array([69,0,0,0,9,0,0,0,0,0]),Tn=e=>{if(!e||!e.portal&&!e.rows)return Cn;let r=e.portal??"",M=e.rows??0,fe=U$2(r),$n=4+fe+1+4,qn=new DataView(new ArrayBuffer(1+$n));return qn.setUint8(0,69),qn.setInt32(1,$n,!1),new TextEncoder().encodeInto(r,new Uint8Array(qn.buffer,5)),qn.setUint8(fe+5,0),qn.setUint32(qn.byteLength-4,M,!1),new Uint8Array(qn.buffer)},Nn=(e,r)=>{let M=new DataView(new ArrayBuffer(16));return M.setInt32(0,16,!1),M.setInt16(4,1234,!1),M.setInt16(6,5678,!1),M.setInt32(8,e,!1),M.setInt32(12,r,!1),new Uint8Array(M.buffer)},Be$1=(e,r)=>{let M=new P$1;return M.addCString(r),M.flush(e)},Pn=f$1.addCString("P").flush(68),Un=f$1.addCString("S").flush(68),Ln=e=>e.name?Be$1(68,`${e.type}${e.name??""}`):e.type==="P"?Pn:Un,kn=e=>{let r=`${e.type}${e.name??""}`;return Be$1(67,r)},On=e=>f$1.add(e).flush(100),Vn=e=>Be$1(102,e),oe$2=e=>new Uint8Array([e,0,0,0,4]),Fn=oe$2(72),Gn=oe$2(83),Qn=oe$2(88),_n=oe$2(99),$e$1={startup:wn,password:Sn,requestSsl:An,sendSASLInitialResponseMessage:Bn,sendSCRAMClientFinalMessage:Dn,query:In,parse:Mn,bind:En,execute:Tn,describe:Ln,close:kn,flush:()=>Fn,sync:()=>Gn,end:()=>Qn,copyData:On,copyDone:()=>_n,copyFail:Vn,cancel:Nn},Ne$2={};F$2(Ne$2,{AuthenticationCleartextPassword:()=>G$1,AuthenticationMD5Password:()=>Q$1,AuthenticationOk:()=>F$1,AuthenticationSASL:()=>_,AuthenticationSASLContinue:()=>v$1,AuthenticationSASLFinal:()=>H,BackendKeyDataMessage:()=>J$1,CommandCompleteMessage:()=>Z$1,CopyDataMessage:()=>z$2,CopyResponse:()=>q$1,DataRowMessage:()=>ee$1,DatabaseError:()=>O$2,Field:()=>Y$2,NoticeMessage:()=>te$1,NotificationResponseMessage:()=>$$1,ParameterDescriptionMessage:()=>W,ParameterStatusMessage:()=>K,ReadyForQueryMessage:()=>X,RowDescriptionMessage:()=>j$2,bindComplete:()=>Ie$1,closeComplete:()=>xe$2,copyDone:()=>Te$2,emptyQuery:()=>Ce$2,noData:()=>Me$2,parseComplete:()=>De$1,portalSuspended:()=>Re$1,replicationStart:()=>Ee$1});u$1();var De$1={name:"parseComplete",length:5},Ie$1={name:"bindComplete",length:5},xe$2={name:"closeComplete",length:5},Me$2={name:"noData",length:5},Re$1={name:"portalSuspended",length:5},Ee$1={name:"replicationStart",length:4},Ce$2={name:"emptyQuery",length:4},Te$2={name:"copyDone",length:4},F$1=class{constructor(r){this.length=r,this.name="authenticationOk"}},G$1=class{constructor(r){this.length=r,this.name="authenticationCleartextPassword"}},Q$1=class{constructor(r,M){this.length=r,this.salt=M,this.name="authenticationMD5Password"}},_=class{constructor(e,r){this.length=e,this.mechanisms=r,this.name="authenticationSASL"}},v$1=class{constructor(r,M){this.length=r,this.data=M,this.name="authenticationSASLContinue"}},H=class{constructor(e,r){this.length=e,this.data=r,this.name="authenticationSASLFinal"}},O$2=class extends Error{constructor(r,M,fe){super(r),this.length=M,this.name=fe}},z$2=class{constructor(r,M){this.length=r,this.chunk=M,this.name="copyData"}},q$1=class{constructor(r,M,fe,$n){this.length=r,this.name=M,this.binary=fe,this.columnTypes=new Array($n)}},Y$2=class{constructor(r,M,fe,$n,qn,jn,Wn){this.name=r,this.tableID=M,this.columnID=fe,this.dataTypeID=$n,this.dataTypeSize=qn,this.dataTypeModifier=jn,this.format=Wn}},j$2=class{constructor(r,M){this.length=r,this.fieldCount=M,this.name="rowDescription",this.fields=new Array(this.fieldCount)}},W=class{constructor(e,r){this.length=e,this.parameterCount=r,this.name="parameterDescription",this.dataTypeIDs=new Array(this.parameterCount)}},K=class{constructor(e,r,M){this.length=e,this.parameterName=r,this.parameterValue=M,this.name="parameterStatus"}},J$1=class{constructor(r,M,fe){this.length=r,this.processID=M,this.secretKey=fe,this.name="backendKeyData"}},$$1=class{constructor(r,M,fe,$n){this.length=r,this.processId=M,this.channel=fe,this.payload=$n,this.name="notification"}},X=class{constructor(e,r){this.length=e,this.status=r,this.name="readyForQuery"}},Z$1=class{constructor(r,M){this.length=r,this.text=M,this.name="commandComplete"}},ee$1=class{constructor(r,M){this.length=r,this.fields=M,this.name="dataRow",this.fieldCount=M.length}},te$1=class{constructor(r,M){this.length=r,this.message=M,this.name="notice"}},zn={};F$2(zn,{Parser:()=>pe$1,messages:()=>Ne$2,serialize:()=>$e$1});u$1();u$1();u$1();var Pe$2={text:0,binary:1};u$1();var vn=new ArrayBuffer(0),x$2,w$1,ce$1,le$1,V$1,ue$1=class{constructor(r=0){R$1(this,x$2,new DataView(vn)),R$1(this,w$1),R$1(this,ce$1,"utf-8"),R$1(this,le$1,new TextDecoder(h$1(this,ce$1))),R$1(this,V$1,!1),x$3(this,w$1,r)}setBuffer(r,M){x$3(this,w$1,r),x$3(this,x$2,new DataView(M))}int16(){let r=h$1(this,x$2).getInt16(h$1(this,w$1),h$1(this,V$1));return x$3(this,w$1,h$1(this,w$1)+2),r}uint16(){let r=h$1(this,x$2).getUint16(h$1(this,w$1),h$1(this,V$1));return x$3(this,w$1,h$1(this,w$1)+2),r}byte(){let r=h$1(this,x$2).getUint8(h$1(this,w$1));return U$3(this,w$1)._++,r}int32(){let r=h$1(this,x$2).getInt32(h$1(this,w$1),h$1(this,V$1));return x$3(this,w$1,h$1(this,w$1)+4),r}string(r){return h$1(this,le$1).decode(this.bytes(r))}cstring(){let r=h$1(this,w$1),M=r;for(;h$1(this,x$2).getUint8(M++)!==0;);let fe=this.string(M-r-1);return x$3(this,w$1,M),fe}bytes(r){let M=h$1(this,x$2).buffer.slice(h$1(this,w$1),h$1(this,w$1)+r);return x$3(this,w$1,h$1(this,w$1)+r),new Uint8Array(M)}};x$2=new WeakMap,w$1=new WeakMap,ce$1=new WeakMap,le$1=new WeakMap,V$1=new WeakMap;var Ue$2=1,Hn=4,Xe$1=Ue$2+Hn,Ze$1=new ArrayBuffer(0),S$2,B$1,D$2,o$2,c$1,Le$2,et,tt$1,nt$1,rt$1,st,it$1,at$1,ke$2,ot,ut,ct,lt,pt$1,dt,ft,mt,Oe$1,pe$1=class{constructor(){R$1(this,c$1),R$1(this,S$2,new DataView(Ze$1)),R$1(this,B$1,0),R$1(this,D$2,0),R$1(this,o$2,new ue$1)}parse(r,M){T$2(this,c$1,et).call(this,ArrayBuffer.isView(r)?r.buffer.slice(r.byteOffset,r.byteOffset+r.byteLength):r);let fe=h$1(this,D$2)+h$1(this,B$1),$n=h$1(this,D$2);for(;$n+Xe$1<=fe;){let qn=h$1(this,S$2).getUint8($n),jn=h$1(this,S$2).getUint32($n+Ue$2,!1),Wn=Ue$2+jn;if(Wn+$n<=fe&&jn>0){let Yn;try{Yn=T$2(this,c$1,tt$1).call(this,$n+Xe$1,qn,jn,h$1(this,S$2).buffer)}catch(Xn){throw T$2(this,c$1,Le$2).call(this),Xn}M(Yn),$n+=Wn}else break}$n===fe?T$2(this,c$1,Le$2).call(this):(x$3(this,B$1,fe-$n),x$3(this,D$2,$n))}};S$2=new WeakMap,B$1=new WeakMap,D$2=new WeakMap,o$2=new WeakMap,c$1=new WeakSet,Le$2=function(){x$3(this,S$2,new DataView(Ze$1)),x$3(this,B$1,0),x$3(this,D$2,0)},et=function(e){if(h$1(this,B$1)>0){let r=h$1(this,B$1)+e.byteLength;if(r+h$1(this,D$2)>h$1(this,S$2).byteLength){let M;if(r<=h$1(this,S$2).byteLength&&h$1(this,D$2)>=h$1(this,B$1))M=h$1(this,S$2).buffer;else{let fe=h$1(this,S$2).byteLength*2;for(;r>=fe;)fe*=2;M=new ArrayBuffer(fe)}new Uint8Array(M).set(new Uint8Array(h$1(this,S$2).buffer,h$1(this,D$2),h$1(this,B$1))),x$3(this,S$2,new DataView(M)),x$3(this,D$2,0)}new Uint8Array(h$1(this,S$2).buffer).set(new Uint8Array(e),h$1(this,D$2)+h$1(this,B$1)),x$3(this,B$1,r)}else x$3(this,S$2,new DataView(e)),x$3(this,D$2,0),x$3(this,B$1,e.byteLength)},tt$1=function(e,r,M,fe){switch(r){case 50:return Ie$1;case 49:return De$1;case 51:return xe$2;case 110:return Me$2;case 115:return Re$1;case 99:return Te$2;case 87:return Ee$1;case 73:return Ce$2;case 68:return T$2(this,c$1,pt$1).call(this,e,M,fe);case 67:return T$2(this,c$1,rt$1).call(this,e,M,fe);case 90:return T$2(this,c$1,nt$1).call(this,e,M,fe);case 65:return T$2(this,c$1,ot).call(this,e,M,fe);case 82:return T$2(this,c$1,mt).call(this,e,M,fe);case 83:return T$2(this,c$1,dt).call(this,e,M,fe);case 75:return T$2(this,c$1,ft).call(this,e,M,fe);case 69:return T$2(this,c$1,Oe$1).call(this,e,M,fe,"error");case 78:return T$2(this,c$1,Oe$1).call(this,e,M,fe,"notice");case 84:return T$2(this,c$1,ut).call(this,e,M,fe);case 116:return T$2(this,c$1,lt).call(this,e,M,fe);case 71:return T$2(this,c$1,it$1).call(this,e,M,fe);case 72:return T$2(this,c$1,at$1).call(this,e,M,fe);case 100:return T$2(this,c$1,st).call(this,e,M,fe);default:return new O$2("received invalid response: "+r.toString(16),M,"error")}},nt$1=function(e,r,M){h$1(this,o$2).setBuffer(e,M);let fe=h$1(this,o$2).string(1);return new X(r,fe)},rt$1=function(e,r,M){h$1(this,o$2).setBuffer(e,M);let fe=h$1(this,o$2).cstring();return new Z$1(r,fe)},st=function(e,r,M){let fe=M.slice(e,e+(r-4));return new z$2(r,new Uint8Array(fe))},it$1=function(e,r,M){return T$2(this,c$1,ke$2).call(this,e,r,M,"copyInResponse")},at$1=function(e,r,M){return T$2(this,c$1,ke$2).call(this,e,r,M,"copyOutResponse")},ke$2=function(e,r,M,fe){h$1(this,o$2).setBuffer(e,M);let $n=h$1(this,o$2).byte()!==0,qn=h$1(this,o$2).int16(),jn=new q$1(r,fe,$n,qn);for(let Wn=0;Wn<qn;Wn++)jn.columnTypes[Wn]=h$1(this,o$2).int16();return jn},ot=function(e,r,M){h$1(this,o$2).setBuffer(e,M);let fe=h$1(this,o$2).int32(),$n=h$1(this,o$2).cstring(),qn=h$1(this,o$2).cstring();return new $$1(r,fe,$n,qn)},ut=function(e,r,M){h$1(this,o$2).setBuffer(e,M);let fe=h$1(this,o$2).int16(),$n=new j$2(r,fe);for(let qn=0;qn<fe;qn++)$n.fields[qn]=T$2(this,c$1,ct).call(this);return $n},ct=function(){let e=h$1(this,o$2).cstring(),r=h$1(this,o$2).int32(),M=h$1(this,o$2).int16(),fe=h$1(this,o$2).int32(),$n=h$1(this,o$2).int16(),qn=h$1(this,o$2).int32(),jn=h$1(this,o$2).int16()===0?Pe$2.text:Pe$2.binary;return new Y$2(e,r,M,fe,$n,qn,jn)},lt=function(e,r,M){h$1(this,o$2).setBuffer(e,M);let fe=h$1(this,o$2).uint16(),$n=new W(r,fe);for(let qn=0;qn<fe;qn++)$n.dataTypeIDs[qn]=h$1(this,o$2).int32();return $n},pt$1=function(e,r,M){h$1(this,o$2).setBuffer(e,M);let fe=h$1(this,o$2).int16(),$n=new Array(fe);for(let qn=0;qn<fe;qn++){let jn=h$1(this,o$2).int32();$n[qn]=jn===-1?null:h$1(this,o$2).string(jn)}return new ee$1(r,$n)},dt=function(e,r,M){h$1(this,o$2).setBuffer(e,M);let fe=h$1(this,o$2).cstring(),$n=h$1(this,o$2).cstring();return new K(r,fe,$n)},ft=function(e,r,M){h$1(this,o$2).setBuffer(e,M);let fe=h$1(this,o$2).int32(),$n=h$1(this,o$2).int32();return new J$1(r,fe,$n)},mt=function(e,r,M){h$1(this,o$2).setBuffer(e,M);let fe=h$1(this,o$2).int32();switch(fe){case 0:return new F$1(r);case 3:return new G$1(r);case 5:return new Q$1(r,h$1(this,o$2).bytes(4));case 10:{let $n=[];for(;;){let qn=h$1(this,o$2).cstring();if(qn.length===0)return new _(r,$n);$n.push(qn)}}case 11:return new v$1(r,h$1(this,o$2).string(r-8));case 12:return new H(r,h$1(this,o$2).string(r-8));default:throw new Error("Unknown authenticationOk message type "+fe)}},Oe$1=function(e,r,M,fe){h$1(this,o$2).setBuffer(e,M);let $n={},qn=h$1(this,o$2).string(1);for(;qn!=="\0";)$n[qn]=h$1(this,o$2).cstring(),qn=h$1(this,o$2).string(1);let jn=$n.M,Wn=fe==="notice"?new te$1(r,jn):new O$2(jn,r,fe);return Wn.severity=$n.S,Wn.code=$n.C,Wn.detail=$n.D,Wn.hint=$n.H,Wn.position=$n.P,Wn.internalPosition=$n.p,Wn.internalQuery=$n.q,Wn.where=$n.W,Wn.schema=$n.s,Wn.table=$n.t,Wn.column=$n.c,Wn.dataType=$n.d,Wn.constraint=$n.n,Wn.file=$n.F,Wn.line=$n.L,Wn.routine=$n.R,Wn};u$1();u$1();var o$1={part:"part",container:"container"};function s$1(e,r,...M){let fe=e.length-1,$n=M.length-1;if($n!==-1){if($n===0){e[fe]=e[fe]+M[0]+r;return}e[fe]=e[fe]+M[0],e.push(...M.slice(1,$n)),e.push(M[$n]+r)}}function y$1(e,...r){let M=[e[0]];M.raw=[e.raw[0]];let fe=[];for(let $n=0;$n<r.length;$n++){let qn=r[$n],jn=$n+1;if(qn?._templateType===o$1.part){s$1(M,e[jn],qn.str),s$1(M.raw,e.raw[jn],qn.str);continue}if(qn?._templateType===o$1.container){s$1(M,e[jn],...qn.strings),s$1(M.raw,e.raw[jn],...qn.strings.raw),fe.push(...qn.values);continue}M.push(e[jn]),M.raw.push(e.raw[jn]),fe.push(qn)}return{_templateType:"container",strings:M,values:fe}}function g$1(e,...r){let{strings:M,values:fe}=y$1(e,...r);return{query:[M[0],...fe.flatMap(($n,qn)=>[`$${qn+1}`,M[qn+1]])].join(""),params:fe}}u$1();var x$1=class extends O$2{constructor(){super("Transaction was rolled back instead of committed",0,"error"),this.severity="ERROR",this.code="25P02"}};function P(e){let r=e.e;return r.query=e.query,r.params=e.params,r.queryOptions=e.options,r}u$1();var T,p$1,t,u,R,m$1,F,D$1,z$1=class{constructor(){R$1(this,t),this.serializers={...cn},this.parsers={...un},R$1(this,T,!1),R$1(this,p$1,!1)}async _initArrayTypes({force:r=!1}={}){if(h$1(this,T)&&!r)return;x$3(this,T,!0);let M=await this.query(`
      SELECT b.oid, b.typarray
      FROM pg_catalog.pg_type a
      LEFT JOIN pg_catalog.pg_type b ON b.oid = a.typelem
      WHERE a.typcategory = 'A'
      GROUP BY b.oid, b.typarray
      ORDER BY b.oid
    `);for(let fe of M.rows)this.serializers[fe.typarray]=$n=>We$1($n,this.serializers[fe.oid],fe.typarray),this.parsers[fe.typarray]=$n=>mn($n,this.parsers[fe.oid],fe.typarray)}async refreshArrayTypes(){await this._initArrayTypes({force:!0})}async query(r,M,fe){return await this._checkReady(),await this._runExclusiveTransaction(async()=>await T$2(this,t,R).call(this,r,M,fe))}async sql(r,...M){let{query:fe,params:$n}=g$1(r,...M);return await this.query(fe,$n)}async exec(r,M){return await this._checkReady(),await this._runExclusiveTransaction(async()=>await T$2(this,t,m$1).call(this,r,M))}async describeQuery(r,M){return await this._checkReady(),await this._runExclusiveTransaction(()=>this._runExclusiveQuery(()=>T$2(this,t,F).call(this,r,M)))}async transaction(r){return await this._checkReady(),await this._runExclusiveTransaction(async()=>{await T$2(this,t,m$1).call(this,"BEGIN"),x$3(this,p$1,!0);let M=!1,fe=()=>{if(M)throw new Error("Transaction is closed")},$n={query:async(qn,jn,Wn)=>(fe(),await T$2(this,t,R).call(this,qn,jn,Wn)),sql:async(qn,...jn)=>{fe();let{query:Wn,params:Yn}=g$1(qn,...jn);return await T$2(this,t,R).call(this,Wn,Yn)},exec:async(qn,jn)=>(fe(),await T$2(this,t,m$1).call(this,qn,jn)),rollback:async()=>{fe(),await T$2(this,t,m$1).call(this,"ROLLBACK"),M=!0},listen:async(qn,jn)=>(fe(),await this.listen(qn,jn,$n)),get closed(){return M}};try{let qn=await r($n);if(!M){M=!0;let[jn]=await T$2(this,t,m$1).call(this,"COMMIT");if(jn.command==="ROLLBACK")throw P({e:new x$1,query:"COMMIT",params:void 0,options:void 0})}return x$3(this,p$1,!1),qn}catch(qn){throw M||(M=!0,await T$2(this,t,m$1).call(this,"ROLLBACK")),x$3(this,p$1,!1),qn}})}async runExclusive(r){return await this._runExclusiveQuery(r)}};T=new WeakMap,p$1=new WeakMap,t=new WeakSet,u=async function(e,r={}){return await this.execProtocolStream(e,{...r,syncToFs:!1})},R=async function(e,r=[],M){return await this._runExclusiveQuery(async()=>{T$2(this,t,D$1).call(this,"runQuery",e,r,M),await this._handleBlob(M?.blob);let fe=[];try{let qn=await T$2(this,t,u).call(this,$e$1.parse({text:e,types:M?.paramTypes}),M),jn=bn(await T$2(this,t,u).call(this,$e$1.describe({type:"S"}),M)),Wn=r.map((Yn,Xn)=>{let Kn=jn[Xn];if(Yn==null)return null;let er=M?.serializers?.[Kn]??this.serializers[Kn];return er?er(Yn):Yn.toString()});fe=[...qn,...await T$2(this,t,u).call(this,$e$1.bind({values:Wn}),M),...await T$2(this,t,u).call(this,$e$1.describe({type:"P"}),M),...await T$2(this,t,u).call(this,$e$1.execute({}),M)]}catch(qn){throw qn instanceof O$2?P({e:qn,options:M,params:r,query:e}):qn}finally{fe.push(...await T$2(this,t,u).call(this,$e$1.sync(),M))}await this._cleanupBlob(),h$1(this,p$1)||await this.syncToFs();let $n=await this._getWrittenBlob();return hn(fe,this.parsers,M,$n)[0]})},m$1=async function(e,r){return await this._runExclusiveQuery(async()=>{T$2(this,t,D$1).call(this,"runExec",e,r),await this._handleBlob(r?.blob);let M=[];try{M=await T$2(this,t,u).call(this,$e$1.query(e),r)}catch($n){throw $n instanceof O$2?P({e:$n,options:r,params:void 0,query:e}):$n}finally{M.push(...await T$2(this,t,u).call(this,$e$1.sync(),r))}this._cleanupBlob(),h$1(this,p$1)||await this.syncToFs();let fe=await this._getWrittenBlob();return hn(M,this.parsers,r,fe)})},F=async function(e,r){let M=[];try{await T$2(this,t,u).call(this,$e$1.parse({text:e,types:r?.paramTypes}),r),M=await T$2(this,t,u).call(this,$e$1.describe({type:"S"}),r)}catch(Wn){throw Wn instanceof O$2?P({e:Wn,options:r,params:void 0,query:e}):Wn}finally{M.push(...await T$2(this,t,u).call(this,$e$1.sync(),r))}let fe=M.find(Wn=>Wn.name==="parameterDescription"),$n=M.find(Wn=>Wn.name==="rowDescription"),qn=fe?.dataTypeIDs.map(Wn=>({dataTypeID:Wn,serializer:this.serializers[Wn]}))??[],jn=$n?.fields.map(Wn=>({name:Wn.name,dataTypeID:Wn.dataTypeID,parser:this.parsers[Wn.dataTypeID]}))??[];return{queryParams:qn,resultFields:jn}},D$1=function(...e){this.debug>0&&console.log(...e)};u$1();var f=Object.defineProperty,d=(e,r)=>{for(var M in r)f(e,M,{get:r[M],enumerable:!0})},p={};d(p,{IN_NODE:()=>s,WASM_PREFIX:()=>y,getFsBundle:()=>w,instantiateWasm:()=>b,pgliteProc:()=>h,rmdirRecursive:()=>g,startArtifactDownload:()=>c,toPostgresName:()=>v,uuid:()=>S$1});function m(){let e=process.type;return e==="renderer"||e==="worker"||e==="service-worker"}var s=typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string"&&!m(),y="/pglite",h=globalThis&&typeof globalThis.process<"u"?globalThis.process:{exitCode:void 0},a=new Map;async function c(e){s||a.has(e.toString())||a.set(e.toString(),fetch(e))}var o=new Map;async function b(e,r){if(typeof r!="function")return{instance:await WebAssembly.instantiate(r,e),module:r};let M=r();if(o.has(M.toString())){let fe=o.get(M.toString());return{instance:await WebAssembly.instantiate(fe,e),module:fe}}if(s){let fe=await(await __vitePreload(async()=>{const{readFile:jn}=await import("./__vite-browser-external-BIHI7g3E.js");return{readFile:jn}},[])).readFile(M),{module:$n,instance:qn}=await WebAssembly.instantiate(fe,e);return o.set(M.toString(),$n),{instance:qn,module:$n}}else{a.has(M.toString())||c(M);let fe=await a.get(M.toString()),{module:$n,instance:qn}=await WebAssembly.instantiateStreaming(fe.clone(),e);return o.set(M.toString(),$n),{instance:qn,module:$n}}}async function w(e){return s?(await(await __vitePreload(async()=>{const{readFile:r}=await import("./__vite-browser-external-BIHI7g3E.js");return{readFile:r}},[])).readFile(e)).buffer:(c(e),(await a.get(e.toString())).clone().arrayBuffer())}var S$1=()=>{if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();let e=new Uint8Array(16);if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(e);else for(let M=0;M<e.length;M++)e[M]=Math.floor(Math.random()*256);e[6]=e[6]&15|64,e[8]=e[8]&63|128;let r=[];return e.forEach(M=>{r.push(M.toString(16).padStart(2,"0"))}),r.slice(0,4).join("")+"-"+r.slice(4,6).join("")+"-"+r.slice(6,8).join("")+"-"+r.slice(8,10).join("")+"-"+r.slice(10).join("")};function v(e){let r;return e.startsWith('"')&&e.endsWith('"')?r=e.substring(1,e.length-1):r=e.toLowerCase(),r}function g(e,r){try{let M=e.readdir(r).filter(fe=>fe!=="."&&fe!=="..");for(let fe of M){let $n=r+"/"+fe;try{e.readdir($n),g(e,$n)}catch{e.unlink($n)}}e.rmdir(r)}catch{try{e.unlink(r)}catch{}}}var j$1=D$3((e,r)=>{u$1();var M=9007199254740991,fe=(function(ir){return ir})();function $n(ir){return ir===fe}function qn(ir){return typeof ir=="string"||Object.prototype.toString.call(ir)=="[object String]"}function jn(ir){return Object.prototype.toString.call(ir)=="[object Date]"}function Wn(ir){return ir!==null&&typeof ir=="object"}function Yn(ir){return typeof ir=="function"}function Xn(ir){return typeof ir=="number"&&ir>-1&&ir%1==0&&ir<=M}function Kn(ir){return Object.prototype.toString.call(ir)=="[object Array]"}function er(ir){return Wn(ir)&&!Yn(ir)&&Xn(ir.length)}function nr(ir){return Object.prototype.toString.call(ir)=="[object ArrayBuffer]"}function Zn(ir,Jn){return Array.prototype.map.call(ir,Jn)}function rr(ir,Jn){var tr=fe;return Yn(Jn)&&Array.prototype.every.call(ir,function(ar,dr,lr){var _r=Jn(ar,dr,lr);return _r&&(tr=ar),!_r}),tr}function sr(ir){return Object.assign.apply(null,arguments)}function or(ir){var Jn,tr,ar;if(qn(ir)){for(tr=ir.length,ar=new Uint8Array(tr),Jn=0;Jn<tr;Jn++)ar[Jn]=ir.charCodeAt(Jn)&255;return ar}return nr(ir)?new Uint8Array(ir):Wn(ir)&&nr(ir.buffer)?new Uint8Array(ir.buffer):er(ir)?new Uint8Array(ir):Wn(ir)&&Yn(ir.toString)?or(ir.toString()):new Uint8Array}r.exports.MAX_SAFE_INTEGER=M,r.exports.isUndefined=$n,r.exports.isString=qn,r.exports.isObject=Wn,r.exports.isDateTime=jn,r.exports.isFunction=Yn,r.exports.isArray=Kn,r.exports.isArrayLike=er,r.exports.isArrayBuffer=nr,r.exports.map=Zn,r.exports.find=rr,r.exports.extend=sr,r.exports.toUint8Array=or}),Y$1=D$3((e,r)=>{u$1();var M="\0";r.exports={NULL_CHAR:M,TMAGIC:"ustar"+M+"00",OLDGNU_MAGIC:"ustar  "+M,REGTYPE:0,LNKTYPE:1,SYMTYPE:2,CHRTYPE:3,BLKTYPE:4,DIRTYPE:5,FIFOTYPE:6,CONTTYPE:7,TSUID:parseInt("4000",8),TSGID:parseInt("2000",8),TSVTX:parseInt("1000",8),TUREAD:parseInt("0400",8),TUWRITE:parseInt("0200",8),TUEXEC:parseInt("0100",8),TGREAD:parseInt("0040",8),TGWRITE:parseInt("0020",8),TGEXEC:parseInt("0010",8),TOREAD:parseInt("0004",8),TOWRITE:parseInt("0002",8),TOEXEC:parseInt("0001",8),TPERMALL:parseInt("0777",8),TPERMMASK:parseInt("0777",8)}}),re$1=D$3((e,r)=>{u$1();var M=j$1(),fe=Y$1(),$n=512,qn=fe.TPERMALL,jn=0,Wn=0,Yn=[["name",100,0,function(Jn,tr){return er(Jn[tr[0]],tr[1])},function(Jn,tr,ar){return rr(Jn.slice(tr,tr+ar[1]))}],["mode",8,100,function(Jn,tr){var ar=Jn[tr[0]]||qn;return ar=ar&fe.TPERMMASK,nr(ar,tr[1],qn)},function(Jn,tr,ar){var dr=sr(Jn.slice(tr,tr+ar[1]));return dr&=fe.TPERMMASK,dr}],["uid",8,108,function(Jn,tr){return nr(Jn[tr[0]],tr[1],jn)},function(Jn,tr,ar){return sr(Jn.slice(tr,tr+ar[1]))}],["gid",8,116,function(Jn,tr){return nr(Jn[tr[0]],tr[1],Wn)},function(Jn,tr,ar){return sr(Jn.slice(tr,tr+ar[1]))}],["size",12,124,function(Jn,tr){return nr(Jn.data.length,tr[1])},function(Jn,tr,ar){return sr(Jn.slice(tr,tr+ar[1]))}],["modifyTime",12,136,function(Jn,tr){return Zn(Jn[tr[0]],tr[1])},function(Jn,tr,ar){return or(Jn.slice(tr,tr+ar[1]))}],["checksum",8,148,function(Jn,tr){return"        "},function(Jn,tr,ar){return sr(Jn.slice(tr,tr+ar[1]))}],["type",1,156,function(Jn,tr){return""+(parseInt(Jn[tr[0]],10)||0)%8},function(Jn,tr,ar){return(parseInt(String.fromCharCode(Jn[tr]),10)||0)%8}],["linkName",100,157,function(Jn,tr){return""},function(Jn,tr,ar){return rr(Jn.slice(tr,tr+ar[1]))}],["ustar",8,257,function(Jn,tr){return fe.TMAGIC},function(Jn,tr,ar){return Kn(rr(Jn.slice(tr,tr+ar[1]),!0))},function(Jn,tr){return Jn[tr[0]]==fe.TMAGIC||Jn[tr[0]]==fe.OLDGNU_MAGIC}],["owner",32,265,function(Jn,tr){return er(Jn[tr[0]],tr[1])},function(Jn,tr,ar){return rr(Jn.slice(tr,tr+ar[1]))}],["group",32,297,function(Jn,tr){return er(Jn[tr[0]],tr[1])},function(Jn,tr,ar){return rr(Jn.slice(tr,tr+ar[1]))}],["majorNumber",8,329,function(Jn,tr){return""},function(Jn,tr,ar){return sr(Jn.slice(tr,tr+ar[1]))}],["minorNumber",8,337,function(Jn,tr){return""},function(Jn,tr,ar){return sr(Jn.slice(tr,tr+ar[1]))}],["prefix",131,345,function(Jn,tr){return er(Jn[tr[0]],tr[1])},function(Jn,tr,ar){return rr(Jn.slice(tr,tr+ar[1]))}],["accessTime",12,476,function(Jn,tr){return Zn(Jn[tr[0]],tr[1])},function(Jn,tr,ar){return or(Jn.slice(tr,tr+ar[1]))}],["createTime",12,488,function(Jn,tr){return Zn(Jn[tr[0]],tr[1])},function(Jn,tr,ar){return or(Jn.slice(tr,tr+ar[1]))}]],Xn=(function(Jn){var tr=Jn[Jn.length-1];return tr[2]+tr[1]})(Yn);function Kn(Jn){if(Jn.length==8){var tr=Jn.split("");if(tr[5]==fe.NULL_CHAR)return(tr[6]==" "||tr[6]==fe.NULL_CHAR)&&(tr[6]="0"),(tr[7]==" "||tr[7]==fe.NULL_CHAR)&&(tr[7]="0"),tr=tr.join(""),tr==fe.TMAGIC?tr:Jn;if(tr[7]==fe.NULL_CHAR)return tr[5]==fe.NULL_CHAR&&(tr[5]=" "),tr[6]==fe.NULL_CHAR&&(tr[6]=" "),tr==fe.OLDGNU_MAGIC?tr:Jn}return Jn}function er(Jn,tr){return tr-=1,M.isUndefined(Jn)&&(Jn=""),Jn=(""+Jn).substr(0,tr),Jn+fe.NULL_CHAR}function nr(Jn,tr,ar){for(ar=parseInt(ar)||0,tr-=1,Jn=(parseInt(Jn)||ar).toString(8).substr(-tr,tr);Jn.length<tr;)Jn="0"+Jn;return Jn+fe.NULL_CHAR}function Zn(Jn,tr){if(M.isDateTime(Jn))Jn=Math.floor(1*Jn/1e3);else if(Jn=parseInt(Jn,10),isFinite(Jn)){if(Jn<=0)return""}else Jn=Math.floor(1*new Date/1e3);return nr(Jn,tr,0)}function rr(Jn,tr){var ar=String.fromCharCode.apply(null,Jn);if(tr)return ar;var dr=ar.indexOf(fe.NULL_CHAR);return dr>=0?ar.substr(0,dr):ar}function sr(Jn){var tr=String.fromCharCode.apply(null,Jn);return parseInt(tr.replace(/^0+$/g,""),8)||0}function or(Jn){return Jn.length==0||Jn[0]==0?null:new Date(1e3*sr(Jn))}function ir(Jn,tr,ar){var dr=parseInt(tr,10)||0,lr=Math.min(dr+Xn,Jn.length),_r=0,ur=0,fr=0;ar&&Yn.every(function(mr){return mr[0]=="checksum"?(ur=dr+mr[2],fr=ur+mr[1],!1):!0});for(var xr=32,cr=dr;cr<lr;cr++){var $r=cr>=ur&&cr<fr?xr:Jn[cr];_r=(_r+$r)%262144}return _r}r.exports.recordSize=$n,r.exports.defaultFileMode=qn,r.exports.defaultUid=jn,r.exports.defaultGid=Wn,r.exports.posixHeader=Yn,r.exports.effectiveHeaderSize=Xn,r.exports.calculateChecksum=ir,r.exports.formatTarString=er,r.exports.formatTarNumber=nr,r.exports.formatTarDateTime=Zn,r.exports.parseTarString=rr,r.exports.parseTarNumber=sr,r.exports.parseTarDateTime=or}),ye$1=D$3((e,r)=>{u$1();var M=Y$1(),fe=j$1(),$n=re$1();function qn(er){return $n.recordSize}function jn(er){return Math.ceil(er.data.length/$n.recordSize)*$n.recordSize}function Wn(er){var nr=0;return er.forEach(function(Zn){nr+=qn()+jn(Zn)}),nr+=$n.recordSize*2,new Uint8Array(nr)}function Yn(er,nr,Zn){Zn=parseInt(Zn)||0;var rr=Zn;$n.posixHeader.forEach(function(tr){for(var ar=tr[3](nr,tr),dr=ar.length,lr=0;lr<dr;lr+=1)er[rr+lr]=ar.charCodeAt(lr)&255;rr+=tr[1]});var sr=fe.find($n.posixHeader,function(tr){return tr[0]=="checksum"});if(sr){var or=$n.calculateChecksum(er,Zn,!0),ir=$n.formatTarNumber(or,sr[1]-2)+M.NULL_CHAR+" ";rr=Zn+sr[2];for(var Jn=0;Jn<ir.length;Jn+=1)er[rr]=ir.charCodeAt(Jn)&255,rr++}return Zn+qn()}function Xn(er,nr,Zn){return Zn=parseInt(Zn,10)||0,er.set(nr.data,Zn),Zn+jn(nr)}function Kn(er){er=fe.map(er,function(rr){return fe.extend({},rr,{data:fe.toUint8Array(rr.data)})});var nr=Wn(er),Zn=0;return er.forEach(function(rr){Zn=Yn(nr,rr,Zn),Zn=Xn(nr,rr,Zn)}),nr}r.exports.tar=Kn}),we=D$3((e,r)=>{u$1();var M=Y$1(),fe=j$1(),$n=re$1(),qn={extractData:!0,checkHeader:!0,checkChecksum:!0,checkFileSize:!0},jn={size:!0,checksum:!0,ustar:!0},Wn={unexpectedEndOfFile:"Unexpected end of file.",fileCorrupted:"File is corrupted.",checksumCheckFailed:"Checksum check failed."};function Yn(sr){return $n.recordSize}function Xn(sr){return Math.ceil(sr/$n.recordSize)*$n.recordSize}function Kn(sr,or){for(var ir=or,Jn=Math.min(sr.length,or+$n.recordSize*2),tr=ir;tr<Jn;tr++)if(sr[tr]!=0)return!1;return!0}function er(sr,or,ir){if(sr.length-or<$n.recordSize){if(ir.checkFileSize)throw new Error(Wn.unexpectedEndOfFile);return null}or=parseInt(or)||0;var Jn={},tr=or;if($n.posixHeader.forEach(function(lr){Jn[lr[0]]=lr[4](sr,tr,lr),tr+=lr[1]}),Jn.type!=0&&(Jn.size=0),ir.checkHeader&&$n.posixHeader.forEach(function(lr){if(fe.isFunction(lr[5])&&!lr[5](Jn,lr)){var _r=new Error(Wn.fileCorrupted);throw _r.data={offset:or+lr[2],field:lr[0]},_r}}),ir.checkChecksum){var ar=$n.calculateChecksum(sr,or,!0);if(ar!=Jn.checksum){var dr=new Error(Wn.checksumCheckFailed);throw dr.data={offset:or,header:Jn,checksum:ar},dr}}return Jn}function nr(sr,or,ir,Jn){return Jn.extractData?ir.size<=0?new Uint8Array:sr.slice(or,or+ir.size):null}function Zn(sr,or){var ir={};return $n.posixHeader.forEach(function(Jn){var tr=Jn[0];jn[tr]||(ir[tr]=sr[tr])}),ir.isOldGNUFormat=sr.ustar==M.OLDGNU_MAGIC,or&&(ir.data=or),ir}function rr(sr,or){or=fe.extend({},qn,or);for(var ir=[],Jn=0,tr=sr.length;tr-Jn>=$n.recordSize;){sr=fe.toUint8Array(sr);var ar=er(sr,Jn,or);if(!ar)break;Jn+=Yn();var dr=nr(sr,Jn,ar,or);if(ir.push(Zn(ar,dr)),Jn+=Xn(ar.size),Kn(sr,Jn))break}return ir}r.exports.untar=rr}),be$1=D$3((e,r)=>{u$1();var M=j$1(),fe=Y$1(),$n=ye$1(),qn=we();M.extend(r.exports,$n,qn,fe)});u$1();u$1();var O$1=L$1(be$1());async function ie$1(e,r,M="pgdata",fe="auto"){let $n=vr(e,r),[qn,jn]=await Er($n,fe),Wn=M+(jn?".tar.gz":".tar"),Yn=jn?"application/x-gzip":"application/x-tar";return typeof File<"u"?new File([qn],Wn,{type:Yn}):new Blob([qn],{type:Yn})}var Sr=["application/x-gtar","application/x-tar+gzip","application/x-gzip","application/gzip"];async function Jr(e,r,M){let fe=new Uint8Array(await r.arrayBuffer()),$n=typeof File<"u"&&r instanceof File?r.name:void 0;(Sr.includes(r.type)||$n?.endsWith(".tgz")||$n?.endsWith(".tar.gz"))&&(fe=await Te$1(fe));let qn;try{qn=(0,O$1.untar)(fe)}catch(jn){if(jn instanceof Error&&jn.message.includes("File is corrupted"))fe=await Te$1(fe),qn=(0,O$1.untar)(fe);else throw jn}for(let jn of qn){let Wn=`${M}/${jn.name}`,Yn=Wn.split("/").slice(0,-1);for(let Xn=1;Xn<=Yn.length;Xn++){let Kn=Yn.slice(0,Xn).join("/");Kn.length&&!e.analyzePath(Kn).exists&&e.mkdirTree(Kn)}if(jn.type===O$1.REGTYPE){e.writeFile(Wn,jn.data);let Xn=Ar(jn.modifyTime);e.utime(Wn,Xn,Xn)}else jn.type===O$1.DIRTYPE&&(e.analyzePath(Wn).exists||e.mkdir(Wn))}}function gr(e,r){let M=[],fe=$n=>{e.readdir($n).forEach(qn=>{if(qn==="."||qn==="..")return;let jn=$n+"/"+qn,Wn=e.stat(jn),Yn=e.isFile(Wn.mode)?e.readFile(jn,{encoding:"binary"}):new Uint8Array(0);M.push({name:jn.substring(r.length),mode:Wn.mode,size:Wn.size,type:e.isFile(Wn.mode)?O$1.REGTYPE:O$1.DIRTYPE,modifyTime:Wn.mtime,data:Yn}),e.isDir(Wn.mode)&&fe(jn)})};return fe(r),M}function vr(e,r){let M=gr(e,r);return(0,O$1.tar)(M)}async function Er(e,r="auto"){if(r==="none")return[e,!1];if(typeof CompressionStream<"u")return[await Fr(e),!0];if(typeof process<"u"&&process.versions&&process.versions.node)return[await yr(e),!0];if(r==="auto")return[e,!1];throw new Error("Compression not supported in this environment")}async function Fr(e){let r=new CompressionStream("gzip"),M=r.writable.getWriter(),fe=r.readable.getReader();M.write(e),M.close();let $n=[];for(;;){let{value:Wn,done:Yn}=await fe.read();if(Yn)break;Wn&&$n.push(Wn)}let qn=new Uint8Array($n.reduce((Wn,Yn)=>Wn+Yn.length,0)),jn=0;return $n.forEach(Wn=>{qn.set(Wn,jn),jn+=Wn.length}),qn}async function yr(e){let{promisify:r}=await __vitePreload(()=>import("./__vite-browser-external-BIHI7g3E.js"),[]),{gzip:M}=await __vitePreload(async()=>{const{gzip:fe}=await import("./__vite-browser-external-BIHI7g3E.js");return{gzip:fe}},[]);return await r(M)(e)}async function Te$1(e){if(typeof CompressionStream<"u")return await hr(e);if(typeof process<"u"&&process.versions&&process.versions.node)return await wr(e);throw new Error("Unsupported environment for decompression")}async function hr(e){let r=new DecompressionStream("gzip"),M=r.writable.getWriter(),fe=r.readable.getReader();M.write(e),M.close();let $n=[];for(;;){let{value:Wn,done:Yn}=await fe.read();if(Yn)break;Wn&&$n.push(Wn)}let qn=new Uint8Array($n.reduce((Wn,Yn)=>Wn+Yn.length,0)),jn=0;return $n.forEach(Wn=>{qn.set(Wn,jn),jn+=Wn.length}),qn}async function wr(e){let{promisify:r}=await __vitePreload(()=>import("./__vite-browser-external-BIHI7g3E.js"),[]),{gunzip:M}=await __vitePreload(async()=>{const{gunzip:fe}=await import("./__vite-browser-external-BIHI7g3E.js");return{gunzip:fe}},[]);return await r(M)(e)}function Ar(e){return e?typeof e=="number"?e*1e3:e.getTime():Date.now()}u$1();u$1();u$1();async function br(moduleArg={}){var Module=moduleArg,ENVIRONMENT_IS_WEB=!!globalThis.window,ENVIRONMENT_IS_WORKER=!!globalThis.WorkerGlobalScope,ENVIRONMENT_IS_NODE=globalThis.process?.versions?.node&&globalThis.process?.type!="renderer";if(ENVIRONMENT_IS_NODE){let{createRequire:e}=await __vitePreload(()=>import("./__vite-browser-external-BIHI7g3E.js"),[]);var require=e(import.meta.url)}var programArgs=[],thisProgram="./this.program",quit_=(e,r)=>{throw r},_scriptName=import.meta.url,scriptDirectory="";function locateFile(e){return Module.locateFile?Module.locateFile(e,scriptDirectory):scriptDirectory+e}var readAsync,readBinary;if(ENVIRONMENT_IS_NODE){var fs=require("node:fs");_scriptName.startsWith("file:")&&(scriptDirectory=require("node:path").dirname(require("node:url").fileURLToPath(_scriptName))+"/"),readBinary=e=>{e=isFileURI(e)?new URL(e):e;var r=fs.readFileSync(e);return r},readAsync=async(e,r=!0)=>{e=isFileURI(e)?new URL(e):e;var M=fs.readFileSync(e,r?void 0:"utf8");return M},process.argv.length>1&&(thisProgram=process.argv[1].replace(/\\/g,"/")),programArgs=process.argv.slice(2),quit_=(e,r)=>{throw process.exitCode=e,r}}else if(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER){try{scriptDirectory=new URL(".",_scriptName).href}catch{}ENVIRONMENT_IS_WORKER&&(readBinary=e=>{var r=new XMLHttpRequest;return r.open("GET",e,!1),r.responseType="arraybuffer",r.send(null),new Uint8Array(r.response)}),readAsync=async e=>{var r=await fetch(e,{credentials:"same-origin"});if(r.ok)return r.arrayBuffer();throw new Error(r.status+" : "+r.url)}}var out=console.log.bind(console),err=console.error.bind(console),dynamicLibraries=[],wasmBinary,ABORT=!1,EXITSTATUS,isFileURI=e=>e.startsWith("file://");class EmscriptenEH{}class EmscriptenSjLj extends EmscriptenEH{}var runtimeInitialized=!1,runtimeExited=!1;function getMemoryBuffer(){return wasmMemory.buffer}function updateMemoryViews(){if(!HEAP8?.buffer?.resizable){var e=getMemoryBuffer();HEAP8=new Int8Array(e),HEAP16=new Int16Array(e),Module.HEAPU8=HEAPU8=new Uint8Array(e),new Uint16Array(e),HEAP32=new Int32Array(e),HEAPU32=new Uint32Array(e),new Float32Array(e),new Float64Array(e),HEAP64=new BigInt64Array(e),new BigUint64Array(e)}}var __RELOC_FUNCS__=[];function preRun(){var e=Module.preRun;e&&(typeof e=="function"&&(e=[e]),onPreRuns.push(...e)),callRuntimeCallbacks(onPreRuns)}function initRuntime(){runtimeInitialized=!0,callRuntimeCallbacks(__RELOC_FUNCS__),!Module.noFSInit&&!FS.initialized&&FS.init(),wasmExports.__wasm_call_ctors(),callRuntimeCallbacks(onPostCtors),FS.ignorePermissions=!1}function exitRuntime(){___funcs_on_exit(),FS.quit(),clearTimers(),runtimeExited=!0}function postRun(){var e=Module.postRun;e&&(typeof e=="function"&&(e=[e]),onPostRuns.push(...e)),callRuntimeCallbacks(onPostRuns)}function abort(e){throw Module.onAbort?.(e),e=`Aborted(${e})`,err(e),ABORT=!0,e+=". Build with -sASSERTIONS for more info.",new WebAssembly.RuntimeError(e)}var wasmBinaryFile;function findWasmBinary(){return Module.locateFile?locateFile("initdb.wasm"):new URL("/ritestand-induction-preview/assets/initdb-BJaOLL_I.wasm",import.meta.url).href}function getBinarySync(e){if(readBinary)return readBinary(e);throw"both async and sync fetching of the wasm failed"}async function getWasmBinary(e){try{var r=await readAsync(e);return new Uint8Array(r)}catch{}return getBinarySync(e)}async function instantiateArrayBuffer(e,r){try{var M=await getWasmBinary(e),fe=await WebAssembly.instantiate(M,r);return fe}catch($n){err(`failed to asynchronously prepare wasm: ${$n}`),abort($n)}}async function instantiateAsync(e,r,M){if(!ENVIRONMENT_IS_NODE)try{var fe=fetch(r,{credentials:"same-origin"}),$n=await WebAssembly.instantiateStreaming(fe,M);return $n}catch(qn){err(`wasm streaming compile failed: ${qn}`),err("falling back to ArrayBuffer instantiation")}return instantiateArrayBuffer(r,M)}function getWasmImports(){var e=new Proxy(new Set([]),GOTHandler),r={env:wasmImports,wasi_snapshot_preview1:wasmImports,"GOT.mem":e,"GOT.func":e};return r}async function createWasm(){async function e(qn,jn){wasmExports=qn.exports;var Wn=wasmExports;mergeLibSymbols(wasmExports);var Yn=getDylinkMetadata(jn);return Yn.neededDynlibs&&(dynamicLibraries=Yn.neededDynlibs.concat(dynamicLibraries)),assignWasmExports(wasmExports),updateGOT(Wn),updateMemoryViews(),LDSO.init(),await loadDylibs(),wasmExports}var r=getWasmImports(),M=Module.instantiateWasm;if(M)return new Promise(qn=>{M(r,(jn,Wn)=>qn(e(jn,Wn)))});wasmBinaryFile??(wasmBinaryFile=findWasmBinary());var fe=await instantiateAsync(wasmBinary,wasmBinaryFile,r),$n=await(function(qn){return e(qn.instance,qn.module)})(fe);return $n}class ExitStatus{constructor(r){P$2(this,"name","ExitStatus"),this.message=`Program terminated with exit(${r})`,this.status=r}}var GOT={},GOTHandler={get(e,r){var M=GOT[r];return M||(M=GOT[r]=new WebAssembly.Global({value:"i32",mutable:!0},-1)),e.has(r)||(M.required=!0),M}},HEAP16,HEAP32,HEAP64,HEAP8,HEAPU32,HEAPU8,callRuntimeCallbacks=e=>{for(;e.length>0;)e.shift()(Module)},onPostRuns=[],onPreRuns=[],UTF8Decoder=globalThis.TextDecoder&&new TextDecoder,findStringEnd=(e,r,M,fe)=>{var $n=r+M;if(fe)return $n;for(;e[r]&&!(r>=$n);)++r;return r},UTF8ArrayToString=(e,r=0,M,fe)=>{var $n=findStringEnd(e,r,M,fe);if($n-r>16&&e.buffer&&UTF8Decoder)return UTF8Decoder.decode(e.subarray(r,$n));for(var qn="";r<$n;){var jn=e[r++];if(!(jn&128)){qn+=String.fromCharCode(jn);continue}var Wn=e[r++]&63;if((jn&224)==192){qn+=String.fromCharCode((jn&31)<<6|Wn);continue}var Yn=e[r++]&63;if((jn&240)==224?jn=(jn&15)<<12|Wn<<6|Yn:jn=(jn&7)<<18|Wn<<12|Yn<<6|e[r++]&63,jn<65536)qn+=String.fromCharCode(jn);else{var Xn=jn-65536;qn+=String.fromCharCode(55296|Xn>>10,56320|Xn&1023)}}return qn},getDylinkMetadata=e=>{var r=0,M=0;function fe(){return e[r++]}function $n(){for(var ar=0,dr=1;;){var lr=e[r++];if(ar+=(lr&127)*dr,dr*=128,!(lr&128))break}return ar}function qn(){var ar=$n();return r+=ar,UTF8ArrayToString(e,r-ar,ar)}function jn(){for(var ar=$n(),dr=[];ar--;)dr.push(qn());return dr}function Wn(ar,dr){if(ar)throw new Error(dr)}if(e instanceof WebAssembly.Module){var Yn=WebAssembly.Module.customSections(e,"dylink.0");Wn(!Yn.length,"need dylink section"),e=new Uint8Array(Yn[0]),M=e.length}else{var Xn=new Uint32Array(new Uint8Array(e.subarray(0,24)).buffer),Kn=Xn[0]==1836278016;Wn(!Kn,"need to see wasm magic number"),Wn(e[8],"need the dylink section to be first"),r=9;var er=$n();M=r+er;var nr=qn();Wn(nr!=="dylink.0")}for(var Zn={neededDynlibs:[],tlsExports:new Set,weakImports:new Set,runtimePaths:[]};r<M;){var rr=fe(),sr=$n();if(rr===1)Zn.memorySize=$n(),Zn.memoryAlign=$n(),Zn.tableSize=$n(),Zn.tableAlign=$n();else if(rr===2)Zn.neededDynlibs=jn();else if(rr===3)for(var or=$n();or--;){var ir=qn(),Jn=$n();Jn&256&&Zn.tlsExports.add(ir)}else if(rr===4)for(or=$n();or--;)qn(),ir=qn(),Jn=$n(),(Jn&3)==1&&Zn.weakImports.add(ir);else if(rr===5)Zn.runtimePaths=jn();else if(rr===6){var tr=qn();Wn(tr!=="wasm32",`incorrect architecture (${tr} vs wasm32)`)}else r+=sr}return Zn},newDSO=(e,r,M)=>{var fe={refcount:1/0,name:e,exports:M,global:!0};return LDSO.loadedLibsByName[e]=fe,r!=null&&(LDSO.loadedLibsByHandle[r]=fe),fe},LDSO={loadedLibsByName:{},loadedLibsByHandle:{},init(){newDSO("__main__",0,wasmImports)}},alignMemory=(e,r)=>Math.ceil(e/r)*r,getMemory=e=>{if(runtimeInitialized)return _calloc(e,1);var r=___heap_base,M=r+alignMemory(e,16);___heap_base=M;var fe=_emscripten_get_sbrk_ptr();return HEAPU32[fe>>2]=M,r},isInternalSym=e=>["memory","__memory_base","__table_base","__stack_pointer","__indirect_function_table","__cpp_exception","__c_longjmp","__wasm_apply_data_relocs","__dso_handle","__tls_size","__tls_align","__set_stack_limits","_emscripten_tls_init","__wasm_init_tls","__wasm_call_ctors","__start_em_asm","__stop_em_asm","__start_em_js","__stop_em_js"].includes(e)||e.startsWith("__em_js__"),wasmTableMirror=[],getWasmTableEntry=e=>{var r=wasmTableMirror[e];return r||(wasmTableMirror[e]=r=wasmTable.get(e)),r},updateTableMap=(e,r)=>{if(functionsInTableMap)for(var M=e;M<e+r;M++){var fe=getWasmTableEntry(M);fe&&functionsInTableMap.set(fe,M)}},functionsInTableMap,getFunctionAddress=e=>(functionsInTableMap||(functionsInTableMap=new WeakMap,updateTableMap(0,wasmTable.length)),functionsInTableMap.get(e)||0),freeTableIndexes=[],getEmptyTableSlot=()=>freeTableIndexes.length?freeTableIndexes.pop():wasmTable.grow(1),setWasmTableEntry=(e,r)=>{wasmTable.set(e,r),wasmTableMirror[e]=wasmTable.get(e)},uleb128EncodeWithLen=e=>{let r=e.length;return[r%128|128,r>>7,...e]},wasmTypeCodes={i:127,p:127,j:126,f:125,d:124,e:111},generateTypePack=e=>uleb128EncodeWithLen(Array.from(e,r=>{var M=wasmTypeCodes[r];return M})),convertJsFunctionToWasm=(e,r)=>{var M=Uint8Array.of(0,97,115,109,1,0,0,0,1,...uleb128EncodeWithLen([1,96,...generateTypePack(r.slice(1)),...generateTypePack(r[0]==="v"?"":r[0])]),2,7,1,1,101,1,102,0,0,7,5,1,1,102,0,0),fe=new WebAssembly.Module(M),$n=new WebAssembly.Instance(fe,{e:{f:e}}),qn=$n.exports.f;return qn},addFunction=(e,r)=>{var M=getFunctionAddress(e);if(M)return M;var fe=getEmptyTableSlot();try{setWasmTableEntry(fe,e)}catch(qn){if(!(qn instanceof TypeError))throw qn;var $n=convertJsFunctionToWasm(e,r);setWasmTableEntry(fe,$n)}return functionsInTableMap.set(e,fe),fe},updateGOT=(e,r)=>{for(var M in e)if(!isInternalSym(M)){var fe=e[M],$n=GOT[M]&&GOT[M].value!=-1;if(!$n){var qn;if(typeof fe=="function")qn=addFunction(fe);else if(typeof fe.value=="number")qn=fe;else continue;GOT[M]??(GOT[M]=new WebAssembly.Global({value:"i32",mutable:!0})),GOT[M].value=qn}}},isImmutableGlobal=e=>{if(e instanceof WebAssembly.Global)try{e.value=e.value}catch{return!0}return!1},relocateExports=(e,r=0)=>{function M(qn,jn){return isImmutableGlobal(jn)?new WebAssembly.Global({value:"i32"},jn.value+r):jn}var fe={};for(var $n in e)fe[$n]=M(0,e[$n]);return fe},isSymbolDefined=e=>{var r=wasmImports[e];return!(!r||r.stub)},createNamedFunction=(e,r)=>Object.defineProperty(r,"name",{value:e}),dynCall=(e,r,M=[])=>{var fe=getWasmTableEntry(r),$n=fe(...M);return(function(qn){return qn})($n)},stackSave=()=>_emscripten_stack_get_current(),stackRestore=e=>__emscripten_stack_restore(e),createInvokeFunction=e=>(r,...M)=>{var fe=stackSave();try{return dynCall(e,r,M)}catch($n){if(stackRestore(fe),!($n instanceof EmscriptenEH))throw $n;if(_setThrew(1,0),e[0]=="j")return 0n}},resolveGlobalSymbol=e=>{var r;return isSymbolDefined(e)?r=wasmImports[e]:e.startsWith("invoke_")&&(r=wasmImports[e]=createNamedFunction(e,createInvokeFunction(e.split("_")[1]))),{sym:r,name:e}},onPostCtors=[],addOnPostCtor=e=>{onPostCtors.push(e)},UTF8ToString=(e,r,M)=>e?UTF8ArrayToString(HEAPU8,e,r,M):"",loadWebAssemblyModule=(binary,flags,libName,localScope,handle)=>{var metadata=getDylinkMetadata(binary);function loadModule(){var memAlign=Math.pow(2,metadata.memoryAlign),memoryBase=metadata.memorySize?alignMemory(getMemory(metadata.memorySize+memAlign),memAlign):0,tableBase=metadata.tableSize?wasmTable.length:0;metadata.tableSize&&wasmTable.grow(metadata.tableSize);var moduleExports;function resolveSymbol(e){var r=resolveGlobalSymbol(e).sym;return!r&&localScope&&(r=localScope[e]),r||(r=moduleExports[e]),r}var proxyHandler={get(e,r){switch(r){case"__memory_base":return memoryBase;case"__table_base":return tableBase}if(r in wasmImports&&!wasmImports[r].stub){var M=wasmImports[r];return M}if(!(r in e)){var fe;e[r]=(...$n)=>(fe||(fe=resolveSymbol(r)),fe(...$n))}return e[r]}},proxy=new Proxy({},proxyHandler),GOTProxy=new Proxy(metadata.weakImports,GOTHandler),info={"GOT.mem":GOTProxy,"GOT.func":GOTProxy,env:proxy,wasi_snapshot_preview1:proxy};function postInstantiation(module,instance){updateTableMap(tableBase,metadata.tableSize),moduleExports=relocateExports(instance.exports,memoryBase),updateGOT(moduleExports),flags.allowUndefined||reportUndefinedSymbols();function addEmAsm(addr,body){for(var args=[],arity=0;;arity++){var argName="$"+arity;if(!body.includes(argName))break;args.push(argName)}args=args.join();var func=`(${args}) => { ${body} };`;eval(func)}if("__start_em_asm"in moduleExports)for(var start=moduleExports.__start_em_asm.value,stop=moduleExports.__stop_em_asm.value;start<stop;){var jsString=UTF8ToString(start);addEmAsm(start,jsString),start=HEAPU8.indexOf(0,start)+1}function addEmJs(name,cSig,body){var jsArgs=[];if(cSig=cSig.slice(1,-1),cSig!="void"){cSig=cSig.split(",");for(var arg of cSig){var jsArg=arg.split(" ").pop();jsArgs.push(jsArg.replaceAll("*",""))}}var func=`(${jsArgs}) => ${body};`;moduleExports[name]=eval(func)}for(var name in moduleExports)if(name.startsWith("__em_js__")){var start=moduleExports[name].value,jsString=UTF8ToString(start),[sig,body]=jsString.split("<::>");addEmJs(name.replace("__em_js__",""),sig,body),delete moduleExports[name]}var applyRelocs=moduleExports.__wasm_apply_data_relocs;applyRelocs&&(runtimeInitialized?applyRelocs():__RELOC_FUNCS__.push(applyRelocs));var init=moduleExports.__wasm_call_ctors;return init&&(runtimeInitialized?init():addOnPostCtor(init)),moduleExports}if(flags.loadAsync)return(async()=>{var e;return binary instanceof WebAssembly.Module?e=new WebAssembly.Instance(binary,info):{module:binary,instance:e}=await WebAssembly.instantiate(binary,info),postInstantiation(binary,e)})();var module=binary instanceof WebAssembly.Module?binary:new WebAssembly.Module(binary),instance=new WebAssembly.Instance(module,info);return postInstantiation(module,instance)}if(flags={...flags,rpath:{parentLibPath:libName,paths:metadata.runtimePaths}},flags.loadAsync)return metadata.neededDynlibs.reduce((e,r)=>e.then(()=>(r=findLibraryFS(r,flags.rpath)??r,loadDynamicLibrary(r,flags,localScope))),Promise.resolve()).then(loadModule);for(var needed of metadata.neededDynlibs)needed=findLibraryFS(needed,flags.rpath)??needed,loadDynamicLibrary(needed,flags,localScope);return loadModule()},mergeLibSymbols=e=>{for(var[r,M]of Object.entries(e)){let fe=qn=>{isSymbolDefined(qn)||(wasmImports[qn]=M)};fe(r);let $n="__main_argc_argv";r=="main"&&fe($n),r==$n&&fe("main")}},asyncLoad=async e=>{var r=await readAsync(e);return new Uint8Array(r)},preloadPlugins=[],registerWasmPlugin=()=>{var e={canHandle:r=>!Module.noWasmDecoding&&r.endsWith(".so"),handle:async(r,M)=>{try{var fe=await loadWebAssemblyModule(r,{loadAsync:!0,nodelete:!0},M,{})}catch($n){throw new Error(`failed to instantiate wasm: ${M}: ${$n}`)}return preloadedWasm[M]=fe,r}};preloadPlugins.push(e)},preloadedWasm={},PATH={isAbs:e=>e.charAt(0)==="/",splitPath:e=>/^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/.exec(e).slice(1),normalizeArray:(e,r)=>{for(var M=0,fe=e.length-1;fe>=0;fe--){var $n=e[fe];$n==="."?e.splice(fe,1):$n===".."?(e.splice(fe,1),M++):M&&(e.splice(fe,1),M--)}if(r)for(;M;M--)e.unshift("..");return e},normalize:e=>{var r=PATH.isAbs(e),M=e.slice(-1)==="/";return e=PATH.normalizeArray(e.split("/").filter(fe=>!!fe),!r).join("/"),!e&&!r&&(e="."),e&&M&&(e+="/"),(r?"/":"")+e},dirname:e=>{var r=PATH.splitPath(e),M=r[0],fe=r[1];return!M&&!fe?".":(fe&&(fe=fe.slice(0,-1)),M+fe)},basename:e=>e&&e.match(/([^\/]+|\/)\/*$/)[1],join:(...e)=>PATH.normalize(e.join("/")),join2:(e,r)=>PATH.normalize(e+"/"+r)},replaceORIGIN=(e,r)=>{if(r.startsWith("$ORIGIN")){var M=PATH.dirname(e);return r.replace("$ORIGIN",M)}return r},withStackSave=e=>{var r=stackSave(),M=e();return stackRestore(r),M},stackAlloc=e=>__emscripten_stack_alloc(e),lengthBytesUTF8=e=>{for(var r=0,M=0;M<e.length;++M){var fe=e.charCodeAt(M);fe<=127?r++:fe<=2047?r+=2:fe>=55296&&fe<=57343?(r+=4,++M):r+=3}return r},stringToUTF8Array=(e,r,M,fe)=>{if(!(fe>0))return 0;for(var $n=M,qn=M+fe-1,jn=0;jn<e.length;++jn){var Wn=e.codePointAt(jn);if(Wn<=127){if(M>=qn)break;r[M++]=Wn}else if(Wn<=2047){if(M+1>=qn)break;r[M++]=192|Wn>>6,r[M++]=128|Wn&63}else if(Wn<=65535){if(M+2>=qn)break;r[M++]=224|Wn>>12,r[M++]=128|Wn>>6&63,r[M++]=128|Wn&63}else{if(M+3>=qn)break;r[M++]=240|Wn>>18,r[M++]=128|Wn>>12&63,r[M++]=128|Wn>>6&63,r[M++]=128|Wn&63,jn++}}return r[M]=0,M-$n},stringToUTF8=(e,r,M)=>stringToUTF8Array(e,HEAPU8,r,M),stringToUTF8OnStack=e=>{var r=lengthBytesUTF8(e)+1,M=stackAlloc(r);return stringToUTF8(e,M,r),M},initRandomFill=()=>{if(ENVIRONMENT_IS_NODE){var e=require("node:crypto");return r=>(e.randomFillSync(r),0)}return r=>(crypto.getRandomValues(r),0)},randomFill=e=>(randomFill=initRandomFill())(e),PATH_FS={resolve:(...e)=>{for(var r="",M=!1,fe=e.length-1;fe>=-1&&!M;fe--){var $n=fe>=0?e[fe]:FS.cwd();if(typeof $n!="string")throw new TypeError("Arguments to path.resolve must be strings");if(!$n)return"";r=$n+"/"+r,M=PATH.isAbs($n)}return r=PATH.normalizeArray(r.split("/").filter(qn=>!!qn),!M).join("/"),(M?"/":"")+r||"."},relative:(e,r)=>{e=PATH_FS.resolve(e).slice(1),r=PATH_FS.resolve(r).slice(1);function M(Xn){for(var Kn=0;Kn<Xn.length&&Xn[Kn]==="";Kn++);for(var er=Xn.length-1;er>=0&&Xn[er]==="";er--);return Kn>er?[]:Xn.slice(Kn,er-Kn+1)}for(var fe=M(e.split("/")),$n=M(r.split("/")),qn=Math.min(fe.length,$n.length),jn=qn,Wn=0;Wn<qn;Wn++)if(fe[Wn]!==$n[Wn]){jn=Wn;break}var Yn=[];for(Wn=jn;Wn<fe.length;Wn++)Yn.push("..");return Yn=Yn.concat($n.slice(jn)),Yn.join("/")}},FS_stdin_getChar_buffer=[],intArrayFromString=(e,r,M)=>{var fe=lengthBytesUTF8(e)+1,$n=new Array(fe),qn=stringToUTF8Array(e,$n,0,$n.length);return $n.length=qn,$n},FS_stdin_getChar=()=>{if(!FS_stdin_getChar_buffer.length){var e=null;if(ENVIRONMENT_IS_NODE){var r=Buffer.alloc(256),M=0;try{M=fs.readSync(process.stdin.fd,r,0,256)}catch(fe){if(fe.toString().includes("EOF"))M=0;else throw fe}M>0&&(e=r.toString("utf-8",0,M))}else globalThis.window?.prompt&&(e=window.prompt("Input: "),e!==null&&(e+=`
`));if(!e)return null;FS_stdin_getChar_buffer=intArrayFromString(e)}return FS_stdin_getChar_buffer.shift()},TTY={ttys:[],init(){},shutdown(){},register(e,r){TTY.ttys[e]={input:[],output:[],ops:r},FS.registerDevice(e,TTY.stream_ops)},stream_ops:{open(e){var r=TTY.ttys[e.node.rdev];if(!r)throw new FS.ErrnoError(43);e.tty=r,e.seekable=!1},close(e){e.tty.ops.fsync(e.tty)},fsync(e){e.tty.ops.fsync(e.tty)},read(e,r,M,fe,$n){if(!e.tty||!e.tty.ops.get_char)throw new FS.ErrnoError(60);for(var qn=0,jn=0;jn<fe;jn++){var Wn;try{Wn=e.tty.ops.get_char(e.tty)}catch{throw new FS.ErrnoError(29)}if(Wn===void 0&&!qn)throw new FS.ErrnoError(6);if(Wn==null||(qn++,r[M+jn]=Wn,Wn===10))break}return qn&&(e.node.atime=Date.now()),qn},write(e,r,M,fe,$n){if(!e.tty||!e.tty.ops.put_char)throw new FS.ErrnoError(60);try{for(var qn=0;qn<fe;qn++)e.tty.ops.put_char(e.tty,r[M+qn])}catch{throw new FS.ErrnoError(29)}return fe&&(e.node.mtime=e.node.ctime=Date.now()),qn}},default_tty_ops:{get_char(e){return FS_stdin_getChar()},put_char(e,r){r===null||r===10?(out(UTF8ArrayToString(e.output)),e.output=[]):r!=0&&e.output.push(r)},fsync(e){e.output?.length>0&&(out(UTF8ArrayToString(e.output)),e.output=[])},ioctl_tcgets(e){return{c_iflag:25856,c_oflag:5,c_cflag:191,c_lflag:35387,c_cc:[3,28,127,21,4,0,1,0,17,19,26,0,18,15,23,22,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}},ioctl_tcsets(e,r,M){return 0},ioctl_tiocgwinsz(e){return[24,80]}},default_tty1_ops:{put_char(e,r){r===null||r===10?(err(UTF8ArrayToString(e.output)),e.output=[]):r!=0&&e.output.push(r)},fsync(e){e.output?.length>0&&(err(UTF8ArrayToString(e.output)),e.output=[])}}},zeroMemory=(e,r)=>HEAPU8.fill(0,e,e+r),mmapAlloc=e=>{e=alignMemory(e,65536);var r=_emscripten_builtin_memalign(65536,e);return r&&zeroMemory(r,e),r},MEMFS={ops_table:null,mount(e){return MEMFS.createNode(null,"/",16895,0)},createNode(e,r,M,fe){if(FS.isBlkdev(M)||FS.isFIFO(M))throw new FS.ErrnoError(63);MEMFS.ops_table||(MEMFS.ops_table={dir:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr,lookup:MEMFS.node_ops.lookup,mknod:MEMFS.node_ops.mknod,rename:MEMFS.node_ops.rename,unlink:MEMFS.node_ops.unlink,rmdir:MEMFS.node_ops.rmdir,readdir:MEMFS.node_ops.readdir,symlink:MEMFS.node_ops.symlink},stream:{llseek:MEMFS.stream_ops.llseek}},file:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr},stream:{llseek:MEMFS.stream_ops.llseek,read:MEMFS.stream_ops.read,write:MEMFS.stream_ops.write,mmap:MEMFS.stream_ops.mmap,msync:MEMFS.stream_ops.msync}},link:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr,readlink:MEMFS.node_ops.readlink},stream:{}},chrdev:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr},stream:FS.chrdev_stream_ops}});var $n=FS.createNode(e,r,M,fe);return FS.isDir($n.mode)?($n.node_ops=MEMFS.ops_table.dir.node,$n.stream_ops=MEMFS.ops_table.dir.stream,$n.contents={}):FS.isFile($n.mode)?($n.node_ops=MEMFS.ops_table.file.node,$n.stream_ops=MEMFS.ops_table.file.stream,$n.usedBytes=0,$n.contents=MEMFS.emptyFileContents??(MEMFS.emptyFileContents=new Uint8Array(0))):FS.isLink($n.mode)?($n.node_ops=MEMFS.ops_table.link.node,$n.stream_ops=MEMFS.ops_table.link.stream):FS.isChrdev($n.mode)&&($n.node_ops=MEMFS.ops_table.chrdev.node,$n.stream_ops=MEMFS.ops_table.chrdev.stream),$n.atime=$n.mtime=$n.ctime=Date.now(),e&&(e.contents[r]=$n,e.atime=e.mtime=e.ctime=$n.atime),$n},getFileDataAsTypedArray(e){return e.contents.subarray(0,e.usedBytes)},expandFileStorage(e,r){var M=e.contents.length;if(!(M>=r)){r=Math.max(r,M*(M<1048576?2:1.125)>>>0),M&&(r=Math.max(r,256));var fe=MEMFS.getFileDataAsTypedArray(e);e.contents=new Uint8Array(r),e.contents.set(fe)}},resizeFileStorage(e,r){if(e.usedBytes!=r){var M=e.contents;e.contents=new Uint8Array(r),e.contents.set(M.subarray(0,Math.min(r,e.usedBytes))),e.usedBytes=r}},node_ops:{getattr(e){var r={};return r.dev=FS.isChrdev(e.mode)?e.id:1,r.ino=e.id,r.mode=e.mode,r.nlink=1,r.uid=0,r.gid=0,r.rdev=e.rdev,FS.isDir(e.mode)?r.size=4096:FS.isFile(e.mode)?r.size=e.usedBytes:FS.isLink(e.mode)?r.size=e.link.length:r.size=0,r.atime=new Date(e.atime),r.mtime=new Date(e.mtime),r.ctime=new Date(e.ctime),r.blksize=4096,r.blocks=Math.ceil(r.size/r.blksize),r},setattr(e,r){for(let M of["mode","atime","mtime","ctime"])r[M]!=null&&(e[M]=r[M]);r.size!==void 0&&MEMFS.resizeFileStorage(e,r.size)},lookup(e,r){throw MEMFS.doesNotExistError||(MEMFS.doesNotExistError=new FS.ErrnoError(44),MEMFS.doesNotExistError.stack="<generic error, no stack>"),MEMFS.doesNotExistError},mknod(e,r,M,fe){return MEMFS.createNode(e,r,M,fe)},rename(e,r,M){var fe;try{fe=FS.lookupNode(r,M)}catch{}if(fe&&FS.isDir(e.mode))for(var $n in fe.contents)throw new FS.ErrnoError(55);delete e.parent.contents[e.name],r.contents[M]=e,e.name=M,r.ctime=r.mtime=e.parent.ctime=e.parent.mtime=Date.now()},unlink(e,r){delete e.contents[r],e.ctime=e.mtime=Date.now()},rmdir(e,r){var M=FS.lookupNode(e,r);for(var fe in M.contents)throw new FS.ErrnoError(55);delete e.contents[r],e.ctime=e.mtime=Date.now()},readdir(e){return[".","..",...Object.keys(e.contents)]},symlink(e,r,M){var fe=MEMFS.createNode(e,r,41471,0);return fe.link=M,fe},readlink(e){if(!FS.isLink(e.mode))throw new FS.ErrnoError(28);return e.link}},stream_ops:{read(e,r,M,fe,$n){var qn=e.node.contents;if($n>=e.node.usedBytes)return 0;var jn=Math.min(e.node.usedBytes-$n,fe);return r.set(qn.subarray($n,$n+jn),M),jn},write(e,r,M,fe,$n,qn){if(r.buffer===HEAP8.buffer&&(qn=!1),!fe)return 0;var jn=e.node;return jn.mtime=jn.ctime=Date.now(),qn?(jn.contents=r.subarray(M,M+fe),jn.usedBytes=fe):!jn.usedBytes&&!$n?(jn.contents=r.slice(M,M+fe),jn.usedBytes=fe):(MEMFS.expandFileStorage(jn,$n+fe),jn.contents.set(r.subarray(M,M+fe),$n),jn.usedBytes=Math.max(jn.usedBytes,$n+fe)),fe},llseek(e,r,M){var fe=r;if(M===1?fe+=e.position:M===2&&FS.isFile(e.node.mode)&&(fe+=e.node.usedBytes),fe<0)throw new FS.ErrnoError(28);return fe},mmap(e,r,M,fe,$n){if(!FS.isFile(e.node.mode))throw new FS.ErrnoError(43);var qn,jn,Wn=e.node.contents;if(!($n&2)&&Wn.buffer===HEAP8.buffer)jn=!1,qn=Wn.byteOffset;else{if(jn=!0,qn=mmapAlloc(r),!qn)throw new FS.ErrnoError(48);Wn&&((M>0||M+r<Wn.length)&&(Wn.subarray?Wn=Wn.subarray(M,M+r):Wn=Array.prototype.slice.call(Wn,M,M+r)),HEAP8.set(Wn,qn))}return{ptr:qn,allocated:jn}},msync(e,r,M,fe,$n){return MEMFS.stream_ops.write(e,r,0,fe,M,!1),0}}},FS_modeStringToFlags=e=>{if(typeof e!="string")return e;var r={r:0,"r+":2,w:577,"w+":578,a:1089,"a+":1090}[e];if(typeof r>"u")throw new Error(`Unknown file open mode: ${e}`);return r},FS_fileDataToTypedArray=e=>(typeof e=="string"&&(e=intArrayFromString(e)),e.subarray||(e=new Uint8Array(e)),e),FS_getMode=(e,r)=>{var M=0;return e&&(M|=365),r&&(M|=146),M},ERRNO_CODES={EPERM:63,ENOENT:44,ESRCH:71,EINTR:27,EIO:29,ENXIO:60,E2BIG:1,ENOEXEC:45,EBADF:8,ECHILD:12,EAGAIN:6,EWOULDBLOCK:6,ENOMEM:48,EACCES:2,EFAULT:21,ENOTBLK:105,EBUSY:10,EEXIST:20,EXDEV:75,ENODEV:43,ENOTDIR:54,EISDIR:31,EINVAL:28,ENFILE:41,EMFILE:33,ENOTTY:59,ETXTBSY:74,EFBIG:22,ENOSPC:51,ESPIPE:70,EROFS:69,EMLINK:34,EPIPE:64,EDOM:18,ERANGE:68,ENOMSG:49,EIDRM:24,ECHRNG:106,EL2NSYNC:156,EL3HLT:107,EL3RST:108,ELNRNG:109,EUNATCH:110,ENOCSI:111,EL2HLT:112,EDEADLK:16,ENOLCK:46,EBADE:113,EBADR:114,EXFULL:115,ENOANO:104,EBADRQC:103,EBADSLT:102,EDEADLOCK:16,EBFONT:101,ENOSTR:100,ENODATA:116,ETIME:117,ENOSR:118,ENONET:119,ENOPKG:120,EREMOTE:121,ENOLINK:47,EADV:122,ESRMNT:123,ECOMM:124,EPROTO:65,EMULTIHOP:36,EDOTDOT:125,EBADMSG:9,ENOTUNIQ:126,EBADFD:127,EREMCHG:128,ELIBACC:129,ELIBBAD:130,ELIBSCN:131,ELIBMAX:132,ELIBEXEC:133,ENOSYS:52,ENOTEMPTY:55,ENAMETOOLONG:37,ELOOP:32,EOPNOTSUPP:138,EPFNOSUPPORT:139,ECONNRESET:15,ENOBUFS:42,EAFNOSUPPORT:5,EPROTOTYPE:67,ENOTSOCK:57,ENOPROTOOPT:50,ESHUTDOWN:140,ECONNREFUSED:14,EADDRINUSE:3,ECONNABORTED:13,ENETUNREACH:40,ENETDOWN:38,ETIMEDOUT:73,EHOSTDOWN:142,EHOSTUNREACH:23,EINPROGRESS:26,EALREADY:7,EDESTADDRREQ:17,EMSGSIZE:35,EPROTONOSUPPORT:66,ESOCKTNOSUPPORT:137,EADDRNOTAVAIL:4,ENETRESET:39,EISCONN:30,ENOTCONN:53,ETOOMANYREFS:141,EUSERS:136,EDQUOT:19,ESTALE:72,ENOTSUP:138,ENOMEDIUM:148,EILSEQ:25,EOVERFLOW:61,ECANCELED:11,ENOTRECOVERABLE:56,EOWNERDEAD:62,ESTRPIPE:135},PROXYFS={mount(e){return PROXYFS.createNode(null,"/",e.opts.fs.lstat(e.opts.root).mode,0)},createNode(e,r,M,fe){if(!FS.isDir(M)&&!FS.isFile(M)&&!FS.isLink(M))throw new FS.ErrnoError(ERRNO_CODES.EINVAL);var $n=FS.createNode(e,r,M);return $n.node_ops=PROXYFS.node_ops,$n.stream_ops=PROXYFS.stream_ops,$n},realPath(e){for(var r=[];e.parent!==e;)r.push(e.name),e=e.parent;return r.push(e.mount.opts.root),r.reverse(),PATH.join(...r)},node_ops:{getattr(e){var r=PROXYFS.realPath(e),M;try{M=e.mount.opts.fs.lstat(r)}catch(fe){throw fe.code?new FS.ErrnoError(ERRNO_CODES[fe.code]):fe}return{dev:M.dev,ino:M.ino,mode:M.mode,nlink:M.nlink,uid:M.uid,gid:M.gid,rdev:M.rdev,size:M.size,atime:M.atime,mtime:M.mtime,ctime:M.ctime,blksize:M.blksize,blocks:M.blocks}},setattr(e,r){var M=PROXYFS.realPath(e);try{if(r.mode!==void 0&&(e.mount.opts.fs.chmod(M,r.mode),e.mode=r.mode),r.atime||r.mtime){var fe=new Date(r.atime||r.mtime),$n=new Date(r.mtime||r.atime);e.mount.opts.fs.utime(M,fe,$n)}r.size!==void 0&&e.mount.opts.fs.truncate(M,r.size)}catch(qn){throw qn.code?new FS.ErrnoError(ERRNO_CODES[qn.code]):qn}},lookup(e,r){try{var M=PATH.join2(PROXYFS.realPath(e),r),fe=e.mount.opts.fs.lstat(M).mode,$n=PROXYFS.createNode(e,r,fe);return $n}catch(qn){throw qn.code?new FS.ErrnoError(ERRNO_CODES[qn.code]):qn}},mknod(e,r,M,fe){var $n=PROXYFS.createNode(e,r,M,fe),qn=PROXYFS.realPath($n);try{FS.isDir($n.mode)?$n.mount.opts.fs.mkdir(qn,$n.mode):$n.mount.opts.fs.writeFile(qn,"",{mode:$n.mode})}catch(jn){throw jn.code?new FS.ErrnoError(ERRNO_CODES[jn.code]):jn}return $n},rename(e,r,M){var fe=PROXYFS.realPath(e),$n=PATH.join2(PROXYFS.realPath(r),M);try{e.mount.opts.fs.rename(fe,$n),e.name=M}catch(qn){throw qn.code?new FS.ErrnoError(ERRNO_CODES[qn.code]):qn}},unlink(e,r){var M=PATH.join2(PROXYFS.realPath(e),r);try{e.mount.opts.fs.unlink(M)}catch(fe){throw fe.code?new FS.ErrnoError(ERRNO_CODES[fe.code]):fe}},rmdir(e,r){var M=PATH.join2(PROXYFS.realPath(e),r);try{e.mount.opts.fs.rmdir(M)}catch(fe){throw fe.code?new FS.ErrnoError(ERRNO_CODES[fe.code]):fe}},readdir(e){var r=PROXYFS.realPath(e);try{return e.mount.opts.fs.readdir(r)}catch(M){throw M.code?new FS.ErrnoError(ERRNO_CODES[M.code]):M}},symlink(e,r,M){var fe=PATH.join2(PROXYFS.realPath(e),r);try{e.mount.opts.fs.symlink(M,fe)}catch($n){throw $n.code?new FS.ErrnoError(ERRNO_CODES[$n.code]):$n}},readlink(e){var r=PROXYFS.realPath(e);try{return e.mount.opts.fs.readlink(r)}catch(M){throw M.code?new FS.ErrnoError(ERRNO_CODES[M.code]):M}}},stream_ops:{open(e){var r=PROXYFS.realPath(e.node);try{e.nfd=e.node.mount.opts.fs.open(r,e.flags)}catch(M){throw M.code?new FS.ErrnoError(ERRNO_CODES[M.code]):M}},close(e){try{e.node.mount.opts.fs.close(e.nfd)}catch(r){throw r.code?new FS.ErrnoError(ERRNO_CODES[r.code]):r}},read(e,r,M,fe,$n){try{return e.node.mount.opts.fs.read(e.nfd,r,M,fe,$n)}catch(qn){throw qn.code?new FS.ErrnoError(ERRNO_CODES[qn.code]):qn}},write(e,r,M,fe,$n){try{return e.node.mount.opts.fs.write(e.nfd,r,M,fe,$n)}catch(qn){throw qn.code?new FS.ErrnoError(ERRNO_CODES[qn.code]):qn}},llseek(e,r,M){var fe=r;if(M===1)fe+=e.position;else if(M===2&&FS.isFile(e.node.mode))try{var $n=e.node.node_ops.getattr(e.node);fe+=$n.size}catch(qn){throw new FS.ErrnoError(ERRNO_CODES[qn.code])}if(fe<0)throw new FS.ErrnoError(ERRNO_CODES.EINVAL);return fe}}},FS_createDataFile=(...e)=>FS.createDataFile(...e),dependenciesPromise=null,resolveRunDependencies=async()=>dependenciesPromise,runDependencies=0,dependenciesPromiseResolve=null,removeRunDependency=()=>{runDependencies--,Module.monitorRunDependencies?.(runDependencies),runDependencies||dependenciesPromiseResolve()},addRunDependency=()=>{runDependencies||(dependenciesPromise=new Promise(e=>dependenciesPromiseResolve=e)),runDependencies++,Module.monitorRunDependencies?.(runDependencies)},FS_handledByPreloadPlugin=async(e,r)=>{typeof Browser<"u"&&Browser.init();for(var M of preloadPlugins)if(M.canHandle(r))return M.handle(e,r);return e},FS_preloadFile=async(e,r,M,fe,$n,qn,jn,Wn)=>{var Yn=r?PATH_FS.resolve(PATH.join2(e,r)):e;addRunDependency();try{var Xn=M;typeof M=="string"&&(Xn=await asyncLoad(M)),Xn=await FS_handledByPreloadPlugin(Xn,Yn),Wn?.(),qn||FS_createDataFile(e,r,Xn,fe,$n,jn)}finally{removeRunDependency()}},FS_createPreloadedFile=(e,r,M,fe,$n,qn,jn,Wn,Yn,Xn)=>{FS_preloadFile(e,r,M,fe,$n,Wn,Yn,Xn).then(qn).catch(jn)},FS={root:null,mounts:[],devices:{},streams:[],nextInode:1,nameTable:[],currentPath:"/",initialized:!1,ignorePermissions:!0,syncFSRequests:0,ErrnoError:class{constructor(e){P$2(this,"name","ErrnoError"),this.errno=e}},FSStream:class{constructor(){P$2(this,"shared",{})}get object(){return this.node}set object(e){this.node=e}get isRead(){return(this.flags&2097155)!==1}get isWrite(){return(this.flags&2097155)!==0}get isAppend(){return this.flags&1024}get flags(){return this.shared.flags}set flags(e){this.shared.flags=e}get position(){return this.shared.position}set position(e){this.shared.position=e}},FSNode:class{constructor(e,r,M,fe){P$2(this,"node_ops",{}),P$2(this,"stream_ops",{}),P$2(this,"readMode",365),P$2(this,"writeMode",146),P$2(this,"mounted",null),e||(e=this),this.parent=e,this.mount=e.mount,this.id=FS.nextInode++,this.name=r,this.mode=M,this.rdev=fe,this.atime=this.mtime=this.ctime=Date.now()}get read(){return(this.mode&this.readMode)===this.readMode}set read(e){e?this.mode|=this.readMode:this.mode&=~this.readMode}get write(){return(this.mode&this.writeMode)===this.writeMode}set write(e){e?this.mode|=this.writeMode:this.mode&=~this.writeMode}get isFolder(){return FS.isDir(this.mode)}get isDevice(){return FS.isChrdev(this.mode)}addListener(e,r=!1){var M={cb:e,exclusive:r},fe=this.listeners??(this.listeners=new Set);return fe.add(M),{listeners:fe,entry:M}}notifyListeners(e){if(this.listeners){var r;for(var M of this.listeners)M.exclusive?(r||(r=[])).push(M):M.cb(e);if(r){var fe=(this.exclTurn||0)%r.length;this.exclTurn=fe+1,r[fe].cb(e)}}}},lookupPath(e,r={}){if(!e)throw new FS.ErrnoError(44);r.follow_mount??(r.follow_mount=!0),PATH.isAbs(e)||(e=FS.cwd()+"/"+e);e:for(var M=0;M<40;M++){for(var fe=e.split("/").filter(Xn=>!!Xn),$n=FS.root,qn="/",jn=0;jn<fe.length;jn++){var Wn=jn===fe.length-1;if(Wn&&r.parent)break;if(fe[jn]!=="."){if(fe[jn]===".."){if(qn=PATH.dirname(qn),FS.isRoot($n)){e=qn+"/"+fe.slice(jn+1).join("/"),M--;continue e}else $n=$n.parent;continue}qn=PATH.join2(qn,fe[jn]);try{$n=FS.lookupNode($n,fe[jn])}catch(Xn){if(Xn?.errno===44&&Wn&&r.noent_okay)return{path:qn};throw Xn}if(FS.isMountpoint($n)&&(!Wn||r.follow_mount)&&($n=$n.mounted.root),FS.isLink($n.mode)&&(!Wn||r.follow)){if(!$n.node_ops.readlink)throw new FS.ErrnoError(52);var Yn=$n.node_ops.readlink($n);PATH.isAbs(Yn)||(Yn=PATH.dirname(qn)+"/"+Yn),e=Yn+"/"+fe.slice(jn+1).join("/");continue e}}}return{path:qn,node:$n}}throw new FS.ErrnoError(32)},getPath(e){for(var r;;){if(FS.isRoot(e)){var M=e.mount.mountpoint;return r?M[M.length-1]!=="/"?`${M}/${r}`:M+r:M}r=r?`${e.name}/${r}`:e.name,e=e.parent}},hashName(e,r){for(var M=0,fe=0;fe<r.length;fe++)M=(M<<5)-M+r.charCodeAt(fe)|0;return(e+M>>>0)%FS.nameTable.length},hashAddNode(e){var r=FS.hashName(e.parent.id,e.name);e.name_next=FS.nameTable[r],FS.nameTable[r]=e},hashRemoveNode(e){var r=FS.hashName(e.parent.id,e.name);if(FS.nameTable[r]===e)FS.nameTable[r]=e.name_next;else for(var M=FS.nameTable[r];M;){if(M.name_next===e){M.name_next=e.name_next;break}M=M.name_next}},lookupNode(e,r){var M=FS.mayLookup(e);if(M)throw new FS.ErrnoError(M);for(var fe=FS.hashName(e.id,r),$n=FS.nameTable[fe];$n;$n=$n.name_next){var qn=$n.name;if($n.parent.id===e.id&&qn===r)return $n}return FS.lookup(e,r)},createNode(e,r,M,fe){var $n=new FS.FSNode(e,r,M,fe);return FS.hashAddNode($n),$n},destroyNode(e){FS.hashRemoveNode(e)},isRoot(e){return e===e.parent},isMountpoint(e){return!!e.mounted},isFile(e){return(e&61440)===32768},isDir(e){return(e&61440)===16384},isLink(e){return(e&61440)===40960},isChrdev(e){return(e&61440)===8192},isBlkdev(e){return(e&61440)===24576},isFIFO(e){return(e&61440)===4096},isSocket(e){return(e&49152)===49152},flagsToPermissionString(e){var r=["r","w","rw"][e&3];return e&512&&(r+="w"),r},nodePermissions(e,r){return FS.ignorePermissions?0:r.includes("r")&&!(e.mode&292)||r.includes("w")&&!(e.mode&146)||r.includes("x")&&!(e.mode&73)?2:0},mayLookup(e){if(!FS.isDir(e.mode))return 54;var r=FS.nodePermissions(e,"x");return r||(e.node_ops.lookup?0:2)},mayCreate(e,r){if(!FS.isDir(e.mode))return 54;try{return FS.lookupNode(e,r),20}catch{}return FS.nodePermissions(e,"wx")},mayDelete(e,r,M){var fe;try{fe=FS.lookupNode(e,r)}catch(qn){return qn.errno}var $n=FS.nodePermissions(e,"wx");if($n)return $n;if(M){if(!FS.isDir(fe.mode))return 54;if(FS.isRoot(fe)||FS.getPath(fe)===FS.cwd())return 10}else if(FS.isDir(fe.mode))return 31;return 0},mayOpen(e,r){if(!e)return 44;if(FS.isLink(e.mode))return 32;var M=FS.flagsToPermissionString(r);return FS.isDir(e.mode)&&(M!=="r"||r&576)?31:FS.nodePermissions(e,M)},checkOpExists(e,r){if(!e)throw new FS.ErrnoError(r);return e},MAX_OPEN_FDS:4096,nextfd(){for(var e=0;e<=FS.MAX_OPEN_FDS;e++)if(!FS.streams[e])return e;throw new FS.ErrnoError(33)},getStreamChecked(e){var r=FS.getStream(e);if(!r)throw new FS.ErrnoError(8);return r},getStream:e=>FS.streams[e],createStream(e,r=-1){return e=Object.assign(new FS.FSStream,e),r==-1&&(r=FS.nextfd()),e.fd=r,FS.streams[r]=e,e},closeStream(e){FS.streams[e]=null},dupStream(e,r=-1){var M=FS.createStream(e,r);return M.stream_ops?.dup?.(M),M},doSetAttr(e,r,M){var fe=e?.stream_ops.setattr,$n=fe?e:r;fe??(fe=r.node_ops.setattr),FS.checkOpExists(fe,63);try{fe($n,M)}catch(qn){throw qn instanceof RangeError?new FS.ErrnoError(22):qn}},chrdev_stream_ops:{open(e){var r=FS.getDevice(e.node.rdev);e.stream_ops=r.stream_ops,e.stream_ops.open?.(e)},llseek(){throw new FS.ErrnoError(70)}},major:e=>e>>8,minor:e=>e&255,makedev:(e,r)=>e<<8|r,registerDevice(e,r){FS.devices[e]={stream_ops:r}},getDevice:e=>FS.devices[e],getMounts(e){for(var r=[],M=[e];M.length;){var fe=M.pop();r.push(fe),M.push(...fe.mounts)}return r},syncfs(e,r){typeof e=="function"&&(r=e,e=!1),FS.syncFSRequests++,FS.syncFSRequests>1&&err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);var M=FS.getMounts(FS.root.mount),fe=0;function $n(Wn){return FS.syncFSRequests--,r(Wn)}function qn(Wn){if(Wn)return qn.errored?void 0:(qn.errored=!0,$n(Wn));++fe>=M.length&&$n(null)}for(var jn of M)jn.type.syncfs?jn.type.syncfs(jn,e,qn):qn(null)},mount(e,r,M){var fe=M==="/",$n=!M,qn;if(fe&&FS.root)throw new FS.ErrnoError(10);if(!fe&&!$n){var jn=FS.lookupPath(M,{follow_mount:!1});if(M=jn.path,qn=jn.node,FS.isMountpoint(qn))throw new FS.ErrnoError(10);if(!FS.isDir(qn.mode))throw new FS.ErrnoError(54)}var Wn={type:e,opts:r,mountpoint:M,mounts:[]},Yn=e.mount(Wn);return Yn.mount=Wn,Wn.root=Yn,fe?FS.root=Yn:qn&&(qn.mounted=Wn,qn.mount&&qn.mount.mounts.push(Wn)),Yn},unmount(e){var r=FS.lookupPath(e,{follow_mount:!1});if(!FS.isMountpoint(r.node))throw new FS.ErrnoError(28);var M=r.node,fe=M.mounted,$n=FS.getMounts(fe);for(var[qn,jn]of Object.entries(FS.nameTable))for(;jn;){var Wn=jn.name_next;$n.includes(jn.mount)&&FS.destroyNode(jn),jn=Wn}M.mounted=null;var Yn=M.mount.mounts.indexOf(fe);M.mount.mounts.splice(Yn,1)},lookup(e,r){return e.node_ops.lookup(e,r)},mknod(e,r,M){var fe=FS.lookupPath(e,{parent:!0}),$n=fe.node,qn=PATH.basename(e);if(!qn)throw new FS.ErrnoError(28);if(qn==="."||qn==="..")throw new FS.ErrnoError(20);var jn=FS.mayCreate($n,qn);if(jn)throw new FS.ErrnoError(jn);if(!$n.node_ops.mknod)throw new FS.ErrnoError(63);return $n.node_ops.mknod($n,qn,r,M)},statfs(e){return FS.statfsNode(FS.lookupPath(e,{follow:!0}).node)},statfsStream(e){return FS.statfsNode(e.node)},statfsNode(e){var r={bsize:4096,frsize:4096,blocks:1e6,bfree:5e5,bavail:5e5,files:FS.nextInode,ffree:FS.nextInode-1,fsid:42,flags:2,namelen:255};return e.node_ops.statfs&&Object.assign(r,e.node_ops.statfs(e.mount.opts.root)),r},create(e,r=438){return r&=4095,r|=32768,FS.mknod(e,r,0)},mkdir(e,r=511){return r&=1023,r|=16384,FS.mknod(e,r,0)},mkdirTree(e,r=511){var M=e.split("/"),fe="";for(var $n of M)if($n){(fe||PATH.isAbs(e))&&(fe+="/"),fe+=$n;try{FS.mkdir(fe,r)}catch(qn){if(qn.errno!=20)throw qn}}},mkdev(e,r,M){return typeof M>"u"&&(M=r,r=438),r|=8192,FS.mknod(e,r,M)},symlink(e,r){if(!PATH_FS.resolve(e))throw new FS.ErrnoError(44);var M=FS.lookupPath(r,{parent:!0}),fe=M.node;if(!fe)throw new FS.ErrnoError(44);var $n=PATH.basename(r),qn=FS.mayCreate(fe,$n);if(qn)throw new FS.ErrnoError(qn);if(!fe.node_ops.symlink)throw new FS.ErrnoError(63);return fe.node_ops.symlink(fe,$n,e)},link(e,r,M){var fe=FS.lookupPath(r,{parent:!0}),$n=fe.node;if(!$n)throw new FS.ErrnoError(44);var qn=PATH.basename(r),jn=FS.mayCreate($n,qn);if(jn)throw new FS.ErrnoError(jn);if(!$n.node_ops.link)throw new FS.ErrnoError(34);return $n.node_ops.link($n,qn,e,M)},rename(e,r){var M=PATH.dirname(e),fe=PATH.dirname(r),$n=PATH.basename(e),qn=PATH.basename(r),jn,Wn,Yn;if(jn=FS.lookupPath(e,{parent:!0}),Wn=jn.node,jn=FS.lookupPath(r,{parent:!0}),Yn=jn.node,!Wn||!Yn)throw new FS.ErrnoError(44);if(Wn.mount!==Yn.mount)throw new FS.ErrnoError(75);var Xn=FS.lookupNode(Wn,$n),Kn=PATH_FS.relative(e,fe);if(Kn.charAt(0)!==".")throw new FS.ErrnoError(28);if(Kn=PATH_FS.relative(r,M),Kn.charAt(0)!==".")throw new FS.ErrnoError(55);var er;try{er=FS.lookupNode(Yn,qn)}catch{}if(Xn!==er){var nr=FS.isDir(Xn.mode),Zn=FS.mayDelete(Wn,$n,nr);if(Zn)throw new FS.ErrnoError(Zn);if(Zn=er?FS.mayDelete(Yn,qn,nr):FS.mayCreate(Yn,qn),Zn)throw new FS.ErrnoError(Zn);if(!Wn.node_ops.rename)throw new FS.ErrnoError(63);if(FS.isMountpoint(Xn)||er&&FS.isMountpoint(er))throw new FS.ErrnoError(10);if(Yn!==Wn&&(Zn=FS.nodePermissions(Wn,"w"),Zn))throw new FS.ErrnoError(Zn);FS.hashRemoveNode(Xn);try{Wn.node_ops.rename(Xn,Yn,qn),er&&FS.hashRemoveNode(er),Xn.parent=Yn}catch(rr){throw rr}finally{FS.hashAddNode(Xn)}}},rmdir(e){var r=FS.lookupPath(e,{parent:!0}),M=r.node,fe=PATH.basename(e),$n=FS.lookupNode(M,fe),qn=FS.mayDelete(M,fe,!0);if(qn)throw new FS.ErrnoError(qn);if(!M.node_ops.rmdir)throw new FS.ErrnoError(63);if(FS.isMountpoint($n))throw new FS.ErrnoError(10);M.node_ops.rmdir(M,fe),FS.destroyNode($n)},readdir(e){var r=FS.lookupPath(e,{follow:!0}),M=r.node,fe=FS.checkOpExists(M.node_ops.readdir,54);return fe(M)},unlink(e){var r=FS.lookupPath(e,{parent:!0}),M=r.node;if(!M)throw new FS.ErrnoError(44);var fe=PATH.basename(e),$n=FS.lookupNode(M,fe),qn=FS.mayDelete(M,fe,!1);if(qn)throw new FS.ErrnoError(qn);if(!M.node_ops.unlink)throw new FS.ErrnoError(63);if(FS.isMountpoint($n))throw new FS.ErrnoError(10);M.node_ops.unlink(M,fe),FS.destroyNode($n)},readlink(e){var r=FS.lookupPath(e),M=r.node;if(!M)throw new FS.ErrnoError(44);if(!M.node_ops.readlink)throw new FS.ErrnoError(28);return M.node_ops.readlink(M)},stat(e,r=!1){var M=FS.lookupPath(e,{follow:!r}),fe=M.node,$n=FS.checkOpExists(fe.node_ops.getattr,63);return $n(fe)},fstat(e){var r=FS.getStreamChecked(e),M=r.node,fe=r.stream_ops.getattr,$n=fe?r:M;return fe??(fe=M.node_ops.getattr),FS.checkOpExists(fe,63),fe($n)},lstat(e){return FS.stat(e,!0)},doChmod(e,r,M,fe=!1){FS.doSetAttr(e,r,{mode:M&4095|r.mode&-4096,ctime:Date.now(),dontFollow:fe})},chmod(e,r,M=!1){var fe;if(typeof e=="string"){var $n=FS.lookupPath(e,{follow:!M});fe=$n.node}else fe=e;FS.doChmod(null,fe,r,M)},lchmod(e,r){FS.chmod(e,r,!0)},fchmod(e,r){var M=FS.getStreamChecked(e);FS.doChmod(M,M.node,r,!1)},doChown(e,r,M=!1){FS.doSetAttr(e,r,{timestamp:Date.now(),dontFollow:M})},chown(e,r,M,fe=!1){var $n;if(typeof e=="string"){var qn=FS.lookupPath(e,{follow:!fe});$n=qn.node}else $n=e;FS.doChown(null,$n,fe)},lchown(e,r,M){FS.chown(e,r,M,!0)},fchown(e,r,M){var fe=FS.getStreamChecked(e);FS.doChown(fe,fe.node,!1)},doTruncate(e,r,M){if(FS.isDir(r.mode))throw new FS.ErrnoError(31);if(!FS.isFile(r.mode))throw new FS.ErrnoError(28);var fe=FS.nodePermissions(r,"w");if(fe)throw new FS.ErrnoError(fe);FS.doSetAttr(e,r,{size:M,timestamp:Date.now()})},truncate(e,r){if(r<0)throw new FS.ErrnoError(28);var M;if(typeof e=="string"){var fe=FS.lookupPath(e,{follow:!0});M=fe.node}else M=e;FS.doTruncate(null,M,r)},ftruncate(e,r){var M=FS.getStreamChecked(e);if(r<0||(M.flags&2097155)===0)throw new FS.ErrnoError(28);FS.doTruncate(M,M.node,r)},utime(e,r,M,fe=!1){var $n=FS.lookupPath(e,{follow:!fe});FS.doSetAttr(null,$n.node,{atime:r,mtime:M,dontFollow:fe})},open(e,r,M=438){if(e==="")throw new FS.ErrnoError(44);r=FS_modeStringToFlags(r),r&64?M=M&4095|32768:M=0;var fe,$n;if(typeof e=="object")fe=e;else{$n=e.endsWith("/");var qn=FS.lookupPath(e,{follow:!(r&131072),noent_okay:!0});fe=qn.node,e=qn.path}var jn=!1;if(r&64)if(fe){if(r&128)throw new FS.ErrnoError(20)}else{if($n)throw new FS.ErrnoError(31);fe=FS.mknod(e,M|511,0),jn=!0}if(!fe)throw new FS.ErrnoError(44);if(FS.isChrdev(fe.mode)&&(r&=-513),r&65536&&!FS.isDir(fe.mode))throw new FS.ErrnoError(54);if(!jn){var Wn=FS.mayOpen(fe,r);if(Wn)throw new FS.ErrnoError(Wn)}r&512&&!jn&&FS.truncate(fe,0),r&=-131713;var Yn=FS.createStream({node:fe,path:FS.getPath(fe),flags:r,seekable:!0,position:0,stream_ops:fe.stream_ops,ungotten:[],error:!1});return Yn.stream_ops.open&&Yn.stream_ops.open(Yn),jn&&FS.chmod(fe,M&511),Yn},close(e){if(FS.isClosed(e))throw new FS.ErrnoError(8);e.getdents&&(e.getdents=null),e.node?.notifyListeners(32);try{e.stream_ops.close&&e.stream_ops.close(e)}catch(r){throw r}finally{FS.closeStream(e.fd)}e.fd=null},isClosed(e){return e.fd===null},llseek(e,r,M){if(FS.isClosed(e))throw new FS.ErrnoError(8);if(!e.seekable||!e.stream_ops.llseek)throw new FS.ErrnoError(70);if(M!=0&&M!=1&&M!=2)throw new FS.ErrnoError(28);return e.position=e.stream_ops.llseek(e,r,M),e.ungotten=[],e.position},read(e,r,M,fe,$n){if(fe<0||$n<0)throw new FS.ErrnoError(28);if(FS.isClosed(e))throw new FS.ErrnoError(8);if((e.flags&2097155)===1)throw new FS.ErrnoError(8);if(FS.isDir(e.node.mode))throw new FS.ErrnoError(31);if(!e.stream_ops.read)throw new FS.ErrnoError(28);var qn=typeof $n<"u";if(!qn)$n=e.position;else if(!e.seekable)throw new FS.ErrnoError(70);var jn=e.stream_ops.read(e,r,M,fe,$n);return qn||(e.position+=jn),jn},write(e,r,M,fe,$n,qn){if(fe<0||$n<0)throw new FS.ErrnoError(28);if(FS.isClosed(e))throw new FS.ErrnoError(8);if((e.flags&2097155)===0)throw new FS.ErrnoError(8);if(FS.isDir(e.node.mode))throw new FS.ErrnoError(31);if(!e.stream_ops.write)throw new FS.ErrnoError(28);e.seekable&&e.flags&1024&&FS.llseek(e,0,2);var jn=typeof $n<"u";if(!jn)$n=e.position;else if(!e.seekable)throw new FS.ErrnoError(70);var Wn=e.stream_ops.write(e,r,M,fe,$n,qn);return jn||(e.position+=Wn),Wn},mmap(e,r,M,fe,$n){if(fe&2&&!($n&2)&&(e.flags&2097155)!==2)throw new FS.ErrnoError(2);if((e.flags&2097155)===1)throw new FS.ErrnoError(2);if(!e.stream_ops.mmap)throw new FS.ErrnoError(43);if(!r)throw new FS.ErrnoError(28);return e.stream_ops.mmap(e,r,M,fe,$n)},msync(e,r,M,fe,$n){return e.stream_ops.msync?e.stream_ops.msync(e,r,M,fe,$n):0},ioctl(e,r,M){if(!e.stream_ops.ioctl)throw new FS.ErrnoError(59);return e.stream_ops.ioctl(e,r,M)},readFile(e,r={}){r.flags??(r.flags=0),r.encoding??(r.encoding="binary"),r.encoding!=="utf8"&&r.encoding!=="binary"&&abort(`Invalid encoding type "${r.encoding}"`);var M=FS.open(e,r.flags),fe=FS.stat(e),$n=fe.size,qn=new Uint8Array($n);return FS.read(M,qn,0,$n,0),r.encoding==="utf8"&&(qn=UTF8ArrayToString(qn)),FS.close(M),qn},writeFile(e,r,M={}){M.flags??(M.flags=577);var fe=FS.open(e,M.flags,M.mode);r=FS_fileDataToTypedArray(r),FS.write(fe,r,0,r.byteLength,void 0,M.canOwn),FS.close(fe)},cwd:()=>FS.currentPath,chdir(e){var r=FS.lookupPath(e,{follow:!0});if(r.node===null)throw new FS.ErrnoError(44);if(!FS.isDir(r.node.mode))throw new FS.ErrnoError(54);var M=FS.nodePermissions(r.node,"x");if(M)throw new FS.ErrnoError(M);FS.currentPath=r.path},createDefaultDirectories(){FS.mkdir("/tmp"),FS.mkdir("/home"),FS.mkdir("/home/web_user")},createDefaultDevices(){FS.mkdir("/dev"),FS.registerDevice(FS.makedev(1,3),{read:()=>0,write:(fe,$n,qn,jn)=>jn,llseek:()=>0}),FS.mkdev("/dev/null",FS.makedev(1,3)),TTY.register(FS.makedev(5,0),TTY.default_tty_ops),TTY.register(FS.makedev(6,0),TTY.default_tty1_ops),FS.mkdev("/dev/tty",FS.makedev(5,0)),FS.mkdev("/dev/tty1",FS.makedev(6,0));var e=new Uint8Array(1024),r=0,M=()=>(r||(randomFill(e),r=e.byteLength),e[--r]);FS.createDevice("/dev","random",M),FS.createDevice("/dev","urandom",M),FS.mkdir("/dev/shm"),FS.mkdir("/dev/shm/tmp")},createSpecialDirectories(){FS.mkdir("/proc");var e=FS.mkdir("/proc/self");FS.mkdir("/proc/self/fd"),FS.mount({mount(){var r=FS.createNode(e,"fd",16895,73);return r.stream_ops={llseek:MEMFS.stream_ops.llseek},r.node_ops={lookup(M,fe){var $n=+fe,qn=FS.getStreamChecked($n),jn={parent:null,mount:{mountpoint:"fake"},node_ops:{readlink:()=>qn.path},id:$n+1};return jn.parent=jn,jn},readdir(){return Array.from(FS.streams.entries()).filter(([M,fe])=>fe).map(([M,fe])=>M.toString())}},r}},{},"/proc/self/fd")},createStandardStreams(e,r,M){e?FS.createDevice("/dev","stdin",e):FS.symlink("/dev/tty","/dev/stdin"),r?FS.createDevice("/dev","stdout",null,r):FS.symlink("/dev/tty","/dev/stdout"),M?FS.createDevice("/dev","stderr",null,M):FS.symlink("/dev/tty1","/dev/stderr"),FS.open("/dev/stdin",0),FS.open("/dev/stdout",1),FS.open("/dev/stderr",1)},staticInit(){FS.nameTable.length=4096,FS.mount(MEMFS,{},"/"),FS.createDefaultDirectories(),FS.createDefaultDevices(),FS.createSpecialDirectories()},init(e,r,M){FS.initialized=!0,e??(e=Module.stdin),r??(r=Module.stdout),M??(M=Module.stderr),FS.createStandardStreams(e,r,M)},quit(){FS.initialized=!1,_fflush(0);for(var e of FS.streams)e&&FS.close(e)},analyzePath(e,r=!1){try{var M=FS.lookupPath(e,{follow:!r});e=M.path}catch{}var fe={isRoot:!1,exists:!1,error:0,name:null,path:null,object:null,parentExists:!1,parentPath:null,parentObject:null};try{M=FS.lookupPath(e,{parent:!0}),fe.parentExists=!0,fe.parentPath=M.path,fe.parentObject=M.node,fe.name=PATH.basename(e),M=FS.lookupPath(e,{follow:!r}),fe.exists=!0,fe.path=M.path,fe.object=M.node,fe.name=M.node.name,fe.isRoot=M.path==="/"}catch($n){fe.error=$n.errno}return fe},createPath(e,r,M,fe){e=typeof e=="string"?e:FS.getPath(e);for(var $n=r.split("/").reverse();$n.length;){var qn=$n.pop();if(qn){var jn=PATH.join2(e,qn);try{FS.mkdir(jn)}catch(Wn){if(Wn.errno!=20)throw Wn}e=jn}}return jn},createFile(e,r,M,fe,$n){var qn=PATH.join2(typeof e=="string"?e:FS.getPath(e),r),jn=FS_getMode(fe,$n);return FS.create(qn,jn)},createDataFile(e,r,M,fe,$n,qn){var jn=r;e&&(e=typeof e=="string"?e:FS.getPath(e),jn=r?PATH.join2(e,r):e);var Wn=FS_getMode(fe,$n),Yn=FS.create(jn,Wn);if(M){M=FS_fileDataToTypedArray(M),FS.chmod(Yn,Wn|146);var Xn=FS.open(Yn,577);FS.write(Xn,M,0,M.length,0,qn),FS.close(Xn),FS.chmod(Yn,Wn)}},createDevice(e,r,M,fe){var $n,qn=PATH.join2(typeof e=="string"?e:FS.getPath(e),r),jn=FS_getMode(!!M,!!fe);($n=FS.createDevice).major??($n.major=64);var Wn=FS.makedev(FS.createDevice.major++,0);return FS.registerDevice(Wn,{open(Yn){Yn.seekable=!1},close(Yn){fe?.buffer?.length&&fe(10)},read(Yn,Xn,Kn,er,nr){for(var Zn=0,rr=0;rr<er;rr++){var sr;try{sr=M()}catch{throw new FS.ErrnoError(29)}if(sr===void 0&&!Zn)throw new FS.ErrnoError(6);if(sr==null)break;Zn++,Xn[Kn+rr]=sr}return Zn&&(Yn.node.atime=Date.now()),Zn},write(Yn,Xn,Kn,er,nr){for(var Zn=0;Zn<er;Zn++)try{fe(Xn[Kn+Zn])}catch{throw new FS.ErrnoError(29)}return er&&(Yn.node.mtime=Yn.node.ctime=Date.now()),Zn}}),FS.mkdev(qn,jn,Wn)},forceLoadFile(e){if(e.isDevice||e.isFolder||e.link||e.contents)return!0;if(globalThis.XMLHttpRequest)abort("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");else try{e.contents=readBinary(e.url)}catch{throw new FS.ErrnoError(29)}},createLazyFile(e,r,M,fe,$n){class qn{constructor(){P$2(this,"lengthKnown",!1),P$2(this,"chunks",[])}get(nr){if(!(nr>this.length-1||nr<0)){var Zn=nr%this.chunkSize,rr=nr/this.chunkSize|0;return this.getter(rr)[Zn]}}setDataGetter(nr){this.getter=nr}cacheLength(){var nr=new XMLHttpRequest;nr.open("HEAD",M,!1),nr.send(null),nr.status>=200&&nr.status<300||nr.status===304||abort(`Couldn't load ${M}. Status: ${nr.status}`);var Zn=Number(nr.getResponseHeader("Content-length")),rr,sr=(rr=nr.getResponseHeader("Accept-Ranges"))&&rr==="bytes",or=(rr=nr.getResponseHeader("Content-Encoding"))&&rr==="gzip",ir=1048576;sr||(ir=Zn);var Jn=(ar,dr)=>{ar>dr&&abort(`invalid range (${ar}, ${dr}) or no bytes requested!`),dr>Zn-1&&abort(`only ${Zn} bytes available! programmer error!`);var lr=new XMLHttpRequest;return lr.open("GET",M,!1),Zn!==ir&&lr.setRequestHeader("Range",`bytes=${ar}-${dr}`),lr.responseType="arraybuffer",lr.overrideMimeType&&lr.overrideMimeType("text/plain; charset=x-user-defined"),lr.send(null),lr.status>=200&&lr.status<300||lr.status===304||abort(`Couldn't load ${M}. Status: ${lr.status}`),lr.response!==void 0?new Uint8Array(lr.response||[]):intArrayFromString(lr.responseText??"")},tr=this;tr.setDataGetter(ar=>{var dr=ar*ir,lr=(ar+1)*ir-1;return lr=Math.min(lr,Zn-1),typeof tr.chunks[ar]>"u"&&(tr.chunks[ar]=Jn(dr,lr)),typeof tr.chunks[ar]>"u"&&abort("doXHR failed!"),tr.chunks[ar]}),(or||!Zn)&&(ir=Zn=1,Zn=this.getter(0).length,ir=Zn,out("LazyFiles on gzip forces download of the whole file when length is accessed")),this._length=Zn,this._chunkSize=ir,this.lengthKnown=!0}get length(){return this.lengthKnown||this.cacheLength(),this._length}get chunkSize(){return this.lengthKnown||this.cacheLength(),this._chunkSize}}if(globalThis.XMLHttpRequest){ENVIRONMENT_IS_WORKER||abort("Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc");var jn=new qn,Wn={isDevice:!1,contents:jn}}else Wn={isDevice:!1,url:M};var Yn=FS.createFile(e,r,Wn,fe,$n);Wn.contents?Yn.contents=Wn.contents:Wn.url&&(Yn.contents=null,Yn.url=Wn.url),Object.defineProperties(Yn,{usedBytes:{get:function(){return this.contents.length}}});var Xn={};for(let[er,nr]of Object.entries(Yn.stream_ops))Xn[er]=(...Zn)=>(FS.forceLoadFile(Yn),nr(...Zn));function Kn(er,nr,Zn,rr,sr){var or=er.node.contents;if(sr>=or.length)return 0;var ir=Math.min(or.length-sr,rr);if(or.slice)for(var Jn=0;Jn<ir;Jn++)nr[Zn+Jn]=or[sr+Jn];else for(Jn=0;Jn<ir;Jn++)nr[Zn+Jn]=or.get(sr+Jn);return ir}return Xn.read=(er,nr,Zn,rr,sr)=>(FS.forceLoadFile(Yn),Kn(er,nr,Zn,rr,sr)),Xn.mmap=(er,nr,Zn)=>{FS.forceLoadFile(Yn);var rr=mmapAlloc(nr);if(!rr)throw new FS.ErrnoError(48);return Kn(er,HEAP8,rr,nr,Zn),{ptr:rr,allocated:!0}},Yn.stream_ops=Xn,Yn}},findLibraryFS=(e,r)=>{if(runtimeInitialized){if(PATH.isAbs(e))try{return FS.lookupPath(e),e}catch{return}var M=(r?.paths||[]).map(fe=>replaceORIGIN(r?.parentLibPath,fe));return withStackSave(()=>{var fe=stackAlloc(512),$n=stringToUTF8OnStack(M.join(":")),qn=stringToUTF8OnStack(e),jn=__emscripten_find_dylib(fe,$n,qn,512);return jn?UTF8ToString(jn):void 0})}};function loadDynamicLibrary(e,r={global:!0,nodelete:!0},M,fe){var $n=LDSO.loadedLibsByName[e];if($n)return r.global?$n.global||($n.global=!0,mergeLibSymbols($n.exports)):M&&Object.assign(M,$n.exports),r.nodelete&&$n.refcount!==1/0&&($n.refcount=1/0),$n.refcount++,r.loadAsync?Promise.resolve(!0):!0;$n=newDSO(e,fe,"loading"),$n.refcount=r.nodelete?1/0:1,$n.global=r.global;function qn(){var Yn,Xn=findLibraryFS(e,r.rpath);if(Xn)return Yn=FS.readFile(Xn,{encoding:"binary"}),r.loadAsync?Promise.resolve(Yn):Yn;var Kn=locateFile(e);if(r.loadAsync)return asyncLoad(Kn);if(!readBinary)throw new Error(`${Kn}: file not found, and synchronous loading of external files is not available`);return readBinary(Kn)}function jn(){var Yn=preloadedWasm[e];return Yn?r.loadAsync?Promise.resolve(Yn):Yn:r.loadAsync?qn().then(Xn=>loadWebAssemblyModule(Xn,r,e,M)):loadWebAssemblyModule(qn(),r,e,M)}function Wn(Yn){$n.global?mergeLibSymbols(Yn):M&&Object.assign(M,Yn),$n.exports=Yn}return r.loadAsync?jn().then(Yn=>(Wn(Yn),!0)):(Wn(jn()),!0)}var reportUndefinedSymbols=()=>{for(var[e,r]of Object.entries(GOT))if(r.value==-1){var M=resolveGlobalSymbol(e).sym;if(!M&&!r.required){r.value=0;continue}if(typeof M=="function")r.value=addFunction(M,M.sig);else if(typeof M=="number")r.value=M;else if(typeof M.value=="number")r.value=M;else throw new Error(`bad export type for '${e}': ${typeof M} (${M})`)}},loadDylibs=async()=>{if(!dynamicLibraries.length){reportUndefinedSymbols();return}for(var e of dynamicLibraries)await loadDynamicLibrary(e,{loadAsync:!0,global:!0,nodelete:!0,allowUndefined:!0});reportUndefinedSymbols()},noExitRuntime=!1,___call_sighandler=(e,r)=>getWasmTableEntry(e)(r);___call_sighandler.sig="vpi";var SYSCALLS={currentUmask:18,calculateAt(e,r,M=!1){if(PATH.isAbs(r))return r;var fe;if(e===-100)fe=FS.cwd();else{var $n=SYSCALLS.getStreamFromFD(e);fe=$n.path}if(r.length==0){if(!M)throw new FS.ErrnoError(44);return fe}return fe+"/"+r},writeStat(e,r){HEAPU32[e>>2]=r.dev,HEAPU32[e+4>>2]=r.mode,HEAPU32[e+8>>2]=r.nlink,HEAPU32[e+12>>2]=r.uid,HEAPU32[e+16>>2]=r.gid,HEAPU32[e+20>>2]=r.rdev,HEAP64[e+24>>3]=BigInt(r.size),HEAP32[e+32>>2]=4096,HEAP32[e+36>>2]=r.blocks;var M=r.atime.getTime(),fe=r.mtime.getTime(),$n=r.ctime.getTime();return HEAP64[e+40>>3]=BigInt(Math.floor(M/1e3)),HEAPU32[e+48>>2]=M%1e3*1e3*1e3,HEAP64[e+56>>3]=BigInt(Math.floor(fe/1e3)),HEAPU32[e+64>>2]=fe%1e3*1e3*1e3,HEAP64[e+72>>3]=BigInt(Math.floor($n/1e3)),HEAPU32[e+80>>2]=$n%1e3*1e3*1e3,HEAP64[e+88>>3]=BigInt(r.ino),0},writeStatFs(e,r){HEAPU32[e+4>>2]=r.bsize,HEAPU32[e+60>>2]=r.bsize,HEAP64[e+8>>3]=BigInt(r.blocks),HEAP64[e+16>>3]=BigInt(r.bfree),HEAP64[e+24>>3]=BigInt(r.bavail),HEAP64[e+32>>3]=BigInt(r.files),HEAP64[e+40>>3]=BigInt(r.ffree),HEAPU32[e+48>>2]=r.fsid,HEAPU32[e+64>>2]=r.flags,HEAPU32[e+56>>2]=r.namelen},doMsync(e,r,M,fe,$n){if(!FS.isFile(r.node.mode))throw new FS.ErrnoError(43);if(fe&2)return 0;var qn=HEAPU8.subarray(e,e+M);FS.msync(r,qn,$n,M,fe)},getStreamFromFD(e){var r=FS.getStreamChecked(e);return r},varargs:void 0,getStr(e){var r=UTF8ToString(e);return r}};function ___syscall_chmod(e,r){try{return e=SYSCALLS.getStr(e),FS.chmod(e,r),0}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return-M.errno}}___syscall_chmod.sig="ipi";function ___syscall_dup3(e,r,M){try{if(e===r||M&-524289)return-28;var fe=SYSCALLS.getStreamFromFD(e);if(r<0||r>=FS.MAX_OPEN_FDS)return-8;var $n=FS.getStream(r);$n&&FS.close($n);var qn=FS.dupStream(fe,r);return M&524288&&(qn.flags|=524288),qn.fd}catch(jn){if(typeof FS>"u"||jn.name!=="ErrnoError")throw jn;return-jn.errno}}___syscall_dup3.sig="iiii";function ___syscall_faccessat(e,r,M){try{if(r=SYSCALLS.getStr(r),r=SYSCALLS.calculateAt(e,r),M&-8)return-28;var fe=FS.lookupPath(r,{follow:!0}),$n=fe.node;if(!$n)return-44;var qn="";return M&4&&(qn+="r"),M&2&&(qn+="w"),M&1&&(qn+="x"),qn&&FS.nodePermissions($n,qn)?-2:0}catch(jn){if(typeof FS>"u"||jn.name!=="ErrnoError")throw jn;return-jn.errno}}___syscall_faccessat.sig="iipii";var INT53_MAX=9007199254740992,INT53_MIN=-9007199254740992,bigintToI53Checked=e=>e<INT53_MIN||e>INT53_MAX?NaN:Number(e);function ___syscall_fadvise64(e,r,M){try{return SYSCALLS.getStreamFromFD(e).seekable?0:-70}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return-fe.errno}}___syscall_fadvise64.sig="iijji";var syscallGetVarargI=()=>{var e=HEAP32[+SYSCALLS.varargs>>2];return SYSCALLS.varargs+=4,e},syscallGetVarargP=syscallGetVarargI;function ___syscall_fcntl64(e,r,M){SYSCALLS.varargs=M;try{var fe=SYSCALLS.getStreamFromFD(e);switch(r){case 0:var $n=syscallGetVarargI();if($n<0)return-28;for(;FS.streams[$n];)$n++;var qn;return qn=FS.dupStream(fe,$n),qn.fd;case 1:case 2:return 0;case 3:return fe.flags;case 4:return $n=syscallGetVarargI(),fe.flags=fe.flags&-289793|$n&289792,0;case 12:return $n=syscallGetVarargP(),HEAP16[$n+0>>1]=2,0;case 13:case 14:return 0}return-28}catch(jn){if(typeof FS>"u"||jn.name!=="ErrnoError")throw jn;return-jn.errno}}___syscall_fcntl64.sig="iiip";function ___syscall_fstat64(e,r){try{return SYSCALLS.writeStat(r,FS.fstat(e))}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return-M.errno}}___syscall_fstat64.sig="iip";function ___syscall_getcwd(e,r){try{if(!r)return-28;var M=FS.cwd(),fe=lengthBytesUTF8(M)+1;return r<fe?-68:(stringToUTF8(M,e,r),fe)}catch($n){if(typeof FS>"u"||$n.name!=="ErrnoError")throw $n;return-$n.errno}}___syscall_getcwd.sig="ipp";function ___syscall_getdents64(e,r,M){try{var fe=SYSCALLS.getStreamFromFD(e);fe.getdents||(fe.getdents=FS.readdir(fe.path));for(var $n=0,qn=FS.llseek(fe,0,1),jn=Math.floor(qn/280),Wn=Math.min(fe.getdents.length,jn+Math.floor(M/280)),Yn=jn;Yn<Wn;Yn++){var Xn,Kn,er=fe.getdents[Yn];if(er===".")Xn=fe.node.id,Kn=4;else if(er===".."){var nr=FS.lookupPath(fe.path,{parent:!0});Xn=nr.node.id,Kn=4}else{var Zn;try{Zn=FS.lookupNode(fe.node,er)}catch(rr){if(rr?.errno===28)continue;throw rr}Xn=Zn.id,Kn=FS.isChrdev(Zn.mode)?2:FS.isDir(Zn.mode)?4:FS.isLink(Zn.mode)?10:8}HEAP64[r+$n>>3]=BigInt(Xn),HEAP64[r+$n+8>>3]=BigInt((Yn+1)*280),HEAP16[r+$n+16>>1]=280,HEAP8[r+$n+18]=Kn,stringToUTF8(er,r+$n+19,256),$n+=280}return FS.llseek(fe,Yn*280,0),$n}catch(rr){if(typeof FS>"u"||rr.name!=="ErrnoError")throw rr;return-rr.errno}}___syscall_getdents64.sig="iipp";function ___syscall_ioctl(e,r,M){SYSCALLS.varargs=M;try{var fe=SYSCALLS.getStreamFromFD(e);switch(r){case 21509:return fe.tty?0:-59;case 21505:if(!fe.tty)return-59;if(fe.tty.ops.ioctl_tcgets){var $n=fe.tty.ops.ioctl_tcgets(fe),qn=syscallGetVarargP();HEAP32[qn>>2]=$n.c_iflag||0,HEAP32[qn+4>>2]=$n.c_oflag||0,HEAP32[qn+8>>2]=$n.c_cflag||0,HEAP32[qn+12>>2]=$n.c_lflag||0;for(var jn=0;jn<32;jn++)HEAP8[qn+jn+17]=$n.c_cc[jn]||0;return 0}return 0;case 21510:case 21511:case 21512:return fe.tty?0:-59;case 21506:case 21507:case 21508:if(!fe.tty)return-59;if(fe.tty.ops.ioctl_tcsets){qn=syscallGetVarargP();var Wn=HEAP32[qn>>2],Yn=HEAP32[qn+4>>2],Xn=HEAP32[qn+8>>2],Kn=HEAP32[qn+12>>2],er=[];for(jn=0;jn<32;jn++)er.push(HEAP8[qn+jn+17]);return fe.tty.ops.ioctl_tcsets(fe.tty,r,{c_iflag:Wn,c_oflag:Yn,c_cflag:Xn,c_lflag:Kn,c_cc:er})}return 0;case 21519:return fe.tty?(qn=syscallGetVarargP(),HEAP32[qn>>2]=0,0):-59;case 21520:return fe.tty?-28:-59;case 21537:case 21531:return qn=syscallGetVarargP(),FS.ioctl(fe,r,qn);case 21523:if(!fe.tty)return-59;if(fe.tty.ops.ioctl_tiocgwinsz){var nr=fe.tty.ops.ioctl_tiocgwinsz(fe.tty);qn=syscallGetVarargP(),HEAP16[qn>>1]=nr[0],HEAP16[qn+2>>1]=nr[1]}return 0;case 21524:return fe.tty?0:-59;case 21515:return fe.tty?0:-59;default:return-28}}catch(Zn){if(typeof FS>"u"||Zn.name!=="ErrnoError")throw Zn;return-Zn.errno}}___syscall_ioctl.sig="iiip";function ___syscall_lstat64(e,r){try{return e=SYSCALLS.getStr(e),SYSCALLS.writeStat(r,FS.lstat(e))}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return-M.errno}}___syscall_lstat64.sig="ipp";function ___syscall_mkdirat(e,r,M){try{return r=SYSCALLS.getStr(r),r=SYSCALLS.calculateAt(e,r),M&=~SYSCALLS.currentUmask,FS.mkdir(r,M),0}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return-fe.errno}}___syscall_mkdirat.sig="iipi";function ___syscall_newfstatat(e,r,M,fe){try{r=SYSCALLS.getStr(r);var $n=fe&256,qn=fe&4096;return fe&=-6401,r=SYSCALLS.calculateAt(e,r,qn),SYSCALLS.writeStat(M,$n?FS.lstat(r):FS.stat(r))}catch(jn){if(typeof FS>"u"||jn.name!=="ErrnoError")throw jn;return-jn.errno}}___syscall_newfstatat.sig="iippi";function ___syscall_openat(e,r,M,fe){SYSCALLS.varargs=fe;try{r=SYSCALLS.getStr(r),r=SYSCALLS.calculateAt(e,r);var $n=fe?syscallGetVarargI():0;return M&64&&($n&=~SYSCALLS.currentUmask),FS.open(r,M,$n).fd}catch(qn){if(typeof FS>"u"||qn.name!=="ErrnoError")throw qn;return-qn.errno}}___syscall_openat.sig="iipip";function ___syscall_readlinkat(e,r,M,fe){try{if(r=SYSCALLS.getStr(r),r=SYSCALLS.calculateAt(e,r),fe<=0)return-28;var $n=FS.readlink(r),qn=Math.min(fe,lengthBytesUTF8($n)),jn=HEAP8[M+qn];return stringToUTF8($n,M,fe+1),HEAP8[M+qn]=jn,qn}catch(Wn){if(typeof FS>"u"||Wn.name!=="ErrnoError")throw Wn;return-Wn.errno}}___syscall_readlinkat.sig="iippp";function ___syscall_rmdir(e){try{return e=SYSCALLS.getStr(e),FS.rmdir(e),0}catch(r){if(typeof FS>"u"||r.name!=="ErrnoError")throw r;return-r.errno}}___syscall_rmdir.sig="ip";function ___syscall_stat64(e,r){try{return e=SYSCALLS.getStr(e),SYSCALLS.writeStat(r,FS.stat(e))}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return-M.errno}}___syscall_stat64.sig="ipp";function ___syscall_symlinkat(e,r,M){try{return e=SYSCALLS.getStr(e),M=SYSCALLS.getStr(M),M=SYSCALLS.calculateAt(r,M),FS.symlink(e,M),0}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return-fe.errno}}___syscall_symlinkat.sig="ipip";function ___syscall_umask(e){try{var r=SYSCALLS.currentUmask;return SYSCALLS.currentUmask=e,r}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return-M.errno}}___syscall_umask.sig="ii";function ___syscall_unlinkat(e,r,M){try{if(r=SYSCALLS.getStr(r),r=SYSCALLS.calculateAt(e,r),!M)FS.unlink(r);else if(M===512)FS.rmdir(r);else return-28;return 0}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return-fe.errno}}___syscall_unlinkat.sig="iipi";var __abort_js=()=>abort("");__abort_js.sig="v";var runtimeKeepaliveCounter=0,__emscripten_runtime_keepalive_clear=()=>{noExitRuntime=!1,runtimeKeepaliveCounter=0};__emscripten_runtime_keepalive_clear.sig="v";var __emscripten_throw_longjmp=()=>{throw new EmscriptenSjLj};__emscripten_throw_longjmp.sig="v";var isLeapYear=e=>e%4===0&&(e%100!==0||e%400===0),MONTH_DAYS_LEAP_CUMULATIVE=[0,31,60,91,121,152,182,213,244,274,305,335],MONTH_DAYS_REGULAR_CUMULATIVE=[0,31,59,90,120,151,181,212,243,273,304,334],ydayFromDate=e=>{var r=isLeapYear(e.getFullYear()),M=r?MONTH_DAYS_LEAP_CUMULATIVE:MONTH_DAYS_REGULAR_CUMULATIVE,fe=M[e.getMonth()]+e.getDate()-1;return fe};function __localtime_js(e,r){e=bigintToI53Checked(e);var M=new Date(e*1e3);if(isNaN(M.getTime()))return 1;HEAP32[r>>2]=M.getSeconds(),HEAP32[r+4>>2]=M.getMinutes(),HEAP32[r+8>>2]=M.getHours(),HEAP32[r+12>>2]=M.getDate(),HEAP32[r+16>>2]=M.getMonth(),HEAP32[r+20>>2]=M.getFullYear()-1900,HEAP32[r+24>>2]=M.getDay();var fe=ydayFromDate(M)|0;HEAP32[r+28>>2]=fe,HEAP32[r+36>>2]=-M.getTimezoneOffset()*60;var $n=new Date(M.getFullYear(),0,1),qn=new Date(M.getFullYear(),6,1).getTimezoneOffset(),jn=$n.getTimezoneOffset(),Wn=(qn!=jn&&M.getTimezoneOffset()==Math.min(jn,qn))|0;return HEAP32[r+32>>2]=Wn,0}__localtime_js.sig="ijp";var __mktime_js=function(e){var r=(()=>{var M=new Date(HEAP32[e+20>>2]+1900,HEAP32[e+16>>2],HEAP32[e+12>>2],HEAP32[e+8>>2],HEAP32[e+4>>2],HEAP32[e>>2],0);if(isNaN(M.getTime()))return-1;var fe=HEAP32[e+32>>2],$n=M.getTimezoneOffset(),qn=new Date(M.getFullYear(),0,1),jn=new Date(M.getFullYear(),6,1).getTimezoneOffset(),Wn=qn.getTimezoneOffset(),Yn=Math.min(Wn,jn);if(fe<0)fe=+(jn!=Wn&&Yn==$n);else if(fe>0!=(Yn==$n)){var Xn=Math.max(Wn,jn),Kn=fe>0?Yn:Xn;if(M.setTime(M.getTime()+6e4*(Kn-$n)),isNaN(M.getTime()))return-1}HEAP32[e+32>>2]=fe,HEAP32[e+24>>2]=M.getDay();var er=ydayFromDate(M)|0;return HEAP32[e+28>>2]=er,HEAP32[e>>2]=M.getSeconds(),HEAP32[e+4>>2]=M.getMinutes(),HEAP32[e+8>>2]=M.getHours(),HEAP32[e+12>>2]=M.getDate(),HEAP32[e+16>>2]=M.getMonth(),HEAP32[e+20>>2]=M.getYear(),M.getTime()/1e3})();return BigInt(r)};__mktime_js.sig="jp";function __mmap_js(e,r,M,fe,$n,qn,jn){$n=bigintToI53Checked($n);try{var Wn=SYSCALLS.getStreamFromFD(fe),Yn=FS.mmap(Wn,e,$n,r,M),Xn=Yn.ptr;return HEAP32[qn>>2]=Yn.allocated,HEAPU32[jn>>2]=Xn,0}catch(Kn){if(typeof FS>"u"||Kn.name!=="ErrnoError")throw Kn;return-Kn.errno}}__mmap_js.sig="ipiiijpp";function __munmap_js(e,r,M,fe,$n,qn){qn=bigintToI53Checked(qn);try{var jn=SYSCALLS.getStreamFromFD($n);M&2&&SYSCALLS.doMsync(e,jn,r,fe,qn)}catch(Wn){if(typeof FS>"u"||Wn.name!=="ErrnoError")throw Wn;return-Wn.errno}}__munmap_js.sig="ippiiij";var timers={},clearTimers=()=>{for(var e of Object.values(timers))clearTimeout(e.id)},handleException=e=>{if(e instanceof ExitStatus||e=="unwind")return EXITSTATUS;quit_(1,e)},keepRuntimeAlive=()=>noExitRuntime||runtimeKeepaliveCounter>0,_proc_exit=e=>{EXITSTATUS=e,keepRuntimeAlive()||(Module.onExit?.(e),ABORT=!0),quit_(e,new ExitStatus(e))};_proc_exit.sig="vi";var exitJS=e=>{EXITSTATUS=e,keepRuntimeAlive()||exitRuntime(),_proc_exit(e)},_exit=exitJS;_exit.sig="vi";var maybeExit=()=>{if(!runtimeExited&&!keepRuntimeAlive())try{_exit(EXITSTATUS)}catch(e){handleException(e)}},callUserCallback=(e,...r)=>{if(!(runtimeExited||ABORT))try{return e(...r)}catch(M){handleException(M)}finally{maybeExit()}},_emscripten_get_now=()=>performance.now();_emscripten_get_now.sig="d";var __setitimer_js=(e,r)=>{if(timers[e]&&(clearTimeout(timers[e].id),delete timers[e]),!r)return 0;var M=setTimeout(()=>{delete timers[e],callUserCallback(__emscripten_timeout,e,_emscripten_get_now())},r);return timers[e]={id:M,timeout_ms:r},0};__setitimer_js.sig="iid";var __tzset_js=(e,r,M,fe)=>{var $n=new Date().getFullYear(),qn=new Date($n,0,1),jn=new Date($n,6,1),Wn=qn.getTimezoneOffset(),Yn=jn.getTimezoneOffset(),Xn=Math.max(Wn,Yn);HEAPU32[e>>2]=Xn*60,HEAP32[r>>2]=+(Wn!=Yn);var Kn=Zn=>{var rr=Zn>=0?"-":"+",sr=Math.abs(Zn),or=String(Math.floor(sr/60)).padStart(2,"0"),ir=String(sr%60).padStart(2,"0");return`UTC${rr}${or}${ir}`},er=Kn(Wn),nr=Kn(Yn);Yn<Wn?(stringToUTF8(er,M,17),stringToUTF8(nr,fe,17)):(stringToUTF8(er,fe,17),stringToUTF8(nr,M,17))};__tzset_js.sig="vpppp";var _emscripten_date_now=()=>Date.now();_emscripten_date_now.sig="d";var getHeapMax=()=>2147483648,growMemory=e=>{var r=wasmMemory.buffer.byteLength,M=(e-r+65535)/65536|0;try{return wasmMemory.grow(M),updateMemoryViews(),1}catch{}},_emscripten_resize_heap=e=>{var r=HEAPU8.length;e>>>=0;var M=getHeapMax();if(e>M)return!1;for(var fe=1;fe<=4;fe*=2){var $n=r*(1+.2/fe);$n=Math.min($n,e+100663296);var qn=Math.min(M,alignMemory(Math.max(e,$n),65536)),jn=growMemory(qn);if(jn)return!0}return!1};_emscripten_resize_heap.sig="ip";var ENV={},getExecutableName=()=>thisProgram,getEnvStrings=()=>{if(!getEnvStrings.strings){var e=(globalThis.navigator?.language??"C").replace("-","_")+".UTF-8",r={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:e,_:getExecutableName()};for(var M in ENV)ENV[M]===void 0?delete r[M]:r[M]=ENV[M];var fe=[];for(var M in r)fe.push(`${M}=${r[M]}`);getEnvStrings.strings=fe}return getEnvStrings.strings},_environ_get=(e,r)=>{var M=0,fe=0;for(var $n of getEnvStrings()){var qn=r+M;HEAPU32[e+fe>>2]=qn,M+=stringToUTF8($n,qn,1/0)+1,fe+=4}return 0};_environ_get.sig="ipp";var _environ_sizes_get=(e,r)=>{var M=getEnvStrings();HEAPU32[e>>2]=M.length;var fe=0;for(var $n of M)fe+=lengthBytesUTF8($n)+1;return HEAPU32[r>>2]=fe,0};_environ_sizes_get.sig="ipp";function _fd_close(e){try{var r=SYSCALLS.getStreamFromFD(e);return FS.close(r),0}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return M.errno}}_fd_close.sig="ii";function _fd_fdstat_get(e,r){try{var M=SYSCALLS.getStreamFromFD(e),fe=M.tty?2:FS.isDir(M.mode)?3:FS.isLink(M.mode)?7:4;return HEAP8[r]=fe,HEAP16[r+2>>1]=0,HEAP64[r+8>>3]=BigInt(0),HEAP64[r+16>>3]=BigInt(0),0}catch($n){if(typeof FS>"u"||$n.name!=="ErrnoError")throw $n;return $n.errno}}_fd_fdstat_get.sig="iip";var doReadv=(e,r,M,fe)=>{for(var $n=0,qn=0;qn<M;qn++){var jn=HEAPU32[r>>2],Wn=HEAPU32[r+4>>2];r+=8;try{var Yn=FS.read(e,HEAP8,jn,Wn,fe)}catch(Xn){if($n>0&&Xn instanceof FS.ErrnoError&&(Xn.errno==6||Xn.errno==6))break;throw Xn}if(Yn<0)return-1;if($n+=Yn,Yn<Wn)break}return $n};function _fd_read(e,r,M,fe){try{var $n=SYSCALLS.getStreamFromFD(e),qn=doReadv($n,r,M);return HEAPU32[fe>>2]=qn,0}catch(jn){if(typeof FS>"u"||jn.name!=="ErrnoError")throw jn;return jn.errno}}_fd_read.sig="iippp";function _fd_seek(e,r,M,fe){r=bigintToI53Checked(r);try{if(isNaN(r))return 22;var $n=SYSCALLS.getStreamFromFD(e);return FS.llseek($n,r,M),HEAP64[fe>>3]=BigInt($n.position),$n.getdents&&!r&&M===0&&($n.getdents=null),0}catch(qn){if(typeof FS>"u"||qn.name!=="ErrnoError")throw qn;return qn.errno}}_fd_seek.sig="iijip";function _fd_sync(e){try{var r=SYSCALLS.getStreamFromFD(e),M=r.stream_ops?.fsync?.(r);return M}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return fe.errno}}_fd_sync.sig="ii";var doWritev=(e,r,M,fe)=>{if(M==1)return FS.write(e,HEAP8,HEAPU32[r>>2],HEAPU32[r+4>>2],fe);for(var $n=0,qn=0,jn=r;qn<M;qn++,jn+=8)$n+=HEAPU32[jn+4>>2];var Wn=new Uint8Array($n),Yn=0;for(qn=0;qn<M;qn++,r+=8){var Xn=HEAPU32[r>>2],Kn=HEAPU32[r+4>>2];Wn.set(HEAPU8.subarray(Xn,Xn+Kn),Yn),Yn+=Kn}return FS.write(e,Wn,0,$n,fe)};function _fd_write(e,r,M,fe){try{var $n=SYSCALLS.getStreamFromFD(e),qn=doWritev($n,r,M);return HEAPU32[fe>>2]=qn,0}catch(jn){if(typeof FS>"u"||jn.name!=="ErrnoError")throw jn;return jn.errno}}_fd_write.sig="iippp";var inetPton4=e=>{for(var r=e.split("."),M=0;M<4;M++){var fe=Number(r[M]);if(isNaN(fe))return null;r[M]=fe}return(r[0]|r[1]<<8|r[2]<<16|r[3]<<24)>>>0},inetNtop4=e=>(e&255)+"."+(e>>8&255)+"."+(e>>16&255)+"."+(e>>24&255),inetPton6=e=>{var r,M,fe,$n,qn=[];if(!/^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i.test(e))return null;if(e==="::")return[0,0,0,0,0,0,0,0];for(e.startsWith("::")?e=e.replace("::","Z:"):e=e.replace("::",":Z:"),e.indexOf(".")>0?(e=e.replace(new RegExp("[.]","g"),":"),r=e.split(":"),r[r.length-4]=Number(r[r.length-4])+Number(r[r.length-3])*256,r[r.length-3]=Number(r[r.length-2])+Number(r[r.length-1])*256,r=r.slice(0,r.length-2)):r=e.split(":"),fe=0,$n=0,M=0;M<r.length;M++)if(typeof r[M]=="string")if(r[M]==="Z"){for($n=0;$n<8-r.length+1;$n++)qn[M+$n]=0;fe=$n-1}else qn[M+fe]=_htons(parseInt(r[M],16));else qn[M+fe]=r[M];return[qn[1]<<16|qn[0],qn[3]<<16|qn[2],qn[5]<<16|qn[4],qn[7]<<16|qn[6]]},inetNtop6=e=>{var r="",M=0,fe=0,$n=0,qn=0,jn=0,Wn=0,Yn=[e[0]&65535,e[0]>>16,e[1]&65535,e[1]>>16,e[2]&65535,e[2]>>16,e[3]&65535,e[3]>>16],Xn=!0,Kn="";for(Wn=0;Wn<5;Wn++)if(Yn[Wn]){Xn=!1;break}if(Xn){if(Kn=inetNtop4(Yn[6]|Yn[7]<<16),Yn[5]===-1)return r="::ffff:",r+=Kn,r;if(!Yn[5])return r="::",Kn==="0.0.0.0"&&(Kn=""),Kn==="0.0.0.1"&&(Kn="1"),r+=Kn,r}for(M=0;M<8;M++)Yn[M]||(M-$n>1&&(jn=0),$n=M,jn++),jn>fe&&(fe=jn,qn=M-fe+1);for(M=0;M<8;M++){if(fe>1&&!Yn[M]&&M>=qn&&M<qn+fe){M===qn&&(r+=":",qn||(r+=":"));continue}r+=Number(_ntohs(Yn[M]&65535)).toString(16),r+=M<7?":":""}return r},DNS={address_map:{id:1,addrs:{},names:{}},lookup_name(e){var r=inetPton4(e);if(r!==null||(r=inetPton6(e),r!==null))return e;var M;if(DNS.address_map.addrs[e])M=DNS.address_map.addrs[e];else{var fe=DNS.address_map.id++;M="172.29."+(fe&255)+"."+(fe&65280),DNS.address_map.names[M]=e,DNS.address_map.addrs[e]=M}return M},lookup_addr(e){return DNS.address_map.names[e]?DNS.address_map.names[e]:null}},writeSockaddr=(e,r,M,fe,$n)=>{switch(r){case 2:M=inetPton4(DNS.lookup_name(M)),zeroMemory(e,16),HEAP16[e>>1]=r,HEAP32[e+4>>2]=M,HEAP16[e+2>>1]=_htons(fe);break;case 10:M=inetPton6(DNS.lookup_name(M)),zeroMemory(e,28),HEAP32[e>>2]=r,HEAP32[e+8>>2]=M[0],HEAP32[e+12>>2]=M[1],HEAP32[e+16>>2]=M[2],HEAP32[e+20>>2]=M[3],HEAP16[e+2>>1]=_htons(fe);break;default:return 5}return 0},_getaddrinfo=(e,r,M,fe)=>{var $n=0,qn=0,jn=0,Wn=0,Yn=0,Xn=0,Kn;function er(nr,Zn,rr,sr,or,ir){var Jn,tr,ar;return tr=nr===10?28:16,or=nr===10?inetNtop6(or):inetNtop4(or),Jn=_malloc(tr),writeSockaddr(Jn,nr,or,ir),ar=_malloc(32),HEAP32[ar+4>>2]=nr,HEAP32[ar+8>>2]=Zn,HEAP32[ar+12>>2]=rr,HEAPU32[ar+24>>2]=sr,HEAPU32[ar+20>>2]=Jn,nr===10?HEAP32[ar+16>>2]=28:HEAP32[ar+16>>2]=16,HEAP32[ar+28>>2]=0,ar}if(M&&(jn=HEAP32[M>>2],Wn=HEAP32[M+4>>2],Yn=HEAP32[M+8>>2],Xn=HEAP32[M+12>>2]),Yn&&!Xn&&(Xn=Yn===2?17:6),!Yn&&Xn&&(Yn=Xn===17?2:1),Xn||(Xn=6),Yn||(Yn=1),!e&&!r)return-2;if(jn&-1088||M&&HEAP32[M>>2]&2&&!e)return-1;if(jn&32)return-2;if(Yn&&Yn!==1&&Yn!==2)return-7;if(Wn!==0&&Wn!==2&&Wn!==10)return-6;if(r&&(r=UTF8ToString(r),qn=parseInt(r,10),isNaN(qn)))return jn&1024?-2:-8;if(!e)return Wn===0&&(Wn=2),jn&1||(Wn===2?$n=_htonl(2130706433):$n=[0,0,0,_htonl(1)]),Kn=er(Wn,Yn,Xn,null,$n,qn),HEAPU32[fe>>2]=Kn,0;if(e=UTF8ToString(e),$n=inetPton4(e),$n!==null)if(Wn===0||Wn===2)Wn=2;else if(Wn===10&&jn&8)$n=[0,0,_htonl(65535),$n],Wn=10;else return-2;else if($n=inetPton6(e),$n!==null)if(Wn===0||Wn===10)Wn=10;else return-2;return $n!=null?(Kn=er(Wn,Yn,Xn,e,$n,qn),HEAPU32[fe>>2]=Kn,0):jn&4?-2:(e=DNS.lookup_name(e),$n=inetPton4(e),Wn===0?Wn=2:Wn===10&&($n=[0,0,_htonl(65535),$n]),Kn=er(Wn,Yn,Xn,null,$n,qn),HEAPU32[fe>>2]=Kn,0)};_getaddrinfo.sig="ipppp";var removeFunction=e=>{functionsInTableMap.delete(getWasmTableEntry(e)),setWasmTableEntry(e,null),freeTableIndexes.push(e)},stringToNewUTF8=e=>{var r=lengthBytesUTF8(e)+1,M=_malloc(r);return M&&stringToUTF8(e,M,r),M},FS_createPath=(...e)=>FS.createPath(...e),FS_unlink=(...e)=>FS.unlink(...e),FS_createLazyFile=(...e)=>FS.createLazyFile(...e),FS_createDevice=(...e)=>FS.createDevice(...e);registerWasmPlugin(),FS.createPreloadedFile=FS_createPreloadedFile,FS.preloadFile=FS_preloadFile,FS.staticInit(),Module.noExitRuntime&&(noExitRuntime=Module.noExitRuntime),Module.print&&(out=Module.print),Module.printErr&&(err=Module.printErr),Module.dynamicLibraries&&(dynamicLibraries=Module.dynamicLibraries),Module.arguments&&(programArgs=Module.arguments),Module.thisProgram&&(thisProgram=Module.thisProgram);var preInit=Module.preInit;if(preInit)for(typeof preInit=="function"&&(Module.preInit=preInit=[preInit]);preInit.length>0;)preInit.shift()();Module.callMain=callMain,Module.stackSave=stackSave,Module.stackRestore=stackRestore,Module.ENV=ENV,Module.addRunDependency=addRunDependency,Module.removeRunDependency=removeRunDependency,Module.addFunction=addFunction,Module.removeFunction=removeFunction,Module.UTF8ToString=UTF8ToString,Module.stringToNewUTF8=stringToNewUTF8,Module.stringToUTF8OnStack=stringToUTF8OnStack,Module.FS_preloadFile=FS_preloadFile,Module.FS_unlink=FS_unlink,Module.FS_createPath=FS_createPath,Module.FS_createDevice=FS_createDevice,Module.FS=FS,Module.FS_createDataFile=FS_createDataFile,Module.FS_createLazyFile=FS_createLazyFile,Module.MEMFS=MEMFS,Module.PROXYFS=PROXYFS;var _fflush,_malloc,_calloc,___funcs_on_exit,__emscripten_find_dylib,_htonl,_htons,_emscripten_builtin_memalign,_ntohs,__emscripten_timeout,_emscripten_get_sbrk_ptr,_setThrew,__emscripten_stack_restore,__emscripten_stack_alloc,_emscripten_stack_get_current,___heap_base,wasmTable,wasmMemory;function assignWasmExports(e){Module._pgl_exit=e.pgl_exit,Module.___errno_location=e.__errno_location,_fflush=Module._fflush=e.fflush,Module._fopen=e.fopen,Module._fclose=e.fclose,Module._pgl_popen=e.pgl_popen,Module._fputs=e.fputs,Module._main=e.__main_argc_argv,Module._pgl_atexit=e.pgl_atexit,Module._pgl_geteuid=e.pgl_geteuid,Module._pgl_system=e.pgl_system,_malloc=e.malloc,_calloc=e.calloc,Module._pgl_setsockopt=e.pgl_setsockopt,Module._pgl_connect=e.pgl_connect,Module._pgl_send=e.pgl_send,Module._pgl_recv=e.pgl_recv,Module._fgets=e.fgets,Module._pgl_getsockopt=e.pgl_getsockopt,Module._pgl_getsockname=e.pgl_getsockname,Module._pgl_poll=e.pgl_poll,Module._clear_setitimer=e.clear_setitimer,Module._pgl_longjmp=e.pgl_longjmp,Module._pgl_siglongjmp=e.pgl_siglongjmp,Module._pgl_set_system_fn=e.pgl_set_system_fn,Module._pgl_set_popen_fn=e.pgl_set_popen_fn,Module._pgl_set_pclose_fn=e.pgl_set_pclose_fn,Module._pgl_pclose=e.pgl_pclose,Module._pclose=e.pclose,Module._pgl_getuid=e.pgl_getuid,Module._pgl_getpwuid=e.pgl_getpwuid,Module._pgl_run_atexit_funcs=e.pgl_run_atexit_funcs,Module._pgl_freopen=e.pgl_freopen,Module._pgl_shmget=e.pgl_shmget,Module._pgl_shmat=e.pgl_shmat,Module._pgl_shmdt=e.pgl_shmdt,Module._pgl_shmctl=e.pgl_shmctl,Module._pgl_munmap=e.pgl_munmap,Module._pgl_set_rw_cbs=e.pgl_set_rw_cbs,Module._pgl_fcntl=e.pgl_fcntl,___funcs_on_exit=e.__funcs_on_exit,e.__dl_seterr,__emscripten_find_dylib=e._emscripten_find_dylib,_htonl=e.htonl,_htons=e.htons,_emscripten_builtin_memalign=e.emscripten_builtin_memalign,_ntohs=e.ntohs,__emscripten_timeout=e._emscripten_timeout,Module._strerror=e.strerror,_emscripten_get_sbrk_ptr=e.emscripten_get_sbrk_ptr,_setThrew=e.setThrew,__emscripten_stack_restore=e._emscripten_stack_restore,__emscripten_stack_alloc=e._emscripten_stack_alloc,_emscripten_stack_get_current=e.emscripten_stack_get_current,wasmMemory=e.memory,e.__stack_pointer,wasmTable=e.__indirect_function_table,___heap_base=e.__heap_base.value}var wasmImports={__call_sighandler:___call_sighandler,__syscall_chmod:___syscall_chmod,__syscall_dup3:___syscall_dup3,__syscall_faccessat:___syscall_faccessat,__syscall_fadvise64:___syscall_fadvise64,__syscall_fcntl64:___syscall_fcntl64,__syscall_fstat64:___syscall_fstat64,__syscall_getcwd:___syscall_getcwd,__syscall_getdents64:___syscall_getdents64,__syscall_ioctl:___syscall_ioctl,__syscall_lstat64:___syscall_lstat64,__syscall_mkdirat:___syscall_mkdirat,__syscall_newfstatat:___syscall_newfstatat,__syscall_openat:___syscall_openat,__syscall_readlinkat:___syscall_readlinkat,__syscall_rmdir:___syscall_rmdir,__syscall_stat64:___syscall_stat64,__syscall_symlinkat:___syscall_symlinkat,__syscall_umask:___syscall_umask,__syscall_unlinkat:___syscall_unlinkat,_abort_js:__abort_js,_emscripten_runtime_keepalive_clear:__emscripten_runtime_keepalive_clear,_emscripten_throw_longjmp:__emscripten_throw_longjmp,_localtime_js:__localtime_js,_mktime_js:__mktime_js,_mmap_js:__mmap_js,_munmap_js:__munmap_js,_setitimer_js:__setitimer_js,_tzset_js:__tzset_js,emscripten_date_now:_emscripten_date_now,emscripten_get_now:_emscripten_get_now,emscripten_resize_heap:_emscripten_resize_heap,environ_get:_environ_get,environ_sizes_get:_environ_sizes_get,exit:_exit,fd_close:_fd_close,fd_fdstat_get:_fd_fdstat_get,fd_read:_fd_read,fd_seek:_fd_seek,fd_sync:_fd_sync,fd_write:_fd_write,getaddrinfo:_getaddrinfo,invoke_ii,invoke_iiii,invoke_vii,proc_exit:_proc_exit};function invoke_iiii(e,r,M,fe){var $n=stackSave();try{return getWasmTableEntry(e)(r,M,fe)}catch(qn){if(stackRestore($n),!(qn instanceof EmscriptenEH))throw qn;_setThrew(1,0)}}function invoke_ii(e,r){var M=stackSave();try{return getWasmTableEntry(e)(r)}catch(fe){if(stackRestore(M),!(fe instanceof EmscriptenEH))throw fe;_setThrew(1,0)}}function invoke_vii(e,r,M){var fe=stackSave();try{getWasmTableEntry(e)(r,M)}catch($n){if(stackRestore(fe),!($n instanceof EmscriptenEH))throw $n;_setThrew(1,0)}}function callMain(e=[]){var r=resolveGlobalSymbol("main").sym;if(r){e.unshift(thisProgram);var M=e.length,fe=stackAlloc((M+1)*4),$n=fe;for(var qn of e)HEAPU32[$n>>2]=stringToUTF8OnStack(qn),$n+=4;HEAPU32[$n>>2]=0;try{var jn=r(M,fe);return exitJS(jn,!0),jn}catch(Wn){return handleException(Wn)}}}async function run(e=programArgs){preRun(),runDependencies&&await resolveRunDependencies();var r=Module.setStatus;if(r&&(r("Running..."),await new Promise(fe=>setTimeout(fe,1)),setTimeout(r,1,"")),!ABORT){initRuntime(),Module.onRuntimeInitialized?.();var M=Module.noInitialRun||!0;M||callMain(e),postRun()}}var wasmExports;return wasmExports=await createWasm(),await run(),quit_=(e,r)=>{throw r},Module}var Pe$1=br,ke$1=Pe$1;u$1();var Re="(?:"+["\\|\\|","\\&\\&",";;","\\|\\&","\\<\\(","\\<\\<\\<",">>",">\\&","<\\&","[&;()|<>]"].join("|")+")",Me$1=new RegExp("^"+Re+"$"),Oe="|&;()<> \\t",Tr='"((\\\\"|[^"])*?)"',Pr="'((\\\\'|[^'])*?)'",kr=/^#$/,De="'",Ne$1='"',oe$1="$",C="",Mr=4294967296;for(let e=0;e<4;e++)C+=(Mr*Math.random()).toString(16);function Dr(e,r){let M=r.lastIndex,fe=[],$n;for(;$n=r.exec(e);)fe.push($n),r.lastIndex===$n.index&&(r.lastIndex+=1);return r.lastIndex=M,fe}function Nr(e,r,M){let fe=typeof e=="function"?e(M):e[M];return typeof fe>"u"&&M!==""?fe="":typeof fe>"u"&&(fe="$"),typeof fe=="object"?r+C+JSON.stringify(fe)+C:r+fe}function Rr(e,r,M){M||(M={});let fe=M.escape||"\\",$n="(\\"+fe+`['"`+Oe+`]|[^\\s'"`+Oe+"])+",qn=new RegExp(["("+Re+")","("+$n+"|"+Tr+"|"+Pr+")+"].join("|"),"g"),jn=Dr(e,qn);if(jn.length===0)return[];r||(r={});let Wn=!1;return jn.map(function(Yn){let Xn=Yn[0];if(!Xn||Wn)return;if(Me$1.test(Xn))return{op:Xn};let Kn=!1,er=!1,nr="",Zn=!1,rr;function sr(){rr+=1;let or,ir,Jn=Xn.charAt(rr);if(Jn==="{"){if(rr+=1,Xn.charAt(rr)==="}")throw new Error("Bad substitution: "+Xn.slice(rr-2,rr+1));if(or=Xn.indexOf("}",rr),or<0)throw new Error("Bad substitution: "+Xn.slice(rr));ir=Xn.slice(rr,or),rr=or}else if(/[*@#?$!_-]/.test(Jn))ir=Jn,rr+=1;else{let tr=Xn.slice(rr),ar=tr.match(/[^\w\d_]/);ar?(ir=tr.slice(0,ar.index),rr+=ar.index-1):(ir=tr,rr=Xn.length)}return Nr(r,"",ir)}for(rr=0;rr<Xn.length;rr++){let or=Xn.charAt(rr);if(Zn=Zn||!Kn&&(or==="*"||or==="?"),er)nr+=or,er=!1;else if(Kn)or===Kn?Kn=!1:Kn===De?nr+=or:or===fe?(rr+=1,or=Xn.charAt(rr),or===Ne$1||or===fe||or===oe$1?nr+=or:nr+=fe+or):or===oe$1?nr+=sr():nr+=or;else if(or===Ne$1||or===De)Kn=or;else{if(Me$1.test(or))return{op:Xn};if(kr.test(or)){Wn=!0;let ir={comment:e.slice(Yn.index+rr+1)};return nr.length?[nr,ir]:[ir]}else or===fe?er=!0:or===oe$1?nr+=sr():nr+=or}}return Zn?{op:"glob",pattern:nr}:nr}).reduce(function(Yn,Xn){return typeof Xn>"u"?Yn:Yn.concat(Xn)},[])}function ae$1(e,r,M){return Rr(e,r,M)}function Ur(e,r){if(!e)throw new Error(r??"Assertion failed")}var U$1="/pglite",I=U$1+"/data",Hr=U$1+"/icu",Lr=U$1+"/bin/initdb",pt=U$1+"/bin/postgres",Ue$1=U$1+"/pgstdout",He$1=U$1+"/pgstdin";function B(e,...r){e&&e>0&&console.log("initdb: ",...r)}async function Cr({pg:e,debug:r,args:M,wasmModule:fe}){let $n,qn,jn,Wn=!1,Yn=[],Xn=0,Kn=-1,er=-1,nr="",Zn="",rr=Jn=>{let tr=Jn.shift();B(r,"initdb: firstArg",tr),Ur(tr==="/pglite/bin/postgres",`trying to execute ${tr}`),e.Module.HEAPU8.set(sr),B(r,"executing pg main with",Jn);let ar=e.callMain(Jn);return B(r,ar),Yn=[],ar},sr=e.Module.HEAPU8.slice(),or=new WebAssembly.Memory({initial:8,maximum:100}),ir=await ke$1({arguments:M,noExitRuntime:!1,wasmMemory:or,thisProgram:Lr,stdin:()=>null,print:Jn=>{Zn+=Jn,B(r,"initdbout",Jn)},printErr:Jn=>{nr+=Jn,B(r,"initdberr",Jn)},instantiateWasm:(Jn,tr)=>(p.instantiateWasm(Jn,fe??(()=>new URL("/ritestand-induction-preview/assets/initdb-BJaOLL_I.wasm",import.meta.url))).then(({instance:ar,module:dr})=>{tr(ar,dr)}),{}),locateFile:(Jn,tr)=>Jn.endsWith(".so")?"/pglite/lib/"+Jn:tr+Jn,preRun:[Jn=>{Jn.ENV.PGDATA=I,Jn.ENV.HOME="/home/postgres",Jn.ENV.USER="postgres",Jn.ENV.LOGNAME="postgres",Jn.ENV.ICU_DATA=Hr,Jn.ENV.TZ="UTC"},Jn=>{Jn.FS.mkdirTree(U$1),Jn.FS.mount(Jn.PROXYFS,{root:U$1,fs:e.Module.FS},U$1)},Jn=>{Jn.onRuntimeInitialized=()=>{$n=Jn.addFunction(tr=>(Yn=Le$1(Jn.UTF8ToString(tr)),rr(Yn)),"pi"),Jn._pgl_set_system_fn($n),qn=Jn.addFunction((tr,ar)=>{let dr=Jn.UTF8ToString(ar);if(Yn=Le$1(Jn.UTF8ToString(tr)),dr==="r")return Xn=rr(Yn),Kn;if(dr==="w")return Wn=!0,er;throw`Unexpected popen mode value ${dr}`},"ppi"),Jn._pgl_set_popen_fn(qn),jn=Jn.addFunction(tr=>tr===Kn||tr===er?(Wn&&(Wn=!1,Xn=rr(Yn)),Xn):Jn._pclose(tr),"pi"),Jn._pgl_set_pclose_fn(jn);{let tr=e.Module.stringToUTF8OnStack(He$1),ar=e.Module.stringToUTF8OnStack("r");e.Module._pgl_freopen(tr,ar,0);let dr=e.Module.stringToUTF8OnStack(Ue$1),lr=e.Module.stringToUTF8OnStack("w");e.Module._pgl_freopen(dr,lr,1)}{let tr=Jn.stringToUTF8OnStack(Ue$1),ar=Jn.stringToUTF8OnStack("r");Kn=Jn._fopen(tr,ar);let dr=Jn.stringToUTF8OnStack(He$1),lr=Jn.stringToUTF8OnStack("w");er=Jn._fopen(dr,lr)}}}]});return B(r,"calling initdb.main with",M),{exitCode:ir.callMain(M),stderr:nr,stdout:Zn,dataFolder:I}}function Le$1(e){let r=[],M=ae$1(e);for(let fe=0;fe<M.length;fe++){let $n=M[fe];if(typeof $n=="object"&&"op"in $n)break;typeof $n=="string"&&r.push($n)}return r}async function St({pg:e,debug:r,args:M,wasmModule:fe}){return await Cr({pg:e,debug:r,args:["--allow-group-access","--encoding","UTF8","--locale=C.UTF-8","--locale-provider=libc","--auth=trust",...M??[]],wasmModule:fe})}var Ce$1=class{constructor(r){this.dataDir=r}async init(r,M){return this.pg=r,{emscriptenOpts:M}}async syncToFs(r){}async initialSyncFs(){}async closeFs(){}async dumpTar(r,M){return ie$1(this.pg.Module.FS,I,r,M)}},Ie=class{constructor(e,{debug:r=!1}={}){this.dataDir=e,this.debug=r}async syncToFs(e){}async initialSyncFs(){}async closeFs(){}async dumpTar(e,r){return ie$1(this.pg.Module.FS,I,e,r)}async init(e,r){return this.pg=e,{emscriptenOpts:{...r,preRun:[...r.preRun||[],M=>{let fe=Ir(M,this);M.FS.mkdirTree(I),M.FS.mount(fe,{},I)}]}}}},xe$1={EBADF:8,EBADFD:127,EEXIST:20,EINVAL:28,EISDIR:31,ENODEV:43,ENOENT:44,ENOTDIR:54,ENOTEMPTY:55},Ir=(e,r)=>{let M=e.FS,fe=r.debug?console.log:null,$n={tryFSOperation(qn){try{return qn()}catch(jn){throw jn.code?jn.code==="UNKNOWN"?new M.ErrnoError(xe$1.EINVAL):new M.ErrnoError(jn.code):jn}},mount(qn){return $n.createNode(null,"/",16895,0)},syncfs(qn,jn,Wn){},createNode(qn,jn,Wn,Yn){if(!M.isDir(Wn)&&!M.isFile(Wn))throw new M.ErrnoError(28);let Xn=M.createNode(qn,jn,Wn);return Xn.node_ops=$n.node_ops,Xn.stream_ops=$n.stream_ops,Xn},getMode:function(qn){return fe?.("getMode",qn),$n.tryFSOperation(()=>r.lstat(qn).mode)},realPath:function(qn){let jn=[];for(;qn.parent!==qn;)jn.push(qn.name),qn=qn.parent;return jn.push(qn.mount.opts.root),jn.reverse(),jn.join("/")},node_ops:{getattr(qn){fe?.("getattr",$n.realPath(qn));let jn=$n.realPath(qn);return $n.tryFSOperation(()=>{let Wn=r.lstat(jn);return{...Wn,dev:0,ino:qn.id,nlink:1,rdev:qn.rdev,atime:new Date(Wn.atime),mtime:new Date(Wn.mtime),ctime:new Date(Wn.ctime)}})},setattr(qn,jn){fe?.("setattr",$n.realPath(qn),jn);let Wn=$n.realPath(qn);$n.tryFSOperation(()=>{if(jn.mode!==void 0&&r.chmod(Wn,jn.mode),jn.size!==void 0&&r.truncate(Wn,jn.size),jn.timestamp!==void 0&&r.utimes(Wn,jn.timestamp,jn.timestamp),jn.atime||jn.mtime){let Yn=new Date(jn.atime||jn.mtime).getTime(),Xn=new Date(jn.mtime||jn.atime).getTime();r.utimes(Wn,Yn,Xn)}jn.size!==void 0&&r.truncate(Wn,jn.size)})},lookup(qn,jn){fe?.("lookup",$n.realPath(qn),jn);let Wn=[$n.realPath(qn),jn].join("/"),Yn=$n.getMode(Wn);return $n.createNode(qn,jn,Yn)},mknod(qn,jn,Wn,Yn){fe?.("mknod",$n.realPath(qn),jn,Wn,Yn);let Xn=$n.createNode(qn,jn,Wn,Yn),Kn=$n.realPath(Xn);return $n.tryFSOperation(()=>(M.isDir(Xn.mode)?r.mkdir(Kn,{mode:Wn}):r.writeFile(Kn,"",{mode:Wn}),Xn))},rename(qn,jn,Wn){fe?.("rename",$n.realPath(qn),$n.realPath(jn),Wn);let Yn=$n.realPath(qn),Xn=[$n.realPath(jn),Wn].join("/");$n.tryFSOperation(()=>{r.rename(Yn,Xn)}),qn.name=Wn},unlink(qn,jn){fe?.("unlink",$n.realPath(qn),jn);let Wn=[$n.realPath(qn),jn].join("/");try{r.unlink(Wn)}catch{}},rmdir(qn,jn){fe?.("rmdir",$n.realPath(qn),jn);let Wn=[$n.realPath(qn),jn].join("/");return $n.tryFSOperation(()=>{r.rmdir(Wn)})},readdir(qn){fe?.("readdir",$n.realPath(qn));let jn=$n.realPath(qn);return $n.tryFSOperation(()=>r.readdir(jn))},symlink(qn,jn,Wn){throw fe?.("symlink",$n.realPath(qn),jn,Wn),new M.ErrnoError(63)},readlink(qn){throw fe?.("readlink",$n.realPath(qn)),new M.ErrnoError(63)}},stream_ops:{open(qn){fe?.("open stream",$n.realPath(qn.node));let jn=$n.realPath(qn.node);return $n.tryFSOperation(()=>{M.isFile(qn.node.mode)&&(qn.shared.refcount=1,qn.nfd=r.open(jn))})},close(qn){return fe?.("close stream",$n.realPath(qn.node)),$n.tryFSOperation(()=>{M.isFile(qn.node.mode)&&qn.nfd&&--qn.shared.refcount===0&&r.close(qn.nfd)})},dup(qn){fe?.("dup stream",$n.realPath(qn.node)),qn.shared.refcount++},read(qn,jn,Wn,Yn,Xn){return fe?.("read stream",$n.realPath(qn.node),Wn,Yn,Xn),Yn===0?0:$n.tryFSOperation(()=>r.read(qn.nfd,jn,Wn,Yn,Xn))},write(qn,jn,Wn,Yn,Xn){return fe?.("write stream",$n.realPath(qn.node),Wn,Yn,Xn),$n.tryFSOperation(()=>r.write(qn.nfd,jn.buffer,Wn,Yn,Xn))},llseek(qn,jn,Wn){fe?.("llseek stream",$n.realPath(qn.node),jn,Wn);let Yn=jn;if(Wn===1?Yn+=qn.position:Wn===2&&M.isFile(qn.node.mode)&&$n.tryFSOperation(()=>{let Xn=r.fstat(qn.nfd);Yn+=Xn.size}),Yn<0)throw new M.ErrnoError(28);return Yn},mmap(qn,jn,Wn,Yn,Xn){if(fe?.("mmap stream",$n.realPath(qn.node),jn,Wn,Yn,Xn),!M.isFile(qn.node.mode))throw new M.ErrnoError(xe$1.ENODEV);let Kn=e.mmapAlloc(jn);return $n.stream_ops.read(qn,e.HEAPU8,Kn,jn,Wn),{ptr:Kn,allocated:!0}},msync(qn,jn,Wn,Yn,Xn){return fe?.("msync stream",$n.realPath(qn.node),Wn,Yn,Xn),$n.stream_ops.write(qn,jn,0,Yn,Wn),0}}};return $n};u$1();var tt=new Error("request for lock canceled"),rt=function(e,r,M,fe){function $n(qn){return qn instanceof M?qn:new M(function(jn){jn(qn)})}return new(M||(M=Promise))(function(qn,jn){function Wn(Kn){try{Xn(fe.next(Kn))}catch(er){jn(er)}}function Yn(Kn){try{Xn(fe.throw(Kn))}catch(er){jn(er)}}function Xn(Kn){Kn.done?qn(Kn.value):$n(Kn.value).then(Wn,Yn)}Xn((fe=fe.apply(e,[])).next())})},ke=class{constructor(e,r=tt){this._value=e,this._cancelError=r,this._weightedQueues=[],this._weightedWaiters=[]}acquire(e=1){if(e<=0)throw new Error(`invalid weight ${e}: must be positive`);return new Promise((r,M)=>{this._weightedQueues[e-1]||(this._weightedQueues[e-1]=[]),this._weightedQueues[e-1].push({resolve:r,reject:M}),this._dispatch()})}runExclusive(e,r=1){return rt(this,void 0,void 0,function*(){let[M,fe]=yield this.acquire(r);try{return yield e(M)}finally{fe()}})}waitForUnlock(e=1){if(e<=0)throw new Error(`invalid weight ${e}: must be positive`);return new Promise(r=>{this._weightedWaiters[e-1]||(this._weightedWaiters[e-1]=[]),this._weightedWaiters[e-1].push(r),this._dispatch()})}isLocked(){return this._value<=0}getValue(){return this._value}setValue(e){this._value=e,this._dispatch()}release(e=1){if(e<=0)throw new Error(`invalid weight ${e}: must be positive`);this._value+=e,this._dispatch()}cancel(){this._weightedQueues.forEach(e=>e.forEach(r=>r.reject(this._cancelError))),this._weightedQueues=[]}_dispatch(){var e;for(let r=this._value;r>0;r--){let M=(e=this._weightedQueues[r-1])===null||e===void 0?void 0:e.shift();if(!M)continue;let fe=this._value,$n=r;this._value-=r,r=this._value+1,M.resolve([fe,this._newReleaser($n)])}this._drainUnlockWaiters()}_newReleaser(e){let r=!1;return()=>{r||(r=!0,this.release(e))}}_drainUnlockWaiters(){for(let e=this._value;e>0;e--)this._weightedWaiters[e-1]&&(this._weightedWaiters[e-1].forEach(r=>r()),this._weightedWaiters[e-1]=[])}},_t=function(e,r,M,fe){function $n(qn){return qn instanceof M?qn:new M(function(jn){jn(qn)})}return new(M||(M=Promise))(function(qn,jn){function Wn(Kn){try{Xn(fe.next(Kn))}catch(er){jn(er)}}function Yn(Kn){try{Xn(fe.throw(Kn))}catch(er){jn(er)}}function Xn(Kn){Kn.done?qn(Kn.value):$n(Kn.value).then(Wn,Yn)}Xn((fe=fe.apply(e,[])).next())})},V=class{constructor(e){this._semaphore=new ke(1,e)}acquire(){return _t(this,void 0,void 0,function*(){let[,e]=yield this._semaphore.acquire();return e})}runExclusive(e){return this._semaphore.runExclusive(()=>e())}isLocked(){return this._semaphore.isLocked()}waitForUnlock(){return this._semaphore.waitForUnlock()}release(){this._semaphore.isLocked()&&this._semaphore.release()}cancel(){return this._semaphore.cancel()}};u$1();var ye=class extends Ce$1{async init(e,r){return this.pg=e,{emscriptenOpts:{...r,preRun:[...r.preRun||[],M=>{let fe=M.IDBFS;M.FS.mkdirTree(`${U$1}/${this.dataDir}`),M.FS.mount(fe,{},`${U$1}/${this.dataDir}`),M.FS.symlink(`${U$1}/${this.dataDir}`,I)}]}}}initialSyncFs(){return new Promise((e,r)=>{this.pg.Module.FS.syncfs(!0,M=>{M?r(M):e()})})}syncToFs(e){return new Promise((r,M)=>{this.pg.Module.FS.syncfs(!1,fe=>{fe?M(fe):r()})})}async closeFs(){let e=this.pg.Module.IDBFS.dbs[this.dataDir];e&&e.close(),this.pg.Module.FS.quit()}};u$1();var ee=class extends Ce$1{async closeFs(){this.pg.Module.FS.quit()}};u$1();u$1();var Ne=L$1(be$1());async function Fe(e){if(p.IN_NODE){let r=await __vitePreload(()=>import("./__vite-browser-external-BIHI7g3E.js"),[]),M=await __vitePreload(()=>import("./__vite-browser-external-BIHI7g3E.js"),[]),{Writable:fe}=await __vitePreload(async()=>{const{Writable:Wn}=await import("./__vite-browser-external-BIHI7g3E.js");return{Writable:Wn}},[]),{pipeline:$n}=await __vitePreload(async()=>{const{pipeline:Wn}=await import("./__vite-browser-external-BIHI7g3E.js");return{pipeline:Wn}},[]);if(!r.existsSync(e))throw new Error(`Extension bundle not found: ${e}`);let qn=M.createGunzip(),jn=[];return await $n(r.createReadStream(e),qn,new fe({write(Wn,Yn,Xn){jn.push(Wn),Xn()}})),new Blob(jn)}else{let r=await fetch(e.toString());if(!r.ok||!r.body)return null;if(r.headers.get("Content-Encoding")==="gzip")return r.blob();{let M=new DecompressionStream("gzip");return new Response(r.body.pipeThrough(M)).blob()}}}async function Le(e,r){let M=new Array;for(let fe in e.pg_extensions){let $n;try{$n=await e.pg_extensions[fe]}catch(qn){console.error("Failed to fetch extension:",fe,qn);continue}if($n){let qn=new Uint8Array(await $n.arrayBuffer());M.push(...nt(e,fe,qn,r))}else console.error("Could not get binary data for extension:",fe)}return Promise.all(M)}function nt(e,r,M,fe){let $n=[];return Ne.default.untar(M).sort((qn,jn)=>qn.name>jn.name?1:qn.name<jn.name?-1:0).forEach(qn=>{if(qn.name.endsWith("/")){let jn=`${e.WASM_PREFIX}/${qn.name}`;e.FS.analyzePath(jn).exists===!1&&e.FS.mkdirTree(jn)}else if(!qn.name.startsWith(".")){let jn=e.WASM_PREFIX+"/"+qn.name;if(qn.name.endsWith(".so")){fe(`pgfs:ext preloading ${jn}`);let Wn=qn.name.split("/").pop(),Yn=at(jn),Xn=new Promise((Kn,er)=>{let nr=(...rr)=>{fe("pgfs:ext OK",jn,rr),Kn()},Zn=(...rr)=>{fe("pgfs:ext FAIL",jn,rr),se(e.FS,jn,qn.data),Kn()};e.FS.createPreloadedFile(Yn,Wn,qn.data,!0,!0,nr,Zn,!1)});$n.push(Xn)}else se(e.FS,jn,qn.data)}}),$n}function se(e,r,M,fe){try{let $n=r.substring(0,r.lastIndexOf("/"));e.analyzePath($n).exists===!1&&e.mkdirTree($n),e.writeFile(r,M),fe&&e.chmod(r,fe)}catch($n){throw console.error(`Error writing file ${r}`,$n),$n}}function at(e){let r=e.lastIndexOf("/");return r>0?e.slice(0,r):e}u$1();function Be(e){let r;if(e?.startsWith("file://")){if(e=e.slice(7),!e)throw new Error("Invalid dataDir, must be a valid path");r="nodefs"}else e?.startsWith("idb://")?(e=e.slice(6),r="idbfs"):e?.startsWith("opfs-ahp://")?(e=e.slice(11),r="opfs-ahp"):e?.startsWith("memfs2opfs://")?(e=e.slice(13),r="memfs2opfs"):!e||e?.startsWith("memory://")?r="memoryfs":r="nodefs";return{dataDir:e,fsType:r}}async function Ge(e,r){let M;if(e&&r==="nodefs"){let{NodeFS:fe}=await __vitePreload(()=>import("./nodefs-CSRXKdhZ.js"),__vite__mapDeps([0,1,2]));M=new fe(e)}else if(e&&r==="idbfs")M=new ye(e);else if(e&&r==="opfs-ahp"){let{OpfsAhpFS:fe}=await __vitePreload(()=>import("./opfs-ahp-D59yiVbY.js"),__vite__mapDeps([3,1,2]));M=new fe(e)}else if(e&&r==="memfs2opfs"){let{Memfs2OpfsFS:fe}=await __vitePreload(()=>import("./memfs2opfs-Dz1r7vX_.js"),__vite__mapDeps([4,1,2]));M=new fe(e)}else M=new ee;return M}u$1();u$1();async function it(moduleArg={}){var Module=moduleArg,ENVIRONMENT_IS_WEB=!!globalThis.window,ENVIRONMENT_IS_WORKER=!!globalThis.WorkerGlobalScope,ENVIRONMENT_IS_NODE=globalThis.process?.versions?.node&&globalThis.process?.type!="renderer";if(ENVIRONMENT_IS_NODE){let{createRequire:e}=await __vitePreload(()=>import("./__vite-browser-external-BIHI7g3E.js"),[]);var require=e(import.meta.url)}Module.expectedDataFileDownloads||(Module.expectedDataFileDownloads=0),Module.expectedDataFileDownloads++,(()=>{var e=typeof ENVIRONMENT_IS_PTHREAD<"u"&&ENVIRONMENT_IS_PTHREAD,r=typeof ENVIRONMENT_IS_WASM_WORKER<"u"&&ENVIRONMENT_IS_WASM_WORKER;if(!(e||r)){var M=globalThis.process&&globalThis.process.versions&&globalThis.process.versions.node&&globalThis.process.type!="renderer";(async function(fe){typeof window=="object"?window.encodeURIComponent(window.location.pathname.substring(0,window.location.pathname.lastIndexOf("/"))+"/"):typeof process>"u"&&typeof location<"u"&&encodeURIComponent(location.pathname.substring(0,location.pathname.lastIndexOf("/"))+"/");var $n=Module.locateFile?Module.locateFile("pglite.data",""):"pglite.data",qn=fe.remote_package_size,jn,Wn=Module.getPreloadedPackage&&Module.getPreloadedPackage($n,qn);Wn||(jn=(async function(Xn,Kn){if(M){var er=require("fs").readFileSync(Xn);return new Uint8Array(er).buffer}Module.dataFileDownloads||(Module.dataFileDownloads={});try{var nr=await fetch(Xn)}catch(lr){throw new Error(`Network Error: ${Xn}`,{e:lr})}if(!nr.ok)throw new Error(`${nr.status}: ${nr.url}`);let Zn=[],rr=nr.headers,sr=Number(rr.get("Content-Length")||Kn),or=0;Module.setStatus&&Module.setStatus("Downloading data...");let ir=nr.body.getReader();for(;;){var{done:Jn,value:tr}=await ir.read();if(Jn)break;Zn.push(tr),or+=tr.length,Module.dataFileDownloads[Xn]={loaded:or,total:sr};let lr=0,_r=0;for(let ur of Object.values(Module.dataFileDownloads))lr+=ur.loaded,_r+=ur.total;Module.setStatus&&Module.setStatus(`Downloading data... (${lr}/${_r})`)}let ar=new Uint8Array(Zn.map(lr=>lr.length).reduce((lr,_r)=>lr+_r,0)),dr=0;for(let lr of Zn)ar.set(lr,dr),dr+=lr.length;return ar.buffer})($n,qn));async function Yn(Xn){function Kn(er,nr){if(!er)throw new Error(nr)}Xn.FS_createPath("/","home",!0,!0),Xn.FS_createPath("/home","postgres",!0,!0),Xn.FS_createPath("/","pglite",!0,!0),Xn.FS_createPath("/pglite","bin",!0,!0),Xn.FS_createPath("/pglite","icu",!0,!0),Xn.FS_createPath("/pglite/icu","icudt76l",!0,!0),Xn.FS_createPath("/pglite/icu/icudt76l","coll",!0,!0),Xn.FS_createPath("/pglite","lib",!0,!0),Xn.FS_createPath("/pglite/lib","postgresql",!0,!0),Xn.FS_createPath("/pglite/lib/postgresql","pgxs",!0,!0),Xn.FS_createPath("/pglite/lib/postgresql/pgxs","config",!0,!0),Xn.FS_createPath("/pglite/lib/postgresql/pgxs","src",!0,!0),Xn.FS_createPath("/pglite/lib/postgresql/pgxs/src","makefiles",!0,!0),Xn.FS_createPath("/pglite/lib/postgresql/pgxs/src","test",!0,!0),Xn.FS_createPath("/pglite/lib/postgresql/pgxs/src/test","isolation",!0,!0),Xn.FS_createPath("/pglite/lib/postgresql/pgxs/src/test","regress",!0,!0),Xn.FS_createPath("/pglite","share",!0,!0),Xn.FS_createPath("/pglite/share","postgresql",!0,!0),Xn.FS_createPath("/pglite/share/postgresql","extension",!0,!0),Xn.FS_createPath("/pglite/share/postgresql","timezone",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","Africa",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","America",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone/America","Argentina",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone/America","Indiana",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone/America","Kentucky",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone/America","North_Dakota",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","Antarctica",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","Arctic",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","Asia",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","Atlantic",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","Australia",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","Brazil",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","Canada",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","Chile",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","Etc",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","Europe",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","Indian",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","Mexico",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","Pacific",!0,!0),Xn.FS_createPath("/pglite/share/postgresql/timezone","US",!0,!0),Xn.FS_createPath("/pglite/share/postgresql","timezonesets",!0,!0),Xn.FS_createPath("/pglite/share/postgresql","tsearch_data",!0,!0),Xn.addRunDependency("datafile_pglite.data"),Xn.preloadResults||(Xn.preloadResults={}),Xn.preloadResults["pglite.data"]={fromCache:!1},Wn||(Wn=await jn),await(async function(er){Kn(er,"Loading data file failed."),Kn(er.constructor.name===ArrayBuffer.name,"bad input to processPackageData "+er.constructor.name);var nr=new Uint8Array(er);for(var Zn of fe.files){var rr=Zn.filename,sr=nr.subarray(Zn.start,Zn.end);Xn.FS_createDataFile(rr,null,sr,!0,!0,!0)}Xn.removeRunDependency("datafile_pglite.data")})(Wn)}Module.FS_createPath?Yn(Module):(Module.preRun||(Module.preRun=[]),Module.preRun.push(Yn))})({files:[{filename:"/home/postgres/.pgpass",start:0,end:204},{filename:"/pglite/bin/initdb",start:204,end:223},{filename:"/pglite/bin/pg_dump",start:223,end:242},{filename:"/pglite/bin/postgres",start:242,end:261},{filename:"/pglite/icu/LICENSE",start:261,end:26748},{filename:"/pglite/icu/icudt76l/coll/root.res",start:26748,end:365756},{filename:"/pglite/icu/icudt76l/coll/ucadata.icu",start:365756,end:943260},{filename:"/pglite/lib/postgresql/cyrillic_and_mic.so",start:943260,end:947850},{filename:"/pglite/lib/postgresql/dict_snowball.so",start:947850,end:1530311},{filename:"/pglite/lib/postgresql/euc2004_sjis2004.so",start:1530311,end:1532439},{filename:"/pglite/lib/postgresql/euc_cn_and_mic.so",start:1532439,end:1533462},{filename:"/pglite/lib/postgresql/euc_jp_and_sjis.so",start:1533462,end:1540934},{filename:"/pglite/lib/postgresql/euc_kr_and_mic.so",start:1540934,end:1541977},{filename:"/pglite/lib/postgresql/euc_tw_and_big5.so",start:1541977,end:1546629},{filename:"/pglite/lib/postgresql/latin2_and_win1250.so",start:1546629,end:1548128},{filename:"/pglite/lib/postgresql/latin_and_mic.so",start:1548128,end:1549237},{filename:"/pglite/lib/postgresql/libpqwalreceiver.so",start:1549237,end:1687240},{filename:"/pglite/lib/postgresql/pgoutput.so",start:1687240,end:1701296},{filename:"/pglite/lib/postgresql/pgxs/config/install-sh",start:1701296,end:1715293},{filename:"/pglite/lib/postgresql/pgxs/config/missing",start:1715293,end:1716641},{filename:"/pglite/lib/postgresql/pgxs/src/Makefile.global",start:1716641,end:1754746},{filename:"/pglite/lib/postgresql/pgxs/src/Makefile.port",start:1754746,end:1755938},{filename:"/pglite/lib/postgresql/pgxs/src/Makefile.shlib",start:1755938,end:1770766},{filename:"/pglite/lib/postgresql/pgxs/src/makefiles/pgxs.mk",start:1770766,end:1786913},{filename:"/pglite/lib/postgresql/pgxs/src/nls-global.mk",start:1786913,end:1793977},{filename:"/pglite/lib/postgresql/pgxs/src/test/isolation/isolationtester.js",start:1793977,end:1892521},{filename:"/pglite/lib/postgresql/pgxs/src/test/isolation/pg_isolation_regress.js",start:1892521,end:1994850},{filename:"/pglite/lib/postgresql/pgxs/src/test/regress/pg_regress.js",start:1994850,end:2096602},{filename:"/pglite/lib/postgresql/plpgsql.so",start:2096602,end:2252354},{filename:"/pglite/lib/postgresql/utf8_and_big5.so",start:2252354,end:2367178},{filename:"/pglite/lib/postgresql/utf8_and_cyrillic.so",start:2367178,end:2373223},{filename:"/pglite/lib/postgresql/utf8_and_euc2004.so",start:2373223,end:2578231},{filename:"/pglite/lib/postgresql/utf8_and_euc_cn.so",start:2578231,end:2653487},{filename:"/pglite/lib/postgresql/utf8_and_euc_jp.so",start:2653487,end:2804791},{filename:"/pglite/lib/postgresql/utf8_and_euc_kr.so",start:2804791,end:2907723},{filename:"/pglite/lib/postgresql/utf8_and_euc_tw.so",start:2907723,end:3107355},{filename:"/pglite/lib/postgresql/utf8_and_gb18030.so",start:3107355,end:3369748},{filename:"/pglite/lib/postgresql/utf8_and_gbk.so",start:3369748,end:3516356},{filename:"/pglite/lib/postgresql/utf8_and_iso8859.so",start:3516356,end:3539832},{filename:"/pglite/lib/postgresql/utf8_and_iso8859_1.so",start:3539832,end:3540899},{filename:"/pglite/lib/postgresql/utf8_and_johab.so",start:3540899,end:3702679},{filename:"/pglite/lib/postgresql/utf8_and_sjis.so",start:3702679,end:3784415},{filename:"/pglite/lib/postgresql/utf8_and_sjis2004.so",start:3784415,end:3911123},{filename:"/pglite/lib/postgresql/utf8_and_uhc.so",start:3911123,end:4078471},{filename:"/pglite/lib/postgresql/utf8_and_win.so",start:4078471,end:4104908},{filename:"/pglite/locale-a",start:4104908,end:4104933},{filename:"/pglite/password",start:4104933,end:4104941},{filename:"/pglite/pgstdin",start:4104941,end:4104960},{filename:"/pglite/pgstdout",start:4104960,end:4104979},{filename:"/pglite/share/postgresql/errcodes.txt",start:4104979,end:4138718},{filename:"/pglite/share/postgresql/extension/plpgsql--1.0.sql",start:4138718,end:4139376},{filename:"/pglite/share/postgresql/extension/plpgsql.control",start:4139376,end:4139569},{filename:"/pglite/share/postgresql/information_schema.sql",start:4139569,end:4253566},{filename:"/pglite/share/postgresql/pg_hba.conf.sample",start:4253566,end:4259201},{filename:"/pglite/share/postgresql/pg_ident.conf.sample",start:4259201,end:4261882},{filename:"/pglite/share/postgresql/pg_service.conf.sample",start:4261882,end:4262486},{filename:"/pglite/share/postgresql/postgres.bki",start:4262486,end:5236255},{filename:"/pglite/share/postgresql/postgresql.conf.sample",start:5236255,end:5268907},{filename:"/pglite/share/postgresql/psqlrc.sample",start:5268907,end:5269185},{filename:"/pglite/share/postgresql/snowball_create.sql",start:5269185,end:5314895},{filename:"/pglite/share/postgresql/sql_features.txt",start:5314895,end:5350656},{filename:"/pglite/share/postgresql/system_constraints.sql",start:5350656,end:5359551},{filename:"/pglite/share/postgresql/system_functions.sql",start:5359551,end:5384430},{filename:"/pglite/share/postgresql/system_views.sql",start:5384430,end:5437794},{filename:"/pglite/share/postgresql/timezone/Africa/Abidjan",start:5437794,end:5437942},{filename:"/pglite/share/postgresql/timezone/Africa/Accra",start:5437942,end:5438090},{filename:"/pglite/share/postgresql/timezone/Africa/Addis_Ababa",start:5438090,end:5438355},{filename:"/pglite/share/postgresql/timezone/Africa/Algiers",start:5438355,end:5439090},{filename:"/pglite/share/postgresql/timezone/Africa/Asmara",start:5439090,end:5439355},{filename:"/pglite/share/postgresql/timezone/Africa/Asmera",start:5439355,end:5439620},{filename:"/pglite/share/postgresql/timezone/Africa/Bamako",start:5439620,end:5439768},{filename:"/pglite/share/postgresql/timezone/Africa/Bangui",start:5439768,end:5440003},{filename:"/pglite/share/postgresql/timezone/Africa/Banjul",start:5440003,end:5440151},{filename:"/pglite/share/postgresql/timezone/Africa/Bissau",start:5440151,end:5440345},{filename:"/pglite/share/postgresql/timezone/Africa/Blantyre",start:5440345,end:5440494},{filename:"/pglite/share/postgresql/timezone/Africa/Brazzaville",start:5440494,end:5440729},{filename:"/pglite/share/postgresql/timezone/Africa/Bujumbura",start:5440729,end:5440878},{filename:"/pglite/share/postgresql/timezone/Africa/Cairo",start:5440878,end:5443277},{filename:"/pglite/share/postgresql/timezone/Africa/Casablanca",start:5443277,end:5444491},{filename:"/pglite/share/postgresql/timezone/Africa/Ceuta",start:5444491,end:5446543},{filename:"/pglite/share/postgresql/timezone/Africa/Conakry",start:5446543,end:5446691},{filename:"/pglite/share/postgresql/timezone/Africa/Dakar",start:5446691,end:5446839},{filename:"/pglite/share/postgresql/timezone/Africa/Dar_es_Salaam",start:5446839,end:5447104},{filename:"/pglite/share/postgresql/timezone/Africa/Djibouti",start:5447104,end:5447369},{filename:"/pglite/share/postgresql/timezone/Africa/Douala",start:5447369,end:5447604},{filename:"/pglite/share/postgresql/timezone/Africa/El_Aaiun",start:5447604,end:5448684},{filename:"/pglite/share/postgresql/timezone/Africa/Freetown",start:5448684,end:5448832},{filename:"/pglite/share/postgresql/timezone/Africa/Gaborone",start:5448832,end:5448981},{filename:"/pglite/share/postgresql/timezone/Africa/Harare",start:5448981,end:5449130},{filename:"/pglite/share/postgresql/timezone/Africa/Johannesburg",start:5449130,end:5449376},{filename:"/pglite/share/postgresql/timezone/Africa/Juba",start:5449376,end:5450055},{filename:"/pglite/share/postgresql/timezone/Africa/Kampala",start:5450055,end:5450320},{filename:"/pglite/share/postgresql/timezone/Africa/Khartoum",start:5450320,end:5450999},{filename:"/pglite/share/postgresql/timezone/Africa/Kigali",start:5450999,end:5451148},{filename:"/pglite/share/postgresql/timezone/Africa/Kinshasa",start:5451148,end:5451383},{filename:"/pglite/share/postgresql/timezone/Africa/Lagos",start:5451383,end:5451618},{filename:"/pglite/share/postgresql/timezone/Africa/Libreville",start:5451618,end:5451853},{filename:"/pglite/share/postgresql/timezone/Africa/Lome",start:5451853,end:5452001},{filename:"/pglite/share/postgresql/timezone/Africa/Luanda",start:5452001,end:5452236},{filename:"/pglite/share/postgresql/timezone/Africa/Lubumbashi",start:5452236,end:5452385},{filename:"/pglite/share/postgresql/timezone/Africa/Lusaka",start:5452385,end:5452534},{filename:"/pglite/share/postgresql/timezone/Africa/Malabo",start:5452534,end:5452769},{filename:"/pglite/share/postgresql/timezone/Africa/Maputo",start:5452769,end:5452918},{filename:"/pglite/share/postgresql/timezone/Africa/Maseru",start:5452918,end:5453164},{filename:"/pglite/share/postgresql/timezone/Africa/Mbabane",start:5453164,end:5453410},{filename:"/pglite/share/postgresql/timezone/Africa/Mogadishu",start:5453410,end:5453675},{filename:"/pglite/share/postgresql/timezone/Africa/Monrovia",start:5453675,end:5453883},{filename:"/pglite/share/postgresql/timezone/Africa/Nairobi",start:5453883,end:5454148},{filename:"/pglite/share/postgresql/timezone/Africa/Ndjamena",start:5454148,end:5454347},{filename:"/pglite/share/postgresql/timezone/Africa/Niamey",start:5454347,end:5454582},{filename:"/pglite/share/postgresql/timezone/Africa/Nouakchott",start:5454582,end:5454730},{filename:"/pglite/share/postgresql/timezone/Africa/Ouagadougou",start:5454730,end:5454878},{filename:"/pglite/share/postgresql/timezone/Africa/Porto-Novo",start:5454878,end:5455113},{filename:"/pglite/share/postgresql/timezone/Africa/Sao_Tome",start:5455113,end:5455367},{filename:"/pglite/share/postgresql/timezone/Africa/Timbuktu",start:5455367,end:5455515},{filename:"/pglite/share/postgresql/timezone/Africa/Tripoli",start:5455515,end:5456140},{filename:"/pglite/share/postgresql/timezone/Africa/Tunis",start:5456140,end:5456829},{filename:"/pglite/share/postgresql/timezone/Africa/Windhoek",start:5456829,end:5457784},{filename:"/pglite/share/postgresql/timezone/America/Adak",start:5457784,end:5460140},{filename:"/pglite/share/postgresql/timezone/America/Anchorage",start:5460140,end:5462511},{filename:"/pglite/share/postgresql/timezone/America/Anguilla",start:5462511,end:5462757},{filename:"/pglite/share/postgresql/timezone/America/Antigua",start:5462757,end:5463003},{filename:"/pglite/share/postgresql/timezone/America/Araguaina",start:5463003,end:5463887},{filename:"/pglite/share/postgresql/timezone/America/Argentina/Buenos_Aires",start:5463887,end:5464963},{filename:"/pglite/share/postgresql/timezone/America/Argentina/Catamarca",start:5464963,end:5466039},{filename:"/pglite/share/postgresql/timezone/America/Argentina/ComodRivadavia",start:5466039,end:5467115},{filename:"/pglite/share/postgresql/timezone/America/Argentina/Cordoba",start:5467115,end:5468191},{filename:"/pglite/share/postgresql/timezone/America/Argentina/Jujuy",start:5468191,end:5469239},{filename:"/pglite/share/postgresql/timezone/America/Argentina/La_Rioja",start:5469239,end:5470329},{filename:"/pglite/share/postgresql/timezone/America/Argentina/Mendoza",start:5470329,end:5471405},{filename:"/pglite/share/postgresql/timezone/America/Argentina/Rio_Gallegos",start:5471405,end:5472481},{filename:"/pglite/share/postgresql/timezone/America/Argentina/Salta",start:5472481,end:5473529},{filename:"/pglite/share/postgresql/timezone/America/Argentina/San_Juan",start:5473529,end:5474619},{filename:"/pglite/share/postgresql/timezone/America/Argentina/San_Luis",start:5474619,end:5475721},{filename:"/pglite/share/postgresql/timezone/America/Argentina/Tucuman",start:5475721,end:5476825},{filename:"/pglite/share/postgresql/timezone/America/Argentina/Ushuaia",start:5476825,end:5477901},{filename:"/pglite/share/postgresql/timezone/America/Aruba",start:5477901,end:5478147},{filename:"/pglite/share/postgresql/timezone/America/Asuncion",start:5478147,end:5479805},{filename:"/pglite/share/postgresql/timezone/America/Atikokan",start:5479805,end:5479987},{filename:"/pglite/share/postgresql/timezone/America/Atka",start:5479987,end:5482343},{filename:"/pglite/share/postgresql/timezone/America/Bahia",start:5482343,end:5483367},{filename:"/pglite/share/postgresql/timezone/America/Bahia_Banderas",start:5483367,end:5484467},{filename:"/pglite/share/postgresql/timezone/America/Barbados",start:5484467,end:5484903},{filename:"/pglite/share/postgresql/timezone/America/Belem",start:5484903,end:5485479},{filename:"/pglite/share/postgresql/timezone/America/Belize",start:5485479,end:5487093},{filename:"/pglite/share/postgresql/timezone/America/Blanc-Sablon",start:5487093,end:5487339},{filename:"/pglite/share/postgresql/timezone/America/Boa_Vista",start:5487339,end:5487971},{filename:"/pglite/share/postgresql/timezone/America/Bogota",start:5487971,end:5488217},{filename:"/pglite/share/postgresql/timezone/America/Boise",start:5488217,end:5490627},{filename:"/pglite/share/postgresql/timezone/America/Buenos_Aires",start:5490627,end:5491703},{filename:"/pglite/share/postgresql/timezone/America/Cambridge_Bay",start:5491703,end:5493957},{filename:"/pglite/share/postgresql/timezone/America/Campo_Grande",start:5493957,end:5495401},{filename:"/pglite/share/postgresql/timezone/America/Cancun",start:5495401,end:5496265},{filename:"/pglite/share/postgresql/timezone/America/Caracas",start:5496265,end:5496529},{filename:"/pglite/share/postgresql/timezone/America/Catamarca",start:5496529,end:5497605},{filename:"/pglite/share/postgresql/timezone/America/Cayenne",start:5497605,end:5497803},{filename:"/pglite/share/postgresql/timezone/America/Cayman",start:5497803,end:5497985},{filename:"/pglite/share/postgresql/timezone/America/Chicago",start:5497985,end:5501577},{filename:"/pglite/share/postgresql/timezone/America/Chihuahua",start:5501577,end:5502679},{filename:"/pglite/share/postgresql/timezone/America/Ciudad_Juarez",start:5502679,end:5504217},{filename:"/pglite/share/postgresql/timezone/America/Coral_Harbour",start:5504217,end:5504399},{filename:"/pglite/share/postgresql/timezone/America/Cordoba",start:5504399,end:5505475},{filename:"/pglite/share/postgresql/timezone/America/Costa_Rica",start:5505475,end:5505791},{filename:"/pglite/share/postgresql/timezone/America/Coyhaique",start:5505791,end:5507931},{filename:"/pglite/share/postgresql/timezone/America/Creston",start:5507931,end:5508291},{filename:"/pglite/share/postgresql/timezone/America/Cuiaba",start:5508291,end:5509707},{filename:"/pglite/share/postgresql/timezone/America/Curacao",start:5509707,end:5509953},{filename:"/pglite/share/postgresql/timezone/America/Danmarkshavn",start:5509953,end:5510651},{filename:"/pglite/share/postgresql/timezone/America/Dawson",start:5510651,end:5512265},{filename:"/pglite/share/postgresql/timezone/America/Dawson_Creek",start:5512265,end:5513315},{filename:"/pglite/share/postgresql/timezone/America/Denver",start:5513315,end:5515775},{filename:"/pglite/share/postgresql/timezone/America/Detroit",start:5515775,end:5518005},{filename:"/pglite/share/postgresql/timezone/America/Dominica",start:5518005,end:5518251},{filename:"/pglite/share/postgresql/timezone/America/Edmonton",start:5518251,end:5520281},{filename:"/pglite/share/postgresql/timezone/America/Eirunepe",start:5520281,end:5520937},{filename:"/pglite/share/postgresql/timezone/America/El_Salvador",start:5520937,end:5521161},{filename:"/pglite/share/postgresql/timezone/America/Ensenada",start:5521161,end:5524067},{filename:"/pglite/share/postgresql/timezone/America/Fort_Nelson",start:5524067,end:5526307},{filename:"/pglite/share/postgresql/timezone/America/Fort_Wayne",start:5526307,end:5527989},{filename:"/pglite/share/postgresql/timezone/America/Fortaleza",start:5527989,end:5528705},{filename:"/pglite/share/postgresql/timezone/America/Glace_Bay",start:5528705,end:5530897},{filename:"/pglite/share/postgresql/timezone/America/Godthab",start:5530897,end:5532800},{filename:"/pglite/share/postgresql/timezone/America/Goose_Bay",start:5532800,end:5536010},{filename:"/pglite/share/postgresql/timezone/America/Grand_Turk",start:5536010,end:5537844},{filename:"/pglite/share/postgresql/timezone/America/Grenada",start:5537844,end:5538090},{filename:"/pglite/share/postgresql/timezone/America/Guadeloupe",start:5538090,end:5538336},{filename:"/pglite/share/postgresql/timezone/America/Guatemala",start:5538336,end:5538616},{filename:"/pglite/share/postgresql/timezone/America/Guayaquil",start:5538616,end:5538862},{filename:"/pglite/share/postgresql/timezone/America/Guyana",start:5538862,end:5539124},{filename:"/pglite/share/postgresql/timezone/America/Halifax",start:5539124,end:5542548},{filename:"/pglite/share/postgresql/timezone/America/Havana",start:5542548,end:5544964},{filename:"/pglite/share/postgresql/timezone/America/Hermosillo",start:5544964,end:5545352},{filename:"/pglite/share/postgresql/timezone/America/Indiana/Indianapolis",start:5545352,end:5547034},{filename:"/pglite/share/postgresql/timezone/America/Indiana/Knox",start:5547034,end:5549478},{filename:"/pglite/share/postgresql/timezone/America/Indiana/Marengo",start:5549478,end:5551216},{filename:"/pglite/share/postgresql/timezone/America/Indiana/Petersburg",start:5551216,end:5553136},{filename:"/pglite/share/postgresql/timezone/America/Indiana/Tell_City",start:5553136,end:5554836},{filename:"/pglite/share/postgresql/timezone/America/Indiana/Vevay",start:5554836,end:5556266},{filename:"/pglite/share/postgresql/timezone/America/Indiana/Vincennes",start:5556266,end:5557976},{filename:"/pglite/share/postgresql/timezone/America/Indiana/Winamac",start:5557976,end:5559770},{filename:"/pglite/share/postgresql/timezone/America/Indianapolis",start:5559770,end:5561452},{filename:"/pglite/share/postgresql/timezone/America/Inuvik",start:5561452,end:5563526},{filename:"/pglite/share/postgresql/timezone/America/Iqaluit",start:5563526,end:5565728},{filename:"/pglite/share/postgresql/timezone/America/Jamaica",start:5565728,end:5566210},{filename:"/pglite/share/postgresql/timezone/America/Jujuy",start:5566210,end:5567258},{filename:"/pglite/share/postgresql/timezone/America/Juneau",start:5567258,end:5569611},{filename:"/pglite/share/postgresql/timezone/America/Kentucky/Louisville",start:5569611,end:5572399},{filename:"/pglite/share/postgresql/timezone/America/Kentucky/Monticello",start:5572399,end:5574767},{filename:"/pglite/share/postgresql/timezone/America/Knox_IN",start:5574767,end:5577211},{filename:"/pglite/share/postgresql/timezone/America/Kralendijk",start:5577211,end:5577457},{filename:"/pglite/share/postgresql/timezone/America/La_Paz",start:5577457,end:5577689},{filename:"/pglite/share/postgresql/timezone/America/Lima",start:5577689,end:5578095},{filename:"/pglite/share/postgresql/timezone/America/Los_Angeles",start:5578095,end:5580947},{filename:"/pglite/share/postgresql/timezone/America/Louisville",start:5580947,end:5583735},{filename:"/pglite/share/postgresql/timezone/America/Lower_Princes",start:5583735,end:5583981},{filename:"/pglite/share/postgresql/timezone/America/Maceio",start:5583981,end:5584725},{filename:"/pglite/share/postgresql/timezone/America/Managua",start:5584725,end:5585155},{filename:"/pglite/share/postgresql/timezone/America/Manaus",start:5585155,end:5585759},{filename:"/pglite/share/postgresql/timezone/America/Marigot",start:5585759,end:5586005},{filename:"/pglite/share/postgresql/timezone/America/Martinique",start:5586005,end:5586237},{filename:"/pglite/share/postgresql/timezone/America/Matamoros",start:5586237,end:5587655},{filename:"/pglite/share/postgresql/timezone/America/Mazatlan",start:5587655,end:5588715},{filename:"/pglite/share/postgresql/timezone/America/Mendoza",start:5588715,end:5589791},{filename:"/pglite/share/postgresql/timezone/America/Menominee",start:5589791,end:5592065},{filename:"/pglite/share/postgresql/timezone/America/Merida",start:5592065,end:5593069},{filename:"/pglite/share/postgresql/timezone/America/Metlakatla",start:5593069,end:5594492},{filename:"/pglite/share/postgresql/timezone/America/Mexico_City",start:5594492,end:5595714},{filename:"/pglite/share/postgresql/timezone/America/Miquelon",start:5595714,end:5597380},{filename:"/pglite/share/postgresql/timezone/America/Moncton",start:5597380,end:5600534},{filename:"/pglite/share/postgresql/timezone/America/Monterrey",start:5600534,end:5601648},{filename:"/pglite/share/postgresql/timezone/America/Montevideo",start:5601648,end:5603158},{filename:"/pglite/share/postgresql/timezone/America/Montreal",start:5603158,end:5606652},{filename:"/pglite/share/postgresql/timezone/America/Montserrat",start:5606652,end:5606898},{filename:"/pglite/share/postgresql/timezone/America/Nassau",start:5606898,end:5610392},{filename:"/pglite/share/postgresql/timezone/America/New_York",start:5610392,end:5613944},{filename:"/pglite/share/postgresql/timezone/America/Nipigon",start:5613944,end:5617438},{filename:"/pglite/share/postgresql/timezone/America/Nome",start:5617438,end:5619805},{filename:"/pglite/share/postgresql/timezone/America/Noronha",start:5619805,end:5620521},{filename:"/pglite/share/postgresql/timezone/America/North_Dakota/Beulah",start:5620521,end:5622917},{filename:"/pglite/share/postgresql/timezone/America/North_Dakota/Center",start:5622917,end:5625313},{filename:"/pglite/share/postgresql/timezone/America/North_Dakota/New_Salem",start:5625313,end:5627709},{filename:"/pglite/share/postgresql/timezone/America/Nuuk",start:5627709,end:5629612},{filename:"/pglite/share/postgresql/timezone/America/Ojinaga",start:5629612,end:5631136},{filename:"/pglite/share/postgresql/timezone/America/Panama",start:5631136,end:5631318},{filename:"/pglite/share/postgresql/timezone/America/Pangnirtung",start:5631318,end:5633520},{filename:"/pglite/share/postgresql/timezone/America/Paramaribo",start:5633520,end:5633782},{filename:"/pglite/share/postgresql/timezone/America/Phoenix",start:5633782,end:5634142},{filename:"/pglite/share/postgresql/timezone/America/Port-au-Prince",start:5634142,end:5635576},{filename:"/pglite/share/postgresql/timezone/America/Port_of_Spain",start:5635576,end:5635822},{filename:"/pglite/share/postgresql/timezone/America/Porto_Acre",start:5635822,end:5636450},{filename:"/pglite/share/postgresql/timezone/America/Porto_Velho",start:5636450,end:5637026},{filename:"/pglite/share/postgresql/timezone/America/Puerto_Rico",start:5637026,end:5637272},{filename:"/pglite/share/postgresql/timezone/America/Punta_Arenas",start:5637272,end:5639188},{filename:"/pglite/share/postgresql/timezone/America/Rainy_River",start:5639188,end:5642056},{filename:"/pglite/share/postgresql/timezone/America/Rankin_Inlet",start:5642056,end:5644122},{filename:"/pglite/share/postgresql/timezone/America/Recife",start:5644122,end:5644838},{filename:"/pglite/share/postgresql/timezone/America/Regina",start:5644838,end:5645818},{filename:"/pglite/share/postgresql/timezone/America/Resolute",start:5645818,end:5647884},{filename:"/pglite/share/postgresql/timezone/America/Rio_Branco",start:5647884,end:5648512},{filename:"/pglite/share/postgresql/timezone/America/Rosario",start:5648512,end:5649588},{filename:"/pglite/share/postgresql/timezone/America/Santa_Isabel",start:5649588,end:5652494},{filename:"/pglite/share/postgresql/timezone/America/Santarem",start:5652494,end:5653096},{filename:"/pglite/share/postgresql/timezone/America/Santiago",start:5653096,end:5655625},{filename:"/pglite/share/postgresql/timezone/America/Santo_Domingo",start:5655625,end:5656083},{filename:"/pglite/share/postgresql/timezone/America/Sao_Paulo",start:5656083,end:5657527},{filename:"/pglite/share/postgresql/timezone/America/Scoresbysund",start:5657527,end:5659476},{filename:"/pglite/share/postgresql/timezone/America/Shiprock",start:5659476,end:5661936},{filename:"/pglite/share/postgresql/timezone/America/Sitka",start:5661936,end:5664265},{filename:"/pglite/share/postgresql/timezone/America/St_Barthelemy",start:5664265,end:5664511},{filename:"/pglite/share/postgresql/timezone/America/St_Johns",start:5664511,end:5668166},{filename:"/pglite/share/postgresql/timezone/America/St_Kitts",start:5668166,end:5668412},{filename:"/pglite/share/postgresql/timezone/America/St_Lucia",start:5668412,end:5668658},{filename:"/pglite/share/postgresql/timezone/America/St_Thomas",start:5668658,end:5668904},{filename:"/pglite/share/postgresql/timezone/America/St_Vincent",start:5668904,end:5669150},{filename:"/pglite/share/postgresql/timezone/America/Swift_Current",start:5669150,end:5669710},{filename:"/pglite/share/postgresql/timezone/America/Tegucigalpa",start:5669710,end:5669962},{filename:"/pglite/share/postgresql/timezone/America/Thule",start:5669962,end:5671464},{filename:"/pglite/share/postgresql/timezone/America/Thunder_Bay",start:5671464,end:5674958},{filename:"/pglite/share/postgresql/timezone/America/Tijuana",start:5674958,end:5677864},{filename:"/pglite/share/postgresql/timezone/America/Toronto",start:5677864,end:5681358},{filename:"/pglite/share/postgresql/timezone/America/Tortola",start:5681358,end:5681604},{filename:"/pglite/share/postgresql/timezone/America/Vancouver",start:5681604,end:5684194},{filename:"/pglite/share/postgresql/timezone/America/Virgin",start:5684194,end:5684440},{filename:"/pglite/share/postgresql/timezone/America/Whitehorse",start:5684440,end:5686054},{filename:"/pglite/share/postgresql/timezone/America/Winnipeg",start:5686054,end:5688922},{filename:"/pglite/share/postgresql/timezone/America/Yakutat",start:5688922,end:5691227},{filename:"/pglite/share/postgresql/timezone/America/Yellowknife",start:5691227,end:5693257},{filename:"/pglite/share/postgresql/timezone/Antarctica/Casey",start:5693257,end:5693694},{filename:"/pglite/share/postgresql/timezone/Antarctica/Davis",start:5693694,end:5693991},{filename:"/pglite/share/postgresql/timezone/Antarctica/DumontDUrville",start:5693991,end:5694177},{filename:"/pglite/share/postgresql/timezone/Antarctica/Macquarie",start:5694177,end:5696437},{filename:"/pglite/share/postgresql/timezone/Antarctica/Mawson",start:5696437,end:5696636},{filename:"/pglite/share/postgresql/timezone/Antarctica/McMurdo",start:5696636,end:5699073},{filename:"/pglite/share/postgresql/timezone/Antarctica/Palmer",start:5699073,end:5700491},{filename:"/pglite/share/postgresql/timezone/Antarctica/Rothera",start:5700491,end:5700655},{filename:"/pglite/share/postgresql/timezone/Antarctica/South_Pole",start:5700655,end:5703092},{filename:"/pglite/share/postgresql/timezone/Antarctica/Syowa",start:5703092,end:5703257},{filename:"/pglite/share/postgresql/timezone/Antarctica/Troll",start:5703257,end:5704419},{filename:"/pglite/share/postgresql/timezone/Antarctica/Vostok",start:5704419,end:5704646},{filename:"/pglite/share/postgresql/timezone/Arctic/Longyearbyen",start:5704646,end:5706944},{filename:"/pglite/share/postgresql/timezone/Asia/Aden",start:5706944,end:5707109},{filename:"/pglite/share/postgresql/timezone/Asia/Almaty",start:5707109,end:5708106},{filename:"/pglite/share/postgresql/timezone/Asia/Amman",start:5708106,end:5709553},{filename:"/pglite/share/postgresql/timezone/Asia/Anadyr",start:5709553,end:5710741},{filename:"/pglite/share/postgresql/timezone/Asia/Aqtau",start:5710741,end:5711724},{filename:"/pglite/share/postgresql/timezone/Asia/Aqtobe",start:5711724,end:5712735},{filename:"/pglite/share/postgresql/timezone/Asia/Ashgabat",start:5712735,end:5713354},{filename:"/pglite/share/postgresql/timezone/Asia/Ashkhabad",start:5713354,end:5713973},{filename:"/pglite/share/postgresql/timezone/Asia/Atyrau",start:5713973,end:5714964},{filename:"/pglite/share/postgresql/timezone/Asia/Baghdad",start:5714964,end:5715947},{filename:"/pglite/share/postgresql/timezone/Asia/Bahrain",start:5715947,end:5716146},{filename:"/pglite/share/postgresql/timezone/Asia/Baku",start:5716146,end:5717373},{filename:"/pglite/share/postgresql/timezone/Asia/Bangkok",start:5717373,end:5717572},{filename:"/pglite/share/postgresql/timezone/Asia/Barnaul",start:5717572,end:5718793},{filename:"/pglite/share/postgresql/timezone/Asia/Beirut",start:5718793,end:5720947},{filename:"/pglite/share/postgresql/timezone/Asia/Bishkek",start:5720947,end:5721930},{filename:"/pglite/share/postgresql/timezone/Asia/Brunei",start:5721930,end:5722413},{filename:"/pglite/share/postgresql/timezone/Asia/Calcutta",start:5722413,end:5722698},{filename:"/pglite/share/postgresql/timezone/Asia/Chita",start:5722698,end:5723919},{filename:"/pglite/share/postgresql/timezone/Asia/Choibalsan",start:5723919,end:5724810},{filename:"/pglite/share/postgresql/timezone/Asia/Chongqing",start:5724810,end:5725371},{filename:"/pglite/share/postgresql/timezone/Asia/Chungking",start:5725371,end:5725932},{filename:"/pglite/share/postgresql/timezone/Asia/Colombo",start:5725932,end:5726304},{filename:"/pglite/share/postgresql/timezone/Asia/Dacca",start:5726304,end:5726641},{filename:"/pglite/share/postgresql/timezone/Asia/Damascus",start:5726641,end:5728528},{filename:"/pglite/share/postgresql/timezone/Asia/Dhaka",start:5728528,end:5728865},{filename:"/pglite/share/postgresql/timezone/Asia/Dili",start:5728865,end:5729136},{filename:"/pglite/share/postgresql/timezone/Asia/Dubai",start:5729136,end:5729301},{filename:"/pglite/share/postgresql/timezone/Asia/Dushanbe",start:5729301,end:5729892},{filename:"/pglite/share/postgresql/timezone/Asia/Famagusta",start:5729892,end:5731920},{filename:"/pglite/share/postgresql/timezone/Asia/Gaza",start:5731920,end:5735764},{filename:"/pglite/share/postgresql/timezone/Asia/Harbin",start:5735764,end:5736325},{filename:"/pglite/share/postgresql/timezone/Asia/Hebron",start:5736325,end:5740197},{filename:"/pglite/share/postgresql/timezone/Asia/Ho_Chi_Minh",start:5740197,end:5740548},{filename:"/pglite/share/postgresql/timezone/Asia/Hong_Kong",start:5740548,end:5741781},{filename:"/pglite/share/postgresql/timezone/Asia/Hovd",start:5741781,end:5742672},{filename:"/pglite/share/postgresql/timezone/Asia/Irkutsk",start:5742672,end:5743915},{filename:"/pglite/share/postgresql/timezone/Asia/Istanbul",start:5743915,end:5745862},{filename:"/pglite/share/postgresql/timezone/Asia/Jakarta",start:5745862,end:5746245},{filename:"/pglite/share/postgresql/timezone/Asia/Jayapura",start:5746245,end:5746466},{filename:"/pglite/share/postgresql/timezone/Asia/Jerusalem",start:5746466,end:5748854},{filename:"/pglite/share/postgresql/timezone/Asia/Kabul",start:5748854,end:5749062},{filename:"/pglite/share/postgresql/timezone/Asia/Kamchatka",start:5749062,end:5750228},{filename:"/pglite/share/postgresql/timezone/Asia/Karachi",start:5750228,end:5750607},{filename:"/pglite/share/postgresql/timezone/Asia/Kashgar",start:5750607,end:5750772},{filename:"/pglite/share/postgresql/timezone/Asia/Kathmandu",start:5750772,end:5750984},{filename:"/pglite/share/postgresql/timezone/Asia/Katmandu",start:5750984,end:5751196},{filename:"/pglite/share/postgresql/timezone/Asia/Khandyga",start:5751196,end:5752467},{filename:"/pglite/share/postgresql/timezone/Asia/Kolkata",start:5752467,end:5752752},{filename:"/pglite/share/postgresql/timezone/Asia/Krasnoyarsk",start:5752752,end:5753959},{filename:"/pglite/share/postgresql/timezone/Asia/Kuala_Lumpur",start:5753959,end:5754374},{filename:"/pglite/share/postgresql/timezone/Asia/Kuching",start:5754374,end:5754857},{filename:"/pglite/share/postgresql/timezone/Asia/Kuwait",start:5754857,end:5755022},{filename:"/pglite/share/postgresql/timezone/Asia/Macao",start:5755022,end:5756249},{filename:"/pglite/share/postgresql/timezone/Asia/Macau",start:5756249,end:5757476},{filename:"/pglite/share/postgresql/timezone/Asia/Magadan",start:5757476,end:5758698},{filename:"/pglite/share/postgresql/timezone/Asia/Makassar",start:5758698,end:5758952},{filename:"/pglite/share/postgresql/timezone/Asia/Manila",start:5758952,end:5759374},{filename:"/pglite/share/postgresql/timezone/Asia/Muscat",start:5759374,end:5759539},{filename:"/pglite/share/postgresql/timezone/Asia/Nicosia",start:5759539,end:5761541},{filename:"/pglite/share/postgresql/timezone/Asia/Novokuznetsk",start:5761541,end:5762706},{filename:"/pglite/share/postgresql/timezone/Asia/Novosibirsk",start:5762706,end:5763927},{filename:"/pglite/share/postgresql/timezone/Asia/Omsk",start:5763927,end:5765134},{filename:"/pglite/share/postgresql/timezone/Asia/Oral",start:5765134,end:5766139},{filename:"/pglite/share/postgresql/timezone/Asia/Phnom_Penh",start:5766139,end:5766338},{filename:"/pglite/share/postgresql/timezone/Asia/Pontianak",start:5766338,end:5766691},{filename:"/pglite/share/postgresql/timezone/Asia/Pyongyang",start:5766691,end:5766928},{filename:"/pglite/share/postgresql/timezone/Asia/Qatar",start:5766928,end:5767127},{filename:"/pglite/share/postgresql/timezone/Asia/Qostanay",start:5767127,end:5768166},{filename:"/pglite/share/postgresql/timezone/Asia/Qyzylorda",start:5768166,end:5769191},{filename:"/pglite/share/postgresql/timezone/Asia/Rangoon",start:5769191,end:5769459},{filename:"/pglite/share/postgresql/timezone/Asia/Riyadh",start:5769459,end:5769624},{filename:"/pglite/share/postgresql/timezone/Asia/Saigon",start:5769624,end:5769975},{filename:"/pglite/share/postgresql/timezone/Asia/Sakhalin",start:5769975,end:5771177},{filename:"/pglite/share/postgresql/timezone/Asia/Samarkand",start:5771177,end:5771754},{filename:"/pglite/share/postgresql/timezone/Asia/Seoul",start:5771754,end:5772371},{filename:"/pglite/share/postgresql/timezone/Asia/Shanghai",start:5772371,end:5772932},{filename:"/pglite/share/postgresql/timezone/Asia/Singapore",start:5772932,end:5773347},{filename:"/pglite/share/postgresql/timezone/Asia/Srednekolymsk",start:5773347,end:5774555},{filename:"/pglite/share/postgresql/timezone/Asia/Taipei",start:5774555,end:5775316},{filename:"/pglite/share/postgresql/timezone/Asia/Tashkent",start:5775316,end:5775907},{filename:"/pglite/share/postgresql/timezone/Asia/Tbilisi",start:5775907,end:5776942},{filename:"/pglite/share/postgresql/timezone/Asia/Tehran",start:5776942,end:5778204},{filename:"/pglite/share/postgresql/timezone/Asia/Tel_Aviv",start:5778204,end:5780592},{filename:"/pglite/share/postgresql/timezone/Asia/Thimbu",start:5780592,end:5780795},{filename:"/pglite/share/postgresql/timezone/Asia/Thimphu",start:5780795,end:5780998},{filename:"/pglite/share/postgresql/timezone/Asia/Tokyo",start:5780998,end:5781307},{filename:"/pglite/share/postgresql/timezone/Asia/Tomsk",start:5781307,end:5782528},{filename:"/pglite/share/postgresql/timezone/Asia/Ujung_Pandang",start:5782528,end:5782782},{filename:"/pglite/share/postgresql/timezone/Asia/Ulaanbaatar",start:5782782,end:5783673},{filename:"/pglite/share/postgresql/timezone/Asia/Ulan_Bator",start:5783673,end:5784564},{filename:"/pglite/share/postgresql/timezone/Asia/Urumqi",start:5784564,end:5784729},{filename:"/pglite/share/postgresql/timezone/Asia/Ust-Nera",start:5784729,end:5785981},{filename:"/pglite/share/postgresql/timezone/Asia/Vientiane",start:5785981,end:5786180},{filename:"/pglite/share/postgresql/timezone/Asia/Vladivostok",start:5786180,end:5787388},{filename:"/pglite/share/postgresql/timezone/Asia/Yakutsk",start:5787388,end:5788595},{filename:"/pglite/share/postgresql/timezone/Asia/Yangon",start:5788595,end:5788863},{filename:"/pglite/share/postgresql/timezone/Asia/Yekaterinburg",start:5788863,end:5790106},{filename:"/pglite/share/postgresql/timezone/Asia/Yerevan",start:5790106,end:5791257},{filename:"/pglite/share/postgresql/timezone/Atlantic/Azores",start:5791257,end:5794713},{filename:"/pglite/share/postgresql/timezone/Atlantic/Bermuda",start:5794713,end:5797109},{filename:"/pglite/share/postgresql/timezone/Atlantic/Canary",start:5797109,end:5799006},{filename:"/pglite/share/postgresql/timezone/Atlantic/Cape_Verde",start:5799006,end:5799276},{filename:"/pglite/share/postgresql/timezone/Atlantic/Faeroe",start:5799276,end:5801091},{filename:"/pglite/share/postgresql/timezone/Atlantic/Faroe",start:5801091,end:5802906},{filename:"/pglite/share/postgresql/timezone/Atlantic/Jan_Mayen",start:5802906,end:5805204},{filename:"/pglite/share/postgresql/timezone/Atlantic/Madeira",start:5805204,end:5808581},{filename:"/pglite/share/postgresql/timezone/Atlantic/Reykjavik",start:5808581,end:5808729},{filename:"/pglite/share/postgresql/timezone/Atlantic/South_Georgia",start:5808729,end:5808893},{filename:"/pglite/share/postgresql/timezone/Atlantic/St_Helena",start:5808893,end:5809041},{filename:"/pglite/share/postgresql/timezone/Atlantic/Stanley",start:5809041,end:5810255},{filename:"/pglite/share/postgresql/timezone/Australia/ACT",start:5810255,end:5812445},{filename:"/pglite/share/postgresql/timezone/Australia/Adelaide",start:5812445,end:5814653},{filename:"/pglite/share/postgresql/timezone/Australia/Brisbane",start:5814653,end:5815072},{filename:"/pglite/share/postgresql/timezone/Australia/Broken_Hill",start:5815072,end:5817301},{filename:"/pglite/share/postgresql/timezone/Australia/Canberra",start:5817301,end:5819491},{filename:"/pglite/share/postgresql/timezone/Australia/Currie",start:5819491,end:5821849},{filename:"/pglite/share/postgresql/timezone/Australia/Darwin",start:5821849,end:5822174},{filename:"/pglite/share/postgresql/timezone/Australia/Eucla",start:5822174,end:5822644},{filename:"/pglite/share/postgresql/timezone/Australia/Hobart",start:5822644,end:5825002},{filename:"/pglite/share/postgresql/timezone/Australia/LHI",start:5825002,end:5826862},{filename:"/pglite/share/postgresql/timezone/Australia/Lindeman",start:5826862,end:5827337},{filename:"/pglite/share/postgresql/timezone/Australia/Lord_Howe",start:5827337,end:5829197},{filename:"/pglite/share/postgresql/timezone/Australia/Melbourne",start:5829197,end:5831387},{filename:"/pglite/share/postgresql/timezone/Australia/NSW",start:5831387,end:5833577},{filename:"/pglite/share/postgresql/timezone/Australia/North",start:5833577,end:5833902},{filename:"/pglite/share/postgresql/timezone/Australia/Perth",start:5833902,end:5834348},{filename:"/pglite/share/postgresql/timezone/Australia/Queensland",start:5834348,end:5834767},{filename:"/pglite/share/postgresql/timezone/Australia/South",start:5834767,end:5836975},{filename:"/pglite/share/postgresql/timezone/Australia/Sydney",start:5836975,end:5839165},{filename:"/pglite/share/postgresql/timezone/Australia/Tasmania",start:5839165,end:5841523},{filename:"/pglite/share/postgresql/timezone/Australia/Victoria",start:5841523,end:5843713},{filename:"/pglite/share/postgresql/timezone/Australia/West",start:5843713,end:5844159},{filename:"/pglite/share/postgresql/timezone/Australia/Yancowinna",start:5844159,end:5846388},{filename:"/pglite/share/postgresql/timezone/Brazil/Acre",start:5846388,end:5847016},{filename:"/pglite/share/postgresql/timezone/Brazil/DeNoronha",start:5847016,end:5847732},{filename:"/pglite/share/postgresql/timezone/Brazil/East",start:5847732,end:5849176},{filename:"/pglite/share/postgresql/timezone/Brazil/West",start:5849176,end:5849780},{filename:"/pglite/share/postgresql/timezone/CET",start:5849780,end:5852713},{filename:"/pglite/share/postgresql/timezone/CST6CDT",start:5852713,end:5856305},{filename:"/pglite/share/postgresql/timezone/Canada/Atlantic",start:5856305,end:5859729},{filename:"/pglite/share/postgresql/timezone/Canada/Central",start:5859729,end:5862597},{filename:"/pglite/share/postgresql/timezone/Canada/Eastern",start:5862597,end:5866091},{filename:"/pglite/share/postgresql/timezone/Canada/Mountain",start:5866091,end:5868121},{filename:"/pglite/share/postgresql/timezone/Canada/Newfoundland",start:5868121,end:5871776},{filename:"/pglite/share/postgresql/timezone/Canada/Pacific",start:5871776,end:5874366},{filename:"/pglite/share/postgresql/timezone/Canada/Saskatchewan",start:5874366,end:5875346},{filename:"/pglite/share/postgresql/timezone/Canada/Yukon",start:5875346,end:5876960},{filename:"/pglite/share/postgresql/timezone/Chile/Continental",start:5876960,end:5879489},{filename:"/pglite/share/postgresql/timezone/Chile/EasterIsland",start:5879489,end:5881722},{filename:"/pglite/share/postgresql/timezone/Cuba",start:5881722,end:5884138},{filename:"/pglite/share/postgresql/timezone/EET",start:5884138,end:5886400},{filename:"/pglite/share/postgresql/timezone/EST",start:5886400,end:5886582},{filename:"/pglite/share/postgresql/timezone/EST5EDT",start:5886582,end:5890134},{filename:"/pglite/share/postgresql/timezone/Egypt",start:5890134,end:5892533},{filename:"/pglite/share/postgresql/timezone/Eire",start:5892533,end:5896025},{filename:"/pglite/share/postgresql/timezone/Etc/GMT",start:5896025,end:5896139},{filename:"/pglite/share/postgresql/timezone/Etc/GMT+0",start:5896139,end:5896253},{filename:"/pglite/share/postgresql/timezone/Etc/GMT+1",start:5896253,end:5896369},{filename:"/pglite/share/postgresql/timezone/Etc/GMT+10",start:5896369,end:5896486},{filename:"/pglite/share/postgresql/timezone/Etc/GMT+11",start:5896486,end:5896603},{filename:"/pglite/share/postgresql/timezone/Etc/GMT+12",start:5896603,end:5896720},{filename:"/pglite/share/postgresql/timezone/Etc/GMT+2",start:5896720,end:5896836},{filename:"/pglite/share/postgresql/timezone/Etc/GMT+3",start:5896836,end:5896952},{filename:"/pglite/share/postgresql/timezone/Etc/GMT+4",start:5896952,end:5897068},{filename:"/pglite/share/postgresql/timezone/Etc/GMT+5",start:5897068,end:5897184},{filename:"/pglite/share/postgresql/timezone/Etc/GMT+6",start:5897184,end:5897300},{filename:"/pglite/share/postgresql/timezone/Etc/GMT+7",start:5897300,end:5897416},{filename:"/pglite/share/postgresql/timezone/Etc/GMT+8",start:5897416,end:5897532},{filename:"/pglite/share/postgresql/timezone/Etc/GMT+9",start:5897532,end:5897648},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-0",start:5897648,end:5897762},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-1",start:5897762,end:5897879},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-10",start:5897879,end:5897997},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-11",start:5897997,end:5898115},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-12",start:5898115,end:5898233},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-13",start:5898233,end:5898351},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-14",start:5898351,end:5898469},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-2",start:5898469,end:5898586},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-3",start:5898586,end:5898703},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-4",start:5898703,end:5898820},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-5",start:5898820,end:5898937},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-6",start:5898937,end:5899054},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-7",start:5899054,end:5899171},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-8",start:5899171,end:5899288},{filename:"/pglite/share/postgresql/timezone/Etc/GMT-9",start:5899288,end:5899405},{filename:"/pglite/share/postgresql/timezone/Etc/GMT0",start:5899405,end:5899519},{filename:"/pglite/share/postgresql/timezone/Etc/Greenwich",start:5899519,end:5899633},{filename:"/pglite/share/postgresql/timezone/Etc/UCT",start:5899633,end:5899747},{filename:"/pglite/share/postgresql/timezone/Etc/UTC",start:5899747,end:5899861},{filename:"/pglite/share/postgresql/timezone/Etc/Universal",start:5899861,end:5899975},{filename:"/pglite/share/postgresql/timezone/Etc/Zulu",start:5899975,end:5900089},{filename:"/pglite/share/postgresql/timezone/Europe/Amsterdam",start:5900089,end:5903022},{filename:"/pglite/share/postgresql/timezone/Europe/Andorra",start:5903022,end:5904764},{filename:"/pglite/share/postgresql/timezone/Europe/Astrakhan",start:5904764,end:5905929},{filename:"/pglite/share/postgresql/timezone/Europe/Athens",start:5905929,end:5908191},{filename:"/pglite/share/postgresql/timezone/Europe/Belfast",start:5908191,end:5911855},{filename:"/pglite/share/postgresql/timezone/Europe/Belgrade",start:5911855,end:5913775},{filename:"/pglite/share/postgresql/timezone/Europe/Berlin",start:5913775,end:5916073},{filename:"/pglite/share/postgresql/timezone/Europe/Bratislava",start:5916073,end:5918374},{filename:"/pglite/share/postgresql/timezone/Europe/Brussels",start:5918374,end:5921307},{filename:"/pglite/share/postgresql/timezone/Europe/Bucharest",start:5921307,end:5923491},{filename:"/pglite/share/postgresql/timezone/Europe/Budapest",start:5923491,end:5925859},{filename:"/pglite/share/postgresql/timezone/Europe/Busingen",start:5925859,end:5927768},{filename:"/pglite/share/postgresql/timezone/Europe/Chisinau",start:5927768,end:5930192},{filename:"/pglite/share/postgresql/timezone/Europe/Copenhagen",start:5930192,end:5932490},{filename:"/pglite/share/postgresql/timezone/Europe/Dublin",start:5932490,end:5935982},{filename:"/pglite/share/postgresql/timezone/Europe/Gibraltar",start:5935982,end:5939050},{filename:"/pglite/share/postgresql/timezone/Europe/Guernsey",start:5939050,end:5942714},{filename:"/pglite/share/postgresql/timezone/Europe/Helsinki",start:5942714,end:5944614},{filename:"/pglite/share/postgresql/timezone/Europe/Isle_of_Man",start:5944614,end:5948278},{filename:"/pglite/share/postgresql/timezone/Europe/Istanbul",start:5948278,end:5950225},{filename:"/pglite/share/postgresql/timezone/Europe/Jersey",start:5950225,end:5953889},{filename:"/pglite/share/postgresql/timezone/Europe/Kaliningrad",start:5953889,end:5955382},{filename:"/pglite/share/postgresql/timezone/Europe/Kiev",start:5955382,end:5957502},{filename:"/pglite/share/postgresql/timezone/Europe/Kirov",start:5957502,end:5958687},{filename:"/pglite/share/postgresql/timezone/Europe/Kyiv",start:5958687,end:5960807},{filename:"/pglite/share/postgresql/timezone/Europe/Lisbon",start:5960807,end:5964334},{filename:"/pglite/share/postgresql/timezone/Europe/Ljubljana",start:5964334,end:5966254},{filename:"/pglite/share/postgresql/timezone/Europe/London",start:5966254,end:5969918},{filename:"/pglite/share/postgresql/timezone/Europe/Luxembourg",start:5969918,end:5972851},{filename:"/pglite/share/postgresql/timezone/Europe/Madrid",start:5972851,end:5975465},{filename:"/pglite/share/postgresql/timezone/Europe/Malta",start:5975465,end:5978085},{filename:"/pglite/share/postgresql/timezone/Europe/Mariehamn",start:5978085,end:5979985},{filename:"/pglite/share/postgresql/timezone/Europe/Minsk",start:5979985,end:5981306},{filename:"/pglite/share/postgresql/timezone/Europe/Monaco",start:5981306,end:5984268},{filename:"/pglite/share/postgresql/timezone/Europe/Moscow",start:5984268,end:5985803},{filename:"/pglite/share/postgresql/timezone/Europe/Nicosia",start:5985803,end:5987805},{filename:"/pglite/share/postgresql/timezone/Europe/Oslo",start:5987805,end:5990103},{filename:"/pglite/share/postgresql/timezone/Europe/Paris",start:5990103,end:5993065},{filename:"/pglite/share/postgresql/timezone/Europe/Podgorica",start:5993065,end:5994985},{filename:"/pglite/share/postgresql/timezone/Europe/Prague",start:5994985,end:5997286},{filename:"/pglite/share/postgresql/timezone/Europe/Riga",start:5997286,end:5999484},{filename:"/pglite/share/postgresql/timezone/Europe/Rome",start:5999484,end:6002125},{filename:"/pglite/share/postgresql/timezone/Europe/Samara",start:6002125,end:6003340},{filename:"/pglite/share/postgresql/timezone/Europe/San_Marino",start:6003340,end:6005981},{filename:"/pglite/share/postgresql/timezone/Europe/Sarajevo",start:6005981,end:6007901},{filename:"/pglite/share/postgresql/timezone/Europe/Saratov",start:6007901,end:6009084},{filename:"/pglite/share/postgresql/timezone/Europe/Simferopol",start:6009084,end:6010553},{filename:"/pglite/share/postgresql/timezone/Europe/Skopje",start:6010553,end:6012473},{filename:"/pglite/share/postgresql/timezone/Europe/Sofia",start:6012473,end:6014550},{filename:"/pglite/share/postgresql/timezone/Europe/Stockholm",start:6014550,end:6016848},{filename:"/pglite/share/postgresql/timezone/Europe/Tallinn",start:6016848,end:6018996},{filename:"/pglite/share/postgresql/timezone/Europe/Tirane",start:6018996,end:6021080},{filename:"/pglite/share/postgresql/timezone/Europe/Tiraspol",start:6021080,end:6023504},{filename:"/pglite/share/postgresql/timezone/Europe/Ulyanovsk",start:6023504,end:6024771},{filename:"/pglite/share/postgresql/timezone/Europe/Uzhgorod",start:6024771,end:6026891},{filename:"/pglite/share/postgresql/timezone/Europe/Vaduz",start:6026891,end:6028800},{filename:"/pglite/share/postgresql/timezone/Europe/Vatican",start:6028800,end:6031441},{filename:"/pglite/share/postgresql/timezone/Europe/Vienna",start:6031441,end:6033641},{filename:"/pglite/share/postgresql/timezone/Europe/Vilnius",start:6033641,end:6035803},{filename:"/pglite/share/postgresql/timezone/Europe/Volgograd",start:6035803,end:6036996},{filename:"/pglite/share/postgresql/timezone/Europe/Warsaw",start:6036996,end:6039650},{filename:"/pglite/share/postgresql/timezone/Europe/Zagreb",start:6039650,end:6041570},{filename:"/pglite/share/postgresql/timezone/Europe/Zaporozhye",start:6041570,end:6043690},{filename:"/pglite/share/postgresql/timezone/Europe/Zurich",start:6043690,end:6045599},{filename:"/pglite/share/postgresql/timezone/Factory",start:6045599,end:6045715},{filename:"/pglite/share/postgresql/timezone/GB",start:6045715,end:6049379},{filename:"/pglite/share/postgresql/timezone/GB-Eire",start:6049379,end:6053043},{filename:"/pglite/share/postgresql/timezone/GMT",start:6053043,end:6053157},{filename:"/pglite/share/postgresql/timezone/GMT+0",start:6053157,end:6053271},{filename:"/pglite/share/postgresql/timezone/GMT-0",start:6053271,end:6053385},{filename:"/pglite/share/postgresql/timezone/GMT0",start:6053385,end:6053499},{filename:"/pglite/share/postgresql/timezone/Greenwich",start:6053499,end:6053613},{filename:"/pglite/share/postgresql/timezone/HST",start:6053613,end:6053942},{filename:"/pglite/share/postgresql/timezone/Hongkong",start:6053942,end:6055175},{filename:"/pglite/share/postgresql/timezone/Iceland",start:6055175,end:6055323},{filename:"/pglite/share/postgresql/timezone/Indian/Antananarivo",start:6055323,end:6055588},{filename:"/pglite/share/postgresql/timezone/Indian/Chagos",start:6055588,end:6055787},{filename:"/pglite/share/postgresql/timezone/Indian/Christmas",start:6055787,end:6055986},{filename:"/pglite/share/postgresql/timezone/Indian/Cocos",start:6055986,end:6056254},{filename:"/pglite/share/postgresql/timezone/Indian/Comoro",start:6056254,end:6056519},{filename:"/pglite/share/postgresql/timezone/Indian/Kerguelen",start:6056519,end:6056718},{filename:"/pglite/share/postgresql/timezone/Indian/Mahe",start:6056718,end:6056883},{filename:"/pglite/share/postgresql/timezone/Indian/Maldives",start:6056883,end:6057082},{filename:"/pglite/share/postgresql/timezone/Indian/Mauritius",start:6057082,end:6057323},{filename:"/pglite/share/postgresql/timezone/Indian/Mayotte",start:6057323,end:6057588},{filename:"/pglite/share/postgresql/timezone/Indian/Reunion",start:6057588,end:6057753},{filename:"/pglite/share/postgresql/timezone/Iran",start:6057753,end:6059015},{filename:"/pglite/share/postgresql/timezone/Israel",start:6059015,end:6061403},{filename:"/pglite/share/postgresql/timezone/Jamaica",start:6061403,end:6061885},{filename:"/pglite/share/postgresql/timezone/Japan",start:6061885,end:6062194},{filename:"/pglite/share/postgresql/timezone/Kwajalein",start:6062194,end:6062510},{filename:"/pglite/share/postgresql/timezone/Libya",start:6062510,end:6063135},{filename:"/pglite/share/postgresql/timezone/MET",start:6063135,end:6066068},{filename:"/pglite/share/postgresql/timezone/MST",start:6066068,end:6066428},{filename:"/pglite/share/postgresql/timezone/MST7MDT",start:6066428,end:6068888},{filename:"/pglite/share/postgresql/timezone/Mexico/BajaNorte",start:6068888,end:6071794},{filename:"/pglite/share/postgresql/timezone/Mexico/BajaSur",start:6071794,end:6072854},{filename:"/pglite/share/postgresql/timezone/Mexico/General",start:6072854,end:6074076},{filename:"/pglite/share/postgresql/timezone/NZ",start:6074076,end:6076513},{filename:"/pglite/share/postgresql/timezone/NZ-CHAT",start:6076513,end:6078581},{filename:"/pglite/share/postgresql/timezone/Navajo",start:6078581,end:6081041},{filename:"/pglite/share/postgresql/timezone/PRC",start:6081041,end:6081602},{filename:"/pglite/share/postgresql/timezone/PST8PDT",start:6081602,end:6084454},{filename:"/pglite/share/postgresql/timezone/Pacific/Apia",start:6084454,end:6085066},{filename:"/pglite/share/postgresql/timezone/Pacific/Auckland",start:6085066,end:6087503},{filename:"/pglite/share/postgresql/timezone/Pacific/Bougainville",start:6087503,end:6087771},{filename:"/pglite/share/postgresql/timezone/Pacific/Chatham",start:6087771,end:6089839},{filename:"/pglite/share/postgresql/timezone/Pacific/Chuuk",start:6089839,end:6090025},{filename:"/pglite/share/postgresql/timezone/Pacific/Easter",start:6090025,end:6092258},{filename:"/pglite/share/postgresql/timezone/Pacific/Efate",start:6092258,end:6092796},{filename:"/pglite/share/postgresql/timezone/Pacific/Enderbury",start:6092796,end:6093030},{filename:"/pglite/share/postgresql/timezone/Pacific/Fakaofo",start:6093030,end:6093230},{filename:"/pglite/share/postgresql/timezone/Pacific/Fiji",start:6093230,end:6093808},{filename:"/pglite/share/postgresql/timezone/Pacific/Funafuti",start:6093808,end:6093974},{filename:"/pglite/share/postgresql/timezone/Pacific/Galapagos",start:6093974,end:6094212},{filename:"/pglite/share/postgresql/timezone/Pacific/Gambier",start:6094212,end:6094376},{filename:"/pglite/share/postgresql/timezone/Pacific/Guadalcanal",start:6094376,end:6094542},{filename:"/pglite/share/postgresql/timezone/Pacific/Guam",start:6094542,end:6095036},{filename:"/pglite/share/postgresql/timezone/Pacific/Honolulu",start:6095036,end:6095365},{filename:"/pglite/share/postgresql/timezone/Pacific/Johnston",start:6095365,end:6095694},{filename:"/pglite/share/postgresql/timezone/Pacific/Kanton",start:6095694,end:6095928},{filename:"/pglite/share/postgresql/timezone/Pacific/Kiritimati",start:6095928,end:6096166},{filename:"/pglite/share/postgresql/timezone/Pacific/Kosrae",start:6096166,end:6096517},{filename:"/pglite/share/postgresql/timezone/Pacific/Kwajalein",start:6096517,end:6096833},{filename:"/pglite/share/postgresql/timezone/Pacific/Majuro",start:6096833,end:6096999},{filename:"/pglite/share/postgresql/timezone/Pacific/Marquesas",start:6096999,end:6097172},{filename:"/pglite/share/postgresql/timezone/Pacific/Midway",start:6097172,end:6097347},{filename:"/pglite/share/postgresql/timezone/Pacific/Nauru",start:6097347,end:6097599},{filename:"/pglite/share/postgresql/timezone/Pacific/Niue",start:6097599,end:6097802},{filename:"/pglite/share/postgresql/timezone/Pacific/Norfolk",start:6097802,end:6098682},{filename:"/pglite/share/postgresql/timezone/Pacific/Noumea",start:6098682,end:6098986},{filename:"/pglite/share/postgresql/timezone/Pacific/Pago_Pago",start:6098986,end:6099161},{filename:"/pglite/share/postgresql/timezone/Pacific/Palau",start:6099161,end:6099341},{filename:"/pglite/share/postgresql/timezone/Pacific/Pitcairn",start:6099341,end:6099543},{filename:"/pglite/share/postgresql/timezone/Pacific/Pohnpei",start:6099543,end:6099709},{filename:"/pglite/share/postgresql/timezone/Pacific/Ponape",start:6099709,end:6099875},{filename:"/pglite/share/postgresql/timezone/Pacific/Port_Moresby",start:6099875,end:6100061},{filename:"/pglite/share/postgresql/timezone/Pacific/Rarotonga",start:6100061,end:6100664},{filename:"/pglite/share/postgresql/timezone/Pacific/Saipan",start:6100664,end:6101158},{filename:"/pglite/share/postgresql/timezone/Pacific/Samoa",start:6101158,end:6101333},{filename:"/pglite/share/postgresql/timezone/Pacific/Tahiti",start:6101333,end:6101498},{filename:"/pglite/share/postgresql/timezone/Pacific/Tarawa",start:6101498,end:6101664},{filename:"/pglite/share/postgresql/timezone/Pacific/Tongatapu",start:6101664,end:6102036},{filename:"/pglite/share/postgresql/timezone/Pacific/Truk",start:6102036,end:6102222},{filename:"/pglite/share/postgresql/timezone/Pacific/Wake",start:6102222,end:6102388},{filename:"/pglite/share/postgresql/timezone/Pacific/Wallis",start:6102388,end:6102554},{filename:"/pglite/share/postgresql/timezone/Pacific/Yap",start:6102554,end:6102740},{filename:"/pglite/share/postgresql/timezone/Poland",start:6102740,end:6105394},{filename:"/pglite/share/postgresql/timezone/Portugal",start:6105394,end:6108921},{filename:"/pglite/share/postgresql/timezone/ROC",start:6108921,end:6109682},{filename:"/pglite/share/postgresql/timezone/ROK",start:6109682,end:6110299},{filename:"/pglite/share/postgresql/timezone/Singapore",start:6110299,end:6110714},{filename:"/pglite/share/postgresql/timezone/Turkey",start:6110714,end:6112661},{filename:"/pglite/share/postgresql/timezone/UCT",start:6112661,end:6112775},{filename:"/pglite/share/postgresql/timezone/US/Alaska",start:6112775,end:6115146},{filename:"/pglite/share/postgresql/timezone/US/Aleutian",start:6115146,end:6117502},{filename:"/pglite/share/postgresql/timezone/US/Arizona",start:6117502,end:6117862},{filename:"/pglite/share/postgresql/timezone/US/Central",start:6117862,end:6121454},{filename:"/pglite/share/postgresql/timezone/US/East-Indiana",start:6121454,end:6123136},{filename:"/pglite/share/postgresql/timezone/US/Eastern",start:6123136,end:6126688},{filename:"/pglite/share/postgresql/timezone/US/Hawaii",start:6126688,end:6127017},{filename:"/pglite/share/postgresql/timezone/US/Indiana-Starke",start:6127017,end:6129461},{filename:"/pglite/share/postgresql/timezone/US/Michigan",start:6129461,end:6131691},{filename:"/pglite/share/postgresql/timezone/US/Mountain",start:6131691,end:6134151},{filename:"/pglite/share/postgresql/timezone/US/Pacific",start:6134151,end:6137003},{filename:"/pglite/share/postgresql/timezone/US/Samoa",start:6137003,end:6137178},{filename:"/pglite/share/postgresql/timezone/UTC",start:6137178,end:6137292},{filename:"/pglite/share/postgresql/timezone/Universal",start:6137292,end:6137406},{filename:"/pglite/share/postgresql/timezone/W-SU",start:6137406,end:6138941},{filename:"/pglite/share/postgresql/timezone/WET",start:6138941,end:6142468},{filename:"/pglite/share/postgresql/timezone/Zulu",start:6142468,end:6142582},{filename:"/pglite/share/postgresql/timezonesets/Africa.txt",start:6142582,end:6149555},{filename:"/pglite/share/postgresql/timezonesets/America.txt",start:6149555,end:6160562},{filename:"/pglite/share/postgresql/timezonesets/Antarctica.txt",start:6160562,end:6161696},{filename:"/pglite/share/postgresql/timezonesets/Asia.txt",start:6161696,end:6170007},{filename:"/pglite/share/postgresql/timezonesets/Atlantic.txt",start:6170007,end:6173540},{filename:"/pglite/share/postgresql/timezonesets/Australia",start:6173540,end:6174675},{filename:"/pglite/share/postgresql/timezonesets/Australia.txt",start:6174675,end:6178059},{filename:"/pglite/share/postgresql/timezonesets/Default",start:6178059,end:6205273},{filename:"/pglite/share/postgresql/timezonesets/Etc.txt",start:6205273,end:6206523},{filename:"/pglite/share/postgresql/timezonesets/Europe.txt",start:6206523,end:6215269},{filename:"/pglite/share/postgresql/timezonesets/India",start:6215269,end:6215862},{filename:"/pglite/share/postgresql/timezonesets/Indian.txt",start:6215862,end:6217123},{filename:"/pglite/share/postgresql/timezonesets/Pacific.txt",start:6217123,end:6220891},{filename:"/pglite/share/postgresql/tsearch_data/danish.stop",start:6220891,end:6221315},{filename:"/pglite/share/postgresql/tsearch_data/dutch.stop",start:6221315,end:6221768},{filename:"/pglite/share/postgresql/tsearch_data/english.stop",start:6221768,end:6222390},{filename:"/pglite/share/postgresql/tsearch_data/finnish.stop",start:6222390,end:6223969},{filename:"/pglite/share/postgresql/tsearch_data/french.stop",start:6223969,end:6224774},{filename:"/pglite/share/postgresql/tsearch_data/german.stop",start:6224774,end:6226123},{filename:"/pglite/share/postgresql/tsearch_data/hungarian.stop",start:6226123,end:6227350},{filename:"/pglite/share/postgresql/tsearch_data/hunspell_sample.affix",start:6227350,end:6227593},{filename:"/pglite/share/postgresql/tsearch_data/hunspell_sample_long.affix",start:6227593,end:6228226},{filename:"/pglite/share/postgresql/tsearch_data/hunspell_sample_long.dict",start:6228226,end:6228324},{filename:"/pglite/share/postgresql/tsearch_data/hunspell_sample_num.affix",start:6228324,end:6228786},{filename:"/pglite/share/postgresql/tsearch_data/hunspell_sample_num.dict",start:6228786,end:6228915},{filename:"/pglite/share/postgresql/tsearch_data/ispell_sample.affix",start:6228915,end:6229380},{filename:"/pglite/share/postgresql/tsearch_data/ispell_sample.dict",start:6229380,end:6229461},{filename:"/pglite/share/postgresql/tsearch_data/italian.stop",start:6229461,end:6231115},{filename:"/pglite/share/postgresql/tsearch_data/nepali.stop",start:6231115,end:6235376},{filename:"/pglite/share/postgresql/tsearch_data/norwegian.stop",start:6235376,end:6236227},{filename:"/pglite/share/postgresql/tsearch_data/portuguese.stop",start:6236227,end:6237494},{filename:"/pglite/share/postgresql/tsearch_data/russian.stop",start:6237494,end:6238729},{filename:"/pglite/share/postgresql/tsearch_data/spanish.stop",start:6238729,end:6240907},{filename:"/pglite/share/postgresql/tsearch_data/swedish.stop",start:6240907,end:6241466},{filename:"/pglite/share/postgresql/tsearch_data/synonym_sample.syn",start:6241466,end:6241539},{filename:"/pglite/share/postgresql/tsearch_data/thesaurus_sample.ths",start:6241539,end:6242012},{filename:"/pglite/share/postgresql/tsearch_data/turkish.stop",start:6242012,end:6242272}],remote_package_size:6242272})}})();var programArgs=[],thisProgram="./this.program",quit_=(e,r)=>{throw r},_scriptName=import.meta.url,scriptDirectory="";function locateFile(e){return Module.locateFile?Module.locateFile(e,scriptDirectory):scriptDirectory+e}var readAsync,readBinary;if(ENVIRONMENT_IS_NODE){var fs=require("node:fs");_scriptName.startsWith("file:")&&(scriptDirectory=require("node:path").dirname(require("node:url").fileURLToPath(_scriptName))+"/"),readBinary=e=>{e=isFileURI(e)?new URL(e):e;var r=fs.readFileSync(e);return r},readAsync=async(e,r=!0)=>{e=isFileURI(e)?new URL(e):e;var M=fs.readFileSync(e,r?void 0:"utf8");return M},process.argv.length>1&&(thisProgram=process.argv[1].replace(/\\/g,"/")),programArgs=process.argv.slice(2),quit_=(e,r)=>{throw process.exitCode=e,r}}else if(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER){try{scriptDirectory=new URL(".",_scriptName).href}catch{}ENVIRONMENT_IS_WORKER&&(readBinary=e=>{var r=new XMLHttpRequest;return r.open("GET",e,!1),r.responseType="arraybuffer",r.send(null),new Uint8Array(r.response)}),readAsync=async e=>{var r=await fetch(e,{credentials:"same-origin"});if(r.ok)return r.arrayBuffer();throw new Error(r.status+" : "+r.url)}}var out=console.log.bind(console),err=console.error.bind(console),dynamicLibraries=[],wasmBinary,ABORT=!1,EXITSTATUS,isFileURI=e=>e.startsWith("file://");class EmscriptenEH{}class EmscriptenSjLj extends EmscriptenEH{}var runtimeInitialized=!1,runtimeExited=!1;function getMemoryBuffer(){return wasmMemory.buffer}function updateMemoryViews(){if(!HEAP8?.buffer?.resizable){var e=getMemoryBuffer();HEAP8=new Int8Array(e),HEAP16=new Int16Array(e),Module.HEAPU8=HEAPU8=new Uint8Array(e),HEAPU16=new Uint16Array(e),HEAP32=new Int32Array(e),HEAPU32=new Uint32Array(e),HEAPF32=new Float32Array(e),HEAPF64=new Float64Array(e),HEAP64=new BigInt64Array(e),new BigUint64Array(e)}}function initMemory(){if(Module.wasmMemory)wasmMemory=Module.wasmMemory;else{var e=Module.INITIAL_MEMORY||134217728;wasmMemory=new WebAssembly.Memory({initial:e/65536,maximum:32768})}updateMemoryViews()}var __RELOC_FUNCS__=[];function preRun(){var e=Module.preRun;e&&(typeof e=="function"&&(e=[e]),onPreRuns.push(...e)),callRuntimeCallbacks(onPreRuns)}function initRuntime(){runtimeInitialized=!0,callRuntimeCallbacks(__RELOC_FUNCS__),!Module.noFSInit&&!FS.initialized&&FS.init(),SOCKFS.root=FS.mount(SOCKFS,{},null),PIPEFS.root=FS.mount(PIPEFS,{},null),wasmExports.__wasm_call_ctors(),callRuntimeCallbacks(onPostCtors),FS.ignorePermissions=!1}function exitRuntime(){___funcs_on_exit(),FS.quit(),IDBFS.quit(),clearTimers(),runtimeExited=!0}function postRun(){var e=Module.postRun;e&&(typeof e=="function"&&(e=[e]),onPostRuns.push(...e)),callRuntimeCallbacks(onPostRuns)}function abort(e){throw Module.onAbort?.(e),e=`Aborted(${e})`,err(e),ABORT=!0,e+=". Build with -sASSERTIONS for more info.",new WebAssembly.RuntimeError(e)}var wasmBinaryFile;function findWasmBinary(){return Module.locateFile?locateFile("pglite.wasm"):new URL("/ritestand-induction-preview/assets/pglite-VfT9wtrq.wasm",import.meta.url).href}function getBinarySync(e){if(readBinary)return readBinary(e);throw"both async and sync fetching of the wasm failed"}async function getWasmBinary(e){try{var r=await readAsync(e);return new Uint8Array(r)}catch{}return getBinarySync(e)}async function instantiateArrayBuffer(e,r){try{var M=await getWasmBinary(e),fe=await WebAssembly.instantiate(M,r);return fe}catch($n){err(`failed to asynchronously prepare wasm: ${$n}`),abort($n)}}async function instantiateAsync(e,r,M){if(!ENVIRONMENT_IS_NODE)try{var fe=fetch(r,{credentials:"same-origin"}),$n=await WebAssembly.instantiateStreaming(fe,M);return $n}catch(qn){err(`wasm streaming compile failed: ${qn}`),err("falling back to ArrayBuffer instantiation")}return instantiateArrayBuffer(r,M)}function getWasmImports(){var e=new Proxy(new Set([]),GOTHandler),r={env:wasmImports,wasi_snapshot_preview1:wasmImports,"GOT.mem":e,"GOT.func":e};return r}async function createWasm(){async function e(qn,jn){wasmExports=qn.exports;var Wn=wasmExports;mergeLibSymbols(wasmExports);var Yn=getDylinkMetadata(jn);return Yn.neededDynlibs&&(dynamicLibraries=Yn.neededDynlibs.concat(dynamicLibraries)),assignWasmExports(wasmExports),updateGOT(Wn),LDSO.init(),await loadDylibs(),wasmExports}var r=getWasmImports(),M=Module.instantiateWasm;if(M)return new Promise(qn=>{M(r,(jn,Wn)=>qn(e(jn,Wn)))});wasmBinaryFile??(wasmBinaryFile=findWasmBinary());var fe=await instantiateAsync(wasmBinary,wasmBinaryFile,r),$n=await(function(qn){return e(qn.instance,qn.module)})(fe);return $n}class ExitStatus{constructor(r){P$2(this,"name","ExitStatus"),this.message=`Program terminated with exit(${r})`,this.status=r}}var GOT={},GOTHandler={get(e,r){var M=GOT[r];return M||(M=GOT[r]=new WebAssembly.Global({value:"i32",mutable:!0},-1)),e.has(r)||(M.required=!0),M}},HEAP16,HEAP32,HEAP64,HEAP8,HEAPF32,HEAPF64,HEAPU16,HEAPU32,HEAPU8,callRuntimeCallbacks=e=>{for(;e.length>0;)e.shift()(Module)},onPostRuns=[],onPreRuns=[],UTF8Decoder=globalThis.TextDecoder&&new TextDecoder,findStringEnd=(e,r,M,fe)=>{var $n=r+M;if(fe)return $n;for(;e[r]&&!(r>=$n);)++r;return r},UTF8ArrayToString=(e,r=0,M,fe)=>{var $n=findStringEnd(e,r,M,fe);if($n-r>16&&e.buffer&&UTF8Decoder)return UTF8Decoder.decode(e.subarray(r,$n));for(var qn="";r<$n;){var jn=e[r++];if(!(jn&128)){qn+=String.fromCharCode(jn);continue}var Wn=e[r++]&63;if((jn&224)==192){qn+=String.fromCharCode((jn&31)<<6|Wn);continue}var Yn=e[r++]&63;if((jn&240)==224?jn=(jn&15)<<12|Wn<<6|Yn:jn=(jn&7)<<18|Wn<<12|Yn<<6|e[r++]&63,jn<65536)qn+=String.fromCharCode(jn);else{var Xn=jn-65536;qn+=String.fromCharCode(55296|Xn>>10,56320|Xn&1023)}}return qn},getDylinkMetadata=e=>{var r=0,M=0;function fe(){return e[r++]}function $n(){for(var ar=0,dr=1;;){var lr=e[r++];if(ar+=(lr&127)*dr,dr*=128,!(lr&128))break}return ar}function qn(){var ar=$n();return r+=ar,UTF8ArrayToString(e,r-ar,ar)}function jn(){for(var ar=$n(),dr=[];ar--;)dr.push(qn());return dr}function Wn(ar,dr){if(ar)throw new Error(dr)}if(e instanceof WebAssembly.Module){var Yn=WebAssembly.Module.customSections(e,"dylink.0");Wn(!Yn.length,"need dylink section"),e=new Uint8Array(Yn[0]),M=e.length}else{var Xn=new Uint32Array(new Uint8Array(e.subarray(0,24)).buffer),Kn=Xn[0]==1836278016;Wn(!Kn,"need to see wasm magic number"),Wn(e[8],"need the dylink section to be first"),r=9;var er=$n();M=r+er;var nr=qn();Wn(nr!=="dylink.0")}for(var Zn={neededDynlibs:[],tlsExports:new Set,weakImports:new Set,runtimePaths:[]};r<M;){var rr=fe(),sr=$n();if(rr===1)Zn.memorySize=$n(),Zn.memoryAlign=$n(),Zn.tableSize=$n(),Zn.tableAlign=$n();else if(rr===2)Zn.neededDynlibs=jn();else if(rr===3)for(var or=$n();or--;){var ir=qn(),Jn=$n();Jn&256&&Zn.tlsExports.add(ir)}else if(rr===4)for(or=$n();or--;)qn(),ir=qn(),Jn=$n(),(Jn&3)==1&&Zn.weakImports.add(ir);else if(rr===5)Zn.runtimePaths=jn();else if(rr===6){var tr=qn();Wn(tr!=="wasm32",`incorrect architecture (${tr} vs wasm32)`)}else r+=sr}return Zn};function getValue(e,r="i8"){switch(r.endsWith("*")&&(r="*"),r){case"i1":return HEAP8[e];case"i8":return HEAP8[e];case"i16":return HEAP16[e>>1];case"i32":return HEAP32[e>>2];case"i64":return HEAP64[e>>3];case"float":return HEAPF32[e>>2];case"double":return HEAPF64[e>>3];case"*":return HEAPU32[e>>2];default:abort(`invalid type for getValue: ${r}`)}}var newDSO=(e,r,M)=>{var fe={refcount:1/0,name:e,exports:M,global:!0};return LDSO.loadedLibsByName[e]=fe,r!=null&&(LDSO.loadedLibsByHandle[r]=fe),fe},LDSO={loadedLibsByName:{},loadedLibsByHandle:{},init(){newDSO("__main__",0,wasmImports)}},alignMemory=(e,r)=>Math.ceil(e/r)*r,getMemory=e=>{if(runtimeInitialized)return _calloc(e,1);var r=___heap_base,M=r+alignMemory(e,16);___heap_base=M;var fe=_emscripten_get_sbrk_ptr();return HEAPU32[fe>>2]=M,r},isInternalSym=e=>["memory","__memory_base","__table_base","__stack_pointer","__indirect_function_table","__cpp_exception","__c_longjmp","__wasm_apply_data_relocs","__dso_handle","__tls_size","__tls_align","__set_stack_limits","_emscripten_tls_init","__wasm_init_tls","__wasm_call_ctors","__start_em_asm","__stop_em_asm","__start_em_js","__stop_em_js"].includes(e)||e.startsWith("__em_js__"),wasmTableMirror=[],getWasmTableEntry=e=>{var r=wasmTableMirror[e];return r||(wasmTableMirror[e]=r=wasmTable.get(e)),r},updateTableMap=(e,r)=>{if(functionsInTableMap)for(var M=e;M<e+r;M++){var fe=getWasmTableEntry(M);fe&&functionsInTableMap.set(fe,M)}},functionsInTableMap,getFunctionAddress=e=>(functionsInTableMap||(functionsInTableMap=new WeakMap,updateTableMap(0,wasmTable.length)),functionsInTableMap.get(e)||0),freeTableIndexes=[],getEmptyTableSlot=()=>freeTableIndexes.length?freeTableIndexes.pop():wasmTable.grow(1),setWasmTableEntry=(e,r)=>{wasmTable.set(e,r),wasmTableMirror[e]=wasmTable.get(e)},uleb128EncodeWithLen=e=>{let r=e.length;return[r%128|128,r>>7,...e]},wasmTypeCodes={i:127,p:127,j:126,f:125,d:124,e:111},generateTypePack=e=>uleb128EncodeWithLen(Array.from(e,r=>{var M=wasmTypeCodes[r];return M})),convertJsFunctionToWasm=(e,r)=>{var M=Uint8Array.of(0,97,115,109,1,0,0,0,1,...uleb128EncodeWithLen([1,96,...generateTypePack(r.slice(1)),...generateTypePack(r[0]==="v"?"":r[0])]),2,7,1,1,101,1,102,0,0,7,5,1,1,102,0,0),fe=new WebAssembly.Module(M),$n=new WebAssembly.Instance(fe,{e:{f:e}}),qn=$n.exports.f;return qn},addFunction=(e,r)=>{var M=getFunctionAddress(e);if(M)return M;var fe=getEmptyTableSlot();try{setWasmTableEntry(fe,e)}catch(qn){if(!(qn instanceof TypeError))throw qn;var $n=convertJsFunctionToWasm(e,r);setWasmTableEntry(fe,$n)}return functionsInTableMap.set(e,fe),fe},updateGOT=(e,r)=>{for(var M in e)if(!isInternalSym(M)){var fe=e[M],$n=GOT[M]&&GOT[M].value!=-1;if(!$n){var qn;if(typeof fe=="function")qn=addFunction(fe);else if(typeof fe.value=="number")qn=fe;else continue;GOT[M]??(GOT[M]=new WebAssembly.Global({value:"i32",mutable:!0})),GOT[M].value=qn}}},isImmutableGlobal=e=>{if(e instanceof WebAssembly.Global)try{e.value=e.value}catch{return!0}return!1},relocateExports=(e,r=0)=>{function M(qn,jn){return isImmutableGlobal(jn)?new WebAssembly.Global({value:"i32"},jn.value+r):jn}var fe={};for(var $n in e)fe[$n]=M(0,e[$n]);return fe},isSymbolDefined=e=>{var r=wasmImports[e];return!(!r||r.stub)},createNamedFunction=(e,r)=>Object.defineProperty(r,"name",{value:e}),dynCall=(e,r,M=[])=>{var fe=getWasmTableEntry(r),$n=fe(...M);return(function(qn){return qn})($n)},stackSave=()=>_emscripten_stack_get_current(),stackRestore=e=>__emscripten_stack_restore(e),createInvokeFunction=e=>(r,...M)=>{var fe=stackSave();try{return dynCall(e,r,M)}catch($n){if(stackRestore(fe),!($n instanceof EmscriptenEH))throw $n;if(_setThrew(1,0),e[0]=="j")return 0n}},resolveGlobalSymbol=e=>{var r;return isSymbolDefined(e)?r=wasmImports[e]:e.startsWith("invoke_")&&(r=wasmImports[e]=createNamedFunction(e,createInvokeFunction(e.split("_")[1]))),{sym:r,name:e}},onPostCtors=[],addOnPostCtor=e=>{onPostCtors.push(e)},UTF8ToString=(e,r,M)=>e?UTF8ArrayToString(HEAPU8,e,r,M):"",loadWebAssemblyModule=(binary,flags,libName,localScope,handle)=>{var metadata=getDylinkMetadata(binary);function loadModule(){var memAlign=Math.pow(2,metadata.memoryAlign),memoryBase=metadata.memorySize?alignMemory(getMemory(metadata.memorySize+memAlign),memAlign):0,tableBase=metadata.tableSize?wasmTable.length:0;handle&&(HEAP8[handle+8]=1,HEAPU32[handle+12>>2]=memoryBase,HEAP32[handle+16>>2]=metadata.memorySize,HEAPU32[handle+20>>2]=tableBase,HEAP32[handle+24>>2]=metadata.tableSize),metadata.tableSize&&wasmTable.grow(metadata.tableSize);var moduleExports;function resolveSymbol(e){var r=resolveGlobalSymbol(e).sym;return!r&&localScope&&(r=localScope[e]),r||(r=moduleExports[e]),r}var proxyHandler={get(e,r){switch(r){case"__memory_base":return memoryBase;case"__table_base":return tableBase}if(r in wasmImports&&!wasmImports[r].stub){var M=wasmImports[r];return M}if(!(r in e)){var fe;e[r]=(...$n)=>(fe||(fe=resolveSymbol(r)),fe(...$n))}return e[r]}},proxy=new Proxy({},proxyHandler),GOTProxy=new Proxy(metadata.weakImports,GOTHandler),info={"GOT.mem":GOTProxy,"GOT.func":GOTProxy,env:proxy,wasi_snapshot_preview1:proxy};function postInstantiation(module,instance){updateTableMap(tableBase,metadata.tableSize),moduleExports=relocateExports(instance.exports,memoryBase),updateGOT(moduleExports),flags.allowUndefined||reportUndefinedSymbols();function addEmAsm(addr,body){for(var args=[],arity=0;;arity++){var argName="$"+arity;if(!body.includes(argName))break;args.push(argName)}args=args.join();var func=`(${args}) => { ${body} };`;eval(func)}if("__start_em_asm"in moduleExports)for(var start=moduleExports.__start_em_asm.value,stop=moduleExports.__stop_em_asm.value;start<stop;){var jsString=UTF8ToString(start);addEmAsm(start,jsString),start=HEAPU8.indexOf(0,start)+1}function addEmJs(name,cSig,body){var jsArgs=[];if(cSig=cSig.slice(1,-1),cSig!="void"){cSig=cSig.split(",");for(var arg of cSig){var jsArg=arg.split(" ").pop();jsArgs.push(jsArg.replaceAll("*",""))}}var func=`(${jsArgs}) => ${body};`;moduleExports[name]=eval(func)}for(var name in moduleExports)if(name.startsWith("__em_js__")){var start=moduleExports[name].value,jsString=UTF8ToString(start),[sig,body]=jsString.split("<::>");addEmJs(name.replace("__em_js__",""),sig,body),delete moduleExports[name]}var applyRelocs=moduleExports.__wasm_apply_data_relocs;applyRelocs&&(runtimeInitialized?applyRelocs():__RELOC_FUNCS__.push(applyRelocs));var init=moduleExports.__wasm_call_ctors;return init&&(runtimeInitialized?init():addOnPostCtor(init)),moduleExports}if(flags.loadAsync)return(async()=>{var e;return binary instanceof WebAssembly.Module?e=new WebAssembly.Instance(binary,info):{module:binary,instance:e}=await WebAssembly.instantiate(binary,info),postInstantiation(binary,e)})();var module=binary instanceof WebAssembly.Module?binary:new WebAssembly.Module(binary),instance=new WebAssembly.Instance(module,info);return postInstantiation(module,instance)}if(flags={...flags,rpath:{parentLibPath:libName,paths:metadata.runtimePaths}},flags.loadAsync)return metadata.neededDynlibs.reduce((e,r)=>e.then(()=>(r=findLibraryFS(r,flags.rpath)??r,loadDynamicLibrary(r,flags,localScope))),Promise.resolve()).then(loadModule);for(var needed of metadata.neededDynlibs)needed=findLibraryFS(needed,flags.rpath)??needed,loadDynamicLibrary(needed,flags,localScope);return loadModule()},mergeLibSymbols=e=>{for(var[r,M]of Object.entries(e)){let fe=qn=>{isSymbolDefined(qn)||(wasmImports[qn]=M)};fe(r);let $n="__main_argc_argv";r=="main"&&fe($n),r==$n&&fe("main")}},asyncLoad=async e=>{var r=await readAsync(e);return new Uint8Array(r)},preloadPlugins=[],registerWasmPlugin=()=>{var e={canHandle:r=>!Module.noWasmDecoding&&r.endsWith(".so"),handle:async(r,M)=>{try{var fe=await loadWebAssemblyModule(r,{loadAsync:!0,nodelete:!0},M,{})}catch($n){throw new Error(`failed to instantiate wasm: ${M}: ${$n}`)}return preloadedWasm[M]=fe,r}};preloadPlugins.push(e)},preloadedWasm={},PATH={isAbs:e=>e.charAt(0)==="/",splitPath:e=>/^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/.exec(e).slice(1),normalizeArray:(e,r)=>{for(var M=0,fe=e.length-1;fe>=0;fe--){var $n=e[fe];$n==="."?e.splice(fe,1):$n===".."?(e.splice(fe,1),M++):M&&(e.splice(fe,1),M--)}if(r)for(;M;M--)e.unshift("..");return e},normalize:e=>{var r=PATH.isAbs(e),M=e.slice(-1)==="/";return e=PATH.normalizeArray(e.split("/").filter(fe=>!!fe),!r).join("/"),!e&&!r&&(e="."),e&&M&&(e+="/"),(r?"/":"")+e},dirname:e=>{var r=PATH.splitPath(e),M=r[0],fe=r[1];return!M&&!fe?".":(fe&&(fe=fe.slice(0,-1)),M+fe)},basename:e=>e&&e.match(/([^\/]+|\/)\/*$/)[1],join:(...e)=>PATH.normalize(e.join("/")),join2:(e,r)=>PATH.normalize(e+"/"+r)},replaceORIGIN=(e,r)=>{if(r.startsWith("$ORIGIN")){var M=PATH.dirname(e);return r.replace("$ORIGIN",M)}return r},withStackSave=e=>{var r=stackSave(),M=e();return stackRestore(r),M},stackAlloc=e=>__emscripten_stack_alloc(e),lengthBytesUTF8=e=>{for(var r=0,M=0;M<e.length;++M){var fe=e.charCodeAt(M);fe<=127?r++:fe<=2047?r+=2:fe>=55296&&fe<=57343?(r+=4,++M):r+=3}return r},stringToUTF8Array=(e,r,M,fe)=>{if(!(fe>0))return 0;for(var $n=M,qn=M+fe-1,jn=0;jn<e.length;++jn){var Wn=e.codePointAt(jn);if(Wn<=127){if(M>=qn)break;r[M++]=Wn}else if(Wn<=2047){if(M+1>=qn)break;r[M++]=192|Wn>>6,r[M++]=128|Wn&63}else if(Wn<=65535){if(M+2>=qn)break;r[M++]=224|Wn>>12,r[M++]=128|Wn>>6&63,r[M++]=128|Wn&63}else{if(M+3>=qn)break;r[M++]=240|Wn>>18,r[M++]=128|Wn>>12&63,r[M++]=128|Wn>>6&63,r[M++]=128|Wn&63,jn++}}return r[M]=0,M-$n},stringToUTF8=(e,r,M)=>stringToUTF8Array(e,HEAPU8,r,M),stringToUTF8OnStack=e=>{var r=lengthBytesUTF8(e)+1,M=stackAlloc(r);return stringToUTF8(e,M,r),M},initRandomFill=()=>{if(ENVIRONMENT_IS_NODE){var e=require("node:crypto");return r=>(e.randomFillSync(r),0)}return r=>(crypto.getRandomValues(r),0)},randomFill=e=>(randomFill=initRandomFill())(e),PATH_FS={resolve:(...e)=>{for(var r="",M=!1,fe=e.length-1;fe>=-1&&!M;fe--){var $n=fe>=0?e[fe]:FS.cwd();if(typeof $n!="string")throw new TypeError("Arguments to path.resolve must be strings");if(!$n)return"";r=$n+"/"+r,M=PATH.isAbs($n)}return r=PATH.normalizeArray(r.split("/").filter(qn=>!!qn),!M).join("/"),(M?"/":"")+r||"."},relative:(e,r)=>{e=PATH_FS.resolve(e).slice(1),r=PATH_FS.resolve(r).slice(1);function M(Xn){for(var Kn=0;Kn<Xn.length&&Xn[Kn]==="";Kn++);for(var er=Xn.length-1;er>=0&&Xn[er]==="";er--);return Kn>er?[]:Xn.slice(Kn,er-Kn+1)}for(var fe=M(e.split("/")),$n=M(r.split("/")),qn=Math.min(fe.length,$n.length),jn=qn,Wn=0;Wn<qn;Wn++)if(fe[Wn]!==$n[Wn]){jn=Wn;break}var Yn=[];for(Wn=jn;Wn<fe.length;Wn++)Yn.push("..");return Yn=Yn.concat($n.slice(jn)),Yn.join("/")}},FS_stdin_getChar_buffer=[],intArrayFromString=(e,r,M)=>{var fe=lengthBytesUTF8(e)+1,$n=new Array(fe),qn=stringToUTF8Array(e,$n,0,$n.length);return $n.length=qn,$n},FS_stdin_getChar=()=>{if(!FS_stdin_getChar_buffer.length){var e=null;if(ENVIRONMENT_IS_NODE){var r=Buffer.alloc(256),M=0;try{M=fs.readSync(process.stdin.fd,r,0,256)}catch(fe){if(fe.toString().includes("EOF"))M=0;else throw fe}M>0&&(e=r.toString("utf-8",0,M))}else globalThis.window?.prompt&&(e=window.prompt("Input: "),e!==null&&(e+=`
`));if(!e)return null;FS_stdin_getChar_buffer=intArrayFromString(e)}return FS_stdin_getChar_buffer.shift()},TTY={ttys:[],init(){},shutdown(){},register(e,r){TTY.ttys[e]={input:[],output:[],ops:r},FS.registerDevice(e,TTY.stream_ops)},stream_ops:{open(e){var r=TTY.ttys[e.node.rdev];if(!r)throw new FS.ErrnoError(43);e.tty=r,e.seekable=!1},close(e){e.tty.ops.fsync(e.tty)},fsync(e){e.tty.ops.fsync(e.tty)},read(e,r,M,fe,$n){if(!e.tty||!e.tty.ops.get_char)throw new FS.ErrnoError(60);for(var qn=0,jn=0;jn<fe;jn++){var Wn;try{Wn=e.tty.ops.get_char(e.tty)}catch{throw new FS.ErrnoError(29)}if(Wn===void 0&&!qn)throw new FS.ErrnoError(6);if(Wn==null||(qn++,r[M+jn]=Wn,Wn===10))break}return qn&&(e.node.atime=Date.now()),qn},write(e,r,M,fe,$n){if(!e.tty||!e.tty.ops.put_char)throw new FS.ErrnoError(60);try{for(var qn=0;qn<fe;qn++)e.tty.ops.put_char(e.tty,r[M+qn])}catch{throw new FS.ErrnoError(29)}return fe&&(e.node.mtime=e.node.ctime=Date.now()),qn}},default_tty_ops:{get_char(e){return FS_stdin_getChar()},put_char(e,r){r===null||r===10?(out(UTF8ArrayToString(e.output)),e.output=[]):r!=0&&e.output.push(r)},fsync(e){e.output?.length>0&&(out(UTF8ArrayToString(e.output)),e.output=[])},ioctl_tcgets(e){return{c_iflag:25856,c_oflag:5,c_cflag:191,c_lflag:35387,c_cc:[3,28,127,21,4,0,1,0,17,19,26,0,18,15,23,22,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}},ioctl_tcsets(e,r,M){return 0},ioctl_tiocgwinsz(e){return[24,80]}},default_tty1_ops:{put_char(e,r){r===null||r===10?(err(UTF8ArrayToString(e.output)),e.output=[]):r!=0&&e.output.push(r)},fsync(e){e.output?.length>0&&(err(UTF8ArrayToString(e.output)),e.output=[])}}},zeroMemory=(e,r)=>HEAPU8.fill(0,e,e+r),mmapAlloc=e=>{e=alignMemory(e,65536);var r=_emscripten_builtin_memalign(65536,e);return r&&zeroMemory(r,e),r},MEMFS={ops_table:null,mount(e){return MEMFS.createNode(null,"/",16895,0)},createNode(e,r,M,fe){if(FS.isBlkdev(M)||FS.isFIFO(M))throw new FS.ErrnoError(63);MEMFS.ops_table||(MEMFS.ops_table={dir:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr,lookup:MEMFS.node_ops.lookup,mknod:MEMFS.node_ops.mknod,rename:MEMFS.node_ops.rename,unlink:MEMFS.node_ops.unlink,rmdir:MEMFS.node_ops.rmdir,readdir:MEMFS.node_ops.readdir,symlink:MEMFS.node_ops.symlink},stream:{llseek:MEMFS.stream_ops.llseek}},file:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr},stream:{llseek:MEMFS.stream_ops.llseek,read:MEMFS.stream_ops.read,write:MEMFS.stream_ops.write,mmap:MEMFS.stream_ops.mmap,msync:MEMFS.stream_ops.msync}},link:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr,readlink:MEMFS.node_ops.readlink},stream:{}},chrdev:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr},stream:FS.chrdev_stream_ops}});var $n=FS.createNode(e,r,M,fe);return FS.isDir($n.mode)?($n.node_ops=MEMFS.ops_table.dir.node,$n.stream_ops=MEMFS.ops_table.dir.stream,$n.contents={}):FS.isFile($n.mode)?($n.node_ops=MEMFS.ops_table.file.node,$n.stream_ops=MEMFS.ops_table.file.stream,$n.usedBytes=0,$n.contents=MEMFS.emptyFileContents??(MEMFS.emptyFileContents=new Uint8Array(0))):FS.isLink($n.mode)?($n.node_ops=MEMFS.ops_table.link.node,$n.stream_ops=MEMFS.ops_table.link.stream):FS.isChrdev($n.mode)&&($n.node_ops=MEMFS.ops_table.chrdev.node,$n.stream_ops=MEMFS.ops_table.chrdev.stream),$n.atime=$n.mtime=$n.ctime=Date.now(),e&&(e.contents[r]=$n,e.atime=e.mtime=e.ctime=$n.atime),$n},getFileDataAsTypedArray(e){return e.contents.subarray(0,e.usedBytes)},expandFileStorage(e,r){var M=e.contents.length;if(!(M>=r)){r=Math.max(r,M*(M<1048576?2:1.125)>>>0),M&&(r=Math.max(r,256));var fe=MEMFS.getFileDataAsTypedArray(e);e.contents=new Uint8Array(r),e.contents.set(fe)}},resizeFileStorage(e,r){if(e.usedBytes!=r){var M=e.contents;e.contents=new Uint8Array(r),e.contents.set(M.subarray(0,Math.min(r,e.usedBytes))),e.usedBytes=r}},node_ops:{getattr(e){var r={};return r.dev=FS.isChrdev(e.mode)?e.id:1,r.ino=e.id,r.mode=e.mode,r.nlink=1,r.uid=0,r.gid=0,r.rdev=e.rdev,FS.isDir(e.mode)?r.size=4096:FS.isFile(e.mode)?r.size=e.usedBytes:FS.isLink(e.mode)?r.size=e.link.length:r.size=0,r.atime=new Date(e.atime),r.mtime=new Date(e.mtime),r.ctime=new Date(e.ctime),r.blksize=4096,r.blocks=Math.ceil(r.size/r.blksize),r},setattr(e,r){for(let M of["mode","atime","mtime","ctime"])r[M]!=null&&(e[M]=r[M]);r.size!==void 0&&MEMFS.resizeFileStorage(e,r.size)},lookup(e,r){throw MEMFS.doesNotExistError||(MEMFS.doesNotExistError=new FS.ErrnoError(44),MEMFS.doesNotExistError.stack="<generic error, no stack>"),MEMFS.doesNotExistError},mknod(e,r,M,fe){return MEMFS.createNode(e,r,M,fe)},rename(e,r,M){var fe;try{fe=FS.lookupNode(r,M)}catch{}if(fe&&FS.isDir(e.mode))for(var $n in fe.contents)throw new FS.ErrnoError(55);delete e.parent.contents[e.name],r.contents[M]=e,e.name=M,r.ctime=r.mtime=e.parent.ctime=e.parent.mtime=Date.now()},unlink(e,r){delete e.contents[r],e.ctime=e.mtime=Date.now()},rmdir(e,r){var M=FS.lookupNode(e,r);for(var fe in M.contents)throw new FS.ErrnoError(55);delete e.contents[r],e.ctime=e.mtime=Date.now()},readdir(e){return[".","..",...Object.keys(e.contents)]},symlink(e,r,M){var fe=MEMFS.createNode(e,r,41471,0);return fe.link=M,fe},readlink(e){if(!FS.isLink(e.mode))throw new FS.ErrnoError(28);return e.link}},stream_ops:{read(e,r,M,fe,$n){var qn=e.node.contents;if($n>=e.node.usedBytes)return 0;var jn=Math.min(e.node.usedBytes-$n,fe);return r.set(qn.subarray($n,$n+jn),M),jn},write(e,r,M,fe,$n,qn){if(r.buffer===HEAP8.buffer&&(qn=!1),!fe)return 0;var jn=e.node;return jn.mtime=jn.ctime=Date.now(),qn?(jn.contents=r.subarray(M,M+fe),jn.usedBytes=fe):!jn.usedBytes&&!$n?(jn.contents=r.slice(M,M+fe),jn.usedBytes=fe):(MEMFS.expandFileStorage(jn,$n+fe),jn.contents.set(r.subarray(M,M+fe),$n),jn.usedBytes=Math.max(jn.usedBytes,$n+fe)),fe},llseek(e,r,M){var fe=r;if(M===1?fe+=e.position:M===2&&FS.isFile(e.node.mode)&&(fe+=e.node.usedBytes),fe<0)throw new FS.ErrnoError(28);return fe},mmap(e,r,M,fe,$n){if(!FS.isFile(e.node.mode))throw new FS.ErrnoError(43);var qn,jn,Wn=e.node.contents;if(!($n&2)&&Wn.buffer===HEAP8.buffer)jn=!1,qn=Wn.byteOffset;else{if(jn=!0,qn=mmapAlloc(r),!qn)throw new FS.ErrnoError(48);Wn&&((M>0||M+r<Wn.length)&&(Wn.subarray?Wn=Wn.subarray(M,M+r):Wn=Array.prototype.slice.call(Wn,M,M+r)),HEAP8.set(Wn,qn))}return{ptr:qn,allocated:jn}},msync(e,r,M,fe,$n){return MEMFS.stream_ops.write(e,r,0,fe,M,!1),0}}},FS_modeStringToFlags=e=>{if(typeof e!="string")return e;var r={r:0,"r+":2,w:577,"w+":578,a:1089,"a+":1090}[e];if(typeof r>"u")throw new Error(`Unknown file open mode: ${e}`);return r},FS_fileDataToTypedArray=e=>(typeof e=="string"&&(e=intArrayFromString(e)),e.subarray||(e=new Uint8Array(e)),e),FS_getMode=(e,r)=>{var M=0;return e&&(M|=365),r&&(M|=146),M},IDBFS={dbs:{},indexedDB:()=>indexedDB,DB_VERSION:21,DB_STORE_NAME:"FILE_DATA",queuePersist:e=>{function r(){e.idbPersistState==="again"?M():(e.idbPersistState=0,IDBFS.onAutoPersistStateChanged?.(!1))}function M(){e.idbPersistState="idb",IDBFS.onAutoPersistStateChanged?.(!0),IDBFS.syncfs(e,!1,r)}e.idbPersistState?e.idbPersistState==="idb"&&(e.idbPersistState="again"):e.idbPersistState=setTimeout(M,0)},mount:e=>{var r=MEMFS.mount(e);if(e?.opts?.autoPersist){e.idbPersistState=0;var M=r.node_ops;r.node_ops={...r.node_ops},r.node_ops.mknod=(fe,$n,qn,jn)=>{var Wn=M.mknod(fe,$n,qn,jn);return Wn.node_ops=r.node_ops,Wn.idbfs_mount=r.mount,Wn.memfs_stream_ops=Wn.stream_ops,Wn.stream_ops={...Wn.stream_ops},Wn.stream_ops.write=(Yn,Xn,Kn,er,nr,Zn)=>(Yn.node.isModified=!0,Wn.memfs_stream_ops.write(Yn,Xn,Kn,er,nr,Zn)),Wn.stream_ops.close=Yn=>{var Xn=Yn.node;if(Xn.isModified&&(IDBFS.queuePersist(Xn.idbfs_mount),Xn.isModified=!1),Xn.memfs_stream_ops.close)return Xn.memfs_stream_ops.close(Yn)},IDBFS.queuePersist(r.mount),Wn},r.node_ops.rmdir=(...fe)=>(IDBFS.queuePersist(r.mount),M.rmdir(...fe)),r.node_ops.symlink=(...fe)=>(IDBFS.queuePersist(r.mount),M.symlink(...fe)),r.node_ops.unlink=(...fe)=>(IDBFS.queuePersist(r.mount),M.unlink(...fe)),r.node_ops.rename=(...fe)=>(IDBFS.queuePersist(r.mount),M.rename(...fe))}return r},syncfs:(e,r,M)=>{IDBFS.getLocalSet(e,(fe,$n)=>{if(fe)return M(fe);IDBFS.getRemoteSet(e,(qn,jn)=>{if(qn)return M(qn);var Wn=r?jn:$n,Yn=r?$n:jn;IDBFS.reconcile(Wn,Yn,M)})})},quit:()=>{for(var e of Object.values(IDBFS.dbs))e.close();IDBFS.dbs={}},getDB:(e,r)=>{var M=IDBFS.dbs[e];if(M)return r(null,M);var fe;try{fe=IDBFS.indexedDB().open(e,IDBFS.DB_VERSION)}catch($n){return r($n)}if(!fe)return r("Unable to connect to IndexedDB");fe.onupgradeneeded=$n=>{var qn=$n.target.result,jn=$n.target.transaction,Wn;qn.objectStoreNames.contains(IDBFS.DB_STORE_NAME)?Wn=jn.objectStore(IDBFS.DB_STORE_NAME):Wn=qn.createObjectStore(IDBFS.DB_STORE_NAME),Wn.indexNames.contains("timestamp")||Wn.createIndex("timestamp","timestamp",{unique:!1})},fe.onsuccess=()=>{M=fe.result,IDBFS.dbs[e]=M,r(null,M)},fe.onerror=$n=>{r($n.target.error),$n.preventDefault()}},getLocalSet:(e,r)=>{var M={};function fe(Yn){return Yn!=="."&&Yn!==".."}function $n(Yn){return Xn=>PATH.join2(Yn,Xn)}for(var qn=FS.readdir(e.mountpoint).filter(fe).map($n(e.mountpoint));qn.length;){var jn=qn.pop(),Wn;try{Wn=FS.lstat(jn)}catch(Yn){return r(Yn)}FS.isDir(Wn.mode)&&qn.push(...FS.readdir(jn).filter(fe).map($n(jn))),M[jn]={timestamp:Wn.mtime}}return r(null,{type:"local",entries:M})},getRemoteSet:(e,r)=>{var M={};IDBFS.getDB(e.mountpoint,(fe,$n)=>{if(fe)return r(fe);try{var qn=$n.transaction([IDBFS.DB_STORE_NAME],"readonly");qn.onerror=Yn=>{r(Yn.target.error),Yn.preventDefault()};var jn=qn.objectStore(IDBFS.DB_STORE_NAME),Wn=jn.index("timestamp");Wn.openKeyCursor().onsuccess=Yn=>{var Xn=Yn.target.result;if(!Xn)return r(null,{type:"remote",db:$n,entries:M});M[Xn.primaryKey]={timestamp:Xn.key},Xn.continue()}}catch(Yn){return r(Yn)}})},loadLocalEntry:(e,r)=>{var M,fe;try{var $n=FS.lookupPath(e);fe=$n.node,M=FS.lstat(e)}catch(qn){return r(qn)}return FS.isDir(M.mode)?r(null,{timestamp:M.mtime,mode:M.mode}):FS.isLink(M.mode)?r(null,{timestamp:M.mtime,mode:M.mode,link:fe.link}):FS.isFile(M.mode)?(fe.contents=MEMFS.getFileDataAsTypedArray(fe),r(null,{timestamp:M.mtime,mode:M.mode,contents:fe.contents})):r(new Error("node type not supported"))},storeLocalEntry:(e,r,M)=>{try{if(FS.isDir(r.mode))FS.mkdirTree(e,r.mode);else if(FS.isLink(r.mode))FS.symlink(r.link,e);else if(FS.isFile(r.mode))FS.writeFile(e,r.contents,{canOwn:!0});else return M(new Error("node type not supported"));FS.chmod(e,r.mode),FS.utime(e,r.timestamp,r.timestamp)}catch(fe){return M(fe)}M(null)},removeLocalEntry:(e,r)=>{try{var M=FS.lstat(e);FS.isDir(M.mode)?FS.rmdir(e):FS.unlink(e)}catch(fe){return r(fe)}r(null)},loadRemoteEntry:(e,r,M)=>{var fe=e.get(r);fe.onsuccess=$n=>M(null,$n.target.result),fe.onerror=$n=>{M($n.target.error),$n.preventDefault()}},storeRemoteEntry:(e,r,M,fe)=>{try{var $n=e.put(M,r)}catch(qn){fe(qn);return}$n.onsuccess=()=>fe(),$n.onerror=qn=>{fe(qn.target.error),qn.preventDefault()}},removeRemoteEntry:(e,r,M)=>{var fe=e.delete(r);fe.onsuccess=()=>M(),fe.onerror=$n=>{M($n.target.error),$n.preventDefault()}},reconcile:(e,r,M)=>{var fe=0,$n=[];for(var[qn,jn]of Object.entries(e.entries)){var Wn=r.entries[qn];(!Wn||jn.timestamp.getTime()!=Wn.timestamp.getTime())&&($n.push(qn),fe++)}var Yn=[];for(var qn of Object.keys(r.entries))e.entries[qn]||(Yn.push(qn),fe++);if(!fe)return M(null);var Xn=!1,Kn=e.type==="remote"?e.db:r.db,er=Kn.transaction([IDBFS.DB_STORE_NAME],"readwrite"),nr=er.objectStore(IDBFS.DB_STORE_NAME);function Zn(sr){if(sr&&!Xn)return Xn=!0,M(sr)}er.onerror=er.onabort=sr=>{Zn(sr.target.error),sr.preventDefault()},er.oncomplete=()=>{Xn||M(null)};for(let sr of $n.sort())r.type==="local"?IDBFS.loadRemoteEntry(nr,sr,(or,ir)=>{if(or)return Zn(or);IDBFS.storeLocalEntry(sr,ir,Zn)}):IDBFS.loadLocalEntry(sr,(or,ir)=>{if(or)return Zn(or);IDBFS.storeRemoteEntry(nr,sr,ir,Zn)});for(var rr of Yn.sort().reverse())r.type==="local"?IDBFS.removeLocalEntry(rr,Zn):IDBFS.removeRemoteEntry(nr,rr,Zn)}},ERRNO_CODES={EPERM:63,ENOENT:44,ESRCH:71,EINTR:27,EIO:29,ENXIO:60,E2BIG:1,ENOEXEC:45,EBADF:8,ECHILD:12,EAGAIN:6,EWOULDBLOCK:6,ENOMEM:48,EACCES:2,EFAULT:21,ENOTBLK:105,EBUSY:10,EEXIST:20,EXDEV:75,ENODEV:43,ENOTDIR:54,EISDIR:31,EINVAL:28,ENFILE:41,EMFILE:33,ENOTTY:59,ETXTBSY:74,EFBIG:22,ENOSPC:51,ESPIPE:70,EROFS:69,EMLINK:34,EPIPE:64,EDOM:18,ERANGE:68,ENOMSG:49,EIDRM:24,ECHRNG:106,EL2NSYNC:156,EL3HLT:107,EL3RST:108,ELNRNG:109,EUNATCH:110,ENOCSI:111,EL2HLT:112,EDEADLK:16,ENOLCK:46,EBADE:113,EBADR:114,EXFULL:115,ENOANO:104,EBADRQC:103,EBADSLT:102,EDEADLOCK:16,EBFONT:101,ENOSTR:100,ENODATA:116,ETIME:117,ENOSR:118,ENONET:119,ENOPKG:120,EREMOTE:121,ENOLINK:47,EADV:122,ESRMNT:123,ECOMM:124,EPROTO:65,EMULTIHOP:36,EDOTDOT:125,EBADMSG:9,ENOTUNIQ:126,EBADFD:127,EREMCHG:128,ELIBACC:129,ELIBBAD:130,ELIBSCN:131,ELIBMAX:132,ELIBEXEC:133,ENOSYS:52,ENOTEMPTY:55,ENAMETOOLONG:37,ELOOP:32,EOPNOTSUPP:138,EPFNOSUPPORT:139,ECONNRESET:15,ENOBUFS:42,EAFNOSUPPORT:5,EPROTOTYPE:67,ENOTSOCK:57,ENOPROTOOPT:50,ESHUTDOWN:140,ECONNREFUSED:14,EADDRINUSE:3,ECONNABORTED:13,ENETUNREACH:40,ENETDOWN:38,ETIMEDOUT:73,EHOSTDOWN:142,EHOSTUNREACH:23,EINPROGRESS:26,EALREADY:7,EDESTADDRREQ:17,EMSGSIZE:35,EPROTONOSUPPORT:66,ESOCKTNOSUPPORT:137,EADDRNOTAVAIL:4,ENETRESET:39,EISCONN:30,ENOTCONN:53,ETOOMANYREFS:141,EUSERS:136,EDQUOT:19,ESTALE:72,ENOTSUP:138,ENOMEDIUM:148,EILSEQ:25,EOVERFLOW:61,ECANCELED:11,ENOTRECOVERABLE:56,EOWNERDEAD:62,ESTRPIPE:135},NODEFS={isWindows:!1,staticInit(){NODEFS.isWindows=!!process.platform.match(/^win/);var e={fs:require("fs").constants}.fs;NODEFS.flagsForNodeMap={1024:e.O_APPEND,64:e.O_CREAT,128:e.O_EXCL,256:e.O_NOCTTY,0:e.O_RDONLY,2:e.O_RDWR,4096:e.O_SYNC,512:e.O_TRUNC,1:e.O_WRONLY,131072:e.O_NOFOLLOW}},convertNodeCode(e){var r=e.code;return ERRNO_CODES[r]},tryFSOperation(e){try{return e()}catch(r){throw r.code?r.code==="UNKNOWN"?new FS.ErrnoError(28):new FS.ErrnoError(NODEFS.convertNodeCode(r)):r}},mount(e){return NODEFS.createNode(null,"/",NODEFS.getMode(e.opts.root),0)},createNode(e,r,M,fe){if(!FS.isDir(M)&&!FS.isFile(M)&&!FS.isLink(M))throw new FS.ErrnoError(28);var $n=FS.createNode(e,r,M);return $n.node_ops=NODEFS.node_ops,$n.stream_ops=NODEFS.stream_ops,$n},getMode(e){return NODEFS.tryFSOperation(()=>{var r=fs.lstatSync(e).mode;return NODEFS.isWindows&&(r|=(r&292)>>2),r})},realPath(e){for(var r=[];e.parent!==e;)r.push(e.name),e=e.parent;return r.push(e.mount.opts.root),r.reverse(),PATH.join(...r)},flagsForNode(e){e&=-2097153,e&=-2049,e&=-32769,e&=-524289,e&=-65537;var r=0;for(var M in NODEFS.flagsForNodeMap)e&M&&(r|=NODEFS.flagsForNodeMap[M],e^=M);if(e)throw new FS.ErrnoError(28);return r},doGetAttr(e,r){var M=NODEFS.tryFSOperation(e);return NODEFS.isWindows&&(M.blksize||(M.blksize=4096),M.blocks||(M.blocks=(M.size+M.blksize-1)/M.blksize|0),M.mode|=(M.mode&292)>>2),{dev:M.dev,ino:r.id,mode:M.mode,nlink:M.nlink,uid:M.uid,gid:M.gid,rdev:M.rdev,size:M.size,atime:M.atime,mtime:M.mtime,ctime:M.ctime,blksize:M.blksize,blocks:M.blocks}},doSetAttr(e,r,M,fe,$n,qn,jn){NODEFS.tryFSOperation(()=>{if(M.mode!==void 0){var Wn=M.mode;NODEFS.isWindows&&(Wn&=384),fe(e,Wn),r.mode=M.mode}if(typeof(M.atime??M.mtime)=="number"){var Yn=M.atime,Xn=M.mtime;if(Yn==null||Xn==null){var Kn=jn(e);Yn??(Yn=Kn.atimeMs),Xn??(Xn=Kn.mtimeMs)}$n(e,Yn/1e3,Xn/1e3)}M.size!==void 0&&qn(e,M.size)})},node_ops:{getattr(e){var r=NODEFS.realPath(e);return NODEFS.doGetAttr(()=>fs.lstatSync(r),e)},setattr(e,r){var M=NODEFS.realPath(e);if(r.mode!=null&&r.dontFollow)throw new FS.ErrnoError(52);var fe=r.dontFollow?fs.lutimesSync:fs.utimesSync;NODEFS.doSetAttr(M,e,r,fs.chmodSync,fe,fs.truncateSync,fs.lstatSync)},lookup(e,r){var M=PATH.join2(NODEFS.realPath(e),r),fe=NODEFS.getMode(M);return NODEFS.createNode(e,r,fe)},mknod(e,r,M,fe){var $n=NODEFS.createNode(e,r,M,fe),qn=NODEFS.realPath($n);return NODEFS.tryFSOperation(()=>{FS.isDir($n.mode)?fs.mkdirSync(qn,$n.mode):fs.writeFileSync(qn,"",{mode:$n.mode})}),$n},rename(e,r,M){var fe=NODEFS.realPath(e),$n=PATH.join2(NODEFS.realPath(r),M);NODEFS.tryFSOperation(()=>fs.renameSync(fe,$n)),e.name=M},unlink(e,r){var M=PATH.join2(NODEFS.realPath(e),r);NODEFS.tryFSOperation(()=>fs.unlinkSync(M))},rmdir(e,r){var M=PATH.join2(NODEFS.realPath(e),r);NODEFS.tryFSOperation(()=>fs.rmdirSync(M))},readdir(e){var r=NODEFS.realPath(e);return NODEFS.tryFSOperation(()=>fs.readdirSync(r))},symlink(e,r,M){var fe=PATH.join2(NODEFS.realPath(e),r);NODEFS.tryFSOperation(()=>fs.symlinkSync(M,fe))},readlink(e){var r=NODEFS.realPath(e);return NODEFS.tryFSOperation(()=>fs.readlinkSync(r))},statfs(e){var r=NODEFS.tryFSOperation(()=>fs.statfsSync(e));return r.frsize=r.bsize,r}},stream_ops:{getattr(e){return NODEFS.doGetAttr(()=>fs.fstatSync(e.nfd),e.node)},setattr(e,r){NODEFS.doSetAttr(e.nfd,e.node,r,fs.fchmodSync,fs.futimesSync,fs.ftruncateSync,fs.fstatSync)},open(e){var r=NODEFS.realPath(e.node);NODEFS.tryFSOperation(()=>{e.shared.refcount=1,e.nfd=fs.openSync(r,NODEFS.flagsForNode(e.flags))})},close(e){NODEFS.tryFSOperation(()=>{e.nfd&&!--e.shared.refcount&&fs.closeSync(e.nfd)})},dup(e){e.shared.refcount++},read(e,r,M,fe,$n){return NODEFS.tryFSOperation(()=>fs.readSync(e.nfd,r,M,fe,$n))},write(e,r,M,fe,$n){return NODEFS.tryFSOperation(()=>fs.writeSync(e.nfd,r,M,fe,$n))},llseek(e,r,M){var fe=r;if(M===1?fe+=e.position:M===2&&FS.isFile(e.node.mode)&&NODEFS.tryFSOperation(()=>{var $n=fs.fstatSync(e.nfd);fe+=$n.size}),fe<0)throw new FS.ErrnoError(28);return fe},mmap(e,r,M,fe,$n){if(!FS.isFile(e.node.mode))throw new FS.ErrnoError(43);var qn=mmapAlloc(r);return NODEFS.stream_ops.read(e,HEAP8,qn,r,M),{ptr:qn,allocated:!0}},msync(e,r,M,fe,$n){return NODEFS.stream_ops.write(e,r,0,fe,M),0}}},PROXYFS={mount(e){return PROXYFS.createNode(null,"/",e.opts.fs.lstat(e.opts.root).mode,0)},createNode(e,r,M,fe){if(!FS.isDir(M)&&!FS.isFile(M)&&!FS.isLink(M))throw new FS.ErrnoError(ERRNO_CODES.EINVAL);var $n=FS.createNode(e,r,M);return $n.node_ops=PROXYFS.node_ops,$n.stream_ops=PROXYFS.stream_ops,$n},realPath(e){for(var r=[];e.parent!==e;)r.push(e.name),e=e.parent;return r.push(e.mount.opts.root),r.reverse(),PATH.join(...r)},node_ops:{getattr(e){var r=PROXYFS.realPath(e),M;try{M=e.mount.opts.fs.lstat(r)}catch(fe){throw fe.code?new FS.ErrnoError(ERRNO_CODES[fe.code]):fe}return{dev:M.dev,ino:M.ino,mode:M.mode,nlink:M.nlink,uid:M.uid,gid:M.gid,rdev:M.rdev,size:M.size,atime:M.atime,mtime:M.mtime,ctime:M.ctime,blksize:M.blksize,blocks:M.blocks}},setattr(e,r){var M=PROXYFS.realPath(e);try{if(r.mode!==void 0&&(e.mount.opts.fs.chmod(M,r.mode),e.mode=r.mode),r.atime||r.mtime){var fe=new Date(r.atime||r.mtime),$n=new Date(r.mtime||r.atime);e.mount.opts.fs.utime(M,fe,$n)}r.size!==void 0&&e.mount.opts.fs.truncate(M,r.size)}catch(qn){throw qn.code?new FS.ErrnoError(ERRNO_CODES[qn.code]):qn}},lookup(e,r){try{var M=PATH.join2(PROXYFS.realPath(e),r),fe=e.mount.opts.fs.lstat(M).mode,$n=PROXYFS.createNode(e,r,fe);return $n}catch(qn){throw qn.code?new FS.ErrnoError(ERRNO_CODES[qn.code]):qn}},mknod(e,r,M,fe){var $n=PROXYFS.createNode(e,r,M,fe),qn=PROXYFS.realPath($n);try{FS.isDir($n.mode)?$n.mount.opts.fs.mkdir(qn,$n.mode):$n.mount.opts.fs.writeFile(qn,"",{mode:$n.mode})}catch(jn){throw jn.code?new FS.ErrnoError(ERRNO_CODES[jn.code]):jn}return $n},rename(e,r,M){var fe=PROXYFS.realPath(e),$n=PATH.join2(PROXYFS.realPath(r),M);try{e.mount.opts.fs.rename(fe,$n),e.name=M}catch(qn){throw qn.code?new FS.ErrnoError(ERRNO_CODES[qn.code]):qn}},unlink(e,r){var M=PATH.join2(PROXYFS.realPath(e),r);try{e.mount.opts.fs.unlink(M)}catch(fe){throw fe.code?new FS.ErrnoError(ERRNO_CODES[fe.code]):fe}},rmdir(e,r){var M=PATH.join2(PROXYFS.realPath(e),r);try{e.mount.opts.fs.rmdir(M)}catch(fe){throw fe.code?new FS.ErrnoError(ERRNO_CODES[fe.code]):fe}},readdir(e){var r=PROXYFS.realPath(e);try{return e.mount.opts.fs.readdir(r)}catch(M){throw M.code?new FS.ErrnoError(ERRNO_CODES[M.code]):M}},symlink(e,r,M){var fe=PATH.join2(PROXYFS.realPath(e),r);try{e.mount.opts.fs.symlink(M,fe)}catch($n){throw $n.code?new FS.ErrnoError(ERRNO_CODES[$n.code]):$n}},readlink(e){var r=PROXYFS.realPath(e);try{return e.mount.opts.fs.readlink(r)}catch(M){throw M.code?new FS.ErrnoError(ERRNO_CODES[M.code]):M}}},stream_ops:{open(e){var r=PROXYFS.realPath(e.node);try{e.nfd=e.node.mount.opts.fs.open(r,e.flags)}catch(M){throw M.code?new FS.ErrnoError(ERRNO_CODES[M.code]):M}},close(e){try{e.node.mount.opts.fs.close(e.nfd)}catch(r){throw r.code?new FS.ErrnoError(ERRNO_CODES[r.code]):r}},read(e,r,M,fe,$n){try{return e.node.mount.opts.fs.read(e.nfd,r,M,fe,$n)}catch(qn){throw qn.code?new FS.ErrnoError(ERRNO_CODES[qn.code]):qn}},write(e,r,M,fe,$n){try{return e.node.mount.opts.fs.write(e.nfd,r,M,fe,$n)}catch(qn){throw qn.code?new FS.ErrnoError(ERRNO_CODES[qn.code]):qn}},llseek(e,r,M){var fe=r;if(M===1)fe+=e.position;else if(M===2&&FS.isFile(e.node.mode))try{var $n=e.node.node_ops.getattr(e.node);fe+=$n.size}catch(qn){throw new FS.ErrnoError(ERRNO_CODES[qn.code])}if(fe<0)throw new FS.ErrnoError(ERRNO_CODES.EINVAL);return fe}}},FS_createDataFile=(...e)=>FS.createDataFile(...e),dependenciesPromise=null,resolveRunDependencies=async()=>dependenciesPromise,runDependencies=0,dependenciesPromiseResolve=null,removeRunDependency=()=>{runDependencies--,Module.monitorRunDependencies?.(runDependencies),runDependencies||dependenciesPromiseResolve()},addRunDependency=()=>{runDependencies||(dependenciesPromise=new Promise(e=>dependenciesPromiseResolve=e)),runDependencies++,Module.monitorRunDependencies?.(runDependencies)},FS_handledByPreloadPlugin=async(e,r)=>{typeof Browser<"u"&&Browser.init();for(var M of preloadPlugins)if(M.canHandle(r))return M.handle(e,r);return e},FS_preloadFile=async(e,r,M,fe,$n,qn,jn,Wn)=>{var Yn=r?PATH_FS.resolve(PATH.join2(e,r)):e;addRunDependency();try{var Xn=M;typeof M=="string"&&(Xn=await asyncLoad(M)),Xn=await FS_handledByPreloadPlugin(Xn,Yn),Wn?.(),qn||FS_createDataFile(e,r,Xn,fe,$n,jn)}finally{removeRunDependency()}},FS_createPreloadedFile=(e,r,M,fe,$n,qn,jn,Wn,Yn,Xn)=>{FS_preloadFile(e,r,M,fe,$n,Wn,Yn,Xn).then(qn).catch(jn)},FS={root:null,mounts:[],devices:{},streams:[],nextInode:1,nameTable:[],currentPath:"/",initialized:!1,ignorePermissions:!0,syncFSRequests:0,ErrnoError:class{constructor(e){P$2(this,"name","ErrnoError"),this.errno=e}},FSStream:class{constructor(){P$2(this,"shared",{})}get object(){return this.node}set object(e){this.node=e}get isRead(){return(this.flags&2097155)!==1}get isWrite(){return(this.flags&2097155)!==0}get isAppend(){return this.flags&1024}get flags(){return this.shared.flags}set flags(e){this.shared.flags=e}get position(){return this.shared.position}set position(e){this.shared.position=e}},FSNode:class{constructor(e,r,M,fe){P$2(this,"node_ops",{}),P$2(this,"stream_ops",{}),P$2(this,"readMode",365),P$2(this,"writeMode",146),P$2(this,"mounted",null),e||(e=this),this.parent=e,this.mount=e.mount,this.id=FS.nextInode++,this.name=r,this.mode=M,this.rdev=fe,this.atime=this.mtime=this.ctime=Date.now()}get read(){return(this.mode&this.readMode)===this.readMode}set read(e){e?this.mode|=this.readMode:this.mode&=~this.readMode}get write(){return(this.mode&this.writeMode)===this.writeMode}set write(e){e?this.mode|=this.writeMode:this.mode&=~this.writeMode}get isFolder(){return FS.isDir(this.mode)}get isDevice(){return FS.isChrdev(this.mode)}addListener(e,r=!1){var M={cb:e,exclusive:r},fe=this.listeners??(this.listeners=new Set);return fe.add(M),{listeners:fe,entry:M}}notifyListeners(e){if(this.listeners){var r;for(var M of this.listeners)M.exclusive?(r||(r=[])).push(M):M.cb(e);if(r){var fe=(this.exclTurn||0)%r.length;this.exclTurn=fe+1,r[fe].cb(e)}}}},lookupPath(e,r={}){if(!e)throw new FS.ErrnoError(44);r.follow_mount??(r.follow_mount=!0),PATH.isAbs(e)||(e=FS.cwd()+"/"+e);e:for(var M=0;M<40;M++){for(var fe=e.split("/").filter(Xn=>!!Xn),$n=FS.root,qn="/",jn=0;jn<fe.length;jn++){var Wn=jn===fe.length-1;if(Wn&&r.parent)break;if(fe[jn]!=="."){if(fe[jn]===".."){if(qn=PATH.dirname(qn),FS.isRoot($n)){e=qn+"/"+fe.slice(jn+1).join("/"),M--;continue e}else $n=$n.parent;continue}qn=PATH.join2(qn,fe[jn]);try{$n=FS.lookupNode($n,fe[jn])}catch(Xn){if(Xn?.errno===44&&Wn&&r.noent_okay)return{path:qn};throw Xn}if(FS.isMountpoint($n)&&(!Wn||r.follow_mount)&&($n=$n.mounted.root),FS.isLink($n.mode)&&(!Wn||r.follow)){if(!$n.node_ops.readlink)throw new FS.ErrnoError(52);var Yn=$n.node_ops.readlink($n);PATH.isAbs(Yn)||(Yn=PATH.dirname(qn)+"/"+Yn),e=Yn+"/"+fe.slice(jn+1).join("/");continue e}}}return{path:qn,node:$n}}throw new FS.ErrnoError(32)},getPath(e){for(var r;;){if(FS.isRoot(e)){var M=e.mount.mountpoint;return r?M[M.length-1]!=="/"?`${M}/${r}`:M+r:M}r=r?`${e.name}/${r}`:e.name,e=e.parent}},hashName(e,r){for(var M=0,fe=0;fe<r.length;fe++)M=(M<<5)-M+r.charCodeAt(fe)|0;return(e+M>>>0)%FS.nameTable.length},hashAddNode(e){var r=FS.hashName(e.parent.id,e.name);e.name_next=FS.nameTable[r],FS.nameTable[r]=e},hashRemoveNode(e){var r=FS.hashName(e.parent.id,e.name);if(FS.nameTable[r]===e)FS.nameTable[r]=e.name_next;else for(var M=FS.nameTable[r];M;){if(M.name_next===e){M.name_next=e.name_next;break}M=M.name_next}},lookupNode(e,r){var M=FS.mayLookup(e);if(M)throw new FS.ErrnoError(M);for(var fe=FS.hashName(e.id,r),$n=FS.nameTable[fe];$n;$n=$n.name_next){var qn=$n.name;if($n.parent.id===e.id&&qn===r)return $n}return FS.lookup(e,r)},createNode(e,r,M,fe){var $n=new FS.FSNode(e,r,M,fe);return FS.hashAddNode($n),$n},destroyNode(e){FS.hashRemoveNode(e)},isRoot(e){return e===e.parent},isMountpoint(e){return!!e.mounted},isFile(e){return(e&61440)===32768},isDir(e){return(e&61440)===16384},isLink(e){return(e&61440)===40960},isChrdev(e){return(e&61440)===8192},isBlkdev(e){return(e&61440)===24576},isFIFO(e){return(e&61440)===4096},isSocket(e){return(e&49152)===49152},flagsToPermissionString(e){var r=["r","w","rw"][e&3];return e&512&&(r+="w"),r},nodePermissions(e,r){return FS.ignorePermissions?0:r.includes("r")&&!(e.mode&292)||r.includes("w")&&!(e.mode&146)||r.includes("x")&&!(e.mode&73)?2:0},mayLookup(e){if(!FS.isDir(e.mode))return 54;var r=FS.nodePermissions(e,"x");return r||(e.node_ops.lookup?0:2)},mayCreate(e,r){if(!FS.isDir(e.mode))return 54;try{return FS.lookupNode(e,r),20}catch{}return FS.nodePermissions(e,"wx")},mayDelete(e,r,M){var fe;try{fe=FS.lookupNode(e,r)}catch(qn){return qn.errno}var $n=FS.nodePermissions(e,"wx");if($n)return $n;if(M){if(!FS.isDir(fe.mode))return 54;if(FS.isRoot(fe)||FS.getPath(fe)===FS.cwd())return 10}else if(FS.isDir(fe.mode))return 31;return 0},mayOpen(e,r){if(!e)return 44;if(FS.isLink(e.mode))return 32;var M=FS.flagsToPermissionString(r);return FS.isDir(e.mode)&&(M!=="r"||r&576)?31:FS.nodePermissions(e,M)},checkOpExists(e,r){if(!e)throw new FS.ErrnoError(r);return e},MAX_OPEN_FDS:4096,nextfd(){for(var e=0;e<=FS.MAX_OPEN_FDS;e++)if(!FS.streams[e])return e;throw new FS.ErrnoError(33)},getStreamChecked(e){var r=FS.getStream(e);if(!r)throw new FS.ErrnoError(8);return r},getStream:e=>FS.streams[e],createStream(e,r=-1){return e=Object.assign(new FS.FSStream,e),r==-1&&(r=FS.nextfd()),e.fd=r,FS.streams[r]=e,e},closeStream(e){FS.streams[e]=null},dupStream(e,r=-1){var M=FS.createStream(e,r);return M.stream_ops?.dup?.(M),M},doSetAttr(e,r,M){var fe=e?.stream_ops.setattr,$n=fe?e:r;fe??(fe=r.node_ops.setattr),FS.checkOpExists(fe,63);try{fe($n,M)}catch(qn){throw qn instanceof RangeError?new FS.ErrnoError(22):qn}},chrdev_stream_ops:{open(e){var r=FS.getDevice(e.node.rdev);e.stream_ops=r.stream_ops,e.stream_ops.open?.(e)},llseek(){throw new FS.ErrnoError(70)}},major:e=>e>>8,minor:e=>e&255,makedev:(e,r)=>e<<8|r,registerDevice(e,r){FS.devices[e]={stream_ops:r}},getDevice:e=>FS.devices[e],getMounts(e){for(var r=[],M=[e];M.length;){var fe=M.pop();r.push(fe),M.push(...fe.mounts)}return r},syncfs(e,r){typeof e=="function"&&(r=e,e=!1),FS.syncFSRequests++,FS.syncFSRequests>1&&err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);var M=FS.getMounts(FS.root.mount),fe=0;function $n(Wn){return FS.syncFSRequests--,r(Wn)}function qn(Wn){if(Wn)return qn.errored?void 0:(qn.errored=!0,$n(Wn));++fe>=M.length&&$n(null)}for(var jn of M)jn.type.syncfs?jn.type.syncfs(jn,e,qn):qn(null)},mount(e,r,M){var fe=M==="/",$n=!M,qn;if(fe&&FS.root)throw new FS.ErrnoError(10);if(!fe&&!$n){var jn=FS.lookupPath(M,{follow_mount:!1});if(M=jn.path,qn=jn.node,FS.isMountpoint(qn))throw new FS.ErrnoError(10);if(!FS.isDir(qn.mode))throw new FS.ErrnoError(54)}var Wn={type:e,opts:r,mountpoint:M,mounts:[]},Yn=e.mount(Wn);return Yn.mount=Wn,Wn.root=Yn,fe?FS.root=Yn:qn&&(qn.mounted=Wn,qn.mount&&qn.mount.mounts.push(Wn)),Yn},unmount(e){var r=FS.lookupPath(e,{follow_mount:!1});if(!FS.isMountpoint(r.node))throw new FS.ErrnoError(28);var M=r.node,fe=M.mounted,$n=FS.getMounts(fe);for(var[qn,jn]of Object.entries(FS.nameTable))for(;jn;){var Wn=jn.name_next;$n.includes(jn.mount)&&FS.destroyNode(jn),jn=Wn}M.mounted=null;var Yn=M.mount.mounts.indexOf(fe);M.mount.mounts.splice(Yn,1)},lookup(e,r){return e.node_ops.lookup(e,r)},mknod(e,r,M){var fe=FS.lookupPath(e,{parent:!0}),$n=fe.node,qn=PATH.basename(e);if(!qn)throw new FS.ErrnoError(28);if(qn==="."||qn==="..")throw new FS.ErrnoError(20);var jn=FS.mayCreate($n,qn);if(jn)throw new FS.ErrnoError(jn);if(!$n.node_ops.mknod)throw new FS.ErrnoError(63);return $n.node_ops.mknod($n,qn,r,M)},statfs(e){return FS.statfsNode(FS.lookupPath(e,{follow:!0}).node)},statfsStream(e){return FS.statfsNode(e.node)},statfsNode(e){var r={bsize:4096,frsize:4096,blocks:1e6,bfree:5e5,bavail:5e5,files:FS.nextInode,ffree:FS.nextInode-1,fsid:42,flags:2,namelen:255};return e.node_ops.statfs&&Object.assign(r,e.node_ops.statfs(e.mount.opts.root)),r},create(e,r=438){return r&=4095,r|=32768,FS.mknod(e,r,0)},mkdir(e,r=511){return r&=1023,r|=16384,FS.mknod(e,r,0)},mkdirTree(e,r=511){var M=e.split("/"),fe="";for(var $n of M)if($n){(fe||PATH.isAbs(e))&&(fe+="/"),fe+=$n;try{FS.mkdir(fe,r)}catch(qn){if(qn.errno!=20)throw qn}}},mkdev(e,r,M){return typeof M>"u"&&(M=r,r=438),r|=8192,FS.mknod(e,r,M)},symlink(e,r){if(!PATH_FS.resolve(e))throw new FS.ErrnoError(44);var M=FS.lookupPath(r,{parent:!0}),fe=M.node;if(!fe)throw new FS.ErrnoError(44);var $n=PATH.basename(r),qn=FS.mayCreate(fe,$n);if(qn)throw new FS.ErrnoError(qn);if(!fe.node_ops.symlink)throw new FS.ErrnoError(63);return fe.node_ops.symlink(fe,$n,e)},link(e,r,M){var fe=FS.lookupPath(r,{parent:!0}),$n=fe.node;if(!$n)throw new FS.ErrnoError(44);var qn=PATH.basename(r),jn=FS.mayCreate($n,qn);if(jn)throw new FS.ErrnoError(jn);if(!$n.node_ops.link)throw new FS.ErrnoError(34);return $n.node_ops.link($n,qn,e,M)},rename(e,r){var M=PATH.dirname(e),fe=PATH.dirname(r),$n=PATH.basename(e),qn=PATH.basename(r),jn,Wn,Yn;if(jn=FS.lookupPath(e,{parent:!0}),Wn=jn.node,jn=FS.lookupPath(r,{parent:!0}),Yn=jn.node,!Wn||!Yn)throw new FS.ErrnoError(44);if(Wn.mount!==Yn.mount)throw new FS.ErrnoError(75);var Xn=FS.lookupNode(Wn,$n),Kn=PATH_FS.relative(e,fe);if(Kn.charAt(0)!==".")throw new FS.ErrnoError(28);if(Kn=PATH_FS.relative(r,M),Kn.charAt(0)!==".")throw new FS.ErrnoError(55);var er;try{er=FS.lookupNode(Yn,qn)}catch{}if(Xn!==er){var nr=FS.isDir(Xn.mode),Zn=FS.mayDelete(Wn,$n,nr);if(Zn)throw new FS.ErrnoError(Zn);if(Zn=er?FS.mayDelete(Yn,qn,nr):FS.mayCreate(Yn,qn),Zn)throw new FS.ErrnoError(Zn);if(!Wn.node_ops.rename)throw new FS.ErrnoError(63);if(FS.isMountpoint(Xn)||er&&FS.isMountpoint(er))throw new FS.ErrnoError(10);if(Yn!==Wn&&(Zn=FS.nodePermissions(Wn,"w"),Zn))throw new FS.ErrnoError(Zn);FS.hashRemoveNode(Xn);try{Wn.node_ops.rename(Xn,Yn,qn),er&&FS.hashRemoveNode(er),Xn.parent=Yn}catch(rr){throw rr}finally{FS.hashAddNode(Xn)}}},rmdir(e){var r=FS.lookupPath(e,{parent:!0}),M=r.node,fe=PATH.basename(e),$n=FS.lookupNode(M,fe),qn=FS.mayDelete(M,fe,!0);if(qn)throw new FS.ErrnoError(qn);if(!M.node_ops.rmdir)throw new FS.ErrnoError(63);if(FS.isMountpoint($n))throw new FS.ErrnoError(10);M.node_ops.rmdir(M,fe),FS.destroyNode($n)},readdir(e){var r=FS.lookupPath(e,{follow:!0}),M=r.node,fe=FS.checkOpExists(M.node_ops.readdir,54);return fe(M)},unlink(e){var r=FS.lookupPath(e,{parent:!0}),M=r.node;if(!M)throw new FS.ErrnoError(44);var fe=PATH.basename(e),$n=FS.lookupNode(M,fe),qn=FS.mayDelete(M,fe,!1);if(qn)throw new FS.ErrnoError(qn);if(!M.node_ops.unlink)throw new FS.ErrnoError(63);if(FS.isMountpoint($n))throw new FS.ErrnoError(10);M.node_ops.unlink(M,fe),FS.destroyNode($n)},readlink(e){var r=FS.lookupPath(e),M=r.node;if(!M)throw new FS.ErrnoError(44);if(!M.node_ops.readlink)throw new FS.ErrnoError(28);return M.node_ops.readlink(M)},stat(e,r=!1){var M=FS.lookupPath(e,{follow:!r}),fe=M.node,$n=FS.checkOpExists(fe.node_ops.getattr,63);return $n(fe)},fstat(e){var r=FS.getStreamChecked(e),M=r.node,fe=r.stream_ops.getattr,$n=fe?r:M;return fe??(fe=M.node_ops.getattr),FS.checkOpExists(fe,63),fe($n)},lstat(e){return FS.stat(e,!0)},doChmod(e,r,M,fe=!1){FS.doSetAttr(e,r,{mode:M&4095|r.mode&-4096,ctime:Date.now(),dontFollow:fe})},chmod(e,r,M=!1){var fe;if(typeof e=="string"){var $n=FS.lookupPath(e,{follow:!M});fe=$n.node}else fe=e;FS.doChmod(null,fe,r,M)},lchmod(e,r){FS.chmod(e,r,!0)},fchmod(e,r){var M=FS.getStreamChecked(e);FS.doChmod(M,M.node,r,!1)},doChown(e,r,M=!1){FS.doSetAttr(e,r,{timestamp:Date.now(),dontFollow:M})},chown(e,r,M,fe=!1){var $n;if(typeof e=="string"){var qn=FS.lookupPath(e,{follow:!fe});$n=qn.node}else $n=e;FS.doChown(null,$n,fe)},lchown(e,r,M){FS.chown(e,r,M,!0)},fchown(e,r,M){var fe=FS.getStreamChecked(e);FS.doChown(fe,fe.node,!1)},doTruncate(e,r,M){if(FS.isDir(r.mode))throw new FS.ErrnoError(31);if(!FS.isFile(r.mode))throw new FS.ErrnoError(28);var fe=FS.nodePermissions(r,"w");if(fe)throw new FS.ErrnoError(fe);FS.doSetAttr(e,r,{size:M,timestamp:Date.now()})},truncate(e,r){if(r<0)throw new FS.ErrnoError(28);var M;if(typeof e=="string"){var fe=FS.lookupPath(e,{follow:!0});M=fe.node}else M=e;FS.doTruncate(null,M,r)},ftruncate(e,r){var M=FS.getStreamChecked(e);if(r<0||(M.flags&2097155)===0)throw new FS.ErrnoError(28);FS.doTruncate(M,M.node,r)},utime(e,r,M,fe=!1){var $n=FS.lookupPath(e,{follow:!fe});FS.doSetAttr(null,$n.node,{atime:r,mtime:M,dontFollow:fe})},open(e,r,M=438){if(e==="")throw new FS.ErrnoError(44);r=FS_modeStringToFlags(r),r&64?M=M&4095|32768:M=0;var fe,$n;if(typeof e=="object")fe=e;else{$n=e.endsWith("/");var qn=FS.lookupPath(e,{follow:!(r&131072),noent_okay:!0});fe=qn.node,e=qn.path}var jn=!1;if(r&64)if(fe){if(r&128)throw new FS.ErrnoError(20)}else{if($n)throw new FS.ErrnoError(31);fe=FS.mknod(e,M|511,0),jn=!0}if(!fe)throw new FS.ErrnoError(44);if(FS.isChrdev(fe.mode)&&(r&=-513),r&65536&&!FS.isDir(fe.mode))throw new FS.ErrnoError(54);if(!jn){var Wn=FS.mayOpen(fe,r);if(Wn)throw new FS.ErrnoError(Wn)}r&512&&!jn&&FS.truncate(fe,0),r&=-131713;var Yn=FS.createStream({node:fe,path:FS.getPath(fe),flags:r,seekable:!0,position:0,stream_ops:fe.stream_ops,ungotten:[],error:!1});return Yn.stream_ops.open&&Yn.stream_ops.open(Yn),jn&&FS.chmod(fe,M&511),Yn},close(e){if(FS.isClosed(e))throw new FS.ErrnoError(8);e.getdents&&(e.getdents=null),e.node?.notifyListeners(32);try{e.stream_ops.close&&e.stream_ops.close(e)}catch(r){throw r}finally{FS.closeStream(e.fd)}e.fd=null},isClosed(e){return e.fd===null},llseek(e,r,M){if(FS.isClosed(e))throw new FS.ErrnoError(8);if(!e.seekable||!e.stream_ops.llseek)throw new FS.ErrnoError(70);if(M!=0&&M!=1&&M!=2)throw new FS.ErrnoError(28);return e.position=e.stream_ops.llseek(e,r,M),e.ungotten=[],e.position},read(e,r,M,fe,$n){if(fe<0||$n<0)throw new FS.ErrnoError(28);if(FS.isClosed(e))throw new FS.ErrnoError(8);if((e.flags&2097155)===1)throw new FS.ErrnoError(8);if(FS.isDir(e.node.mode))throw new FS.ErrnoError(31);if(!e.stream_ops.read)throw new FS.ErrnoError(28);var qn=typeof $n<"u";if(!qn)$n=e.position;else if(!e.seekable)throw new FS.ErrnoError(70);var jn=e.stream_ops.read(e,r,M,fe,$n);return qn||(e.position+=jn),jn},write(e,r,M,fe,$n,qn){if(fe<0||$n<0)throw new FS.ErrnoError(28);if(FS.isClosed(e))throw new FS.ErrnoError(8);if((e.flags&2097155)===0)throw new FS.ErrnoError(8);if(FS.isDir(e.node.mode))throw new FS.ErrnoError(31);if(!e.stream_ops.write)throw new FS.ErrnoError(28);e.seekable&&e.flags&1024&&FS.llseek(e,0,2);var jn=typeof $n<"u";if(!jn)$n=e.position;else if(!e.seekable)throw new FS.ErrnoError(70);var Wn=e.stream_ops.write(e,r,M,fe,$n,qn);return jn||(e.position+=Wn),Wn},mmap(e,r,M,fe,$n){if(fe&2&&!($n&2)&&(e.flags&2097155)!==2)throw new FS.ErrnoError(2);if((e.flags&2097155)===1)throw new FS.ErrnoError(2);if(!e.stream_ops.mmap)throw new FS.ErrnoError(43);if(!r)throw new FS.ErrnoError(28);return e.stream_ops.mmap(e,r,M,fe,$n)},msync(e,r,M,fe,$n){return e.stream_ops.msync?e.stream_ops.msync(e,r,M,fe,$n):0},ioctl(e,r,M){if(!e.stream_ops.ioctl)throw new FS.ErrnoError(59);return e.stream_ops.ioctl(e,r,M)},readFile(e,r={}){r.flags??(r.flags=0),r.encoding??(r.encoding="binary"),r.encoding!=="utf8"&&r.encoding!=="binary"&&abort(`Invalid encoding type "${r.encoding}"`);var M=FS.open(e,r.flags),fe=FS.stat(e),$n=fe.size,qn=new Uint8Array($n);return FS.read(M,qn,0,$n,0),r.encoding==="utf8"&&(qn=UTF8ArrayToString(qn)),FS.close(M),qn},writeFile(e,r,M={}){M.flags??(M.flags=577);var fe=FS.open(e,M.flags,M.mode);r=FS_fileDataToTypedArray(r),FS.write(fe,r,0,r.byteLength,void 0,M.canOwn),FS.close(fe)},cwd:()=>FS.currentPath,chdir(e){var r=FS.lookupPath(e,{follow:!0});if(r.node===null)throw new FS.ErrnoError(44);if(!FS.isDir(r.node.mode))throw new FS.ErrnoError(54);var M=FS.nodePermissions(r.node,"x");if(M)throw new FS.ErrnoError(M);FS.currentPath=r.path},createDefaultDirectories(){FS.mkdir("/tmp"),FS.mkdir("/home"),FS.mkdir("/home/web_user")},createDefaultDevices(){FS.mkdir("/dev"),FS.registerDevice(FS.makedev(1,3),{read:()=>0,write:(fe,$n,qn,jn)=>jn,llseek:()=>0}),FS.mkdev("/dev/null",FS.makedev(1,3)),TTY.register(FS.makedev(5,0),TTY.default_tty_ops),TTY.register(FS.makedev(6,0),TTY.default_tty1_ops),FS.mkdev("/dev/tty",FS.makedev(5,0)),FS.mkdev("/dev/tty1",FS.makedev(6,0));var e=new Uint8Array(1024),r=0,M=()=>(r||(randomFill(e),r=e.byteLength),e[--r]);FS.createDevice("/dev","random",M),FS.createDevice("/dev","urandom",M),FS.mkdir("/dev/shm"),FS.mkdir("/dev/shm/tmp")},createSpecialDirectories(){FS.mkdir("/proc");var e=FS.mkdir("/proc/self");FS.mkdir("/proc/self/fd"),FS.mount({mount(){var r=FS.createNode(e,"fd",16895,73);return r.stream_ops={llseek:MEMFS.stream_ops.llseek},r.node_ops={lookup(M,fe){var $n=+fe,qn=FS.getStreamChecked($n),jn={parent:null,mount:{mountpoint:"fake"},node_ops:{readlink:()=>qn.path},id:$n+1};return jn.parent=jn,jn},readdir(){return Array.from(FS.streams.entries()).filter(([M,fe])=>fe).map(([M,fe])=>M.toString())}},r}},{},"/proc/self/fd")},createStandardStreams(e,r,M){e?FS.createDevice("/dev","stdin",e):FS.symlink("/dev/tty","/dev/stdin"),r?FS.createDevice("/dev","stdout",null,r):FS.symlink("/dev/tty","/dev/stdout"),M?FS.createDevice("/dev","stderr",null,M):FS.symlink("/dev/tty1","/dev/stderr"),FS.open("/dev/stdin",0),FS.open("/dev/stdout",1),FS.open("/dev/stderr",1)},staticInit(){FS.nameTable.length=4096,FS.mount(MEMFS,{},"/"),FS.createDefaultDirectories(),FS.createDefaultDevices(),FS.createSpecialDirectories()},init(e,r,M){FS.initialized=!0,e??(e=Module.stdin),r??(r=Module.stdout),M??(M=Module.stderr),FS.createStandardStreams(e,r,M)},quit(){FS.initialized=!1,_fflush(0);for(var e of FS.streams)e&&FS.close(e)},analyzePath(e,r=!1){try{var M=FS.lookupPath(e,{follow:!r});e=M.path}catch{}var fe={isRoot:!1,exists:!1,error:0,name:null,path:null,object:null,parentExists:!1,parentPath:null,parentObject:null};try{M=FS.lookupPath(e,{parent:!0}),fe.parentExists=!0,fe.parentPath=M.path,fe.parentObject=M.node,fe.name=PATH.basename(e),M=FS.lookupPath(e,{follow:!r}),fe.exists=!0,fe.path=M.path,fe.object=M.node,fe.name=M.node.name,fe.isRoot=M.path==="/"}catch($n){fe.error=$n.errno}return fe},createPath(e,r,M,fe){e=typeof e=="string"?e:FS.getPath(e);for(var $n=r.split("/").reverse();$n.length;){var qn=$n.pop();if(qn){var jn=PATH.join2(e,qn);try{FS.mkdir(jn)}catch(Wn){if(Wn.errno!=20)throw Wn}e=jn}}return jn},createFile(e,r,M,fe,$n){var qn=PATH.join2(typeof e=="string"?e:FS.getPath(e),r),jn=FS_getMode(fe,$n);return FS.create(qn,jn)},createDataFile(e,r,M,fe,$n,qn){var jn=r;e&&(e=typeof e=="string"?e:FS.getPath(e),jn=r?PATH.join2(e,r):e);var Wn=FS_getMode(fe,$n),Yn=FS.create(jn,Wn);if(M){M=FS_fileDataToTypedArray(M),FS.chmod(Yn,Wn|146);var Xn=FS.open(Yn,577);FS.write(Xn,M,0,M.length,0,qn),FS.close(Xn),FS.chmod(Yn,Wn)}},createDevice(e,r,M,fe){var $n,qn=PATH.join2(typeof e=="string"?e:FS.getPath(e),r),jn=FS_getMode(!!M,!!fe);($n=FS.createDevice).major??($n.major=64);var Wn=FS.makedev(FS.createDevice.major++,0);return FS.registerDevice(Wn,{open(Yn){Yn.seekable=!1},close(Yn){fe?.buffer?.length&&fe(10)},read(Yn,Xn,Kn,er,nr){for(var Zn=0,rr=0;rr<er;rr++){var sr;try{sr=M()}catch{throw new FS.ErrnoError(29)}if(sr===void 0&&!Zn)throw new FS.ErrnoError(6);if(sr==null)break;Zn++,Xn[Kn+rr]=sr}return Zn&&(Yn.node.atime=Date.now()),Zn},write(Yn,Xn,Kn,er,nr){for(var Zn=0;Zn<er;Zn++)try{fe(Xn[Kn+Zn])}catch{throw new FS.ErrnoError(29)}return er&&(Yn.node.mtime=Yn.node.ctime=Date.now()),Zn}}),FS.mkdev(qn,jn,Wn)},forceLoadFile(e){if(e.isDevice||e.isFolder||e.link||e.contents)return!0;if(globalThis.XMLHttpRequest)abort("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");else try{e.contents=readBinary(e.url)}catch{throw new FS.ErrnoError(29)}},createLazyFile(e,r,M,fe,$n){class qn{constructor(){P$2(this,"lengthKnown",!1),P$2(this,"chunks",[])}get(nr){if(!(nr>this.length-1||nr<0)){var Zn=nr%this.chunkSize,rr=nr/this.chunkSize|0;return this.getter(rr)[Zn]}}setDataGetter(nr){this.getter=nr}cacheLength(){var nr=new XMLHttpRequest;nr.open("HEAD",M,!1),nr.send(null),nr.status>=200&&nr.status<300||nr.status===304||abort(`Couldn't load ${M}. Status: ${nr.status}`);var Zn=Number(nr.getResponseHeader("Content-length")),rr,sr=(rr=nr.getResponseHeader("Accept-Ranges"))&&rr==="bytes",or=(rr=nr.getResponseHeader("Content-Encoding"))&&rr==="gzip",ir=1048576;sr||(ir=Zn);var Jn=(ar,dr)=>{ar>dr&&abort(`invalid range (${ar}, ${dr}) or no bytes requested!`),dr>Zn-1&&abort(`only ${Zn} bytes available! programmer error!`);var lr=new XMLHttpRequest;return lr.open("GET",M,!1),Zn!==ir&&lr.setRequestHeader("Range",`bytes=${ar}-${dr}`),lr.responseType="arraybuffer",lr.overrideMimeType&&lr.overrideMimeType("text/plain; charset=x-user-defined"),lr.send(null),lr.status>=200&&lr.status<300||lr.status===304||abort(`Couldn't load ${M}. Status: ${lr.status}`),lr.response!==void 0?new Uint8Array(lr.response||[]):intArrayFromString(lr.responseText??"")},tr=this;tr.setDataGetter(ar=>{var dr=ar*ir,lr=(ar+1)*ir-1;return lr=Math.min(lr,Zn-1),typeof tr.chunks[ar]>"u"&&(tr.chunks[ar]=Jn(dr,lr)),typeof tr.chunks[ar]>"u"&&abort("doXHR failed!"),tr.chunks[ar]}),(or||!Zn)&&(ir=Zn=1,Zn=this.getter(0).length,ir=Zn,out("LazyFiles on gzip forces download of the whole file when length is accessed")),this._length=Zn,this._chunkSize=ir,this.lengthKnown=!0}get length(){return this.lengthKnown||this.cacheLength(),this._length}get chunkSize(){return this.lengthKnown||this.cacheLength(),this._chunkSize}}if(globalThis.XMLHttpRequest){ENVIRONMENT_IS_WORKER||abort("Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc");var jn=new qn,Wn={isDevice:!1,contents:jn}}else Wn={isDevice:!1,url:M};var Yn=FS.createFile(e,r,Wn,fe,$n);Wn.contents?Yn.contents=Wn.contents:Wn.url&&(Yn.contents=null,Yn.url=Wn.url),Object.defineProperties(Yn,{usedBytes:{get:function(){return this.contents.length}}});var Xn={};for(let[er,nr]of Object.entries(Yn.stream_ops))Xn[er]=(...Zn)=>(FS.forceLoadFile(Yn),nr(...Zn));function Kn(er,nr,Zn,rr,sr){var or=er.node.contents;if(sr>=or.length)return 0;var ir=Math.min(or.length-sr,rr);if(or.slice)for(var Jn=0;Jn<ir;Jn++)nr[Zn+Jn]=or[sr+Jn];else for(Jn=0;Jn<ir;Jn++)nr[Zn+Jn]=or.get(sr+Jn);return ir}return Xn.read=(er,nr,Zn,rr,sr)=>(FS.forceLoadFile(Yn),Kn(er,nr,Zn,rr,sr)),Xn.mmap=(er,nr,Zn)=>{FS.forceLoadFile(Yn);var rr=mmapAlloc(nr);if(!rr)throw new FS.ErrnoError(48);return Kn(er,HEAP8,rr,nr,Zn),{ptr:rr,allocated:!0}},Yn.stream_ops=Xn,Yn}},findLibraryFS=(e,r)=>{if(runtimeInitialized){if(PATH.isAbs(e))try{return FS.lookupPath(e),e}catch{return}var M=(r?.paths||[]).map(fe=>replaceORIGIN(r?.parentLibPath,fe));return withStackSave(()=>{var fe=stackAlloc(512),$n=stringToUTF8OnStack(M.join(":")),qn=stringToUTF8OnStack(e),jn=__emscripten_find_dylib(fe,$n,qn,512);return jn?UTF8ToString(jn):void 0})}};function loadDynamicLibrary(e,r={global:!0,nodelete:!0},M,fe){var $n=LDSO.loadedLibsByName[e];if($n)return r.global?$n.global||($n.global=!0,mergeLibSymbols($n.exports)):M&&Object.assign(M,$n.exports),r.nodelete&&$n.refcount!==1/0&&($n.refcount=1/0),$n.refcount++,fe&&(LDSO.loadedLibsByHandle[fe]=$n),r.loadAsync?Promise.resolve(!0):!0;$n=newDSO(e,fe,"loading"),$n.refcount=r.nodelete?1/0:1,$n.global=r.global;function qn(){if(fe){var Yn=HEAPU32[fe+28>>2],Xn=HEAPU32[fe+32>>2];if(Yn&&Xn){var Kn=HEAP8.slice(Yn,Yn+Xn);return r.loadAsync?Promise.resolve(Kn):Kn}}var er=findLibraryFS(e,r.rpath);if(er)return Kn=FS.readFile(er,{encoding:"binary"}),r.loadAsync?Promise.resolve(Kn):Kn;var nr=locateFile(e);if(r.loadAsync)return asyncLoad(nr);if(!readBinary)throw new Error(`${nr}: file not found, and synchronous loading of external files is not available`);return readBinary(nr)}function jn(){var Yn=preloadedWasm[e];return Yn?r.loadAsync?Promise.resolve(Yn):Yn:r.loadAsync?qn().then(Xn=>loadWebAssemblyModule(Xn,r,e,M,fe)):loadWebAssemblyModule(qn(),r,e,M,fe)}function Wn(Yn){$n.global?mergeLibSymbols(Yn):M&&Object.assign(M,Yn),$n.exports=Yn}return r.loadAsync?jn().then(Yn=>(Wn(Yn),!0)):(Wn(jn()),!0)}var reportUndefinedSymbols=()=>{for(var[e,r]of Object.entries(GOT))if(r.value==-1){var M=resolveGlobalSymbol(e).sym;if(!M&&!r.required){r.value=0;continue}if(typeof M=="function")r.value=addFunction(M,M.sig);else if(typeof M=="number")r.value=M;else if(typeof M.value=="number")r.value=M;else throw new Error(`bad export type for '${e}': ${typeof M} (${M})`)}},loadDylibs=async()=>{if(!dynamicLibraries.length){reportUndefinedSymbols();return}for(var e of dynamicLibraries)await loadDynamicLibrary(e,{loadAsync:!0,global:!0,nodelete:!0,allowUndefined:!0});reportUndefinedSymbols()},noExitRuntime=!1;function setValue(e,r,M="i8"){switch(M.endsWith("*")&&(M="*"),M){case"i1":HEAP8[e]=r;break;case"i8":HEAP8[e]=r;break;case"i16":HEAP16[e>>1]=r;break;case"i32":HEAP32[e>>2]=r;break;case"i64":HEAP64[e>>3]=BigInt(r);break;case"float":HEAPF32[e>>2]=r;break;case"double":HEAPF64[e>>3]=r;break;case"*":HEAPU32[e>>2]=r;break;default:abort(`invalid type for setValue: ${M}`)}}var wasmMemory,___assert_fail=(e,r,M,fe)=>abort(`Assertion failed: ${UTF8ToString(e)}, at: `+[r?UTF8ToString(r):"unknown filename",M,fe?UTF8ToString(fe):"unknown function"]);___assert_fail.sig="vppip";var ___call_sighandler=(e,r)=>getWasmTableEntry(e)(r);___call_sighandler.sig="vpi";var SOCKFS={websocketArgs:{},callbacks:{},on(e,r){SOCKFS.callbacks[e]=r},emit(e,r){SOCKFS.callbacks[e]?.(r);var M=e==="error"?r[0]:r,fe={message:65,open:4,connection:65,close:17,error:8}[e];fe&&FS.getStream(M)?.node.notifyListeners(fe)},mount(e){return SOCKFS.websocketArgs=Module.websocket||{},(Module.websocket??(Module.websocket={})).on=SOCKFS.on,FS.createNode(null,"/",16895,0)},createSocket(e,r,M){if(e!=2)throw new FS.ErrnoError(5);if(r&=-526337,r!=1&&r!=2)throw new FS.ErrnoError(28);var fe=r==1;if(fe&&M&&M!=6)throw new FS.ErrnoError(66);var $n={family:e,type:r,protocol:M,server:null,error:null,peers:{},pending:[],recv_queue:[],sock_ops:SOCKFS.websocket_sock_ops},qn=SOCKFS.nextname(),jn=FS.createNode(SOCKFS.root,qn,49152,0);jn.sock=$n;var Wn=FS.createStream({path:qn,node:jn,flags:2,seekable:!1,stream_ops:SOCKFS.stream_ops});return $n.stream=Wn,$n},getSocket(e){var r=FS.getStream(e);return!r||!FS.isSocket(r.node.mode)?null:r.node.sock},stream_ops:{getattr(e){var r=e.node;return{dev:1,ino:r.id,mode:49663,nlink:1,uid:0,gid:0,rdev:0,size:0,atime:new Date(0),mtime:new Date(0),ctime:new Date(0),blksize:4096,blocks:0}},poll(e){var r=e.node.sock;return r.sock_ops.poll(r)},ioctl(e,r,M){var fe=e.node.sock;return fe.sock_ops.ioctl(fe,r,M)},read(e,r,M,fe,$n){var qn=e.node.sock,jn=qn.sock_ops.recvmsg(qn,fe);return jn?(r.set(jn.buffer,M),jn.buffer.length):0},write(e,r,M,fe,$n){var qn=e.node.sock;return qn.sock_ops.sendmsg(qn,r,M,fe)},close(e){var r=e.node.sock;r.sock_ops.close(r)}},nextname(){return SOCKFS.nextname.current||(SOCKFS.nextname.current=0),`socket[${SOCKFS.nextname.current++}]`},websocket_sock_ops:{createPeer(e,r,M){var fe;if(typeof r=="object"&&(fe=r,r=null,M=null),fe)if(fe._socket)r=fe._socket.remoteAddress,M=fe._socket.remotePort;else{var $n=/ws[s]?:\/\/([^:]+):(\d+)/.exec(fe.url);if(!$n)throw new Error("WebSocket URL must be in the format ws(s)://address:port");r=$n[1],M=parseInt($n[2],10)}else try{var qn="ws://".replace("#","//"),jn="binary",Wn=void 0;if(SOCKFS.websocketArgs.url&&(qn=SOCKFS.websocketArgs.url),SOCKFS.websocketArgs.subprotocol?jn=SOCKFS.websocketArgs.subprotocol:SOCKFS.websocketArgs.subprotocol===null&&(jn="null"),qn==="ws://"||qn==="wss://"){var Yn=r.split("/");qn=qn+Yn[0]+":"+M+"/"+Yn.slice(1).join("/")}jn!=="null"&&(jn=jn.replace(/^ +| +$/g,"").split(/ *, */),Wn=jn);var Xn;ENVIRONMENT_IS_NODE?Xn=require("ws"):Xn=WebSocket,fe=new Xn(qn,Wn),fe.binaryType="arraybuffer"}catch{throw new FS.ErrnoError(23)}var Kn={addr:r,port:M,socket:fe,msg_send_queue:[]};return SOCKFS.websocket_sock_ops.addPeer(e,Kn),SOCKFS.websocket_sock_ops.handlePeerEvents(e,Kn),e.type===2&&typeof e.sport<"u"&&Kn.msg_send_queue.push(new Uint8Array([255,255,255,255,112,111,114,116,(e.sport&65280)>>8,e.sport&255])),Kn},getPeer(e,r,M){return e.peers[r+":"+M]},addPeer(e,r){e.peers[r.addr+":"+r.port]=r},removePeer(e,r){delete e.peers[r.addr+":"+r.port]},handlePeerEvents(e,r){var M=!0;function fe(){e.connecting=!1,SOCKFS.emit("open",e.stream.fd);try{for(var qn=r.msg_send_queue.shift();qn;)r.socket.send(qn),qn=r.msg_send_queue.shift()}catch{r.socket.close()}}function $n(qn){if(typeof qn=="string"){var jn=new TextEncoder;qn=jn.encode(qn)}else{if(qn.byteLength==0)return;qn=new Uint8Array(qn)}var Wn=M;if(M=!1,Wn&&qn.length===10&&qn[0]===255&&qn[1]===255&&qn[2]===255&&qn[3]===255&&qn[4]===112&&qn[5]===111&&qn[6]===114&&qn[7]===116){var Yn=qn[8]<<8|qn[9];SOCKFS.websocket_sock_ops.removePeer(e,r),r.port=Yn,SOCKFS.websocket_sock_ops.addPeer(e,r);return}e.recv_queue.push({addr:r.addr,port:r.port,data:qn}),SOCKFS.emit("message",e.stream.fd)}if(ENVIRONMENT_IS_NODE){r.socket.on("open",fe),r.socket.on("message",(qn,jn)=>{jn&&$n(new Uint8Array(qn).buffer)}),r.socket.on("close",()=>SOCKFS.emit("close",e.stream.fd)),r.socket.on("error",()=>{e.error=14,SOCKFS.emit("error",[e.stream.fd,e.error,"ECONNREFUSED: Connection refused"])});return}r.socket.onopen=fe,r.socket.onclose=()=>SOCKFS.emit("close",e.stream.fd),r.socket.onmessage=qn=>$n(qn.data),r.socket.onerror=()=>{e.error=14,SOCKFS.emit("error",[e.stream.fd,e.error,"ECONNREFUSED: Connection refused"])}},poll(e){if(e.type===1&&(e.server||e.listening))return e.error?8:e.server?e.pending.length?65:0:16;var r=0;e.error&&(r|=8);var M=e.type===1?SOCKFS.websocket_sock_ops.getPeer(e,e.daddr,e.dport):null;return(e.recv_queue.length||!M||M&&M.socket.readyState===M.socket.CLOSING||M&&M.socket.readyState===M.socket.CLOSED)&&(r|=65),(!M||M&&M.socket.readyState===M.socket.OPEN)&&(r|=4),(M&&M.socket.readyState===M.socket.CLOSING||M&&M.socket.readyState===M.socket.CLOSED)&&(e.connecting?r|=4:r|=8208),r},ioctl(e,r,M){switch(r){case 21531:var fe=0;return e.recv_queue.length&&(fe=e.recv_queue[0].data.length),HEAP32[M>>2]=fe,0;case 21537:var $n=HEAP32[M>>2];return $n?e.stream.flags|=2048:e.stream.flags&=-2049,0;default:return 28}},close(e){if(e.listening=!1,e.server){try{e.server.close()}catch{}e.server=null}for(var r of Object.values(e.peers)){try{r.socket.close()}catch{}SOCKFS.websocket_sock_ops.removePeer(e,r)}return 0},bind(e,r,M){if(typeof e.saddr<"u"||typeof e.sport<"u")throw new FS.ErrnoError(28);if(e.saddr=r,e.sport=M,e.type===2){e.server&&(e.server.close(),e.server=null);try{e.sock_ops.listen(e,0)}catch(fe){if(fe.name!=="ErrnoError"||fe.errno!==138)throw fe}}},connect(e,r,M){if(e.server)throw new FS.ErrnoError(138);if(typeof e.daddr<"u"&&typeof e.dport<"u"){var fe=SOCKFS.websocket_sock_ops.getPeer(e,e.daddr,e.dport);if(fe)throw fe.socket.readyState===fe.socket.CONNECTING?new FS.ErrnoError(7):new FS.ErrnoError(30)}var $n=SOCKFS.websocket_sock_ops.createPeer(e,r,M);e.daddr=$n.addr,e.dport=$n.port,e.connecting=!0},listen(e,r){if(!ENVIRONMENT_IS_NODE)throw new FS.ErrnoError(138);if(e.server||e.listening)throw new FS.ErrnoError(28);var M=require("ws").Server,fe=e.saddr;e.server=new M({host:fe,port:e.sport}),e.listening=!0,SOCKFS.emit("listen",e.stream.fd),e.server.on("connection",$n=>{if(e.type===1){var qn=SOCKFS.createSocket(e.family,e.type,e.protocol),jn=SOCKFS.websocket_sock_ops.createPeer(qn,$n);qn.daddr=jn.addr,qn.dport=jn.port,e.pending.push(qn),SOCKFS.emit("connection",qn.stream.fd),e.stream.node.notifyListeners(65)}else SOCKFS.websocket_sock_ops.createPeer(e,$n),SOCKFS.emit("connection",e.stream.fd)}),e.server.on("close",()=>{SOCKFS.emit("close",e.stream.fd),e.server=null}),e.server.on("error",$n=>{if(e.error=$n.code&&ERRNO_CODES[$n.code]||29,SOCKFS.emit("error",[e.stream.fd,e.error,$n.message||$n.code||"Server error"]),e.server){try{e.server.close()}catch{}e.server=null}})},accept(e){if(e.error){var r=e.error;throw e.error=null,new FS.ErrnoError(r)}if(!e.server||!e.pending.length)throw new FS.ErrnoError(28);var M=e.pending.shift();return M.stream.flags=e.stream.flags,M},getname(e,r){var M,fe;if(r){if(e.daddr===void 0||e.dport===void 0)throw new FS.ErrnoError(53);M=e.daddr,fe=e.dport}else M=e.saddr||0,fe=e.sport||0;return{addr:M,port:fe}},sendmsg(e,r,M,fe,$n,qn){if(e.type===2){if(($n===void 0||qn===void 0)&&($n=e.daddr,qn=e.dport),$n===void 0||qn===void 0)throw new FS.ErrnoError(17)}else $n=e.daddr,qn=e.dport;var jn=SOCKFS.websocket_sock_ops.getPeer(e,$n,qn);if(e.type===1&&(!jn||jn.socket.readyState===jn.socket.CLOSING||jn.socket.readyState===jn.socket.CLOSED))throw new FS.ErrnoError(53);ArrayBuffer.isView(r)&&(M+=r.byteOffset,r=r.buffer);var Wn=r.slice(M,M+fe);if(!jn||jn.socket.readyState!==jn.socket.OPEN)return e.type===2&&(!jn||jn.socket.readyState===jn.socket.CLOSING||jn.socket.readyState===jn.socket.CLOSED)&&(jn=SOCKFS.websocket_sock_ops.createPeer(e,$n,qn)),jn.msg_send_queue.push(Wn),fe;try{return jn.socket.send(Wn),fe}catch{throw new FS.ErrnoError(28)}},recvmsg(e,r,M){if(e.type===1&&e.server)throw new FS.ErrnoError(53);var fe=M&2,$n=e.recv_queue[0];if(!$n){if(e.type===1){var qn=SOCKFS.websocket_sock_ops.getPeer(e,e.daddr,e.dport);if(!qn)throw new FS.ErrnoError(53);if(qn.socket.readyState===qn.socket.CLOSING||qn.socket.readyState===qn.socket.CLOSED)return null;throw new FS.ErrnoError(6)}throw new FS.ErrnoError(6)}var jn=$n.data.byteLength||$n.data.length,Wn=$n.data.byteOffset||0,Yn=$n.data.buffer||$n.data,Xn=Math.min(r,jn),Kn={buffer:new Uint8Array(Yn,Wn,Xn),addr:$n.addr,port:$n.port};if(fe)return Kn;if(e.recv_queue.shift(),e.type===1&&Xn<jn){var er=jn-Xn;$n.data=new Uint8Array(Yn,Wn+Xn,er),e.recv_queue.unshift($n)}return Kn}}},getSocketFromFD=e=>{var r=SOCKFS.getSocket(e);if(!r)throw new FS.ErrnoError(8);return r},inetPton4=e=>{for(var r=e.split("."),M=0;M<4;M++){var fe=Number(r[M]);if(isNaN(fe))return null;r[M]=fe}return(r[0]|r[1]<<8|r[2]<<16|r[3]<<24)>>>0},inetPton6=e=>{var r,M,fe,$n,qn=[];if(!/^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i.test(e))return null;if(e==="::")return[0,0,0,0,0,0,0,0];for(e.startsWith("::")?e=e.replace("::","Z:"):e=e.replace("::",":Z:"),e.indexOf(".")>0?(e=e.replace(new RegExp("[.]","g"),":"),r=e.split(":"),r[r.length-4]=Number(r[r.length-4])+Number(r[r.length-3])*256,r[r.length-3]=Number(r[r.length-2])+Number(r[r.length-1])*256,r=r.slice(0,r.length-2)):r=e.split(":"),fe=0,$n=0,M=0;M<r.length;M++)if(typeof r[M]=="string")if(r[M]==="Z"){for($n=0;$n<8-r.length+1;$n++)qn[M+$n]=0;fe=$n-1}else qn[M+fe]=_htons(parseInt(r[M],16));else qn[M+fe]=r[M];return[qn[1]<<16|qn[0],qn[3]<<16|qn[2],qn[5]<<16|qn[4],qn[7]<<16|qn[6]]},DNS={address_map:{id:1,addrs:{},names:{}},lookup_name(e){var r=inetPton4(e);if(r!==null||(r=inetPton6(e),r!==null))return e;var M;if(DNS.address_map.addrs[e])M=DNS.address_map.addrs[e];else{var fe=DNS.address_map.id++;M="172.29."+(fe&255)+"."+(fe&65280),DNS.address_map.names[M]=e,DNS.address_map.addrs[e]=M}return M},lookup_addr(e){return DNS.address_map.names[e]?DNS.address_map.names[e]:null}},writeSockaddr=(e,r,M,fe,$n)=>{switch(r){case 2:M=inetPton4(DNS.lookup_name(M)),zeroMemory(e,16),$n&&(HEAP32[$n>>2]=16),HEAP16[e>>1]=r,HEAP32[e+4>>2]=M,HEAP16[e+2>>1]=_htons(fe);break;case 10:M=inetPton6(DNS.lookup_name(M)),zeroMemory(e,28),$n&&(HEAP32[$n>>2]=28),HEAP32[e>>2]=r,HEAP32[e+8>>2]=M[0],HEAP32[e+12>>2]=M[1],HEAP32[e+16>>2]=M[2],HEAP32[e+20>>2]=M[3],HEAP16[e+2>>1]=_htons(fe);break;default:return 5}return 0};function ___syscall_accept4(e,r,M){try{var fe=getSocketFromFD(e),$n=fe.sock_ops.accept(fe);return r&&writeSockaddr(r,$n.family,$n.daddr,$n.dport,M),$n.stream.fd}catch(qn){if(typeof FS>"u"||qn.name!=="ErrnoError")throw qn;return-qn.errno}}___syscall_accept4.sig="iippiii";var inetNtop4=e=>(e&255)+"."+(e>>8&255)+"."+(e>>16&255)+"."+(e>>24&255),inetNtop6=e=>{var r="",M=0,fe=0,$n=0,qn=0,jn=0,Wn=0,Yn=[e[0]&65535,e[0]>>16,e[1]&65535,e[1]>>16,e[2]&65535,e[2]>>16,e[3]&65535,e[3]>>16],Xn=!0,Kn="";for(Wn=0;Wn<5;Wn++)if(Yn[Wn]){Xn=!1;break}if(Xn){if(Kn=inetNtop4(Yn[6]|Yn[7]<<16),Yn[5]===-1)return r="::ffff:",r+=Kn,r;if(!Yn[5])return r="::",Kn==="0.0.0.0"&&(Kn=""),Kn==="0.0.0.1"&&(Kn="1"),r+=Kn,r}for(M=0;M<8;M++)Yn[M]||(M-$n>1&&(jn=0),$n=M,jn++),jn>fe&&(fe=jn,qn=M-fe+1);for(M=0;M<8;M++){if(fe>1&&!Yn[M]&&M>=qn&&M<qn+fe){M===qn&&(r+=":",qn||(r+=":"));continue}r+=Number(_ntohs(Yn[M]&65535)).toString(16),r+=M<7?":":""}return r},readSockaddr=(e,r)=>{var M=HEAP16[e>>1],fe=_ntohs(HEAPU16[e+2>>1]),$n;switch(M){case 2:if(r!==16)return{errno:28};$n=HEAP32[e+4>>2],$n=inetNtop4($n);break;case 10:if(r!==28)return{errno:28};$n=[HEAP32[e+8>>2],HEAP32[e+12>>2],HEAP32[e+16>>2],HEAP32[e+20>>2]],$n=inetNtop6($n);break;default:return{errno:5}}return{family:M,addr:$n,port:fe}},getSocketAddress=(e,r)=>{var M=readSockaddr(e,r);if(M.errno)throw new FS.ErrnoError(M.errno);return M.addr=DNS.lookup_addr(M.addr)||M.addr,M};function ___syscall_bind(e,r,M){try{var fe=getSocketFromFD(e),$n=getSocketAddress(r,M);return fe.sock_ops.bind(fe,$n.addr,$n.port),0}catch(qn){if(typeof FS>"u"||qn.name!=="ErrnoError")throw qn;return-qn.errno}}___syscall_bind.sig="iipiiii";var SYSCALLS={currentUmask:18,calculateAt(e,r,M=!1){if(PATH.isAbs(r))return r;var fe;if(e===-100)fe=FS.cwd();else{var $n=SYSCALLS.getStreamFromFD(e);fe=$n.path}if(r.length==0){if(!M)throw new FS.ErrnoError(44);return fe}return fe+"/"+r},writeStat(e,r){HEAPU32[e>>2]=r.dev,HEAPU32[e+4>>2]=r.mode,HEAPU32[e+8>>2]=r.nlink,HEAPU32[e+12>>2]=r.uid,HEAPU32[e+16>>2]=r.gid,HEAPU32[e+20>>2]=r.rdev,HEAP64[e+24>>3]=BigInt(r.size),HEAP32[e+32>>2]=4096,HEAP32[e+36>>2]=r.blocks;var M=r.atime.getTime(),fe=r.mtime.getTime(),$n=r.ctime.getTime();return HEAP64[e+40>>3]=BigInt(Math.floor(M/1e3)),HEAPU32[e+48>>2]=M%1e3*1e3*1e3,HEAP64[e+56>>3]=BigInt(Math.floor(fe/1e3)),HEAPU32[e+64>>2]=fe%1e3*1e3*1e3,HEAP64[e+72>>3]=BigInt(Math.floor($n/1e3)),HEAPU32[e+80>>2]=$n%1e3*1e3*1e3,HEAP64[e+88>>3]=BigInt(r.ino),0},writeStatFs(e,r){HEAPU32[e+4>>2]=r.bsize,HEAPU32[e+60>>2]=r.bsize,HEAP64[e+8>>3]=BigInt(r.blocks),HEAP64[e+16>>3]=BigInt(r.bfree),HEAP64[e+24>>3]=BigInt(r.bavail),HEAP64[e+32>>3]=BigInt(r.files),HEAP64[e+40>>3]=BigInt(r.ffree),HEAPU32[e+48>>2]=r.fsid,HEAPU32[e+64>>2]=r.flags,HEAPU32[e+56>>2]=r.namelen},doMsync(e,r,M,fe,$n){if(!FS.isFile(r.node.mode))throw new FS.ErrnoError(43);if(fe&2)return 0;var qn=HEAPU8.subarray(e,e+M);FS.msync(r,qn,$n,M,fe)},getStreamFromFD(e){var r=FS.getStreamChecked(e);return r},varargs:void 0,getStr(e){var r=UTF8ToString(e);return r}};function ___syscall_chdir(e){try{return e=SYSCALLS.getStr(e),FS.chdir(e),0}catch(r){if(typeof FS>"u"||r.name!=="ErrnoError")throw r;return-r.errno}}___syscall_chdir.sig="ip";function ___syscall_chmod(e,r){try{return e=SYSCALLS.getStr(e),FS.chmod(e,r),0}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return-M.errno}}___syscall_chmod.sig="ipi";function ___syscall_connect(e,r,M){try{var fe=getSocketFromFD(e),$n=getSocketAddress(r,M);return fe.sock_ops.connect(fe,$n.addr,$n.port),0}catch(qn){if(typeof FS>"u"||qn.name!=="ErrnoError")throw qn;return-qn.errno}}___syscall_connect.sig="iipiiii";function ___syscall_dup(e){try{var r=SYSCALLS.getStreamFromFD(e);return FS.dupStream(r).fd}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return-M.errno}}___syscall_dup.sig="ii";function ___syscall_dup3(e,r,M){try{if(e===r||M&-524289)return-28;var fe=SYSCALLS.getStreamFromFD(e);if(r<0||r>=FS.MAX_OPEN_FDS)return-8;var $n=FS.getStream(r);$n&&FS.close($n);var qn=FS.dupStream(fe,r);return M&524288&&(qn.flags|=524288),qn.fd}catch(jn){if(typeof FS>"u"||jn.name!=="ErrnoError")throw jn;return-jn.errno}}___syscall_dup3.sig="iiii";function ___syscall_faccessat(e,r,M){try{if(r=SYSCALLS.getStr(r),r=SYSCALLS.calculateAt(e,r),M&-8)return-28;var fe=FS.lookupPath(r,{follow:!0}),$n=fe.node;if(!$n)return-44;var qn="";return M&4&&(qn+="r"),M&2&&(qn+="w"),M&1&&(qn+="x"),qn&&FS.nodePermissions($n,qn)?-2:0}catch(jn){if(typeof FS>"u"||jn.name!=="ErrnoError")throw jn;return-jn.errno}}___syscall_faccessat.sig="iipii";var INT53_MAX=9007199254740992,INT53_MIN=-9007199254740992,bigintToI53Checked=e=>e<INT53_MIN||e>INT53_MAX?NaN:Number(e);function ___syscall_fadvise64(e,r,M){try{return SYSCALLS.getStreamFromFD(e).seekable?0:-70}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return-fe.errno}}___syscall_fadvise64.sig="iijji";function ___syscall_fallocate(e,r,M,fe){M=bigintToI53Checked(M),fe=bigintToI53Checked(fe);try{if(isNaN(M)||isNaN(fe))return-22;if(r!=0)return-138;if(M<0||fe<0)return-28;if(!SYSCALLS.getStreamFromFD(e).seekable)return-70;var $n=FS.fstat(e).size,qn=M+fe;return qn>$n&&FS.ftruncate(e,qn),0}catch(jn){if(typeof FS>"u"||jn.name!=="ErrnoError")throw jn;return-jn.errno}}___syscall_fallocate.sig="iiijj";function ___syscall_fchmod(e,r){try{return FS.fchmod(e,r),0}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return-M.errno}}___syscall_fchmod.sig="iii";function ___syscall_fchmodat2(e,r,M,fe){try{var $n=fe&256;return r=SYSCALLS.getStr(r),r=SYSCALLS.calculateAt(e,r),FS.chmod(r,M,$n),0}catch(qn){if(typeof FS>"u"||qn.name!=="ErrnoError")throw qn;return-qn.errno}}___syscall_fchmodat2.sig="iipii";function ___syscall_fchown32(e,r,M){try{return FS.fchown(e,r,M),0}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return-fe.errno}}___syscall_fchown32.sig="iiii";function ___syscall_fchownat(e,r,M,fe,$n){try{r=SYSCALLS.getStr(r);var qn=$n&256;return $n&=-257,r=SYSCALLS.calculateAt(e,r),(qn?FS.lchown:FS.chown)(r,M,fe),0}catch(jn){if(typeof FS>"u"||jn.name!=="ErrnoError")throw jn;return-jn.errno}}___syscall_fchownat.sig="iipiii";var syscallGetVarargI=()=>{var e=HEAP32[+SYSCALLS.varargs>>2];return SYSCALLS.varargs+=4,e},syscallGetVarargP=syscallGetVarargI;function ___syscall_fcntl64(e,r,M){SYSCALLS.varargs=M;try{var fe=SYSCALLS.getStreamFromFD(e);switch(r){case 0:var $n=syscallGetVarargI();if($n<0)return-28;for(;FS.streams[$n];)$n++;var qn;return qn=FS.dupStream(fe,$n),qn.fd;case 1:case 2:return 0;case 3:return fe.flags;case 4:return $n=syscallGetVarargI(),fe.flags=fe.flags&-289793|$n&289792,0;case 12:return $n=syscallGetVarargP(),HEAP16[$n+0>>1]=2,0;case 13:case 14:return 0}return-28}catch(jn){if(typeof FS>"u"||jn.name!=="ErrnoError")throw jn;return-jn.errno}}___syscall_fcntl64.sig="iiip";function ___syscall_fdatasync(e){try{return SYSCALLS.getStreamFromFD(e),0}catch(r){if(typeof FS>"u"||r.name!=="ErrnoError")throw r;return-r.errno}}___syscall_fdatasync.sig="ii";function ___syscall_fstat64(e,r){try{return SYSCALLS.writeStat(r,FS.fstat(e))}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return-M.errno}}___syscall_fstat64.sig="iip";function ___syscall_ftruncate64(e,r){r=bigintToI53Checked(r);try{return isNaN(r)?-22:(FS.ftruncate(e,r),0)}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return-M.errno}}___syscall_ftruncate64.sig="iij";function ___syscall_getcwd(e,r){try{if(!r)return-28;var M=FS.cwd(),fe=lengthBytesUTF8(M)+1;return r<fe?-68:(stringToUTF8(M,e,r),fe)}catch($n){if(typeof FS>"u"||$n.name!=="ErrnoError")throw $n;return-$n.errno}}___syscall_getcwd.sig="ipp";function ___syscall_getdents64(e,r,M){try{var fe=SYSCALLS.getStreamFromFD(e);fe.getdents||(fe.getdents=FS.readdir(fe.path));for(var $n=0,qn=FS.llseek(fe,0,1),jn=Math.floor(qn/280),Wn=Math.min(fe.getdents.length,jn+Math.floor(M/280)),Yn=jn;Yn<Wn;Yn++){var Xn,Kn,er=fe.getdents[Yn];if(er===".")Xn=fe.node.id,Kn=4;else if(er===".."){var nr=FS.lookupPath(fe.path,{parent:!0});Xn=nr.node.id,Kn=4}else{var Zn;try{Zn=FS.lookupNode(fe.node,er)}catch(rr){if(rr?.errno===28)continue;throw rr}Xn=Zn.id,Kn=FS.isChrdev(Zn.mode)?2:FS.isDir(Zn.mode)?4:FS.isLink(Zn.mode)?10:8}HEAP64[r+$n>>3]=BigInt(Xn),HEAP64[r+$n+8>>3]=BigInt((Yn+1)*280),HEAP16[r+$n+16>>1]=280,HEAP8[r+$n+18]=Kn,stringToUTF8(er,r+$n+19,256),$n+=280}return FS.llseek(fe,Yn*280,0),$n}catch(rr){if(typeof FS>"u"||rr.name!=="ErrnoError")throw rr;return-rr.errno}}___syscall_getdents64.sig="iipp";var ___syscall_getegid32=()=>0;___syscall_getegid32.sig="i";var ___syscall_geteuid32=()=>0;___syscall_geteuid32.sig="i";var ___syscall_getgid32=()=>0;___syscall_getgid32.sig="i";var ___syscall_getuid32=()=>0;___syscall_getuid32.sig="i";function ___syscall_ioctl(e,r,M){SYSCALLS.varargs=M;try{var fe=SYSCALLS.getStreamFromFD(e);switch(r){case 21509:return fe.tty?0:-59;case 21505:if(!fe.tty)return-59;if(fe.tty.ops.ioctl_tcgets){var $n=fe.tty.ops.ioctl_tcgets(fe),qn=syscallGetVarargP();HEAP32[qn>>2]=$n.c_iflag||0,HEAP32[qn+4>>2]=$n.c_oflag||0,HEAP32[qn+8>>2]=$n.c_cflag||0,HEAP32[qn+12>>2]=$n.c_lflag||0;for(var jn=0;jn<32;jn++)HEAP8[qn+jn+17]=$n.c_cc[jn]||0;return 0}return 0;case 21510:case 21511:case 21512:return fe.tty?0:-59;case 21506:case 21507:case 21508:if(!fe.tty)return-59;if(fe.tty.ops.ioctl_tcsets){qn=syscallGetVarargP();var Wn=HEAP32[qn>>2],Yn=HEAP32[qn+4>>2],Xn=HEAP32[qn+8>>2],Kn=HEAP32[qn+12>>2],er=[];for(jn=0;jn<32;jn++)er.push(HEAP8[qn+jn+17]);return fe.tty.ops.ioctl_tcsets(fe.tty,r,{c_iflag:Wn,c_oflag:Yn,c_cflag:Xn,c_lflag:Kn,c_cc:er})}return 0;case 21519:return fe.tty?(qn=syscallGetVarargP(),HEAP32[qn>>2]=0,0):-59;case 21520:return fe.tty?-28:-59;case 21537:case 21531:return qn=syscallGetVarargP(),FS.ioctl(fe,r,qn);case 21523:if(!fe.tty)return-59;if(fe.tty.ops.ioctl_tiocgwinsz){var nr=fe.tty.ops.ioctl_tiocgwinsz(fe.tty);qn=syscallGetVarargP(),HEAP16[qn>>1]=nr[0],HEAP16[qn+2>>1]=nr[1]}return 0;case 21524:return fe.tty?0:-59;case 21515:return fe.tty?0:-59;default:return-28}}catch(Zn){if(typeof FS>"u"||Zn.name!=="ErrnoError")throw Zn;return-Zn.errno}}___syscall_ioctl.sig="iiip";function ___syscall_linkat(e,r,M,fe,$n){try{return r=SYSCALLS.getStr(r),fe=SYSCALLS.getStr(fe),r=SYSCALLS.calculateAt(e,r),fe=SYSCALLS.calculateAt(M,fe),FS.link(r,fe,$n),0}catch(qn){if(typeof FS>"u"||qn.name!=="ErrnoError")throw qn;return-qn.errno}}___syscall_linkat.sig="iipipi";function ___syscall_listen(e,r){try{var M=getSocketFromFD(e);return M.sock_ops.listen(M,r),0}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return-fe.errno}}___syscall_listen.sig="iiiiiii";function ___syscall_lstat64(e,r){try{return e=SYSCALLS.getStr(e),SYSCALLS.writeStat(r,FS.lstat(e))}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return-M.errno}}___syscall_lstat64.sig="ipp";function ___syscall_mkdirat(e,r,M){try{return r=SYSCALLS.getStr(r),r=SYSCALLS.calculateAt(e,r),M&=~SYSCALLS.currentUmask,FS.mkdir(r,M),0}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return-fe.errno}}___syscall_mkdirat.sig="iipi";function ___syscall_newfstatat(e,r,M,fe){try{r=SYSCALLS.getStr(r);var $n=fe&256,qn=fe&4096;return fe&=-6401,r=SYSCALLS.calculateAt(e,r,qn),SYSCALLS.writeStat(M,$n?FS.lstat(r):FS.stat(r))}catch(jn){if(typeof FS>"u"||jn.name!=="ErrnoError")throw jn;return-jn.errno}}___syscall_newfstatat.sig="iippi";function ___syscall_openat(e,r,M,fe){SYSCALLS.varargs=fe;try{r=SYSCALLS.getStr(r),r=SYSCALLS.calculateAt(e,r);var $n=fe?syscallGetVarargI():0;return M&64&&($n&=~SYSCALLS.currentUmask),FS.open(r,M,$n).fd}catch(qn){if(typeof FS>"u"||qn.name!=="ErrnoError")throw qn;return-qn.errno}}___syscall_openat.sig="iipip";var PIPEFS={BUCKET_BUFFER_SIZE:8192,mount(e){return FS.createNode(null,"/",16895,0)},createPipe(){var e={buckets:[],writerCount:1,writeClosed:!1,readerCount:1,readClosed:!1,timestamp:new Date};e.buckets.push({buffer:new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),offset:0,roffset:0});var r=PIPEFS.nextname(),M=PIPEFS.nextname(),fe=FS.createNode(PIPEFS.root,r,4096,0),$n=FS.createNode(PIPEFS.root,M,4096,0);fe.pipe=e,$n.pipe=e,e.readNode=fe,e.writeNode=$n;var qn=FS.createStream({path:r,node:fe,flags:0,seekable:!1,stream_ops:PIPEFS.stream_ops});fe.stream=qn;var jn=FS.createStream({path:M,node:$n,flags:1,seekable:!1,stream_ops:PIPEFS.stream_ops});return $n.stream=jn,{readable_fd:qn.fd,writable_fd:jn.fd}},stream_ops:{getattr(e){var r=e.node,M=r.pipe.timestamp;return{dev:14,ino:r.id,mode:4480,nlink:1,uid:0,gid:0,rdev:0,size:0,atime:M,mtime:M,ctime:M,blksize:4096,blocks:0}},poll(e){var r=e.node.pipe;if((e.flags&2097155)===1){var M=260;return r.readClosed&&(M|=8),M}M=0;for(var fe of r.buckets)if(fe.offset-fe.roffset>0){M=65;break}return r.writeClosed&&(M|=17),M},dup(e){var r=e.node.pipe;(e.flags&2097155)===1?r.writerCount++:r.readerCount++},ioctl(e,r,M){if(r==21531){var fe=e.node.pipe,$n=0;for(var qn of fe.buckets)$n+=qn.offset-qn.roffset;return HEAP32[M>>2]=$n,0}return 28},fsync(e){return 28},read(e,r,M,fe,$n){var qn=e.node.pipe,jn=0;for(var Wn of qn.buckets)jn+=Wn.offset-Wn.roffset;var Yn=r.subarray(M,M+fe);if(fe<=0)return 0;if(jn==0)throw new FS.ErrnoError(6);var Xn=Math.min(jn,fe),Kn=Xn,er=0;for(var Wn of qn.buckets){var nr=Wn.offset-Wn.roffset;if(Xn<=nr){var Zn=Wn.buffer.subarray(Wn.roffset,Wn.offset);Xn<nr?(Zn=Zn.subarray(0,Xn),Wn.roffset+=Xn):er++,Yn.set(Zn);break}else Zn=Wn.buffer.subarray(Wn.roffset,Wn.offset),Yn.set(Zn),Yn=Yn.subarray(Zn.byteLength),Xn-=Zn.byteLength,er++}return er&&er==qn.buckets.length&&(er--,qn.buckets[er].offset=0,qn.buckets[er].roffset=0),qn.buckets.splice(0,er),Kn},write(e,r,M,fe,$n){var qn=e.node.pipe,jn=r.subarray(M,M+fe),Wn=jn.byteLength;if(Wn<=0)return 0;var Yn=null;qn.buckets.length==0?(Yn={buffer:new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),offset:0,roffset:0},qn.buckets.push(Yn)):Yn=qn.buckets[qn.buckets.length-1];var Xn=PIPEFS.BUCKET_BUFFER_SIZE-Yn.offset;if(Xn>=Wn)return Yn.buffer.set(jn,Yn.offset),Yn.offset+=Wn,qn.readNode.notifyListeners(65),Wn;Xn>0&&(Yn.buffer.set(jn.subarray(0,Xn),Yn.offset),Yn.offset+=Xn,jn=jn.subarray(Xn,jn.byteLength));for(var Kn=jn.byteLength/PIPEFS.BUCKET_BUFFER_SIZE|0,er=jn.byteLength%PIPEFS.BUCKET_BUFFER_SIZE,nr=0;nr<Kn;nr++){var Zn={buffer:new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),offset:PIPEFS.BUCKET_BUFFER_SIZE,roffset:0};qn.buckets.push(Zn),Zn.buffer.set(jn.subarray(0,PIPEFS.BUCKET_BUFFER_SIZE)),jn=jn.subarray(PIPEFS.BUCKET_BUFFER_SIZE,jn.byteLength)}return er>0&&(Zn={buffer:new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),offset:jn.byteLength,roffset:0},qn.buckets.push(Zn),Zn.buffer.set(jn)),qn.readNode.notifyListeners(65),Wn},close(e){var r=e.node.pipe;(e.flags&2097155)===1?--r.writerCount||(r.writeClosed=!0,r.readNode.notifyListeners(81)):--r.readerCount||(r.readClosed=!0,r.writeNode.notifyListeners(268)),!r.readerCount&&!r.writerCount&&(r.buckets=null)}},nextname(){return PIPEFS.nextname.current||(PIPEFS.nextname.current=0),"pipe["+PIPEFS.nextname.current+++"]"}};function ___syscall_pipe2(e,r){try{if(e==0)throw new FS.ErrnoError(21);if(r&-526337)throw new FS.ErrnoError(138);var M=PIPEFS.createPipe();return r&2048&&(FS.getStream(M.readable_fd).flags|=2048,FS.getStream(M.writable_fd).flags|=2048),HEAP32[e>>2]=M.readable_fd,HEAP32[e+4>>2]=M.writable_fd,0}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return-fe.errno}}___syscall_pipe2.sig="ipi";var pollOne=(e,r)=>{var M=FS.getStream(e);if(!M)return 32;var fe=M.stream_ops?.poll?.(M)??5;return fe&(56|r)},doPollSync=(e,r)=>{for(var M=0,fe=0,$n=e;fe<r;fe++,$n+=8){var qn=pollOne(HEAP32[$n>>2],HEAP16[$n+4>>1]);qn&&M++,HEAP16[$n+6>>1]=qn}return M};function ___syscall_poll(e,r){try{var M=doPollSync(e,r);return M}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return-fe.errno}}___syscall_poll.sig="ipii";function ___syscall_readlinkat(e,r,M,fe){try{if(r=SYSCALLS.getStr(r),r=SYSCALLS.calculateAt(e,r),fe<=0)return-28;var $n=FS.readlink(r),qn=Math.min(fe,lengthBytesUTF8($n)),jn=HEAP8[M+qn];return stringToUTF8($n,M,fe+1),HEAP8[M+qn]=jn,qn}catch(Wn){if(typeof FS>"u"||Wn.name!=="ErrnoError")throw Wn;return-Wn.errno}}___syscall_readlinkat.sig="iippp";function ___syscall_recvfrom(e,r,M,fe,$n,qn){try{var jn=getSocketFromFD(e),Wn=jn.sock_ops.recvmsg(jn,M,fe);return Wn?($n&&writeSockaddr($n,jn.family,Wn.addr,Wn.port,qn),HEAPU8.set(Wn.buffer,r),Wn.buffer.byteLength):0}catch(Yn){if(typeof FS>"u"||Yn.name!=="ErrnoError")throw Yn;return-Yn.errno}}___syscall_recvfrom.sig="iippipp";function ___syscall_renameat(e,r,M,fe){try{return r=SYSCALLS.getStr(r),fe=SYSCALLS.getStr(fe),r=SYSCALLS.calculateAt(e,r),fe=SYSCALLS.calculateAt(M,fe),FS.rename(r,fe),0}catch($n){if(typeof FS>"u"||$n.name!=="ErrnoError")throw $n;return-$n.errno}}___syscall_renameat.sig="iipip";function ___syscall_rmdir(e){try{return e=SYSCALLS.getStr(e),FS.rmdir(e),0}catch(r){if(typeof FS>"u"||r.name!=="ErrnoError")throw r;return-r.errno}}___syscall_rmdir.sig="ip";function ___syscall_sendto(e,r,M,fe,$n,qn){try{var jn=getSocketFromFD(e);if(!$n)return FS.write(jn.stream,HEAP8,r,M);var Wn=getSocketAddress($n,qn);return jn.sock_ops.sendmsg(jn,HEAP8,r,M,Wn.addr,Wn.port)}catch(Yn){if(typeof FS>"u"||Yn.name!=="ErrnoError")throw Yn;return-Yn.errno}}___syscall_sendto.sig="iippipi";function ___syscall_socket(e,r,M){try{var fe=SOCKFS.createSocket(e,r,M);return fe.stream.fd}catch($n){if(typeof FS>"u"||$n.name!=="ErrnoError")throw $n;return-$n.errno}}___syscall_socket.sig="iiiiiii";function ___syscall_stat64(e,r){try{return e=SYSCALLS.getStr(e),SYSCALLS.writeStat(r,FS.stat(e))}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return-M.errno}}___syscall_stat64.sig="ipp";function ___syscall_statfs64(e,r,M){try{return SYSCALLS.writeStatFs(M,FS.statfs(SYSCALLS.getStr(e))),0}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return-fe.errno}}___syscall_statfs64.sig="ippp";function ___syscall_symlinkat(e,r,M){try{return e=SYSCALLS.getStr(e),M=SYSCALLS.getStr(M),M=SYSCALLS.calculateAt(r,M),FS.symlink(e,M),0}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return-fe.errno}}___syscall_symlinkat.sig="ipip";function ___syscall_truncate64(e,r){r=bigintToI53Checked(r);try{return isNaN(r)?-22:(e=SYSCALLS.getStr(e),FS.truncate(e,r),0)}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return-M.errno}}___syscall_truncate64.sig="ipj";function ___syscall_umask(e){try{var r=SYSCALLS.currentUmask;return SYSCALLS.currentUmask=e,r}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return-M.errno}}___syscall_umask.sig="ii";function ___syscall_unlinkat(e,r,M){try{if(r=SYSCALLS.getStr(r),r=SYSCALLS.calculateAt(e,r),!M)FS.unlink(r);else if(M===512)FS.rmdir(r);else return-28;return 0}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return-fe.errno}}___syscall_unlinkat.sig="iipi";var readI53FromI64=e=>HEAPU32[e>>2]+HEAP32[e+4>>2]*4294967296;function ___syscall_utimensat(e,r,M,fe){try{var $n=fe&256;r=SYSCALLS.getStr(r),r=SYSCALLS.calculateAt(e,r,!0);var qn,jn,Wn=Date.now();if(!M)qn=Wn,jn=Wn;else{let Xn=function(Kn){var er=HEAP32[Kn+8>>2];if(er==1073741823)return Wn;if(er==1073741822)return null;var nr=readI53FromI64(Kn);return nr*1e3+Math.floor(er/1e6)};var Yn=Xn;qn=Xn(M),jn=Xn(M+16)}return(jn??qn)!==null&&FS.utime(r,qn,jn,$n),0}catch(Xn){if(typeof FS>"u"||Xn.name!=="ErrnoError")throw Xn;return-Xn.errno}}___syscall_utimensat.sig="iippi";var __abort_js=()=>abort("");__abort_js.sig="v";var dlSetError=e=>{var r=stackSave(),M=stringToUTF8OnStack(e);___dl_seterr(M,0),stackRestore(r)},dlopenInternal=(e,r)=>{var M=UTF8ToString(e+36),fe=HEAP32[e+4>>2];M=PATH.normalize(M);var $n=!!(fe&256),qn=$n?null:{},jn={global:$n,nodelete:!!(fe&4096),loadAsync:r.loadAsync};if(r.loadAsync)return loadDynamicLibrary(M,jn,qn,e);try{return loadDynamicLibrary(M,jn,qn,e)}catch(Wn){return dlSetError(`could not load dynamic lib: ${M}
${Wn}`),0}},__dlopen_js=e=>dlopenInternal(e,{loadAsync:!1});__dlopen_js.sig="pp";var __dlsym_js=(e,r,M)=>{r=UTF8ToString(r);var fe,$n,qn=LDSO.loadedLibsByHandle[e];if($n=Object.keys(qn.exports).indexOf(r),$n==-1||qn.exports[r].stub)return dlSetError(`Tried to lookup unknown symbol "${r}" in dynamic lib: ${qn.name}`),0;if(fe=qn.exports[r],typeof fe=="function"){var jn=getFunctionAddress(fe);jn?fe=jn:(fe=addFunction(fe,fe.sig),HEAPU32[M>>2]=$n)}return fe};__dlsym_js.sig="pppp";var runtimeKeepaliveCounter=0,__emscripten_runtime_keepalive_clear=()=>{noExitRuntime=!1,runtimeKeepaliveCounter=0};__emscripten_runtime_keepalive_clear.sig="v";var __emscripten_throw_longjmp=()=>{throw new EmscriptenSjLj};__emscripten_throw_longjmp.sig="v";function __gmtime_js(e,r){e=bigintToI53Checked(e);var M=new Date(e*1e3);if(isNaN(M.getTime()))return 1;HEAP32[r>>2]=M.getUTCSeconds(),HEAP32[r+4>>2]=M.getUTCMinutes(),HEAP32[r+8>>2]=M.getUTCHours(),HEAP32[r+12>>2]=M.getUTCDate(),HEAP32[r+16>>2]=M.getUTCMonth(),HEAP32[r+20>>2]=M.getUTCFullYear()-1900,HEAP32[r+24>>2]=M.getUTCDay();var fe=Date.UTC(M.getUTCFullYear(),0,1,0,0,0,0),$n=(M.getTime()-fe)/864e5|0;return HEAP32[r+28>>2]=$n,0}__gmtime_js.sig="ijp";var isLeapYear=e=>e%4===0&&(e%100!==0||e%400===0),MONTH_DAYS_LEAP_CUMULATIVE=[0,31,60,91,121,152,182,213,244,274,305,335],MONTH_DAYS_REGULAR_CUMULATIVE=[0,31,59,90,120,151,181,212,243,273,304,334],ydayFromDate=e=>{var r=isLeapYear(e.getFullYear()),M=r?MONTH_DAYS_LEAP_CUMULATIVE:MONTH_DAYS_REGULAR_CUMULATIVE,fe=M[e.getMonth()]+e.getDate()-1;return fe};function __localtime_js(e,r){e=bigintToI53Checked(e);var M=new Date(e*1e3);if(isNaN(M.getTime()))return 1;HEAP32[r>>2]=M.getSeconds(),HEAP32[r+4>>2]=M.getMinutes(),HEAP32[r+8>>2]=M.getHours(),HEAP32[r+12>>2]=M.getDate(),HEAP32[r+16>>2]=M.getMonth(),HEAP32[r+20>>2]=M.getFullYear()-1900,HEAP32[r+24>>2]=M.getDay();var fe=ydayFromDate(M)|0;HEAP32[r+28>>2]=fe,HEAP32[r+36>>2]=-M.getTimezoneOffset()*60;var $n=new Date(M.getFullYear(),0,1),qn=new Date(M.getFullYear(),6,1).getTimezoneOffset(),jn=$n.getTimezoneOffset(),Wn=(qn!=jn&&M.getTimezoneOffset()==Math.min(jn,qn))|0;return HEAP32[r+32>>2]=Wn,0}__localtime_js.sig="ijp";function __mmap_js(e,r,M,fe,$n,qn,jn){$n=bigintToI53Checked($n);try{var Wn=SYSCALLS.getStreamFromFD(fe),Yn=FS.mmap(Wn,e,$n,r,M),Xn=Yn.ptr;return HEAP32[qn>>2]=Yn.allocated,HEAPU32[jn>>2]=Xn,0}catch(Kn){if(typeof FS>"u"||Kn.name!=="ErrnoError")throw Kn;return-Kn.errno}}__mmap_js.sig="ipiiijpp";function __munmap_js(e,r,M,fe,$n,qn){qn=bigintToI53Checked(qn);try{var jn=SYSCALLS.getStreamFromFD($n);M&2&&SYSCALLS.doMsync(e,jn,r,fe,qn)}catch(Wn){if(typeof FS>"u"||Wn.name!=="ErrnoError")throw Wn;return-Wn.errno}}__munmap_js.sig="ippiiij";var timers={},clearTimers=()=>{for(var e of Object.values(timers))clearTimeout(e.id)},handleException=e=>{if(e instanceof ExitStatus||e=="unwind")return EXITSTATUS;quit_(1,e)},keepRuntimeAlive=()=>noExitRuntime||runtimeKeepaliveCounter>0,_proc_exit=e=>{EXITSTATUS=e,keepRuntimeAlive()||(Module.onExit?.(e),ABORT=!0),quit_(e,new ExitStatus(e))};_proc_exit.sig="vi";var exitJS=e=>{EXITSTATUS=e,keepRuntimeAlive()||exitRuntime(),_proc_exit(e)},_exit=exitJS;_exit.sig="vi";var maybeExit=()=>{if(!runtimeExited&&!keepRuntimeAlive())try{_exit(EXITSTATUS)}catch(e){handleException(e)}},callUserCallback=(e,...r)=>{if(!(runtimeExited||ABORT))try{return e(...r)}catch(M){handleException(M)}finally{maybeExit()}},_emscripten_get_now=()=>performance.now();_emscripten_get_now.sig="d";var __setitimer_js=(e,r)=>{if(timers[e]&&(clearTimeout(timers[e].id),delete timers[e]),!r)return 0;var M=setTimeout(()=>{delete timers[e],callUserCallback(__emscripten_timeout,e,_emscripten_get_now())},r);return timers[e]={id:M,timeout_ms:r},0};__setitimer_js.sig="iid";var __tzset_js=(e,r,M,fe)=>{var $n=new Date().getFullYear(),qn=new Date($n,0,1),jn=new Date($n,6,1),Wn=qn.getTimezoneOffset(),Yn=jn.getTimezoneOffset(),Xn=Math.max(Wn,Yn);HEAPU32[e>>2]=Xn*60,HEAP32[r>>2]=+(Wn!=Yn);var Kn=Zn=>{var rr=Zn>=0?"-":"+",sr=Math.abs(Zn),or=String(Math.floor(sr/60)).padStart(2,"0"),ir=String(sr%60).padStart(2,"0");return`UTC${rr}${or}${ir}`},er=Kn(Wn),nr=Kn(Yn);Yn<Wn?(stringToUTF8(er,M,17),stringToUTF8(nr,fe,17)):(stringToUTF8(er,fe,17),stringToUTF8(nr,M,17))};__tzset_js.sig="vpppp";var _emscripten_date_now=()=>Date.now();_emscripten_date_now.sig="d";var checkWasiClock=e=>e>=0&&e<=3;function _clock_time_get(e,r,M){if(!checkWasiClock(e))return 28;var fe;e===0?fe=_emscripten_date_now():fe=_emscripten_get_now();var $n=Math.round(fe*1e6);return HEAP64[M>>3]=BigInt($n),0}_clock_time_get.sig="iijp";var getHeapMax=()=>2147483648,_emscripten_get_heap_max=()=>getHeapMax();_emscripten_get_heap_max.sig="p";var growMemory=e=>{var r=wasmMemory.buffer.byteLength,M=(e-r+65535)/65536|0;try{return wasmMemory.grow(M),updateMemoryViews(),1}catch{}},_emscripten_resize_heap=e=>{var r=HEAPU8.length;e>>>=0;var M=getHeapMax();if(e>M)return!1;for(var fe=1;fe<=4;fe*=2){var $n=r*(1+.2/fe);$n=Math.min($n,e+100663296);var qn=Math.min(M,alignMemory(Math.max(e,$n),65536)),jn=growMemory(qn);if(jn)return!0}return!1};_emscripten_resize_heap.sig="ip";var ENV={},getExecutableName=()=>thisProgram,getEnvStrings=()=>{if(!getEnvStrings.strings){var e=(globalThis.navigator?.language??"C").replace("-","_")+".UTF-8",r={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:e,_:getExecutableName()};for(var M in ENV)ENV[M]===void 0?delete r[M]:r[M]=ENV[M];var fe=[];for(var M in r)fe.push(`${M}=${r[M]}`);getEnvStrings.strings=fe}return getEnvStrings.strings},_environ_get=(e,r)=>{var M=0,fe=0;for(var $n of getEnvStrings()){var qn=r+M;HEAPU32[e+fe>>2]=qn,M+=stringToUTF8($n,qn,1/0)+1,fe+=4}return 0};_environ_get.sig="ipp";var _environ_sizes_get=(e,r)=>{var M=getEnvStrings();HEAPU32[e>>2]=M.length;var fe=0;for(var $n of M)fe+=lengthBytesUTF8($n)+1;return HEAPU32[r>>2]=fe,0};_environ_sizes_get.sig="ipp";function _fd_close(e){try{var r=SYSCALLS.getStreamFromFD(e);return FS.close(r),0}catch(M){if(typeof FS>"u"||M.name!=="ErrnoError")throw M;return M.errno}}_fd_close.sig="ii";function _fd_fdstat_get(e,r){try{var M=SYSCALLS.getStreamFromFD(e),fe=M.tty?2:FS.isDir(M.mode)?3:FS.isLink(M.mode)?7:4;return HEAP8[r]=fe,HEAP16[r+2>>1]=0,HEAP64[r+8>>3]=BigInt(0),HEAP64[r+16>>3]=BigInt(0),0}catch($n){if(typeof FS>"u"||$n.name!=="ErrnoError")throw $n;return $n.errno}}_fd_fdstat_get.sig="iip";var doReadv=(e,r,M,fe)=>{for(var $n=0,qn=0;qn<M;qn++){var jn=HEAPU32[r>>2],Wn=HEAPU32[r+4>>2];r+=8;try{var Yn=FS.read(e,HEAP8,jn,Wn,fe)}catch(Xn){if($n>0&&Xn instanceof FS.ErrnoError&&(Xn.errno==6||Xn.errno==6))break;throw Xn}if(Yn<0)return-1;if($n+=Yn,Yn<Wn)break;typeof fe<"u"&&(fe+=Yn)}return $n};function _fd_pread(e,r,M,fe,$n){fe=bigintToI53Checked(fe);try{if(isNaN(fe))return 22;var qn=SYSCALLS.getStreamFromFD(e),jn=doReadv(qn,r,M,fe);return HEAPU32[$n>>2]=jn,0}catch(Wn){if(typeof FS>"u"||Wn.name!=="ErrnoError")throw Wn;return Wn.errno}}_fd_pread.sig="iippjp";var doWritev=(e,r,M,fe)=>{if(M==1)return FS.write(e,HEAP8,HEAPU32[r>>2],HEAPU32[r+4>>2],fe);for(var $n=0,qn=0,jn=r;qn<M;qn++,jn+=8)$n+=HEAPU32[jn+4>>2];var Wn=new Uint8Array($n),Yn=0;for(qn=0;qn<M;qn++,r+=8){var Xn=HEAPU32[r>>2],Kn=HEAPU32[r+4>>2];Wn.set(HEAPU8.subarray(Xn,Xn+Kn),Yn),Yn+=Kn}return FS.write(e,Wn,0,$n,fe)};function _fd_pwrite(e,r,M,fe,$n){fe=bigintToI53Checked(fe);try{if(isNaN(fe))return 22;var qn=SYSCALLS.getStreamFromFD(e),jn=doWritev(qn,r,M,fe);return HEAPU32[$n>>2]=jn,0}catch(Wn){if(typeof FS>"u"||Wn.name!=="ErrnoError")throw Wn;return Wn.errno}}_fd_pwrite.sig="iippjp";function _fd_read(e,r,M,fe){try{var $n=SYSCALLS.getStreamFromFD(e),qn=doReadv($n,r,M);return HEAPU32[fe>>2]=qn,0}catch(jn){if(typeof FS>"u"||jn.name!=="ErrnoError")throw jn;return jn.errno}}_fd_read.sig="iippp";function _fd_seek(e,r,M,fe){r=bigintToI53Checked(r);try{if(isNaN(r))return 22;var $n=SYSCALLS.getStreamFromFD(e);return FS.llseek($n,r,M),HEAP64[fe>>3]=BigInt($n.position),$n.getdents&&!r&&M===0&&($n.getdents=null),0}catch(qn){if(typeof FS>"u"||qn.name!=="ErrnoError")throw qn;return qn.errno}}_fd_seek.sig="iijip";function _fd_sync(e){try{var r=SYSCALLS.getStreamFromFD(e),M=r.stream_ops?.fsync?.(r);return M}catch(fe){if(typeof FS>"u"||fe.name!=="ErrnoError")throw fe;return fe.errno}}_fd_sync.sig="ii";function _fd_write(e,r,M,fe){try{var $n=SYSCALLS.getStreamFromFD(e),qn=doWritev($n,r,M);return HEAPU32[fe>>2]=qn,0}catch(jn){if(typeof FS>"u"||jn.name!=="ErrnoError")throw jn;return jn.errno}}_fd_write.sig="iippp";var _getaddrinfo=(e,r,M,fe)=>{var $n=0,qn=0,jn=0,Wn=0,Yn=0,Xn=0,Kn;function er(nr,Zn,rr,sr,or,ir){var Jn,tr,ar;return tr=nr===10?28:16,or=nr===10?inetNtop6(or):inetNtop4(or),Jn=_malloc(tr),writeSockaddr(Jn,nr,or,ir),ar=_malloc(32),HEAP32[ar+4>>2]=nr,HEAP32[ar+8>>2]=Zn,HEAP32[ar+12>>2]=rr,HEAPU32[ar+24>>2]=sr,HEAPU32[ar+20>>2]=Jn,nr===10?HEAP32[ar+16>>2]=28:HEAP32[ar+16>>2]=16,HEAP32[ar+28>>2]=0,ar}if(M&&(jn=HEAP32[M>>2],Wn=HEAP32[M+4>>2],Yn=HEAP32[M+8>>2],Xn=HEAP32[M+12>>2]),Yn&&!Xn&&(Xn=Yn===2?17:6),!Yn&&Xn&&(Yn=Xn===17?2:1),Xn||(Xn=6),Yn||(Yn=1),!e&&!r)return-2;if(jn&-1088||M&&HEAP32[M>>2]&2&&!e)return-1;if(jn&32)return-2;if(Yn&&Yn!==1&&Yn!==2)return-7;if(Wn!==0&&Wn!==2&&Wn!==10)return-6;if(r&&(r=UTF8ToString(r),qn=parseInt(r,10),isNaN(qn)))return jn&1024?-2:-8;if(!e)return Wn===0&&(Wn=2),jn&1||(Wn===2?$n=_htonl(2130706433):$n=[0,0,0,_htonl(1)]),Kn=er(Wn,Yn,Xn,null,$n,qn),HEAPU32[fe>>2]=Kn,0;if(e=UTF8ToString(e),$n=inetPton4(e),$n!==null)if(Wn===0||Wn===2)Wn=2;else if(Wn===10&&jn&8)$n=[0,0,_htonl(65535),$n],Wn=10;else return-2;else if($n=inetPton6(e),$n!==null)if(Wn===0||Wn===10)Wn=10;else return-2;return $n!=null?(Kn=er(Wn,Yn,Xn,e,$n,qn),HEAPU32[fe>>2]=Kn,0):jn&4?-2:(e=DNS.lookup_name(e),$n=inetPton4(e),Wn===0?Wn=2:Wn===10&&($n=[0,0,_htonl(65535),$n]),Kn=er(Wn,Yn,Xn,null,$n,qn),HEAPU32[fe>>2]=Kn,0)};_getaddrinfo.sig="ipppp";var _getnameinfo=(e,r,M,fe,$n,qn,jn)=>{var Wn=readSockaddr(e,r);if(Wn.errno)return-6;var Yn=Wn.port,Xn=Wn.addr;function Kn(er){var nr=!1;if(M&&fe){if(er)Xn=er;else if(jn&8)return-2;var Zn=stringToUTF8(Xn,M,fe);Zn+1>=fe&&(nr=!0)}return $n&&qn&&(Yn=""+Yn,Zn=stringToUTF8(Yn,$n,qn),Zn+1>=qn&&(nr=!0)),nr?-12:0}return M&&fe&&!(jn&1)?Kn(DNS.lookup_addr(Xn)):Kn(null)};_getnameinfo.sig="ipipipii";var _random_get=(e,r)=>randomFill(HEAPU8.subarray(e,e+r));_random_get.sig="ipp";var stringToNewUTF8=e=>{var r=lengthBytesUTF8(e)+1,M=_malloc(r);return M&&stringToUTF8(e,M,r),M},removeFunction=e=>{functionsInTableMap.delete(getWasmTableEntry(e)),setWasmTableEntry(e,null),freeTableIndexes.push(e)},FS_createPath=(...e)=>FS.createPath(...e),FS_unlink=(...e)=>FS.unlink(...e),FS_createLazyFile=(...e)=>FS.createLazyFile(...e),FS_createDevice=(...e)=>FS.createDevice(...e),setTempRet0=e=>__emscripten_tempret_set(e),_setTempRet0=setTempRet0,getTempRet0=()=>__emscripten_tempret_get(),_getTempRet0=getTempRet0,_emscripten_force_exit=e=>{__emscripten_runtime_keepalive_clear(),_exit(e)};_emscripten_force_exit.sig="vi";var _sched_yield=()=>0;_sched_yield.sig="i";var findMatchingCatch=()=>(setTempRet0(0),0),___cxa_find_matching_catch_2=()=>findMatchingCatch();___cxa_find_matching_catch_2.sig="p";var ___cxa_find_matching_catch_3=e=>findMatchingCatch();___cxa_find_matching_catch_3.sig="pp";class ExceptionInfo{constructor(r){this.excPtr=r,this.ptr=r-24}set_type(r){HEAPU32[this.ptr+4>>2]=r}get_type(){return HEAPU32[this.ptr+4>>2]}set_destructor(r){HEAPU32[this.ptr+8>>2]=r}get_destructor(){return HEAPU32[this.ptr+8>>2]}set_caught(r){r=r?1:0,HEAP8[this.ptr+12]=r}get_caught(){return HEAP8[this.ptr+12]!=0}set_rethrown(r){r=r?1:0,HEAP8[this.ptr+13]=r}get_rethrown(){return HEAP8[this.ptr+13]!=0}init(r,M){this.set_adjusted_ptr(0),this.set_type(r),this.set_destructor(M)}set_adjusted_ptr(r){HEAPU32[this.ptr+16>>2]=r}get_adjusted_ptr(){return HEAPU32[this.ptr+16>>2]}}var uncaughtExceptionCount=0,__Unwind_RaiseException=()=>{abort()},___cxa_throw=(e,r,M)=>{var fe=new ExceptionInfo(e);fe.init(r,M),uncaughtExceptionCount++,__Unwind_RaiseException()};___cxa_throw.sig="vppp";var exceptionCaught=[],___cxa_rethrow=()=>{exceptionCaught.length||abort("no exception to throw");var e=exceptionCaught.at(-1);e.excPtr,e.set_rethrown(!0),e.set_caught(!1),uncaughtExceptionCount++,__Unwind_RaiseException()};___cxa_rethrow.sig="v";var ___cxa_begin_catch=e=>{var r=new ExceptionInfo(e);return r.get_caught()||(r.set_caught(!0),uncaughtExceptionCount--),r.set_rethrown(!1),exceptionCaught.push(r),___cxa_get_exception_ptr(e)};___cxa_begin_catch.sig="pp";var ___cxa_end_catch=()=>{_setThrew(0,0);var e=exceptionCaught.pop();___cxa_decrement_exception_refcount(e.excPtr)};___cxa_end_catch.sig="v";var ___cxa_uncaught_exceptions=()=>uncaughtExceptionCount;___cxa_uncaught_exceptions.sig="i";var ___cxa_current_primary_exception=()=>{if(!exceptionCaught.length)return 0;var e=exceptionCaught[exceptionCaught.length-1];return ___cxa_increment_exception_refcount(e.excPtr),e.excPtr};___cxa_current_primary_exception.sig="p";var ___cxa_rethrow_primary_exception=e=>{if(e){var r=new ExceptionInfo(e);r.set_rethrown(!0),r.set_caught(!1),uncaughtExceptionCount++,__Unwind_RaiseException()}};___cxa_rethrow_primary_exception.sig="vp";var __Unwind_Resume=()=>{abort()},___resumeException=e=>{__Unwind_Resume()};___resumeException.sig="vp",registerWasmPlugin(),FS.createPreloadedFile=FS_createPreloadedFile,FS.preloadFile=FS_preloadFile,FS.staticInit(),ENVIRONMENT_IS_NODE&&NODEFS.staticInit(),initMemory(),Module.noExitRuntime&&(noExitRuntime=Module.noExitRuntime),Module.print&&(out=Module.print),Module.printErr&&(err=Module.printErr),Module.dynamicLibraries&&(dynamicLibraries=Module.dynamicLibraries),Module.arguments&&(programArgs=Module.arguments),Module.thisProgram&&(thisProgram=Module.thisProgram);var preInit=Module.preInit;if(preInit)for(typeof preInit=="function"&&(Module.preInit=preInit=[preInit]);preInit.length>0;)preInit.shift()();Module.callMain=callMain,Module.stackSave=stackSave,Module.stackRestore=stackRestore,Module.ENV=ENV,Module.addRunDependency=addRunDependency,Module.removeRunDependency=removeRunDependency,Module.addFunction=addFunction,Module.removeFunction=removeFunction,Module.setValue=setValue,Module.getValue=getValue,Module.UTF8ToString=UTF8ToString,Module.stringToNewUTF8=stringToNewUTF8,Module.stringToUTF8OnStack=stringToUTF8OnStack,Module.FS_preloadFile=FS_preloadFile,Module.FS_unlink=FS_unlink,Module.FS_createPath=FS_createPath,Module.FS_createDevice=FS_createDevice,Module.FS=FS,Module.FS_createDataFile=FS_createDataFile,Module.FS_createLazyFile=FS_createLazyFile,Module.MEMFS=MEMFS,Module.PROXYFS=PROXYFS,Module.NODEFS=NODEFS,Module.IDBFS=IDBFS,Module._exit=_exit,Module._setTempRet0=_setTempRet0,Module._getTempRet0=_getTempRet0,Module._emscripten_force_exit=_emscripten_force_exit,Module._sched_yield=_sched_yield,Module.___cxa_find_matching_catch_2=___cxa_find_matching_catch_2,Module.___cxa_find_matching_catch_3=___cxa_find_matching_catch_3,Module.___cxa_throw=___cxa_throw,Module.___cxa_rethrow=___cxa_rethrow,Module.___cxa_begin_catch=___cxa_begin_catch,Module.___cxa_end_catch=___cxa_end_catch,Module.___cxa_uncaught_exceptions=___cxa_uncaught_exceptions,Module.___cxa_current_primary_exception=___cxa_current_primary_exception,Module.___cxa_rethrow_primary_exception=___cxa_rethrow_primary_exception,Module.___resumeException=___resumeException;var _fflush,_malloc,_calloc,_htons,_htonl,___funcs_on_exit,___dl_seterr,__emscripten_find_dylib,_emscripten_builtin_memalign,_ntohs,__emscripten_timeout,_emscripten_get_sbrk_ptr,_setThrew,__emscripten_tempret_set,__emscripten_tempret_get,__emscripten_stack_restore,__emscripten_stack_alloc,_emscripten_stack_get_current,___cxa_decrement_exception_refcount,___cxa_increment_exception_refcount,___cxa_get_exception_ptr,___heap_base,wasmTable;function assignWasmExports(e){Module._palloc0=e.palloc0,Module._RelationGetNumberOfBlocksInFork=e.RelationGetNumberOfBlocksInFork,Module._ExtendBufferedRel=e.ExtendBufferedRel,Module._MarkBufferDirty=e.MarkBufferDirty,Module._XLogBeginInsert=e.XLogBeginInsert,Module._XLogRegisterData=e.XLogRegisterData,Module._XLogRegisterBuffer=e.XLogRegisterBuffer,Module._XLogInsert=e.XLogInsert,Module._UnlockReleaseBuffer=e.UnlockReleaseBuffer,Module._palloc=e.palloc,Module._brin_build_desc=e.brin_build_desc,Module._EnterParallelMode=e.EnterParallelMode,Module._CreateParallelContext=e.CreateParallelContext,Module._GetTransactionSnapshot=e.GetTransactionSnapshot,Module._RegisterSnapshot=e.RegisterSnapshot,Module._table_parallelscan_estimate=e.table_parallelscan_estimate,Module._add_size=e.add_size,Module._tuplesort_estimate_shared=e.tuplesort_estimate_shared,Module._mul_size=e.mul_size,Module._strlen=e.strlen,Module._InitializeParallelDSM=e.InitializeParallelDSM,Module._UnregisterSnapshot=e.UnregisterSnapshot,Module._DestroyParallelContext=e.DestroyParallelContext,Module._ExitParallelMode=e.ExitParallelMode,Module._shm_toc_allocate=e.shm_toc_allocate,Module._ConditionVariableInit=e.ConditionVariableInit,Module._table_parallelscan_initialize=e.table_parallelscan_initialize,Module._tuplesort_initialize_shared=e.tuplesort_initialize_shared,Module._shm_toc_insert=e.shm_toc_insert,Module._LaunchParallelWorkers=e.LaunchParallelWorkers,Module._WaitForParallelWorkersToAttach=e.WaitForParallelWorkersToAttach,Module._s_lock=e.s_lock,Module._ConditionVariableSleep=e.ConditionVariableSleep,Module._ConditionVariableCancelSleep=e.ConditionVariableCancelSleep,Module._tuplesort_performsort=e.tuplesort_performsort,Module._AllocSetContextCreateInternal=e.AllocSetContextCreateInternal,Module._tuplesort_end=e.tuplesort_end,Module._MemoryContextReset=e.MemoryContextReset,Module._brin_deform_tuple=e.brin_deform_tuple,Module._pfree=e.pfree,Module._MemoryContextDelete=e.MemoryContextDelete,Module._errstart_cold=e.errstart_cold,Module._errmsg_internal=e.errmsg_internal,Module._errfinish=e.errfinish,Module._log_newpage_buffer=e.log_newpage_buffer,Module._ProcessInterrupts=e.ProcessInterrupts,Module._errstart=e.errstart,Module._errcode=e.errcode,Module._errmsg=e.errmsg,Module._LockBuffer=e.LockBuffer,Module._ReleaseBuffer=e.ReleaseBuffer,Module._IndexGetRelation=e.IndexGetRelation,Module._table_open=e.table_open,Module._ReadBufferExtended=e.ReadBufferExtended,Module._table_close=e.table_close,Module._build_reloptions=e.build_reloptions,Module._RelationGetIndexScan=e.RelationGetIndexScan,Module._pgstat_assoc_relation=e.pgstat_assoc_relation,Module._palloc0_mul=e.palloc0_mul,Module._index_getprocinfo=e.index_getprocinfo,Module._fmgr_info_copy=e.fmgr_info_copy,Module._FunctionCall4Coll=e.FunctionCall4Coll,Module._palloc_mul=e.palloc_mul,Module._FunctionCall1Coll=e.FunctionCall1Coll,Module._brin_free_desc=e.brin_free_desc,Module._WaitForParallelWorkersToFinish=e.WaitForParallelWorkersToFinish,Module._PageGetFreeSpace=e.PageGetFreeSpace,Module._BufferGetBlockNumber=e.BufferGetBlockNumber,Module._BuildIndexInfo=e.BuildIndexInfo,Module._Int64GetDatum=e.Int64GetDatum,Module._DirectFunctionCall2Coll=e.DirectFunctionCall2Coll,Module._RecoveryInProgress=e.RecoveryInProgress,Module._GetUserIdAndSecContext=e.GetUserIdAndSecContext,Module._SetUserIdAndSecContext=e.SetUserIdAndSecContext,Module._NewGUCNestLevel=e.NewGUCNestLevel,Module._RestrictSearchPath=e.RestrictSearchPath,Module._index_open=e.index_open,Module._object_ownercheck=e.object_ownercheck,Module._aclcheck_error=e.aclcheck_error,Module._AtEOXact_GUC=e.AtEOXact_GUC,Module._relation_close=e.relation_close,Module._errhint=e.errhint,Module._GetUserId=e.GetUserId,Module._ReadBuffer=e.ReadBuffer,Module._shm_toc_lookup=e.shm_toc_lookup,Module._pgstat_report_activity=e.pgstat_report_activity,Module._tuplesort_attach_shared=e.tuplesort_attach_shared,Module._index_close=e.index_close,Module._table_beginscan_parallel=e.table_beginscan_parallel,Module._ConditionVariableSignal=e.ConditionVariableSignal,Module._datumCopy=e.datumCopy,Module._lookup_type_cache=e.lookup_type_cache,Module._get_fn_opclass_options=e.get_fn_opclass_options,Module._log=e.log,Module._pg_detoast_datum=e.pg_detoast_datum,Module._index_getprocid=e.index_getprocid,Module._errdetail_internal=e.errdetail_internal,Module._pg_popcount_optimized=e.pg_popcount_optimized,Module._init_local_reloptions=e.init_local_reloptions,Module._initStringInfo=e.initStringInfo,Module._appendStringInfoChar=e.appendStringInfoChar,Module._appendStringInfo=e.appendStringInfo,Module._FunctionCall2Coll=e.FunctionCall2Coll,Module._SearchSysCache4=e.SearchSysCache4,Module._SysCacheGetAttrNotNull=e.SysCacheGetAttrNotNull,Module._ReleaseSysCache=e.ReleaseSysCache,Module._get_opcode=e.get_opcode,Module._fmgr_info_cxt=e.fmgr_info_cxt,Module._Float8GetDatum=e.Float8GetDatum,Module._numeric_float8=e.numeric_float8,Module._numeric_sub=e.numeric_sub,Module._DirectFunctionCall1Coll=e.DirectFunctionCall1Coll,Module._pg_detoast_datum_packed=e.pg_detoast_datum_packed,Module._pg_qsort=e.pg_qsort,Module._get_typbyval=e.get_typbyval,Module._get_typlen=e.get_typlen,Module._qsort_arg=e.qsort_arg,Module._add_local_int_reloption=e.add_local_int_reloption,Module._getTypeOutputInfo=e.getTypeOutputInfo,Module._fmgr_info=e.fmgr_info,Module._OutputFunctionCall=e.OutputFunctionCall,Module._cstring_to_text_with_len=e.cstring_to_text_with_len,Module._accumArrayResult=e.accumArrayResult,Module._makeArrayResult=e.makeArrayResult,Module._OidOutputFunctionCall=e.OidOutputFunctionCall,Module._cstring_to_text=e.cstring_to_text,Module._PageGetExactFreeSpace=e.PageGetExactFreeSpace,Module._PageIndexTupleOverwrite=e.PageIndexTupleOverwrite,Module._PageInit=e.PageInit,Module._PageAddItemExtended=e.PageAddItemExtended,Module._LockRelationForExtension=e.LockRelationForExtension,Module._UnlockRelationForExtension=e.UnlockRelationForExtension,Module._smgropen=e.smgropen,Module._smgrpin=e.smgrpin,Module._ItemPointerEquals=e.ItemPointerEquals,Module._detoast_external_attr=e.detoast_external_attr,Module._CreateTemplateTupleDesc=e.CreateTemplateTupleDesc,Module._TupleDescInitEntry=e.TupleDescInitEntry,Module._repalloc=e.repalloc,Module._memcmp=e.memcmp,Module._SearchSysCache1=e.SearchSysCache1,Module._get_opfamily_name=e.get_opfamily_name,Module._SearchSysCacheList=e.SearchSysCacheList,Module._check_amproc_signature=e.check_amproc_signature,Module._check_amoptsproc_signature=e.check_amoptsproc_signature,Module._format_procedure=e.format_procedure,Module._format_operator=e.format_operator,Module._check_amop_signature=e.check_amop_signature,Module._identify_opfamily_groups=e.identify_opfamily_groups,Module._format_type_be=e.format_type_be,Module._ReleaseCatCacheList=e.ReleaseCatCacheList,Module._format_type_with_typemod=e.format_type_with_typemod,Module._errdetail=e.errdetail,Module._strcmp=e.strcmp,Module._DatumGetEOHP=e.DatumGetEOHP,Module._EOH_get_flat_size=e.EOH_get_flat_size,Module._EOH_flatten_into=e.EOH_flatten_into,Module._toast_raw_datum_size=e.toast_raw_datum_size,Module._getmissingattr=e.getmissingattr,Module._hash_create=e.hash_create,Module._hash_search=e.hash_search,Module._nocachegetattr=e.nocachegetattr,Module._heap_getsysattr=e.heap_getsysattr,Module._heap_form_tuple=e.heap_form_tuple,Module._heap_modify_tuple=e.heap_modify_tuple,Module._heap_deform_tuple=e.heap_deform_tuple,Module._heap_modify_tuple_by_cols=e.heap_modify_tuple_by_cols,Module._heap_freetuple=e.heap_freetuple,Module._hash_bytes=e.hash_bytes,Module._index_form_tuple=e.index_form_tuple,Module._MemoryContextAllocZero=e.MemoryContextAllocZero,Module._nocache_index_getattr=e.nocache_index_getattr,Module._index_deform_tuple=e.index_deform_tuple,Module._CopyIndexTuple=e.CopyIndexTuple,Module._CreateTupleDescTruncatedCopy=e.CreateTupleDescTruncatedCopy,Module._enlargeStringInfo=e.enlargeStringInfo,Module._slot_getsomeattrs_int=e.slot_getsomeattrs_int,Module._pg_lltoa=e.pg_lltoa,Module._pg_ltoa=e.pg_ltoa,Module._pq_sendbytes=e.pq_sendbytes,Module._pg_printf=e.pg_printf,Module._relation_open=e.relation_open,Module._LockRelationOid=e.LockRelationOid,Module._RelationIdGetRelation=e.RelationIdGetRelation,Module._try_relation_open=e.try_relation_open,Module._SearchSysCacheExists=e.SearchSysCacheExists,Module._UnlockRelationOid=e.UnlockRelationOid,Module._relation_openrv=e.relation_openrv,Module._AcceptInvalidationMessages=e.AcceptInvalidationMessages,Module._RangeVarGetRelidExtended=e.RangeVarGetRelidExtended,Module._RelationClose=e.RelationClose,Module._add_reloption_kind=e.add_reloption_kind,Module._register_reloptions_validator=e.register_reloptions_validator,Module._lappend=e.lappend,Module._pstrdup=e.pstrdup,Module._add_int_reloption=e.add_int_reloption,Module._add_real_reloption=e.add_real_reloption,Module._add_enum_reloption=e.add_enum_reloption,Module._add_string_reloption=e.add_string_reloption,Module._strdup=e.strdup,Module._MemoryContextStrdup=e.MemoryContextStrdup,Module._transformRelOptions=e.transformRelOptions,Module._deconstruct_array_builtin=e.deconstruct_array_builtin,Module._strncmp=e.strncmp,Module._defGetString=e.defGetString,Module._strchr=e.strchr,Module._defGetBoolean=e.defGetBoolean,Module._pg_sprintf=e.pg_sprintf,Module._untransformRelOptions=e.untransformRelOptions,Module._text_to_cstring=e.text_to_cstring,Module._makeString=e.makeString,Module._makeDefElem=e.makeDefElem,Module._heap_reloptions=e.heap_reloptions,Module._index_reloptions=e.index_reloptions,Module._strcpy=e.strcpy,Module._MemoryContextAlloc=e.MemoryContextAlloc,Module._parse_bool=e.parse_bool,Module._parse_int=e.parse_int,Module._parse_real=e.parse_real,Module._pg_strcasecmp=e.pg_strcasecmp,Module._ScanKeyInit=e.ScanKeyInit,Module._dsm_segment_handle=e.dsm_segment_handle,Module._dsm_create=e.dsm_create,Module._dsm_segment_address=e.dsm_segment_address,Module._dsa_pin_mapping=e.dsa_pin_mapping,Module._dsm_attach=e.dsm_attach,Module._dsm_detach=e.dsm_detach,Module._ShmemInitStruct=e.ShmemInitStruct,Module._LWLockAcquire=e.LWLockAcquire,Module._LWLockRelease=e.LWLockRelease,Module._LWLockConditionalAcquire=e.LWLockConditionalAcquire,Module._dsa_create_ext=e.dsa_create_ext,Module._dsa_allocate_extended=e.dsa_allocate_extended,Module._dsa_get_address=e.dsa_get_address,Module._LWLockInitialize=e.LWLockInitialize,Module._dsa_attach=e.dsa_attach,Module._dsa_free=e.dsa_free,Module._dsa_get_total_size=e.dsa_get_total_size,Module._MemoryContextMemAllocated=e.MemoryContextMemAllocated,Module._check_stack_depth=e.check_stack_depth,Module._GetCurrentCommandId=e.GetCurrentCommandId,Module._toast_open_indexes=e.toast_open_indexes,Module._GetNewOidWithIndex=e.GetNewOidWithIndex,Module._heap_insert=e.heap_insert,Module._RelationGetIndexList=e.RelationGetIndexList,Module._list_free=e.list_free,Module._systable_beginscan=e.systable_beginscan,Module._systable_getnext=e.systable_getnext,Module._systable_endscan=e.systable_endscan,Module._toast_close_indexes=e.toast_close_indexes,Module._systable_beginscan_ordered=e.systable_beginscan_ordered,Module._systable_getnext_ordered=e.systable_getnext_ordered,Module._systable_endscan_ordered=e.systable_endscan_ordered,Module._get_toast_snapshot=e.get_toast_snapshot,Module._convert_tuples_by_position=e.convert_tuples_by_position,Module._execute_attr_map_tuple=e.execute_attr_map_tuple,Module._ExecStoreVirtualTuple=e.ExecStoreVirtualTuple,Module._bms_is_member=e.bms_is_member,Module._bms_add_member=e.bms_add_member,Module._free_conversion_map=e.free_conversion_map,Module._CreateTupleDescCopy=e.CreateTupleDescCopy,Module._FreeTupleDesc=e.FreeTupleDesc,Module._ResourceOwnerEnlarge=e.ResourceOwnerEnlarge,Module._ResourceOwnerRemember=e.ResourceOwnerRemember,Module._DecrTupleDescRefCount=e.DecrTupleDescRefCount,Module._ResourceOwnerForget=e.ResourceOwnerForget,Module._datumIsEqual=e.datumIsEqual,Module._equalRowTypes=e.equalRowTypes,Module._hashRowType=e.hashRowType,Module._namestrcpy=e.namestrcpy,Module._TupleDescInitEntryCollation=e.TupleDescInitEntryCollation,Module._BuildDescFromLists=e.BuildDescFromLists,Module._stringToNode=e.stringToNode,Module._psprintf=e.psprintf,Module._pg_detoast_datum_copy=e.pg_detoast_datum_copy,Module._get_typlenbyvalalign=e.get_typlenbyvalalign,Module._deconstruct_array=e.deconstruct_array,Module._ginCompareAttEntries=e.ginCompareAttEntries,Module._repalloc_huge=e.repalloc_huge,Module._GinDataLeafPageGetItems=e.GinDataLeafPageGetItems,Module._tbm_add_tuples=e.tbm_add_tuples,Module._ginPostingListDecode=e.ginPostingListDecode,Module._ItemPointerCompare=e.ItemPointerCompare,Module._gintuple_get_attrnum=e.gintuple_get_attrnum,Module._gintuple_get_key=e.gintuple_get_key,Module._LockPage=e.LockPage,Module._UnlockPage=e.UnlockPage,Module._vacuum_delay_point=e.vacuum_delay_point,Module._RecordFreeIndexPage=e.RecordFreeIndexPage,Module._IndexFreeSpaceMapVacuum=e.IndexFreeSpaceMapVacuum,Module._repalloc_mul=e.repalloc_mul,Module._initGinState=e.initGinState,Module._pg_prng_double=e.pg_prng_double,Module._pgstat_progress_update_param=e.pgstat_progress_update_param,Module._log_newpage_range=e.log_newpage_range,Module._GetFreeIndexPage=e.GetFreeIndexPage,Module._ConditionalLockBuffer=e.ConditionalLockBuffer,Module._LockBufferForCleanup=e.LockBufferForCleanup,Module._ReadNextFullTransactionId=e.ReadNextFullTransactionId,Module._PageIndexMultiDelete=e.PageIndexMultiDelete,Module._list_make1_impl=e.list_make1_impl,Module._list_delete_first=e.list_delete_first,Module._lcons=e.lcons,Module._pow=e.pow,Module._smgrnblocks=e.smgrnblocks,Module._list_free_deep=e.list_free_deep,Module._BufFileCreateTemp=e.BufFileCreateTemp,Module._BufFileWrite=e.BufFileWrite,Module._BufFileReadExact=e.BufFileReadExact,Module._BufFileClose=e.BufFileClose,Module._pairingheap_remove_first=e.pairingheap_remove_first,Module._pairingheap_add=e.pairingheap_add,Module._float_overflow_error=e.float_overflow_error,Module._float8_cmp_internal=e.float8_cmp_internal,Module._float_underflow_error=e.float_underflow_error,Module._DirectFunctionCall5Coll=e.DirectFunctionCall5Coll,Module._pairingheap_allocate=e.pairingheap_allocate,Module._get_func_rettype=e.get_func_rettype,Module._OidFunctionCall1Coll=e.OidFunctionCall1Coll,Module._GenerationContextCreate=e.GenerationContextCreate,Module._block_range_read_stream_cb=e.block_range_read_stream_cb,Module._read_stream_begin_relation=e.read_stream_begin_relation,Module._read_stream_next_buffer=e.read_stream_next_buffer,Module._read_stream_end=e.read_stream_end,Module._estimate_rel_size=e.estimate_rel_size,Module.__hash_spareindex=e._hash_spareindex,Module.__hash_getbuf=e._hash_getbuf,Module.__hash_relbuf=e._hash_relbuf,Module.__hash_get_indextuple_hashkey=e._hash_get_indextuple_hashkey,Module._hashcharextended=e.hashcharextended,Module._hashint8=e.hashint8,Module._hashint8extended=e.hashint8extended,Module._hash_bytes_extended=e.hash_bytes_extended,Module._hashfloat8=e.hashfloat8,Module._hashfloat8extended=e.hashfloat8extended,Module._pg_newlocale_from_collation=e.pg_newlocale_from_collation,Module.__hash_ovflblkno_to_bitno=e._hash_ovflblkno_to_bitno,Module.__hash_get_totalbuckets=e._hash_get_totalbuckets,Module._hash_destroy=e.hash_destroy,Module._list_append_unique_oid=e.list_append_unique_oid,Module._list_member_oid=e.list_member_oid,Module._CommandCounterIncrement=e.CommandCounterIncrement,Module._get_opclass_input_type=e.get_opclass_input_type,Module._list_concat_copy=e.list_concat_copy,Module._HeapTupleSatisfiesVisibility=e.HeapTupleSatisfiesVisibility,Module._GetAccessStrategy=e.GetAccessStrategy,Module._FreeAccessStrategy=e.FreeAccessStrategy,Module._heap_getnext=e.heap_getnext,Module._ExecStoreBufferHeapTuple=e.ExecStoreBufferHeapTuple,Module._heap_fetch=e.heap_fetch,Module._HeapTupleSatisfiesVacuum=e.HeapTupleSatisfiesVacuum,Module._GetMultiXactIdMembers=e.GetMultiXactIdMembers,Module._TransactionIdPrecedes=e.TransactionIdPrecedes,Module._GetBulkInsertState=e.GetBulkInsertState,Module._FreeBulkInsertState=e.FreeBulkInsertState,Module._visibilitymap_clear_locked=e.visibilitymap_clear_locked,Module._pgstat_count_heap_insert=e.pgstat_count_heap_insert,Module._heap_multi_insert=e.heap_multi_insert,Module._ExecFetchSlotHeapTuple=e.ExecFetchSlotHeapTuple,Module._heap_delete=e.heap_delete,Module._IsInParallelMode=e.IsInParallelMode,Module._visibilitymap_pin=e.visibilitymap_pin,Module._HeapTupleSatisfiesUpdate=e.HeapTupleSatisfiesUpdate,Module._TransactionIdIsCurrentTransactionId=e.TransactionIdIsCurrentTransactionId,Module._TransactionIdDidCommit=e.TransactionIdDidCommit,Module._UnlockTuple=e.UnlockTuple,Module._TransactionIdIsInProgress=e.TransactionIdIsInProgress,Module._bms_free=e.bms_free,Module._bms_add_members=e.bms_add_members,Module._bms_next_member=e.bms_next_member,Module._bms_overlap=e.bms_overlap,Module._HeapTupleGetUpdateXid=e.HeapTupleGetUpdateXid,Module._heap_lock_tuple=e.heap_lock_tuple,Module._MultiXactIdPrecedes=e.MultiXactIdPrecedes,Module._heap_tuple_needs_eventual_freeze=e.heap_tuple_needs_eventual_freeze,Module._PrefetchBuffer=e.PrefetchBuffer,Module._RelationTruncate=e.RelationTruncate,Module._FlushRelationBuffers=e.FlushRelationBuffers,Module._smgrexists=e.smgrexists,Module._table_slot_create=e.table_slot_create,Module._ExecDropSingleTupleTableSlot=e.ExecDropSingleTupleTableSlot,Module._CreateExecutorState=e.CreateExecutorState,Module._MakePerTupleExprContext=e.MakePerTupleExprContext,Module._ExecPrepareQual=e.ExecPrepareQual,Module._GetOldestNonRemovableTransactionId=e.GetOldestNonRemovableTransactionId,Module._FormIndexDatum=e.FormIndexDatum,Module._FreeExecutorState=e.FreeExecutorState,Module._MakeSingleTupleTableSlot=e.MakeSingleTupleTableSlot,Module._tuplesort_getdatum=e.tuplesort_getdatum,Module._ExecStoreHeapTuple=e.ExecStoreHeapTuple,Module._XidInMVCCSnapshot=e.XidInMVCCSnapshot,Module._bsearch=e.bsearch,Module._XLogRecGetBlockTagExtended=e.XLogRecGetBlockTagExtended,Module._hash_seq_init=e.hash_seq_init,Module._hash_seq_search=e.hash_seq_search,Module._errcode_for_file_access=e.errcode_for_file_access,Module._pg_snprintf=e.pg_snprintf,Module._OpenTransientFile=e.OpenTransientFile,Module._ftruncate=e.ftruncate,Module.___errno_location=e.__errno_location,Module._pwrite=e.pwrite,Module._CloseTransientFile=e.CloseTransientFile,Module._sscanf=e.sscanf,Module._unlink=e.unlink,Module._fsync_fname=e.fsync_fname,Module._GetCurrentTimestamp=e.GetCurrentTimestamp,Module._get_database_name=e.get_database_name,Module._get_namespace_name=e.get_namespace_name,Module._pg_prng_uint32=e.pg_prng_uint32,Module._GetRecordedFreeSpace=e.GetRecordedFreeSpace,Module._visibilitymap_get_status=e.visibilitymap_get_status,Module._vac_estimate_reltuples=e.vac_estimate_reltuples,Module._WaitLatch=e.WaitLatch,Module._ResetLatch=e.ResetLatch,Module._clock_gettime=e.clock_gettime,Module._WalUsageAccumDiff=e.WalUsageAccumDiff,Module._BufferUsageAccumDiff=e.BufferUsageAccumDiff,Module._appendStringInfoString=e.appendStringInfoString,Module._set_errcontext_domain=e.set_errcontext_domain,Module._errcontext_msg=e.errcontext_msg,Module._visibilitymap_prepare_truncate=e.visibilitymap_prepare_truncate,Module._GetIndexAmRoutine=e.GetIndexAmRoutine,Module._check_enable_rls=e.check_enable_rls,Module._pg_class_aclcheck=e.pg_class_aclcheck,Module._pg_attribute_aclcheck=e.pg_attribute_aclcheck,Module._try_index_open=e.try_index_open,Module._btboolcmp=e.btboolcmp,Module._btint2cmp=e.btint2cmp,Module._btint4cmp=e.btint4cmp,Module._btint8cmp=e.btint8cmp,Module._btoidcmp=e.btoidcmp,Module._btcharcmp=e.btcharcmp,Module.__bt_form_posting=e._bt_form_posting,Module.__bt_mkscankey=e._bt_mkscankey,Module.__bt_checkpage=e._bt_checkpage,Module.__bt_compare=e._bt_compare,Module.__bt_relbuf=e._bt_relbuf,Module.__bt_search=e._bt_search,Module.__bt_binsrch_insert=e._bt_binsrch_insert,Module.__bt_freestack=e._bt_freestack,Module.__bt_metaversion=e._bt_metaversion,Module._get_opfamily_member=e.get_opfamily_member,Module._OidFunctionCall2Coll=e.OidFunctionCall2Coll,Module.__bt_allequalimage=e._bt_allequalimage,Module.___wasm_setjmp_test=e.__wasm_setjmp_test,Module._before_shmem_exit=e.before_shmem_exit,Module.___wasm_setjmp=e.__wasm_setjmp,Module._cancel_before_shmem_exit=e.cancel_before_shmem_exit,Module._pg_re_throw=e.pg_re_throw,Module._emscripten_longjmp=e.emscripten_longjmp,Module._ConditionVariableBroadcast=e.ConditionVariableBroadcast,Module._datum_image_eq=e.datum_image_eq,Module._time=e.time,Module.__bt_check_natts=e._bt_check_natts,Module._strlcpy=e.strlcpy,Module._strncpy=e.strncpy,Module._timestamptz_to_str=e.timestamptz_to_str,Module._XLogRecGetBlockRefInfo=e.XLogRecGetBlockRefInfo,Module._varstr_cmp=e.varstr_cmp,Module._get_atttype=e.get_atttype,Module._getBaseType=e.getBaseType,Module._exprType=e.exprType,Module._GetActiveSnapshot=e.GetActiveSnapshot,Module._errdetail_relkind_not_supported=e.errdetail_relkind_not_supported,Module._table_openrv=e.table_openrv,Module._table_slot_callbacks=e.table_slot_callbacks,Module._clamp_row_est=e.clamp_row_est,Module._pre_format_elog_string=e.pre_format_elog_string,Module._format_elog_string=e.format_elog_string,Module._IsTransactionState=e.IsTransactionState,Module._estimate_expression_value=e.estimate_expression_value,Module._SetConfigOption=e.SetConfigOption,Module._XLogFlush=e.XLogFlush,Module._get_call_result_type=e.get_call_result_type,Module._HeapTupleHeaderGetDatum=e.HeapTupleHeaderGetDatum,Module._GenericXLogStart=e.GenericXLogStart,Module._GenericXLogRegisterBuffer=e.GenericXLogRegisterBuffer,Module._GenericXLogFinish=e.GenericXLogFinish,Module._GenericXLogAbort=e.GenericXLogAbort,Module._errmsg_plural=e.errmsg_plural,Module._ReadNextMultiXactId=e.ReadNextMultiXactId,Module._ReadMultiXactIdRange=e.ReadMultiXactIdRange,Module._MultiXactIdPrecedesOrEquals=e.MultiXactIdPrecedesOrEquals,Module._init_MultiFuncCall=e.init_MultiFuncCall,Module._TupleDescGetAttInMetadata=e.TupleDescGetAttInMetadata,Module._per_MultiFuncCall=e.per_MultiFuncCall,Module._BuildTupleFromCStrings=e.BuildTupleFromCStrings,Module._end_MultiFuncCall=e.end_MultiFuncCall,Module._GetCurrentSubTransactionId=e.GetCurrentSubTransactionId,Module._GetSessionUserId=e.GetSessionUserId,Module._WaitForBackgroundWorkerShutdown=e.WaitForBackgroundWorkerShutdown,Module._RegisterDynamicBackgroundWorker=e.RegisterDynamicBackgroundWorker,Module._appendBinaryStringInfo=e.appendBinaryStringInfo,Module._pq_getmsgbyte=e.pq_getmsgbyte,Module._ThrowErrorData=e.ThrowErrorData,Module._pq_getmsgint=e.pq_getmsgint,Module._pq_getmsgint64=e.pq_getmsgint64,Module._die=e.die,Module._pqsignal_be=e.pqsignal_be,Module._BackgroundWorkerUnblockSignals=e.BackgroundWorkerUnblockSignals,Module._load_external_function=e.load_external_function,Module._BackgroundWorkerInitializeConnectionByOid=e.BackgroundWorkerInitializeConnectionByOid,Module._GetDatabaseEncoding=e.GetDatabaseEncoding,Module._StartTransactionCommand=e.StartTransactionCommand,Module._CommitTransactionCommand=e.CommitTransactionCommand,Module._PushActiveSnapshot=e.PushActiveSnapshot,Module._PopActiveSnapshot=e.PopActiveSnapshot,Module._RmgrNotFound=e.RmgrNotFound,Module._InitMaterializedSRF=e.InitMaterializedSRF,Module._tuplestore_putvalues=e.tuplestore_putvalues,Module._pread=e.pread,Module._lseek=e.lseek,Module._strspn=e.strspn,Module._strtoll=e.strtoll,Module._AllocateFile=e.AllocateFile,Module._fgets=e.fgets,Module._ferror=e.ferror,Module._FreeFile=e.FreeFile,Module._getpid=e.getpid,Module._read=e.read,Module._write=e.write,Module._durable_rename=e.durable_rename,Module._BlessTupleDesc=e.BlessTupleDesc,Module._fstat=e.fstat,Module._superuser_arg=e.superuser_arg,Module._wal_segment_close=e.wal_segment_close,Module._wal_segment_open=e.wal_segment_open,Module._XLogReaderAllocate=e.XLogReaderAllocate,Module._XLogReadRecord=e.XLogReadRecord,Module._XLogReaderFree=e.XLogReaderFree,Module._strtoull=e.strtoull,Module._access=e.access,Module._IsAbortedTransactionBlockState=e.IsAbortedTransactionBlockState,Module._GetTopFullTransactionId=e.GetTopFullTransactionId,Module._GetCurrentFullTransactionId=e.GetCurrentFullTransactionId,Module._GetCurrentTransactionNestLevel=e.GetCurrentTransactionNestLevel,Module._ResourceOwnerCreate=e.ResourceOwnerCreate,Module._AbortCurrentTransaction=e.AbortCurrentTransaction,Module._PreventInTransactionBlock=e.PreventInTransactionBlock,Module._IsTransactionBlock=e.IsTransactionBlock,Module._RegisterXactCallback=e.RegisterXactCallback,Module._UnregisterXactCallback=e.UnregisterXactCallback,Module._RegisterSubXactCallback=e.RegisterSubXactCallback,Module._BeginInternalSubTransaction=e.BeginInternalSubTransaction,Module._ReleaseCurrentSubTransaction=e.ReleaseCurrentSubTransaction,Module._ResourceOwnerDelete=e.ResourceOwnerDelete,Module._RollbackAndReleaseCurrentSubTransaction=e.RollbackAndReleaseCurrentSubTransaction,Module._pg_usleep=e.pg_usleep,Module._close=e.close,Module._ReleaseExternalFD=e.ReleaseExternalFD,Module._GetDefaultCharSignedness=e.GetDefaultCharSignedness,Module._SplitIdentifierString=e.SplitIdentifierString,Module._guc_malloc=e.guc_malloc,Module._find_option=e.find_option,Module._gettimeofday=e.gettimeofday,Module._pg_strong_random=e.pg_strong_random,Module._stat=e.stat,Module._GetFlushRecPtr=e.GetFlushRecPtr,Module._GetXLogReplayRecPtr=e.GetXLogReplayRecPtr,Module._TimestampDifferenceMilliseconds=e.TimestampDifferenceMilliseconds,Module._strtoul=e.strtoul,Module._readlink=e.readlink,Module._pg_fprintf=e.pg_fprintf,_fflush=Module._fflush=e.fflush,Module._pgl_system=e.pgl_system,Module._wait_result_to_str=e.wait_result_to_str,Module._replace_percent_placeholders=e.replace_percent_placeholders,Module._makeStringInfo=e.makeStringInfo,Module._pg_toupper=e.pg_toupper,Module._numeric_in=e.numeric_in,Module._DirectFunctionCall3Coll=e.DirectFunctionCall3Coll,Module._palloc_extended=e.palloc_extended,Module._pg_vsnprintf=e.pg_vsnprintf,Module._XLogFindNextRecord=e.XLogFindNextRecord,Module._RestoreBlockImage=e.RestoreBlockImage,Module._timestamptz_in=e.timestamptz_in,Module._fscanf=e.fscanf,Module._symlink=e.symlink,Module._ConditionVariableTimedSleep=e.ConditionVariableTimedSleep,Module._ParseDateTime=e.ParseDateTime,Module._DecodeDateTime=e.DecodeDateTime,Module._tm2timestamp=e.tm2timestamp,Module._XLogRecStoreStats=e.XLogRecStoreStats,Module._hash_get_num_entries=e.hash_get_num_entries,Module._read_local_xlog_page_no_wait=e.read_local_xlog_page_no_wait,Module._escape_json_with_len=e.escape_json_with_len,Module._BufFileSeek=e.BufFileSeek,Module._lstat=e.lstat,Module._destroyStringInfo=e.destroyStringInfo,Module._list_sort=e.list_sort,Module._pgl_geteuid=e.pgl_geteuid,Module._getegid=e.getegid,Module._pg_checksum_page=e.pg_checksum_page,Module._CreateDestReceiver=e.CreateDestReceiver,Module._bbsink_forward_end_archive=e.bbsink_forward_end_archive,Module._bbsink_forward_begin_manifest=e.bbsink_forward_begin_manifest,Module._bbsink_forward_end_manifest=e.bbsink_forward_end_manifest,Module._bbsink_forward_end_backup=e.bbsink_forward_end_backup,Module._bbsink_forward_cleanup=e.bbsink_forward_cleanup,Module._MemoryContextAllocExtended=e.MemoryContextAllocExtended,Module._appendStringInfoVA=e.appendStringInfoVA,Module._list_concat=e.list_concat,Module._strrchr=e.strrchr,Module._bbsink_forward_begin_backup=e.bbsink_forward_begin_backup,Module._bbsink_forward_archive_contents=e.bbsink_forward_archive_contents,Module._bbsink_forward_begin_archive=e.bbsink_forward_begin_archive,Module._bbsink_forward_manifest_contents=e.bbsink_forward_manifest_contents,Module._has_privs_of_role=e.has_privs_of_role,Module._BaseBackupAddTarget=e.BaseBackupAddTarget,Module._list_copy=e.list_copy,Module._tuplestore_puttuple=e.tuplestore_puttuple,Module._isatty=e.isatty,Module._makeRangeVar=e.makeRangeVar,Module._DefineIndex=e.DefineIndex,Module._getc=e.getc,Module._fread=e.fread,Module._clearerr=e.clearerr,Module._OidInputFunctionCall=e.OidInputFunctionCall,Module._copyObjectImpl=e.copyObjectImpl,Module._get_rolespec_oid=e.get_rolespec_oid,Module._lappend_oid=e.lappend_oid,Module._get_object_address=e.get_object_address,Module._makeTypeNameFromNameList=e.makeTypeNameFromNameList,Module._SearchSysCacheLocked1=e.SearchSysCacheLocked1,Module._SearchSysCache2=e.SearchSysCache2,Module._SysCacheGetAttr=e.SysCacheGetAttr,Module._CatalogTupleUpdate=e.CatalogTupleUpdate,Module._get_attnum=e.get_attnum,Module._get_rel_name=e.get_rel_name,Module._CatalogTupleDelete=e.CatalogTupleDelete,Module._get_namespace_oid=e.get_namespace_oid,Module._SearchSysCache3=e.SearchSysCache3,Module._performDeletion=e.performDeletion,Module._CatalogTupleInsert=e.CatalogTupleInsert,Module._recordDependencyOn=e.recordDependencyOn,Module._RunObjectPostAlterHook=e.RunObjectPostAlterHook,Module._aclcheck_error_col=e.aclcheck_error_col,Module._get_element_type=e.get_element_type,Module._object_aclcheck=e.object_aclcheck,Module._isTempNamespace=e.isTempNamespace,Module._pg_attribute_aclcheck_all=e.pg_attribute_aclcheck_all,Module._IsToastNamespace=e.IsToastNamespace,Module._IsCatalogNamespace=e.IsCatalogNamespace,Module._superuser=e.superuser,Module._SearchSysCacheAttName=e.SearchSysCacheAttName,Module._LockDatabaseObject=e.LockDatabaseObject,Module._new_object_addresses=e.new_object_addresses,Module._UnlockDatabaseObject=e.UnlockDatabaseObject,Module._free_object_addresses=e.free_object_addresses,Module._performMultipleDeletions=e.performMultipleDeletions,Module._recordDependencyOnExpr=e.recordDependencyOnExpr,Module._get_typ_typrelid=e.get_typ_typrelid,Module._query_tree_walker_impl=e.query_tree_walker_impl,Module._expression_tree_walker_impl=e.expression_tree_walker_impl,Module._add_exact_object_address=e.add_exact_object_address,Module._get_rel_relkind=e.get_rel_relkind,Module._SystemAttributeDefinition=e.SystemAttributeDefinition,Module._get_typtype=e.get_typtype,Module._list_delete_last=e.list_delete_last,Module._type_is_collatable=e.type_is_collatable,Module._CatalogOpenIndexes=e.CatalogOpenIndexes,Module._CatalogCloseIndexes=e.CatalogCloseIndexes,Module._get_relname_relid=e.get_relname_relid,Module._GetSysCacheOid=e.GetSysCacheOid,Module._SearchSysCacheCopy=e.SearchSysCacheCopy,Module._CheckTableNotInUse=e.CheckTableNotInUse,Module._RelationForgetRelation=e.RelationForgetRelation,Module._construct_array=e.construct_array,Module._make_parsestate=e.make_parsestate,Module._addRangeTableEntryForRelation=e.addRangeTableEntryForRelation,Module._addNSItemToQuery=e.addNSItemToQuery,Module._transformExpr=e.transformExpr,Module._coerce_to_boolean=e.coerce_to_boolean,Module._assign_expr_collations=e.assign_expr_collations,Module._pull_var_clause=e.pull_var_clause,Module._get_attname=e.get_attname,Module._equal=e.equal,Module._coerce_to_target_type=e.coerce_to_target_type,Module._nodeToString=e.nodeToString,Module._list_delete_nth_cell=e.list_delete_nth_cell,Module._lappend_int=e.lappend_int,Module._CatalogTupleInsertWithInfo=e.CatalogTupleInsertWithInfo,Module._heap_truncate_find_FKs=e.heap_truncate_find_FKs,Module._list_oid_cmp=e.list_oid_cmp,Module._buildint2vector=e.buildint2vector,Module._buildoidvector=e.buildoidvector,Module._parser_errposition=e.parser_errposition,Module._check_functions_in_node=e.check_functions_in_node,Module._exprLocation=e.exprLocation,Module._exprTypmod=e.exprTypmod,Module._get_base_element_type=e.get_base_element_type,Module._make_ands_explicit=e.make_ands_explicit,Module._SystemFuncName=e.SystemFuncName,Module._CreateTrigger=e.CreateTrigger,Module._plan_create_index_workers=e.plan_create_index_workers,Module._GetLatestSnapshot=e.GetLatestSnapshot,Module._make_ands_implicit=e.make_ands_implicit,Module._get_rel_relispartition=e.get_rel_relispartition,Module._get_partition_ancestors=e.get_partition_ancestors,Module._tuplesort_begin_datum=e.tuplesort_begin_datum,Module._tuplesort_putdatum=e.tuplesort_putdatum,Module._list_delete_oid=e.list_delete_oid,Module._get_rel_namespace=e.get_rel_namespace,Module._ExecOpenIndices=e.ExecOpenIndices,Module._ExecCloseIndices=e.ExecCloseIndices,Module._CatalogTupleUpdateWithInfo=e.CatalogTupleUpdateWithInfo,Module._ConditionalLockRelationOid=e.ConditionalLockRelationOid,Module._RelnameGetRelid=e.RelnameGetRelid,Module._get_relkind_objtype=e.get_relkind_objtype,Module._isAnyTempNamespace=e.isAnyTempNamespace,Module._RelationIsVisible=e.RelationIsVisible,Module._TypenameGetTypid=e.TypenameGetTypid,Module._FuncnameGetCandidates=e.FuncnameGetCandidates,Module._DeconstructQualifiedName=e.DeconstructQualifiedName,Module._get_func_arg_info=e.get_func_arg_info,Module._NameListToString=e.NameListToString,Module._OpernameGetOprid=e.OpernameGetOprid,Module._OpclassnameGetOpcid=e.OpclassnameGetOpcid,Module._OpclassIsVisible=e.OpclassIsVisible,Module._get_ts_config_oid=e.get_ts_config_oid,Module._makeRangeVarFromNameList=e.makeRangeVarFromNameList,Module._quote_identifier=e.quote_identifier,Module._atoi=e.atoi,Module._GetSearchPathMatcher=e.GetSearchPathMatcher,Module._SearchPathMatchesCurrentEnvironment=e.SearchPathMatchesCurrentEnvironment,Module._get_collation_oid=e.get_collation_oid,Module._GetDatabaseEncodingName=e.GetDatabaseEncodingName,Module._CacheRegisterSyscacheCallback=e.CacheRegisterSyscacheCallback,Module._fetch_search_path=e.fetch_search_path,Module._get_extension_oid=e.get_extension_oid,Module._get_tablespace_oid=e.get_tablespace_oid,Module._get_role_oid=e.get_role_oid,Module._get_language_oid=e.get_language_oid,Module._get_am_oid=e.get_am_oid,Module._get_index_am_oid=e.get_index_am_oid,Module._GetForeignServerByName=e.GetForeignServerByName,Module._typeStringToTypeName=e.typeStringToTypeName,Module._makeFloat=e.makeFloat,Module._list_make2_impl=e.list_make2_impl,Module._check_object_ownership=e.check_object_ownership,Module._GetUserNameFromId=e.GetUserNameFromId,Module._format_type_extended=e.format_type_extended,Module._quote_qualified_identifier=e.quote_qualified_identifier,Module._get_tablespace_name=e.get_tablespace_name,Module._GetForeignServerExtended=e.GetForeignServerExtended,Module._GetForeignServer=e.GetForeignServer,Module._get_extension_name=e.get_extension_name,Module._construct_empty_array=e.construct_empty_array,Module._format_type_be_qualified=e.format_type_be_qualified,Module._get_namespace_name_or_temp=e.get_namespace_name_or_temp,Module._list_make3_impl=e.list_make3_impl,Module._get_am_name=e.get_am_name,Module._construct_md_array=e.construct_md_array,Module._pull_varattnos=e.pull_varattnos,Module._makeBoolExpr=e.makeBoolExpr,Module._eval_const_expressions=e.eval_const_expressions,Module._get_func_name=e.get_func_name,Module._construct_array_builtin=e.construct_array_builtin,Module._makeObjectName=e.makeObjectName,Module._get_primary_key_attnos=e.get_primary_key_attnos,Module._check_functional_grouping=e.check_functional_grouping,Module._bms_is_subset=e.bms_is_subset,Module._ProcessGUCArray=e.ProcessGUCArray,Module._LockHeldByMe=e.LockHeldByMe,Module._CheckRelationOidLockedByMe=e.CheckRelationOidLockedByMe,Module._getExtensionOfObject=e.getExtensionOfObject,Module._deleteDependencyRecordsFor=e.deleteDependencyRecordsFor,Module._find_inheritance_children=e.find_inheritance_children,Module._ActiveSnapshotSet=e.ActiveSnapshotSet,Module._find_all_inheritors=e.find_all_inheritors,Module._has_superclass=e.has_superclass,Module._strstr=e.strstr,Module._memchr=e.memchr,Module._get_opname=e.get_opname,Module._build_function_result_tupdesc_t=e.build_function_result_tupdesc_t,Module._CheckFunctionValidatorAccess=e.CheckFunctionValidatorAccess,Module._AcquireRewriteLocks=e.AcquireRewriteLocks,Module._pg_parse_query=e.pg_parse_query,Module._get_func_result_type=e.get_func_result_type,Module._function_parse_error_transpose=e.function_parse_error_transpose,Module._geterrposition=e.geterrposition,Module._getinternalerrposition=e.getinternalerrposition,Module._pg_mblen_cstr=e.pg_mblen_cstr,Module._pg_mbstrlen_with_len=e.pg_mbstrlen_with_len,Module._errposition=e.errposition,Module._internalerrposition=e.internalerrposition,Module._internalerrquery=e.internalerrquery,Module._bms_num_members=e.bms_num_members,Module._list_concat_unique_oid=e.list_concat_unique_oid,Module._ATExecChangeOwner=e.ATExecChangeOwner,Module._quote_literal_cstr=e.quote_literal_cstr,Module._get_array_type=e.get_array_type,Module._pnstrdup=e.pnstrdup,Module._pg_mbcliplen=e.pg_mbcliplen,Module._smgrtruncate=e.smgrtruncate,Module._smgrreadv=e.smgrreadv,Module._NewRelationCreateToastTable=e.NewRelationCreateToastTable,Module._parse_analyze_fixedparams=e.parse_analyze_fixedparams,Module._transformStmt=e.transformStmt,Module._free_parsestate=e.free_parsestate,Module._makeFromExpr=e.makeFromExpr,Module._assign_query_collations=e.assign_query_collations,Module._makeTargetEntry=e.makeTargetEntry,Module._exprCollation=e.exprCollation,Module._transformSortClause=e.transformSortClause,Module._transformDistinctClause=e.transformDistinctClause,Module._ParseFuncOrColumn=e.ParseFuncOrColumn,Module._select_common_type=e.select_common_type,Module._coerce_to_common_type=e.coerce_to_common_type,Module._select_common_collation=e.select_common_collation,Module._contain_vars_of_level=e.contain_vars_of_level,Module._expandNSItemAttrs=e.expandNSItemAttrs,Module._makeAlias=e.makeAlias,Module._addRangeTableEntryForSubquery=e.addRangeTableEntryForSubquery,Module._assign_list_collations=e.assign_list_collations,Module._expandNSItemVars=e.expandNSItemVars,Module._markTargetListOrigins=e.markTargetListOrigins,Module._addRangeTableEntryForJoin=e.addRangeTableEntryForJoin,Module._list_truncate=e.list_truncate,Module._makeVar=e.makeVar,Module._analyze_requires_snapshot=e.analyze_requires_snapshot,Module._makeNullConst=e.makeNullConst,Module._get_sort_group_operators=e.get_sort_group_operators,Module._refnameNamespaceItem=e.refnameNamespaceItem,Module._getRTEPermissionInfo=e.getRTEPermissionInfo,Module._setup_parser_errposition_callback=e.setup_parser_errposition_callback,Module._cancel_parser_errposition_callback=e.cancel_parser_errposition_callback,Module._locate_var_of_level=e.locate_var_of_level,Module._makeBoolean=e.makeBoolean,Module._makeInteger=e.makeInteger,Module._makeSimpleA_Expr=e.makeSimpleA_Expr,Module._makeTypeName=e.makeTypeName,Module._SystemTypeName=e.SystemTypeName,Module._makeFuncCall=e.makeFuncCall,Module._makeA_Expr=e.makeA_Expr,Module._list_make4_impl=e.list_make4_impl,Module._addTargetToSortList=e.addTargetToSortList,Module._locate_agg_of_level=e.locate_agg_of_level,Module._list_intersection_int=e.list_intersection_int,Module._get_sortgroupclause_tle=e.get_sortgroupclause_tle,Module._flatten_join_alias_vars=e.flatten_join_alias_vars,Module._list_member_int=e.list_member_int,Module._list_union_int=e.list_union_int,Module._makeFuncExpr=e.makeFuncExpr,Module._get_rte_attribute_name=e.get_rte_attribute_name,Module._expression_tree_mutator_impl=e.expression_tree_mutator_impl,Module._checkNameSpaceConflicts=e.checkNameSpaceConflicts,Module._addRangeTableEntryForENR=e.addRangeTableEntryForENR,Module._addRangeTableEntry=e.addRangeTableEntry,Module._FigureColname=e.FigureColname,Module._addRangeTableEntryForFunction=e.addRangeTableEntryForFunction,Module._coerce_to_specific_type=e.coerce_to_specific_type,Module._typenameTypeIdAndMod=e.typenameTypeIdAndMod,Module._get_typcollation=e.get_typcollation,Module._markNullableIfNeeded=e.markNullableIfNeeded,Module._markVarForSelectPriv=e.markVarForSelectPriv,Module._coerce_type=e.coerce_type,Module._LookupFuncName=e.LookupFuncName,Module._parserOpenTable=e.parserOpenTable,Module._strip_implicit_coercions=e.strip_implicit_coercions,Module._colNameToVar=e.colNameToVar,Module._op_hashjoinable=e.op_hashjoinable,Module._get_commutator=e.get_commutator,Module._get_ordering_op_properties=e.get_ordering_op_properties,Module._can_coerce_type=e.can_coerce_type,Module._get_sortgroupref_tle=e.get_sortgroupref_tle,Module._assignSortGroupRef=e.assignSortGroupRef,Module._targetIsInSortList=e.targetIsInSortList,Module._contain_aggs_of_level=e.contain_aggs_of_level,Module._find_coercion_pathway=e.find_coercion_pathway,Module._typeidType=e.typeidType,Module._typeTypeCollation=e.typeTypeCollation,Module._typeLen=e.typeLen,Module._typeByVal=e.typeByVal,Module._get_type_category_preferred=e.get_type_category_preferred,Module._makeConst=e.makeConst,Module._lookup_rowtype_tupdesc=e.lookup_rowtype_tupdesc,Module._type_is_enum=e.type_is_enum,Module._verify_common_type=e.verify_common_type,Module._type_is_range=e.type_is_range,Module._bms_del_member=e.bms_del_member,Module._list_member=e.list_member,Module._raw_expression_tree_walker_impl=e.raw_expression_tree_walker_impl,Module._type_is_rowtype=e.type_is_rowtype,Module._scanNSItemForColumn=e.scanNSItemForColumn,Module._make_op=e.make_op,Module._make_scalar_array_op=e.make_scalar_array_op,Module._count_nonjunk_tlist_entries=e.count_nonjunk_tlist_entries,Module._makeWholeRowVar=e.makeWholeRowVar,Module._expandRTE=e.expandRTE,Module._contain_var_clause=e.contain_var_clause,Module._jsonb_in=e.jsonb_in,Module._get_func_prokind=e.get_func_prokind,Module._escape_json=e.escape_json,Module._geterrcode=e.geterrcode,Module._bit_in=e.bit_in,Module._repalloc0=e.repalloc0,Module._bms_union=e.bms_union,Module._varstr_levenshtein_less_equal=e.varstr_levenshtein_less_equal,Module._get_atttypetypmodcoll=e.get_atttypetypmodcoll,Module._raw_parser=e.raw_parser,Module._errsave_start=e.errsave_start,Module._errsave_finish=e.errsave_finish,Module._makeColumnDef=e.makeColumnDef,Module._GetDefaultOpClass=e.GetDefaultOpClass,Module._transformIndexStmt=e.transformIndexStmt,Module._ChooseRelationName=e.ChooseRelationName,Module._deparse_context_for=e.deparse_context_for,Module._deparse_expression=e.deparse_expression,Module._expression_planner=e.expression_planner,Module._scanner_init=e.scanner_init,Module._scanner_finish=e.scanner_finish,Module._core_yylex=e.core_yylex,Module._isxdigit=e.isxdigit,Module._scanner_isspace=e.scanner_isspace,Module._truncate_identifier=e.truncate_identifier,Module._ScanKeywordLookup=e.ScanKeywordLookup,Module._pg_verifymbstr=e.pg_verifymbstr,Module._downcase_truncate_identifier=e.downcase_truncate_identifier,Module._pg_database_encoding_max_length=e.pg_database_encoding_max_length,Module._getTypeInputInfo=e.getTypeInputInfo,Module._RenameSchema=e.RenameSchema,Module._check_can_set_role=e.check_can_set_role,Module._namein=e.namein,Module._BlockSampler_Init=e.BlockSampler_Init,Module._reservoir_init_selection_state=e.reservoir_init_selection_state,Module._reservoir_get_next_S=e.reservoir_get_next_S,Module._sampler_random_fract=e.sampler_random_fract,Module._std_typanalyze=e.std_typanalyze,Module._BlockSampler_HasMore=e.BlockSampler_HasMore,Module._BlockSampler_Next=e.BlockSampler_Next,Module._Async_Notify=e.Async_Notify,Module._RangeVarCallbackMaintainsTable=e.RangeVarCallbackMaintainsTable,Module._make_new_heap=e.make_new_heap,Module._finish_heap_swap=e.finish_heap_swap,Module._RenameRelationInternal=e.RenameRelationInternal,Module._OpenPipeStream=e.OpenPipeStream,Module._pg_is_ascii=e.pg_is_ascii,Module._ClosePipeStream=e.ClosePipeStream,Module._PreventCommandIfReadOnly=e.PreventCommandIfReadOnly,Module._BeginCopyFrom=e.BeginCopyFrom,Module._EndCopyFrom=e.EndCopyFrom,Module._ProcessCopyOptions=e.ProcessCopyOptions,Module._pg_strtoint64=e.pg_strtoint64,Module._CopyFromErrorCallback=e.CopyFromErrorCallback,Module._bms_make_singleton=e.bms_make_singleton,Module._ExecInitRangeTable=e.ExecInitRangeTable,Module._ExecInitResultRelation=e.ExecInitResultRelation,Module._ExecInitQual=e.ExecInitQual,Module._contain_volatile_functions=e.contain_volatile_functions,Module._NextCopyFrom=e.NextCopyFrom,Module._ExecCloseResultRelations=e.ExecCloseResultRelations,Module._ExecCloseRangeTableRelations=e.ExecCloseRangeTableRelations,Module._ExecConstraints=e.ExecConstraints,Module._ExecInsertIndexTuples=e.ExecInsertIndexTuples,Module._build_column_default=e.build_column_default,Module._ExecInitExpr=e.ExecInitExpr,Module._fileno=e.fileno,Module._NextCopyFromRawFields=e.NextCopyFromRawFields,Module._resetStringInfo=e.resetStringInfo,Module._pq_copymsgbytes=e.pq_copymsgbytes,Module._pg_encoding_max_length=e.pg_encoding_max_length,Module._tolower=e.tolower,Module._pg_plan_query=e.pg_plan_query,Module._PushCopiedSnapshot=e.PushCopiedSnapshot,Module._UpdateActiveSnapshotCommandId=e.UpdateActiveSnapshotCommandId,Module._CreateQueryDesc=e.CreateQueryDesc,Module._ExecutorStart=e.ExecutorStart,Module._ExecutorFinish=e.ExecutorFinish,Module._ExecutorEnd=e.ExecutorEnd,Module._FreeQueryDesc=e.FreeQueryDesc,Module._ExecutorRun=e.ExecutorRun,Module._pg_server_to_any=e.pg_server_to_any,Module._fwrite=e.fwrite,Module._CreateTableAsRelExists=e.CreateTableAsRelExists,Module._QueryRewrite=e.QueryRewrite,Module._DefineRelation=e.DefineRelation,Module._rmdir=e.rmdir,Module._atof=e.atof,Module._int8in=e.int8in,Module._oidin=e.oidin,Module._RemoveObjects=e.RemoveObjects,Module._GetCommandTagEnum=e.GetCommandTagEnum,Module._CreateCommandTag=e.CreateCommandTag,Module._GetCommandTagName=e.GetCommandTagName,Module._NewExplainState=e.NewExplainState,Module._ExplainBeginOutput=e.ExplainBeginOutput,Module._ExplainEndOutput=e.ExplainEndOutput,Module._ExplainOpenGroup=e.ExplainOpenGroup,Module._ExplainPrintPlan=e.ExplainPrintPlan,Module._ExplainIndentText=e.ExplainIndentText,Module._ExplainPropertyInteger=e.ExplainPropertyInteger,Module._ExplainCloseGroup=e.ExplainCloseGroup,Module._ExplainPropertyFloat=e.ExplainPropertyFloat,Module._ExplainPrintTriggers=e.ExplainPrintTriggers,Module._ExplainPropertyUInteger=e.ExplainPropertyUInteger,Module._ExplainPropertyText=e.ExplainPropertyText,Module._GetConfigOptionByName=e.GetConfigOptionByName,Module._ExplainPrintJITSummary=e.ExplainPrintJITSummary,Module._ExplainPropertyBool=e.ExplainPropertyBool,Module._InstrEndLoop=e.InstrEndLoop,Module._appendStringInfoSpaces=e.appendStringInfoSpaces,Module._ExplainQueryText=e.ExplainQueryText,Module._ExplainQueryParameters=e.ExplainQueryParameters,Module._get_func_namespace=e.get_func_namespace,Module._escape_xml=e.escape_xml,Module._GetExplainExtensionId=e.GetExplainExtensionId,Module._GetExplainExtensionState=e.GetExplainExtensionState,Module._SetExplainExtensionState=e.SetExplainExtensionState,Module._RegisterExtensionExplainOption=e.RegisterExtensionExplainOption,Module._get_extension_schema=e.get_extension_schema,Module._get_function_sibling_type=e.get_function_sibling_type,Module._GetSysCacheHashValue=e.GetSysCacheHashValue,Module._CreateSchemaCommand=e.CreateSchemaCommand,Module._get_rel_type_id=e.get_rel_type_id,Module._set_config_option=e.set_config_option,Module._pg_any_to_server=e.pg_any_to_server,Module._DirectFunctionCall4Coll=e.DirectFunctionCall4Coll,Module._replace_text=e.replace_text,Module._strpbrk=e.strpbrk,Module._ProcessUtility=e.ProcessUtility,Module._CleanQuerytext=e.CleanQuerytext,Module._GetForeignDataWrapper=e.GetForeignDataWrapper,Module._CreateExprContext=e.CreateExprContext,Module._EnsurePortalSnapshotExists=e.EnsurePortalSnapshotExists,Module._CheckIndexCompatible=e.CheckIndexCompatible,Module._op_input_types=e.op_input_types,Module._ResolveOpClass=e.ResolveOpClass,Module._get_opclass_family=e.get_opclass_family,Module._get_opfamily_member_for_cmptype=e.get_opfamily_member_for_cmptype,Module._pgstat_count_truncate=e.pgstat_count_truncate,Module._SPI_connect=e.SPI_connect,Module._SPI_exec=e.SPI_exec,Module._SPI_execute=e.SPI_execute,Module._SPI_getvalue=e.SPI_getvalue,Module._generate_operator_clause=e.generate_operator_clause,Module._SPI_finish=e.SPI_finish,Module._CreateTransientRelDestReceiver=e.CreateTransientRelDestReceiver,Module._MemoryContextSetIdentifier=e.MemoryContextSetIdentifier,Module._checkExprHasSubLink=e.checkExprHasSubLink,Module._MemoryContextSetParent=e.MemoryContextSetParent,Module._copyParamList=e.copyParamList,Module._SetTuplestoreDestReceiverParams=e.SetTuplestoreDestReceiverParams,Module._tuplestore_rescan=e.tuplestore_rescan,Module._MemoryContextDeleteChildren=e.MemoryContextDeleteChildren,Module._GetCachedPlan=e.GetCachedPlan,Module._makeParamList=e.makeParamList,Module._ReleaseCachedPlan=e.ReleaseCachedPlan,Module._bms_equal=e.bms_equal,Module._func_volatile=e.func_volatile,Module._register_label_provider=e.register_label_provider,Module._DefineSequence=e.DefineSequence,Module._AlterSequence=e.AlterSequence,Module._RangeVarCallbackOwnsRelation=e.RangeVarCallbackOwnsRelation,Module._nextval=e.nextval,Module._textToQualifiedNameList=e.textToQualifiedNameList,Module._nextval_internal=e.nextval_internal,Module._setval_oid=e.setval_oid,Module._tuplestore_gettupleslot=e.tuplestore_gettupleslot,Module._list_delete=e.list_delete,Module._tuplestore_end=e.tuplestore_end,Module._list_append_unique=e.list_append_unique,Module._get_rel_relam=e.get_rel_relam,Module._contain_mutable_functions=e.contain_mutable_functions,Module._RemoveRelations=e.RemoveRelations,Module._ExecuteTruncateGuts=e.ExecuteTruncateGuts,Module._InitResultRelInfo=e.InitResultRelInfo,Module._AlterTableLookupRelation=e.AlterTableLookupRelation,Module._AlterTable=e.AlterTable,Module._AlterTableInternal=e.AlterTableInternal,Module._AlterTableGetLockLevel=e.AlterTableGetLockLevel,Module._pg_get_indexdef_string=e.pg_get_indexdef_string,Module._ExecStoreAllNullTuple=e.ExecStoreAllNullTuple,Module._chmod=e.chmod,Module._ChangeVarNodes=e.ChangeVarNodes,Module._tuplestore_begin_heap=e.tuplestore_begin_heap,Module._tuplestore_puttupleslot=e.tuplestore_puttupleslot,Module._ExecForceStoreHeapTuple=e.ExecForceStoreHeapTuple,Module._ExecUpdateLockMode=e.ExecUpdateLockMode,Module._bms_copy=e.bms_copy,Module._strtoint=e.strtoint,Module._strtod=e.strtod,Module._plain_crypt_verify=e.plain_crypt_verify,Module._ProcessConfigFile=e.ProcessConfigFile,Module._pgl_exit=e.pgl_exit,Module._dsa_get_handle=e.dsa_get_handle,Module._pg_strncasecmp=e.pg_strncasecmp,Module._guc_free=e.guc_free,Module._ExecReScan=e.ExecReScan,Module._ExecAsyncResponse=e.ExecAsyncResponse,Module._ExecAsyncRequestDone=e.ExecAsyncRequestDone,Module._ExecAsyncRequestPending=e.ExecAsyncRequestPending,Module._ExprEvalPushStep=e.ExprEvalPushStep,Module._lookup_rowtype_tupdesc_copy=e.lookup_rowtype_tupdesc_copy,Module._ExecInitExprWithParams=e.ExecInitExprWithParams,Module._ExecInitExprList=e.ExecInitExprList,Module._ExecGetResultType=e.ExecGetResultType,Module._ExecInitExtraTupleSlot=e.ExecInitExtraTupleSlot,Module._MakeExpandedObjectReadOnlyInternal=e.MakeExpandedObjectReadOnlyInternal,Module._tuplesort_puttupleslot=e.tuplesort_puttupleslot,Module._ArrayGetNItems=e.ArrayGetNItems,Module._expanded_record_fetch_tupdesc=e.expanded_record_fetch_tupdesc,Module._expanded_record_fetch_field=e.expanded_record_fetch_field,Module._json_validate=e.json_validate,Module._JsonbValueToJsonb=e.JsonbValueToJsonb,Module._numeric_out=e.numeric_out,Module._boolout=e.boolout,Module._bool_int4=e.bool_int4,Module._lookup_rowtype_tupdesc_domain=e.lookup_rowtype_tupdesc_domain,Module._MemoryContextGetParent=e.MemoryContextGetParent,Module._DeleteExpandedObject=e.DeleteExpandedObject,Module._CreateStandaloneExprContext=e.CreateStandaloneExprContext,Module._ExecFindJunkAttributeInTlist=e.ExecFindJunkAttributeInTlist,Module._standard_ExecutorStart=e.standard_ExecutorStart,Module._ExecInitNode=e.ExecInitNode,Module._standard_ExecutorRun=e.standard_ExecutorRun,Module._standard_ExecutorFinish=e.standard_ExecutorFinish,Module._standard_ExecutorEnd=e.standard_ExecutorEnd,Module._ExecEndNode=e.ExecEndNode,Module._InstrAlloc=e.InstrAlloc,Module._MakeTupleTableSlot=e.MakeTupleTableSlot,Module._ExecWithCheckOptions=e.ExecWithCheckOptions,Module._get_typlenbyval=e.get_typlenbyval,Module._ExecInitScanTupleSlot=e.ExecInitScanTupleSlot,Module._InputFunctionCall=e.InputFunctionCall,Module._list_delete_ptr=e.list_delete_ptr,Module._FreeExprContext=e.FreeExprContext,Module._ExecAssignExprContext=e.ExecAssignExprContext,Module._ExecAssignProjectionInfo=e.ExecAssignProjectionInfo,Module._ExecOpenScanRelation=e.ExecOpenScanRelation,Module._bms_intersect=e.bms_intersect,Module._GetAttributeByName=e.GetAttributeByName,Module._GetAttributeByNum=e.GetAttributeByNum,Module._ExecGetReturningSlot=e.ExecGetReturningSlot,Module._ExecGetResultRelCheckAsUser=e.ExecGetResultRelCheckAsUser,Module._MemoryContextRegisterResetCallback=e.MemoryContextRegisterResetCallback,Module._cached_function_compile=e.cached_function_compile,Module._CommandIsReadOnly=e.CommandIsReadOnly,Module._InstrUpdateTupleCount=e.InstrUpdateTupleCount,Module._tuplesort_begin_heap=e.tuplesort_begin_heap,Module._AggCheckCallContext=e.AggCheckCallContext,Module._tuplesort_gettupleslot=e.tuplesort_gettupleslot,Module._bms_del_members=e.bms_del_members,Module._AddWaitEventToSet=e.AddWaitEventToSet,Module._GetNumRegisteredWaitEvents=e.GetNumRegisteredWaitEvents,Module._tuplestore_clear=e.tuplestore_clear,Module._get_attstatsslot=e.get_attstatsslot,Module._free_attstatsslot=e.free_attstatsslot,Module._SharedFileSetInit=e.SharedFileSetInit,Module._SharedFileSetAttach=e.SharedFileSetAttach,Module._tuplesort_reset=e.tuplesort_reset,Module._pairingheap_first=e.pairingheap_first,Module._bms_nonempty_difference=e.bms_nonempty_difference,Module._datum_image_hash=e.datum_image_hash,Module._tuplesort_rescan=e.tuplesort_rescan,Module._WinGetPartitionLocalMemory=e.WinGetPartitionLocalMemory,Module._WinGetCurrentPosition=e.WinGetCurrentPosition,Module._WinGetPartitionRowCount=e.WinGetPartitionRowCount,Module._WinGetFuncArgInPartition=e.WinGetFuncArgInPartition,Module._WinGetFuncArgCurrent=e.WinGetFuncArgCurrent,Module._SPI_connect_ext=e.SPI_connect_ext,Module._SPI_commit=e.SPI_commit,Module._CopyErrorData=e.CopyErrorData,Module._FlushErrorState=e.FlushErrorState,Module._ReThrowError=e.ReThrowError,Module._SPI_commit_and_chain=e.SPI_commit_and_chain,Module._SPI_rollback=e.SPI_rollback,Module._SPI_rollback_and_chain=e.SPI_rollback_and_chain,Module._SPI_freetuptable=e.SPI_freetuptable,Module._SPI_execute_extended=e.SPI_execute_extended,Module._SPI_execute_plan=e.SPI_execute_plan,Module._SPI_execp=e.SPI_execp,Module._SPI_execute_plan_extended=e.SPI_execute_plan_extended,Module._SPI_execute_plan_with_paramlist=e.SPI_execute_plan_with_paramlist,Module._SPI_execute_with_args=e.SPI_execute_with_args,Module._SPI_prepare=e.SPI_prepare,Module._SPI_prepare_extended=e.SPI_prepare_extended,Module._SPI_keepplan=e.SPI_keepplan,Module._SPI_saveplan=e.SPI_saveplan,Module._SPI_freeplan=e.SPI_freeplan,Module._SPI_copytuple=e.SPI_copytuple,Module._SPI_returntuple=e.SPI_returntuple,Module._SPI_modifytuple=e.SPI_modifytuple,Module._SPI_fnumber=e.SPI_fnumber,Module._SPI_fname=e.SPI_fname,Module._SPI_getbinval=e.SPI_getbinval,Module._SPI_gettype=e.SPI_gettype,Module._SPI_gettypeid=e.SPI_gettypeid,Module._SPI_getrelname=e.SPI_getrelname,Module._SPI_palloc=e.SPI_palloc,Module._SPI_repalloc=e.SPI_repalloc,Module._SPI_pfree=e.SPI_pfree,Module._SPI_datumTransfer=e.SPI_datumTransfer,Module._datumTransfer=e.datumTransfer,Module._SPI_cursor_open_with_args=e.SPI_cursor_open_with_args,Module._SPI_cursor_open_with_paramlist=e.SPI_cursor_open_with_paramlist,Module._SPI_cursor_parse_open=e.SPI_cursor_parse_open,Module._SPI_cursor_find=e.SPI_cursor_find,Module._SPI_cursor_fetch=e.SPI_cursor_fetch,Module._SPI_scroll_cursor_fetch=e.SPI_scroll_cursor_fetch,Module._SPI_scroll_cursor_move=e.SPI_scroll_cursor_move,Module._SPI_cursor_close=e.SPI_cursor_close,Module._SPI_plan_is_valid=e.SPI_plan_is_valid,Module._SPI_result_code_string=e.SPI_result_code_string,Module._SPI_plan_get_plan_sources=e.SPI_plan_get_plan_sources,Module._SPI_plan_get_cached_plan=e.SPI_plan_get_cached_plan,Module._SPI_register_relation=e.SPI_register_relation,Module._create_queryEnv=e.create_queryEnv,Module._register_ENR=e.register_ENR,Module._SPI_register_trigger_data=e.SPI_register_trigger_data,Module._tuplestore_tuple_count=e.tuplestore_tuple_count,Module._GetUserMapping=e.GetUserMapping,Module._GetForeignTable=e.GetForeignTable,Module._GetForeignColumnOptions=e.GetForeignColumnOptions,Module._initClosestMatch=e.initClosestMatch,Module._updateClosestMatch=e.updateClosestMatch,Module._getClosestMatch=e.getClosestMatch,Module._GetExistingLocalJoinPath=e.GetExistingLocalJoinPath,Module._pathkeys_contained_in=e.pathkeys_contained_in,Module._bloom_create=e.bloom_create,Module._bloom_free=e.bloom_free,Module._bloom_add_element=e.bloom_add_element,Module._bloom_lacks_element=e.bloom_lacks_element,Module._bloom_prop_bits_set=e.bloom_prop_bits_set,Module._dshash_create=e.dshash_create,Module._dshash_attach=e.dshash_attach,Module._dshash_detach=e.dshash_detach,Module._dshash_destroy=e.dshash_destroy,Module._dshash_get_hash_table_handle=e.dshash_get_hash_table_handle,Module._dshash_find=e.dshash_find,Module._dshash_find_or_insert=e.dshash_find_or_insert,Module._dshash_delete_key=e.dshash_delete_key,Module._dshash_release_lock=e.dshash_release_lock,Module._tag_hash=e.tag_hash,Module._dshash_seq_init=e.dshash_seq_init,Module._dshash_seq_next=e.dshash_seq_next,Module._dshash_seq_term=e.dshash_seq_term,Module._dshash_delete_current=e.dshash_delete_current,Module._ldexp=e.ldexp,Module._pg_b64_enc_len=e.pg_b64_enc_len,Module._pg_b64_encode=e.pg_b64_encode,Module._strtol=e.strtol,Module._gai_strerror=e.gai_strerror,Module._bind=e.bind,Module._pgl_connect=e.pgl_connect,Module._pgl_send=e.pgl_send,Module._pgl_recv=e.pgl_recv,Module._sendto=e.sendto,Module._select=e.select,Module._recvfrom=e.recvfrom,Module._be_lo_unlink=e.be_lo_unlink,Module._text_to_cstring_buffer=e.text_to_cstring_buffer,Module._feof=e.feof,Module._pg_mb2wchar_with_len=e.pg_mb2wchar_with_len,Module._pg_regcomp=e.pg_regcomp,Module._pg_regerror=e.pg_regerror,Module._strcat=e.strcat,Module._freeaddrinfo=e.freeaddrinfo,Module._pgl_getsockname=e.pgl_getsockname,Module._pgl_setsockopt=e.pgl_setsockopt,Module._pgl_fcntl=e.pgl_fcntl,Module._listen=e.listen,Module._accept=e.accept,Module._utime=e.utime,Module._pq_buffer_remaining_data=e.pq_buffer_remaining_data,Module._pgl_getsockopt=e.pgl_getsockopt,Module._pq_sendtext=e.pq_sendtext,Module._pq_sendfloat4=e.pq_sendfloat4,Module._pq_sendfloat8=e.pq_sendfloat8,Module._pq_begintypsend=e.pq_begintypsend,Module._pq_endtypsend=e.pq_endtypsend,Module._pq_getmsgfloat4=e.pq_getmsgfloat4,Module._pq_getmsgfloat8=e.pq_getmsgfloat8,Module._pq_getmsgtext=e.pq_getmsgtext,Module._pg_strtoint32=e.pg_strtoint32,Module._main=e.__main_argc_argv,Module._pgl_getuid=e.pgl_getuid,Module._getenv=e.getenv,Module._bms_membership=e.bms_membership,Module._RegisterExtensibleNodeMethods=e.RegisterExtensibleNodeMethods,Module._list_make5_impl=e.list_make5_impl,Module._GetMemoryChunkContext=e.GetMemoryChunkContext,Module._list_insert_nth=e.list_insert_nth,Module._list_member_ptr=e.list_member_ptr,Module._list_delete_int=e.list_delete_int,Module._list_intersection=e.list_intersection,Module._list_append_unique_ptr=e.list_append_unique_ptr,Module._list_append_unique_int=e.list_append_unique_int,Module._list_concat_unique_int=e.list_concat_unique_int,Module._make_opclause=e.make_opclause,Module._exprIsLengthCoercion=e.exprIsLengthCoercion,Module._fix_opfuncids=e.fix_opfuncids,Module._outToken=e.outToken,Module._outNode=e.outNode,Module._appendStringInfoStringQuoted=e.appendStringInfoStringQuoted,Module._EnableQueryId=e.EnableQueryId,Module._nodeRead=e.nodeRead,Module._pg_strtok=e.pg_strtok,Module._debackslash=e.debackslash,Module._exp2=e.exp2,Module._find_base_rel=e.find_base_rel,Module._add_path=e.add_path,Module._create_sort_path=e.create_sort_path,Module._set_baserel_size_estimates=e.set_baserel_size_estimates,Module._get_func_support=e.get_func_support,Module._clauselist_selectivity=e.clauselist_selectivity,Module._get_tablespace_page_costs=e.get_tablespace_page_costs,Module._cost_qual_eval=e.cost_qual_eval,Module._pull_varnos=e.pull_varnos,Module._estimate_num_groups=e.estimate_num_groups,Module._cost_sort=e.cost_sort,Module._get_sortgrouplist_exprs=e.get_sortgrouplist_exprs,Module._get_attavgwidth=e.get_attavgwidth,Module._make_restrictinfo=e.make_restrictinfo,Module._setup_eclass_member_iterator=e.setup_eclass_member_iterator,Module._eclass_member_iterator_next=e.eclass_member_iterator_next,Module._remove_nulling_relids=e.remove_nulling_relids,Module._get_mergejoin_opfamilies=e.get_mergejoin_opfamilies,Module._generate_implied_equalities_for_column=e.generate_implied_equalities_for_column,Module._eclass_useful_for_merging=e.eclass_useful_for_merging,Module._join_clause_is_movable_to=e.join_clause_is_movable_to,Module._get_plan_rowmark=e.get_plan_rowmark,Module._is_pseudo_constant_for_index=e.is_pseudo_constant_for_index,Module._update_mergeclause_eclasses=e.update_mergeclause_eclasses,Module._pull_vars_of_level=e.pull_vars_of_level,Module._find_join_rel=e.find_join_rel,Module._make_canonical_pathkey=e.make_canonical_pathkey,Module._get_sortgroupref_clause_noerr=e.get_sortgroupref_clause_noerr,Module._extract_actual_clauses=e.extract_actual_clauses,Module._tlist_member=e.tlist_member,Module._change_plan_targetlist=e.change_plan_targetlist,Module._make_foreignscan=e.make_foreignscan,Module._IncrementVarSublevelsUp=e.IncrementVarSublevelsUp,Module._op_mergejoinable=e.op_mergejoinable,Module._find_nonnullable_rels=e.find_nonnullable_rels,Module._setup_simple_rel_arrays=e.setup_simple_rel_arrays,Module._standard_planner=e.standard_planner,Module._get_relids_in_jointree=e.get_relids_in_jointree,Module._SS_process_sublinks=e.SS_process_sublinks,Module._add_new_columns_to_pathtarget=e.add_new_columns_to_pathtarget,Module._get_agg_clause_costs=e.get_agg_clause_costs,Module._grouping_is_sortable=e.grouping_is_sortable,Module._copy_pathtarget=e.copy_pathtarget,Module._create_projection_path=e.create_projection_path,Module._contain_nonstrict_functions=e.contain_nonstrict_functions,Module._get_translated_update_targetlist=e.get_translated_update_targetlist,Module._add_row_identity_var=e.add_row_identity_var,Module._get_rel_all_updated_cols=e.get_rel_all_updated_cols,Module._get_baserel_parampathinfo=e.get_baserel_parampathinfo,Module._create_foreignscan_path=e.create_foreignscan_path,Module._create_foreign_join_path=e.create_foreign_join_path,Module._create_foreign_upper_path=e.create_foreign_upper_path,Module._adjust_limit_rows_costs=e.adjust_limit_rows_costs,Module._add_to_flat_tlist=e.add_to_flat_tlist,Module._get_fn_expr_variadic=e.get_fn_expr_variadic,Module._get_fn_expr_argtype=e.get_fn_expr_argtype,Module._on_shmem_exit=e.on_shmem_exit,Module._pgl_shmdt=e.pgl_shmdt,Module._pgl_shmctl=e.pgl_shmctl,Module._pgl_shmat=e.pgl_shmat,Module._mmap=e.mmap,Module._pgl_shmget=e.pgl_shmget,Module._pgl_munmap=e.pgl_munmap,Module._SignalHandlerForConfigReload=e.SignalHandlerForConfigReload,Module._SignalHandlerForShutdownRequest=e.SignalHandlerForShutdownRequest,Module._procsignal_sigusr1_handler=e.procsignal_sigusr1_handler,Module._ConditionalLockDatabaseObject=e.ConditionalLockDatabaseObject,Module._RegisterBackgroundWorker=e.RegisterBackgroundWorker,Module._WaitForBackgroundWorkerStartup=e.WaitForBackgroundWorkerStartup,Module._open=e.open,Module._rename=e.rename,Module._GetConfigOption=e.GetConfigOption,Module._puts=e.puts,Module._fopen=e.fopen,Module._fclose=e.fclose,Module._fputc=e.fputc,Module._ftello=e.ftello,_malloc=Module._malloc=e.malloc,Module._free=e.free,Module._realloc=e.realloc,Module._iswprint_l=e.iswprint_l,Module._iswalpha_l=e.iswalpha_l,Module._iswdigit_l=e.iswdigit_l,Module._isdigit_l=e.isdigit_l,Module._iswpunct_l=e.iswpunct_l,Module._iswspace_l=e.iswspace_l,Module._iswlower_l=e.iswlower_l,Module._iswupper_l=e.iswupper_l,Module._pg_ascii_tolower=e.pg_ascii_tolower,Module._towlower_l=e.towlower_l,Module._tolower_l=e.tolower_l,Module._towupper_l=e.towupper_l,Module._toupper_l=e.toupper_l,Module._pg_reg_getinitialstate=e.pg_reg_getinitialstate,Module._pg_reg_getfinalstate=e.pg_reg_getfinalstate,Module._pg_reg_getnumoutarcs=e.pg_reg_getnumoutarcs,Module._pg_reg_getoutarcs=e.pg_reg_getoutarcs,Module._pg_reg_getnumcolors=e.pg_reg_getnumcolors,Module._pg_reg_colorisbegin=e.pg_reg_colorisbegin,Module._pg_reg_colorisend=e.pg_reg_colorisend,Module._pg_reg_getnumcharacters=e.pg_reg_getnumcharacters,Module._pg_reg_getcharacters=e.pg_reg_getcharacters,Module._dsa_pin=e.dsa_pin,Module._OutputPluginPrepareWrite=e.OutputPluginPrepareWrite,Module._OutputPluginWrite=e.OutputPluginWrite,Module._array_contains_nulls=e.array_contains_nulls,Module._CacheRegisterRelcacheCallback=e.CacheRegisterRelcacheCallback,Module._hash_seq_term=e.hash_seq_term,Module._FreeErrorData=e.FreeErrorData,Module._RelidByRelfilenumber=e.RelidByRelfilenumber,Module._SnapBuildRestoreSnapshot=e.SnapBuildRestoreSnapshot,Module._WaitLatchOrSocket=e.WaitLatchOrSocket,Module._BufFileCreateFileSet=e.BufFileCreateFileSet,Module._BufFileOpenFileSet=e.BufFileOpenFileSet,Module._BufFileTell=e.BufFileTell,Module._ConditionVariablePrepareToSleep=e.ConditionVariablePrepareToSleep,Module._get_row_security_policies=e.get_row_security_policies,Module._extract_variadic_args=e.extract_variadic_args,Module._errhidestmt=e.errhidestmt,Module._errhidecontext=e.errhidecontext,Module._hash_estimate_size=e.hash_estimate_size,Module._ShmemInitHash=e.ShmemInitHash,Module._LockBufHdr=e.LockBufHdr,Module._LWLockHeldByMeInMode=e.LWLockHeldByMeInMode,Module._EvictUnpinnedBuffer=e.EvictUnpinnedBuffer,Module._EvictAllUnpinnedBuffers=e.EvictAllUnpinnedBuffers,Module._EvictRelUnpinnedBuffers=e.EvictRelUnpinnedBuffers,Module._have_free_buffer=e.have_free_buffer,_calloc=Module._calloc=e.calloc,Module._BufFileExportFileSet=e.BufFileExportFileSet,Module._BufFileRead=e.BufFileRead,Module._copy_file=e.copy_file,Module._fdatasync=e.fdatasync,Module._truncate=e.truncate,Module._dup=e.dup,Module._AcquireExternalFD=e.AcquireExternalFD,Module._mkdir=e.mkdir,Module._pgl_popen=e.pgl_popen,Module._pgl_pclose=e.pgl_pclose,Module._closedir=e.closedir,Module._opendir=e.opendir,Module._readdir=e.readdir,Module._GetNamedDSMSegment=e.GetNamedDSMSegment,Module._pgl_atexit=e.pgl_atexit,Module._RequestAddinShmemSpace=e.RequestAddinShmemSpace,Module._GetRunningTransactionData=e.GetRunningTransactionData,Module._BackendXidGetPid=e.BackendXidGetPid,Module._pg_numa_init=e.pg_numa_init,Module._sysconf=e.sysconf,Module._pg_numa_query_pages=e.pg_numa_query_pages,Module._pg_get_shmem_pagesize=e.pg_get_shmem_pagesize,Module._LockAcquire=e.LockAcquire,Module._LockRelease=e.LockRelease,Module._pgl_poll=e.pgl_poll,Module._GetLockmodeName=e.GetLockmodeName,Module._LWLockRegisterTranche=e.LWLockRegisterTranche,Module._GetNamedLWLockTranche=e.GetNamedLWLockTranche,Module._LWLockNewTrancheId=e.LWLockNewTrancheId,Module._RequestNamedLWLockTranche=e.RequestNamedLWLockTranche,Module._LWLockHeldByMe=e.LWLockHeldByMe,Module._ProcessStartupPacket=e.ProcessStartupPacket,_htons=e.htons,_htonl=e.htonl,Module._pgl_startPGlite=e.pgl_startPGlite,Module._pgl_pq_flush=e.pgl_pq_flush,Module._pgl_getMyProcPort=e.pgl_getMyProcPort,Module._pgl_sendConnData=e.pgl_sendConnData,Module._PostgresMainLongJmp=e.PostgresMainLongJmp,Module._PostgresMainLoopOnce=e.PostgresMainLoopOnce,Module._PostgresSendReadyForQueryIfNecessary=e.PostgresSendReadyForQueryIfNecessary,Module._GetCommandLogLevel=e.GetCommandLogLevel,Module._standard_ProcessUtility=e.standard_ProcessUtility,Module._lookup_ts_dictionary_cache=e.lookup_ts_dictionary_cache,Module._get_tsearch_config_filename=e.get_tsearch_config_filename,Module._str_tolower=e.str_tolower,Module._readstoplist=e.readstoplist,Module._searchstoplist=e.searchstoplist,Module._tsearch_readline_begin=e.tsearch_readline_begin,Module._tsearch_readline=e.tsearch_readline,Module._tsearch_readline_end=e.tsearch_readline_end,Module._stringToQualifiedNameList=e.stringToQualifiedNameList,Module._getTSCurrentConfig=e.getTSCurrentConfig,Module._to_tsvector_byid=e.to_tsvector_byid,Module._t_isalnum_with_len=e.t_isalnum_with_len,Module._isalnum=e.isalnum,Module._t_isalnum_cstr=e.t_isalnum_cstr,Module._pg_mblen_unbounded=e.pg_mblen_unbounded,Module._get_restriction_variable=e.get_restriction_variable,Module._pg_mblen_range=e.pg_mblen_range,Module._MemoryContextAllocHuge=e.MemoryContextAllocHuge,Module._fseek=e.fseek,Module._WaitEventExtensionNew=e.WaitEventExtensionNew,Module._regprocedurein=e.regprocedurein,Module._is_member_of_role=e.is_member_of_role,Module._expand_array=e.expand_array,Module._exp=e.exp,Module._arraycontsel=e.arraycontsel,Module._arraycontjoinsel=e.arraycontjoinsel,Module._initArrayResult=e.initArrayResult,Module._array_create_iterator=e.array_create_iterator,Module._array_iterate=e.array_iterate,Module._array_free_iterator=e.array_free_iterator,Module._ArrayGetIntegerTypmods=e.ArrayGetIntegerTypmods,Module._boolin=e.boolin,Module.___multi3=e.__multi3,Module._cash_cmp=e.cash_cmp,Module._int64_to_numeric=e.int64_to_numeric,Module._numeric_div=e.numeric_div,Module._numeric_round=e.numeric_round,Module._numeric_int8=e.numeric_int8,Module._numeric_mul=e.numeric_mul,Module._j2date=e.j2date,Module._EncodeDateOnly=e.EncodeDateOnly,Module._EncodeSpecialDate=e.EncodeSpecialDate,Module._date_eq=e.date_eq,Module._date_lt=e.date_lt,Module._date_le=e.date_le,Module._date_gt=e.date_gt,Module._date_ge=e.date_ge,Module._date_cmp=e.date_cmp,Module._date_mi=e.date_mi,Module._timestamp2tm=e.timestamp2tm,Module._time2tm=e.time2tm,Module._EncodeTimeOnly=e.EncodeTimeOnly,Module._time_eq=e.time_eq,Module._time_lt=e.time_lt,Module._time_le=e.time_le,Module._time_gt=e.time_gt,Module._time_ge=e.time_ge,Module._time_cmp=e.time_cmp,Module._time_mi_time=e.time_mi_time,Module._timetz2tm=e.timetz2tm,Module._timetz_cmp=e.timetz_cmp,Module._pg_tolower=e.pg_tolower,Module._EncodeDateTime=e.EncodeDateTime,Module._TransferExpandedObject=e.TransferExpandedObject,Module._forkname_to_number=e.forkname_to_number,Module._numeric_lt=e.numeric_lt,Module._numeric_abs=e.numeric_abs,Module._numeric_add=e.numeric_add,Module._numeric_ge=e.numeric_ge,Module._err_generic_string=e.err_generic_string,Module._domain_check=e.domain_check,Module._enum_lt=e.enum_lt,Module._enum_le=e.enum_le,Module._enum_ge=e.enum_ge,Module._enum_gt=e.enum_gt,Module._enum_cmp=e.enum_cmp,Module._make_expanded_record_from_typeid=e.make_expanded_record_from_typeid,Module._make_expanded_record_from_tupdesc=e.make_expanded_record_from_tupdesc,Module._make_expanded_record_from_exprecord=e.make_expanded_record_from_exprecord,Module._expanded_record_set_tuple=e.expanded_record_set_tuple,Module._expanded_record_get_tuple=e.expanded_record_get_tuple,Module._deconstruct_expanded_record=e.deconstruct_expanded_record,Module._expanded_record_lookup_field=e.expanded_record_lookup_field,Module._expanded_record_set_field_internal=e.expanded_record_set_field_internal,Module._expanded_record_set_fields=e.expanded_record_set_fields,Module._float4in_internal=e.float4in_internal,Module._strtof=e.strtof,Module._float_to_shortest_decimal_buf=e.float_to_shortest_decimal_buf,Module._float8in=e.float8in,Module._float8in_internal=e.float8in_internal,Module._float8out=e.float8out,Module._float8out_internal=e.float8out_internal,Module._float8pl=e.float8pl,Module._float4_cmp_internal=e.float4_cmp_internal,Module._btfloat4cmp=e.btfloat4cmp,Module._btfloat8cmp=e.btfloat8cmp,Module._dtoi4=e.dtoi4,Module._dtoi2=e.dtoi2,Module._cbrt=e.cbrt,Module._dexp=e.dexp,Module._log10=e.log10,Module._dacos=e.dacos,Module._acos=e.acos,Module._dasin=e.dasin,Module._asin=e.asin,Module._datan=e.datan,Module._atan=e.atan,Module._datan2=e.datan2,Module._atan2=e.atan2,Module._dcos=e.dcos,Module._cos=e.cos,Module._dcot=e.dcot,Module._tan=e.tan,Module._dsin=e.dsin,Module._sin=e.sin,Module._dtan=e.dtan,Module._fmod=e.fmod,Module._degrees=e.degrees,Module._dpi=e.dpi,Module._radians=e.radians,Module._sinh=e.sinh,Module._cosh=e.cosh,Module._tanh=e.tanh,Module._asinh=e.asinh,Module._acosh=e.acosh,Module._atanh=e.atanh,Module._float8_accum=e.float8_accum,Module._float8_stddev_pop=e.float8_stddev_pop,Module._float8_stddev_samp=e.float8_stddev_samp,Module._asc_tolower=e.asc_tolower,Module._pg_strfold=e.pg_strfold,Module._numeric_power=e.numeric_power,Module._dtoi8=e.dtoi8,Module._int8out=e.int8out,Module._fseeko=e.fseeko,Module._int4in=e.int4in,Module._int4_bool=e.int4_bool,Module._int8pl=e.int8pl,Module._int84=e.int84,Module._int82=e.int82,Module._json_in=e.json_in,Module._EncodeSpecialTimestamp=e.EncodeSpecialTimestamp,Module._pushJsonbValue=e.pushJsonbValue,Module._numeric_int2=e.numeric_int2,Module._numeric_int4=e.numeric_int4,Module._numeric_float4=e.numeric_float4,Module._numeric_normalize=e.numeric_normalize,Module._numeric_cmp=e.numeric_cmp,Module._numeric_eq=e.numeric_eq,Module._hash_numeric=e.hash_numeric,Module._hash_numeric_extended=e.hash_numeric_extended,Module._int2_numeric=e.int2_numeric,Module._int4_numeric=e.int4_numeric,Module._int8_numeric=e.int8_numeric,Module._float4_numeric=e.float4_numeric,Module._float8_numeric=e.float8_numeric,Module._numeric_uminus=e.numeric_uminus,Module._numeric_is_nan=e.numeric_is_nan,Module._numeric_ceil=e.numeric_ceil,Module._numeric_floor=e.numeric_floor,Module._timestamp_cmp=e.timestamp_cmp,Module._macaddr_cmp=e.macaddr_cmp,Module._macaddr_lt=e.macaddr_lt,Module._macaddr_le=e.macaddr_le,Module._macaddr_eq=e.macaddr_eq,Module._macaddr_ge=e.macaddr_ge,Module._macaddr_gt=e.macaddr_gt,Module._macaddr8_cmp=e.macaddr8_cmp,Module._macaddr8_lt=e.macaddr8_lt,Module._macaddr8_le=e.macaddr8_le,Module._macaddr8_eq=e.macaddr8_eq,Module._macaddr8_ge=e.macaddr8_ge,Module._macaddr8_gt=e.macaddr8_gt,Module._current_query=e.current_query,Module._generate_collation_name=e.generate_collation_name,Module._get_fn_expr_arg_stable=e.get_fn_expr_arg_stable,Module._unpack_sql_state=e.unpack_sql_state,Module._get_fn_expr_rettype=e.get_fn_expr_rettype,Module._btnamecmp=e.btnamecmp,Module._inet_in=e.inet_in,Module._network_cmp=e.network_cmp,Module._convert_network_to_scalar=e.convert_network_to_scalar,Module._numeric_sign=e.numeric_sign,Module._numeric_gt=e.numeric_gt,Module._numeric_le=e.numeric_le,Module._numeric_mod=e.numeric_mod,Module._numeric_sqrt=e.numeric_sqrt,Module.___divti3=e.__divti3,Module._numeric_exp=e.numeric_exp,Module._numeric_ln=e.numeric_ln,Module._numeric_log=e.numeric_log,Module._numeric_float8_no_overflow=e.numeric_float8_no_overflow,Module._oidout=e.oidout,Module._btrim1=e.btrim1,Module._ltrim1=e.ltrim1,Module._rtrim1=e.rtrim1,Module._tuplesort_skiptuples=e.tuplesort_skiptuples,Module._interval_mi=e.interval_mi,Module._setlocale=e.setlocale,Module._newlocale=e.newlocale,Module._strftime_l=e.strftime_l,Module._freelocale=e.freelocale,Module._pg_utf_mblen_private=e.pg_utf_mblen_private,Module._uselocale=e.uselocale,Module._strcoll_l=e.strcoll_l,Module._strxfrm_l=e.strxfrm_l,Module._drandom=e.drandom,Module._quote_ident=e.quote_ident,Module._textregexeq=e.textregexeq,Module._text_substr=e.text_substr,Module._pg_wchar2mb_with_len=e.pg_wchar2mb_with_len,Module._regexp_split_to_array=e.regexp_split_to_array,Module._regclassin=e.regclassin,Module._regtypeout=e.regtypeout,Module._regconfigout=e.regconfigout,Module._pg_get_indexdef_columns_extended=e.pg_get_indexdef_columns_extended,Module._pg_get_querydef=e.pg_get_querydef,Module._strcspn=e.strcspn,Module._generic_restriction_selectivity=e.generic_restriction_selectivity,Module._genericcostestimate=e.genericcostestimate,Module._tidin=e.tidin,Module._tidout=e.tidout,Module._timestamp_in=e.timestamp_in,Module._timestamp_eq=e.timestamp_eq,Module._timestamp_lt=e.timestamp_lt,Module._timestamp_gt=e.timestamp_gt,Module._timestamp_le=e.timestamp_le,Module._timestamp_ge=e.timestamp_ge,Module._interval_eq=e.interval_eq,Module._interval_lt=e.interval_lt,Module._interval_gt=e.interval_gt,Module._interval_le=e.interval_le,Module._interval_ge=e.interval_ge,Module._interval_cmp=e.interval_cmp,Module._timestamp_mi=e.timestamp_mi,Module._interval_um=e.interval_um,Module._tsquery_requires_match=e.tsquery_requires_match,Module._TS_execute_ternary=e.TS_execute_ternary,Module._has_fn_opclass_options=e.has_fn_opclass_options,Module._uuid_in=e.uuid_in,Module._uuid_out=e.uuid_out,Module._uuid_cmp=e.uuid_cmp,Module._gen_random_uuid=e.gen_random_uuid,Module._varbit_in=e.varbit_in,Module._biteq=e.biteq,Module._bitlt=e.bitlt,Module._bitle=e.bitle,Module._bitgt=e.bitgt,Module._bitge=e.bitge,Module._bitcmp=e.bitcmp,Module._bitlength=e.bitlength,Module._bpchareq=e.bpchareq,Module._bpcharlt=e.bpcharlt,Module._bpcharle=e.bpcharle,Module._bpchargt=e.bpchargt,Module._bpcharge=e.bpcharge,Module._bpcharcmp=e.bpcharcmp,Module._pg_detoast_datum_slice=e.pg_detoast_datum_slice,Module._text_substr_no_len=e.text_substr_no_len,Module._texteq=e.texteq,Module._text_lt=e.text_lt,Module._text_le=e.text_le,Module._text_gt=e.text_gt,Module._text_ge=e.text_ge,Module._bttextcmp=e.bttextcmp,Module._byteaeq=e.byteaeq,Module._bytealt=e.bytealt,Module._byteale=e.byteale,Module._byteagt=e.byteagt,Module._byteage=e.byteage,Module._byteacmp=e.byteacmp,Module._to_hex32=e.to_hex32,Module._text_left=e.text_left,Module._text_right=e.text_right,Module._text_reverse=e.text_reverse,Module._varstr_levenshtein=e.varstr_levenshtein,Module._wcslen=e.wcslen,Module._pg_xml_init=e.pg_xml_init,Module._xml_ereport=e.xml_ereport,Module._pg_xml_done=e.pg_xml_done,Module._pg_do_encoding_conversion=e.pg_do_encoding_conversion,Module._CreateCacheMemoryContext=e.CreateCacheMemoryContext,Module._cfunc_resolve_polymorphic_argtypes=e.cfunc_resolve_polymorphic_argtypes,Module._get_typsubscript=e.get_typsubscript,Module._CachedPlanAllowsSimpleValidityCheck=e.CachedPlanAllowsSimpleValidityCheck,Module._CachedPlanIsSimplyValid=e.CachedPlanIsSimplyValid,Module._GetCachedExpression=e.GetCachedExpression,Module._FreeCachedExpression=e.FreeCachedExpression,Module._ReleaseAllPlanCacheRefsInOwner=e.ReleaseAllPlanCacheRefsInOwner,Module._SearchSysCache=e.SearchSysCache,Module._lookup_rowtype_tupdesc_noerror=e.lookup_rowtype_tupdesc_noerror,Module._abort=e.abort,Module._in_error_recursion_trouble=e.in_error_recursion_trouble,Module._pg_vfprintf=e.pg_vfprintf,Module._pgl_longjmp=e.pgl_longjmp,Module._openlog=e.openlog,Module._syslog=e.syslog,Module._GetErrorContextStack=e.GetErrorContextStack,Module._closelog=e.closelog,Module._dlsym=e.dlsym,Module._dlopen=e.dlopen,Module._dlerror=e.dlerror,Module._dlclose=e.dlclose,Module._find_rendezvous_variable=e.find_rendezvous_variable,Module._CallerFInfoFunctionCall1=e.CallerFInfoFunctionCall1,Module._CallerFInfoFunctionCall2=e.CallerFInfoFunctionCall2,Module._FunctionCall0Coll=e.FunctionCall0Coll,Module._RelationNameGetTupleDesc=e.RelationNameGetTupleDesc,Module._memcpy=e.memcpy,Module._hash_freeze=e.hash_freeze,Module._chdir=e.chdir,Module._pg_bindtextdomain=e.pg_bindtextdomain,Module._pg_mblen=e.pg_mblen,Module._check_encoding_conversion_args=e.check_encoding_conversion_args,Module._DefineCustomBoolVariable=e.DefineCustomBoolVariable,Module._DefineCustomIntVariable=e.DefineCustomIntVariable,Module._DefineCustomRealVariable=e.DefineCustomRealVariable,Module._DefineCustomStringVariable=e.DefineCustomStringVariable,Module._DefineCustomEnumVariable=e.DefineCustomEnumVariable,Module._MarkGUCPrefixReserved=e.MarkGUCPrefixReserved,Module._sampler_random_init_state=e.sampler_random_init_state,Module._dsa_trim=e.dsa_trim,Module._pchomp=e.pchomp,Module._PinPortal=e.PinPortal,Module._UnpinPortal=e.UnpinPortal,Module.___lshrti3=e.__lshrti3,Module._realpath=e.realpath,Module._float_to_shortest_decimal_bufn=e.float_to_shortest_decimal_bufn,Module._IsValidJsonNumber=e.IsValidJsonNumber,Module._pg_prng_uint64=e.pg_prng_uint64,Module._makeStringInfoExt=e.makeStringInfoExt,Module._initStringInfoExt=e.initStringInfoExt,Module._pgl_getpwuid=e.pgl_getpwuid,Module._getcwd=e.getcwd,Module._pthread_mutex_lock=e.pthread_mutex_lock,Module._localeconv=e.localeconv,Module._pthread_mutex_unlock=e.pthread_mutex_unlock,Module._nanosleep=e.nanosleep,Module._sigaction=e.sigaction,Module._strchrnul=e.strchrnul,Module._snprintf=e.snprintf,Module._strerror_r=e.strerror_r,Module._clear_setitimer=e.clear_setitimer,Module._pgl_setPGliteActive=e.pgl_setPGliteActive,Module._pgl_siglongjmp=e.pgl_siglongjmp,Module._pgl_set_system_fn=e.pgl_set_system_fn,Module._pgl_set_popen_fn=e.pgl_set_popen_fn,Module._pgl_set_pclose_fn=e.pgl_set_pclose_fn,Module._pgl_run_atexit_funcs=e.pgl_run_atexit_funcs,Module._pgl_freopen=e.pgl_freopen,Module._fiprintf=e.fiprintf,Module._pgl_set_rw_cbs=e.pgl_set_rw_cbs,Module._vfprintf=e.vfprintf,Module._pthread_key_create=e.pthread_key_create,Module._pthread_getspecific=e.pthread_getspecific,Module._pthread_key_delete=e.pthread_key_delete,Module._pthread_setspecific=e.pthread_setspecific,Module._toupper=e.toupper,Module._iconv_open=e.iconv_open,Module._iconv_close=e.iconv_close,Module._iconv=e.iconv,Module._pthread_mutex_init=e.pthread_mutex_init,Module._pthread_mutex_destroy=e.pthread_mutex_destroy,Module._pthread_cond_init=e.pthread_cond_init,Module._pthread_cond_destroy=e.pthread_cond_destroy,Module._pthread_self=e.pthread_self,Module._pthread_cond_wait=e.pthread_cond_wait,Module._pthread_cond_signal=e.pthread_cond_signal,Module._pthread_once=e.pthread_once,Module.___cxa_atexit=e.__cxa_atexit,Module._fputs=e.fputs,Module._vsnprintf=e.vsnprintf,Module.___small_fprintf=e.__small_fprintf,Module._zcalloc=e.zcalloc,Module._zcfree=e.zcfree,Module.___dynamic_cast=e.__dynamic_cast,Module.___cxa_pure_virtual=e.__cxa_pure_virtual,Module._modf=e.modf,Module._localtime_r=e.localtime_r,Module._strncat=e.strncat,Module._munmap=e.munmap,Module.___ctype_get_mb_cur_max=e.__ctype_get_mb_cur_max,Module.___ctype_tolower_loc=e.__ctype_tolower_loc,Module.___ctype_toupper_loc=e.__ctype_toupper_loc,Module._fdopen=e.fdopen,Module._sqrt=e.sqrt,Module._acosl=e.acosl,Module._aligned_alloc=e.aligned_alloc,Module._atan2l=e.atan2l,___funcs_on_exit=e.__funcs_on_exit,Module._atexit=e.atexit,Module.___cxa_finalize=e.__cxa_finalize,Module._btowc=e.btowc,Module._clock=e.clock,Module._scalbn=e.scalbn,Module._cosl=e.cosl,Module._dladdr=e.dladdr,___dl_seterr=e.__dl_seterr,Module._duplocale=e.duplocale,__emscripten_find_dylib=e._emscripten_find_dylib,Module._memmove=e.memmove,Module._memset=e.memset,Module._fchmod=e.fchmod,Module._fchmodat=e.fchmodat,Module._fchown=e.fchown,Module._fcntl=e.fcntl,Module._fdopendir=e.fdopendir,Module._fmax=e.fmax,Module._fmin=e.fmin,Module._fputwc=e.fputwc,Module._frexp=e.frexp,Module._ftell=e.ftell,Module._getentropy=e.getentropy,Module._geteuid=e.geteuid,Module._getgid=e.getgid,Module._mbtowc=e.mbtowc,Module._getuid=e.getuid,Module._getwc=e.getwc,Module._gmtime=e.gmtime,Module._hypot=e.hypot,Module._mbrtowc=e.mbrtowc,Module._ioctl=e.ioctl,Module._isalpha=e.isalpha,Module._isgraph=e.isgraph,Module._isspace=e.isspace,Module._iswblank_l=e.iswblank_l,Module._iswcntrl_l=e.iswcntrl_l,Module._iswxdigit_l=e.iswxdigit_l,Module._isxdigit_l=e.isxdigit_l,Module._pthread_cond_broadcast=e.pthread_cond_broadcast,Module._pthread_atfork=e.pthread_atfork,Module._pthread_mutex_trylock=e.pthread_mutex_trylock,Module._pthread_create=e.pthread_create,Module._pthread_join=e.pthread_join,Module._pthread_cond_timedwait=e.pthread_cond_timedwait,Module._pthread_detach=e.pthread_detach,Module._link=e.link,Module._llround=e.llround,Module._localtime=e.localtime,Module._log2=e.log2,Module._logb=e.logb,Module._lround=e.lround,Module._mbrlen=e.mbrlen,Module._mbsnrtowcs=e.mbsnrtowcs,Module._mbsrtowcs=e.mbsrtowcs,Module._memmem=e.memmem,Module._memrchr=e.memrchr,_emscripten_builtin_memalign=e.emscripten_builtin_memalign,Module._socket=e.socket,Module._nextafter=e.nextafter,Module._nextafterf=e.nextafterf,_ntohs=e.ntohs,Module._openat=e.openat,Module._pathconf=e.pathconf,Module._perror=e.perror,Module._iprintf=e.iprintf,Module.___small_printf=e.__small_printf,Module._pthread_mutexattr_getprotocol=e.pthread_mutexattr_getprotocol,Module._pthread_mutexattr_getpshared=e.pthread_mutexattr_getpshared,Module._pthread_mutexattr_getrobust=e.pthread_mutexattr_getrobust,Module._pthread_mutexattr_gettype=e.pthread_mutexattr_gettype,Module._pthread_mutexattr_destroy=e.pthread_mutexattr_destroy,Module._pthread_mutexattr_init=e.pthread_mutexattr_init,Module._pthread_mutexattr_setprotocol=e.pthread_mutexattr_setprotocol,Module._pthread_mutexattr_setpshared=e.pthread_mutexattr_setpshared,Module._pthread_mutexattr_settype=e.pthread_mutexattr_settype,Module._putchar=e.putchar,Module._qsort=e.qsort,Module._srand=e.srand,Module._rand=e.rand,Module._remainder=e.remainder,Module._remove=e.remove,Module._remquo=e.remquo,Module._round=e.round,Module._roundf=e.roundf,__emscripten_timeout=e._emscripten_timeout,Module._sinl=e.sinl,Module._siprintf=e.siprintf,Module._sqrtl=e.sqrtl,Module._vsscanf=e.vsscanf,Module._statvfs=e.statvfs,Module._strcasecmp=e.strcasecmp,Module._strerror=e.strerror,Module._strftime=e.strftime,Module._strncasecmp=e.strncasecmp,Module.___floatsitf=e.__floatsitf,Module.___multf3=e.__multf3,Module.___addtf3=e.__addtf3,Module.___extenddftf2=e.__extenddftf2,Module.___getf2=e.__getf2,Module.___subtf3=e.__subtf3,Module.___divtf3=e.__divtf3,Module.___eqtf2=e.__eqtf2,Module.___letf2=e.__letf2,Module.___trunctfdf2=e.__trunctfdf2,Module._strtold=e.strtold,Module._strtof_l=e.strtof_l,Module._strtod_l=e.strtod_l,Module._strtold_l=e.strtold_l,Module._strtok=e.strtok,Module._strtoull_l=e.strtoull_l,Module._strtoll_l=e.strtoll_l,Module._swprintf=e.swprintf,Module._connect=e.connect,Module._trunc=e.trunc,Module._ungetc=e.ungetc,Module._ungetwc=e.ungetwc,Module._unlinkat=e.unlinkat,Module._usleep=e.usleep,Module._utimensat=e.utimensat,Module._vasprintf=e.vasprintf,Module._wcrtomb=e.wcrtomb,Module._wcscoll_l=e.wcscoll_l,Module._wcsnrtombs=e.wcsnrtombs,Module._wcstof=e.wcstof,Module._wcstod=e.wcstod,Module._wcstold=e.wcstold,Module._wcstoull=e.wcstoull,Module._wcstoll=e.wcstoll,Module._wcstoul=e.wcstoul,Module._wcstol=e.wcstol,Module._wcsxfrm_l=e.wcsxfrm_l,Module._wctob=e.wctob,Module._wmemchr=e.wmemchr,Module._wmemcmp=e.wmemcmp,_emscripten_get_sbrk_ptr=e.emscripten_get_sbrk_ptr,Module.___ashlti3=e.__ashlti3,Module.___lttf2=e.__lttf2,_setThrew=e.setThrew,__emscripten_tempret_set=e._emscripten_tempret_set,__emscripten_tempret_get=e._emscripten_tempret_get,Module.___fixtfsi=e.__fixtfsi,__emscripten_stack_restore=e._emscripten_stack_restore,__emscripten_stack_alloc=e._emscripten_stack_alloc,_emscripten_stack_get_current=e.emscripten_stack_get_current,___cxa_decrement_exception_refcount=Module.___cxa_decrement_exception_refcount=e.__cxa_decrement_exception_refcount,___cxa_increment_exception_refcount=Module.___cxa_increment_exception_refcount=e.__cxa_increment_exception_refcount,Module.___cxa_bad_cast=e.__cxa_bad_cast,Module.___cxa_bad_typeid=e.__cxa_bad_typeid,Module.___cxa_allocate_exception=e.__cxa_allocate_exception,Module.___cxa_free_exception=e.__cxa_free_exception,Module.___cxa_init_primary_exception=e.__cxa_init_primary_exception,___cxa_get_exception_ptr=Module.___cxa_get_exception_ptr=e.__cxa_get_exception_ptr,Module.___stack_pointer=e.__stack_pointer,Module.___table_base=e.__table_base.value,Module._LocalBufferBlockPointers=e.LocalBufferBlockPointers.value,Module._BufferBlocks=e.BufferBlocks.value,Module._wal_level=e.wal_level.value,Module._CurrentMemoryContext=e.CurrentMemoryContext.value,Module.___memory_base=e.__memory_base.value,Module._SnapshotAnyData=e.SnapshotAnyData.value,Module._debug_query_string=e.debug_query_string.value,Module._maintenance_work_mem=e.maintenance_work_mem.value,wasmTable=e.__indirect_function_table,Module._CritSectionCount=e.CritSectionCount.value,Module._InterruptPending=e.InterruptPending.value,Module._ParallelWorkerNumber=e.ParallelWorkerNumber.value,Module._pg_number_of_ones=e.pg_number_of_ones.value,Module._TopMemoryContext=e.TopMemoryContext.value,Module._IsUnderPostmaster=e.IsUnderPostmaster.value,Module._MainLWLockArray=e.MainLWLockArray.value,Module._CurrentResourceOwner=e.CurrentResourceOwner.value,Module._MyBackendType=e.MyBackendType.value,Module._work_mem=e.work_mem.value,Module._pg_global_prng_state=e.pg_global_prng_state.value,Module._NBuffers=e.NBuffers.value,Module._XactIsoLevel=e.XactIsoLevel.value,Module._bsysscan=e.bsysscan.value,Module._CheckXidAlive=e.CheckXidAlive.value,Module._MyProc=e.MyProc.value,Module._MyDatabaseId=e.MyDatabaseId.value,Module._MyDatabaseTableSpace=e.MyDatabaseTableSpace.value,Module._TTSOpsBufferHeapTuple=e.TTSOpsBufferHeapTuple.value,Module._RecentXmin=e.RecentXmin.value,Module._TTSOpsHeapTuple=e.TTSOpsHeapTuple.value,Module._pgWalUsage=e.pgWalUsage.value,Module._pgBufferUsage=e.pgBufferUsage.value,Module._error_context_stack=e.error_context_stack.value,Module._MyLatch=e.MyLatch.value,Module._SnapshotSelfData=e.SnapshotSelfData.value,Module.___THREW__=e.__THREW__.value,Module.___threwValue=e.__threwValue.value,Module._PG_exception_stack=e.PG_exception_stack.value,Module._TTSOpsVirtual=e.TTSOpsVirtual.value,Module._GUC_check_errdetail_string=e.GUC_check_errdetail_string.value,Module._TransamVariables=e.TransamVariables.value,Module._TopTransactionContext=e.TopTransactionContext.value,Module._InterruptHoldoffCount=e.InterruptHoldoffCount.value,Module._MyProcPid=e.MyProcPid.value,Module._RmgrTable=e.RmgrTable.value,Module._process_shared_preload_libraries_in_progress=e.process_shared_preload_libraries_in_progress.value,Module._wal_segment_size=e.wal_segment_size.value,Module._TopTransactionResourceOwner=e.TopTransactionResourceOwner.value,Module._arch_module_check_errdetail_string=e.arch_module_check_errdetail_string.value,Module._stdout=e.stdout.value,Module._stdin=e.stdin.value,Module._creating_extension=e.creating_extension.value,Module._object_access_hook=e.object_access_hook.value,Module._InvalidObjectAddress=e.InvalidObjectAddress.value,Module._check_function_bodies=e.check_function_bodies.value,Module._post_parse_analyze_hook=e.post_parse_analyze_hook.value,Module._ScanKeywordTokens=e.ScanKeywordTokens.value,Module._ScanKeywords=e.ScanKeywords.value,Module._standard_conforming_strings=e.standard_conforming_strings.value,Module._None_Receiver=e.None_Receiver.value,Module._explain_per_plan_hook=e.explain_per_plan_hook.value,Module._explain_get_index_name_hook=e.explain_get_index_name_hook.value,Module._explain_per_node_hook=e.explain_per_node_hook.value,Module._CacheMemoryContext=e.CacheMemoryContext.value,Module._SPI_processed=e.SPI_processed.value,Module._SPI_tuptable=e.SPI_tuptable.value,Module._TTSOpsMinimalTuple=e.TTSOpsMinimalTuple.value,Module._check_password_hook=e.check_password_hook.value,Module._ConfigReloadPending=e.ConfigReloadPending.value,Module._max_parallel_maintenance_workers=e.max_parallel_maintenance_workers.value,Module._DateStyle=e.DateStyle.value,Module._ExecutorStart_hook=e.ExecutorStart_hook.value,Module._ExecutorRun_hook=e.ExecutorRun_hook.value,Module._ExecutorFinish_hook=e.ExecutorFinish_hook.value,Module._ExecutorEnd_hook=e.ExecutorEnd_hook.value,Module._ExecutorCheckPerms_hook=e.ExecutorCheckPerms_hook.value,Module._SPI_result=e.SPI_result.value,Module._stderr=e.stderr.value,Module._MyProcPort=e.MyProcPort.value,Module._ClientAuthentication_hook=e.ClientAuthentication_hook.value,Module._set_rel_pathlist_hook=e.set_rel_pathlist_hook.value,Module._cpu_tuple_cost=e.cpu_tuple_cost.value,Module._cpu_operator_cost=e.cpu_operator_cost.value,Module._seq_page_cost=e.seq_page_cost.value,Module._planner_hook=e.planner_hook.value,Module._get_relation_info_hook=e.get_relation_info_hook.value,Module._QueryCancelPending=e.QueryCancelPending.value,Module._ShutdownRequestPending=e.ShutdownRequestPending.value,Module._MyStartTime=e.MyStartTime.value,Module._cluster_name=e.cluster_name.value,Module._ProcDiePending=e.ProcDiePending.value,Module._application_name=e.application_name.value,Module._row_security_policy_hook_restrictive=e.row_security_policy_hook_restrictive.value,Module._row_security_policy_hook_permissive=e.row_security_policy_hook_permissive.value,Module._BufferDescriptors=e.BufferDescriptors.value,Module._shmem_startup_hook=e.shmem_startup_hook.value,Module._ProcessUtility_hook=e.ProcessUtility_hook.value,Module._IntervalStyle=e.IntervalStyle.value,Module._extra_float_digits=e.extra_float_digits.value,Module._ScanKeywordCategories=e.ScanKeywordCategories.value,Module._pg_crc32_table=e.pg_crc32_table.value,Module._shmem_request_hook=e.shmem_request_hook.value,Module._z_errmsg=e.z_errmsg.value,Module.__length_code=e._length_code.value,Module.__dist_code=e._dist_code.value,___heap_base=e.__heap_base.value}var wasmImports={__assert_fail:___assert_fail,__call_sighandler:___call_sighandler,__cxa_begin_catch:___cxa_begin_catch,__cxa_current_primary_exception:___cxa_current_primary_exception,__cxa_end_catch:___cxa_end_catch,__cxa_find_matching_catch_2:___cxa_find_matching_catch_2,__cxa_find_matching_catch_3:___cxa_find_matching_catch_3,__cxa_rethrow:___cxa_rethrow,__cxa_rethrow_primary_exception:___cxa_rethrow_primary_exception,__cxa_throw:___cxa_throw,__cxa_uncaught_exceptions:___cxa_uncaught_exceptions,__resumeException:___resumeException,__syscall_accept4:___syscall_accept4,__syscall_bind:___syscall_bind,__syscall_chdir:___syscall_chdir,__syscall_chmod:___syscall_chmod,__syscall_connect:___syscall_connect,__syscall_dup:___syscall_dup,__syscall_dup3:___syscall_dup3,__syscall_faccessat:___syscall_faccessat,__syscall_fadvise64:___syscall_fadvise64,__syscall_fallocate:___syscall_fallocate,__syscall_fchmod:___syscall_fchmod,__syscall_fchmodat2:___syscall_fchmodat2,__syscall_fchown32:___syscall_fchown32,__syscall_fchownat:___syscall_fchownat,__syscall_fcntl64:___syscall_fcntl64,__syscall_fdatasync:___syscall_fdatasync,__syscall_fstat64:___syscall_fstat64,__syscall_ftruncate64:___syscall_ftruncate64,__syscall_getcwd:___syscall_getcwd,__syscall_getdents64:___syscall_getdents64,__syscall_getegid32:___syscall_getegid32,__syscall_geteuid32:___syscall_geteuid32,__syscall_getgid32:___syscall_getgid32,__syscall_getuid32:___syscall_getuid32,__syscall_ioctl:___syscall_ioctl,__syscall_linkat:___syscall_linkat,__syscall_listen:___syscall_listen,__syscall_lstat64:___syscall_lstat64,__syscall_mkdirat:___syscall_mkdirat,__syscall_newfstatat:___syscall_newfstatat,__syscall_openat:___syscall_openat,__syscall_pipe2:___syscall_pipe2,__syscall_poll:___syscall_poll,__syscall_readlinkat:___syscall_readlinkat,__syscall_recvfrom:___syscall_recvfrom,__syscall_renameat:___syscall_renameat,__syscall_rmdir:___syscall_rmdir,__syscall_sendto:___syscall_sendto,__syscall_socket:___syscall_socket,__syscall_stat64:___syscall_stat64,__syscall_statfs64:___syscall_statfs64,__syscall_symlinkat:___syscall_symlinkat,__syscall_truncate64:___syscall_truncate64,__syscall_umask:___syscall_umask,__syscall_unlinkat:___syscall_unlinkat,__syscall_utimensat:___syscall_utimensat,_abort_js:__abort_js,_dlopen_js:__dlopen_js,_dlsym_js:__dlsym_js,_emscripten_runtime_keepalive_clear:__emscripten_runtime_keepalive_clear,_emscripten_throw_longjmp:__emscripten_throw_longjmp,_gmtime_js:__gmtime_js,_localtime_js:__localtime_js,_mmap_js:__mmap_js,_munmap_js:__munmap_js,_setitimer_js:__setitimer_js,_tzset_js:__tzset_js,clock_time_get:_clock_time_get,emscripten_date_now:_emscripten_date_now,emscripten_force_exit:_emscripten_force_exit,emscripten_get_heap_max:_emscripten_get_heap_max,emscripten_get_now:_emscripten_get_now,emscripten_resize_heap:_emscripten_resize_heap,environ_get:_environ_get,environ_sizes_get:_environ_sizes_get,exit:_exit,fd_close:_fd_close,fd_fdstat_get:_fd_fdstat_get,fd_pread:_fd_pread,fd_pwrite:_fd_pwrite,fd_read:_fd_read,fd_seek:_fd_seek,fd_sync:_fd_sync,fd_write:_fd_write,getTempRet0:_getTempRet0,getaddrinfo:_getaddrinfo,getnameinfo:_getnameinfo,invoke_di,invoke_i,invoke_id,invoke_ii,invoke_iii,invoke_iiii,invoke_iiiii,invoke_iiiiii,invoke_iiiiiii,invoke_iiiiiiii,invoke_iiiiiiiii,invoke_iiiiiiiiii,invoke_iiiiiiiiiii,invoke_iiiiiiiiiiiiii,invoke_iiiiiiiiiiiiiiiiii,invoke_iiiiiji,invoke_iiiij,invoke_iiij,invoke_iiji,invoke_iijj,invoke_ij,invoke_ijiiiii,invoke_ijiiiiii,invoke_ijji,invoke_j,invoke_ji,invoke_jii,invoke_jiiii,invoke_jiiiiii,invoke_jiiiiiiiii,invoke_jij,invoke_v,invoke_vi,invoke_vid,invoke_vii,invoke_viii,invoke_viiii,invoke_viiiii,invoke_viiiiii,invoke_viiiiiii,invoke_viiiiiiii,invoke_viiiiiiiii,invoke_viiiiiiiiiiii,invoke_viiiji,invoke_viij,invoke_viiji,invoke_viijii,invoke_viijiiii,invoke_vij,invoke_viji,invoke_vijiji,invoke_vijjii,invoke_vj,invoke_vji,invoke_vjii,invoke_vjjii,memory:wasmMemory,proc_exit:_proc_exit,random_get:_random_get,sched_yield:_sched_yield,setTempRet0:_setTempRet0};function invoke_ii(e,r){var M=stackSave();try{return getWasmTableEntry(e)(r)}catch(fe){if(stackRestore(M),!(fe instanceof EmscriptenEH))throw fe;_setThrew(1,0)}}function invoke_vii(e,r,M){var fe=stackSave();try{getWasmTableEntry(e)(r,M)}catch($n){if(stackRestore(fe),!($n instanceof EmscriptenEH))throw $n;_setThrew(1,0)}}function invoke_viiiii(e,r,M,fe,$n,qn){var jn=stackSave();try{getWasmTableEntry(e)(r,M,fe,$n,qn)}catch(Wn){if(stackRestore(jn),!(Wn instanceof EmscriptenEH))throw Wn;_setThrew(1,0)}}function invoke_vi(e,r){var M=stackSave();try{getWasmTableEntry(e)(r)}catch(fe){if(stackRestore(M),!(fe instanceof EmscriptenEH))throw fe;_setThrew(1,0)}}function invoke_v(e){var r=stackSave();try{getWasmTableEntry(e)()}catch(M){if(stackRestore(r),!(M instanceof EmscriptenEH))throw M;_setThrew(1,0)}}function invoke_iii(e,r,M){var fe=stackSave();try{return getWasmTableEntry(e)(r,M)}catch($n){if(stackRestore(fe),!($n instanceof EmscriptenEH))throw $n;_setThrew(1,0)}}function invoke_viii(e,r,M,fe){var $n=stackSave();try{getWasmTableEntry(e)(r,M,fe)}catch(qn){if(stackRestore($n),!(qn instanceof EmscriptenEH))throw qn;_setThrew(1,0)}}function invoke_iiii(e,r,M,fe){var $n=stackSave();try{return getWasmTableEntry(e)(r,M,fe)}catch(qn){if(stackRestore($n),!(qn instanceof EmscriptenEH))throw qn;_setThrew(1,0)}}function invoke_jii(e,r,M){var fe=stackSave();try{return getWasmTableEntry(e)(r,M)}catch($n){if(stackRestore(fe),!($n instanceof EmscriptenEH))throw $n;return _setThrew(1,0),0n}}function invoke_iiiii(e,r,M,fe,$n){var qn=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n)}catch(jn){if(stackRestore(qn),!(jn instanceof EmscriptenEH))throw jn;_setThrew(1,0)}}function invoke_i(e){var r=stackSave();try{return getWasmTableEntry(e)()}catch(M){if(stackRestore(r),!(M instanceof EmscriptenEH))throw M;_setThrew(1,0)}}function invoke_ji(e,r){var M=stackSave();try{return getWasmTableEntry(e)(r)}catch(fe){if(stackRestore(M),!(fe instanceof EmscriptenEH))throw fe;return _setThrew(1,0),0n}}function invoke_jiiiiiiiii(e,r,M,fe,$n,qn,jn,Wn,Yn,Xn){var Kn=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n,qn,jn,Wn,Yn,Xn)}catch(er){if(stackRestore(Kn),!(er instanceof EmscriptenEH))throw er;return _setThrew(1,0),0n}}function invoke_jiiiiii(e,r,M,fe,$n,qn,jn){var Wn=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n,qn,jn)}catch(Yn){if(stackRestore(Wn),!(Yn instanceof EmscriptenEH))throw Yn;return _setThrew(1,0),0n}}function invoke_viiii(e,r,M,fe,$n){var qn=stackSave();try{getWasmTableEntry(e)(r,M,fe,$n)}catch(jn){if(stackRestore(qn),!(jn instanceof EmscriptenEH))throw jn;_setThrew(1,0)}}function invoke_iiiiiiiiiiiiii(e,r,M,fe,$n,qn,jn,Wn,Yn,Xn,Kn,er,nr,Zn){var rr=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n,qn,jn,Wn,Yn,Xn,Kn,er,nr,Zn)}catch(sr){if(stackRestore(rr),!(sr instanceof EmscriptenEH))throw sr;_setThrew(1,0)}}function invoke_vji(e,r,M){var fe=stackSave();try{getWasmTableEntry(e)(r,M)}catch($n){if(stackRestore(fe),!($n instanceof EmscriptenEH))throw $n;_setThrew(1,0)}}function invoke_viiji(e,r,M,fe,$n){var qn=stackSave();try{getWasmTableEntry(e)(r,M,fe,$n)}catch(jn){if(stackRestore(qn),!(jn instanceof EmscriptenEH))throw jn;_setThrew(1,0)}}function invoke_iiiij(e,r,M,fe,$n){var qn=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n)}catch(jn){if(stackRestore(qn),!(jn instanceof EmscriptenEH))throw jn;_setThrew(1,0)}}function invoke_vijiji(e,r,M,fe,$n,qn){var jn=stackSave();try{getWasmTableEntry(e)(r,M,fe,$n,qn)}catch(Wn){if(stackRestore(jn),!(Wn instanceof EmscriptenEH))throw Wn;_setThrew(1,0)}}function invoke_viji(e,r,M,fe){var $n=stackSave();try{getWasmTableEntry(e)(r,M,fe)}catch(qn){if(stackRestore($n),!(qn instanceof EmscriptenEH))throw qn;_setThrew(1,0)}}function invoke_iiiiii(e,r,M,fe,$n,qn){var jn=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n,qn)}catch(Wn){if(stackRestore(jn),!(Wn instanceof EmscriptenEH))throw Wn;_setThrew(1,0)}}function invoke_iiiiiiiii(e,r,M,fe,$n,qn,jn,Wn,Yn){var Xn=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n,qn,jn,Wn,Yn)}catch(Kn){if(stackRestore(Xn),!(Kn instanceof EmscriptenEH))throw Kn;_setThrew(1,0)}}function invoke_iiiiiiiiiiiiiiiiii(e,r,M,fe,$n,qn,jn,Wn,Yn,Xn,Kn,er,nr,Zn,rr,sr,or,ir){var Jn=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n,qn,jn,Wn,Yn,Xn,Kn,er,nr,Zn,rr,sr,or,ir)}catch(tr){if(stackRestore(Jn),!(tr instanceof EmscriptenEH))throw tr;_setThrew(1,0)}}function invoke_iiiiiii(e,r,M,fe,$n,qn,jn){var Wn=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n,qn,jn)}catch(Yn){if(stackRestore(Wn),!(Yn instanceof EmscriptenEH))throw Yn;_setThrew(1,0)}}function invoke_vj(e,r){var M=stackSave();try{getWasmTableEntry(e)(r)}catch(fe){if(stackRestore(M),!(fe instanceof EmscriptenEH))throw fe;_setThrew(1,0)}}function invoke_iiiiiiiiii(e,r,M,fe,$n,qn,jn,Wn,Yn,Xn){var Kn=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n,qn,jn,Wn,Yn,Xn)}catch(er){if(stackRestore(Kn),!(er instanceof EmscriptenEH))throw er;_setThrew(1,0)}}function invoke_viij(e,r,M,fe){var $n=stackSave();try{getWasmTableEntry(e)(r,M,fe)}catch(qn){if(stackRestore($n),!(qn instanceof EmscriptenEH))throw qn;_setThrew(1,0)}}function invoke_viiiiiiii(e,r,M,fe,$n,qn,jn,Wn,Yn){var Xn=stackSave();try{getWasmTableEntry(e)(r,M,fe,$n,qn,jn,Wn,Yn)}catch(Kn){if(stackRestore(Xn),!(Kn instanceof EmscriptenEH))throw Kn;_setThrew(1,0)}}function invoke_viiiiiiiii(e,r,M,fe,$n,qn,jn,Wn,Yn,Xn){var Kn=stackSave();try{getWasmTableEntry(e)(r,M,fe,$n,qn,jn,Wn,Yn,Xn)}catch(er){if(stackRestore(Kn),!(er instanceof EmscriptenEH))throw er;_setThrew(1,0)}}function invoke_vij(e,r,M){var fe=stackSave();try{getWasmTableEntry(e)(r,M)}catch($n){if(stackRestore(fe),!($n instanceof EmscriptenEH))throw $n;_setThrew(1,0)}}function invoke_viiiiii(e,r,M,fe,$n,qn,jn){var Wn=stackSave();try{getWasmTableEntry(e)(r,M,fe,$n,qn,jn)}catch(Yn){if(stackRestore(Wn),!(Yn instanceof EmscriptenEH))throw Yn;_setThrew(1,0)}}function invoke_iiji(e,r,M,fe){var $n=stackSave();try{return getWasmTableEntry(e)(r,M,fe)}catch(qn){if(stackRestore($n),!(qn instanceof EmscriptenEH))throw qn;_setThrew(1,0)}}function invoke_ij(e,r){var M=stackSave();try{return getWasmTableEntry(e)(r)}catch(fe){if(stackRestore(M),!(fe instanceof EmscriptenEH))throw fe;_setThrew(1,0)}}function invoke_viiiiiii(e,r,M,fe,$n,qn,jn,Wn){var Yn=stackSave();try{getWasmTableEntry(e)(r,M,fe,$n,qn,jn,Wn)}catch(Xn){if(stackRestore(Yn),!(Xn instanceof EmscriptenEH))throw Xn;_setThrew(1,0)}}function invoke_viiiji(e,r,M,fe,$n,qn){var jn=stackSave();try{getWasmTableEntry(e)(r,M,fe,$n,qn)}catch(Wn){if(stackRestore(jn),!(Wn instanceof EmscriptenEH))throw Wn;_setThrew(1,0)}}function invoke_iiiiiiii(e,r,M,fe,$n,qn,jn,Wn){var Yn=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n,qn,jn,Wn)}catch(Xn){if(stackRestore(Yn),!(Xn instanceof EmscriptenEH))throw Xn;_setThrew(1,0)}}function invoke_iiij(e,r,M,fe){var $n=stackSave();try{return getWasmTableEntry(e)(r,M,fe)}catch(qn){if(stackRestore($n),!(qn instanceof EmscriptenEH))throw qn;_setThrew(1,0)}}function invoke_vid(e,r,M){var fe=stackSave();try{getWasmTableEntry(e)(r,M)}catch($n){if(stackRestore(fe),!($n instanceof EmscriptenEH))throw $n;_setThrew(1,0)}}function invoke_j(e){var r=stackSave();try{return getWasmTableEntry(e)()}catch(M){if(stackRestore(r),!(M instanceof EmscriptenEH))throw M;return _setThrew(1,0),0n}}function invoke_vjjii(e,r,M,fe,$n){var qn=stackSave();try{getWasmTableEntry(e)(r,M,fe,$n)}catch(jn){if(stackRestore(qn),!(jn instanceof EmscriptenEH))throw jn;_setThrew(1,0)}}function invoke_ijji(e,r,M,fe){var $n=stackSave();try{return getWasmTableEntry(e)(r,M,fe)}catch(qn){if(stackRestore($n),!(qn instanceof EmscriptenEH))throw qn;_setThrew(1,0)}}function invoke_iijj(e,r,M,fe){var $n=stackSave();try{return getWasmTableEntry(e)(r,M,fe)}catch(qn){if(stackRestore($n),!(qn instanceof EmscriptenEH))throw qn;_setThrew(1,0)}}function invoke_jij(e,r,M){var fe=stackSave();try{return getWasmTableEntry(e)(r,M)}catch($n){if(stackRestore(fe),!($n instanceof EmscriptenEH))throw $n;return _setThrew(1,0),0n}}function invoke_ijiiiiii(e,r,M,fe,$n,qn,jn,Wn){var Yn=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n,qn,jn,Wn)}catch(Xn){if(stackRestore(Yn),!(Xn instanceof EmscriptenEH))throw Xn;_setThrew(1,0)}}function invoke_viijii(e,r,M,fe,$n,qn){var jn=stackSave();try{getWasmTableEntry(e)(r,M,fe,$n,qn)}catch(Wn){if(stackRestore(jn),!(Wn instanceof EmscriptenEH))throw Wn;_setThrew(1,0)}}function invoke_iiiiiji(e,r,M,fe,$n,qn,jn){var Wn=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n,qn,jn)}catch(Yn){if(stackRestore(Wn),!(Yn instanceof EmscriptenEH))throw Yn;_setThrew(1,0)}}function invoke_viijiiii(e,r,M,fe,$n,qn,jn,Wn){var Yn=stackSave();try{getWasmTableEntry(e)(r,M,fe,$n,qn,jn,Wn)}catch(Xn){if(stackRestore(Yn),!(Xn instanceof EmscriptenEH))throw Xn;_setThrew(1,0)}}function invoke_vijjii(e,r,M,fe,$n,qn){var jn=stackSave();try{getWasmTableEntry(e)(r,M,fe,$n,qn)}catch(Wn){if(stackRestore(jn),!(Wn instanceof EmscriptenEH))throw Wn;_setThrew(1,0)}}function invoke_vjii(e,r,M,fe){var $n=stackSave();try{getWasmTableEntry(e)(r,M,fe)}catch(qn){if(stackRestore($n),!(qn instanceof EmscriptenEH))throw qn;_setThrew(1,0)}}function invoke_jiiii(e,r,M,fe,$n){var qn=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n)}catch(jn){if(stackRestore(qn),!(jn instanceof EmscriptenEH))throw jn;return _setThrew(1,0),0n}}function invoke_viiiiiiiiiiii(e,r,M,fe,$n,qn,jn,Wn,Yn,Xn,Kn,er,nr){var Zn=stackSave();try{getWasmTableEntry(e)(r,M,fe,$n,qn,jn,Wn,Yn,Xn,Kn,er,nr)}catch(rr){if(stackRestore(Zn),!(rr instanceof EmscriptenEH))throw rr;_setThrew(1,0)}}function invoke_di(e,r){var M=stackSave();try{return getWasmTableEntry(e)(r)}catch(fe){if(stackRestore(M),!(fe instanceof EmscriptenEH))throw fe;_setThrew(1,0)}}function invoke_id(e,r){var M=stackSave();try{return getWasmTableEntry(e)(r)}catch(fe){if(stackRestore(M),!(fe instanceof EmscriptenEH))throw fe;_setThrew(1,0)}}function invoke_ijiiiii(e,r,M,fe,$n,qn,jn){var Wn=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n,qn,jn)}catch(Yn){if(stackRestore(Wn),!(Yn instanceof EmscriptenEH))throw Yn;_setThrew(1,0)}}function invoke_iiiiiiiiiii(e,r,M,fe,$n,qn,jn,Wn,Yn,Xn,Kn){var er=stackSave();try{return getWasmTableEntry(e)(r,M,fe,$n,qn,jn,Wn,Yn,Xn,Kn)}catch(nr){if(stackRestore(er),!(nr instanceof EmscriptenEH))throw nr;_setThrew(1,0)}}function callMain(e=[]){var r=resolveGlobalSymbol("main").sym;if(r){e.unshift(thisProgram);var M=e.length,fe=stackAlloc((M+1)*4),$n=fe;for(var qn of e)HEAPU32[$n>>2]=stringToUTF8OnStack(qn),$n+=4;HEAPU32[$n>>2]=0;try{var jn=r(M,fe);return exitJS(jn,!0),jn}catch(Wn){return handleException(Wn)}}}async function run(e=programArgs){preRun(),runDependencies&&await resolveRunDependencies();var r=Module.setStatus;if(r&&(r("Running..."),await new Promise(fe=>setTimeout(fe,1)),setTimeout(r,1,"")),!ABORT){initRuntime(),Module.onRuntimeInitialized?.();var M=Module.noInitialRun||!0;M||callMain(e),postRun()}}var wasmExports;return wasmExports=await createWasm(),await run(),quit_=(e,r)=>{throw r},Module}var Ue=it,He=Ue,Y=class{constructor(e={results:[],throwOnError:!1,onNotice:void 0,databaseError:null}){this.results=[],this.throwOnError=!1,this.databaseError=null,this.results=e.results||[],this.throwOnError=e.throwOnError||!1,this.onNotice=e.onNotice,this.databaseError=e.databaseError===void 0?null:e.databaseError}},G,$,Q,J,te,re,de,Me,be,_e,ne,ce,ae,Z,E,z,x,ie,A,le,j,U,D,O,ue,pe,ge,oe,S,Te,Pe,Ee,We,Ve,Xe,Ke,Ce,Ye,N,$e,Qe,Je,Ze,xe,q=class pr extends z$1{constructor(r={},M={}){super(),R$1(this,S),this.POSTGRES_MAIN_LONGJMP=100,this.PGLITE_EXIT_ALIVE=99,R$1(this,G),R$1(this,$,!1),R$1(this,Q,!1),R$1(this,J,!1),R$1(this,te,!1),R$1(this,re,new V),R$1(this,de,new V),R$1(this,Me,new V),R$1(this,be,new V),R$1(this,_e,!1),this.debug=0,R$1(this,ne),R$1(this,ce,[]),R$1(this,ae,new pe$1),R$1(this,Z),R$1(this,E),R$1(this,z,new Map),R$1(this,x,new Set),R$1(this,ie,-1),R$1(this,A,new Y),R$1(this,le,-1),R$1(this,j,[]),R$1(this,U,0),R$1(this,D,new Uint8Array(0)),R$1(this,O,0),R$1(this,ue,-1),R$1(this,pe,-1),R$1(this,ge,-1),this.externalCommandStreamFd=null,R$1(this,oe,!1),typeof r=="string"?M={dataDir:r,...M}:M=r,this.dataDir=M.dataDir,M.parsers!==void 0&&(this.parsers={...this.parsers,...M.parsers}),M.serializers!==void 0&&(this.serializers={...this.serializers,...M.serializers}),M?.debug!==void 0&&(this.debug=M.debug),M?.relaxedDurability!==void 0&&x$3(this,te,M.relaxedDurability),x$3(this,ne,M.extensions??{}),this.waitReady=T$2(this,S,Ee).call(this,M??{})}get ENV(){return this.mod?.ENV}static async create(r,M){let fe=typeof r=="string"?{dataDir:r,...M??{}}:r??M??{},$n=new pr(fe);return await $n.waitReady,$n}handleExternalCmd(r,M){if(r.startsWith("locale -a")&&M==="r"){let fe=this.mod.stringToUTF8OnStack("/pglite/locale-a"),$n=this.mod.stringToUTF8OnStack(M);return this.mod._fopen(fe,$n)}throw new Error("Unhandled cmd")}get Module(){return this.mod}get ready(){return h$1(this,$)&&!h$1(this,Q)&&!h$1(this,J)}get closed(){return h$1(this,J)}async close(){await this._checkReady(),await h$1(this,de).runExclusive(async()=>{await h$1(this,re).runExclusive(async()=>{await this._checkReady(),x$3(this,Q,!0)})});for(let r of h$1(this,ce))await r();try{this.mod._pgl_setPGliteActive(0),await this.execProtocol($e$1.end()),this.mod._pgl_run_atexit_funcs()}catch(r){let M=r;M.name==="ExitStatus"&&M.status===0||T$2(this,S,N).call(this,"An error occured while closing the db",r.toString())}finally{this.mod.removeFunction(h$1(this,le)),this.mod.removeFunction(h$1(this,ie))}await this.fs.closeFs(),x$3(this,J,!0),x$3(this,Q,!1),x$3(this,$,!1),x$3(this,oe,!1);try{this.mod._emscripten_force_exit(0)}catch(r){T$2(this,S,N).call(this,r),r.status!==0&&T$2(this,S,N).call(this,"Error when exiting",r.toString())}finally{this.mod=void 0}}async[Symbol.asyncDispose](){await this.close()}async _handleBlob(r){x$3(this,Z,r?await r.arrayBuffer():void 0)}async _cleanupBlob(){x$3(this,Z,void 0)}async _getWrittenBlob(){if(!h$1(this,E))return;let r=new Blob(h$1(this,E));return x$3(this,E,void 0),r}async _checkReady(){if(h$1(this,Q))throw new Error("PGlite is closing");if(h$1(this,J))throw new Error("PGlite is closed");h$1(this,$)||await this.waitReady}execProtocolRawSync(r){let M=this.mod;if(x$3(this,U,0),x$3(this,O,0),x$3(this,j,r),h$1(this,G)||x$3(this,G,T$2(this,S,Ke)),h$1(this,D).length!==pr.DEFAULT_RECV_BUF_SIZE&&x$3(this,D,new Uint8Array(pr.DEFAULT_RECV_BUF_SIZE)),r[0]===88)return new Uint8Array(0);if(r[0]===0)return T$2(this,S,xe).call(this,r);try{for(;h$1(this,U)<r.length||M._pq_buffer_remaining_data()>0;){let fe;try{fe=M.stackSave(),M._PostgresMainLoopOnce()}catch($n){M.stackRestore(fe),$n.status===this.POSTGRES_MAIN_LONGJMP&&M._PostgresMainLongJmp()}}}finally{M._PostgresSendReadyForQueryIfNecessary(),M._pgl_pq_flush()}return x$3(this,j,[]),h$1(this,O)?new Uint8Array(h$1(this,D).subarray(0,h$1(this,O))):new Uint8Array(0)}async execProtocolRaw(r,{syncToFs:M=!0}={}){let fe=this.execProtocolRawSync(r);return M&&await this.syncToFs(),fe}async execProtocolRawStream(r,{syncToFs:M=!0,onRawData:fe}){x$3(this,G,$n=>(fe($n),$n.length));try{this.execProtocolRawSync(r)}finally{x$3(this,G,void 0)}M&&await this.syncToFs()}async execProtocol(r,{syncToFs:M=!0,throwOnError:fe=!0,onNotice:$n}={}){x$3(this,A,new Y({throwOnError:fe,onNotice:$n}));let qn=await this.execProtocolRaw(r,{syncToFs:M}),jn=h$1(this,A).databaseError,Wn={messages:h$1(this,A).results,data:qn};if(x$3(this,A,new Y),x$3(this,G,void 0),fe&&jn)throw x$3(this,ae,new pe$1),jn;return Wn}async execProtocolStream(r,{syncToFs:M,throwOnError:fe=!0,onNotice:$n}={}){x$3(this,A,new Y({throwOnError:fe,onNotice:$n})),x$3(this,G,T$2(this,S,Ce)),await this.execProtocolRaw(r,{syncToFs:M});let qn=h$1(this,A).databaseError,jn=h$1(this,A).results;if(x$3(this,A,new Y),x$3(this,G,void 0),fe&&qn)throw x$3(this,ae,new pe$1),qn;return jn}isInTransaction(){return this.mod._IsTransactionBlock()!==0}async syncToFs(){if(h$1(this,_e))return;x$3(this,_e,!0);let r=async()=>{await h$1(this,be).runExclusive(async()=>{x$3(this,_e,!1),await this.fs.syncToFs(h$1(this,te))})};h$1(this,te)?r():await r()}async listen(r,M,fe){return this._runExclusiveListen(()=>T$2(this,S,$e).call(this,r,M,fe))}async unlisten(r,M,fe){return this._runExclusiveListen(()=>T$2(this,S,Qe).call(this,r,M,fe))}onNotification(r){return h$1(this,x).add(r),()=>{h$1(this,x).delete(r)}}offNotification(r){h$1(this,x).delete(r)}async dumpDataDir(r){return await h$1(this,re).runExclusive(async()=>{await this._checkReady();let M=this.dataDir?.split("/").pop()??"pgdata";return this.fs.dumpTar(M,r)})}_runExclusiveQuery(r){return h$1(this,re).runExclusive(r)}_runExclusiveTransaction(r){return h$1(this,de).runExclusive(r)}async clone(){let r=await this.dumpDataDir("none");return pr.create({loadDataDir:r,extensions:h$1(this,ne)})}_runExclusiveListen(r){return h$1(this,Me).runExclusive(r)}callMain(r){return this.mod.callMain(r)}copyToFS(r,M,fe){se(this.mod.FS,r,M,fe)}};G=new WeakMap,$=new WeakMap,Q=new WeakMap,J=new WeakMap,te=new WeakMap,re=new WeakMap,de=new WeakMap,Me=new WeakMap,be=new WeakMap,_e=new WeakMap,ne=new WeakMap,ce=new WeakMap,ae=new WeakMap,Z=new WeakMap,E=new WeakMap,z=new WeakMap,x=new WeakMap,ie=new WeakMap,A=new WeakMap,le=new WeakMap,j=new WeakMap,U=new WeakMap,D=new WeakMap,O=new WeakMap,ue=new WeakMap,pe=new WeakMap,ge=new WeakMap,oe=new WeakMap,S=new WeakSet,Te=function(e){this.debug&&console.debug(e)},Pe=function(e){this.debug&&console.error(e)},Ee=async function(e){if(e.fs)this.fs=e.fs;else{let{dataDir:Kn,fsType:er}=Be(e.dataDir);this.fs=await Ge(Kn,er)}let r={},M=[],fe=[...this.debug?["-d",this.debug.toString()]:[]];e.pgliteWasmModule||p.startArtifactDownload(new URL("/ritestand-induction-preview/assets/pglite-VfT9wtrq.wasm",import.meta.url)),e.initdbWasmModule||p.startArtifactDownload(new URL("/ritestand-induction-preview/assets/initdb-BJaOLL_I.wasm",import.meta.url));let $n=e.fsBundle?e.fsBundle.arrayBuffer():p.getFsBundle(new URL("/ritestand-induction-preview/assets/pglite-BE2Di5Vw.data",import.meta.url)),qn;$n.then(Kn=>{qn=Kn});let jn=new WebAssembly.Memory({initial:e.initialMemory?e.initialMemory/(64*1024):2048,maximum:32768}),Wn={thisProgram:pt,PGLITE_ENV:{},WASM_PREFIX:p.WASM_PREFIX,arguments:fe,noExitRuntime:!0,wasmMemory:jn,stdin:()=>null,print:Kn=>{if(e.onStdout&&e.onStdout(Kn))return T$2(this,S,Te).call(this,Kn);T$2(this,S,Te).call(this,Kn)},printErr:Kn=>{if(e.onStderr&&e.onStderr(Kn))return T$2(this,S,Pe).call(this,Kn);T$2(this,S,Pe).call(this,Kn)},instantiateWasm:(Kn,er)=>(p.instantiateWasm(Kn,e.pgliteWasmModule??(()=>new URL("/ritestand-induction-preview/assets/pglite-VfT9wtrq.wasm",import.meta.url))).then(({instance:nr,module:Zn})=>{er(nr,Zn)}),{}),getPreloadedPackage:(Kn,er)=>{if(Kn==="pglite.data"){if(qn.byteLength!==er)throw new Error(`Invalid FS bundle size: ${qn.byteLength} !== ${er}`);return qn}throw new Error(`Unknown package: ${Kn}`)},preRun:[Kn=>{Kn.onRuntimeInitialized=()=>{T$2(this,S,Xe).call(this,Kn)}},Kn=>{let er=Kn.FS.makedev(64,0),nr={open:Zn=>{},close:Zn=>{},read:(Zn,rr,sr,or,ir)=>{let Jn=h$1(this,Z);if(!Jn)throw new Error("No /dev/blob File or Blob provided to read from");let tr=new Uint8Array(Jn);if(ir>=tr.length)return 0;let ar=Math.min(tr.length-ir,or);for(let dr=0;dr<ar;dr++)rr[sr+dr]=tr[ir+dr];return ar},write:(Zn,rr,sr,or,ir)=>(h$1(this,E)??x$3(this,E,[]),h$1(this,E).push(rr.slice(sr,sr+or)),or),llseek:(Zn,rr,sr)=>{let or=h$1(this,Z);if(!or)throw new Error("No /dev/blob File or Blob provided to llseek");let ir=rr;if(sr===1?ir+=Zn.position:sr===2&&(ir=new Uint8Array(or).length),ir<0)throw new Kn.FS.ErrnoError(28);return ir}};Kn.FS.registerDevice(er,nr),Kn.FS.mkdev("/dev/blob",er)},Kn=>{Kn.ENV.HOME="/home/postgres",Kn.ENV.USER="postgres",Kn.ENV.LOGNAME="postgres",Kn.ENV.PGDATA=I,Kn.ENV.PGUSER=e.username??"postgres",Kn.ENV.PGDATABASE=e.database??"postgres",Kn.ENV.LANG=Kn.ENV.LC_COLLATE=Kn.ENV.LC_CTYPE="en_US.UTF-8",Kn.ENV.TZ="UTC",Kn.ENV.PGTZ="UTC",Kn.ENV.PGCLIENTENCODING="UTF8",Kn.ENV.ICU_DATA=Hr,Kn.PGLITE_ENV&&Object.assign(Kn.ENV,Kn.PGLITE_ENV)},Kn=>{e.pgDataProxyFs&&(Kn.FS.mkdirTree(I),Kn.FS.mount(Kn.PROXYFS,{root:I,fs:e.pgDataProxyFs},I))}]},{emscriptenOpts:Yn}=await this.fs.init(this,Wn);Wn=Yn;let Xn=[];for(let[Kn,er]of Object.entries(h$1(this,ne)))if(er instanceof URL)r[Kn]=Fe(er);else{let nr=await er.setup(this,Wn);if(nr.emscriptenOpts&&(Wn=nr.emscriptenOpts),nr.namespaceObj){let Zn=this;Zn[Kn]=nr.namespaceObj}nr.bundlePath&&(r[Kn]=Fe(nr.bundlePath)),nr.init&&M.push(nr.init),nr.close&&h$1(this,ce).push(nr.close),Xn.push(...nr.sharedPreloadLibraries??[])}if(Wn.pg_extensions=r,await $n,this.mod=await He(Wn),this.mod.FS.chmod("/home/postgres/.pgpass",384),this.mod.FS.chmod(Lr,365),this.mod.FS.chmod(pt,365),await this.fs.initialSyncFs(),e.icuDataDir&&await T$2(this,S,Ve).call(this,e.icuDataDir),!e.noInitDb){if(e.loadDataDir){if(this.mod.FS.analyzePath(I+"/PG_VERSION").exists)throw new Error("Database already exists, cannot load from tarball");T$2(this,S,N).call(this,"pglite: loading data from tarball"),await Jr(this.mod.FS,e.loadDataDir,I)}else if(this.mod.FS.analyzePath(I+"/PG_VERSION").exists)T$2(this,S,N).call(this,"pglite: found DB, resuming");else{T$2(this,S,N).call(this,"pglite: no db in filesystem, running initdb");let Kn={...e};Kn.noInitDb=!0,Kn.dataDir=void 0,Kn.extensions=void 0,Kn.loadDataDir=void 0,Kn.fs=void 0;let er=this.fs instanceof ee;er&&(this.mod.FS.mkdirTree(I,448),Kn.pgDataProxyFs=this.mod.FS);let nr=await q.create(Kn);try{let Zn=await St({pg:nr,debug:e.debug,wasmModule:e.initdbWasmModule,args:e.initDbStartParams});if(Zn.exitCode!==0&&!Zn.stderr.includes("exists but is not empty"))throw new Error("INITDB failed to initialize: "+Zn.stderr);if(!er){let rr=await nr.dumpDataDir("none");await Jr(this.mod.FS,rr,I)}}finally{await nr.close()}await this.syncToFs()}await Le(this.mod,(...Kn)=>T$2(this,S,N).call(this,...Kn)),T$2(this,S,We).call(this,Xn,e),this.mod._pgl_setPGliteActive(1),T$2(this,S,Ze).call(this,{pgDataFolder:I,startParams:[...e.startParams||q.defaultStartParams,...this.debug?["-d",this.debug.toString()]:[]]}),T$2(this,S,Je).call(this),x$3(this,$,!0),e.username&&await this.exec(`SET ROLE ${e.username};`),await this._initArrayTypes();for(let Kn of M)await Kn()}},We=function(e,r){if(e.length&&!r.postgresqlconf&&(r.postgresqlconf=new Array),r.postgresqlconf){let M=typeof r.postgresqlconf=="string"?r.postgresqlconf:r.postgresqlconf.join(`
`);if(e.length){let fe=M.match(/^(shared_preload_libraries\s*=\s*)(.*)$/m);if(fe){let $n=fe[2].split(",").map(jn=>jn.trim()),qn=[...new Set([...$n,...e])];M=M.replace(fe[0],`${fe[1]}${qn.join(",")}`)}else M+=`
shared_preload_libraries=${e.join(",")}`}se(this.mod.FS,`${I}/postgresql.conf`,new TextEncoder().encode(M))}},Ve=async function(e){T$2(this,S,N).call(this,`pglite: icuDataDir specified, removing default icu data dir at ${Hr}`),p.rmdirRecursive(this.mod.FS,Hr),T$2(this,S,N).call(this,`pglite: loading icu data from tarball ${e}`),this.mod.FS.mkdirTree(Hr),await Jr(this.mod.FS,e,Hr)},Xe=function(e){x$3(this,ue,e.addFunction(r=>(T$2(this,S,N).call(this,`Postgres tried to execute ${e.UTF8ToString(r)}, returning 1.`),1),"pi")),e._pgl_set_system_fn(h$1(this,ue)),x$3(this,pe,e.addFunction((r,M)=>{let fe=e.UTF8ToString(M),$n=e.UTF8ToString(r);return this.externalCommandStreamFd=this.handleExternalCmd($n,fe),this.externalCommandStreamFd},"ppp")),e._pgl_set_popen_fn(h$1(this,pe)),x$3(this,ge,e.addFunction(r=>{if(r===this.externalCommandStreamFd)this.mod._fclose(this.externalCommandStreamFd),this.externalCommandStreamFd=null;else throw`Unhandled pclose ${r}`;T$2(this,S,N).call(this,"pclose_fn",r)},"pi")),e._pgl_set_pclose_fn(h$1(this,ge)),x$3(this,ie,e.addFunction((r,M)=>{let fe;try{fe=this.mod.HEAPU8.subarray(r,r+M)}catch($n){throw console.error("error",$n),$n}return h$1(this,G).call(this,fe)},"ipi")),x$3(this,le,e.addFunction((r,M)=>{let fe=h$1(this,j).length-h$1(this,U);return fe>M&&(fe=M),this.mod.HEAPU8.set(h$1(this,j).subarray(h$1(this,U),h$1(this,U)+fe),r),x$3(this,U,h$1(this,U)+fe),fe},"ipi")),e._pgl_set_rw_cbs(h$1(this,le),h$1(this,ie))},Ke=function(e){let r=e.slice(),M=h$1(this,O)+r.length;if(M>h$1(this,D).length){let fe=h$1(this,D).length+(h$1(this,D).length>>1)+M;M>q.MAX_BUFFER_SIZE&&(M=q.MAX_BUFFER_SIZE);let $n=new Uint8Array(fe);$n.set(h$1(this,D).subarray(0,h$1(this,O))),x$3(this,D,$n)}return h$1(this,D).set(r,h$1(this,O)),x$3(this,O,h$1(this,O)+r.length),T$2(this,S,Ce).call(this,r)},Ce=function(e){return h$1(this,ae).parse(e,r=>{let M=T$2(this,S,Ye).call(this,r);M&&h$1(this,A).results.push(M)}),e.length},Ye=function(e){if(!h$1(this,A).databaseError){if(e instanceof O$2)h$1(this,A).throwOnError&&(h$1(this,A).databaseError=e);else if(e instanceof te$1)this.debug>0&&console.warn(e),h$1(this,A).onNotice&&h$1(this,A).onNotice(e);else if(e instanceof $$1){let r=h$1(this,z).get(e.channel);r&&r.forEach(M=>{queueMicrotask(()=>M(e.payload))}),h$1(this,x).forEach(M=>{queueMicrotask(()=>M(e.channel,e.payload))})}return e}return null},N=function(...e){this.debug>0&&console.log(...e)},$e=async function(e,r,M){let fe=p.toPostgresName(e),$n=M??this;h$1(this,z).has(fe)||h$1(this,z).set(fe,new Set),h$1(this,z).get(fe).add(r);try{await $n.exec(`LISTEN ${e}`)}catch(qn){throw h$1(this,z).get(fe).delete(r),h$1(this,z).get(fe)?.size===0&&h$1(this,z).delete(fe),qn}return async qn=>{await this.unlisten(fe,r,qn)}},Qe=async function(e,r,M){let fe=p.toPostgresName(e),$n=M??this,qn=async()=>{await $n.exec(`UNLISTEN ${e}`),h$1(this,z).get(fe)?.size===0&&h$1(this,z).delete(fe)};r?(h$1(this,z).get(fe)?.delete(r),h$1(this,z).get(fe)?.size===0&&await qn()):await qn()},Je=function(){if(h$1(this,oe))throw new Error("PGlite single mode already running");this.mod._pgl_startPGlite(),x$3(this,oe,!0)},Ze=function(e){let r=[...e.startParams,"-D",e.pgDataFolder,this.mod.ENV.PGDATABASE],M=-1;if(M=this.mod.callMain(r),M!==this.PGLITE_EXIT_ALIVE)throw new Error("PGlite failed to initialize properly")},xe=function(e){x$3(this,U,0),x$3(this,O,0),x$3(this,j,e);let r=this.mod._pgl_getMyProcPort();if(this.mod._ProcessStartupPacket(r,!0,!0)!==0)throw new Error(`Cannot process startup packet + ${e.toString()}`);return this.mod._pgl_sendConnData(),this.mod._pgl_pq_flush(),x$3(this,j,[]),h$1(this,O)?h$1(this,D).subarray(0,h$1(this,O)):new Uint8Array(0)},q.paths={PG_ROOT:U$1,PGDATA:I,ICU_DATA_PATH:Hr,INITDB_EXE_PATH:Lr,POSTGRES_EXE_PATH:pt},q.DEFAULT_RECV_BUF_SIZE=1*1024*1024,q.MAX_BUFFER_SIZE=Math.pow(2,30),q.defaultStartParams=["--single","-F","-O","-j","-c","search_path=public","-c","exit_on_error=false","-c","log_checkpoints=false","-c","max_worker_processes=0","-c","max_parallel_workers=0","-c","max_parallel_workers_per_gather=0","-c","io_method=sync","-c","max_parallel_maintenance_workers=0"];var je=q;u$1();u$1();const raw=e=>Object.keys(e).sort().map(r=>e[r]),shim=raw(Object.assign({"/supabase/shim/00_supabase_shim.sql":__vite_glob_0_0})),migrations=raw(Object.assign({"/supabase/migrations/20261110000100_core_schema.sql":__vite_glob_1_0,"/supabase/migrations/20261110000200_security.sql":__vite_glob_1_1,"/supabase/migrations/20261110000300_core_logic.sql":__vite_glob_1_2,"/supabase/migrations/20261110000400_api_basics.sql":__vite_glob_1_3,"/supabase/migrations/20261110000410_team.sql":__vite_glob_1_4,"/supabase/migrations/20261110000420_access.sql":__vite_glob_1_5,"/supabase/migrations/20261110000500_content_helpers.sql":__vite_glob_1_6,"/supabase/migrations/20261110000600_learning_policies.sql":__vite_glob_1_7,"/supabase/migrations/20261110000700_authoring.sql":__vite_glob_1_8,"/supabase/migrations/20261110000800_assessments.sql":__vite_glob_1_9,"/supabase/migrations/20261110000900_platform.sql":__vite_glob_1_10})),seed=raw(Object.assign({"/supabase/seed.sql":__vite_glob_2_0})),staff=[],fixture=raw(Object.assign({"/supabase/tests/fixtures/people.sql":__vite_glob_4_0})),demo=raw(Object.assign({"/supabase/demo/demo.sql":__vite_glob_5_0,"/supabase/demo/test_people.sql":__vite_glob_5_1})),allSql=[...shim,...migrations,...seed,...staff.length?staff:fixture,...demo];function hash(e){let r=5381;for(let M=0;M<e.length;M++)r=(r<<5)+r+e.charCodeAt(M)|0;return(r>>>0).toString(36)}const DB_NAME=`ritestand-demo-${hash(allSql.join(`
`))}`,USER_KEY="ritestand-demo-user-id";let db;const listeners=new Set,emit=()=>listeners.forEach(e=>e());async function dropOldDemoDatabases(){try{const e=await indexedDB.databases?.()??[];for(const r of e)r.name?.startsWith("/pglite/ritestand-demo-")&&r.name!==`/pglite/${DB_NAME}`&&indexedDB.deleteDatabase(r.name)}catch{}}const demoBackend={mode:"demo",async init(){if(db=new je(`idb://${DB_NAME}`),await db.waitReady,!(await db.query("select to_regclass('public.demo_files') is not null as ok")).rows[0]?.ok)for(const r of allSql)await db.exec(r);dropOldDemoDatabases()},async rpc(e,r={}){if(!/^[a-z_][a-z0-9_]*$/.test(e))throw new ApiError("Unknown function.");const M=localStorage.getItem(USER_KEY);try{return await db.transaction(async fe=>(await fe.query("select set_config('request.jwt.claims', $1, true)",[JSON.stringify(M?{sub:M,role:"authenticated"}:{role:"anon"})]),await fe.exec(M?"set local role authenticated":"set local role anon"),(await fe.query(`select public.${e}($1::jsonb) as result`,[JSON.stringify(r)])).rows[0].result))}catch(fe){throw toApiError(fe)}},async currentUser(){const e=localStorage.getItem(USER_KEY);if(!e)return null;const r=await db.query("select email from auth.users where id = $1",[e]);return r.rows.length?{id:e,email:r.rows[0].email}:(localStorage.removeItem(USER_KEY),null)},onAuthChange(e){return listeners.add(e),()=>listeners.delete(e)},async signIn(e){try{const r=await db.query("select demo.sign_in($1) as uid",[e]);localStorage.setItem(USER_KEY,r.rows[0].uid)}catch(r){throw toApiError(r)}emit()},async signOut(){localStorage.removeItem(USER_KEY),emit()},async resetDemo(){localStorage.removeItem(USER_KEY),await db.close(),await new Promise(e=>{const r=indexedDB.deleteDatabase(`/pglite/${DB_NAME}`);r.onsuccess=r.onerror=r.onblocked=()=>e()}),location.assign("/ritestand-induction-preview/")}},demo$1=Object.freeze(Object.defineProperty({__proto__:null,demoBackend},Symbol.toStringTag,{value:"Module"}));export{Ce$1 as C,I,R$1 as R,T$2 as T,U$3 as U,Ie as a,x$3 as b,demo$1 as d,h$1 as h,u$1 as u,xe$1 as x};
