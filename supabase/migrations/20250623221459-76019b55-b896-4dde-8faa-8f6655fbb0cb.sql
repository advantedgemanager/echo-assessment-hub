
-- Delete all assessment reports first (to avoid any potential foreign key constraints)
DELETE FROM public.assessment_reports;

-- Delete all questionnaire metadata
DELETE FROM public.questionnaire_metadata;

-- Reset the sequences (optional, to start fresh with IDs)
-- This ensures that new uploads will start with clean IDs
ALTER SEQUENCE IF EXISTS assessment_reports_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS questionnaire_metadata_id_seq RESTART WITH 1;
