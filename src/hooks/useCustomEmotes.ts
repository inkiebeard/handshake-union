import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CustomEmote } from '../types/database';

// Global cache for custom emotes - shared across all hook instances
let cachedEmotes: CustomEmote[] | null = null;
let fetchPromise: Promise<CustomEmote[]> | null = null;
let lastFetchTime = 0;

// Cache duration: 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;

/**
 * Fetch custom emotes from the database
 * Uses a shared cache to avoid redundant requests
 */
async function fetchCustomEmotes(): Promise<CustomEmote[]> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (cachedEmotes && (now - lastFetchTime) < CACHE_DURATION_MS) {
    return cachedEmotes;
  }
  
  // If a fetch is already in progress, wait for it
  if (fetchPromise) {
    return fetchPromise;
  }
  
  // Start a new fetch
  fetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('custom_emotes')
        .select('*')
        .eq('enabled', true)
        .order('code');
      
      if (error) {
        console.error('Failed to fetch custom emotes:', error);
        return cachedEmotes ?? [];
      }
      
      cachedEmotes = data ?? [];
      lastFetchTime = Date.now();
      return cachedEmotes;
    } finally {
      fetchPromise = null;
    }
  })();
  
  return fetchPromise;
}

/**
 * Force refresh the emotes cache
 */
export function invalidateEmotesCache(): void {
  cachedEmotes = null;
  lastFetchTime = 0;
}

/**
 * Get cached emotes synchronously (returns empty array if not yet loaded)
 */
export function getCachedEmotes(): CustomEmote[] {
  return cachedEmotes ?? [];
}

/**
 * Hook to access custom emotes with automatic fetching
 */
export function useCustomEmotes() {
  const [emotes, setEmotes] = useState<CustomEmote[]>(cachedEmotes ?? []);
  const [loading, setLoading] = useState(!cachedEmotes);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let mounted = true;
    
    fetchCustomEmotes()
      .then((data) => {
        if (mounted) {
          setEmotes(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      });
    
    return () => {
      mounted = false;
    };
  }, []);
  
  const refresh = async () => {
    setLoading(true);
    invalidateEmotesCache();
    try {
      const data = await fetchCustomEmotes();
      setEmotes(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh emotes');
    } finally {
      setLoading(false);
    }
  };
  
  return { emotes, loading, error, refresh };
}
