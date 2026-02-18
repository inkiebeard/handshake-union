import { createContext, useContext, type ReactNode } from 'react';
import { useCustomEmotes } from '../hooks/useCustomEmotes';
import type { CustomEmote } from '../types/database';

interface EmoteContextValue {
  emotes: CustomEmote[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EmoteContext = createContext<EmoteContextValue | null>(null);

/**
 * Provider that loads custom emotes on app startup
 * Wrap this around your app to ensure emotes are available for parsing
 */
export function EmoteProvider({ children }: { children: ReactNode }) {
  const { emotes, loading, error, refresh } = useCustomEmotes();
  
  return (
    <EmoteContext.Provider value={{ emotes, loading, error, refresh }}>
      {children}
    </EmoteContext.Provider>
  );
}

/**
 * Hook to access the emote context
 */
export function useEmoteContext(): EmoteContextValue {
  const context = useContext(EmoteContext);
  if (!context) {
    throw new Error('useEmoteContext must be used within an EmoteProvider');
  }
  return context;
}
