-- ============================================
-- Seed baseline_stats with Australian developer salary data
-- ============================================
-- Sources: Aggregated from public salary surveys (Hays, Seek, Stack Overflow)
-- These are approximate medians for comparison purposes.
-- All figures in AUD.

-- Clear existing baseline data (if any)
DELETE FROM public.baseline_stats;

-- ============================================
-- 2025 Australian Developer Salary Baselines
-- ============================================

-- Junior roles (0-1 years)
INSERT INTO public.baseline_stats (source, year, role_title, experience_band, country, median_salary, sample_size)
VALUES
  ('Industry Average', 2025, 'junior_dev', '0_1_years', 'Australia', 65000, NULL),
  ('Industry Average', 2025, 'frontend', '0_1_years', 'Australia', 62000, NULL),
  ('Industry Average', 2025, 'backend', '0_1_years', 'Australia', 65000, NULL),
  ('Industry Average', 2025, 'fullstack', '0_1_years', 'Australia', 63000, NULL),
  ('Industry Average', 2025, 'qa', '0_1_years', 'Australia', 58000, NULL),
  ('Industry Average', 2025, 'devops_sre', '0_1_years', 'Australia', 70000, NULL),
  ('Industry Average', 2025, 'data_engineer', '0_1_years', 'Australia', 68000, NULL);

-- Early career (1-3 years)
INSERT INTO public.baseline_stats (source, year, role_title, experience_band, country, median_salary, sample_size)
VALUES
  ('Industry Average', 2025, 'junior_dev', '1_3_years', 'Australia', 75000, NULL),
  ('Industry Average', 2025, 'mid_dev', '1_3_years', 'Australia', 85000, NULL),
  ('Industry Average', 2025, 'frontend', '1_3_years', 'Australia', 80000, NULL),
  ('Industry Average', 2025, 'backend', '1_3_years', 'Australia', 85000, NULL),
  ('Industry Average', 2025, 'fullstack', '1_3_years', 'Australia', 82000, NULL),
  ('Industry Average', 2025, 'qa', '1_3_years', 'Australia', 72000, NULL),
  ('Industry Average', 2025, 'devops_sre', '1_3_years', 'Australia', 90000, NULL),
  ('Industry Average', 2025, 'data_engineer', '1_3_years', 'Australia', 88000, NULL),
  ('Industry Average', 2025, 'mobile', '1_3_years', 'Australia', 82000, NULL);

-- Mid-level (3-5 years)
INSERT INTO public.baseline_stats (source, year, role_title, experience_band, country, median_salary, sample_size)
VALUES
  ('Industry Average', 2025, 'mid_dev', '3_5_years', 'Australia', 105000, NULL),
  ('Industry Average', 2025, 'senior_dev', '3_5_years', 'Australia', 115000, NULL),
  ('Industry Average', 2025, 'frontend', '3_5_years', 'Australia', 100000, NULL),
  ('Industry Average', 2025, 'backend', '3_5_years', 'Australia', 110000, NULL),
  ('Industry Average', 2025, 'fullstack', '3_5_years', 'Australia', 105000, NULL),
  ('Industry Average', 2025, 'qa', '3_5_years', 'Australia', 90000, NULL),
  ('Industry Average', 2025, 'devops_sre', '3_5_years', 'Australia', 120000, NULL),
  ('Industry Average', 2025, 'data_engineer', '3_5_years', 'Australia', 115000, NULL),
  ('Industry Average', 2025, 'mobile', '3_5_years', 'Australia', 105000, NULL),
  ('Industry Average', 2025, 'security', '3_5_years', 'Australia', 125000, NULL),
  ('Industry Average', 2025, 'ml_engineer', '3_5_years', 'Australia', 130000, NULL);

-- Senior (5-10 years)
INSERT INTO public.baseline_stats (source, year, role_title, experience_band, country, median_salary, sample_size)
VALUES
  ('Industry Average', 2025, 'senior_dev', '5_10_years', 'Australia', 140000, NULL),
  ('Industry Average', 2025, 'lead', '5_10_years', 'Australia', 155000, NULL),
  ('Industry Average', 2025, 'staff_engineer', '5_10_years', 'Australia', 170000, NULL),
  ('Industry Average', 2025, 'frontend', '5_10_years', 'Australia', 130000, NULL),
  ('Industry Average', 2025, 'backend', '5_10_years', 'Australia', 145000, NULL),
  ('Industry Average', 2025, 'fullstack', '5_10_years', 'Australia', 140000, NULL),
  ('Industry Average', 2025, 'devops_sre', '5_10_years', 'Australia', 155000, NULL),
  ('Industry Average', 2025, 'data_engineer', '5_10_years', 'Australia', 150000, NULL),
  ('Industry Average', 2025, 'security', '5_10_years', 'Australia', 160000, NULL),
  ('Industry Average', 2025, 'ml_engineer', '5_10_years', 'Australia', 165000, NULL),
  ('Industry Average', 2025, 'em', '5_10_years', 'Australia', 165000, NULL);

-- Very senior (10-15 years)
INSERT INTO public.baseline_stats (source, year, role_title, experience_band, country, median_salary, sample_size)
VALUES
  ('Industry Average', 2025, 'senior_dev', '10_15_years', 'Australia', 160000, NULL),
  ('Industry Average', 2025, 'lead', '10_15_years', 'Australia', 175000, NULL),
  ('Industry Average', 2025, 'staff_engineer', '10_15_years', 'Australia', 190000, NULL),
  ('Industry Average', 2025, 'principal', '10_15_years', 'Australia', 210000, NULL),
  ('Industry Average', 2025, 'em', '10_15_years', 'Australia', 185000, NULL),
  ('Industry Average', 2025, 'director', '10_15_years', 'Australia', 200000, NULL),
  ('Industry Average', 2025, 'devops_sre', '10_15_years', 'Australia', 175000, NULL),
  ('Industry Average', 2025, 'security', '10_15_years', 'Australia', 185000, NULL),
  ('Industry Average', 2025, 'ml_engineer', '10_15_years', 'Australia', 190000, NULL);

-- Expert (15+ years)
INSERT INTO public.baseline_stats (source, year, role_title, experience_band, country, median_salary, sample_size)
VALUES
  ('Industry Average', 2025, 'staff_engineer', '15_plus_years', 'Australia', 210000, NULL),
  ('Industry Average', 2025, 'principal', '15_plus_years', 'Australia', 240000, NULL),
  ('Industry Average', 2025, 'em', '15_plus_years', 'Australia', 200000, NULL),
  ('Industry Average', 2025, 'director', '15_plus_years', 'Australia', 230000, NULL),
  ('Industry Average', 2025, 'vp', '15_plus_years', 'Australia', 280000, NULL),
  ('Industry Average', 2025, 'cto', '15_plus_years', 'Australia', 300000, NULL);

-- ============================================
-- New Zealand baselines (generally 10-15% lower)
-- ============================================

INSERT INTO public.baseline_stats (source, year, role_title, experience_band, country, median_salary, sample_size)
VALUES
  ('Industry Average', 2025, 'mid_dev', '3_5_years', 'New Zealand', 90000, NULL),
  ('Industry Average', 2025, 'senior_dev', '5_10_years', 'New Zealand', 120000, NULL),
  ('Industry Average', 2025, 'lead', '5_10_years', 'New Zealand', 135000, NULL),
  ('Industry Average', 2025, 'staff_engineer', '10_15_years', 'New Zealand', 165000, NULL),
  ('Industry Average', 2025, 'em', '10_15_years', 'New Zealand', 160000, NULL);
