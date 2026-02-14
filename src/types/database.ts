// ============================================
// Database types matching the Supabase schema
// ============================================

export type SalaryBand =
  | 'under_60k'
  | '60_80k'
  | '80_100k'
  | '100_120k'
  | '120_150k'
  | '150_180k'
  | '180_220k'
  | 'over_220k'
  | 'prefer_not_to_say';

export type ExperienceBand =
  | 'student'
  | '0_1_years'
  | '1_3_years'
  | '3_5_years'
  | '5_10_years'
  | '10_15_years'
  | '15_plus_years';

export type EmploymentType =
  | 'full_time_permanent'
  | 'full_time_contract'
  | 'part_time'
  | 'casual'
  | 'contractor_abn'
  | 'freelance'
  | 'unemployed'
  | 'student';

export type WfhStatus =
  | 'full_remote'
  | 'hybrid_mostly_remote'
  | 'hybrid_mostly_office'
  | 'full_office'
  | 'flexible';

export type RoleTitle =
  | 'junior_dev'
  | 'mid_dev'
  | 'senior_dev'
  | 'lead'
  | 'staff_engineer'
  | 'principal'
  | 'em'
  | 'director'
  | 'vp'
  | 'cto'
  | 'devops_sre'
  | 'data_engineer'
  | 'ml_engineer'
  | 'qa'
  | 'security'
  | 'mobile'
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'other';

export type ChatRoom = 'general' | 'memes' | 'whinge';

// ============================================
// Row types
// ============================================

export interface Profile {
  id: string;
  pseudonym: string;
  created_at: string;
  updated_at: string;
  onboarding_complete: boolean;
  salary_band: SalaryBand | null;
  experience_band: ExperienceBand | null;
  employment_type: EmploymentType | null;
  wfh_status: WfhStatus | null;
  role_title: RoleTitle | null;
  country: string | null;
  requires_visa: boolean | null;
}

export interface Message {
  id: string;
  room: ChatRoom;
  profile_id: string;
  content: string;
  created_at: string;
  reply_to_id: string | null;
  // Joined fields
  profiles?: Pick<Profile, 'pseudonym'>;
}

export interface Reaction {
  id: string;
  message_id: string;
  profile_id: string;
  emoji: string;
  created_at: string;
}

export interface BaselineStat {
  id: string;
  source: string;
  year: number;
  role_title: RoleTitle;
  experience_band: ExperienceBand;
  country: string;
  median_salary: number;
  sample_size: number | null;
  created_at: string;
}
