import { useAuth } from '../hooks/useAuth';

export function Chat() {
  const { user } = useAuth();

  return (
    <section className="section">
      <div className="container">
        <h1 className="title">Chat</h1>
        <p className="subtitle has-text-grey">
          Live chat rooms — coming in Phase 4.
        </p>
        <div className="tabs is-boxed">
          <ul>
            <li className="is-active">
              <a><span>#general</span></a>
            </li>
            <li>
              <a><span>#memes</span></a>
            </li>
            <li>
              <a><span>#whinge</span></a>
            </li>
          </ul>
        </div>
        <div className="box" style={{ minHeight: '400px' }}>
          <p className="has-text-grey has-text-centered mt-6">
            {user
              ? 'Chat functionality will be implemented in Phase 4. Stay tuned!'
              : 'Please log in to chat.'}
          </p>
        </div>
      </div>
    </section>
  );
}
