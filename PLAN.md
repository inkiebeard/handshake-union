# Handshake Union — Project Plan

> handshakeunion.nexus
>
> Anonymous community platform for developers to share workplace intel and build collective power.
> A refuge for devs being squeezed by AI hype and corporate individualism. Humans verifying humans.

## Project Goals

**Primary Goal:** Prove there's appetite for an anonymous developer solidarity platform.

**Success Metrics for POC:**
- Can we get 20+ people to sign up and share basic work info?
- Do conversations actually happen organically?
- Does the salary/conditions data start to show interesting patterns?

## Coverage Status

> Last updated: 2026-03-20

All six original MVP feature areas are built plus a full moderation and admin portal. Five of six implementation phases are complete, with a seventh phase added for the portal. Phase 6 (Polish & Deploy) is in-flight — partial error handling and loading states exist, deployment config is live on Cloudflare Pages, but a formal test round and README polish remain.

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ✅ Complete | Magic link only |
| Live Chat Rooms | ✅ Complete | All 3 rooms, realtime, reactions, custom emotes, image attachments, link sharing with OG preview |
| Onboarding Form | ✅ Complete | All fields, skip option, reusable in profile mode |
| Stats Dashboard | ✅ Complete | SVG chart, distribution bars, sample size guards, baselines |
| Chat Integrity & Moderation | ✅ Complete | Receipts, reports, RBAC, rate limiting |
| Role-Based Access Control | ✅ Complete | member/moderator/admin via JWT claims |
| Moderation & Admin Portal | ✅ Complete | `/mod` queue + bans (moderator+), `/admin` overview + charts + roles (admin) |
| Polish & Deploy | 🔲 In Progress | Error handling partial, Cloudflare deployed, test round pending |

**Post-plan additions (scope expansions):**
- Profile page + pseudonym rename (Phase 3.5)
- PixelAvatar component (deterministic 5×5 pixel art)
- Profile history snapshots (trend data source)
- Privacy lockdown + aggregate-only stats access (Phase 3.5)
- Chat integrity, receipts, moderation infrastructure (Phase 3.75)
- Image URL attachments with blur/reveal mode (Feb 2026)
- Members directory page with public stats
- Cloudflare Pages deployment config
- Message retention extended to 72 hours (Feb 2026)
- Cursor-based chat pagination — 50 messages per page, scroll-to-top loads older history (Feb 2026)
- Link sharing with Open Graph preview cards — optional HTTPS URL per message, OG/Twitter Card metadata fetched server-side via Supabase Edge Function (Mar 2026)
- Moderation & Admin portal — `/mod` + `/admin` role-gated dashboards, user ban system (Mar 2026)

---

## Core Features (MVP)

### 1. Authentication
- **Magic link login** (email-based, no passwords)
- **No passwords** — reduces friction and security burden
- **MFA built-in** — Supabase handles this via email confirmation
- **Pseudonymous accounts** — auto-generated pseudonyms like `worker_a7f3b2`
- **Bot protection** — Cloudflare Turnstile on the login page only; token verified server-side by Supabase before a magic link is issued

### 2. Live Chat Rooms
Three rooms to start:
- **#general** — main discussion
- **#memes** — shitposting, levity
- **#whinge** — venting about work (cathartic, validates experience)

**Chat Features:**
- 72 hour message history max (ephemeral by design, cleanup via pg_cron)
- Cursor-based pagination — loads most recent 50 messages on join, user scrolls to top to load older pages. Scroll position preserved when older messages are prepended.
- Basic threading/replies (reply_to_id with visual indicator)
- Emoji reactions (toggle on/off, picker UI)
- Custom emotes via `:shortcode:` syntax (admin-managed)
- Emoji autocomplete while typing
- Shows pseudonym + PixelAvatar, not real identity
- Real-time via Supabase broadcast triggers (new messages appended live regardless of pagination state)
- Message reporting (rate-limited, machine-copies content)
- Delete own messages
- Link sharing — optional HTTPS URL per message, renders as an Open Graph preview card (title, description, thumbnail) fetched server-side via `og-preview` Edge Function; falls back to Twitter Card tags; skeleton loading state with 30 s client-side timeout
  - URLs typed inline in the message body are auto-detected and extracted into `link_url` (trailing punctuation stripped); the preview card appears automatically — no 🔗 button required
  - The 🔗 button provides an alternative manual-entry path for links that aren't in the message text
  - More than one distinct `https://` URL (across text and manual link bar combined) is an error: send is blocked and an inline warning prompts the user to split into separate messages

### 3. Onboarding Form
Collect structured data (all optional, but encouraged):

| Field | Type | Options |
|-------|------|---------|
| Salary Band | Select | <$60k, $60-80k, $80-100k, $100-120k, $120-150k, $150-180k, $180-220k, $220k+, Prefer not to say |
| Role Title | Select | Junior Dev, Mid Dev, Senior Dev, Lead, Staff Engineer, Principal, EM, Director, VP, CTO, DevOps/SRE, Data Engineer, ML Engineer, QA, Security, Mobile, Frontend, Backend, Fullstack, Other |
| Experience | Select | Student, 0-1 years, 1-3 years, 3-5 years, 5-10 years, 10-15 years, 15+ years |
| Employment Type | Select | Full-time permanent, Full-time contract, Part-time, Casual, Contractor (ABN), Freelance, Unemployed, Student |
| WFH Status | Select | Full remote, Hybrid (mostly remote), Hybrid (mostly office), Full office, Flexible |
| Country | Select | Australia, New Zealand, Other |
| Requires Visa | Checkbox | Yes/No (deliberately vague to avoid legal complexity) |

### 4. Stats Dashboard
- Aggregate view of community data with privacy-preserving sample size guards
- Interactive SVG salary progression chart (experience vs salary)
- Industry baseline comparison with toggle-able role overlays
- Community data overlay (solid white line) vs industry baselines (dotted colored lines)
- Distribution bar charts: salary, experience, role, WFH, employment type
- Confidence indicators based on sample size (n≥30 minimum, n≥50 moderate, n≥100 good)
- Salary data hidden until sufficient sample size to protect privacy

### 5. Chat Integrity & Moderation
- **Cryptographic receipts** — SHA-256 hash of every message stored automatically via trigger. No readable content, no author identity. System-level only (admin access).
- **Live moderation reports** — users can report messages while they still exist (within the 72-hour retention window). Content is machine-copied from DB (never user-provided). Linked to receipt for tamper-evident verification.
- **30-day report TTL** — moderation reports hard-deleted after 30 days. Receipts persist indefinitely (~80 bytes each).
- **Retrospective submissions** (future) — separate form for reporting after message TTL. User-provided content verified against receipt hashes. Lower trust level.

### 6. Role-Based Access Control
Three-tier system via JWT `app_metadata` claims:

| Role | Default? | Access |
|------|----------|--------|
| `member` | Yes (set on signup) | Chat, own profile, report messages, view stats |
| `moderator` | No (assigned by admin) | + View/resolve moderation reports, issue/lift bans |
| `admin` | No (assigned by admin) | + Verify receipts, assign roles, platform health dashboard |

- `service_role` key bypasses RLS entirely (automated processes only)
- Roles checked via `is_moderator()` / `is_admin()` helper functions in RLS policies
- Receipts invisible to all human roles — only accessible via admin `verify_message_receipt()` function
- First admin must be bootstrapped directly via Supabase SQL editor (update `raw_app_meta_data`); all subsequent role changes go through the `/admin` portal

### 7. Moderation & Admin Portal

**Moderation Portal (`/mod` — moderator+):**
- Moderation queue showing all reports with status filter tabs (pending / reviewed / actioned / dismissed / all)
- Each report card displays: message text, images rendered inline, link preview cards (via `LinkPreview`), reporter + author pseudonyms, room, reason, timestamp
- One-click resolve actions: reviewed, actioned, dismiss — with optional resolution notes field
- Inline "ban author" form on each pending report — issue a timeout (hours, requires `expires_at`) or permanent ban with optional reason, without leaving the queue
- Active bans tab showing all unexpired/unlifted bans; lift-ban button on each entry
- Pending count badge on queue tab; active ban count badge on bans tab

**Admin Portal (`/admin` — admin only):**
- Platform overview cards: total members, active sessions (live count from `auth.sessions`), pending reports, active bans, messages in last 24 h (from receipts)
- Activity charts — SVG bar charts (terminal aesthetic, no external charting library) for login activity (unique logins/day from `auth.audit_log_entries`) and message activity (messages/day from `message_receipts`), configurable 7 / 14 / 30 / 90 day windows
- Role management table — search all users by pseudonym; inline role dropdown (member / moderator / admin) with apply button; sorted by role seniority then join date

**`RoleRoute` component** — extends `ProtectedRoute`: reads `user.app_metadata.role` from the Supabase JWT, redirects unauthorized users to `/` with no error exposure

**Navbar** — `/mod` link shown in warning colour to moderator+; `/admin` link shown in red to admins only; both invisible to members

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | React 18 + TypeScript | Familiar, fast iteration |
| Styling | Bulma CSS | Clean, simple, no build step |
| Routing | React Router | Standard, simple |
| Backend/DB | Supabase | Auth, Postgres, Realtime, Row Level Security |
| Hosting (Frontend) | Cloudflare Pages | Free tier, easy deploys, deployed to handshakeunion.nexus |
| Hosting (Backend) | Supabase Free Tier → Self-hosted | Start free, migrate when needed |
| Auth | Supabase Auth | Magic links, MFA built-in |

---

## Project Structure

```
handshake-union/
├── public/
│   ├── handshake-union-logo.png
│   └── handshake-union-logo-transparent.png
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── RoleRoute.tsx           # role-gated route (moderator+ or admin-only)
│   │   ├── chat/
│   │   │   ├── EmojiAutocomplete.tsx    # :emoji: autocomplete dropdown
│   │   │   ├── GiphyPicker.tsx          # Giphy GIF search and insertion
│   │   │   ├── LinkPreview.tsx          # OG preview card with skeleton loading + timeout
│   │   │   ├── Message.tsx              # single message with reactions + image + link preview
│   │   │   ├── MessageErrorBoundary.tsx # per-message error boundary
│   │   │   ├── MessageInput.tsx         # input with emoji autocomplete + Giphy + link
│   │   │   ├── MessageList.tsx          # paginated scrollable message container
│   │   │   └── ReactionPicker.tsx       # emoji picker for reactions
│   │   ├── layout/
│   │   │   ├── Footer.tsx
│   │   │   ├── Layout.tsx
│   │   │   └── Navbar.tsx
│   │   ├── onboarding/
│   │   │   └── OnboardingForm.tsx      # reusable in onboarding + profile modes
│   │   ├── stats/                      # directory reserved; stat components are
│   │   │                               # defined inline in pages/Stats.tsx:
│   │   │                               #   SalaryProgressionChart — SVG chart
│   │   │                               #   BarChart — distribution bar chart
│   │   │                               #   GuardedBarChart — BarChart + sample guard
│   │   │                               #   SampleSizeGuard — privacy threshold guard
│   │   └── PixelAvatar.tsx             # deterministic 5×5 pixel art avatars
│   ├── contexts/
│   │   ├── ChatContext.tsx             # chat state, pagination, reactions, realtime
│   │   └── EmoteContext.tsx            # custom emote provider
│   ├── hooks/
│   │   ├── useAdminStats.ts            # platform overview + activity charts + user roles (admin)
│   │   ├── useAuth.ts
│   │   ├── useCustomEmotes.ts          # custom emote fetching
│   │   ├── useImageDisplayMode.ts      # per-session blur/reveal toggle state
│   │   ├── useMembers.ts               # public member directory stats
│   │   ├── useModerationReports.ts     # mod queue + bans + resolve/ban/lift actions
│   │   ├── useProfile.ts
│   │   ├── useReactionHistory.ts       # persists recent emoji reactions to localStorage
│   │   └── useStats.ts                 # aggregate stats + baselines + utilities
│   ├── lib/
│   │   ├── constants.ts
│   │   ├── emoji.tsx                   # emoji rendering utilities
│   │   └── supabase.ts
│   ├── pages/
│   │   ├── Admin.tsx                   # admin portal: overview cards, activity charts, role mgmt
│   │   ├── AuthCallback.tsx
│   │   ├── Chat.tsx                    # full chat with rooms + realtime
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── Members.tsx                 # public member directory
│   │   ├── Mod.tsx                     # mod portal: report queue + active bans
│   │   ├── Onboarding.tsx
│   │   ├── Privacy.tsx                 # privacy policy page
│   │   ├── Profile.tsx
│   │   └── Stats.tsx                   # full stats dashboard with charts
│   ├── types/
│   │   └── database.ts
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   └── og-preview/
│   │       └── index.ts                 # Edge Function: fetch OG/Twitter Card metadata server-side
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_varied_pseudonyms.sql
│       ├── 003_fix_search_path.sql
│       ├── 004_profile_history.sql
│       ├── 005_privacy_lockdown.sql
│       ├── 006_chat_integrity.sql
│       ├── 007_roles.sql
│       ├── 008_fix_snapshot_triggers.sql
│       ├── 009_fix_digest_search_path.sql
│       ├── 010_fix_digest_extensions_schema.sql
│       ├── 011_broadcast_triggers.sql
│       ├── 012_fix_reactions_broadcast.sql
│       ├── 013_custom_emotes.sql
│       ├── 014_seed_baseline_stats.sql
│       ├── 015_enable_cron_cleanup.sql
│       ├── 016_public_member_stats.sql
│       ├── 017_messages_image_url.sql
│       ├── 018_image_url_integrity.sql
│       ├── 019_fix_digest_search_path.sql
│       ├── 020_fix_receipt_hash_separator.sql
│       ├── 021_fix_verify_functions_hash.sql
│       ├── 022_update_message_retention_6h.sql
│       ├── 023_update_message_retention_72h.sql
│       ├── 024_image_url_domain_allowlist.sql
│       ├── 025_access_control_hardening.sql
│       ├── 026_message_rate_limit.sql
│       ├── 027_pseudonym_oracle_guard.sql
│       ├── 028_messages_link_url.sql
│       ├── 029_fix_link_url_receipt_hash.sql
│       ├── 030_verify_authenticity_link_url.sql
│       ├── 031_legacy_hash_fallback_and_link_url_dedup.sql
│       ├── 032_mod_admin_portal.sql
│       ├── 033_fix_resolve_report.sql
│       ├── 034_ban_auth_integration.sql
│       ├── 035_ban_enforcement.sql
│       └── 036_fix_ban_and_report_hash.sql
├── public/
│   ├── _headers                            # Cloudflare Pages security headers (CSP etc.)
│   ├── handshake-union-logo.png
│   └── handshake-union-logo-transparent.png
├── .env.example
├── .gitignore
├── AGENTS.md
├── eslint.config.js
├── index.html
├── LICENSE (AGPL-3.0)
├── package.json
├── PLAN.md
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── wrangler.toml
```

---

## Database Schema

**Migrations:**
```
001_initial_schema → 002_varied_pseudonyms → 003_fix_search_path → 004_profile_history →
005_privacy_lockdown → 006_chat_integrity → 007_roles → 008_fix_snapshot_triggers →
009_fix_digest_search_path → 010_fix_digest_extensions_schema → 011_broadcast_triggers →
012_fix_reactions_broadcast → 013_custom_emotes → 014_seed_baseline_stats →
015_enable_cron_cleanup → 016_public_member_stats → 017_messages_image_url →
018_image_url_integrity → 019_fix_digest_search_path → 020_fix_receipt_hash_separator →
021_fix_verify_functions_hash → 022_update_message_retention_6h →
023_update_message_retention_72h → 024_image_url_domain_allowlist →
025_access_control_hardening → 026_message_rate_limit →
027_pseudonym_oracle_guard → 028_messages_link_url → 029_fix_link_url_receipt_hash →
030_verify_authenticity_link_url → 031_legacy_hash_fallback_and_link_url_dedup →
032_mod_admin_portal → 033_fix_resolve_report → 034_ban_auth_integration →
035_ban_enforcement → 036_fix_ban_and_report_hash
```

### Tables

**profiles**
```sql
- id: uuid (FK to auth.users)
- pseudonym: text (unique, auto-generated)
- created_at: timestamp
- updated_at: timestamp
- onboarding_complete: boolean
- message_count: integer (lifetime messages sent)
- salary_band: enum (nullable)
- experience_band: enum (nullable)
- employment_type: enum (nullable)
- wfh_status: enum (nullable)
- role_title: enum (nullable)
- country: text (nullable, CHECK: 'Australia' | 'New Zealand' | 'Other' — migration 026)
- requires_visa: boolean (nullable)
```

**messages**
```sql
- id: uuid
- room: enum ('general', 'memes', 'whinge')
- profile_id: uuid (FK to profiles)
- content: text (max 2000 chars, nullable — at least one of content/image_url/link_url required)
- image_url: text (nullable, max 2048 chars — CDN allowlist CHECK constraint, migration 024)
- link_url: text (nullable, max 2048 chars — https:// required, no domain allowlist; OG preview fetched server-side, migration 028)
- created_at: timestamp
- reply_to_id: uuid (nullable, FK to messages)
- rate limit: max 10 inserts per 60 seconds per profile_id (BEFORE INSERT trigger, migration 026)
```

**reactions**
```sql
- id: uuid
- message_id: uuid (FK to messages)
- profile_id: uuid (FK to profiles)
- emoji: text
- created_at: timestamp
- unique(message_id, profile_id, emoji)
```

**baseline_stats** (seeded data for comparison)
```sql
- id: uuid
- source: text
- year: integer
- role_title: enum
- experience_band: enum
- country: text
- median_salary: integer
- sample_size: integer (nullable)
- created_at: timestamp
```

**profile_snapshots** (added — tracks profile changes over time)
```sql
- id: uuid
- profile_id: uuid (FK to profiles)
- salary_band: enum (nullable)
- experience_band: enum (nullable)
- employment_type: enum (nullable)
- wfh_status: enum (nullable)
- role_title: enum (nullable)
- country: text (nullable)
- requires_visa: boolean (nullable)
- captured_at: timestamp
- indexes: (profile_id, captured_at DESC), (captured_at DESC)
```

**message_receipts** (added — cryptographic proof of message existence)
```sql
- id: uuid
- content_hash: bytea (SHA-256 of hex(SHA-256(content)) ∥ hex(SHA-256(image_url)) ∥ hex(SHA-256(link_url)) — each field hashed to a fixed 64-char hex string before outer SHA-256; empty string used for NULL fields)
- room: enum ('general', 'memes', 'whinge')
- created_at: timestamp (mirrors message created_at)
- indexes: (content_hash), (room, created_at DESC)
- RLS: deny ALL for authenticated. System-level only.
```

**moderation_reports** (added — reported message snapshots)
```sql
- id: uuid
- receipt_id: uuid (FK to message_receipts — tamper-evident link)
- reporter_id: uuid (FK to profiles)
- reason: text (nullable, max 500 chars)
- message_content: text (machine-copied from messages.content)
- message_image_url: text (machine-copied from messages.image_url, nullable)
- message_link_url: text (machine-copied from messages.link_url, nullable — added migration 028)
- message_author_id: uuid
- message_room: enum
- message_created_at: timestamp
- reported_at: timestamp
- status: text ('pending' | 'reviewed' | 'actioned' | 'dismissed') — `actioned` is a manual label meaning the moderator took a separate action (e.g. issued a ban); it does not trigger any automated side effect
- resolved_at: timestamp (nullable)
- resolved_by: uuid (nullable, FK to profiles)
- resolution_notes: text (nullable)
- expires_at: timestamp (default now + 30 days)
- RLS: moderator+ can SELECT/UPDATE, admin can DELETE. Members use report_message() only.
```

**custom_emotes** (added — community emotes for chat)
```sql
- id: uuid
- code: text (unique, shortcode format e.g. 'partyparrot')
- url: text (hosted image/GIF URL)
- alt: text (accessibility description)
- category: text (default 'custom')
- enabled: boolean (default true)
- created_at: timestamp
- created_by: uuid (FK to profiles, nullable)
- RLS: anyone can read enabled emotes, admins can manage
```

**user_bans** (added migration 032 — moderator-issued bans)
```sql
- id: uuid
- profile_id: uuid (FK to profiles, CASCADE on delete)
- ban_type: text ('timeout' | 'permanent')
- reason: text (nullable)
- banned_by: uuid (FK to profiles — moderator who issued ban)
- banned_at: timestamptz (default NOW())
- expires_at: timestamptz (nullable — NULL = permanent; required for timeout bans)
- lifted_at: timestamptz (nullable — set when ban is lifted early)
- lifted_by: uuid (FK to profiles, nullable)
- CONSTRAINT: timeout_requires_expiry — timeout bans must have expires_at
- RLS: moderator+ SELECT/UPDATE; no direct INSERT (all inserts via ban_user() SECURITY DEFINER)
```

### Database Functions & Triggers

**Pseudonym management:**
- `generate_pseudonym()` — random pseudonym from prefix pool + hex suffix
- `handle_new_user()` — trigger: auto-creates profile on auth.users insert
- `rename_pseudonym(new_name TEXT)` — validated pseudonym rename (3-24 chars, lowercase + underscore)

**Profile automation:**
- `update_updated_at()` — trigger: auto-updates `updated_at` on profile change
- `capture_profile_snapshot()` — trigger: snapshots work fields on change
- `capture_initial_snapshot()` — trigger: snapshots when onboarding_complete flips to true

**Chat integrity (migration 006; hash updated 029; verify updated 030):**
- `create_message_receipt()` — trigger: auto-creates SHA-256 receipt on message INSERT (SECURITY DEFINER). Hash covers content + image_url + link_url using per-field double-SHA256 scheme (updated migration 029). Uses `SET search_path = 'public, extensions'` — required to resolve `extensions.digest()` (pgcrypto).
- `report_message(target_message_id, reason)` — live report: machine-copies content, image_url, and link_url from DB + links to receipt. Rate-limited (10/hr). Prevents self-reports and duplicates (NULL-safe via `IS NOT DISTINCT FROM`, fixed migration 036). Accepts both the current 3-field receipt hash and legacy 2-field hash (fixed migration 036).
- `resolve_report(report_id, status, notes)` — moderator+: resolves a pending moderation report
- `verify_message_authenticity(content, room, timestamp, image_url, link_url)` — returns true if a receipt exists matching all alleged fields via the 3-field hash. `image_url` and `link_url` default to NULL for backward compatibility (migration 030).

**Role management (migration 007):**
- `is_moderator()` — JWT claim check: returns true for moderator or admin
- `is_admin()` — JWT claim check: returns true for admin only
- `assign_role(target_user_id, new_role)` — admin-only: assigns member/moderator/admin role
- `verify_message_receipt(content, room, time_start, time_end)` — admin-only: checks if receipt matching alleged content exists. Returns boolean only.

**Ban enforcement helper (migration 035):**
- `is_banned()` — checks `public.user_bans` for an active (unexpired + unlifted) ban on the calling user. Used in RLS policies and explicit checks in SECURITY DEFINER functions.

**Moderation portal functions (migration 032; fixes in 033–036):**
- `ban_user(target_profile_id, ban_type, reason, expires_at)` — moderator+: issues a timeout or permanent ban. Timeout requires `expires_at`. Prevents self-ban. Syncs `auth.users.banned_until` so Supabase Auth blocks sign-in and token refresh immediately (migration 034). `banned_until` is derived from ALL active bans — a new shorter ban cannot downgrade a longer or permanent one (fixed migration 036).
- `lift_ban(ban_id)` — moderator+: lifts an active ban, records `lifted_at` + `lifted_by`. Clears `auth.users.banned_until` only if the user has no other active overlapping bans (migration 034).
- `get_active_bans()` — moderator+: returns all unexpired/unlifted bans with profile + moderator pseudonyms resolved (SECURITY DEFINER to bypass profile RLS).
- `get_all_reports()` — moderator+: returns all moderation reports with reporter and author pseudonyms resolved via JOIN (SECURITY DEFINER). Ordered pending-first.
- `resolve_report_moderated(report_id, new_status, notes)` — moderator+: resolves a pending report to `reviewed`, `actioned`, or `dismissed`. Requires `status = 'pending'` — already-resolved reports cannot be changed. (Bug from 032 fixed in 033: `status` is TEXT not an enum, no cast needed.)

**Admin portal functions (migration 032):**
- `get_platform_overview()` — admin: returns single-row aggregate: total members, active sessions (distinct user_id from auth.sessions where not expired), pending reports, active bans, messages in last 24 h (from message_receipts).
- `get_login_activity(days_back INT)` — admin: unique logins per day from `auth.audit_log_entries` where `action = 'login'`. Aggregate only — no individual actor data returned.
- `get_message_activity(days_back INT)` — admin: messages per day from `message_receipts`. Aggregate only — no content, no author.
- `get_user_roles()` — admin: all users with `profile_id`, `pseudonym`, `role` (from `auth.users.raw_app_meta_data`), `member_since`, `message_count`. Required for role assignment UI (profile_id = auth user id, passed to `assign_role()`). Ordered by role seniority then join date.

**Aggregate functions (safe stats access):**
- `get_pseudonym(user_id UUID)` — returns pseudonym for chat display
- `get_salary_distribution()` — salary band counts
- `get_role_distribution()` — role title counts
- `get_experience_distribution()` — experience band counts
- `get_wfh_distribution()` — WFH status counts
- `get_employment_distribution()` — employment type counts
- `get_community_summary()` — total members + members with data
- `get_salary_trend()` — monthly salary trends from snapshots
- `get_wfh_trend()` — monthly WFH trends from snapshots

**Public member stats (migration 016):**
- `increment_message_count()` — trigger: increments profile.message_count on message INSERT
- `get_public_member_stats()` — returns public-safe stats for all members (pseudonym, tenure, message count, profile complete)
- `get_member_stats(pseudonym)` — returns stats for a single member by pseudonym

### Row Level Security (updated — privacy lockdown + role-gated)

- **profiles**: Users can read **only their own** row. UPDATE: own row AND `NOT is_banned()` (migration 035).
- **profile_snapshots**: Users can read only their own snapshots
- **messages**: Authenticated users can read all, delete own. INSERT: own row AND `NOT is_banned()` (migration 035).
- **reactions**: Authenticated users can read all, delete own. INSERT: own row AND `NOT is_banned()` (migration 035).
- **baseline_stats**: Authenticated users can read all
- **message_receipts**: Deny ALL for authenticated. System-level only (SECURITY DEFINER functions bypass RLS)
- **moderation_reports**: Deny ALL baseline. Moderator+ can SELECT/UPDATE. Admin can DELETE. Members INSERT via `report_message()` only.
- **custom_emotes**: Anyone can read enabled emotes. Admins can manage (insert/update/delete).
- **user_bans**: Moderator+ can SELECT/UPDATE. No direct INSERT (via `ban_user()` SECURITY DEFINER only). Members have no access.

### Realtime

Enabled for:
- `messages` table (via broadcast triggers for INSERT/UPDATE/DELETE)
- `reactions` table (via broadcast triggers for INSERT/DELETE)

### Cleanup Jobs

Two scheduled crons (requires pg_cron extension — commented in migration, run via SQL editor):
- **Messages**: Delete older than 72 hours, every 5 minutes
- **Moderation reports**: Delete expired (30-day TTL), daily at 3am UTC
- **Receipts**: No cleanup — ~80 bytes each, ~29 MB/year at 1000 msgs/day. Keep indefinitely.

---

## User Flows

### Flow 1: New User Signup
```
1. Land on home page
2. Click "Join the Union"
3. Enter email → receive magic link → click link → logged in
4. Auto-assigned pseudonym (e.g., worker_a7f3b2)
5. Redirected to onboarding form
6. Fill in work details (optional but encouraged)
7. Submit → redirected to chat
```

### Flow 2: Returning User Login
```
1. Click "Login"
2. Enter email
3. Verify via magic link
4. Redirected to chat (or onboarding if not completed)
```

### Flow 3: Chat Participation
```
1. Select room tab (general/memes/whinge)
2. See most recent 50 messages (latest page loaded first)
3. Scroll to top to load older messages — viewport stays anchored while history loads
4. Real-time updates: new messages arrive and append to bottom regardless of scroll position
5. Type message → send
6. Click reactions on others' messages
7. Reply to specific messages (optional)
```

### Flow 4: View Stats
```
1. Click "Stats" in nav
2. See summary cards (members, median salary band, top role)
3. View salary progression chart:
   a. Toggle industry baseline roles on/off (dotted colored lines)
   b. Toggle community data overlay on/off (solid white line, requires n≥30)
4. Browse distribution charts (salary, experience, role, WFH, employment)
5. Note: Salary data hidden until n≥30 to protect privacy
```

---

## Implementation Phases

### Phase 1: Foundation ✅ COMPLETE
- [x] Project setup (Vite, React, TypeScript, Bulma)
- [x] Supabase project creation
- [x] Database schema migration (001 through 005)
- [x] Basic routing structure
- [x] Layout components (Navbar, Footer)
- [x] Terminal aesthetic UI theme (custom CSS variables, monospace fonts, dark theme)
- [x] ASCII art logo on home page

### Phase 2: Authentication ✅ COMPLETE
- [x] Supabase client setup
- [x] Magic link login
- [x] Auth callback handling
- [x] Protected routes
- [x] Auto-pseudonym generation (via DB trigger, varied prefix pool)

### Phase 3: Onboarding ✅ COMPLETE
- [x] Onboarding form component
- [x] Form validation
- [x] Profile update logic
- [x] Skip option (can complete later)
- [x] Reusable form — `OnboardingForm` works in both "onboarding" and "profile" modes

### Phase 3.5: Profile & Privacy (added — not in original plan) ✅ COMPLETE
- [x] Profile page (`/profile`) for viewing and editing work details after onboarding
- [x] PixelAvatar component — deterministic 5x5 pixel art from pseudonym hash (pure SVG)
- [x] Pseudonym rename with two-step privacy warning (validated: 3-24 chars, lowercase alphanumeric + underscore)
- [x] Profile history tracking — `profile_snapshots` table auto-captures changes via triggers
- [x] Privacy lockdown (migration 005) — profiles restricted to own-row-only reads, no enumeration
- [x] Aggregate DB functions for safe stats access (salary, role, experience, WFH, employment distributions)
- [x] Trend functions (`get_salary_trend`, `get_wfh_trend`) from profile snapshots
- [x] Community summary function (`get_community_summary`)
- [x] Search path security — all DB functions use `SET search_path = ''`

### Phase 3.75: Chat Integrity & Roles (added — not in original plan) ✅ COMPLETE
- [x] Cryptographic receipts — `message_receipts` table with SHA-256 hashes, auto-trigger on message INSERT
- [x] Receipt RLS lockdown — deny ALL for authenticated, system-level only
- [x] Moderation reports — `moderation_reports` table with content snapshot + receipt link
- [x] `report_message()` — live reports only, machine-copies content, rate-limited, prevents duplicates
- [x] `resolve_report()` — moderator+ function with status validation
- [x] Three-tier role system — member/moderator/admin via JWT `app_metadata` claims
- [x] `is_moderator()` / `is_admin()` helper functions for RLS
- [x] `assign_role()` — admin-only role assignment
- [x] `verify_message_receipt()` — admin-only receipt verification (boolean only)
- [x] Default role on signup — `handle_new_user()` updated to set `role: member`
- [x] Role-gated RLS policies on moderation_reports
- [x] Backfill roles for existing users
- [x] Cleanup cron definitions (commented — requires pg_cron activation)
- [x] TypeScript types for `UserRole`, `ModerationReportStatus`, `ModerationReport`

### Phase 4: Chat ✅ COMPLETE
- [x] Chat page shell with room tabs (#general, #memes, #whinge)
- [x] `ChatContext` — centralized chat state with realtime subscriptions
- [x] Message list with realtime subscription (via Supabase broadcast)
- [x] Message input component with emoji autocomplete
- [x] Room switching (functional, join/leave room)
- [x] Reply threading (basic — reply_to_id, visual thread indicator)
- [x] Emoji reactions with toggle and picker
- [x] Custom emotes (migration 013) — community-uploaded emotes
- [x] Report button on messages (calls `report_message()`)
- [x] Message deletion (own messages only)
- [x] PixelAvatar display per message author
- [x] Message cleanup job (migration 015) — pg_cron schedules for message TTL + 30-day report TTL (TTL initially 1hr; updated to 6h via 022; updated to 72h via 023)
- [x] Cursor-based pagination — initial load fetches most recent 50 messages (DESC + reverse). Scroll to top triggers `loadOlderMessages()` which fetches the previous page using `created_at` as cursor. Scroll position preserved via scroll anchor. `PAGE_SIZE + 1` fetch trick used to detect whether another page exists without an extra round trip.
- [x] Client-side expiry prune aligned to 72h TTL (was incorrectly set to 6h)

### Phase 5: Stats ✅ COMPLETE
- [x] Stats page shell with placeholder layout
- [x] Aggregate query functions ready in DB (distributions + trends)
- [x] `useStats` hook — fetches all distributions, summary, and baselines in parallel
- [x] CSS-based bar charts for salary, experience, role, WFH, employment distributions
- [x] Seed baseline_stats with 2025 Australian developer salary data (migration 014)
- [x] **Sample size guards** — `SampleSizeGuard` reusable component with confidence tiers:
  - n < 30: Data hidden, progress bar shown
  - n 30-49: Moderate confidence warning
  - n ≥ 50: Good confidence
- [x] **SVG Salary Progression Chart**:
  - Experience (X-axis) vs Salary (Y-axis)
  - Toggle-able industry baseline roles (dotted lines, transparent fill)
  - Toggle-able community data overlay (solid white line, opaque fill)
  - Full-width responsive design with viewBox scaling
  - Color-coded role legend with click-to-toggle
- [x] Summary cards with confidence indicators
- [x] Low sample size warnings and empty state handling
- [x] Methodology notes explaining data sources and confidence thresholds

### Phase 6: Polish & Deploy 🔲 IN PROGRESS
- [ ] Error handling (partial — some exists in hooks)
- [ ] Loading states (partial — exists in auth/profile/chat/stats)
- [ ] Mobile responsiveness (partial — basic Bulma responsive)
- [x] Activate pg_cron for message cleanup (migration 015)
- [x] Deploy to Cloudflare Pages (handshakeunion.nexus — wrangler.toml added Feb 2026)
- [x] README documentation (initial version live)
- [ ] Test with small group
- [ ] Seed custom emotes with actual hosted images

### Phase 7: Moderation & Admin Portal ✅ COMPLETE
- [x] `user_bans` table with RLS — timeout + permanent bans, expiry, lift tracking (migration 032)
- [x] `ban_user()` — moderator+: issues ban with type validation and self-ban prevention
- [x] `lift_ban()` — moderator+: lifts ban, records who lifted it
- [x] `get_active_bans()` — moderator+: unexpired/unlifted bans with pseudonyms (SECURITY DEFINER)
- [x] `get_all_reports()` — moderator+: all reports with reporter + author pseudonyms (SECURITY DEFINER)
- [x] `resolve_report_moderated()` — moderator+: resolves pending reports to reviewed/actioned/dismissed (migration 032; TEXT cast bug fixed in 033)
- [x] `get_platform_overview()` — admin: single-row platform health aggregate
- [x] `get_login_activity()` — admin: unique logins/day from audit_log_entries (aggregate only)
- [x] `get_message_activity()` — admin: messages/day from receipts (aggregate only)
- [x] `get_user_roles()` — admin: all users with profile_id + role for role assignment
- [x] `RoleRoute` component — JWT role-gated route wrapper, redirects unauthorized to `/`
- [x] `useModerationReports` hook — reports + bans data, resolve/ban/lift actions, PostgrestError surfacing
- [x] `useAdminStats` hook — overview + activity data + user roles, configurable day window
- [x] `Mod.tsx` — queue tab (report cards with inline image + LinkPreview + resolve + ban-author form), bans tab (active bans + lift)
- [x] `Admin.tsx` — overview stat cards, SVG activity bar charts (7/14/30/90d), role management table with search + inline assign
- [x] Navbar — `/mod` (warning colour, moderator+), `/admin` (red, admin only) links conditionally shown
- [x] Routes — `/mod` wrapped in `RoleRoute minRole="moderator"`, `/admin` wrapped in `RoleRoute minRole="admin"`
- [x] `ban_user()` fix — strongest active ban preserved in `banned_until`; a new shorter ban cannot downgrade a permanent or longer-running one (migration 036)
- [x] `report_message()` fix — corrected receipt hash scheme (no `|` separators), added legacy 2-field hash fallback, NULL-safe duplicate detection via `IS NOT DISTINCT FROM` (migration 036)

---

## Security Considerations

- **No passwords, no OAuth** — magic links only. OAuth providers disabled; no real-identity metadata stored in Supabase.
- **Bot protection at login only** — Cloudflare Turnstile on `/login` prevents automated account creation. Not loaded on any other page. Token verified server-side by Supabase before magic link is issued. `VITE_TURNSTILE_SITE_KEY` in env; secret key configured in Supabase Auth settings.
- **Pseudonymous by default** — real identity never exposed
- **Row Level Security** — database-level access control
- **Privacy lockdown** — profiles restricted to own-row reads; stats exposed only via aggregate functions (no individual data enumeration)
- **Pseudonym oracle hardened** — `get_pseudonym()` only resolves users who have sent at least one message, preventing cold UUID enumeration (migration 027)
- **Search path security** — all DB functions use `SET search_path = ''` to prevent injection
- **Ephemeral messages** — 72-hour TTL; rate-limited to 10 messages/minute per user via BEFORE INSERT trigger (migration 027)
- **Image URL domain allowlist** — `image_url` accepts only approved CDN providers (GIPHY, Tenor, Imgur) via a DB CHECK constraint and client-side regex. Providers controlled by `ALLOWED_IMAGE_PROVIDERS` in `src/lib/constants.ts` (migration 024)
- **Link URL security** — `link_url` enforces `https://` and max 2048 chars at the DB level (migration 028). No domain allowlist (links are user-shared content, not embedded media). OG metadata is fetched server-side by the `og-preview` Edge Function — the browser never requests the target URL directly. OG images are proxied to base64 data URLs server-side so the viewer's IP never reaches a third-party CDN. The `LinkPreview` anchor always targets the original `link_url` (the URL shared in the message) — metadata-supplied redirect targets (`og:url`, `og:video`) are used for display only and never as click destinations, preventing phishing via crafted OG tags.
- **Country field validated** — CHECK constraint on `profiles` and `profile_snapshots` enforces allowed values at DB level (migration 026)
- **Custom emotes authenticated-only** — `anon` role removed; all endpoints require authentication (migration 025)
- **Cryptographic receipts** — SHA-256 hashes prove message existence without retaining readable content. Invisible to all user-facing roles (RLS deny-all). Enables screenshot verification.
- **Moderation integrity** — reports machine-copy content from DB (never user-provided) and link to receipts for tamper-evident verification
- **Role-based access** — three-tier system (member/moderator/admin) via JWT claims. Receipts admin-only. Moderation moderator+. Clean separation of concerns.
- **Minimal data posture** — messages deleted after 72 hours, reports after 30 days, only receipt hashes persist (no readable content)
- **Content Security Policy** — CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy served via `public/_headers` (Cloudflare Pages)
- **Profile history** — snapshots track changes for trend analysis without exposing individual records
- **Open source** — code is auditable
- **No analytics/tracking** — no third-party scripts

---

## Roadmap

> Short-term items are things that could land before or shortly after the first public push.
> Long-term items are post-POC, contingent on demand.

### Short-term (pre/peri launch)
- [ ] **Phase 6 completion** — error boundaries, loading states, mobile responsiveness pass
- [ ] **Seed custom emotes** — upload actual hosted images for the custom emote set
- [x] **Moderator dashboard** — `/mod` route: report queue with inline resolve + ban-author; active bans tab with lift. ✅ Complete (Phase 7)
- [x] **Admin dashboard** — `/admin` route: platform overview, login + message activity charts, role management. ✅ Complete (Phase 7)
- [ ] **Retrospective report form** — `/report` for post-TTL reports. User-provided content verified against receipt hashes. Trust levels: receipt-verified vs unverified.
- [ ] **README polish** — full setup guide, contributing instructions, self-hosting notes
- [ ] **Test round** — closed group test, gather feedback on UX and data collection

### Long-term (post-POC, if demand warrants)

#### Moderation & Trust
- [x] **Ban system** — timeout + permanent bans via `/mod` portal, lift-ban support. ✅ Complete (Phase 7)
- **Notification system** — alert moderators of new reports in real time
- **Invite-only growth** — web-of-trust referral model to slow bad actors
- **LLM-assisted moderation** — flag problematic content for review queue

#### Features
- **GIF search** — client-side GIF picker alongside image URL input (Tenor/Giphy, privacy trade-off to note in UI)
- **More rooms** — user-created or admin-curated topic rooms
- **DMs** — direct messages with E2E encryption
- **More granular stats** — filter by company size, industry vertical, location
- **Resource library** — know-your-rights templates, IR contacts, union links
- **Mobile app** — React Native or PWA

#### Infrastructure & Sustainability
- **Self-hosted Supabase** — migrate off free tier to own infrastructure
- **Cost transparency dashboard** — public display of hosting costs vs donations
- **Community funding** — GitHub Sponsors, Open Collective, or direct
- **Integration with Professionals Australia** or similar bodies

---

## Open Questions

1. ~~**Pseudonym customization?**~~ — **RESOLVED:** Users can rename via `rename_pseudonym()` with privacy warning and validation (3-24 chars, lowercase alphanumeric + underscore).
2. **Room creation?** — Just the three rooms, or let users create more?
3. **Verification tiers?** — Some way to mark "verified developer" without deanonymizing?
4. ~~**Salary data granularity?**~~ — **RESOLVED:** Using bands. Aggregate functions expose distribution counts only.
5. ~~**Geographic granularity?**~~ — **RESOLVED:** Country level only (Australia, New Zealand, Other).

---

## License

AGPL-3.0 — Ensures the code remains open even if someone forks and runs their own instance.

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the full history of scope changes, feature additions, and meaningful deviations from the original plan.
