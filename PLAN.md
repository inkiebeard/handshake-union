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

> Last updated: 2026-03-08

All six original MVP feature areas are built. Five of six implementation phases are complete. Phase 6 (Polish & Deploy) is in-flight — partial error handling and loading states exist, deployment config is live on Cloudflare Pages, but a formal test round and README polish remain.

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ✅ Complete | Magic link only |
| Live Chat Rooms | ✅ Complete | All 3 rooms, realtime, reactions, custom emotes, image attachments, link sharing with OG preview |
| Onboarding Form | ✅ Complete | All fields, skip option, reusable in profile mode |
| Stats Dashboard | ✅ Complete | SVG chart, distribution bars, sample size guards, baselines |
| Chat Integrity & Moderation | ✅ Complete | Receipts, reports, RBAC, rate limiting |
| Role-Based Access Control | ✅ Complete | member/moderator/admin via JWT claims |
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
| `moderator` | No (assigned by admin) | + View/resolve moderation reports |
| `admin` | No (assigned by admin) | + Verify receipts, assign roles, system dashboards |

- `service_role` key bypasses RLS entirely (automated processes only)
- Roles checked via `is_moderator()` / `is_admin()` helper functions in RLS policies
- Receipts invisible to all human roles — only accessible via admin `verify_message_receipt()` function

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
│   │   │   └── ProtectedRoute.tsx
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
│   │   ├── useAuth.ts
│   │   ├── useCustomEmotes.ts          # custom emote fetching
│   │   ├── useImageDisplayMode.ts      # per-session blur/reveal toggle state
│   │   ├── useMembers.ts               # public member directory stats
│   │   ├── useProfile.ts
│   │   ├── useReactionHistory.ts       # persists recent emoji reactions to localStorage
│   │   └── useStats.ts                 # aggregate stats + baselines + utilities
│   ├── lib/
│   │   ├── constants.ts
│   │   ├── emoji.tsx                   # emoji rendering utilities
│   │   └── supabase.ts
│   ├── pages/
│   │   ├── AuthCallback.tsx
│   │   ├── Chat.tsx                    # full chat with rooms + realtime
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── Members.tsx                 # public member directory
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
│       └── 030_verify_authenticity_link_url.sql
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
030_verify_authenticity_link_url
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
- status: text ('pending', 'reviewed', 'actioned', 'dismissed')
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
- `report_message(target_message_id, reason)` — live report: machine-copies content, image_url, and link_url from DB + links to receipt. Rate-limited (10/hr). Prevents self-reports and duplicates.
- `resolve_report(report_id, status, notes)` — moderator+: resolves a pending moderation report
- `verify_message_authenticity(content, room, timestamp, image_url, link_url)` — returns true if a receipt exists matching all alleged fields via the 3-field hash. `image_url` and `link_url` default to NULL for backward compatibility (migration 030).

**Role management (migration 007):**
- `is_moderator()` — JWT claim check: returns true for moderator or admin
- `is_admin()` — JWT claim check: returns true for admin only
- `assign_role(target_user_id, new_role)` — admin-only: assigns member/moderator/admin role
- `verify_message_receipt(content, room, time_start, time_end)` — admin-only: checks if receipt matching alleged content exists. Returns boolean only.

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

- **profiles**: Users can read **only their own** row, update only their own (no enumeration)
- **profile_snapshots**: Users can read only their own snapshots
- **messages**: Authenticated users can read all, insert own, delete own
- **reactions**: Authenticated users can read all, insert/delete own
- **baseline_stats**: Authenticated users can read all
- **message_receipts**: Deny ALL for authenticated. System-level only (SECURITY DEFINER functions bypass RLS)
- **moderation_reports**: Deny ALL baseline. Moderator+ can SELECT/UPDATE. Admin can DELETE. Members INSERT via `report_message()` only.
- **custom_emotes**: Anyone can read enabled emotes. Admins can manage (insert/update/delete).

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
- **Link URL security** — `link_url` enforces `https://` and max 2048 chars at the DB level (migration 028). No domain allowlist (links are user-shared content, not embedded media). OG metadata is fetched server-side by the `og-preview` Edge Function — the browser never requests the target URL directly. OG images are guarded client-side: only `https://` URLs rendered, with `referrerPolicy="no-referrer"` and `rel="noopener noreferrer"` on all link anchors
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
- [ ] **Moderator dashboard** — `/mod` route gated by role. View pending reports, resolve, see reported content.
- [ ] **Admin dashboard** — `/admin` route. Receipt verification UI, role management, platform health.
- [ ] **Retrospective report form** — `/report` for post-TTL reports. User-provided content verified against receipt hashes. Trust levels: receipt-verified vs unverified.
- [ ] **README polish** — full setup guide, contributing instructions, self-hosting notes
- [ ] **Test round** — closed group test, gather feedback on UX and data collection

### Long-term (post-POC, if demand warrants)

#### Moderation & Trust
- **Ban/warn system** — timeouts, pseudonym bans, escalation tiers
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

> Tracks scope changes, feature additions, and meaningful deviations from the original plan over the life of the project. Migrations and bug fixes are listed separately in `supabase/migrations/`.

### 2026-03-08 — Link sharing with Open Graph preview

- **Added:** Messages can now include an optional HTTPS link (`link_url` column on `messages`). Max one link per message; `https://` required; max 2048 chars. Enforced at DB level via CHECK constraint (migration 028).
- **Added:** `og-preview` Supabase Edge Function — fetches up to 100 KB of the target URL server-side (5 s timeout, `AbortController`), extracts Open Graph meta tags (`og:title`, `og:description`, `og:image`), falls back to Twitter Card equivalents (`twitter:title`, etc.). Authenticated callers only: JWT role is checked via local base64url decode of the payload — no extra network round-trip since the Supabase gateway pre-validates the signature.
- **Added:** `LinkPreview` component (`src/components/chat/LinkPreview.tsx`) — renders an OG preview card in each message and inside the `MessageInput` link attachment bar. Module-level `ogCache` Map + `pending` deduplication Map prevent redundant edge function calls for the same URL. Skeleton loading state mirrors the rich card layout. 30 s client-side timeout falls back to a plain domain + URL card.
- **Added:** Live debounced preview in `MessageInput` — 500 ms debounce on the link URL field shows how the preview will appear before sending.
- **Added:** `link_url` included in receipt hash — `create_message_receipt()` and `report_message()` now hash content + image_url + link_url using the existing per-field double-SHA256 scheme (migration 029). `verify_message_authenticity()` updated to accept `alleged_link_url TEXT DEFAULT NULL` for backward compatibility (migration 030).
- **Fixed:** Migration 028 had two bugs: `SET search_path = ''` hides `extensions.digest()`, and the old `chr(0)` separator scheme was used. Both corrected in migration 029. Functions calling `extensions.digest()` use `SET search_path = 'public, extensions'` — documented exception to the `''` rule.
- **Not in original plan.**
- **Affected:** `src/components/chat/LinkPreview.tsx` (new), `src/components/chat/Message.tsx`, `src/components/chat/MessageInput.tsx`, `src/contexts/ChatContext.tsx`, `src/types/database.ts`, `src/index.css`, `supabase/functions/og-preview/index.ts` (new), migrations 028–030.

### 2026-03-02 — Cloudflare Turnstile bot protection
- **Added:** Cloudflare Turnstile CAPTCHA on the login page (`/login`) only. Prevents automated account creation and magic link flooding. Token is passed to `supabase.auth.signInWithOtp()` via `options.captchaToken` and verified server-side by Supabase against the Turnstile secret key.
- **Added:** `VITE_TURNSTILE_SITE_KEY` environment variable. Secret key configured in Supabase Auth → Bot and Abuse Protection.
- **Added:** `@marsidev/react-turnstile` dependency. Widget renders with dark theme between the email input and submit button. Submit is disabled until challenge resolves. On auth error the widget auto-resets so the user can retry.
- **Updated:** `Privacy.tsx` — removed false "Cloudflare Turnstile not enabled" claim; added full Turnstile section documenting what data is collected (IP, browser signals, user-agent), its login-only scope, and links to Cloudflare's Turnstile privacy docs.
- **Updated:** `README.md`, `PLAN.md`, `AGENTS.md` — security model, setup instructions, and invariants updated to reflect Turnstile use.
- **Affected:** `Login.tsx`, `Privacy.tsx`, `.env.example`, `README.md`, `PLAN.md`, `AGENTS.md`, `package.json`, `public/_headers`.

### 2026-02-27 — Security hardening (OpSec audit)
- **Removed:** GitHub and GitLab OAuth providers. Magic link is now the only sign-in method, eliminating real-identity metadata leakage via `raw_user_meta_data`.
- **Added:** Image URL domain allowlist — `messages.image_url` now enforces an approved-CDN CHECK constraint (`(media[0-9]*|i|c).(giphy|tenor|imgur).<tld>`). Client-side validation uses `ALLOWED_IMAGE_PROVIDERS` / `ALLOWED_IMAGE_HOSTNAME_RE` from `src/lib/constants.ts` (migration 024).
- **Added:** Custom emotes restricted to authenticated users — `anon` role grant revoked (migration 025).
- **Added:** Country field CHECK constraint on `profiles` and `profile_snapshots` — enforces `'Australia' | 'New Zealand' | 'Other'` at DB level (migration 026).
- **Added:** Server-side message rate limit — BEFORE INSERT trigger, max 10 messages per 60 seconds per user (migration 027).
- **Hardened:** `get_pseudonym()` now only resolves users who have sent at least one message, breaking cold UUID enumeration (migration 027).
- **Added:** `public/_headers` — CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy served at the edge by Cloudflare Pages.
- **Removed:** `console.log` calls from `ChatContext.tsx` that were leaking broadcast payloads (message content, room, user IDs) to the browser console.
- **Affected:** `Login.tsx`, `Privacy.tsx`, `ChatContext.tsx`, `MessageInput.tsx`, `src/lib/constants.ts`, `public/_headers`, migrations 024–028, `PLAN.md`, `README.md`, `AGENTS.md`.

### 2026-02-27 — Cursor-based chat pagination
- **Added:** `ChatContext` now fetches only the most recent 50 messages on room join (`PAGE_SIZE = 50`, `ORDER BY created_at DESC LIMIT PAGE_SIZE + 1`, reversed for display). The extra `+1` fetch is used to determine whether an older page exists without a separate count query.
- **Added:** `loadOlderMessages()` — fetches the previous page using the oldest loaded `created_at` as a cursor (`lt('created_at', cursor)`). Prepends results to the message list.
- **Added:** `hasMoreMessages` and `loadingOlder` states surfaced through `ChatContext` and `MessageList` props.
- **Added:** Scroll-to-top detection in `MessageList` — triggers `loadOlderMessages()` automatically when the user scrolls within 80px of the top. A manual "↑ load older messages" button is also shown.
- **Added:** Scroll anchor in `MessageList` — saves `{ scrollHeight, scrollTop }` before prepending and restores position via `useLayoutEffect` after the DOM commits, so the viewport stays anchored to the same message.
- **Fixed:** Client-side expiry prune interval was incorrectly set to 6 hours (matching the old retention window). Now correctly aligned to 72 hours. Prune runs every 60 seconds (was 30).
- **Rationale:** With 72-hour retention, loading all messages at once would be expensive and would degrade UX (especially on mobile). Pagination keeps the initial load fast and the DOM small.
- **Affected:** `ChatContext.tsx`, `MessageList.tsx`, `Chat.tsx`, `index.css`.

### 2026-02-26 — Message retention extended: 6 hours → 72 hours
- **Changed:** `cleanup-old-messages` cron interval updated from `6 hours` to `72 hours` (migration 023).
- **Rationale:** 72-hour window better supports async participation and gives meaningful conversation context without abandoning ephemerality. Storage impact is negligible (~5–10 MB at thriving scale).
- **Affected:** `PLAN.md`, `README.md`, `AGENTS.md`, `Chat.tsx`, `Home.tsx`, `Members.tsx`, `Privacy.tsx`, security considerations copy.
- **Branch:** `feature/72h-message-retention`

### 2026-02-20 — Message retention extended: 1 hour → 6 hours
- **Changed:** `cleanup-old-messages` cron interval updated from `1 hour` to `6 hours` (migration 022).
- **Rationale:** 1-hour window felt too short for async participation across timezones; 6 hours preserves ephemerality while making conversations more useful.
- **Affected:** `PLAN.md`, `README.md`, `ChatContext.tsx` (fetch window + client-side prune interval), `Chat.tsx`, `Home.tsx`, `Members.tsx`, security considerations copy.
- **Branch:** `feat/6h-message-retention`

### 2026-02-20 — Image URL attachments with blur/reveal mode
- **Added:** Messages can now include an attached image via HTTPS URL. Images render inline with a blur-by-default / click-to-reveal toggle to protect users from unexpected content.
- **Added:** Global image display mode toggle in the chat toolbar (blurred / visible for all).
- **Added:** `image_url` column on `messages` table (migration 017). URL integrity guards added (migration 018).
- **Added:** Receipt hash integrity fixes for image-inclusive messages (migrations 019, 020, 021).
- **Rationale:** User-requested UX improvement; URL-only approach avoids server-side storage and keeps the stack simple.
- **Not in original plan.**

### 2026-02-20 — Community scope broadened (non-AU)
- **Changed:** Removed Australia-centric language from home page and descriptions. Platform is open to any developer regardless of geography.
- **Rationale:** Unnecessary to restrict early; global scope increases data richness and network effects.

### 2026-02-19 — Cloudflare Pages deployment config
- **Added:** `wrangler.toml` for Cloudflare Workers/Pages static SPA deployment to `handshakeunion.nexus`.
- **Added:** README with project ethos, feature overview, and industry data sources.
- **Not in original plan** (original plan listed Vercel or Cloudflare Pages as options; Cloudflare chosen).

### 2026-02-18 — Phase 5: Stats dashboard
- **Completed:** Full aggregate stats dashboard with SVG salary progression chart, distribution bar charts, sample size guards, and seeded 2025 Australian developer baseline data.
- **In original plan.**

### 2026-02-18 — Phase 4: Chat
- **Completed:** Realtime chat with three rooms, reply threading, emoji reactions, custom emotes, report button, delete own messages, PixelAvatar display.
- **In original plan.**

### 2026-02-18 — Phase 3.75: Chat integrity and roles (scope addition)
- **Added:** Cryptographic receipt system — SHA-256 hash of every message, stored automatically, admin-only access.
- **Added:** Moderation reports — machine-copy content snapshot linked to receipt for tamper-evident verification.
- **Added:** Three-tier RBAC (member / moderator / admin) via JWT `app_metadata` claims.
- **Added:** `report_message()`, `resolve_report()`, `assign_role()`, `verify_message_receipt()` DB functions.
- **Rationale:** Moderation integrity was identified as a core trust requirement before launch; doing it right meant a full phase.
- **Not in original plan as a separate phase** (moderation noted briefly in MVP but not scoped).

### 2026-02-18 — Phase 3.5: Profile and privacy (scope addition)
- **Added:** Profile page (`/profile`) — view and edit work details post-onboarding.
- **Added:** PixelAvatar — deterministic 5×5 pixel art avatars from pseudonym hash (pure SVG, no external service).
- **Added:** Pseudonym rename with two-step privacy warning.
- **Added:** Profile history snapshots (`profile_snapshots` table) — auto-captured via trigger for trend data.
- **Added:** Privacy lockdown — profiles restricted to own-row-only reads; stats via aggregate functions only.
- **Added:** Search path security on all DB functions (`SET search_path = ''`).
- **Rationale:** Privacy posture and user identity controls were too important to defer; built before chat to get the data model right.
- **Not in original plan as a separate phase.**

### 2026-02-18 — Phases 1–3: Foundation, auth, onboarding
- **Completed:** Project setup, Supabase schema (migrations 001–005), React routing, terminal aesthetic theme, magic link auth, onboarding form with all fields.
- **In original plan.**

### 2026-02-14 — Project initialised
- **Created:** Initial project scaffold — Vite + React + TypeScript + Bulma, initial DB schema migration, basic routing.
- **In original plan.**
