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
        <div className="container has-text-centered">
          <p>Loading...</p>
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
              <div className="box has-text-centered">
                <span className="is-size-1">📧</span>
                <h2 className="title is-4 mt-4">Check your email</h2>
                <p>
                  We've sent a magic link to <strong>{email}</strong>.
                  <br />
                  Click the link to sign in — no password needed.
                </p>
              </div>
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
            <div className="box">
              <h2 className="title is-4 has-text-centered">Join the Union</h2>
              <p className="has-text-centered has-text-grey mb-5">
                No passwords. No bullshit. Just a magic link.
              </p>

              {error && (
                <div className="notification is-danger is-light">
                  {error}
                </div>
              )}

              <form onSubmit={handleMagicLink}>
                <div className="field">
                  <label className="label" htmlFor="email">Email</label>
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
                      Send Magic Link
                    </button>
                  </div>
                </div>
              </form>

              <div className="has-text-centered my-4">
                <span className="has-text-grey">or sign in with</span>
              </div>

              <div className="buttons is-centered">
                <button
                  className="button is-dark"
                  onClick={() => handleOAuth('github')}
                >
                  GitHub
                </button>
                <button
                  className="button is-link"
                  onClick={() => handleOAuth('gitlab')}
                >
                  GitLab
                </button>
              </div>

              <p className="has-text-centered has-text-grey is-size-7 mt-4">
                You'll be assigned an anonymous pseudonym. Your real identity is never shown.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
