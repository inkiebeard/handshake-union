import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PixelAvatar } from '../PixelAvatar';
import {
  SALARY_BAND_LABELS,
  EXPERIENCE_BAND_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  WFH_STATUS_LABELS,
  ROLE_TITLE_LABELS,
  COUNTRY_OPTIONS,
} from '../../lib/constants';
import type {
  Profile,
  SalaryBand,
  ExperienceBand,
  EmploymentType,
  WfhStatus,
  RoleTitle,
} from '../../types/database';

interface OnboardingFormProps {
  profile: Profile;
  onSaved: () => void;
  mode?: 'onboarding' | 'profile';
}

interface FormData {
  salary_band: SalaryBand | '';
  experience_band: ExperienceBand | '';
  employment_type: EmploymentType | '';
  wfh_status: WfhStatus | '';
  role_title: RoleTitle | '';
  country: string;
  requires_visa: boolean;
}

export function OnboardingForm({ profile, onSaved, mode = 'onboarding' }: OnboardingFormProps) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<FormData>({
    salary_band: profile.salary_band ?? '',
    experience_band: profile.experience_band ?? '',
    employment_type: profile.employment_type ?? '',
    wfh_status: profile.wfh_status ?? '',
    role_title: profile.role_title ?? '',
    country: profile.country ?? '',
    requires_visa: profile.requires_visa ?? false,
  });

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const updates: Record<string, unknown> = {
      onboarding_complete: true,
      salary_band: form.salary_band || null,
      experience_band: form.experience_band || null,
      employment_type: form.employment_type || null,
      wfh_status: form.wfh_status || null,
      role_title: form.role_title || null,
      country: form.country || null,
      requires_visa: form.requires_visa || null,
    };

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSaved(true);
      onSaved();
    }
  };

  const handleSkip = async () => {
    await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', profile.id);
    navigate('/chat');
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <PixelAvatar seed={profile.pseudonym} size={32} />
        <div>
          <p style={{ color: 'var(--text-emphasis)', fontWeight: 500 }}>{profile.pseudonym}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            member since {new Date(profile.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <hr className="term-divider" />

      {error && (
        <div className="notification is-danger" style={{ marginBottom: '1rem' }}>
          error: {error}
        </div>
      )}

      {saved && (
        <div className="notification" style={{ marginBottom: '1rem', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
          profile saved.{mode === 'onboarding' && (
            <>{' '}<a onClick={() => navigate('/chat')} style={{ color: 'var(--accent)', cursor: 'pointer' }}>go to chat →</a></>
          )}
        </div>
      )}

      <SelectField
        label="role"
        comment="what do you do?"
        value={form.role_title}
        options={ROLE_TITLE_LABELS}
        onChange={v => updateField('role_title', v as RoleTitle | '')}
      />

      <SelectField
        label="salary band"
        comment="AUD, before tax"
        value={form.salary_band}
        options={SALARY_BAND_LABELS}
        onChange={v => updateField('salary_band', v as SalaryBand | '')}
      />

      <SelectField
        label="experience"
        comment="total years in the industry"
        value={form.experience_band}
        options={EXPERIENCE_BAND_LABELS}
        onChange={v => updateField('experience_band', v as ExperienceBand | '')}
      />

      <SelectField
        label="employment type"
        value={form.employment_type}
        options={EMPLOYMENT_TYPE_LABELS}
        onChange={v => updateField('employment_type', v as EmploymentType | '')}
      />

      <SelectField
        label="work from home"
        value={form.wfh_status}
        options={WFH_STATUS_LABELS}
        onChange={v => updateField('wfh_status', v as WfhStatus | '')}
      />

      <SelectField
        label="country"
        value={form.country}
        options={Object.fromEntries(COUNTRY_OPTIONS.map(c => [c, c]))}
        onChange={v => updateField('country', v)}
      />

      <div className="field" style={{ marginTop: '1rem' }}>
        <label className="label">visa</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.requires_visa}
            onChange={e => updateField('requires_visa', e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          requires visa sponsorship
        </label>
      </div>

      <hr className="term-divider" />

      <div className="field is-grouped">
        <div className="control">
          <button
            className={`button is-primary ${saving ? 'is-loading' : ''}`}
            type="submit"
            disabled={saving}
          >
            {mode === 'profile' ? 'update profile' : 'save profile'}
          </button>
        </div>
        {mode === 'onboarding' && (
          <div className="control">
            <button
              className="button is-ghost"
              type="button"
              onClick={handleSkip}
            >
              skip for now →
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

// ---- Reusable select field ----

interface SelectFieldProps {
  label: string;
  comment?: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}

function SelectField({ label, comment, value, options, onChange }: SelectFieldProps) {
  return (
    <div className="field" style={{ marginBottom: '1rem' }}>
      <label className="label">
        {label}
        {comment && <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', marginLeft: '0.5rem' }}>{comment}</span>}
      </label>
      <div className="control">
        <div className="select is-fullwidth">
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
          >
            <option value="">—</option>
            {Object.entries(options).map(([key, display]) => (
              <option key={key} value={key}>{display}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
