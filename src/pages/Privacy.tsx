const ACCENT = { color: 'var(--accent)' } as const;
const LINK = { color: 'var(--link)' } as const;

function Arrow() {
  return <span style={ACCENT}>→</span>;
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={LINK}>
      {children}
    </a>
  );
}

export function Privacy() {
  return (
    <section className="section">
      <div className="container">
        <div className="columns is-centered">
          <div className="column is-8">

            <p className="prompt">privacy &amp; third-party services</p>
            <p className="comment">last updated: 2026-02-20</p>

            <hr className="term-divider" />

            <p>
              handshake union does not run its own analytics, does not set first-party
              tracking cookies, and does not sell or share user data. pseudonyms are
              auto-assigned — no real name is stored or required. the sections below
              document every third-party service this application connects to, what data
              each service receives, and what it does with it.
            </p>

            <br />
            <p className="comment">third-party services in use:</p>
            <br />

            {/* ── CLOUDFLARE ───────────────────────────────────────────────── */}
            <p className="prompt">cloudflare</p>
            <p>
              The entire application is served through{' '}
              <ExternalLink href="https://www.cloudflare.com">Cloudflare</ExternalLink>
              's network (CDN, DDoS protection, and Cloudflare Workers edge compute).
              Every HTTP request your browser makes to this site passes through Cloudflare
              before reaching our infrastructure. As a network intermediary Cloudflare
              necessarily processes the following data:
            </p>
            <br />
            <p className="comment">data cloudflare receives on each request:</p>
            <p><Arrow /> IP address — used for routing, DDoS mitigation, and abuse detection</p>
            <p><Arrow /> HTTP request metadata — URL path, method, headers (user-agent, referer, accept-language), timestamps</p>
            <p><Arrow /> TLS handshake data — Cloudflare terminates TLS at the edge; payload content transits their infrastructure</p>
            <p><Arrow /> Geographic region inferred from IP — used for routing to the nearest edge node</p>
            <p><Arrow /> Network Data — Cloudflare generates aggregated, non-personal threat intelligence from traffic patterns (error rates, cache rates, IP reputation scores)</p>
            <br />
            <p className="comment">what is NOT enabled on this site:</p>
            <p><Arrow /> Cloudflare Web Analytics (no analytics beacon injected into pages)</p>
            <p><Arrow /> Cloudflare Browser Insights (no performance monitoring beacon)</p>
            <p><Arrow /> Cloudflare Zaraz (no tag manager)</p>
            <p><Arrow /> Cloudflare Turnstile or CAPTCHA</p>
            <br />
            <p>
              Cloudflare commits in its privacy policy not to sell personal data and not
              to use End User data for its own marketing. Cloudflare is certified under
              the EU-U.S. Data Privacy Framework, the UK Extension, and the Swiss-U.S.
              DPF, providing transfer safeguards for EU/UK/Swiss residents.
            </p>
            <br />
            <p>
              <ExternalLink href="https://www.cloudflare.com/privacypolicy/">
                Cloudflare privacy policy →
              </ExternalLink>
            </p>

            <hr className="term-divider" />

            {/* ── GIPHY ────────────────────────────────────────────────────── */}
            <p className="prompt">GIPHY</p>
            <p>
              The GIF picker is powered by{' '}
              <ExternalLink href="https://giphy.com">GIPHY</ExternalLink>{' '}
              (owned by Shutterstock, Inc. since 2023). All API requests are made
              directly from your browser to GIPHY's servers — they do not pass through
              our backend. This means <strong>your IP address is visible to GIPHY</strong>{' '}
              every time you interact with the GIF picker.
            </p>
            <br />
            <p className="comment">when your browser contacts giphy directly:</p>
            <p><Arrow /> <strong>opening the picker</strong> — trending GIFs are fetched; GIPHY receives your IP, user-agent, and a session random ID</p>
            <p><Arrow /> <strong>searching</strong> — your search query is sent to GIPHY's search API along with your IP and random ID</p>
            <p><Arrow /> <strong>loading GIF previews</strong> — images load from GIPHY's CDN domains (media0.giphy.com etc.), exposing your IP to GIPHY's CDN</p>
            <p><Arrow /> <strong>analytics pingbacks</strong> — three fire-and-forget GET requests to GIPHY's analytics endpoint:</p>
            <p style={{ paddingLeft: '1.5rem' }}><Arrow /> <strong>onload</strong> — when a GIF becomes visible in the grid</p>
            <p style={{ paddingLeft: '1.5rem' }}><Arrow /> <strong>onclick</strong> — when you tap/click a GIF to select it</p>
            <p style={{ paddingLeft: '1.5rem' }}><Arrow /> <strong>onsent</strong> — after a message containing a GIF is successfully delivered</p>
            <br />
            <p className="comment">what each analytics pingback includes:</p>
            <p><Arrow /> an encoded analytics payload provided by GIPHY identifying the GIF and interaction type</p>
            <p><Arrow /> a Unix timestamp (<code>ts</code>) of when the event occurred</p>
            <p><Arrow /> a session-scoped random ID (<code>random_id</code>) fetched from GIPHY's Random ID endpoint at page load — this is not linked to your pseudonym or any personal identity, and resets each page load</p>
            <p><Arrow /> your IP address (implicit in the HTTP request)</p>
            <br />
            <p className="comment">additional giphy data practices to be aware of:</p>
            <p><Arrow /> GIPHY automatically collects IP address, device ID, and cookie information on API interactions per their policy</p>
            <p><Arrow /> GIPHY uses Google Analytics on their own platform</p>
            <p><Arrow /> GIPHY uses web beacons and advertising technologies and may serve targeted ads based on usage patterns</p>
            <p><Arrow /> GIPHY explicitly states it does not honour browser "Do Not Track" signals</p>
            <p><Arrow /> GIPHY retains personal data for as long as necessary per their policy; some aggregate data is retained indefinitely</p>
            <br />
            <p>
              handshake union does not store which GIFs you searched for or viewed.
              only the final GIF URL included in a sent message is persisted (in Supabase,
              see below), subject to the same 6-hour expiry as all messages.
            </p>
            <br />
            <p>
              <ExternalLink href="https://giphy.com/privacy">
                GIPHY privacy policy →
              </ExternalLink>
            </p>

            <hr className="term-divider" />

            {/* ── SUPABASE ─────────────────────────────────────────────────── */}
            <p className="prompt">supabase</p>
            <p>
              Authentication, message storage, and real-time delivery are provided by{' '}
              <ExternalLink href="https://supabase.com">Supabase</ExternalLink>.
              Supabase acts as a <strong>data processor</strong> on our behalf under its
              Data Processing Addendum (DPA), hosting our project on Amazon Web Services
              infrastructure. The data Supabase processes is governed by our instructions
              and their DPA.
            </p>
            <br />

            <p className="comment">authentication</p>
            <p>
              Three sign-in methods are offered. Each involves different data flows:
            </p>
            <br />
            <p><Arrow /> <strong>email magic link</strong> — your email address is sent to Supabase Auth, which stores it and uses it to send a one-time login link via a transactional email service. your email is associated with your account in Supabase's database.</p>
            <p><Arrow /> <strong>github oauth</strong> — you are redirected to GitHub to authenticate. GitHub shares a subset of your GitHub profile (email address, GitHub username, avatar URL, provider user ID) with Supabase. this is subject to{' '}
              <ExternalLink href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub's privacy policy</ExternalLink>.
            </p>
            <p><Arrow /> <strong>gitlab oauth</strong> — same as above, via{' '}
              <ExternalLink href="https://about.gitlab.com/privacy/">GitLab</ExternalLink>.
            </p>
            <br />
            <p>
              in all cases, a pseudonym is auto-assigned and your real identity is never
              displayed to other users. auth session tokens (JWTs) are stored in your
              browser's local storage by Supabase's client library.
            </p>
            <br />

            <p className="comment">message storage</p>
            <p><Arrow /> message content, room, timestamp, your profile ID, and any attached image URL are stored in Supabase's PostgreSQL database</p>
            <p><Arrow /> all messages are automatically deleted after 6 hours via a server-side expiry job</p>
            <p><Arrow /> reply relationships and reactions are stored and expire with the associated messages</p>
            <br />

            <p className="comment">realtime</p>
            <p><Arrow /> your browser maintains a persistent WebSocket connection to Supabase Realtime for live message delivery</p>
            <p><Arrow /> Supabase Realtime logs connection metadata (IP, connection duration) at the infrastructure level for operational purposes</p>
            <br />

            <p className="comment">supabase platform observability</p>
            <p><Arrow /> Supabase logs database query metadata, API request logs, and connection events as part of normal platform operations</p>
            <p><Arrow /> these logs are used for debugging, security monitoring, and service reliability — not for advertising</p>
            <p><Arrow /> data is hosted on AWS in the region configured for this project</p>
            <p><Arrow /> Supabase may share data with its sub-processors (AWS, Google Cloud, Stripe, Hubspot, and others listed in their DPA) where necessary to operate the platform</p>
            <br />
            <p>
              <ExternalLink href="https://supabase.com/privacy">
                Supabase privacy policy →
              </ExternalLink>
              {' · '}
              <ExternalLink href="https://supabase.com/legal/dpa">
                Supabase DPA →
              </ExternalLink>
            </p>

            <hr className="term-divider" />

            <p className="comment">your rights</p>
            <p>
              if you want your account and messages deleted, contact us via the GitHub
              repository. messages expire automatically after 6 hours. to exercise rights
              over data held by Cloudflare, GIPHY, or Supabase directly, contact those
              services using the links above.
            </p>
            <br />
            <p className="comment">questions?</p>
            <p>
              this project is open source — you can verify every data flow described here.{' '}
              <ExternalLink href="https://github.com/inkiebeard/handshake-union">
                read the source →
              </ExternalLink>
            </p>

          </div>
        </div>
      </div>
    </section>
  );
}
