# Notification Preferences and Per-Forum Mutes (Plan and SQL)

This document outlines the end-to-end steps to add user-controllable notification settings to the app (global preferences, per-forum mute), and how to wire them into notification creation/dispatch. Seed data is not touched.

## Scope
- Global notification preferences stored per user (push toggles for comments, replies, messages, events, likes, marketing, etc.).
- Per-forum (per post) mute to silence a thread for a specific user.
- Default preference rows created on signup.
- Server-side gating: notifications are only created/dispatched if the user’s preference + thread mute allow it.
- Frontend: a Notification Preferences screen with toggles (auto-save) and a per-thread mute toggle in forum detail.

## Database Changes (Supabase SQL)
Run in Supabase SQL editor (adjust field set if you want fewer/more toggles).

```sql
-- 1) Global notification preferences per user
create table if not exists notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_general boolean not null default true,
  push_messages boolean not null default true,
  push_comments boolean not null default true,
  push_replies boolean not null default true,
  push_events boolean not null default true,
  push_likes boolean not null default true,
  email_news boolean not null default false,
  email_updates boolean not null default true,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- RLS
alter table notification_preferences enable row level security;
create policy "Users can view their prefs"
  on notification_preferences for select using (auth.uid() = user_id);
create policy "Users can insert their prefs"
  on notification_preferences for insert with check (auth.uid() = user_id);
create policy "Users can update their prefs"
  on notification_preferences for update using (auth.uid() = user_id);

-- Default row on signup
create or replace function public.handle_new_user_notification_prefs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_prefs on auth.users;
create trigger on_auth_user_created_prefs
after insert on auth.users
for each row execute function public.handle_new_user_notification_prefs();

create index if not exists idx_notification_preferences_user_id on notification_preferences(user_id);

-- 2) Per-forum (post) mute
create table if not exists forum_notification_mutes (
  user_id uuid references auth.users(id) on delete cascade,
  post_id uuid references forum_posts(id) on delete cascade,
  muted boolean not null default true,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);

alter table forum_notification_mutes enable row level security;
create policy "Users manage their mutes" on forum_notification_mutes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_forum_notification_mutes_user_post on forum_notification_mutes(user_id, post_id);
```

## Server-Side Notification Gating (Required)
Wherever you create notifications (DB insert + push dispatch), gate on preferences and mutes:

- For a **comment** on a forum post:
  - Notify post author if `author != commenter`
    - `notification_preferences.push_comments = true`
    - No mute in `forum_notification_mutes` for `(author, post_id)`
  - Then create DB notification + push payload only if allowed.

- For a **reply** (comment with `parent_comment_id`):
  - Notify parent comment author (if not replier) if:
    - `push_replies = true`
    - No mute for `(parent_author, post_id)`
  - Optionally also notify post author (if different) if:
    - `push_replies = true`
    - No mute for `(post_author, post_id)`

- For **messages, likes, events, etc.**: add similar pref checks (`push_messages`, `push_likes`, `push_events`, etc.) before creating notifications/pushes.

- If a check fails, skip both DB notification creation and push dispatch (so “off” users truly don’t get notified).

## Frontend Implementation Plan

### 1) Notification Preferences Screen
- Route from Profile > “Notification Preferences”.
- Use `useDataFetch` to GET `notification_preferences` (defaults exist via signup trigger).
- Auto-save toggles on change via UPSERT to `notification_preferences` (optimistic update; show error toast on failure).
- Suggested toggles:
  - Push: General, Messages, Comments, Replies, Events, Likes
  - Email: News, Product updates
- Invalidate caches: `dataManager.invalidateCache(/^notification:prefs/)` after save.

### 2) Per-Forum Mute Toggle
- In `ForumDetailScreen`, add a “Mute this thread” toggle.
- Store in `forum_notification_mutes` (insert/update). Remove entry or set `muted=false` to unmute.
- Use `useDataFetch` to read the mute state for the current post/user.
- Apply optimistic UI when toggling, handle errors gracefully.

### 3) Services
- Add `notificationPreferencesService`:
  - `getMyPreferences()`
  - `upsertMyPreferences(partialPrefs)`
- Add `forumNotificationMutesService`:
  - `getMuteState(postId)`
  - `setMuteState(postId, muted: boolean)`

### 4) Push Dispatch Integration
- In server/cloud functions or backend code that sends push:
  - Fetch `notification_preferences` for target user.
  - Check `forum_notification_mutes` for `(user, postId)` if applicable.
  - Short-circuit if not allowed; otherwise send push and insert DB notification.

### 5) Defaults / UX
- Defaults come from the signup trigger (all push toggles true, email news false, email updates true).
- Show a brief “Saved” toast on toggle change; disable switch while saving to avoid spam.
- Consider “master mute” per post (already covered with mute toggle) and optional global pause (not included above; add a `push_paused` boolean if needed).

## Notes
- Seed data remains unchanged (by request).
- If you later want to scope more types (e.g., “forum likes”, “event reminders”), add columns to `notification_preferences` and handle them in dispatch.
- Ensure backend branches for comment/reply notifications are updated; otherwise toggles won’t have any effect.***
