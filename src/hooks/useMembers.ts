import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface MemberStats {
  pseudonym: string;
  member_since: string;
  message_count: number;
  profile_complete: boolean;
}

interface MembersState {
  members: MemberStats[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMembers(): MembersState {
  const [members, setMembers] = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc('get_public_member_stats');

      if (fetchError) throw fetchError;

      setMembers(data ?? []);
    } catch (err) {
      console.error('Failed to fetch members:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, loading, error, refetch: fetchMembers };
}

// Helper to format tenure
export function formatTenure(memberSince: string): string {
  const now = new Date();
  const joined = new Date(memberSince);
  const diffMs = now.getTime() - joined.getTime();
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return years === 1 ? '1 year' : `${years} years`;
  }
  if (months > 0) {
    return months === 1 ? '1 month' : `${months} months`;
  }
  if (days > 0) {
    return days === 1 ? '1 day' : `${days} days`;
  }
  return 'today';
}

// Helper to format date
export function formatJoinDate(memberSince: string): string {
  return new Date(memberSince).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
