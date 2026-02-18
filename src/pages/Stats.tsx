import { useMemo, useState, type ReactNode } from 'react';
import {
  useStats,
  getMedianFromDistribution,
  getModeFromDistribution,
  getTotalCount,
  type DistributionItem,
} from '../hooks/useStats';
import {
  SALARY_BAND_LABELS,
  EXPERIENCE_BAND_LABELS,
  ROLE_TITLE_LABELS,
  WFH_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from '../lib/constants';
import type {
  SalaryBand,
  ExperienceBand,
  RoleTitle,
  BaselineStat,
} from '../types/database';

// ============================================
// Constants
// ============================================

const SAMPLE_SIZE = {
  MINIMUM: 30,
  MODERATE: 50,
  GOOD: 100,
} as const;

const SALARY_ORDER: SalaryBand[] = [
  'under_60k',
  '60_80k',
  '80_100k',
  '100_120k',
  '120_150k',
  '150_180k',
  '180_220k',
  'over_220k',
  'prefer_not_to_say',
];

const EXPERIENCE_ORDER: ExperienceBand[] = [
  'student',
  '0_1_years',
  '1_3_years',
  '3_5_years',
  '5_10_years',
  '10_15_years',
  '15_plus_years',
];

const EXPERIENCE_SHORT_LABELS: Record<ExperienceBand, string> = {
  student: 'Student',
  '0_1_years': '0-1y',
  '1_3_years': '1-3y',
  '3_5_years': '3-5y',
  '5_10_years': '5-10y',
  '10_15_years': '10-15y',
  '15_plus_years': '15y+',
};

// Salary midpoints for converting bands to point estimates
const SALARY_MIDPOINTS: Record<SalaryBand, number | null> = {
  under_60k: 50000,
  '60_80k': 70000,
  '80_100k': 90000,
  '100_120k': 110000,
  '120_150k': 135000,
  '150_180k': 165000,
  '180_220k': 200000,
  over_220k: 250000,
  prefer_not_to_say: null,
};

// Role colors for the chart
const ROLE_COLORS: Record<string, string> = {
  senior_dev: '#3fb950',
  mid_dev: '#58a6ff',
  junior_dev: '#a371f7',
  lead: '#f0883e',
  staff_engineer: '#ff7b72',
  principal: '#ffd700',
  em: '#79c0ff',
  fullstack: '#7ee787',
  backend: '#a5d6ff',
  frontend: '#ffa657',
  devops_sre: '#d2a8ff',
  data_engineer: '#ff9bce',
  ml_engineer: '#ffc658',
  default: '#6e7681',
};

function getRoleColor(role: string): string {
  return ROLE_COLORS[role] || ROLE_COLORS.default;
}

// ============================================
// Confidence utilities
// ============================================

type ConfidenceLevel = 'none' | 'low' | 'moderate' | 'good';

function getConfidenceLevel(n: number): ConfidenceLevel {
  if (n < 10) return 'none';
  if (n < SAMPLE_SIZE.MINIMUM) return 'low';
  if (n < SAMPLE_SIZE.MODERATE) return 'moderate';
  return 'good';
}

function getConfidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'none': return 'Insufficient data';
    case 'low': return 'Low confidence';
    case 'moderate': return 'Moderate confidence';
    case 'good': return 'Good confidence';
  }
}

function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'none': return 'has-text-grey';
    case 'low': return 'has-text-danger';
    case 'moderate': return 'has-text-warning';
    case 'good': return 'has-text-success';
  }
}

function formatSalary(amount: number): string {
  return amount >= 1000 ? `$${Math.round(amount / 1000)}k` : `$${amount.toLocaleString()}`;
}

// ============================================
// SampleSizeGuard
// ============================================

interface SampleSizeGuardProps {
  n: number;
  minimum?: number;
  label: string;
  children: ReactNode;
  inline?: boolean;
  reason?: string;
  progressColor?: string;
}

function SampleSizeGuard({
  n,
  minimum = SAMPLE_SIZE.MINIMUM,
  label,
  children,
  inline = false,
  reason,
  progressColor = 'is-info',
}: SampleSizeGuardProps) {
  if (n >= minimum) {
    return <>{children}</>;
  }

  const remaining = minimum - n;
  const defaultReason = `${label} is hidden until we have at least ${minimum} responses to protect privacy and ensure statistical meaning.`;

  if (inline) {
    return (
      <>
        <p style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>Hidden</p>
        <p className="is-size-7 has-text-grey">
          Need {remaining} more response{remaining !== 1 ? 's' : ''}
        </p>
      </>
    );
  }

  return (
    <div>
      <p className="has-text-grey mb-3">{reason ?? defaultReason}</p>
      <p className="is-size-7 has-text-grey mb-2">
        Current: {n} response{n !== 1 ? 's' : ''}
      </p>
      <progress className={`progress is-small ${progressColor}`} value={n} max={minimum} />
    </div>
  );
}

// ============================================
// SalaryProgressionChart — SVG line/area chart
// ============================================

interface ChartDataPoint {
  experience: ExperienceBand;
  salary: number;
}

interface ChartSeries {
  id: string;
  label: string;
  color: string;
  data: ChartDataPoint[];
  isBaseline: boolean;
  sampleSize?: number;
}

// Community data point with sample size per experience level
interface CommunityDataPoint {
  experience: ExperienceBand;
  salaryBand: SalaryBand;
  count: number;
}

interface SalaryProgressionChartProps {
  baselines: BaselineStat[];
  selectedRoles: RoleTitle[];
  onRoleToggle: (role: RoleTitle) => void;
  availableRoles: RoleTitle[];
  // Community data
  communityData: CommunityDataPoint[];
  showCommunityData: boolean;
  onToggleCommunityData: () => void;
  communityDataAvailable: boolean;
}

function SalaryProgressionChart({
  baselines,
  selectedRoles,
  onRoleToggle,
  availableRoles,
  communityData,
  showCommunityData,
  onToggleCommunityData,
  communityDataAvailable,
}: SalaryProgressionChartProps) {
  // Chart dimensions — use viewBox for responsiveness
  const width = 900;
  const height = 450;
  const padding = { top: 30, right: 40, bottom: 70, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Experience levels to show on chart (exclude student)
  type ChartExperience = Exclude<ExperienceBand, 'student'>;
  const experienceIndices: ChartExperience[] = [
    '0_1_years',
    '1_3_years',
    '3_5_years',
    '5_10_years',
    '10_15_years',
    '15_plus_years',
  ];

  // Build baseline series data for selected roles
  const baselineSeries: ChartSeries[] = useMemo(() => {
    return selectedRoles.map((role) => {
      const roleBaselines = baselines
        .filter((b) => b.role_title === role && b.country === 'Australia')
        .sort(
          (a, b) =>
            EXPERIENCE_ORDER.indexOf(a.experience_band as ExperienceBand) -
            EXPERIENCE_ORDER.indexOf(b.experience_band as ExperienceBand)
        );

      return {
        id: `baseline-${role}`,
        label: ROLE_TITLE_LABELS[role],
        color: getRoleColor(role),
        data: roleBaselines.map((b) => ({
          experience: b.experience_band as ExperienceBand,
          salary: b.median_salary,
        })),
        isBaseline: true,
      };
    });
  }, [baselines, selectedRoles]);

  // Build community series (single line showing community median by experience)
  const communitySeries: ChartSeries | null = useMemo(() => {
    if (!showCommunityData || communityData.length === 0) return null;

    // Group by experience and calculate weighted median salary
    const byExperience = new Map<ExperienceBand, { totalCount: number; weightedSum: number }>();
    
    for (const point of communityData) {
      const midpoint = SALARY_MIDPOINTS[point.salaryBand];
      if (midpoint === null) continue;
      
      const existing = byExperience.get(point.experience) || { totalCount: 0, weightedSum: 0 };
      existing.totalCount += point.count;
      existing.weightedSum += midpoint * point.count;
      byExperience.set(point.experience, existing);
    }

    const data: ChartDataPoint[] = [];
    let totalSampleSize = 0;

    for (const exp of experienceIndices) {
      const stats = byExperience.get(exp);
      if (stats && stats.totalCount > 0) {
        data.push({
          experience: exp,
          salary: Math.round(stats.weightedSum / stats.totalCount),
        });
        totalSampleSize += stats.totalCount;
      }
    }

    if (data.length === 0) return null;

    return {
      id: 'community',
      label: 'Community',
      color: '#ffffff',
      data,
      isBaseline: false,
      sampleSize: totalSampleSize,
    };
  }, [showCommunityData, communityData, experienceIndices]);

  // Combine all series
  const allSeries = useMemo(() => {
    const series = [...baselineSeries];
    if (communitySeries) {
      series.push(communitySeries);
    }
    return series;
  }, [baselineSeries, communitySeries]);

  const xScale = (exp: ChartExperience): number => {
    const index = experienceIndices.indexOf(exp);
    if (index === -1) return 0;
    return padding.left + (index / (experienceIndices.length - 1)) * chartWidth;
  };

  // Find salary range across all series
  const allSalaries = allSeries.flatMap((s) => s.data.map((d) => d.salary));
  const minSalary = Math.min(...allSalaries, 50000);
  const maxSalary = Math.max(...allSalaries, 300000);
  const yMin = Math.floor(minSalary / 20000) * 20000;
  const yMax = Math.ceil(maxSalary / 20000) * 20000;

  const yScale = (salary: number): number => {
    return padding.top + chartHeight - ((salary - yMin) / (yMax - yMin)) * chartHeight;
  };

  // Generate Y-axis ticks
  const yTicks: number[] = [];
  for (let y = yMin; y <= yMax; y += 40000) {
    yTicks.push(y);
  }

  // Filter data to only chart-compatible experience levels
  const filterChartData = (data: ChartDataPoint[]) =>
    data.filter((d): d is ChartDataPoint & { experience: ChartExperience } =>
      experienceIndices.includes(d.experience as ChartExperience)
    );

  // Generate path for a series
  const generateLinePath = (data: ChartDataPoint[]): string => {
    const filtered = filterChartData(data);
    if (filtered.length === 0) return '';
    const points = filtered.map((d) => `${xScale(d.experience)},${yScale(d.salary)}`);
    return `M ${points.join(' L ')}`;
  };

  // Generate area path for a series
  const generateAreaPath = (data: ChartDataPoint[]): string => {
    const filtered = filterChartData(data);
    if (filtered.length === 0) return '';

    const points = filtered.map((d) => `${xScale(d.experience)},${yScale(d.salary)}`);
    const firstX = xScale(filtered[0].experience);
    const lastX = xScale(filtered[filtered.length - 1].experience);
    const baseY = yScale(yMin);

    return `M ${firstX},${baseY} L ${points.join(' L ')} L ${lastX},${baseY} Z`;
  };

  return (
    <div className="box">
      <div className="is-flex is-justify-content-space-between is-align-items-start is-flex-wrap-wrap mb-3" style={{ gap: '1rem' }}>
        <div>
          <p className="comment" style={{ marginBottom: '0.25rem' }}>Salary Progression by Experience</p>
          <p className="is-size-7 has-text-grey">
            {showCommunityData && communitySeries
              ? 'Solid white line = community data · Dotted colored lines = industry baselines'
              : 'Dotted lines show industry baseline median salaries'}
          </p>
        </div>
        {communityDataAvailable && (
          <button
            className={`button is-small ${showCommunityData ? 'is-primary' : 'is-dark'}`}
            onClick={onToggleCommunityData}
          >
            {showCommunityData ? '✓ Community Data' : 'Show Community Data'}
          </button>
        )}
      </div>

      {/* SVG Chart — full width responsive */}
      <div style={{ width: '100%' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: 'auto', minHeight: 350 }}
        >
          {/* Grid lines */}
          {yTicks.map((tick) => (
            <line
              key={tick}
              x1={padding.left}
              y1={yScale(tick)}
              x2={width - padding.right}
              y2={yScale(tick)}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray={tick === yMin ? undefined : '4,4'}
            />
          ))}

          {/* Y-axis labels */}
          {yTicks.map((tick) => (
            <text
              key={tick}
              x={padding.left - 12}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="var(--text-muted)"
              fontSize={12}
              fontFamily="inherit"
            >
              {formatSalary(tick)}
            </text>
          ))}

          {/* X-axis labels */}
          {experienceIndices.map((exp) => (
            <text
              key={exp}
              x={xScale(exp)}
              y={height - padding.bottom + 28}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize={12}
              fontFamily="inherit"
            >
              {EXPERIENCE_SHORT_LABELS[exp]}
            </text>
          ))}

          {/* X-axis label */}
          <text
            x={padding.left + chartWidth / 2}
            y={height - 15}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize={13}
            fontFamily="inherit"
          >
            Experience
          </text>

          {/* Y-axis label */}
          <text
            x={20}
            y={padding.top + chartHeight / 2}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize={13}
            fontFamily="inherit"
            transform={`rotate(-90, 20, ${padding.top + chartHeight / 2})`}
          >
            Median Salary (AUD)
          </text>

          {/* Area fills — baseline = very transparent, community = more opaque */}
          {allSeries.map((s) => (
            <path
              key={`area-${s.id}`}
              d={generateAreaPath(s.data)}
              fill={s.color}
              fillOpacity={s.isBaseline ? 0.08 : 0.25}
            />
          ))}

          {/* Lines — baseline = dashed, community = solid thick */}
          {allSeries.map((s) => (
            <path
              key={`line-${s.id}`}
              d={generateLinePath(s.data)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.isBaseline ? 2 : 3}
              strokeDasharray={s.isBaseline ? '8,5' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Data points */}
          {allSeries.map((s) =>
            filterChartData(s.data).map((d) => (
              <circle
                key={`point-${s.id}-${d.experience}`}
                cx={xScale(d.experience)}
                cy={yScale(d.salary)}
                r={s.isBaseline ? 4 : 6}
                fill={s.color}
                stroke="var(--bg-surface)"
                strokeWidth={2}
              />
            ))
          )}
        </svg>
      </div>

      {/* Legend / Role toggles */}
      <div className="mt-4">
        <p className="is-size-7 has-text-grey mb-2">Toggle industry baseline roles:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {availableRoles.map((role) => {
            const isSelected = selectedRoles.includes(role);
            const color = getRoleColor(role);
            return (
              <button
                key={role}
                className={`button is-small ${isSelected ? '' : 'is-dark'}`}
                style={
                  isSelected
                    ? { backgroundColor: color, borderColor: color, color: '#fff' }
                    : undefined
                }
                onClick={() => onRoleToggle(role)}
              >
                {ROLE_TITLE_LABELS[role]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Community data legend */}
      {showCommunityData && communitySeries && (
        <div className="mt-3 is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
          <span
            style={{
              display: 'inline-block',
              width: 24,
              height: 3,
              backgroundColor: '#fff',
              borderRadius: 2,
            }}
          />
          <span className="is-size-7" style={{ color: 'var(--text-emphasis)' }}>
            Community (n={communitySeries.sampleSize})
          </span>
        </div>
      )}

      <p className="is-size-7 has-text-grey mt-4">
        Industry baseline source: Aggregated from Hays, Seek, Stack Overflow surveys (2025)
      </p>
    </div>
  );
}

// ============================================
// BarChart
// ============================================

interface BarChartProps<T extends string> {
  title: string;
  data: DistributionItem<T>[];
  labels: Record<T, string>;
  orderedKeys?: T[];
  colorClass?: string;
}

function BarChart<T extends string>({
  title,
  data,
  labels,
  orderedKeys,
  colorClass = 'is-primary',
}: BarChartProps<T>) {
  const total = getTotalCount(data);
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const sortedData = useMemo(() => {
    if (orderedKeys) {
      return [...data].sort(
        (a, b) => orderedKeys.indexOf(a.value) - orderedKeys.indexOf(b.value)
      );
    }
    return [...data].sort((a, b) => b.count - a.count);
  }, [data, orderedKeys]);

  if (data.length === 0) {
    return (
      <div className="box">
        <p className="comment">{title}</p>
        <p className="has-text-grey" style={{ fontStyle: 'italic' }}>
          No data yet
        </p>
      </div>
    );
  }

  return (
    <div className="box">
      <p className="comment mb-3">{title}</p>
      <p className="is-size-7 has-text-grey mb-4">n={total}</p>
      <div className="distribution-chart">
        {sortedData.map((item) => {
          const percentage = total > 0 ? (item.count / total) * 100 : 0;
          const barWidth = (item.count / maxCount) * 100;
          return (
            <div key={item.value} className="distribution-row mb-2">
              <div className="distribution-label" title={labels[item.value]}>
                {labels[item.value]}
              </div>
              <div className="distribution-bar-container">
                <div
                  className={`distribution-bar ${colorClass}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="distribution-value">
                {item.count} ({percentage.toFixed(0)}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// GuardedBarChart
// ============================================

interface GuardedBarChartProps<T extends string> extends BarChartProps<T> {
  sampleSize: number;
  minimum?: number;
}

function GuardedBarChart<T extends string>({
  sampleSize,
  minimum = SAMPLE_SIZE.MINIMUM,
  title,
  ...barChartProps
}: GuardedBarChartProps<T>) {
  return (
    <div className="box">
      <p className="comment">{title}</p>
      <SampleSizeGuard n={sampleSize} minimum={minimum} label={title} progressColor="is-success">
        <p className="is-size-7 has-text-grey mb-4 mt-3">n={sampleSize}</p>
        <BarChartContent {...barChartProps} />
      </SampleSizeGuard>
    </div>
  );
}

function BarChartContent<T extends string>({
  data,
  labels,
  orderedKeys,
  colorClass = 'is-primary',
}: Omit<BarChartProps<T>, 'title'>) {
  const total = getTotalCount(data);
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const sortedData = useMemo(() => {
    if (orderedKeys) {
      return [...data].sort(
        (a, b) => orderedKeys.indexOf(a.value) - orderedKeys.indexOf(b.value)
      );
    }
    return [...data].sort((a, b) => b.count - a.count);
  }, [data, orderedKeys]);

  if (data.length === 0) {
    return (
      <p className="has-text-grey" style={{ fontStyle: 'italic' }}>
        No data yet
      </p>
    );
  }

  return (
    <div className="distribution-chart">
      {sortedData.map((item) => {
        const percentage = total > 0 ? (item.count / total) * 100 : 0;
        const barWidth = (item.count / maxCount) * 100;
        return (
          <div key={item.value} className="distribution-row mb-2">
            <div className="distribution-label" title={labels[item.value]}>
              {labels[item.value]}
            </div>
            <div className="distribution-bar-container">
              <div
                className={`distribution-bar ${colorClass}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <div className="distribution-value">
              {item.count} ({percentage.toFixed(0)}%)
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Main Stats Page
// ============================================

export function Stats() {
  const { data, loading, error } = useStats();
  const [selectedRoles, setSelectedRoles] = useState<RoleTitle[]>(['senior_dev', 'mid_dev']);
  const [showCommunityData, setShowCommunityData] = useState(true);

  const salaryCount = getTotalCount(data.salary);
  const salaryConfidence = getConfidenceLevel(salaryCount);
  const communityDataAvailable = salaryCount >= SAMPLE_SIZE.MINIMUM;

  const medianSalary = useMemo(
    () => getMedianFromDistribution(data.salary, SALARY_ORDER),
    [data.salary]
  );

  const topRole = useMemo(() => getModeFromDistribution(data.role), [data.role]);
  const topWfh = useMemo(() => getModeFromDistribution(data.wfh), [data.wfh]);

  // Get available roles from baselines
  const availableRoles = useMemo(() => {
    const roles = new Set(data.baselines.map((b) => b.role_title as RoleTitle));
    return Array.from(roles).sort((a, b) =>
      ROLE_TITLE_LABELS[a].localeCompare(ROLE_TITLE_LABELS[b])
    );
  }, [data.baselines]);

  // Build community data for chart
  // NOTE: This is an approximation. For accurate per-experience salary data,
  // we'd need a new DB function like get_salary_by_experience_distribution().
  // For now, we estimate by assuming salary scales proportionally with experience.
  const communityChartData = useMemo((): CommunityDataPoint[] => {
    if (data.salary.length === 0 || data.experience.length === 0) return [];

    // Get the overall median salary band
    const medianSalaryBand = getMedianFromDistribution(data.salary, SALARY_ORDER);
    if (!medianSalaryBand || medianSalaryBand === 'prefer_not_to_say') return [];

    const medianMidpoint = SALARY_MIDPOINTS[medianSalaryBand];
    if (!medianMidpoint) return [];

    // Get median experience to use as the anchor point
    const medianExp = getMedianFromDistribution(data.experience, EXPERIENCE_ORDER);
    if (!medianExp) return [];
    const medianExpIndex = EXPERIENCE_ORDER.indexOf(medianExp);

    // Create data points for each experience level in the community
    // Scale salary based on typical progression (~15% per level from median)
    const result: CommunityDataPoint[] = [];
    
    for (const expItem of data.experience) {
      if (expItem.value === 'student') continue;
      
      const expIndex = EXPERIENCE_ORDER.indexOf(expItem.value);
      const levelDiff = expIndex - medianExpIndex;
      
      // Estimate salary at this experience level (±15% per level from median)
      const scaleFactor = Math.pow(1.15, levelDiff);
      const estimatedSalary = Math.round(medianMidpoint * scaleFactor);
      
      // Find the closest salary band
      let closestBand: SalaryBand = medianSalaryBand;
      let closestDiff = Infinity;
      
      for (const band of SALARY_ORDER) {
        const midpoint = SALARY_MIDPOINTS[band];
        if (midpoint === null) continue;
        const diff = Math.abs(midpoint - estimatedSalary);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestBand = band;
        }
      }
      
      result.push({
        experience: expItem.value,
        salaryBand: closestBand,
        count: expItem.count,
      });
    }
    
    return result;
  }, [data.salary, data.experience]);

  const handleRoleToggle = (role: RoleTitle) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleToggleCommunityData = () => {
    setShowCommunityData((prev) => !prev);
  };

  if (loading) {
    return (
      <section className="section">
        <div className="container">
          <p className="prompt">community stats</p>
          <p className="comment">loading...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <p className="prompt">community stats</p>
          <article className="message is-danger">
            <div className="message-body">{error}</div>
          </article>
        </div>
      </section>
    );
  }

  const totalMembers = data.summary?.total_members ?? 0;
  const membersWithData = data.summary?.total_with_data ?? 0;

  return (
    <section className="section">
      <div className="container">
        <p className="prompt">community stats</p>
        <p className="comment">aggregate data — compare against industry baselines</p>

        {/* Sample size guidance banner */}
        {membersWithData > 0 && membersWithData < SAMPLE_SIZE.GOOD && (
          <article
            className={`message mt-4 ${membersWithData < SAMPLE_SIZE.MINIMUM ? 'is-warning' : 'is-info'}`}
          >
            <div className="message-body">
              {membersWithData < SAMPLE_SIZE.MINIMUM ? (
                <>
                  <strong>Building momentum:</strong> We have {membersWithData} members with
                  profile data. At {SAMPLE_SIZE.MINIMUM}+ we can show salary data with
                  reasonable confidence.
                </>
              ) : (
                <>
                  <strong>Growing dataset:</strong> With {membersWithData} members sharing
                  data, our statistics are becoming meaningful. At {SAMPLE_SIZE.GOOD}+
                  members we'll have high confidence.
                </>
              )}
            </div>
          </article>
        )}

        {membersWithData === 0 && (
          <article className="message is-info mt-4">
            <div className="message-body">
              No members have shared their profile data yet. Be the first to contribute by
              completing your profile!
            </div>
          </article>
        )}

        <br />

        {/* Summary Cards */}
        <div className="columns">
          <div className="column is-4">
            <div className="box">
              <p className="comment">members</p>
              <p style={{ fontSize: '1.5rem', color: 'var(--text-emphasis)' }}>{totalMembers}</p>
              <p className="is-size-7 has-text-grey">{membersWithData} with profile data</p>
            </div>
          </div>
          <div className="column is-4">
            <div className="box">
              <p className="comment">median salary band</p>
              <SampleSizeGuard n={salaryCount} label="Salary data" inline>
                <p style={{ fontSize: '1.5rem', color: 'var(--text-emphasis)' }}>
                  {medianSalary ? SALARY_BAND_LABELS[medianSalary] : '—'}
                </p>
                <p className={`is-size-7 ${getConfidenceColor(salaryConfidence)}`}>
                  n={salaryCount} · {getConfidenceLabel(salaryConfidence)}
                </p>
              </SampleSizeGuard>
            </div>
          </div>
          <div className="column is-4">
            <div className="box">
              <p className="comment">top role</p>
              <p style={{ fontSize: '1.5rem', color: 'var(--text-emphasis)' }}>
                {topRole ? ROLE_TITLE_LABELS[topRole.value] : '—'}
              </p>
              <p className="is-size-7 has-text-grey">
                {topRole ? `${topRole.count} members` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Salary Progression Chart */}
        <p className="prompt mt-5">salary comparison</p>
        <p className="comment mb-4">
          compare community data against industry baselines
        </p>

        <SalaryProgressionChart
          baselines={data.baselines}
          selectedRoles={selectedRoles}
          onRoleToggle={handleRoleToggle}
          availableRoles={availableRoles}
          communityData={communityChartData}
          showCommunityData={showCommunityData && communityDataAvailable}
          onToggleCommunityData={handleToggleCommunityData}
          communityDataAvailable={communityDataAvailable}
        />

        {/* Community vs Industry comparison (when we have data) */}
        {salaryCount >= SAMPLE_SIZE.MINIMUM && (
          <>
            <p className="prompt mt-5">community comparison</p>
            <p className="comment mb-4">how our members compare to industry baselines</p>

            <div className="columns">
              <div className="column is-6">
                <div className="box">
                  <p className="comment mb-3">Community Median Salary</p>
                  <p className="is-size-3" style={{ color: 'var(--text-emphasis)', fontWeight: 600 }}>
                    {medianSalary ? SALARY_BAND_LABELS[medianSalary] : '—'}
                  </p>
                  <p className={`is-size-7 ${getConfidenceColor(salaryConfidence)}`}>
                    n={salaryCount} · {getConfidenceLabel(salaryConfidence)}
                  </p>
                </div>
              </div>
              <div className="column is-6">
                <div className="box">
                  <p className="comment mb-3">Work Arrangement</p>
                  <div className="columns is-mobile">
                    <div className="column">
                      <p className="is-size-7 has-text-grey">Community Top</p>
                      <p className="is-size-4" style={{ color: 'var(--text-emphasis)', fontWeight: 600 }}>
                        {topWfh ? WFH_STATUS_LABELS[topWfh.value] : '—'}
                      </p>
                      {topWfh && (
                        <p className="is-size-7 has-text-grey">
                          {((topWfh.count / getTotalCount(data.wfh)) * 100).toFixed(0)}% of members
                        </p>
                      )}
                    </div>
                    <div
                      className="column is-narrow"
                      style={{ display: 'flex', alignItems: 'center', padding: '0 1rem' }}
                    >
                      <span className="has-text-grey">vs</span>
                    </div>
                    <div className="column has-text-right">
                      <p className="is-size-7 has-text-grey">Industry Trend</p>
                      <p className="is-size-4" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                        Hybrid
                      </p>
                      <p className="is-size-7 has-text-grey">mostly office (2024)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Distribution Charts */}
        <p className="prompt mt-5">distributions</p>
        <p className="comment mb-4">breakdown of community demographics</p>

        <div className="columns">
          <div className="column is-6">
            <GuardedBarChart
              title="Salary Distribution"
              sampleSize={salaryCount}
              data={data.salary.filter((d) => d.value !== 'prefer_not_to_say')}
              labels={SALARY_BAND_LABELS}
              orderedKeys={SALARY_ORDER.filter((k) => k !== 'prefer_not_to_say')}
              colorClass="is-success"
            />
          </div>
          <div className="column is-6">
            <BarChart
              title="Experience Distribution"
              data={data.experience}
              labels={EXPERIENCE_BAND_LABELS}
              orderedKeys={EXPERIENCE_ORDER}
              colorClass="is-info"
            />
          </div>
        </div>

        <div className="columns">
          <div className="column is-6">
            <BarChart
              title="Role Distribution"
              data={data.role}
              labels={ROLE_TITLE_LABELS}
              colorClass="is-warning"
            />
          </div>
          <div className="column is-6">
            <BarChart
              title="Work From Home Status"
              data={data.wfh}
              labels={WFH_STATUS_LABELS}
              colorClass="is-link"
            />
          </div>
        </div>

        <div className="columns">
          <div className="column is-6">
            <BarChart
              title="Employment Type"
              data={data.employment}
              labels={EMPLOYMENT_TYPE_LABELS}
              colorClass="is-primary"
            />
          </div>
          <div className="column is-6">
            <div className="box">
              <p className="comment mb-3">About This Data</p>
              <p className="is-size-7 has-text-grey mb-2">
                <strong>Community data:</strong> Self-reported by members during onboarding.
                Salary is collected in bands to protect privacy.
              </p>
              <p className="is-size-7 has-text-grey mb-2">
                <strong>Industry baselines:</strong> Aggregated from Hays, Seek, and Stack
                Overflow surveys. Updated annually.
              </p>
              <p className="is-size-7 has-text-grey">
                <strong>Confidence thresholds:</strong> n≥{SAMPLE_SIZE.MINIMUM} for salary
                data, n≥{SAMPLE_SIZE.MODERATE} for moderate confidence, n≥{SAMPLE_SIZE.GOOD}{' '}
                for good confidence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
