import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    setError(null);
    setIsLoading(true);

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setIsLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setSubmitted(true);
    }
  };

  const handleOAuth = async (provider: 'github' | 'gitlab') => {
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
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
            <p className="comment">no passwords. just a magic link or oauth.</p>

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
                <div className="control">
                  <button
                    className={`button is-primary is-fullwidth ${isLoading ? 'is-loading' : ''}`}
                    type="submit"
                    disabled={isLoading}
                  >
                    send magic link
                  </button>
                </div>
              </div>
            </form>

            <hr className="term-divider" />

            <p className="comment">or use oauth</p>
            <br />
            <div className="field is-grouped">
              <div className="control">
                <button className="button is-dark" onClick={() => handleOAuth('github')}>
                  github
                </button>
              </div>
              <div className="control">
                <button className="button is-link" onClick={() => handleOAuth('gitlab')}>
                  gitlab
                </button>
              </div>
            </div>

            <br />
            <p className="comment">you'll be assigned a pseudonym. identity stays hidden.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
