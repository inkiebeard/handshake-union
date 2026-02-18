import type { SalaryBand, ExperienceBand, EmploymentType, WfhStatus, RoleTitle, ChatRoom } from '../types/database';

// ============================================
// Human-readable labels for enum values
// ============================================

export const SALARY_BAND_LABELS: Record<SalaryBand, string> = {
  under_60k: '<$60k',
  '60_80k': '$60-80k',
  '80_100k': '$80-100k',
  '100_120k': '$100-120k',
  '120_150k': '$120-150k',
  '150_180k': '$150-180k',
  '180_220k': '$180-220k',
  over_220k: '$220k+',
  prefer_not_to_say: 'Prefer not to say',
};

export const EXPERIENCE_BAND_LABELS: Record<ExperienceBand, string> = {
  student: 'Student',
  '0_1_years': '0-1 years',
  '1_3_years': '1-3 years',
  '3_5_years': '3-5 years',
  '5_10_years': '5-10 years',
  '10_15_years': '10-15 years',
  '15_plus_years': '15+ years',
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time_permanent: 'Full-time permanent',
  full_time_contract: 'Full-time contract',
  part_time: 'Part-time',
  casual: 'Casual',
  contractor_abn: 'Contractor (ABN)',
  freelance: 'Freelance',
  unemployed: 'Unemployed',
  student: 'Student',
};

export const WFH_STATUS_LABELS: Record<WfhStatus, string> = {
  full_remote: 'Full remote',
  hybrid_mostly_remote: 'Hybrid (mostly remote)',
  hybrid_mostly_office: 'Hybrid (mostly office)',
  full_office: 'Full office',
  flexible: 'Flexible',
};

export const ROLE_TITLE_LABELS: Record<RoleTitle, string> = {
  junior_dev: 'Junior Dev',
  mid_dev: 'Mid Dev',
  senior_dev: 'Senior Dev',
  lead: 'Lead',
  staff_engineer: 'Staff Engineer',
  principal: 'Principal',
  em: 'Engineering Manager',
  director: 'Director',
  vp: 'VP',
  cto: 'CTO',
  devops_sre: 'DevOps/SRE',
  data_engineer: 'Data Engineer',
  ml_engineer: 'ML Engineer',
  qa: 'QA',
  security: 'Security',
  mobile: 'Mobile',
  frontend: 'Frontend',
  backend: 'Backend',
  fullstack: 'Fullstack',
  other: 'Other',
};

export const COUNTRY_OPTIONS = ['Australia', 'New Zealand', 'Other'] as const;

export const CHAT_ROOMS: { id: ChatRoom; label: string; description: string }[] = [
  { id: 'general', label: '#general', description: 'Main discussion' },
  { id: 'memes', label: '#memes', description: 'Shitposting & levity' },
  { id: 'whinge', label: '#whinge', description: 'Venting about work' },
];

// ============================================
// Approved reactions
// ============================================
// Curated set of reactions allowed in chat.
// Extend this list to add new approved reactions.
// Custom text shortcodes map to display values.

export const APPROVED_REACTIONS: { code: string; display: string; label: string }[] = [
  // Standard
  { code: '👍', display: '👍', label: 'Thumbs up' },
  { code: '👎', display: '👎', label: 'Thumbs down' },
  { code: '😂', display: '😂', label: 'Laughing' },
  { code: '🔥', display: '🔥', label: 'Fire' },
  { code: '👀', display: '👀', label: 'Eyes' },
  { code: '💯', display: '💯', label: 'Hundred' },
  { code: '🤝', display: '🤝', label: 'Handshake' },
  { code: '😤', display: '😤', label: 'Frustrated' },
  // Dev culture
  { code: '🐛', display: '🐛', label: 'Bug' },
  { code: '🚀', display: '🚀', label: 'Ship it' },
  { code: '💀', display: '💀', label: 'Dead' },
  { code: '🫡', display: '🫡', label: 'Salute' },
  { code: '☕', display: '☕', label: 'Coffee' },
  // Solidarity
  { code: ':solidarity:', display: '✊', label: 'Solidarity' },
  { code: ':union:', display: '🤝', label: 'Union strong' },
  { code: ':fair-go:', display: '⚖️', label: 'Fair go' },
];
