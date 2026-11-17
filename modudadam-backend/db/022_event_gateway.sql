BEGIN;

DO $$
BEGIN
  CREATE TYPE public.event_status AS ENUM ('draft', 'active', 'paused', 'ended');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.event_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_no VARCHAR(40) NOT NULL UNIQUE,
  slug VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  description VARCHAR(240),
  badge VARCHAR(30),
  thumbnail_url TEXT,
  status public.event_status NOT NULL DEFAULT 'draft',
  is_listed BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  event_base_url TEXT,
  local_event_base_url TEXT,
  entry_path TEXT NOT NULL,
  result_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at),
  CHECK (entry_path LIKE '/%'),
  CHECK (result_path IS NULL OR result_path LIKE '/%')
);

CREATE INDEX IF NOT EXISTS idx_event_definitions_public
  ON public.event_definitions(is_listed, status, display_order, created_at DESC);

CREATE TABLE IF NOT EXISTS public.event_entry_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event_definitions(id),
  ticket_hash CHAR(64) NOT NULL UNIQUE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  source_session_token_hash CHAR(64),
  return_path TEXT NOT NULL,
  source_path TEXT,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_entry_tickets_event_created
  ON public.event_entry_tickets(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_entry_tickets_expiry
  ON public.event_entry_tickets(expires_at) WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.event_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event_definitions(id),
  entry_ticket_id UUID REFERENCES public.event_entry_tickets(id) ON DELETE SET NULL,
  session_token_hash CHAR(64) NOT NULL UNIQUE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  source_session_token_hash CHAR(64),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_sessions_event_user
  ON public.event_sessions(event_id, user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_sessions_expiry
  ON public.event_sessions(expires_at);

INSERT INTO public.event_definitions (
  event_no, slug, title, description, badge, status, is_listed,
  display_order, event_base_url, local_event_base_url, entry_path, metadata
)
VALUES (
  '1', 'welcome', '모두다담 이벤트 라운지',
  '새로운 이벤트를 가장 먼저 만나는 모두다담의 이벤트 공간입니다.',
  'OPEN', 'active', TRUE, 1, NULL, 'http://localhost:3006',
  '/events/welcome', '{"template":true}'::JSONB
)
ON CONFLICT (event_no) DO NOTHING;

COMMIT;
