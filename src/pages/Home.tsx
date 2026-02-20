import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PixelAvatar } from '../components/PixelAvatar';

const ASCII_ART = String.raw` __  __     ______     __   __     _____     ______     __  __     ______     __  __     ______        __  __     __   __     __     ______     __   __    
/\ \_\ \   /\  __ \   /\ "-.\ \   /\  __-.  /\  ___\   /\ \_\ \   /\  __ \   /\ \/ /    /\  ___\      /\ \/\ \   /\ "-.\ \   /\ \   /\  __ \   /\ "-.\ \   
\ \  __ \  \ \  __ \  \ \ \-.  \  \ \ \/\ \ \ \___  \  \ \  __ \  \ \  __ \  \ \  _"-.  \ \  __\      \ \ \_\ \  \ \ \-.  \  \ \ \  \ \ \/\ \  \ \ \-.  \  
 \ \_\ \_\  \ \_\ \_\  \ \_\\"\_\  \ \____-  \/\_____\  \ \_\ \_\  \ \_\ \_\  \ \_\ \_\  \ \_____\     \ \_____\  \ \_\\"\_\  \ \_\  \ \_____\  \ \_\\"\_\ 
  \/_/\/_/   \/_/\/_/   \/_/ \/_/   \/____/   \/_____/   \/_/\/_/   \/_/\/_/   \/_/\/_/   \/_____/      \/_____/   \/_/ \/_/   \/_/   \/_____/   \/_/ \/_/ 
` + '                                                                                          v0.1';

export function Home() {
  const { user } = useAuth();

  return (
    <section className="section">
      <div className="container">
        <div className="columns is-centered">
          <div className="column is-8">

            <pre className="ascii-art">{ASCII_ART}</pre>

            <hr className="term-divider" />

            <p className="prompt">Anonymous community for developers</p>
            <p className="comment">share workplace intel. build collective power.</p>

            <br />

            <p className="comment">how it works:</p>
            <p><span style={{ color: 'var(--accent)' }}>→</span> pseudonymous — auto-assigned identity, no names</p>
            <p><span style={{ color: 'var(--accent)' }}>→</span> ephemeral — messages expire after 1 hour</p>
            <p><span style={{ color: 'var(--accent)' }}>→</span> transparent — real salary data, real conditions</p>
            <p><span style={{ color: 'var(--accent)' }}>→</span> open source — no tracking, no analytics, auditable</p>

            <br />

            <p className="comment">sample identities:</p>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {['ghost_a1f3b2', 'debug_c9e7d4', 'node_82fa10', 'void_3bc8ef', 'pixel_d04a91', 'flux_7e2b56'].map(name => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <PixelAvatar seed={name} size={20} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{name}</span>
                </div>
              ))}
            </div>

            <br />

            <p className="comment">why?</p>
            <p>devs are being squeezed. AI hype weaponised against workers.</p>
            <p>corporate individualism keeps us isolated.</p>
            <p>this is a place to talk. humans verifying humans.</p>

            <hr className="term-divider" />

            {!user ? (
              <p>
                <span className="prompt">ready?</span>{' '}
                <Link to="/login" style={{ color: 'var(--accent)' }}>
                  join the union →
                </Link>
              </p>
            ) : (
              <p>
                <span className="prompt">welcome back.</span>{' '}
                <Link to="/chat" style={{ color: 'var(--accent)' }}>
                  enter chat →
                </Link>
              </p>
            )}

          </div>
        </div>
      </div>
    </section>
  );
}
