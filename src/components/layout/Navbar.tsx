import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { supabase } from '../../lib/supabase';
import { PixelAvatar } from '../PixelAvatar';

export function Navbar() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const navigate = useNavigate();
  const [burgerActive, setBurgerActive] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="navbar term-nav" role="navigation" aria-label="main navigation">
      <div className="container">
        <div className="navbar-brand">
          <Link className="navbar-item brand" to="/">
            handshake-union
          </Link>
          <button
            className={`navbar-burger ${burgerActive ? 'is-active' : ''}`}
            aria-label="menu"
            aria-expanded={burgerActive}
            onClick={() => setBurgerActive(!burgerActive)}
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </button>
        </div>

        <div className={`navbar-menu ${burgerActive ? 'is-active' : ''}`}>
          {user ? (
            <>
              <div className="navbar-start">
                <Link className="navbar-item" to="/chat">/chat</Link>
                <Link className="navbar-item" to="/stats">/stats</Link>
                <Link className="navbar-item" to="/members">/members</Link>
                <Link className="navbar-item" to="/profile">/profile</Link>
              </div>
              <div className="navbar-end">
                {profile && (
                  <div className="navbar-item" style={{ gap: '0.5rem', display: 'flex', alignItems: 'center' }}>
                    <PixelAvatar seed={profile.pseudonym} size={18} />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {profile.pseudonym}
                    </span>
                  </div>
                )}
                <div className="navbar-item">
                  <button className="button is-ghost is-small" onClick={handleLogout}>
                    logout
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="navbar-end">
              <Link className="navbar-item" to="/login">/login</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
