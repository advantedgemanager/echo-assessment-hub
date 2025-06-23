
-- Create assessment_progress table to track chunked assessment progress
CREATE TABLE public.assessment_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.uploaded_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  current_batch INTEGER NOT NULL DEFAULT 0,
  total_batches INTEGER NOT NULL DEFAULT 0,
  processed_questions INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  batch_results JSONB DEFAULT '[]'::jsonb,
  sections_data JSONB DEFAULT '[]'::jsonb,
  report_id UUID REFERENCES public.assessment_reports(id),
  final_score INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Add RLS policies for assessment_progress
ALTER TABLE public.assessment_progress ENABLE ROW LEVEL SECURITY;

-- Users can view their own assessment progress
CREATE POLICY "Users can view their own assessment progress" 
  ON public.assessment_progress 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can create their own assessment progress
CREATE POLICY "Users can create their own assessment progress" 
  ON public.assessment_progress 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own assessment progress
CREATE POLICY "Users can update their own assessment progress" 
  ON public.assessment_progress 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Users can delete their own assessment progress
CREATE POLICY "Users can delete their own assessment progress" 
  ON public.assessment_progress 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_assessment_progress_document_user ON public.assessment_progress(document_id, user_id);
CREATE INDEX idx_assessment_progress_status ON public.assessment_progress(status);
