-- ============================================================================
-- Push Notifications Setup - Device Token Storage
-- Run this script in Supabase SQL Editor
-- ============================================================================

-- Create table to store device push tokens
CREATE TABLE IF NOT EXISTS user_device_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_token TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'ios' or 'android'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, device_token)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_id ON user_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_token ON user_device_tokens(device_token);

-- Enable RLS
ALTER TABLE user_device_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own device tokens" 
  ON user_device_tokens FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own device tokens" 
  ON user_device_tokens FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own device tokens" 
  ON user_device_tokens FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own device tokens" 
  ON user_device_tokens FOR DELETE 
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_device_token_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_device_token_updated_at
  BEFORE UPDATE ON user_device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_device_token_updated_at();

-- ============================================================================
-- Setup Complete!
-- ============================================================================
-- This table stores device push tokens for sending push notifications
-- Tokens are registered when user logs in and unregistered on logout
-- ============================================================================

