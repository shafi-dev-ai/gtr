# Local Development Setup

These instructions let any developer run the app against a local Supabase stack (DB + auth + storage) without touching shared environments.

## Prerequisites
- Docker Desktop running
- Supabase CLI installed (macOS: `brew install supabase/tap/supabase`; others: see supabase.com/docs/guides/cli)
- Node/Yarn/React Native tooling already set up for the app

## One-time setup
1) Start the local Supabase stack (from repo root):  
   `supabase start`  
   - First run downloads images and creates `.supabase/` with local credentials (`.supabase/.env`).  
   - Re-run later to bring services back up if they’re stopped.

2) Apply migrations to the local DB (idempotent):  
   - The CLI uses `supabase/migrations/` by default (our `0001_*.sql`, `0002_*.sql`, etc. live there).  
   - Clean reset (recommended): `supabase db reset --local`  
   - Or just apply without wiping: `supabase db push --local`

3) Point the app to the local stack:  
   - Manual env (recommended): copy `.env.example` to `.env` (or `.env.local`) in the repo root, then replace placeholders with the values printed by `supabase start` (Publishable/Secret keys, URLs, DB URL).  
   - Ensure your React Native config reads from the root `.env` (e.g., `react-native-config`).  
   - Key vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.

4) Run the app as usual (iOS/Android/web). It now talks to local Supabase.

5) Create required storage buckets (after `supabase start`). The current CLI doesn’t expose create-bucket, so connect with psql using the local DB URL from `.supabase/.env` (e.g., `psql "$SUPABASE_DB_URL"`) and run:  
   ```sql
   -- 10MB image-only buckets
   INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
     ('listing-images', 'listing-images', true, 10485760, ARRAY['image/*']),
     ('avatars', 'avatars', true, 10485760, ARRAY['image/*']),
     ('forum-images', 'forum-images', true, 10485760, ARRAY['image/*']),
     ('garage-images', 'garage-images', true, 10485760, ARRAY['image/*']),
     ('event-images', 'event-images', true, 10485760, ARRAY['image/*']),
     ('message-images', 'message-images', false, 10485760, ARRAY['image/*']);

   -- 50MB, any mime
   INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES
     ('community-media', 'community-media', true, 52428800);
   ```
   If a bucket already exists you’ll get a duplicate key error; skip that one.

## Daily workflow
- Start services: `supabase start`
- After pulling changes, refresh DB: `supabase db reset --local` (wipes local DB, reapplies migrations)
- Run the app with env pointing to `.supabase/.env`
- Stop services if needed: `supabase stop` (data persists in Docker volumes)

## Optional: push to your personal hosted Supabase
- Login once: `supabase login` (uses your access token)
- Set your project ref: `export SUPABASE_PROJECT_REF=<your-project-ref>`
- Push migrations: `supabase db push --project-ref $SUPABASE_PROJECT_REF`
- Use that project’s URL/keys instead of `.supabase/.env` if you want to test against your sandbox

## Notes on auth/email/storage
- Email confirmation/magic links: the local stack won’t send real email unless you configure SMTP. For quick dev, set GoTrue to auto-confirm or point it to a local mail catcher (Mailhog/Mailpit).
- OAuth: requires provider redirect URLs pointing at your local app.
- Storage: buckets/files live in Docker volumes. Create buckets locally via `supabase storage create-bucket <name> --public` or through your app using the local service role key.
