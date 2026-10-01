-- ============================================================================
-- Airsoft Ops - Script de Banco de Dados Supabase (004_rejoin_controller.sql)
-- Suporte a Autenticação, Proteção de Controle e Reconexão de Criador da Sala
-- ============================================================================

-- 1. Tabela de Sessões de Jogo (game_sessions)
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  join_code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'setup', -- 'setup', 'running', 'finished', 'archived'
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  state_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index para busca rápida por código de sala
CREATE INDEX IF NOT EXISTS idx_game_sessions_join_code ON public.game_sessions(join_code);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created_by ON public.game_sessions(created_by);

-- 2. Tabela de Membros da Sala (game_members)
CREATE TABLE IF NOT EXISTS public.game_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'controller', 'artifact', 'player'
  name TEXT NOT NULL DEFAULT 'Aparelho',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, device_id, role)
);

CREATE INDEX IF NOT EXISTS idx_game_members_session ON public.game_members(session_id);

-- 3. Tabela de Eventos e Ações em Tempo Real (game_events)
CREATE TABLE IF NOT EXISTS public.game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'state_proposal', 'action_request', 'system'
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_events_session ON public.game_events(session_id);

-- Enable Row Level Security
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

-- Politicas RLS Abertas para leitura/gravação em sessões ativas
DROP POLICY IF EXISTS "Public select game_sessions" ON public.game_sessions;
CREATE POLICY "Public select game_sessions" ON public.game_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert game_sessions" ON public.game_sessions;
CREATE POLICY "Public insert game_sessions" ON public.game_sessions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update game_sessions" ON public.game_sessions;
CREATE POLICY "Public update game_sessions" ON public.game_sessions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public select game_members" ON public.game_members;
CREATE POLICY "Public select game_members" ON public.game_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert/update game_members" ON public.game_members;
CREATE POLICY "Public insert/update game_members" ON public.game_members FOR ALL USING (true);

DROP POLICY IF EXISTS "Public all game_events" ON public.game_events;
CREATE POLICY "Public all game_events" ON public.game_events FOR ALL USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_events;

-- 4. Função RPC: Gerar Código Único de 6 Caracteres
CREATE OR REPLACE FUNCTION generate_unique_join_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
  exists_code BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.game_sessions WHERE join_code = result AND status != 'archived') INTO exists_code;
    IF NOT exists_code THEN
      RETURN result;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Função RPC: Criar Nova Sala de Jogo (create_game_session)
CREATE OR REPLACE FUNCTION create_game_session(initial_state JSONB)
RETURNS TABLE (
  session_id UUID,
  join_code TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  new_code TEXT;
  new_session_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  new_code := generate_unique_join_code();

  INSERT INTO public.game_sessions (join_code, created_by, state, status)
  VALUES (new_code, current_user_id, initial_state, 'setup')
  RETURNING id INTO new_session_id;

  RETURN QUERY
  SELECT new_session_id, new_code, current_user_id, now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função RPC: Entrar em Sala de Jogo (join_game)
CREATE OR REPLACE FUNCTION join_game(
  requested_code TEXT,
  requested_device_id TEXT,
  requested_role TEXT,
  requested_name TEXT,
  requested_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  session_id UUID,
  join_code TEXT,
  member_id UUID,
  created_by UUID,
  session_state JSONB,
  is_owner BOOLEAN
) AS $$
DECLARE
  found_session public.game_sessions%ROWTYPE;
  new_member_id UUID;
  current_user_id UUID;
  user_is_owner BOOLEAN := false;
BEGIN
  current_user_id := auth.uid();

  SELECT * INTO found_session
  FROM public.game_sessions
  WHERE join_code = upper(trim(requested_code)) AND status != 'archived'
  ORDER BY created_at DESC
  LIMIT 1;

  IF found_session.id IS NULL THEN
    RAISE EXCEPTION 'Sala não encontrada com o código informado.';
  END IF;

  IF current_user_id IS NOT NULL AND found_session.created_by = current_user_id THEN
    user_is_owner := true;
  END IF;

  -- Se for tentativa de Controle, exige ser o criador da sala
  IF requested_role = 'controller' AND found_session.created_by IS NOT NULL THEN
    IF current_user_id IS NULL OR found_session.created_by != current_user_id THEN
      RAISE EXCEPTION 'Apenas o criador desta sala tem permissão de Controle.';
    END IF;
  END IF;

  INSERT INTO public.game_members (session_id, user_id, device_id, role, name, metadata, status, last_seen)
  VALUES (found_session.id, current_user_id, requested_device_id, requested_role, requested_name, requested_metadata, 'approved', now())
  ON CONFLICT (session_id, device_id, role) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      name = EXCLUDED.name,
      metadata = EXCLUDED.metadata,
      last_seen = now()
  RETURNING id INTO new_member_id;

  RETURN QUERY
  SELECT found_session.id, found_session.join_code, new_member_id, found_session.created_by, found_session.state, user_is_owner;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Função RPC: Atualizar visto por último (touch_game_member)
CREATE OR REPLACE FUNCTION touch_game_member(target_member UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.game_members
  SET last_seen = now()
  WHERE id = target_member;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
