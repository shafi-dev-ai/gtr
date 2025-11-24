# Backend Approach Decision Guide

Purpose: pick the backend shape for GT-R Marketplace (Supabase-based React Native app) when adding push notification fan-out, SMS verification, and scale to millions. This includes project-specific context so implementation can start immediately after you choose.

---

## Project Snapshot (context for all options)

- Stack: Expo/React Native (RN 0.81), Supabase (Postgres + Auth + Storage), RLS on all tables/buckets.
- App features already wired to Supabase: auth (email link recovery), listings/events/forum, favorites/likes, profiles, messaging realtime, notifications data model, data manager/cache/realtime hooks.
- Important files: `src/services/*.ts` (auth, notifications, pushNotifications, messages, realtime, storage), `docs/setup_complete.sql` + `docs/seed_data.sql` (schema/policies/triggers), `docs/PUSH_NOTIFICATIONS_SETUP.md`, `docs/PHONE_VERIFICATION_GUIDE.md`, `PROGRESS_TRACKER.md` (feature log).
- Buckets (per progress log/schema): `avatars`, `listing-images`, `event-images`, `forum-images`, `garage-images`, `message-images`, `community-media`.
- Providers likely: Expo/FCM/APNs for push; Twilio (or similar) for SMS; optional search (Algolia/Meilisearch/Typesense) if we add later.
- Env keys (client already expects): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Service role key must stay server-side (Edge/Node).
- Deep links: `gtr-marketplace://verify-email`, `gtr-marketplace://reset-password`.

---

## Option A: Supabase Edge Functions Only

- What it is: All privileged logic (SMS, push registration, light fan-out, signed URLs, basic rate limits) runs in Supabase Edge Functions. Client CRUD stays direct to Supabase with RLS.
- Strengths: Minimal ops, low latency to Supabase, global edge routing, simple deploy story, least moving parts.
- Limits: Cold starts, runtime constraints (short/CPU-light jobs), weaker observability, not great for large fan-out or heavy SDKs.
- Best for: Short tasks (<10s), small-to-medium fan-outs (hundreds), simple webhooks, per-request validations, early-stage scale.
- Implementation checklist:
  - Functions: `send-sms-otp`, `register-device-token`, `notify-user` (single user/device fan-out), `issue-upload-url`, `rate-limit-middleware`.
  - Secrets: service role key, Twilio creds, Expo/FCM/APNs keys, signing keys for short-lived tokens.
  - Data: job tables for audit (writes still in Postgres), RLS-aware helpers.
  - Observability: structured logs, alerting on error rate/p99, log sampling.
  - Deployment: bundle slim dependencies, keep warm paths hot (no heavy SDKs), enforce timeouts.

---

## Option B: Dedicated Node Service (API + Workers)

- What it is: A Node app (could be split into API + worker) running off Supabase (Postgres + Auth) with service role keys. Client calls go through Node for privileged flows; Supabase still serves as DB and storage.
- Strengths: Full control of runtime, long-running/CPU-heavy tasks allowed, robust queues/retries, rich observability, supports very large fan-out (tens/hundreds of thousands), easier to co-host search/Redis.
- Limits: Higher ops overhead, you manage scaling, security surface, deploys, and secrets. Slightly more latency unless region-co-located.
- Best for: Massive fan-out, heavy third-party SDKs, custom rate limiting/abuse prevention, scheduled jobs, complex business logic you don’t want in the client.
- Implementation checklist:
  - Services: REST/GraphQL endpoints for SMS, notification fan-out, admin/reporting, signed uploads, search index feeds.
  - Workers/Queue: BullMQ or equivalent on Redis; DLQ; back-pressure; exponential retries; idempotency keys.
  - Storage/Infra: Redis (rate limits, queues, caches), optional object cache/CDN for derived assets, scheduler (cron or platform scheduler).
  - Security: service role isolation, mTLS/allowlists, API keys/JWT validation, per-IP/UID rate limits.
  - Observability: metrics (Prometheus/OpenTelemetry), tracing, structured logs, alerting (SLOs on p95/p99, error budgets).
  - Deployment: region near Supabase DB, blue/green deploys, health checks, autoscaling rules, secrets manager.

---

## Option C: Hybrid (Recommended Path)

- What it is: Keep client → Supabase for CRUD. Use Edge Functions for latency-sensitive, short, privileged actions. Add a small Node worker/service for heavy/batch work and queues.
- Strengths: Low latency on the fast path, minimal ops for light tasks, robustness for heavy fan-out and retries, gradual path to scale.
- Limits: Two runtimes to observe/deploy. Requires clear ownership boundaries to avoid duplication.
- Best for: You want “fast everywhere” plus durability at scale without overbuilding early.
- Implementation checklist:
  - Edge Functions: OTP/SMS send, single-user/device notifications, signed upload URLs, light rate limiting/abuse checks, webhook validators, presigned download links.
  - Node Worker/Service: High-volume push/SMS fan-out, batch digests, cleanup jobs, search index feeding, media processing, long-running tasks, queue consumers.
  - Queue: Redis + BullMQ (or PG-based job table) with DLQ and metrics; edge enqueues, worker consumes.
  - Routing rules: UI → Supabase for CRUD; UI → Edge for short privileged calls; Edge → queue for heavy jobs; Worker → providers (FCM/APNs/Expo, Twilio, email, search).
  - Observability: shared log/trace IDs across edge + worker; alerts on queue lag, failure rate, push/SMS success, p95/p99 latencies.
  - Security: service role scoped to functions/services; per-user/IP limits at edge; HMAC for webhooks; secrets in platform vaults.
  - Deployment: co-locate Node with Supabase region; edge auto-scales; worker autoscaling based on queue depth.

---

## Decision Guardrails

- Choose Edge-only if: jobs are short and light, fan-out is small, ops headcount is minimal, and you can accept occasional cold starts.
- Choose Node-only if: you want one runtime, you need heavy/long tasks, and you’re willing to own infra/observability from day one.
- Choose Hybrid if: you want low-latency edges plus durable heavy lifting and expect large notification/SMS volumes.

---

## Shared Baseline (all options)

- Supabase remains the source of truth (Postgres + Storage + RLS).
- Keep anon key in clients; service role key only in Edge/Node.
- Centralize schemas/migrations in `docs/setup_complete.sql`; keep RLS strict.
- Use idempotency keys for writes and fan-out jobs; log correlation IDs end to end.
- Provider setup: Expo/FCM/APNs for push; Twilio (or alt) for SMS; ensure sandbox vs prod separation.
- Performance: prefer push to queue for anything above a few hundred recipients; cache derived data where possible.
- Data model reminders: notifications table with `is_read/read_at`; messaging tables (conversations/messages) already realtime-enabled; favorites/likes tables with triggers for counts; event/listing images tables with `display_order/is_primary`.
- Client expectations: push token registration endpoint, SMS OTP endpoint, signed upload URLs for media, consistent casing/keys with existing TypeScript services.

---

## Rollout Plan When You Pick One

1) Confirm option (Edge-only, Node-only, Hybrid) and primary region.  
2) Wire secrets and env contracts (service role key, Twilio, push keys).  
3) Stand up the minimum skeleton (functions/services + queue if needed).  
4) Add observability (logs, metrics, alerts) before shipping high-volume flows.  
5) Load-test push/SMS paths with realistic volumes; tune retries/back-pressure.  
6) Ship behind feature flags; gradually ramp traffic; watch p95/p99 and failure rates.  

---

## Quick Implementation Seeds (per option)

- Edge-only starter functions: `send-sms-otp` (Twilio), `register-device-token`, `notify-user` (single-user fan-out), `issue-upload-url`, `rate-limit` middleware.
- Node-only starter services: `/sms/send-otp`, `/push/fanout`, `/upload/sign`, `/admin/audit`, webhook receivers; worker: queue consumer for push/SMS, digests, cleanup, search feed.
- Hybrid starter split: Edge handles OTP/send + single-user notify + signing URLs; Edge enqueues heavy jobs; Node worker consumes queue for bulk push/SMS, digests, cleanups, search feed, and retries.
