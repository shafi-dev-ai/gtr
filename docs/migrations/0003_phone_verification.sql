-- Phone verification table, policies, indexes, and helper function

-- Table
CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phone_number TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_phone_verification_user_id ON phone_verification_codes(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_verification_pending_phone ON phone_verification_codes(phone_number) WHERE verified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_phone_verification_expires_at ON phone_verification_codes(expires_at);

-- RLS: service-role only
ALTER TABLE phone_verification_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages phone verification codes" ON phone_verification_codes
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to verify code and mark profile as verified (service role only)
CREATE OR REPLACE FUNCTION verify_phone_code(p_user UUID, p_phone TEXT, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec phone_verification_codes;
BEGIN
  -- Restrict to service role calls
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'verify_phone_code: service role only';
  END IF;

  SELECT * INTO v_rec
  FROM phone_verification_codes
  WHERE user_id = p_user
    AND phone_number = p_phone
    AND verified_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_rec.expires_at < now() OR v_rec.attempts >= COALESCE(v_rec.max_attempts, 5) THEN
    RETURN FALSE;
  END IF;

  IF v_rec.code <> p_code THEN
    UPDATE phone_verification_codes
    SET attempts = attempts + 1
    WHERE id = v_rec.id;
    RETURN FALSE;
  END IF;

  -- Success: mark verified and update profile
  UPDATE phone_verification_codes
  SET verified_at = now()
  WHERE id = v_rec.id;

  -- Clear other pending codes for same user/phone
  UPDATE phone_verification_codes
  SET verified_at = now()
  WHERE user_id = p_user
    AND phone_number = p_phone
    AND verified_at IS NULL;

  UPDATE profiles
  SET phone_number = p_phone,
      phone_verified = TRUE,
      updated_at = now()
  WHERE id = p_user;

  RETURN TRUE;
END;
$$;
