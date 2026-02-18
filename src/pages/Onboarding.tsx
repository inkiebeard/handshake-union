import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { OnboardingForm } from '../components/onboarding/OnboardingForm';

export function Onboarding() {
  const { user } = useAuth();
  const { profile, loading, error, refetch } = useProfile(user?.id);

  return (
    <section className="section">
      <div className="container">
        <div className="columns is-centered">
          <div className="column is-5">
            <p className="prompt">profile</p>
            <p className="comment">help build a picture of conditions for AU devs</p>
            <p className="comment">all fields optional — share what you're comfortable with</p>

            <br />

            {loading && <p className="comment">loading profile...</p>}

            {error && (
              <div className="notification is-danger">
                error: {error}
              </div>
            )}

            {profile && (
              <OnboardingForm profile={profile} onSaved={refetch} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
