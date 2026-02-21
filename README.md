# Handshake Union

> **[handshakeunion.nexus](https://handshakeunion.nexus)**
>
> Anonymous community platform for developers to share workplace intel and build collective power.

> [!IMPORTANT]  
> No fiefs. Nor Algorithm. The guild is us.

---

## What is this?

Developers are getting squeezed. AI is an impressive and accelerating tool, but the real insidious side of the AI hype is when it starts being used to justify hiring freezes, salary stagnation, and increasing workloads. Corporate individualism keeps us isolated — we don't know what our peers earn, we don't share conditions, and we negotiate alone.

Handshake Union is a refuge. A place to compare notes, vent, and to go back to the roots of the internet where real people talked to real people. It's a place to realise you're not the only one feeling it.

**It's not a union in the legal sense.** It's a community of people who believe that information is power, and that sharing it makes all of us stronger.

---

## What it does

- **Anonymous chat** — three rooms (`#general`, `#memes`, `#whinge`) with 6-hour ephemeral messages. Supports image attachments (blur-by-default), emoji reactions, custom emotes, and reply threading. No logs, just anonymous cryptographic receipts of message integrity. Receipts help to prove or disprove a message existed (or didn't) without retaining it. Receipts are also used to report messages that violate the code of conduct.
- **Salary & conditions data** — share your band, role, experience, WFH status and employment type. All optional. All aggregate-only — no individual data is ever exposed.
- **Stats dashboard** — see salary distributions, role breakdowns, WFH trends, and compare against industry baselines. Salary data hidden until we have enough members to protect privacy (n≥30).
- **Pseudonymous identity** — you're auto-assigned a pseudonym like `worker_a7f3b2`. You can rename it. Nobody knows who you really are (unless you want to tell them).
- **Members directory** — public-safe member stats (pseudonym, tenure, message count, profile completeness). No salary or conditions data exposed.

---

## Ethos

**Information asymmetry is a corporate tool.** Employers know the market rate. You often don't. They know what your colleagues earn. You don't. That asymmetry is deliberate, and it costs you.

**Collective knowledge is the counter.** When enough people share what they're paid and how they're treated, patterns emerge. That information belongs to the community that created (and lives by) it.

**Privacy is non-negotiable.** We don't want your real name. We can't correlate your pseudonym to your identity. Stats are aggregate-only with sample size guards. Messages are deleted after 6 hours. The platform is open source and auditable.

**No engagement hacking.** No likes on profiles, no follower counts, no algorithmic amplification. Just people talking.

---

## Industry Data Sources

The stats dashboard includes baseline salary data for comparison. Sources:

| Source | Description | Link |
|--------|-------------|------|
| **SEEK Career Insights** | Salary data by role and location across Australia, sourced from job ads | [seek.com.au/career-advice/role/software-engineer/salary](https://www.seek.com.au/career-advice/role/software-engineer/salary) |
| **SEEK Advertised Salary Index** | Monthly index tracking advertised salary trends nationally | [talent.seek.com.au/market-insights](https://talent.seek.com.au/market-insights/article/seek-advertised-salary-index-december-2025) |
| **Professionals Australia — Tech Remuneration Report** | Annual tech, software and IT employment and remuneration survey | [professionalsaustralia.org.au — Tech Report 2024](https://www.professionalsaustralia.org.au/Web/Campaigns/Reports/Tech_Remuneration_Report_2024/Web/Campaigns/Reports/Tech-Remuneration-Report-2024.aspx?hkey=6c7e1677-b0de-4181-b49b-b29ce8dc6bfc) |
| **ACS Digital Pulse** | Australian Computer Society annual tech workforce and salary report (produced with Deloitte) | [acs.org.au/campaign/digital-pulse.html](https://www.acs.org.au/campaign/digital-pulse.html) |
| **Hays Salary Guide FY25/26** | Annual salary benchmarks across IT roles in Australia, 1000+ roles | [hays.com.au/salary-guide/information-technology](https://www.hays.com.au/salary-guide/information-technology/) |
| **Robert Half Salary Guide** | Tech and finance salary benchmarks for Australia | [roberthalf.com/au — Technology](https://www.roberthalf.com/au/en/insights/salary-guide/technology) |
| **ABS Labour Force Survey** | Official government employment and unemployment statistics | [abs.gov.au — Labour Force](https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia) |

The baseline data seeded in the platform is derived from these sources and reflects 2025 figures for Australian developers. It is intentionally imprecise — salary bands rather than point estimates — to align with the privacy-first approach of the community data.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Bulma CSS |
| Backend / DB | Supabase (Postgres + Auth + Realtime + RLS) |
| Hosting | Cloudflare Workers Page |

---

## Running locally

### Prerequisites

- Node.js 22+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Cloudflare](https://cloudflare.com) account (for deployment only — not needed for local dev)

### Setup

```bash
git clone https://github.com/your-org/handshake-union.git
cd handshake-union
nvm use
npm install
```

Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable key:

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key-here
```

### Database

Run the migrations in order against your Supabase project via the SQL editor or `supabase db push`:

```
supabase/migrations/
  001_initial_schema.sql
  002_varied_pseudonyms.sql
  003_fix_search_path.sql
  004_profile_history.sql
  005_privacy_lockdown.sql
  006_chat_integrity.sql
  007_roles.sql
  008_fix_snapshot_triggers.sql
  009_fix_digest_search_path.sql
  010_fix_digest_extensions_schema.sql
  011_broadcast_triggers.sql
  012_fix_reactions_broadcast.sql
  013_custom_emotes.sql
  014_seed_baseline_stats.sql
  015_enable_cron_cleanup.sql
  016_public_member_stats.sql
  017_messages_image_url.sql
  018_image_url_integrity.sql
  019_fix_digest_search_path.sql
  020_fix_receipt_hash_separator.sql
  021_fix_verify_functions_hash.sql
  022_update_message_retention_6h.sql
```

For message cleanup (6-hour TTL), you'll need to activate `pg_cron` in your Supabase project (Database → Extensions → pg_cron) and run the cron setup from migration 015, then apply migration 022 to set the correct retention interval.

### Start the dev server

```bash
npm run dev
```

---

## Security model

- **No passwords** — magic links and OAuth only
- **Pseudonymous by default** — real identity is never stored or exposed
- **Row Level Security** — all data access enforced at the database level
- **Profiles are private** — users can only read their own profile row; stats are exposed via aggregate functions only
- **Ephemeral messages** — deleted after 6 hours
- **Cryptographic receipts** — SHA-256 hash of every message stored automatically. No readable content, invisible to all user-facing roles. Enables tamper-evident screenshot verification without retaining message content.
- **Moderation reports** — machine-copy content from the database (never user-provided), linked to receipts for tamper-evident verification, hard-deleted after 30 days
- **Search path hardened** — all DB functions use `SET search_path = ''`
- **Open source** — the code is auditable. If the privacy model is wrong, you can see exactly where.

---

## Proof of concept goals

- 20-30+ people sign up and share basic work info
- Conversations happen organically
- Salary/conditions data starts to show patterns

If it works, we grow it. If it doesn't, at least the code is open for someone else to build on.

---

## License

[AGPL-3.0](./LICENSE) — Ensures the code stays open even if someone forks and runs their own instance.
