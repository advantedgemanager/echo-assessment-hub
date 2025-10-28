-- Fix function search path for the newly created function
ALTER FUNCTION public.update_assessment_batches_updated_at() SET search_path = public;