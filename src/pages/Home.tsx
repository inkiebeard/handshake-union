import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Home() {
  const { user } = useAuth();

  return (
    <>
      <section className="hero is-medium is-dark">
        <div className="hero-body">
          <div className="container has-text-centered">
            <p className="title is-1">🤝 Handshake Union</p>
            <p className="subtitle is-4">
              Anonymous community for Australian developers.
              <br />
              Share workplace intel. Build collective power.
            </p>
            {!user && (
              <Link className="button is-primary is-large" to="/login">
                Join the Union
              </Link>
            )}
            {user && (
              <Link className="button is-primary is-large" to="/chat">
                Enter Chat
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="columns is-centered">
            <div className="column is-8">
              <div className="columns">
                <div className="column">
                  <div className="box has-text-centered">
                    <span className="icon is-large has-text-warning">
                      <i className="is-size-1">🕵️</i>
                    </span>
                    <h3 className="title is-5 mt-3">Anonymous</h3>
                    <p>
                      Auto-generated pseudonyms. No names, no LinkedIn profiles.
                      Just workers talking to workers.
                    </p>
                  </div>
                </div>
                <div className="column">
                  <div className="box has-text-centered">
                    <span className="icon is-large has-text-info">
                      <i className="is-size-1">💬</i>
                    </span>
                    <h3 className="title is-5 mt-3">Ephemeral</h3>
                    <p>
                      Messages disappear after 1 hour. Speak freely without
                      leaving a permanent record.
                    </p>
                  </div>
                </div>
                <div className="column">
                  <div className="box has-text-centered">
                    <span className="icon is-large has-text-success">
                      <i className="is-size-1">📊</i>
                    </span>
                    <h3 className="title is-5 mt-3">Transparent</h3>
                    <p>
                      See real salary data from real devs. Compare against
                      industry baselines. Know your worth.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section has-background-light">
        <div className="container has-text-centered">
          <h2 className="title is-3">Why?</h2>
          <div className="columns is-centered">
            <div className="column is-6">
              <div className="content is-medium">
                <p>
                  Developers are being squeezed. AI hype is being weaponised
                  against workers. Corporate individualism keeps us isolated.
                </p>
                <p>
                  <strong>Handshake Union</strong> is a refuge — a place where
                  devs verify devs, share real conditions, and remember that
                  solidarity isn't a dirty word.
                </p>
                <p className="has-text-grey">
                  Open source. No tracking. No analytics. Humans verifying
                  humans.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
