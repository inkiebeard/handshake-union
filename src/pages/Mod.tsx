import { useState } from 'react';
import { useModerationReports } from '../hooks/useModerationReports';
import { LinkPreview } from '../components/chat/LinkPreview';
import type { ReportWithPseudonyms, UserBan, ModerationReportStatus } from '../types/database';

// ============================================
// Utilities
// ============================================

// Supabase PostgrestError is not instanceof Error — extract .message safely
function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return fallback;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatExpiry(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 24) return `${hrs}h remaining`;
  const days = Math.floor(hrs / 24);
  return `${days}d remaining`;
}

const STATUS_COLORS: Record<ModerationReportStatus, string> = {
  pending:   'is-warning',
  reviewed:  'is-info',
  actioned:  'is-danger',
  dismissed: 'is-dark',
};

// ============================================
// BanForm — inline ban form attached to a report card
// ============================================

interface BanFormProps {
  authorProfileId: string;
  authorPseudonym: string;
  onBan: (banType: 'timeout' | 'permanent', reason: string, expiresAt: string) => Promise<void>;
  onClose: () => void;
}

function BanForm({ authorPseudonym, onBan, onClose }: BanFormProps) {
  const [banType, setBanType] = useState<'timeout' | 'permanent'>('timeout');
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState('24');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const expiresAt =
        banType === 'timeout'
          ? new Date(Date.now() + Number(hours) * 3_600_000).toISOString()
          : '';
      await onBan(banType, reason, expiresAt);
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to ban user'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
      <p className="is-size-7 has-text-warning mb-2"># ban {authorPseudonym}</p>

      <div className="field is-grouped mb-2">
        <div className="control">
          <label className="radio is-size-7">
            <input
              type="radio"
              value="timeout"
              checked={banType === 'timeout'}
              onChange={() => setBanType('timeout')}
              className="mr-1"
            />
            timeout
          </label>
        </div>
        <div className="control ml-3">
          <label className="radio is-size-7">
            <input
              type="radio"
              value="permanent"
              checked={banType === 'permanent'}
              onChange={() => setBanType('permanent')}
              className="mr-1"
            />
            permanent
          </label>
        </div>
      </div>

      {banType === 'timeout' && (
        <div className="field mb-2">
          <div className="control">
            <input
              className="input is-small"
              type="number"
              min="1"
              max="8760"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="hours"
              style={{ maxWidth: '120px' }}
            />
            <span className="is-size-7 has-text-grey ml-2">hours</span>
          </div>
        </div>
      )}

      <div className="field mb-2">
        <div className="control">
          <input
            className="input is-small"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="reason (optional)"
          />
        </div>
      </div>

      {error && <p className="is-size-7 has-text-danger mb-2">{error}</p>}

      <div className="field is-grouped">
        <div className="control">
          <button
            type="submit"
            className="button is-danger is-small"
            disabled={submitting}
          >
            {submitting ? 'banning...' : 'confirm ban'}
          </button>
        </div>
        <div className="control">
          <button type="button" className="button is-ghost is-small" onClick={onClose}>
            cancel
          </button>
        </div>
      </div>
    </form>
  );
}

// ============================================
// ReportCard
// ============================================

interface ReportCardProps {
  report: ReportWithPseudonyms;
  onResolve: (id: string, status: Exclude<ModerationReportStatus, 'pending'>, notes?: string) => Promise<void>;
  onBan: (targetProfileId: string, banType: 'timeout' | 'permanent', reason: string, expiresAt: string) => Promise<void>;
}

function ReportCard({ report, onResolve, onBan }: ReportCardProps) {
  const [resolving, setResolving] = useState<string | null>(null);
  const [showBanForm, setShowBanForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = report.status === 'pending';

  const handleResolve = async (status: Exclude<ModerationReportStatus, 'pending'>) => {
    setError(null);
    setResolving(status);
    try {
      await onResolve(report.id, status, notes || undefined);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to resolve report'));
    } finally {
      setResolving(null);
    }
  };

  const handleBan = async (banType: 'timeout' | 'permanent', reason: string, expiresAt: string) => {
    await onBan(report.message_author_profile_id, banType, reason, expiresAt);
  };

  return (
    <div className="box mb-3" style={{ borderLeft: `3px solid ${isPending ? 'var(--color-warning, #f5a623)' : 'var(--border)'}` }}>
      <div className="is-flex is-justify-content-space-between is-align-items-start mb-2" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
        <div className="is-flex" style={{ gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`tag ${STATUS_COLORS[report.status]}`}>{report.status}</span>
          <span className="tag is-dark">#{report.message_room}</span>
          <span className="is-size-7" style={{ color: 'var(--accent)' }}>
            {report.message_author_pseudonym}
          </span>
        </div>
        <span className="is-size-7 has-text-grey">{timeAgo(report.reported_at)}</span>
      </div>

      {report.message_content && (
        <p
          className="is-size-7 mb-2"
          style={{
            fontFamily: 'inherit',
            background: 'var(--bg)',
            padding: '0.4rem 0.6rem',
            borderRadius: '3px',
            wordBreak: 'break-word',
          }}
        >
          {report.message_content}
        </p>
      )}

      {report.message_image_url && (
        <div className="mb-2">
          <img
            src={report.message_image_url}
            alt="reported image"
            style={{
              maxWidth: '100%',
              maxHeight: '280px',
              borderRadius: '4px',
              display: 'block',
              border: '1px solid var(--border)',
            }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      )}

      {report.message_link_url && (
        <div className="mb-2" style={{ maxWidth: '420px' }}>
          <LinkPreview url={report.message_link_url} />
        </div>
      )}

      <div className="is-flex" style={{ gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <span className="is-size-7 has-text-grey">
          reason: <span style={{ color: 'var(--text)' }}>{report.reason ?? '—'}</span>
        </span>
        <span className="is-size-7 has-text-grey">
          reported by: <span style={{ color: 'var(--text)' }}>{report.reporter_pseudonym}</span>
        </span>
        <span className="is-size-7 has-text-grey">
          msg sent: {timeAgo(report.message_created_at)}
        </span>
      </div>

      {report.resolution_notes && (
        <p className="is-size-7 has-text-grey mb-2">
          notes: <span style={{ color: 'var(--text)' }}>{report.resolution_notes}</span>
        </p>
      )}

      {error && <p className="is-size-7 has-text-danger mb-2">{error}</p>}

      {isPending && (
        <>
          {showNotes && (
            <div className="field mb-2">
              <div className="control">
                <input
                  className="input is-small"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="resolution notes (optional)"
                />
              </div>
            </div>
          )}

          <div className="is-flex" style={{ gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="button is-info is-small"
              disabled={resolving !== null}
              onClick={() => handleResolve('reviewed')}
            >
              {resolving === 'reviewed' ? '...' : 'reviewed'}
            </button>
            <button
              className="button is-warning is-small"
              disabled={resolving !== null}
              onClick={() => handleResolve('actioned')}
            >
              {resolving === 'actioned' ? '...' : 'actioned'}
            </button>
            <button
              className="button is-dark is-small"
              disabled={resolving !== null}
              onClick={() => handleResolve('dismissed')}
            >
              {resolving === 'dismissed' ? '...' : 'dismiss'}
            </button>
            <button
              className="button is-ghost is-small"
              onClick={() => setShowNotes((v) => !v)}
              style={{ color: 'var(--text-muted)' }}
            >
              {showNotes ? 'hide notes' : '+ notes'}
            </button>
            <button
              className="button is-danger is-small is-outlined"
              onClick={() => setShowBanForm((v) => !v)}
            >
              ban author
            </button>
          </div>

          {showBanForm && (
            <BanForm
              authorProfileId={report.message_author_profile_id}
              authorPseudonym={report.message_author_pseudonym}
              onBan={handleBan}
              onClose={() => setShowBanForm(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// BanCard
// ============================================

interface BanCardProps {
  ban: UserBan;
  onLift: (banId: string) => Promise<void>;
}

function BanCard({ ban, onLift }: BanCardProps) {
  const [lifting, setLifting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLift = async () => {
    setError(null);
    setLifting(true);
    try {
      await onLift(ban.id);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to lift ban'));
      setLifting(false);
    }
  };

  return (
    <div className="box mb-3" style={{ borderLeft: `3px solid ${ban.ban_type === 'permanent' ? '#ff7b72' : '#f0883e'}` }}>
      <div className="is-flex is-justify-content-space-between is-align-items-start mb-2" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
        <div className="is-flex" style={{ gap: '0.5rem', alignItems: 'center' }}>
          <span className={`tag ${ban.ban_type === 'permanent' ? 'is-danger' : 'is-warning'}`}>
            {ban.ban_type}
          </span>
          <span style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>{ban.pseudonym}</span>
        </div>
        <span className="is-size-7 has-text-grey">{timeAgo(ban.banned_at)}</span>
      </div>

      <div className="is-flex" style={{ gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {ban.reason && (
          <span className="is-size-7 has-text-grey">
            reason: <span style={{ color: 'var(--text)' }}>{ban.reason}</span>
          </span>
        )}
        <span className="is-size-7 has-text-grey">
          by: <span style={{ color: 'var(--text)' }}>{ban.banned_by_pseudonym}</span>
        </span>
        {ban.ban_type === 'timeout' && (
          <span className="is-size-7 has-text-grey">
            expires: <span style={{ color: 'var(--text)' }}>{formatExpiry(ban.expires_at)}</span>
          </span>
        )}
      </div>

      {error && <p className="is-size-7 has-text-danger mb-2">{error}</p>}

      <button
        className="button is-ghost is-small"
        style={{ color: 'var(--text-muted)' }}
        disabled={lifting}
        onClick={handleLift}
      >
        {lifting ? 'lifting...' : 'lift ban'}
      </button>
    </div>
  );
}

// ============================================
// Main Mod Page
// ============================================

type Tab = 'queue' | 'bans';
type QueueFilter = 'all' | ModerationReportStatus;

export function Mod() {
  const { reports, activeBans, loading, error, resolveReport, banUser, liftBan } =
    useModerationReports();

  const [tab, setTab] = useState<Tab>('queue');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('pending');

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  const filteredReports =
    queueFilter === 'all' ? reports : reports.filter((r) => r.status === queueFilter);

  if (loading) {
    return (
      <section className="section">
        <div className="container">
          <p className="prompt">mod queue</p>
          <p className="comment">loading...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <p className="prompt">mod queue</p>
          <article className="message is-danger">
            <div className="message-body">{error}</div>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <p className="prompt">mod queue</p>
        <p className="comment mb-4">
          {pendingCount} pending · {activeBans.length} active bans
        </p>

        {/* Tab switcher */}
        <div className="tabs mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <ul>
            <li className={tab === 'queue' ? 'is-active' : ''}>
              <a onClick={() => setTab('queue')} style={{ cursor: 'pointer' }}>
                /queue
                {pendingCount > 0 && (
                  <span className="tag is-warning is-small ml-2">{pendingCount}</span>
                )}
              </a>
            </li>
            <li className={tab === 'bans' ? 'is-active' : ''}>
              <a onClick={() => setTab('bans')} style={{ cursor: 'pointer' }}>
                /bans
                {activeBans.length > 0 && (
                  <span className="tag is-danger is-small ml-2">{activeBans.length}</span>
                )}
              </a>
            </li>
          </ul>
        </div>

        {/* Queue tab */}
        {tab === 'queue' && (
          <>
            {/* Filter */}
            <div className="is-flex mb-4" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
              {(['pending', 'all', 'reviewed', 'actioned', 'dismissed'] as QueueFilter[]).map(
                (f) => (
                  <button
                    key={f}
                    className={`button is-small ${queueFilter === f ? 'is-primary' : 'is-dark'}`}
                    onClick={() => setQueueFilter(f)}
                  >
                    {f}
                    {f === 'pending' && pendingCount > 0 && (
                      <span className="ml-1">({pendingCount})</span>
                    )}
                  </button>
                )
              )}
            </div>

            {filteredReports.length === 0 ? (
              <p className="has-text-grey">
                {queueFilter === 'pending' ? '# queue is clear' : `# no ${queueFilter} reports`}
              </p>
            ) : (
              filteredReports.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  onResolve={resolveReport}
                  onBan={(profileId, banType, reason, expiresAt) =>
                    banUser(profileId, banType, reason, expiresAt)
                  }
                />
              ))
            )}
          </>
        )}

        {/* Bans tab */}
        {tab === 'bans' && (
          <>
            {activeBans.length === 0 ? (
              <p className="has-text-grey"># no active bans</p>
            ) : (
              activeBans.map((ban) => (
                <BanCard key={ban.id} ban={ban} onLift={liftBan} />
              ))
            )}
          </>
        )}
      </div>
    </section>
  );
}
