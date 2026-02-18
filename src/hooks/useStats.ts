import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
  SalaryBand,
  ExperienceBand,
  EmploymentType,
  WfhStatus,
  RoleTitle,
  BaselineStat,
} from '../types/database';

// ============================================
// Types for aggregate function returns
// ============================================

export interface DistributionItem<T> {
  value: T;
  count: number;
}

export interface CommunitySummary {
  total_members: number;
  total_with_data: number;
}

export interface TrendItem<T> {
  month: string;
  value: T;
  count: number;
}

export interface StatsData {
  salary: DistributionItem<SalaryBand>[];
  role: DistributionItem<RoleTitle>[];
  experience: DistributionItem<ExperienceBand>[];
  wfh: DistributionItem<WfhStatus>[];
  employment: DistributionItem<EmploymentType>[];
  summary: CommunitySummary | null;
  baselines: BaselineStat[];
}

interface StatsState {
  data: StatsData;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================
// Hook
// ============================================

export function useStats(): StatsState {
  const [data, setData] = useState<StatsData>({
    salary: [],
    role: [],
    experience: [],
    wfh: [],
    employment: [],
    summary: null,
    baselines: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all distributions in parallel
      const [
        salaryRes,
        roleRes,
        experienceRes,
        wfhRes,
        employmentRes,
        summaryRes,
        baselinesRes,
      ] = await Promise.all([
        supabase.rpc('get_salary_distribution'),
        supabase.rpc('get_role_distribution'),
        supabase.rpc('get_experience_distribution'),
        supabase.rpc('get_wfh_distribution'),
        supabase.rpc('get_employment_distribution'),
        supabase.rpc('get_community_summary'),
        supabase.from('baseline_stats').select('*').order('year', { ascending: false }),
      ]);

      // Check for errors
      if (salaryRes.error) throw salaryRes.error;
      if (roleRes.error) throw roleRes.error;
      if (experienceRes.error) throw experienceRes.error;
      if (wfhRes.error) throw wfhRes.error;
      if (employmentRes.error) throw employmentRes.error;
      if (summaryRes.error) throw summaryRes.error;
      if (baselinesRes.error) throw baselinesRes.error;

      // Transform RPC results to our format
      const transformDistribution = <T>(
        rows: { count: number }[] | null,
        keyName: string
      ): DistributionItem<T>[] => {
        if (!rows) return [];
        return rows.map((row) => ({
          value: (row as Record<string, unknown>)[keyName] as T,
          count: Number(row.count),
        }));
      };

      setData({
        salary: transformDistribution<SalaryBand>(salaryRes.data, 'salary_band'),
        role: transformDistribution<RoleTitle>(roleRes.data, 'role_title'),
        experience: transformDistribution<ExperienceBand>(experienceRes.data, 'experience_band'),
        wfh: transformDistribution<WfhStatus>(wfhRes.data, 'wfh_status'),
        employment: transformDistribution<EmploymentType>(employmentRes.data, 'employment_type'),
        summary: summaryRes.data?.[0]
          ? {
              total_members: Number(summaryRes.data[0].total_members),
              total_with_data: Number(summaryRes.data[0].total_with_data),
            }
          : null,
        baselines: baselinesRes.data ?? [],
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { data, loading, error, refetch: fetchStats };
}

// ============================================
// Utility functions for stats analysis
// ============================================

/**
 * Calculate the median value from a distribution
 */
export function getMedianFromDistribution<T>(
  distribution: DistributionItem<T>[],
  orderedValues: T[]
): T | null {
  if (distribution.length === 0) return null;

  const total = distribution.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return null;

  const medianIndex = Math.floor(total / 2);
  let cumulative = 0;

  // Sort distribution by the ordered values
  const sorted = [...distribution].sort(
    (a, b) => orderedValues.indexOf(a.value) - orderedValues.indexOf(b.value)
  );

  for (const item of sorted) {
    cumulative += item.count;
    if (cumulative > medianIndex) {
      return item.value;
    }
  }

  return sorted[sorted.length - 1]?.value ?? null;
}

/**
 * Get the most common value from a distribution
 */
export function getModeFromDistribution<T>(
  distribution: DistributionItem<T>[]
): { value: T; count: number } | null {
  if (distribution.length === 0) return null;

  return distribution.reduce((max, item) =>
    item.count > max.count ? item : max
  );
}

/**
 * Calculate total respondents for a distribution
 */
export function getTotalCount<T>(distribution: DistributionItem<T>[]): number {
  return distribution.reduce((sum, item) => sum + item.count, 0);
}
