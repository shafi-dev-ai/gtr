-- Adds profile_creation_errors table (legacy/debug logging)
-- RLS intentionally left disabled to mirror current project state.

CREATE TABLE IF NOT EXISTS profile_creation_errors (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
