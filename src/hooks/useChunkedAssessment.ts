
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ChunkedAssessmentState {
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  currentStep: string;
  error: string | null;
  currentBatch: number;
  totalBatches: number;
  processedQuestions: number;
  totalQuestions: number;
  results: {
    credibilityScore: number;
    totalScore: number;
    maxPossibleScore: number;
    reportId: string;
    sectionsProcessed: number;
  } | null;
}

interface AssessmentData {
  totalScore?: number;
  maxPossibleScore?: number;
  sections?: Array<any>;
}

export const useChunkedAssessment = () => {
  const [assessmentState, setAssessmentState] = useState<ChunkedAssessmentState>({
    status: 'idle',
    progress: 0,
    currentStep: '',
    error: null,
    currentBatch: 0,
    totalBatches: 0,
    processedQuestions: 0,
    totalQuestions: 0,
    results: null
  });

  const { toast } = useToast();

  const startChunkedAssessment = async (documentId: string, userId: string) => {
    try {
      setAssessmentState({
        status: 'processing',
        progress: 10,
        currentStep: 'Starting document assessment...',
        error: null,
        currentBatch: 0,
        totalBatches: 1,
        processedQuestions: 0,
        totalQuestions: 265, // Approximate total questions
        results: null
      });

      // Call the correct Edge Function
      console.log(`Processing assessment for document ${documentId}`);
      
      setAssessmentState(prev => ({
        ...prev,
        currentStep: 'Running AI assessment...',
        progress: 30,
        processedQuestions: 50,
        totalQuestions: 265
      }));

      const { data, error } = await supabase.functions.invoke('assess-document', {
        body: { documentId, userId }
      });

      if (error) {
        console.error('Invoke error:', error);
        throw new Error(error.message || 'Failed to invoke assessment function');
      }

      if (!data?.success) {
        console.error('Assessment failed:', data);
        throw new Error(data?.error || 'Assessment failed');
      }

      console.log('Assessment response:', data);

      // Assessment completed successfully
      const results = {
        credibilityScore: data.credibilityScore,
        totalScore: data.totalScore,
        maxPossibleScore: data.maxPossibleScore,
        reportId: data.reportId,
        sectionsProcessed: data.sectionsProcessed
      };
      
      setAssessmentState(prev => ({
        ...prev,
        status: 'completed',
        progress: 100,
        currentStep: 'Assessment completed successfully!',
        processedQuestions: data.processedQuestions || 265,
        totalQuestions: data.totalQuestions || 265,
        results
      }));

      toast({
        title: 'Assessment Completed',
        description: `Your document scored ${data.credibilityScore}% credibility.`,
      });

    } catch (error: any) {
      console.error('Assessment error:', error);
      setAssessmentState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'Failed to process assessment'
      }));

      toast({
        title: 'Assessment Failed',
        description: error.message || 'Failed to process assessment',
        variant: 'destructive',
      });
    }
  };

  const resetAssessment = () => {
    setAssessmentState({
      status: 'idle',
      progress: 0,
      currentStep: '',
      error: null,
      currentBatch: 0,
      totalBatches: 0,
      processedQuestions: 0,
      totalQuestions: 0,
      results: null
    });
  };

  return {
    assessmentState,
    startChunkedAssessment,
    resetAssessment
  };
};
