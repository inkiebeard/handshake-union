import { useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY;

if (!TURNSTILE_SITE_KEY) {
  throw new Error(
    'Missing VITE_TURNSTILE_SITE_KEY environment variable. ' +
    'Copy .env.example to .env.local and add your Cloudflare Turnstile site key.'
  );
}

export function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  if (loading) {
    return (
      <section className="section">
        <div className="container">
          <p className="comment">loading...</p>
        </div>
      </section>
    );
  }

  if (user) {
    return <Navigate to="/chat" replace />;
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) return;
    setError(null);
    setIsLoading(true);

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        captchaToken,
      },
    });

    setIsLoading(false);
    if (authError) {
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      setError(authError.message);
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <section className="section">
        <div className="container">
          <div className="columns is-centered">
            <div className="column is-5">
              <p className="prompt">check your email</p>
              <br />
              <p>magic link sent to <strong>{email}</strong></p>
              <p className="comment">click the link to sign in — no password needed</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <div className="columns is-centered">
          <div className="column is-5">
            <p className="prompt">authenticate</p>
            <p className="comment">no passwords. just a magic link.</p>

            <br />

            {error && (
              <div className="notification is-danger">
                <span style={{ color: 'var(--danger)' }}>error:</span> {error}
              </div>
            )}

            <form onSubmit={handleMagicLink}>
              <div className="field">
                <label className="label" htmlFor="email">email</label>
                <div className="control">
                  <input
                    id="email"
                    className="input"
                    type="email"
                    placeholder="worker@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={setCaptchaToken}
                  onError={() => setCaptchaToken(null)}
                  onExpire={() => setCaptchaToken(null)}
                  options={{ theme: 'dark' }}
                />
              </div>

              <div className="field">
                <div className="control">
                  <button
                    className={`button is-primary is-fullwidth ${isLoading ? 'is-loading' : ''}`}
                    type="submit"
                    disabled={isLoading || !captchaToken}
                  >
                    send magic link
                  </button>
                </div>
              </div>
            </form>

            <br />
            <p className="comment">you'll be assigned a pseudonym. identity stays hidden.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
