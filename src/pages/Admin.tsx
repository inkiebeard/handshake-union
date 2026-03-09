import { useState, useMemo } from 'react';
import { useAdminStats } from '../hooks/useAdminStats';
import type { ActivityDataPoint, UserRoleEntry, UserRole } from '../types/database';

// ============================================
// Activity bar chart (SVG, terminal aesthetic)
// ============================================

interface ActivityChartProps {
  data: ActivityDataPoint[];
  title: string;
  color: string;
  emptyLabel?: string;
}

function ActivityChart({ data, title, color, emptyLabel = 'No data for this period' }: ActivityChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const width   = 900;
  const height  = 220;
  const pad     = { top: 24, right: 20, bottom: 44, left: 52 };
  const cw      = width  - pad.left - pad.right;
  const ch      = height - pad.top  - pad.bottom;
  const barSlot = data.length > 0 ? cw / data.length : cw;
  const barW    = Math.max(barSlot - 2, 2);

  const yTicks = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="box">
      <p className="comment mb-3">{title}</p>
      {data.length === 0 ? (
        <p className="has-text-grey is-size-7">{emptyLabel}</p>
      ) : (
        <div style={{ width: '100%' }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: 'auto', minHeight: 150 }}
          >
            {/* Y-axis grid + labels */}
            {yTicks.map((frac) => {
              const y = pad.top + ch * (1 - frac);
              const val = Math.round(maxCount * frac);
              return (
                <g key={frac}>
                  <line
                    x1={pad.left} y1={y}
                    x2={width - pad.right} y2={y}
                    stroke="var(--border)" strokeWidth={1} strokeDasharray="4,4"
                  />
                  <text
                    x={pad.left - 8} y={y}
                    textAnchor="end" dominantBaseline="middle"
                    fill="var(--text-muted)" fontSize={11} fontFamily="inherit"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Baseline */}
            <line
              x1={pad.left} y1={pad.top + ch}
              x2={width - pad.right} y2={pad.top + ch}
              stroke="var(--border)" strokeWidth={1}
            />

            {/* Bars */}
            {data.map((d, i) => {
              const x       = pad.left + i * barSlot + (barSlot - barW) / 2;
              const barH    = Math.max((d.count / maxCount) * ch, d.count > 0 ? 2 : 0);
              const y       = pad.top + ch - barH;
              return (
                <rect
                  key={d.day} x={x} y={y} width={barW} height={barH}
                  fill={color} opacity={0.85} rx={2}
                />
              );
            })}

            {/* X-axis date labels — show ~8 evenly spaced */}
            {data.map((d, i) => {
              const every = Math.max(Math.ceil(data.length / 8), 1);
              if (i % every !== 0 && i !== data.length - 1) return null;
              const x       = pad.left + i * barSlot + barSlot / 2;
              const dateStr = new Date(d.day).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
              return (
                <text
                  key={d.day} x={x} y={height - pad.bottom + 16}
                  textAnchor="middle" fill="var(--text-muted)" fontSize={10} fontFamily="inherit"
                >
                  {dateStr}
                </text>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

// ============================================
// Overview stat card
// ============================================

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  highlight?: boolean;
  warning?: boolean;
}

function StatCard({ label, value, sub, highlight, warning }: StatCardProps) {
  return (
    <div className="box">
      <p className="comment">{label}</p>
      <p style={{ fontSize: '1.6rem', color: warning ? '#f0883e' : highlight ? 'var(--accent)' : 'var(--text-emphasis)', fontWeight: 600 }}>
        {value}
      </p>
      {sub && <p className="is-size-7 has-text-grey">{sub}</p>}
    </div>
  );
}

// ============================================
// Role management table
// ============================================

const ROLE_ORDER: UserRole[] = ['admin', 'moderator', 'member'];
const ROLE_COLORS: Record<UserRole, string> = {
  admin:     'is-danger',
  moderator: 'is-warning',
  member:    'is-dark',
};

interface RoleTableProps {
  users: UserRoleEntry[];
  onAssign: (profileId: string, role: string) => Promise<void>;
}

function RoleTable({ users, onAssign }: RoleTableProps) {
  const [search, setSearch] = useState('');
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () => users.filter((u) => u.pseudonym.toLowerCase().includes(search.toLowerCase())),
    [users, search]
  );

  const handleAssign = async (profileId: string) => {
    const newRole = pendingRole[profileId];
    if (!newRole) return;
    setError(null);
    setAssigning(profileId);
    try {
      await onAssign(profileId, newRole);
      setPendingRole((prev) => {
        const next = { ...prev };
        delete next[profileId];
        return next;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to assign role'
      );
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="box">
      <p className="comment mb-3">user roles</p>

      <div className="field mb-3">
        <div className="control">
          <input
            className="input is-small"
            type="text"
            placeholder="search pseudonym..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '280px' }}
          />
        </div>
      </div>

      {error && (
        <article className="message is-danger is-small mb-3">
          <div className="message-body">{error}</div>
        </article>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="table is-fullwidth is-narrow" style={{ fontSize: '0.8rem' }}>
          <thead>
            <tr>
              <th style={{ color: 'var(--text-muted)' }}>pseudonym</th>
              <th style={{ color: 'var(--text-muted)' }}>current role</th>
              <th style={{ color: 'var(--text-muted)' }}>msgs</th>
              <th style={{ color: 'var(--text-muted)' }}>joined</th>
              <th style={{ color: 'var(--text-muted)' }}>assign role</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.profile_id}>
                <td style={{ color: 'var(--accent)', fontFamily: 'inherit' }}>{u.pseudonym}</td>
                <td>
                  <span className={`tag is-small ${ROLE_COLORS[u.role] ?? 'is-dark'}`}>
                    {u.role}
                  </span>
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{u.message_count}</td>
                <td style={{ color: 'var(--text-muted)' }}>
                  {new Date(u.member_since).toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' })}
                </td>
                <td>
                  <div className="is-flex" style={{ gap: '0.3rem', alignItems: 'center' }}>
                    <div className="select is-small">
                      <select
                        value={pendingRole[u.profile_id] ?? u.role}
                        onChange={(e) =>
                          setPendingRole((prev) => ({ ...prev, [u.profile_id]: e.target.value }))
                        }
                        style={{ fontSize: '0.75rem' }}
                      >
                        {ROLE_ORDER.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    {pendingRole[u.profile_id] && pendingRole[u.profile_id] !== u.role && (
                      <button
                        className="button is-primary is-small"
                        disabled={assigning === u.profile_id}
                        onClick={() => handleAssign(u.profile_id)}
                      >
                        {assigning === u.profile_id ? '...' : 'apply'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="has-text-grey is-size-7">no users match</p>
      )}
    </div>
  );
}

// ============================================
// Main Admin Page
// ============================================

const DAY_OPTIONS = [7, 14, 30, 90] as const;

export function Admin() {
  const {
    overview,
    loginActivity,
    messageActivity,
    userRoles,
    loading,
    error,
    daysBack,
    setDaysBack,
    assignRole,
  } = useAdminStats();

  if (loading) {
    return (
      <section className="section">
        <div className="container">
          <p className="prompt">admin panel</p>
          <p className="comment">loading...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <p className="prompt">admin panel</p>
          <article className="message is-danger">
            <div className="message-body">{error}</div>
          </article>
        </div>
      </section>
    );
  }

  const adminCount = userRoles.filter((u) => u.role === 'admin').length;
  const modCount   = userRoles.filter((u) => u.role === 'moderator').length;

  return (
    <section className="section">
      <div className="container">
        <p className="prompt">admin panel</p>
        <p className="comment mb-5">platform health · role management · activity</p>

        {/* Overview cards */}
        <p className="prompt mt-2">overview</p>
        <div className="columns is-multiline mt-2">
          <div className="column is-one-fifth-widescreen is-half-mobile is-one-third-tablet">
            <StatCard
              label="total members"
              value={overview?.total_members ?? 0}
              sub={`${adminCount} admin · ${modCount} mod`}
            />
          </div>
          <div className="column is-one-fifth-widescreen is-half-mobile is-one-third-tablet">
            <StatCard
              label="active sessions"
              value={overview?.active_sessions ?? 0}
              sub="currently logged in"
              highlight
            />
          </div>
          <div className="column is-one-fifth-widescreen is-half-mobile is-one-third-tablet">
            <StatCard
              label="pending reports"
              value={overview?.pending_reports ?? 0}
              sub="awaiting review"
              warning={(overview?.pending_reports ?? 0) > 0}
            />
          </div>
          <div className="column is-one-fifth-widescreen is-half-mobile is-one-third-tablet">
            <StatCard
              label="active bans"
              value={overview?.active_bans ?? 0}
              sub="timeout + permanent"
              warning={(overview?.active_bans ?? 0) > 0}
            />
          </div>
          <div className="column is-one-fifth-widescreen is-half-mobile is-one-third-tablet">
            <StatCard
              label="messages (24h)"
              value={overview?.messages_24h ?? 0}
              sub="from receipts"
            />
          </div>
        </div>

        {/* Activity charts */}
        <div className="is-flex is-align-items-center mt-5 mb-3" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <p className="prompt" style={{ margin: 0 }}>activity</p>
          <div className="is-flex" style={{ gap: '0.3rem' }}>
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                className={`button is-small ${daysBack === d ? 'is-primary' : 'is-dark'}`}
                onClick={() => setDaysBack(d)}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div className="columns">
          <div className="column is-6">
            <ActivityChart
              data={loginActivity}
              title={`# logins — last ${daysBack} days (unique users/day)`}
              color="var(--accent)"
              emptyLabel="No login events recorded in this period"
            />
          </div>
          <div className="column is-6">
            <ActivityChart
              data={messageActivity}
              title={`# messages — last ${daysBack} days (receipts/day)`}
              color="#58a6ff"
              emptyLabel="No messages recorded in this period"
            />
          </div>
        </div>

        {/* Role management */}
        <p className="prompt mt-5">roles</p>
        <p className="comment mb-3">assign moderator or admin roles to members</p>
        <RoleTable users={userRoles} onAssign={assignRole} />
      </div>
    </section>
  );
}
