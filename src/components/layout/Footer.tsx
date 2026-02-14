export function Footer() {
  return (
    <footer className="footer">
      <div className="content has-text-centered">
        <p>
          <strong>Handshake Union</strong> — built by workers, for workers.
        </p>
        <p className="is-size-7 has-text-grey">
          Open source under{' '}
          <a
            href="https://www.gnu.org/licenses/agpl-3.0.en.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            AGPL-3.0
          </a>
          . No tracking. No analytics. No bullshit.
        </p>
      </div>
    </footer>
  );
}
