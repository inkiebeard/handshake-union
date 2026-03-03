# AGENTS.md — Handshake Union

## Project Ethos

This is an anonymous developer solidarity platform. Every decision should reinforce these principles:

- **Privacy is non-negotiable.** Never expose individual data. Stats are aggregate-only with sample size guards. Pseudonyms cannot be correlated to real identities. Messages are ephemeral (72-hour TTL). When in doubt, collect less.
- **Information asymmetry is the enemy.** The platform exists to give workers the information employers already have — salary bands, conditions, trends. Collective knowledge is the product.
- **No engagement hacking.** No likes on profiles, no follower counts, no algorithmic feeds, no dark patterns. Just people talking.
- **Open source and auditable.** The code is the trust model. If the privacy claim is wrong, anyone can see exactly where. Licensed AGPL-3.0 so forks stay open.
- **Minimal data posture.** Messages deleted after 72 hours. Moderation reports hard-deleted after 30 days. Only ~80-byte cryptographic receipt hashes persist. Never store what you don't need.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Bulma CSS with custom terminal-aesthetic theme |
| Backend / DB | Supabase (Postgres + Auth + Realtime + Row Level Security) |
| Hosting | Cloudflare Pages (handshakeunion.nexus) |

## Architecture Conventions

### Frontend

- **Functional components only.** No class components.
- **Hooks for state and data.** Custom hooks live in `src/hooks/` (e.g. `useAuth`, `useProfile`, `useStats`, `useMessages`, `useMembers`, `useCustomEmotes`).
- **Contexts for shared state.** `ChatContext` manages chat state + realtime subscriptions. `EmoteContext` provides custom emotes.
- **Types in `src/types/database.ts`.** All DB row types, enums, and moderation types are defined here. Keep them in sync with the Supabase schema.
- **Constants in `src/lib/constants.ts`.** Human-readable labels for all enum values. If you add an enum variant to the DB, add its label here. Also owns `ALLOWED_IMAGE_PROVIDERS` (the authoritative list of permitted image CDN domains) and `ALLOWED_IMAGE_HOSTNAME_RE` (the compiled regex used in `isValidImageUrl()`). Adding a new image provider requires updating this list and creating a migration to update the `messages_image_url_check` DB constraint.
- **Pages in `src/pages/`.** One file per route. Protected routes wrap with `<ProtectedRoute>`.
- **Components colocated by domain.** `components/chat/`, `components/auth/`, `components/layout/`, `components/onboarding/`, `components/stats/`.

### Styling

- **Terminal aesthetic.** Dark theme, monospace fonts, green accent (`--accent: #3fb950`). The UI deliberately looks like a terminal — `$ ` prompts, `# ` comments, ASCII art.
- **CSS variables in `src/index.css`.** All colors use CSS custom properties (`--bg`, `--bg-surface`, `--border`, `--text`, `--accent`, etc.). Never hardcode colors.
- **Bulma for layout, custom CSS for everything else.** Bulma provides grid/columns/responsive utilities. All component-specific styles are in `index.css` with BEM-ish class names (e.g. `chat-message-author`, `chat-reaction-badge`).
- **No CSS modules, no CSS-in-JS.** Plain CSS only.

### Database & Backend

- **Supabase is the entire backend.** No custom API server. Auth, Postgres, Realtime, and RLS handle everything.
- **Row Level Security enforces access control.** Profiles are own-row-only reads. Messages are authenticated-read, own-write. Receipts deny ALL for authenticated users. Never bypass RLS from the frontend.
- **Aggregate functions for stats.** Individual profile data is never exposed. All stats go through `get_salary_distribution()`, `get_role_distribution()`, etc.
- **Migrations are sequential and numbered.** `supabase/migrations/001_*.sql` through `027_*.sql`. New migrations continue the sequence.
- **Consolidate migrations by feature, not by change.** Group all related schema changes (constraints, policies, triggers, indexes, grants) for a single feature into one migration file. Do not create a new migration file for each incremental fix or follow-up to an unrun migration — amend the existing file instead. Only create a separate migration when: (a) the user explicitly requests it, (b) migrations have already been run against a live/staging database, or (c) the user provides explicit context that separate files are needed.
- **All DB functions use `SET search_path = ''`.** This is a security requirement — prevents search path injection.
- **Three-tier RBAC.** `member` (default) / `moderator` / `admin` via JWT `app_metadata` claims. Check with `is_moderator()` / `is_admin()` in RLS policies.
- **Cryptographic receipts are system-level only.** `message_receipts` are invisible to all user-facing roles. They exist for tamper-evident moderation, not for display.

### Auth

- **Magic link only (production).** No passwords, no OAuth providers. Supabase Auth handles everything. The one exception is a dev-build-only anonymous sign-in path in `Login.tsx` gated behind `import.meta.env.DEV` — it is dead-code-eliminated from production bundles and must never be exposed in a production build.
- **Pseudonyms auto-generated on signup** via `handle_new_user()` trigger. Format: `prefix_hexsuffix` (e.g. `worker_a7f3b2`).
- **Roles assigned on signup.** Default role is `member`, set in `app_metadata`.
- **Cloudflare Turnstile on login only.** `@marsidev/react-turnstile` renders the widget in `Login.tsx`. The resolved token is passed to `signInWithOtp` via `options.captchaToken`. Turnstile is **not** used on any other page or flow — not on onboarding, not in chat, not in profile. Do not add it elsewhere. Site key in `VITE_TURNSTILE_SITE_KEY`; secret key lives in Supabase Auth settings only (never in frontend code).

## Code Style

- TypeScript strict mode. No `any` unless absolutely necessary.
- Named exports for components and hooks (e.g. `export function Home()`, `export function useAuth()`).
- Prefer `interface` for object shapes, `type` for unions and aliases.
- Minimal comments — code should be self-explanatory. Comments only for non-obvious intent or security constraints.
- No third-party analytics, tracking, or telemetry. Ever.

## Security Invariants

These must never be violated:

1. **No individual profile data in API responses.** Stats are aggregate-only via DB functions.
2. **Receipts are never exposed to the frontend.** No types, no queries, no UI. System-level only.
3. **Moderation reports machine-copy content from DB.** Never accept user-provided message content for reports.
4. **Sample size guards on salary data.** n < 30 = data hidden. This protects small-group privacy.
5. **Messages are ephemeral.** 72-hour TTL enforced by pg_cron. Don't add features that persist message content beyond this window (receipts store hashes, not content).
6. **Search path hardened.** Every new DB function must include `SET search_path = ''`.
7. **CDN-allowlisted image URLs.** The `image_url` column enforces both `https://` and an approved-domain CHECK constraint at the DB level. Permitted providers are `ALLOWED_IMAGE_PROVIDERS` in `src/lib/constants.ts`; the compiled regex `ALLOWED_IMAGE_HOSTNAME_RE` is used for client-side validation. Never widen this to bare `https://` — it enables tracking pixels and SSRF.
8. **Turnstile is login-only.** Cloudflare Turnstile is intentionally scoped to `Login.tsx` for bot protection at the authentication gate. Do not add it to any other page or user flow. The Turnstile secret key must never appear in frontend code — it lives exclusively in Supabase Auth settings.

## Working With This Codebase

- **`PLAN.md`** is the source of truth for features, schema, and implementation status. Read it before making significant changes.
- **Migrations are append-only once run.** Never edit a migration that has been applied to any database. If a migration has not yet been run (e.g. it exists only on the current branch and no confirmation of execution has been given), prefer editing it in place over creating an additional file to fix or extend it. When in doubt, ask the user whether migrations have been run before creating new files.
- **The dev server runs on Vite.** `npm run dev` after `nvm use`.
- **Deploy via Cloudflare Pages.** `wrangler.toml` is configured. `npm run build` produces the static output.
- **Environment variables** are in `.env.local` (not committed). See `.env.example` for the shape.
