import { useAuth } from '../hooks/useAuth';

export function Onboarding() {
  const { user } = useAuth();

  return (
    <section className="section">
      <div className="container">
        <div className="columns is-centered">
          <div className="column is-6">
            <h1 className="title">Your Profile</h1>
            <p className="subtitle has-text-grey">
              Help us build a picture of working conditions for Australian devs.
              <br />
              All fields are optional — share what you're comfortable with.
            </p>
            <div className="box">
              <p className="has-text-grey has-text-centered">
                {user
                  ? 'Onboarding form will be implemented in Phase 3.'
                  : 'Please log in to complete your profile.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
