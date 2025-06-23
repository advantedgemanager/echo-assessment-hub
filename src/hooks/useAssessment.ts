
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AssessmentState {
  status: 'idle' | 'processing' | 'assessing' | 'completed' | 'error';
  progress: number;
  currentStep: string;
  error: string | null;
  results: {
    credibilityScore: number;
    totalScore: number;
    maxPossibleScore: number;
    reportId: string;
    sectionsProcessed: number;
  } | null;
}

export const useAssessment = () => {
  const [assessmentState, setAssessmentState] = useState<AssessmentState>({
    status: 'idle',
    progress: 0,
    currentStep: '',
    error: null,
    results: null
  });

  const { toast } = useToast();

  const startAssessment = async (documentId: string, userId: string) => {
    try {
      setAssessmentState({
        status: 'processing',
        progress: 10,
        currentStep: 'Processing document...',
        error: null,
        results: null
      });

      // Step 1: Process document to extract text
      const { data: processData, error: processError } = await supabase.functions.invoke('document-processor', {
        body: { documentId }
      });

      if (processError || !processData?.success) {
        throw new Error(processData?.error || 'Failed to process document');
      }

      setAssessmentState(prev => ({
        ...prev,
        progress: 30,
        currentStep: 'Document processed. Starting AI assessment...'
      }));

      // Step 2: Run AI assessment
      setAssessmentState(prev => ({
        ...prev,
        status: 'assessing',
        progress: 50,
        currentStep: 'Analyzing document with AI...'
      }));

      const { data: assessData, error: assessError } = await supabase.functions.invoke('assess-document', {
        body: { documentId, userId }
      });

      if (assessError || !assessData?.success) {
        throw new Error(assessData?.error || 'Failed to assess document');
      }

      // Assessment completed successfully
      setAssessmentState({
        status: 'completed',
        progress: 100,
        currentStep: 'Assessment completed successfully!',
        error: null,
        results: {
          credibilityScore: assessData.credibilityScore,
          totalScore: assessData.totalScore,
          maxPossibleScore: assessData.maxPossibleScore,
          reportId: assessData.reportId,
          sectionsProcessed: assessData.sectionsProcessed
        }
      });

      toast({
        title: 'Assessment Completed',
        description: `Your document scored ${assessData.credibilityScore}% credibility.`,
      });

    } catch (error: any) {
      console.error('Assessment error:', error);
      setAssessmentState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'An unexpected error occurred'
      }));

      toast({
        title: 'Assessment Failed',
        description: error.message || 'Failed to complete assessment',
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
      results: null
    });
  };

  return {
    assessmentState,
    startAssessment,
    resetAssessment
  };
};
