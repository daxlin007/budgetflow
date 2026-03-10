-- ╔══════════════════════════════════════════════════════════════╗
-- ║  BUDGETFLOW — Chat Persistence Tables                        ║
-- ║                                                              ║
-- ║  Run this in Supabase SQL Editor:                            ║
-- ║  Dashboard → SQL Editor → New Query → Paste & Run            ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ─── CHAT SESSIONS ──────────────────────────────────────────────
-- Stores individual chat session metadata
CREATE TABLE public.chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Chat',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── CHAT MESSAGES ──────────────────────────────────────────────
-- Stores messages within each chat session
CREATE TABLE public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  type TEXT CHECK (type IN ('transaction', 'chat', 'error')),
  text TEXT,
  items JSONB,  -- For transaction items
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── INDEXES ────────────────────────────────────────────────────
CREATE INDEX idx_chat_sessions_user ON public.chat_sessions(user_id, updated_at DESC);
CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id, created_at ASC);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat Sessions: users can view, create, update, delete their own
CREATE POLICY "Users can view own chat sessions"
  ON public.chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions"
  ON public.chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions"
  ON public.chat_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions"
  ON public.chat_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Chat Messages: users can view and insert their own
CREATE POLICY "Users can view own chat messages"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat messages"
  ON public.chat_messages FOR DELETE
  USING (auth.uid() = user_id);
