# Changelog — Handshake Union

> Tracks scope changes, feature additions, and meaningful deviations from the original plan over the life of the project. Migrations and bug fixes are listed separately in `supabase/migrations/`.
>
> See [`PLAN.md`](./PLAN.md) for the full feature plan and architecture.

---

### 2026-03-21 — LinkPreview UX overhaul, pg_cron local dev fix, test script fix

- **Changed:** `LinkPreview` thumbnail and video badge are now independent — the thumbnail image always renders when available, and the video play badge is overlaid on top of it via `position: absolute` rather than replacing the image entirely. Previously video cards showed only the badge with no thumbnail.
- **Added:** `twitterCreator` surfaced as `by {creator}` in the site attribution line of the rich card, giving YouTube videos and similar content a visible author/channel credit.
- **Changed:** Content type badge repositioned to the bottom-right of the meta section (after title and description), reducing visual noise at the top of the card. `website` type continues to be suppressed.
- **Fixed:** `supabase/roles.sql` (new) — seeds `CREATE EXTENSION IF NOT EXISTS pg_cron` before any numbered migration runs. Fixes `ERROR: schema "cron" does not exist` during `supabase start` / `supabase db reset` on local development. On hosted Supabase, pg_cron is enabled via Dashboard → Database → Extensions; this file is a no-op in that context.
- **Fixed:** `scripts/test-og-preview.mjs` — `clearTimeout` moved into a `finally` block so the timer is always cancelled regardless of which error path is taken.
- **Affected:** `src/components/chat/LinkPreview.tsx`, `src/index.css`, `supabase/roles.sql` (new), `scripts/test-og-preview.mjs`.

---

### 2026-03-20 — og-preview: metadata expansion, oEmbed discovery, security hardening

- **Improved:** `og-preview` Edge Function now streams up to 150 KB (up from 100 KB) to capture meta tags on pages with large inline scripts before `</head>`.
- **Added:** YouTube / youtu.be fast-path — `youtu.be/<id>` and `youtube.com/watch?v=<id>` URLs bypass HTML scraping entirely and use YouTube's public oEmbed API (`youtube.com/oembed`), which returns structured title, thumbnail, and channel name reliably. No API key required. Falls back to HTML scraping if oEmbed fails.
- **Added:** Generic oEmbed discovery — after OG/Twitter tag extraction, if `title` or image is still missing the function looks for a `<link type="application/json+oembed">` discovery tag in the page HTML and fetches that endpoint (5 s timeout). Fills gaps in title, thumbnail, and `provider_name`. Works for WordPress (where core adds the discovery link on every post/page), Vimeo, Flickr, Soundcloud, and any other oEmbed-capable site.
- **Added:** `<title>` element fallback — if no OG or Twitter title meta tag is found, the HTML `<title>` element is used as a last resort for any site.
- **Added:** `<meta name="description">` fallback — standard HTML description meta tag added as tertiary fallback in the `description` priority chain alongside `og:description` and `twitter:description`.
- **Fixed:** `LinkPreview` anchor always targets the original `link_url`. Previously `hasVideo` caused the anchor to use `ogData.videoUrl` (page-controlled metadata), allowing a malicious HTTPS page to redirect clicks to an arbitrary destination (phishing). Now the href is always the URL the user shared.
- **Fixed:** `src/index.css` video badge hardcoded `rgba(0,0,0,0.6)` and `#fff` replaced with CSS custom properties (`--overlay`, `--text-emphasis`) per the project's no-hardcoded-colours convention.
- **Added:** `--overlay` CSS custom property added to `:root` for dark scrim/overlay use.
- **Affected:** `supabase/functions/og-preview/index.ts`, `src/components/chat/LinkPreview.tsx`, `src/index.css`.

---

### 2026-03-08 — og-preview: extended metadata fields

- **Updated:** `og-preview` Edge Function — expanded extraction to include `og:url`, `og:site_name`, `og:type`, image dimensions (`og:image:width/height/alt/type`), video fields (`og:video`, `og:video:type/width/height`), and Twitter Card fields (`twitter:card/site/creator/image:alt`). OG images now proxied server-side as base64 data URLs.
- **Updated:** `LinkPreview` component — displays video badge, site name, content type badge, and image alt text from the expanded metadata.
- **Affected:** `supabase/functions/og-preview/index.ts`, `src/components/chat/LinkPreview.tsx`, `src/index.css`.

---

### 2026-03-08 — Ban and report hash fixes (migration 036)

- **Fixed:** `ban_user()` was unconditionally overwriting `auth.users.banned_until` with the new ban's value (migration 034). A timeout ban issued after a permanent ban would downgrade `banned_until` from `'infinity'` to a future timestamp, allowing early re-login. Now derives `banned_until` from all currently active bans: `'infinity'` if any permanent ban is active, otherwise `MAX(expires_at)` across active timeout bans. Strongest ban always wins.
- **Fixed:** `report_message()` was computing the receipt hash with `'|'` separators between field digests (migration 035). The actual hash scheme (used by `create_message_receipt()` since migration 029) concatenates without separators. Reports against any message created after migration 029 always failed with "integrity error: no receipt found". Also: added the legacy 2-field hash fallback (for receipts created before migration 029), and tightened duplicate detection to use `IS NOT DISTINCT FROM` so NULL image/link fields compare correctly.
- **Note:** Migrations 034 and 035 had already been applied. These fixes are in a new migration (036) that replaces both functions via `CREATE OR REPLACE`.
- **Affected:** `supabase/migrations/036_fix_ban_and_report_hash.sql` (new).

---

### 2026-03-08 — Moderation & Admin Portal

- **Added:** `/mod` moderator portal (`Mod.tsx`) — gated by `moderator` or `admin` role via new `RoleRoute` component. Two tabs:
  - **Queue** — all moderation reports ordered pending-first, with status filter tabs. Each report card renders the message text, images inline (`<img>` with `onError` hide), and link preview cards via the existing `LinkPreview` component. One-click resolve actions (reviewed / actioned / dismiss) with optional resolution notes. Inline "ban author" form on pending reports — issue timeout (hours input) or permanent ban with reason.
  - **Bans** — active (unexpired + unlifted) bans with lift-ban button on each entry. Pending/ban counts shown as tag badges on tab labels.
- **Added:** `/admin` admin portal (`Admin.tsx`) — gated by `admin` role only. Three sections:
  - **Overview** — five stat cards: total members, active sessions (distinct user_id from `auth.sessions` not expired), pending reports, active bans, messages last 24 h.
  - **Activity** — SVG bar charts (built inline, no external charting library, terminal aesthetic) for login activity (unique logins/day) and message activity (messages/day from receipts). Day window selector: 7 / 14 / 30 / 90 days.
  - **Roles** — searchable table of all users (pseudonym, current role tag, message count, join date). Inline role dropdown per row; "apply" button appears only when a change is pending.
- **Added:** `RoleRoute` component (`src/components/auth/RoleRoute.tsx`) — wraps routes like `ProtectedRoute` but also checks `user.app_metadata.role` from the JWT. Redirects unauthenticated users to `/login`, unauthorized users to `/`. Accepts `minRole: 'moderator' | 'admin'`.
- **Added:** `useModerationReports` hook — fetches all reports + active bans in parallel via `get_all_reports()` and `get_active_bans()` RPCs. Exposes `resolveReport()`, `banUser()`, `liftBan()` actions. Error handling properly extracts `.message` from Supabase `PostgrestError` (which is not `instanceof Error`).
- **Added:** `useAdminStats` hook — fetches platform overview, login activity, message activity, and user roles in parallel. Configurable `daysBack` state triggers refetch. Exposes `assignRole()` which calls existing `assign_role()` from migration 007.
- **Added:** `user_bans` table (migration 032) — `timeout` | `permanent` bans with `expires_at` (required for timeout), `lifted_at`, `banned_by`, `lifted_by`. DB-level constraint `timeout_requires_expiry`. RLS: moderator+ SELECT/UPDATE; INSERT only via `ban_user()` SECURITY DEFINER.
- **Added:** `ban_user()`, `lift_ban()`, `get_active_bans()`, `get_all_reports()`, `resolve_report_moderated()` DB functions (migration 032) — all moderator+, all `SET search_path = ''`.
- **Fixed:** `ban_user()` and `lift_ban()` now sync with `auth.users.banned_until` (migration 034) — bans are enforced at the Supabase Auth layer (sign-in rejected, token refresh blocked), not just recorded. `lift_ban()` only clears `banned_until` if the user has no other active bans remaining. Strongest-ban preservation corrected in migration 036.
- **Added:** `get_platform_overview()`, `get_login_activity()`, `get_message_activity()`, `get_user_roles()` DB functions (migration 032) — all admin-only, aggregate only, no individual data exposed.
- **Fixed:** `resolve_report_moderated()` bug (migration 033) — migration 032 incorrectly cast `p_new_status::public.moderation_report_status`; `moderation_reports.status` is a TEXT column with a CHECK constraint (no enum type). Fixed to plain TEXT assignment.
- **Updated:** `Navbar.tsx` — `/mod` link shown in warning colour to moderators and admins; `/admin` link shown in red to admins only. Role read from `user.app_metadata.role` JWT claim.
- **Updated:** `App.tsx` — `/mod` and `/admin` routes added, wrapped in `RoleRoute`.
- **Updated:** `src/types/database.ts` — added `BanType`, `UserBan`, `ReportWithPseudonyms`, `PlatformOverview`, `ActivityDataPoint`, `UserRoleEntry` types.
- **Not in original plan** (moderator dashboard and admin dashboard were short-term roadmap items).
- **Affected:** `src/pages/Mod.tsx` (new), `src/pages/Admin.tsx` (new), `src/components/auth/RoleRoute.tsx` (new), `src/hooks/useModerationReports.ts` (new), `src/hooks/useAdminStats.ts` (new), `src/components/layout/Navbar.tsx`, `src/App.tsx`, `src/types/database.ts`, migrations 032–036.

---

### 2026-03-08 — Link sharing with Open Graph preview

- **Added:** Messages can now include an optional HTTPS link (`link_url` column on `messages`). Max one link per message; `https://` required; max 2048 chars. Enforced at DB level via CHECK constraint (migration 028).
- **Added:** `og-preview` Supabase Edge Function — fetches the target URL server-side (5 s timeout, `AbortController`), extracts Open Graph meta tags (`og:title`, `og:description`, `og:image`), falls back to Twitter Card equivalents (`twitter:title`, etc.). Authenticated callers only: JWT role checked via the Supabase gateway. (Metadata fields, byte limit, and timeout subsequently expanded — see 2026-03-20 entry.)
- **Added:** `LinkPreview` component (`src/components/chat/LinkPreview.tsx`) — renders an OG preview card in each message and inside the `MessageInput` link attachment bar. Module-level `ogCache` Map + `pending` deduplication Map prevent redundant edge function calls for the same URL. Skeleton loading state mirrors the rich card layout. 30 s client-side timeout falls back to a plain domain + URL card.
- **Added:** Live debounced preview in `MessageInput` — 500 ms debounce on the effective link URL (from text or manual bar) shows how the preview will appear before sending.
- **Added:** Inline URL auto-detection — `https://` URLs typed directly in the message body are extracted with a trailing-punctuation strip regex. The OG preview card appears automatically below the input without opening the 🔗 link bar. Manual bar takes priority if open with content.
- **Added:** Multi-link validation — if more than one distinct `https://` URL is detected across the message text and the manual link bar, send is blocked and an amber warning asks the user to post each link in a separate message.
- **Added:** `link_url` included in receipt hash — `create_message_receipt()` and `report_message()` now hash content + image_url + link_url using the existing per-field double-SHA256 scheme (migration 029). `verify_message_authenticity()` updated to accept `alleged_link_url TEXT DEFAULT NULL` for backward compatibility (migration 030).
- **Fixed:** Migration 028 had two bugs: `SET search_path = ''` hides `extensions.digest()`, and the old `chr(0)` separator scheme was used. Both corrected in migration 029. Functions calling `extensions.digest()` use `SET search_path = 'public, extensions'` — documented exception to the `''` rule.
- **Not in original plan.**
- **Affected:** `src/components/chat/LinkPreview.tsx` (new), `src/components/chat/Message.tsx`, `src/components/chat/MessageInput.tsx`, `src/contexts/ChatContext.tsx`, `src/types/database.ts`, `src/index.css`, `supabase/functions/og-preview/index.ts` (new), migrations 028–030.

---

### 2026-03-02 — Cloudflare Turnstile bot protection

- **Added:** Cloudflare Turnstile CAPTCHA on the login page (`/login`) only. Prevents automated account creation and magic link flooding. Token is passed to `supabase.auth.signInWithOtp()` via `options.captchaToken` and verified server-side by Supabase against the Turnstile secret key.
- **Added:** `VITE_TURNSTILE_SITE_KEY` environment variable. Secret key configured in Supabase Auth → Bot and Abuse Protection.
- **Added:** `@marsidev/react-turnstile` dependency. Widget renders with dark theme between the email input and submit button. Submit is disabled until challenge resolves. On auth error the widget auto-resets so the user can retry.
- **Updated:** `Privacy.tsx` — removed false "Cloudflare Turnstile not enabled" claim; added full Turnstile section documenting what data is collected (IP, browser signals, user-agent), its login-only scope, and links to Cloudflare's Turnstile privacy docs.
- **Updated:** `README.md`, `PLAN.md`, `AGENTS.md` — security model, setup instructions, and invariants updated to reflect Turnstile use.
- **Affected:** `Login.tsx`, `Privacy.tsx`, `.env.example`, `README.md`, `PLAN.md`, `AGENTS.md`, `package.json`, `public/_headers`.

---

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

---

### 2026-02-27 — Cursor-based chat pagination

- **Added:** `ChatContext` now fetches only the most recent 50 messages on room join (`PAGE_SIZE = 50`, `ORDER BY created_at DESC LIMIT PAGE_SIZE + 1`, reversed for display). The extra `+1` fetch is used to determine whether an older page exists without a separate count query.
- **Added:** `loadOlderMessages()` — fetches the previous page using the oldest loaded `created_at` as a cursor (`lt('created_at', cursor)`). Prepends results to the message list.
- **Added:** `hasMoreMessages` and `loadingOlder` states surfaced through `ChatContext` and `MessageList` props.
- **Added:** Scroll-to-top detection in `MessageList` — triggers `loadOlderMessages()` automatically when the user scrolls within 80px of the top. A manual "↑ load older messages" button is also shown.
- **Added:** Scroll anchor in `MessageList` — saves `{ scrollHeight, scrollTop }` before prepending and restores position via `useLayoutEffect` after the DOM commits, so the viewport stays anchored to the same message.
- **Fixed:** Client-side expiry prune interval was incorrectly set to 6 hours (matching the old retention window). Now correctly aligned to 72 hours. Prune runs every 60 seconds (was 30).
- **Rationale:** With 72-hour retention, loading all messages at once would be expensive and would degrade UX (especially on mobile). Pagination keeps the initial load fast and the DOM small.
- **Affected:** `ChatContext.tsx`, `MessageList.tsx`, `Chat.tsx`, `index.css`.

---

### 2026-02-26 — Message retention extended: 6 hours → 72 hours

- **Changed:** `cleanup-old-messages` cron interval updated from `6 hours` to `72 hours` (migration 023).
- **Rationale:** 72-hour window better supports async participation and gives meaningful conversation context without abandoning ephemerality. Storage impact is negligible (~5–10 MB at thriving scale).
- **Affected:** `PLAN.md`, `README.md`, `AGENTS.md`, `Chat.tsx`, `Home.tsx`, `Members.tsx`, `Privacy.tsx`, security considerations copy.
- **Branch:** `feature/72h-message-retention`

---

### 2026-02-20 — Message retention extended: 1 hour → 6 hours

- **Changed:** `cleanup-old-messages` cron interval updated from `1 hour` to `6 hours` (migration 022).
- **Rationale:** 1-hour window felt too short for async participation across timezones; 6 hours preserves ephemerality while making conversations more useful.
- **Affected:** `PLAN.md`, `README.md`, `ChatContext.tsx` (fetch window + client-side prune interval), `Chat.tsx`, `Home.tsx`, `Members.tsx`, security considerations copy.
- **Branch:** `feat/6h-message-retention`

---

### 2026-02-20 — Image URL attachments with blur/reveal mode

- **Added:** Messages can now include an attached image via HTTPS URL. Images render inline with a blur-by-default / click-to-reveal toggle to protect users from unexpected content.
- **Added:** Global image display mode toggle in the chat toolbar (blurred / visible for all).
- **Added:** `image_url` column on `messages` table (migration 017). URL integrity guards added (migration 018).
- **Added:** Receipt hash integrity fixes for image-inclusive messages (migrations 019, 020, 021).
- **Rationale:** User-requested UX improvement; URL-only approach avoids server-side storage and keeps the stack simple.
- **Not in original plan.**

---

### 2026-02-20 — Community scope broadened (non-AU)

- **Changed:** Removed Australia-centric language from home page and descriptions. Platform is open to any developer regardless of geography.
- **Rationale:** Unnecessary to restrict early; global scope increases data richness and network effects.

---

### 2026-02-19 — Cloudflare Pages deployment config

- **Added:** `wrangler.toml` for Cloudflare Workers/Pages static SPA deployment to `handshakeunion.nexus`.
- **Added:** README with project ethos, feature overview, and industry data sources.
- **Not in original plan** (original plan listed Vercel or Cloudflare Pages as options; Cloudflare chosen).

---

### 2026-02-18 — Phase 5: Stats dashboard

- **Completed:** Full aggregate stats dashboard with SVG salary progression chart, distribution bar charts, sample size guards, and seeded 2025 Australian developer baseline data.
- **In original plan.**

---

### 2026-02-18 — Phase 4: Chat

- **Completed:** Realtime chat with three rooms, reply threading, emoji reactions, custom emotes, report button, delete own messages, PixelAvatar display.
- **In original plan.**

---

### 2026-02-18 — Phase 3.75: Chat integrity and roles (scope addition)

- **Added:** Cryptographic receipt system — SHA-256 hash of every message, stored automatically, admin-only access.
- **Added:** Moderation reports — machine-copy content snapshot linked to receipt for tamper-evident verification.
- **Added:** Three-tier RBAC (member / moderator / admin) via JWT `app_metadata` claims.
- **Added:** `report_message()`, `resolve_report()`, `assign_role()`, `verify_message_receipt()` DB functions.
- **Rationale:** Moderation integrity was identified as a core trust requirement before launch; doing it right meant a full phase.
- **Not in original plan as a separate phase** (moderation noted briefly in MVP but not scoped).

---

### 2026-02-18 — Phase 3.5: Profile and privacy (scope addition)

- **Added:** Profile page (`/profile`) — view and edit work details post-onboarding.
- **Added:** PixelAvatar — deterministic 5×5 pixel art avatars from pseudonym hash (pure SVG, no external service).
- **Added:** Pseudonym rename with two-step privacy warning.
- **Added:** Profile history snapshots (`profile_snapshots` table) — auto-captured via trigger for trend data.
- **Added:** Privacy lockdown — profiles restricted to own-row-only reads; stats via aggregate functions only.
- **Added:** Search path security on all DB functions (`SET search_path = ''`).
- **Rationale:** Privacy posture and user identity controls were too important to defer; built before chat to get the data model right.
- **Not in original plan as a separate phase.**

---

### 2026-02-18 — Phases 1–3: Foundation, auth, onboarding

- **Completed:** Project setup, Supabase schema (migrations 001–005), React routing, terminal aesthetic theme, magic link auth, onboarding form with all fields.
- **In original plan.**

---

### 2026-02-14 — Project initialised

- **Created:** Initial project scaffold — Vite + React + TypeScript + Bulma, initial DB schema migration, basic routing.
- **In original plan.**
