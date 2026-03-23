import { useState } from 'react';
import { Link } from 'react-router-dom';

const SKIP_KEY = 'hu_skip_intro';

export function Footer() {
  const [skipped, setSkipped] = useState(() => {
    try { return localStorage.getItem(SKIP_KEY) === '1'; } catch { return false; }
  });

  function toggleIntro() {
    if (skipped) {
      try { localStorage.removeItem(SKIP_KEY); setSkipped(false); } catch { /* ignore */ }
    } else {
      try { localStorage.setItem(SKIP_KEY, '1'); setSkipped(true); } catch { /* ignore */ }
    }
  }

  return (
    <footer className="footer term-footer">
      <div className="container term-footer-inner">
        <div className="term-footer-links">
          <span>agpl-3.0</span>
          {' · '}
          <Link to="/privacy">
            privacy
          </Link>
          {' · '}
          <a
            href="https://github.com/inkiebeard/handshake-union"
            target="_blank"
            rel="noopener noreferrer"
          >
            source
          </a>
        </div>
        <div className="term-footer-actions">
          <button
            onClick={toggleIntro}
            className="term-footer-action-btn"
            title={skipped ? 'click to re-enable the boot animation on next load' : 'click to skip the boot animation on future loads'}
          >
            intro: {skipped ? 'off' : 'on'}
          </button>
        </div>
      </div>
    </footer>
  );
}
