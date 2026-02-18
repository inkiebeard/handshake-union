import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';
import { OnboardingForm } from '../components/onboarding/OnboardingForm';
import { PixelAvatar } from '../components/PixelAvatar';
import {
  SALARY_BAND_LABELS,
  EXPERIENCE_BAND_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  WFH_STATUS_LABELS,
  ROLE_TITLE_LABELS,
} from '../lib/constants';
import type { Profile as ProfileType } from '../types/database';

// ---- Rename pseudonym component ----

function PseudonymRename({ profile, onRenamed }: { profile: ProfileType; onRenamed: () => void }) {
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(profile.pseudonym);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const handleSave = async () => {
    if (newName.trim() === profile.pseudonym) {
      setEditing(false);
      return;
    }

    if (!showWarning) {
      setShowWarning(true);
      return;
    }

    setError(null);
    setSaving(true);

    const { error: rpcError } = await supabase.rpc('rename_pseudonym', {
      new_name: newName.trim(),
    });

    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setEditing(false);
      setShowWarning(false);
      onRenamed();
    }
  };

  const handleCancel = () => {
    setNewName(profile.pseudonym);
    setEditing(false);
    setShowWarning(false);
    setError(null);
  };

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <PixelAvatar seed={profile.pseudonym} size={36} />
        <div style={{ flex: 1 }}>
          <p style={{ color: 'var(--text-emphasis)', fontWeight: 600, fontSize: '1.1rem' }}>
            {profile.pseudonym}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            member since {new Date(profile.created_at).toLocaleDateString()}
          </p>
        </div>
        <button
          className="button is-ghost is-small"
          onClick={() => setEditing(true)}
          style={{ fontSize: '0.8rem' }}
        >
          rename
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <PixelAvatar seed={newName || profile.pseudonym} size={36} />
        <div style={{ flex: 1 }}>
          <input
            className="input"
            type="text"
            value={newName}
            onChange={e => {
              setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
              setShowWarning(false);
              setError(null);
            }}
            placeholder="new_pseudonym"
            maxLength={24}
            style={{ fontSize: '0.9rem' }}
          />
        </div>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
        3-24 chars, lowercase letters, numbers, underscores. avatar updates with name.
      </p>

      {showWarning && (
        <div className="notification" style={{
          marginBottom: '0.75rem',
          borderColor: '#f0883e',
          color: '#f0883e',
          fontSize: '0.85rem',
          padding: '0.75rem 1rem',
        }}>
          <strong style={{ color: '#f0883e' }}>privacy warning:</strong> choosing a recognisable
          name (like a real name, github handle, or known alias) could link this anonymous
          profile to your public identity. your pseudonym is visible in chat.
          <br /><br />
          <strong style={{ color: '#f0883e' }}>click rename again to confirm.</strong>
        </div>
      )}

      {error && (
        <div className="notification is-danger" style={{ marginBottom: '0.75rem', fontSize: '0.85rem', padding: '0.75rem 1rem' }}>
          {error}
        </div>
      )}

      <div className="field is-grouped">
        <div className="control">
          <button
            className={`button is-primary is-small ${saving ? 'is-loading' : ''}`}
            onClick={handleSave}
            disabled={saving || newName.trim().length < 3}
          >
            {showWarning ? 'confirm rename' : 'rename'}
          </button>
        </div>
        <div className="control">
          <button className="button is-ghost is-small" onClick={handleCancel}>
            cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Profile summary ----

function ProfileSummary({ profile, onRenamed }: { profile: ProfileType; onRenamed: () => void }) {
  const fields = [
    { label: 'role', value: profile.role_title ? ROLE_TITLE_LABELS[profile.role_title] : null },
    { label: 'salary', value: profile.salary_band ? SALARY_BAND_LABELS[profile.salary_band] : null },
    { label: 'experience', value: profile.experience_band ? EXPERIENCE_BAND_LABELS[profile.experience_band] : null },
    { label: 'employment', value: profile.employment_type ? EMPLOYMENT_TYPE_LABELS[profile.employment_type] : null },
    { label: 'wfh', value: profile.wfh_status ? WFH_STATUS_LABELS[profile.wfh_status] : null },
    { label: 'country', value: profile.country },
    { label: 'visa', value: profile.requires_visa === true ? 'yes' : profile.requires_visa === false ? 'no' : null },
  ];

  const filled = fields.filter(f => f.value);

  return (
    <div className="box" style={{ marginBottom: '1.5rem' }}>
      <PseudonymRename profile={profile} onRenamed={onRenamed} />

      {filled.length > 0 && (
        <>
          <hr className="term-divider" />
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 1rem' }}>
            {filled.map(f => (
              <div key={f.label} style={{ display: 'contents' }}>
                <span style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                <span style={{ color: 'var(--text-emphasis)' }}>{f.value}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {filled.length === 0 && (
        <>
          <hr className="term-divider" />
          <p className="comment">no profile data yet — fill in the form below</p>
        </>
      )}
    </div>
  );
}

// ---- Profile page ----

export function Profile() {
  const { user } = useAuth();
  const { profile, loading, error, refetch } = useProfile(user?.id);

  return (
    <section className="section">
      <div className="container">
        <div className="columns is-centered">
          <div className="column is-5">
            <p className="prompt">profile</p>
            <p className="comment">your data is anonymous — only aggregates are shown publicly</p>
            <p className="comment">individual profiles and history are never visible to others</p>

            <br />

            {loading && <p className="comment">loading profile...</p>}

            {error && (
              <div className="notification is-danger">
                error: {error}
              </div>
            )}

            {profile && (
              <>
                <ProfileSummary profile={profile} onRenamed={refetch} />

                <p className="comment">edit your details</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  changes are recorded over time to track industry trends — only anonymised aggregates are ever shared
                </p>

                <OnboardingForm profile={profile} onSaved={refetch} mode="profile" />
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
