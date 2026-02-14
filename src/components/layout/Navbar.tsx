import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

export function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [burgerActive, setBurgerActive] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="navbar is-dark" role="navigation" aria-label="main navigation">
      <div className="container">
        <div className="navbar-brand">
          <Link className="navbar-item has-text-weight-bold is-size-5" to="/">
            🤝 Handshake Union
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
                <Link className="navbar-item" to="/chat">
                  Chat
                </Link>
                <Link className="navbar-item" to="/stats">
                  Stats
                </Link>
                <Link className="navbar-item" to="/onboarding">
                  Profile
                </Link>
              </div>
              <div className="navbar-end">
                <div className="navbar-item">
                  <button className="button is-small is-outlined is-light" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="navbar-end">
              <div className="navbar-item">
                <Link className="button is-primary" to="/login">
                  Join the Union
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
