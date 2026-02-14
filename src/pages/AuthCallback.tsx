import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const { error: authError } = await supabase.auth.getSession();

      if (authError) {
        setError(authError.message);
        return;
      }

      // Check if user has completed onboarding
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', user.id)
        .single();

      if (profile?.onboarding_complete) {
        navigate('/chat');
      } else {
        navigate('/onboarding');
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <section className="section">
        <div className="container has-text-centered">
          <div className="notification is-danger">
            <p>Authentication error: {error}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container has-text-centered">
        <p className="is-size-5">Signing you in...</p>
      </div>
    </section>
  );
}
