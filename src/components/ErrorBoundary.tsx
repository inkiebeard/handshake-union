import { Component, ReactNode, useState, useEffect } from 'react';

const ART_LINES = [
  'EEEEEEEEEEEEEEEEEEEEEE                                                                          ',
  'E::::::::::::::::::::E                                                                          ',
  'E::::::::::::::::::::E                                                                          ',
  'EE::::::EEEEEEEEE::::E                                                                          ',
  '  E:::::E       EEEEEErrrrr   rrrrrrrrr   rrrrr   rrrrrrrrr      ooooooooooo   rrrrr   rrrrrrrrr',
  '  E:::::E             r::::rrr:::::::::r  r::::rrr:::::::::r   oo:::::::::::oo r::::rrr:::::::::r',
  '  E::::::EEEEEEEEEE   r:::::::::::::::::r r:::::::::::::::::r o:::::::::::::::or:::::::::::::::::r',
  '  E:::::::::::::::E   rr::::::rrrrr::::::rrr::::::rrrrr::::::ro:::::ooooo:::::orr::::::rrrrr::::::r',
  '  E:::::::::::::::E    r:::::r     r:::::r r:::::r     r:::::ro::::o     o::::o r:::::r     r:::::r',
  '  E::::::EEEEEEEEEE    r:::::r     rrrrrrr r:::::r     rrrrrrro::::o     o::::o r:::::r     rrrrrrr',
  '  E:::::E              r:::::r             r:::::r            o::::o     o::::o r:::::r            ',
  '  E:::::E       EEEEEE r:::::r             r:::::r            o::::o     o::::o r:::::r            ',
  'EE::::::EEEEEEEE:::::E r:::::r             r:::::r            o:::::ooooo:::::o r:::::r            ',
  'E::::::::::::::::::::E r:::::r             r:::::r            o:::::::::::::::o r:::::r            ',
  'E::::::::::::::::::::E r:::::r             r:::::r             oo:::::::::::oo  r:::::r            ',
  'EEEEEEEEEEEEEEEEEEEEEE rrrrrrr             rrrrrrr               ooooooooooo    rrrrrrr            ',
];

const GLITCH_CHARS = '!@#%^&ΞΨΩŦŁĐÆæøØ░▒▓│╣║╗╝╬═╠╦╩╔╚╞╧╤╙╘╒╓╫╪▀▄█▌▐';

function corruptLine(line: string, intensity: number): string {
  return line
    .split('')
    .map((char) => {
      if (char === ' ') return char;
      if (Math.random() < intensity * 0.45) {
        return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
      }
      if (Math.random() < intensity * 0.2 && /[a-zA-Z]/.test(char)) {
        return char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase();
      }
      return char;
    })
    .join('');
}

interface DisplayProps {
  error: Error | null;
  onReset: () => void;
}

function ErrorDisplay({ error, onReset }: DisplayProps) {
  const [wave, setWave] = useState(0);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      setWave((w) => (w + 0.18) % ART_LINES.length);
    }, 55);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const handleBack = () => {
    onReset();
    window.history.back();
  };

  return (
    <section className="section">
      <div className="not-found-wrapper">
        <pre className="ascii-art error-art">
          {ART_LINES.map((line, i) => {
            const dist = Math.abs(i - wave);
            const closeness = reducedMotion ? 0 : Math.max(0, 1 - dist / 2.5);
            const isActive = closeness > 0.05;
            const displayLine = isActive ? corruptLine(line, closeness) : line;
            const shift = isActive ? (Math.random() - 0.5) * closeness * 5 : 0;

            return (
              <span
                key={i}
                className={isActive && closeness > 0.5 ? 'error-art-line--hot' : undefined}
                style={{
                  display: 'block',
                  transform: isActive ? `translateX(${shift}px)` : undefined,
                }}
              >
                {displayLine}
              </span>
            );
          })}
        </pre>

        <hr className="term-divider not-found-divider" />

        <p className="comment">something went wrong</p>
        {import.meta.env.DEV && error && (
          <p className="error-art-message">{error.message}</p>
        )}
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', justifyContent: 'center' }}>
          {window.history.length > 1 && (
            <button onClick={handleBack} className="not-found-back-btn">
              ← go back
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            className="not-found-back-btn"
            style={{ color: 'var(--text-muted)' }}
          >
            ↺ reload
          </button>
        </div>
      </div>
    </section>
  );
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// React error boundaries require a class component — getDerivedStateFromError
// and componentDidCatch have no functional equivalent in React core.
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  resetBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorDisplay error={this.state.error} onReset={this.resetBoundary} />;
    }
    return this.props.children;
  }
}
