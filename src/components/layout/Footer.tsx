import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="footer term-footer">
      <div className="container">
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
    </footer>
  );
}
