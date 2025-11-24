# Migrations Guide

This folder tracks database changes for GT-R Marketplace. The baseline is `0001_initial.sql`, copied from `docs/setup_complete.sql` (tables, RLS policies, triggers, functions, realtime publication membership).

## How to apply migrations to a fresh Supabase project

1) In Supabase SQL Editor, run `docs/migrations/0001_initial.sql`.  
2) Create storage buckets manually (per project docs): `avatars`, `listing-images`, `event-images`, `forum-images`, `garage-images`, `message-images`, `community-media`.  
3) (Optional) Seed data: run `docs/seed_data.sql`.

## How to manage new changes

- Add a new file per change: `docs/migrations/0002_<description>.sql`, `0003_<description>.sql`, etc. Do **not** edit `0001_initial.sql`; keep it as the snapshot baseline.
- Keep `docs/setup_complete.sql` and `0001_initial.sql` in sync. If you update the baseline, recopy it: `cp docs/setup_complete.sql docs/migrations/0001_initial.sql`.
- Order of application for any environment: run `0001_initial.sql`, then each subsequent migration in numeric order, then optional seeds.

## Using Supabase CLI (optional)

1) Install Supabase CLI and link your project (`supabase init`, set `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD`).  
2) Create a new migration scaffold: `supabase migration new <name>` and paste your SQL.  
3) Apply to the linked project: `supabase db push` (dev) or run SQL files directly for staging/prod.  
4) For a schema dump to compare with the baseline: `supabase db dump --schema public --file schema.sql --include-roles --include-policies`.

## What’s included in 0001_initial

- Tables for auth-backed profiles, listings/events/forum, messaging, notifications, favorites/likes, saved searches, media galleries, model specs, etc.  
- RLS policies for all tables and storage buckets (must be enabled in Supabase Storage UI).  
- Triggers/functions for counts, search vectors, and cache-friendly denormalizations.  
- Realtime publication membership for the tables used by the app.  

## Current incremental migrations

- `0002_add_profile_creation_errors.sql`: adds `profile_creation_errors` (legacy/debug logging, RLS off to match current project).
- `0003_phone_verification.sql`: adds `phone_verification_codes` (service-role-only), indexes, RLS, and `verify_phone_code` helper to mark `profiles.phone_verified` true.
