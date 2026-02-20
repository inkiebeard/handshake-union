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
              handshake union does not run its own analytics, does not set tracking cookies,
              and does not sell or share user data. pseudonyms are auto-assigned and no real
              identity is stored by this application.
            </p>

            <br />

            <p className="comment">third-party services in use:</p>

            <br />

            {/* Cloudflare */}
            <p className="prompt">cloudflare</p>
            <p>
              This site is served through{' '}
              <a
                href="https://www.cloudflare.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--link)' }}
              >
                Cloudflare
              </a>{' '}
              (CDN, DDoS protection, and edge workers). As a network intermediary, Cloudflare
              may process request metadata such as IP addresses and user-agent strings in order
              to route traffic and protect against abuse. This processing is governed by
              Cloudflare's own privacy policy. This site does not enable Cloudflare Web
              Analytics or any Cloudflare tracking beacons.
            </p>
            <br />
            <p>
              <span className="comment">what Cloudflare may collect:</span>
            </p>
            <p><span style={{ color: 'var(--accent)' }}>→</span> IP address (for routing and abuse protection)</p>
            <p><span style={{ color: 'var(--accent)' }}>→</span> HTTP request metadata (user-agent, referrer, timestamps)</p>
            <p><span style={{ color: 'var(--accent)' }}>→</span> this data is retained and processed by Cloudflare, not by us</p>
            <br />
            <p>
              <a
                href="https://www.cloudflare.com/privacypolicy/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--link)' }}
              >
                Cloudflare privacy policy →
              </a>
            </p>

            <hr className="term-divider" />

            {/* GIPHY */}
            <p className="prompt">GIPHY</p>
            <p>
              The GIF picker is powered by{' '}
              <a
                href="https://giphy.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--link)' }}
              >
                GIPHY
              </a>
              . When you open the GIF picker, search for GIFs, or send a GIF in a message,
              requests are made directly from your browser to the GIPHY API. GIPHY's analytics
              endpoints are called to register the following events:
            </p>
            <br />
            <p><span style={{ color: 'var(--accent)' }}>→</span> <strong>view</strong> — when a GIF loads in the search grid</p>
            <p><span style={{ color: 'var(--accent)' }}>→</span> <strong>click</strong> — when you select a GIF from the grid</p>
            <p><span style={{ color: 'var(--accent)' }}>→</span> <strong>sent</strong> — when a message containing a GIF is successfully delivered</p>
            <br />
            <p>
              These pingbacks are used by GIPHY to improve search relevance. A session-scoped
              random ID (fetched from GIPHY's Random ID endpoint) is included with API requests
              as a privacy-safe proxy — it is not linked to your pseudonym or any personal
              identity, and a new one is generated each page load. No GIF picker data is stored
              by handshake union.
            </p>
            <br />
            <p>
              <a
                href="https://support.giphy.com/hc/en-us/articles/360032872931-GIPHY-Privacy-Policy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--link)' }}
              >
                GIPHY privacy policy →
              </a>
            </p>

            <hr className="term-divider" />

            {/* Supabase */}
            <p className="prompt">supabase</p>
            <p>
              Authentication and message storage are provided by{' '}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--link)' }}
              >
                Supabase
              </a>
              . Supabase processes authentication tokens and stores ephemeral messages
              (auto-deleted after 6 hours). No real names or identifying information are
              required or stored — only your auto-assigned pseudonym and anonymised profile ID.
            </p>
            <br />
            <p>
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--link)' }}
              >
                Supabase privacy policy →
              </a>
            </p>

            <hr className="term-divider" />

            <p className="comment">questions?</p>
            <p>
              this project is open source.{' '}
              <a
                href="https://github.com/inkiebeard/handshake-union"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--link)' }}
              >
                read the source →
              </a>
            </p>

          </div>
        </div>
      </div>
    </section>
  );
}
