-- Create table for tracking assessment batches
CREATE TABLE IF NOT EXISTS public.assessment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.uploaded_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  batch_index INTEGER NOT NULL,
  total_batches INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  questions_processed INTEGER NOT NULL DEFAULT 0,
  batch_results JSONB DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  UNIQUE(document_id, batch_index)
);

-- Enable RLS on assessment_batches
ALTER TABLE public.assessment_batches ENABLE ROW LEVEL SECURITY;

-- RLS policies for assessment_batches
CREATE POLICY "Users can view their own assessment batches"
  ON public.assessment_batches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assessment batches"
  ON public.assessment_batches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assessment batches"
  ON public.assessment_batches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assessment batches"
  ON public.assessment_batches FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_assessment_batches_document_id ON public.assessment_batches(document_id);
CREATE INDEX IF NOT EXISTS idx_assessment_batches_user_id ON public.assessment_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_batches_status ON public.assessment_batches(status);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_assessment_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_assessment_batches_updated_at
  BEFORE UPDATE ON public.assessment_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_assessment_batches_updated_at();