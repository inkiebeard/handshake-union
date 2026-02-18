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
        <div className="container">
          <p style={{ color: 'var(--danger)' }}>error: {error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <p className="comment">authenticating...</p>
      </div>
    </section>
  );
}
