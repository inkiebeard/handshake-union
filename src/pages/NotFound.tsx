import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const BASE_ART = [
  '██╗  ██╗ ██████╗ ██╗  ██╗',
  '██║  ██║██╔═████╗██║  ██║',
  '███████║██║██╔██║███████║',
  '╚════██║████╔╝██║╚════██║',
  '     ██║╚██████╔╝     ██║',
  '     ╚═╝ ╚═════╝      ╚═╝',
].join('\n');

const GLITCH_CHARS = '▓▒░█▄▀■□▪◘○●◙♦';

function corruptText(text: string): string {
  return text
    .split('')
    .map((char) => {
      if (char !== '\n' && char !== ' ' && Math.random() < 0.07) {
        return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
      }
      return char;
    })
    .join('');
}

export function NotFound() {
  const navigate = useNavigate();
  const [artText, setArtText] = useState(BASE_ART);
  const [glitching, setGlitching] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ids: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    const tick = () => {
      const id = setTimeout(() => {
        if (cancelled) return;
        if (Math.random() < 0.5) {
          setGlitching(true);
          setArtText(corruptText(BASE_ART));

          const recoverId = setTimeout(() => {
            if (cancelled) return;
            setGlitching(false);
            setArtText(BASE_ART);
            tick();
          }, 80 + Math.random() * 140);
          ids.push(recoverId);
        } else {
          tick();
        }
      }, 400 + Math.random() * 300);
      ids.push(id);
    };

    tick();
    return () => {
      cancelled = true;
      ids.forEach(clearTimeout);
    };
  }, []);

  return (
    <section className="section">
      <div className="not-found-wrapper">
        <pre className={`ascii-art not-found-art${glitching ? ' not-found-art--glitch' : ''}`}>
          {artText}
        </pre>

        <hr className="term-divider not-found-divider" />

        <p className="comment">path not found</p>
        {window.history.length > 1 && (
          <p style={{ marginTop: '0.75rem' }}>
            <button onClick={() => navigate(-1)} className="not-found-back-btn">
              ← return to previous page
            </button>
          </p>
        )}
        <p style={{ marginTop: '0.75rem' }}>
          <Link to="/" style={{ color: 'var(--accent)' }}>
            ← return home
          </Link>
        </p>
      </div>
    </section>
  );
}
