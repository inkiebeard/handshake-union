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

> Last updated: 2026-02-20

All six original MVP feature areas are built. Five of six implementation phases are complete. Phase 6 (Polish & Deploy) is in-flight — partial error handling and loading states exist, deployment config is live on Cloudflare Pages, but a formal test round and README polish remain.

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ✅ Complete | Magic link, GitHub OAuth, GitLab OAuth |
| Live Chat Rooms | ✅ Complete | All 3 rooms, realtime, reactions, custom emotes, image attachments |
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

---

## Core Features (MVP)

### 1. Authentication
- **Magic link login** (email-based, no passwords)
- **GitHub OAuth** (optional, for those who prefer)
- **GitLab OAuth** (optional, for those who prefer)
- **No passwords** — reduces friction and security burden
- **MFA built-in** — Supabase handles this via email confirmation
- **Pseudonymous accounts** — auto-generated pseudonyms like `worker_a7f3b2`

### 2. Live Chat Rooms
Three rooms to start:
- **#general** — main discussion
- **#memes** — shitposting, levity
- **#whinge** — venting about work (cathartic, validates experience)

**Chat Features:**
- 72 hour message history max (ephemeral by design, cleanup via pg_cron)
- Basic threading/replies (reply_to_id with visual indicator)
- Emoji reactions (toggle on/off, picker UI)
- Custom emotes via `:shortcode:` syntax (admin-managed)
- Emoji autocomplete while typing
- Shows pseudonym + PixelAvatar, not real identity
- Real-time via Supabase broadcast triggers
- Message reporting (rate-limited, machine-copies content)
- Delete own messages

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
| Auth | Supabase Auth | Magic links, OAuth, MFA built-in |

---

## Project Structure

```
handshake-union/
├── public/
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Layout.tsx
│   │   ├── auth/
│   │   │   └── ProtectedRoute.tsx
│   │   ├── onboarding/
│   │   │   └── OnboardingForm.tsx      # reusable in onboarding + profile modes
│   │   ├── chat/
│   │   │   ├── MessageList.tsx          # scrollable message container
│   │   │   ├── MessageInput.tsx         # input with emoji autocomplete
│   │   │   ├── Message.tsx              # single message with reactions
│   │   │   ├── ReactionPicker.tsx       # emoji picker for reactions
│   │   │   └── EmojiAutocomplete.tsx    # :emoji: autocomplete dropdown
│   │   ├── stats/                       # Components inline in Stats.tsx
│   │   │   ├── SalaryProgressionChart   # SVG line/area chart with role toggles
│   │   │   ├── BarChart                 # Reusable distribution bar chart
│   │   │   ├── GuardedBarChart          # BarChart with sample size guard
│   │   │   └── SampleSizeGuard          # Reusable guard component
│   │   └── PixelAvatar.tsx              # deterministic 5x5 pixel art avatars
│   ├── contexts/
│   │   ├── ChatContext.tsx             # chat state, messages, reactions, realtime
│   │   └── EmoteContext.tsx            # custom emote provider
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProfile.ts
│   │   ├── useCustomEmotes.ts          # custom emote fetching
│   │   ├── useMessages.ts              # TODO: Phase 4 (legacy)
│   │   ├── useStats.ts                 # aggregate stats + baselines + utilities
│   │   └── useMembers.ts               # public member directory stats
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── constants.ts
│   │   └── emoji.tsx                   # emoji rendering utilities
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── AuthCallback.tsx
│   │   ├── Chat.tsx                     # full chat with rooms + realtime
│   │   ├── Onboarding.tsx
│   │   ├── Profile.tsx                  # added — not in original plan
│   │   ├── Stats.tsx                    # full stats dashboard with charts
│   │   └── Members.tsx                  # public member directory
│   ├── types/
│   │   └── database.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── supabase/
│   ├── config.toml
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
│       └── 022_update_message_retention_6h.sql
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── wrangler.toml
├── .env.example
├── .gitignore
├── LICENSE (AGPL-3.0)
├── PLAN.md
└── README.md
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
021_fix_verify_functions_hash → 022_update_message_retention_6h
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
- country: text (nullable)
- requires_visa: boolean (nullable)
```

**messages**
```sql
- id: uuid
- room: enum ('general', 'memes', 'whinge')
- profile_id: uuid (FK to profiles)
- content: text (max 2000 chars)
- image_url: text (nullable, https:// only, max 2048 chars — added migration 017)
- created_at: timestamp
- reply_to_id: uuid (nullable, FK to messages)
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
- content_hash: bytea (SHA-256 of message content)
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
- message_content: text (machine-copied from messages table)
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

**Chat integrity (migration 006):**
- `create_message_receipt()` — trigger: auto-creates SHA-256 receipt on message INSERT (SECURITY DEFINER)
- `report_message(target_message_id, reason)` — live report: machine-copies message content + links to receipt. Rate-limited (10/hr). Prevents self-reports and duplicates.
- `resolve_report(report_id, status, notes)` — moderator+: resolves a pending moderation report

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
3. Choose auth method:
   a. Enter email → receive magic link → click link → logged in
   b. Click GitHub/GitLab → OAuth flow → logged in
4. Auto-assigned pseudonym (e.g., worker_a7f3b2)
5. Redirected to onboarding form
6. Fill in work details (optional but encouraged)
7. Submit → redirected to chat
```

### Flow 2: Returning User Login
```
1. Click "Login"
2. Enter email OR click OAuth button
3. Verify via magic link / OAuth
4. Redirected to chat (or onboarding if not completed)
```

### Flow 3: Chat Participation
```
1. Select room tab (general/memes/whinge)
2. See last 72 hours of messages
3. Real-time updates as new messages arrive
4. Type message → send
5. Click reactions on others' messages
6. Reply to specific messages (optional)
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
- [x] GitHub OAuth
- [x] GitLab OAuth
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
- [x] Message cleanup job (migration 015) — pg_cron schedules for message TTL + 30-day report TTL (TTL initially 1hr; updated to 6h via migration 022)

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

- **No passwords stored** — magic links and OAuth only
- **Pseudonymous by default** — real identity never exposed
- **Row Level Security** — database-level access control
- **Privacy lockdown** — profiles restricted to own-row reads; stats exposed only via aggregate functions (no individual data enumeration)
- **Search path security** — all DB functions use `SET search_path = ''` to prevent injection
- **Ephemeral messages** — 72 hour TTL reduces long-term risk
- **Cryptographic receipts** — SHA-256 hashes prove message existence without retaining readable content. Invisible to all user-facing roles (RLS deny-all). Enables screenshot verification.
- **Moderation integrity** — reports machine-copy content from DB (never user-provided) and link to receipts for tamper-evident verification
- **Role-based access** — three-tier system (member/moderator/admin) via JWT claims. Receipts admin-only. Moderation moderator+. Clean separation of concerns.
- **Minimal data posture** — messages deleted after 72 hours, reports after 30 days, only receipt hashes persist (no readable content)
- **Profile history** — snapshots track changes for trend analysis without exposing individual records
- **Open source** — code is auditable
- **No analytics/tracking** — no third-party scripts
- **HTTPS only** — enforced by hosting provider

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
- **Completed:** Project setup, Supabase schema (migrations 001–005), React routing, terminal aesthetic theme, magic link + OAuth auth, onboarding form with all fields.
- **In original plan.**

### 2026-02-14 — Project initialised
- **Created:** Initial project scaffold — Vite + React + TypeScript + Bulma, initial DB schema migration, basic routing.
- **In original plan.**
