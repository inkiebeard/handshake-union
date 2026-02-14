# Handshake Union — Project Plan

> handshakeunion.nexus
>
> Anonymous community platform for Australian developers to share workplace intel and build collective power.
> A refuge for devs being squeezed by AI hype and corporate individualism. Humans verifying humans.

## Project Goals

**Primary Goal:** Prove there's appetite for an anonymous developer solidarity platform in Australia.

**Success Metrics for POC:**
- Can we get 20+ people to sign up and share basic work info?
- Do conversations actually happen organically?
- Does the salary/conditions data start to show interesting patterns?

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
- 1 hour message history max (ephemeral by design)
- Basic threading/replies
- Emoji reactions
- Shows pseudonym, not real identity
- Real-time via Supabase subscriptions

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
- Aggregate view of community data
- Compare against baseline "industry standard" data
- Simple charts: salary by experience, WFH distribution, etc.
- Show sample sizes so people understand statistical significance

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | React 18 + TypeScript | Familiar, fast iteration |
| Styling | Bulma CSS | Clean, simple, no build step |
| Routing | React Router | Standard, simple |
| Backend/DB | Supabase | Auth, Postgres, Realtime, Row Level Security |
| Hosting (Frontend) | Vercel or Cloudflare Pages | Free tier, easy deploys |
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
│   │   │   ├── LoginForm.tsx
│   │   │   ├── OAuthButtons.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── chat/
│   │   │   ├── ChatRoom.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   ├── Message.tsx
│   │   │   └── ReactionPicker.tsx
│   │   ├── onboarding/
│   │   │   └── OnboardingForm.tsx
│   │   └── stats/
│   │       ├── StatsOverview.tsx
│   │       ├── SalaryChart.tsx
│   │       └── ComparisonCard.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProfile.ts
│   │   ├── useMessages.ts
│   │   └── useStats.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── constants.ts
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── AuthCallback.tsx
│   │   ├── Chat.tsx
│   │   ├── Onboarding.tsx
│   │   └── Stats.tsx
│   ├── types/
│   │   └── database.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
├── .gitignore
├── LICENSE (AGPL-3.0)
└── README.md
```

---

## Database Schema

### Tables

**profiles**
```sql
- id: uuid (FK to auth.users)
- pseudonym: text (unique, auto-generated)
- created_at: timestamp
- updated_at: timestamp
- onboarding_complete: boolean
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

### Row Level Security

- **profiles**: Users can read all, update only their own
- **messages**: Authenticated users can read all, insert own, delete own
- **reactions**: Authenticated users can read all, insert/delete own
- **baseline_stats**: Authenticated users can read all

### Realtime

Enable Supabase Realtime for:
- `messages` table
- `reactions` table

### Cleanup Job

Supabase cron or edge function to delete messages older than 1 hour.

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
2. See last 1 hour of messages
3. Real-time updates as new messages arrive
4. Type message → send
5. Click reactions on others' messages
6. Reply to specific messages (optional)
```

### Flow 4: View Stats
```
1. Click "Stats" in nav
2. See aggregate data from community
3. See baseline industry data for comparison
4. Filter by role, experience level, etc.
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Project setup (Vite, React, TypeScript, Bulma)
- [ ] Supabase project creation
- [ ] Database schema migration
- [ ] Basic routing structure
- [ ] Layout components (Navbar, Footer)

### Phase 2: Authentication
- [ ] Supabase client setup
- [ ] Magic link login
- [ ] GitHub OAuth
- [ ] GitLab OAuth
- [ ] Auth callback handling
- [ ] Protected routes
- [ ] Auto-pseudonym generation

### Phase 3: Onboarding
- [ ] Onboarding form component
- [ ] Form validation
- [ ] Profile update logic
- [ ] Skip option (can complete later)

### Phase 4: Chat
- [ ] Chat room component
- [ ] Message list with realtime subscription
- [ ] Message input
- [ ] Room switching (tabs)
- [ ] Reply threading (basic)
- [ ] Emoji reactions

### Phase 5: Stats
- [ ] Stats overview page
- [ ] Aggregate queries
- [ ] Simple visualizations (can use basic CSS charts or a lightweight lib)
- [ ] Baseline data comparison

### Phase 6: Polish & Deploy
- [ ] Error handling
- [ ] Loading states
- [ ] Mobile responsiveness
- [ ] Deploy to Vercel/Cloudflare
- [ ] README documentation
- [ ] Test with small group

---

## Security Considerations

- **No passwords stored** — magic links and OAuth only
- **Pseudonymous by default** — real identity never exposed
- **Row Level Security** — database-level access control
- **Ephemeral messages** — 1 hour TTL reduces long-term risk
- **Open source** — code is auditable
- **No analytics/tracking** — no third-party scripts
- **HTTPS only** — enforced by hosting provider

---

## Future Considerations (Post-POC)

If the POC shows demand, consider:

### Hosting & Sustainability
- **Self-hosted Supabase** — migrate off free tier to own infrastructure
- **Cost transparency dashboard** — show real hosting costs publicly
- **Community funding** — donation mechanisms (GitHub Sponsors, Open Collective, direct)
- **Funding visibility** — display donations vs costs so community sees sustainability

### Features
- **E2E encryption for DMs** (if we add DMs)
- **Invite-only growth** (web of trust)
- **More granular stats** (by company size, industry, location)
- **Resource library** (templates, know-your-rights info)
- **Integration with Professionals Australia** or similar
- **Mobile app** (React Native or PWA)
- **Moderation tools** (reports, timeouts)
- **LLM-assisted moderation** (flag problematic content)

---

## Open Questions

1. **Pseudonym customization?** — Let users pick their own pseudonym or keep it random?
2. **Room creation?** — Just the three rooms, or let users create more?
3. **Verification tiers?** — Some way to mark "verified developer" without deanonymizing?
4. **Salary data granularity?** — Bands vs actual numbers? Bands are safer for anonymity.
5. **Geographic granularity?** — State level? City level? Just country for now?

---

## License

AGPL-3.0 — Ensures the code remains open even if someone forks and runs their own instance.
