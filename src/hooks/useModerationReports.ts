import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
  ReportWithPseudonyms,
  UserBan,
  ModerationReportStatus,
  BanType,
} from '../types/database';

interface ModerationState {
  reports: ReportWithPseudonyms[];
  activeBans: UserBan[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  resolveReport: (
    id: string,
    status: Exclude<ModerationReportStatus, 'pending'>,
    notes?: string
  ) => Promise<void>;
  banUser: (
    targetProfileId: string,
    banType: BanType,
    reason?: string,
    expiresAt?: string
  ) => Promise<void>;
  liftBan: (banId: string) => Promise<void>;
}

export function useModerationReports(): ModerationState {
  const [reports, setReports] = useState<ReportWithPseudonyms[]>([]);
  const [activeBans, setActiveBans] = useState<UserBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [reportsRes, bansRes] = await Promise.all([
        supabase.rpc('get_all_reports'),
        supabase.rpc('get_active_bans'),
      ]);

      if (reportsRes.error) throw reportsRes.error;
      if (bansRes.error) throw bansRes.error;

      setReports((reportsRes.data as ReportWithPseudonyms[]) ?? []);
      setActiveBans((bansRes.data as UserBan[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch moderation data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const resolveReport = useCallback(
    async (
      id: string,
      status: Exclude<ModerationReportStatus, 'pending'>,
      notes?: string
    ) => {
      const { error: rpcError } = await supabase.rpc('resolve_report_moderated', {
        p_report_id: id,
        p_new_status: status,
        p_notes: notes ?? null,
      });
      if (rpcError) throw rpcError;
      await fetchAll();
    },
    [fetchAll]
  );

  const banUser = useCallback(
    async (
      targetProfileId: string,
      banType: BanType,
      reason?: string,
      expiresAt?: string
    ) => {
      const { error: rpcError } = await supabase.rpc('ban_user', {
        target_profile_id: targetProfileId,
        p_ban_type: banType,
        p_reason: reason ?? null,
        p_expires_at: expiresAt ?? null,
      });
      if (rpcError) throw rpcError;
      await fetchAll();
    },
    [fetchAll]
  );

  const liftBan = useCallback(
    async (banId: string) => {
      const { error: rpcError } = await supabase.rpc('lift_ban', { p_ban_id: banId });
      if (rpcError) throw rpcError;
      await fetchAll();
    },
    [fetchAll]
  );

  return {
    reports,
    activeBans,
    loading,
    error,
    refetch: fetchAll,
    resolveReport,
    banUser,
    liftBan,
  };
}
