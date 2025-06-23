
-- Create a storage bucket for storing the questionnaire file
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'questionnaires', 
  'questionnaires', 
  false, 
  10485760, 
  ARRAY['application/json']
);

-- Create RLS policies for the questionnaires bucket
-- Only allow service role to access (not regular users)
CREATE POLICY "Service role can manage questionnaires" ON storage.objects
FOR ALL USING (bucket_id = 'questionnaires' AND auth.role() = 'service_role');

-- Create a table to track questionnaire metadata (optional but recommended)
CREATE TABLE public.questionnaire_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT
);

-- Enable RLS on the metadata table
ALTER TABLE public.questionnaire_metadata ENABLE ROW LEVEL SECURITY;

-- Create policy that only allows service role to access questionnaire metadata
CREATE POLICY "Service role can manage questionnaire metadata" 
ON public.questionnaire_metadata 
FOR ALL 
USING (auth.role() = 'service_role');
