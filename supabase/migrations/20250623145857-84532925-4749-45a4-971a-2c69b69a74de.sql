
-- Add the missing questionnaire_data column to store the JSON questionnaire data
ALTER TABLE public.questionnaire_metadata 
ADD COLUMN questionnaire_data JSONB;
