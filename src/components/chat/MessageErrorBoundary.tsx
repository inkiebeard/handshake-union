import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  messageId: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class MessageErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(`[MessageErrorBoundary] message ${this.props.messageId} failed to render:`, error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="chat-message-broken">
          <span className="chat-message-broken-text">
            ⚠ this message could not be displayed
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}
