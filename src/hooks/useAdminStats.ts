import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
  PlatformOverview,
  ActivityDataPoint,
  UserRoleEntry,
} from '../types/database';

interface AdminStatsState {
  overview: PlatformOverview | null;
  loginActivity: ActivityDataPoint[];
  messageActivity: ActivityDataPoint[];
  userRoles: UserRoleEntry[];
  loading: boolean;
  error: string | null;
  daysBack: number;
  setDaysBack: (days: number) => void;
  refetch: () => Promise<void>;
  assignRole: (profileId: string, role: string) => Promise<void>;
}

export function useAdminStats(): AdminStatsState {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loginActivity, setLoginActivity] = useState<ActivityDataPoint[]>([]);
  const [messageActivity, setMessageActivity] = useState<ActivityDataPoint[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysBack, setDaysBack] = useState(30);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [overviewRes, loginRes, msgRes, rolesRes] = await Promise.all([
        supabase.rpc('get_platform_overview'),
        supabase.rpc('get_login_activity', { p_days_back: daysBack }),
        supabase.rpc('get_message_activity', { p_days_back: daysBack }),
        supabase.rpc('get_user_roles'),
      ]);

      if (overviewRes.error) throw overviewRes.error;
      if (loginRes.error) throw loginRes.error;
      if (msgRes.error) throw msgRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const raw = overviewRes.data?.[0];
      if (raw) {
        setOverview({
          total_members:   Number(raw.total_members),
          active_sessions: Number(raw.active_sessions),
          pending_reports: Number(raw.pending_reports),
          active_bans:     Number(raw.active_bans),
          messages_24h:    Number(raw.messages_24h),
        });
      }

      setLoginActivity(
        ((loginRes.data as { day: string; login_count: string | number }[]) ?? []).map((r) => ({
          day:   r.day,
          count: Number(r.login_count),
        }))
      );

      setMessageActivity(
        ((msgRes.data as { day: string; message_count: string | number }[]) ?? []).map((r) => ({
          day:   r.day,
          count: Number(r.message_count),
        }))
      );

      setUserRoles((rolesRes.data as UserRoleEntry[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch admin stats');
    } finally {
      setLoading(false);
    }
  }, [daysBack]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const assignRole = useCallback(
    async (profileId: string, role: string) => {
      const { error: rpcError } = await supabase.rpc('assign_role', {
        target_user_id: profileId,
        new_role: role,
      });
      if (rpcError) throw rpcError;
      await fetchAll();
    },
    [fetchAll]
  );

  return {
    overview,
    loginActivity,
    messageActivity,
    userRoles,
    loading,
    error,
    daysBack,
    setDaysBack,
    refetch: fetchAll,
    assignRole,
  };
}
