
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

interface QuestionnaireData {
  sections?: Array<{
    questions?: Array<any>;
  }>;
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

  const getQuestionnaireInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('questionnaire_metadata')
        .select('questionnaire_data')
        .eq('is_active', true)
        .single();

      if (error || !data) {
        console.warn('No active questionnaire found, using default count');
        return 95; // fallback default
      }

      const questionnaireData = data.questionnaire_data as QuestionnaireData;
      let totalQuestions = 0;

      if (questionnaireData?.sections && Array.isArray(questionnaireData.sections)) {
        questionnaireData.sections.forEach((section: any) => {
          if (section.questions && Array.isArray(section.questions)) {
            totalQuestions += section.questions.length;
          }
        });
      }

      console.log(`Found questionnaire with ${totalQuestions} questions`);
      return totalQuestions || 95; // fallback to 95 if count is 0
    } catch (error) {
      console.error('Error fetching questionnaire info:', error);
      return 95; // fallback default
    }
  };

  const startChunkedAssessment = async (documentId: string, userId: string) => {
    let timeoutId: NodeJS.Timeout;
    
    try {
      // Get the actual number of questions from the active questionnaire
      const totalQuestions = await getQuestionnaireInfo();

      setAssessmentState({
        status: 'processing',
        progress: 10,
        currentStep: 'Starting document assessment...',
        error: null,
        currentBatch: 0,
        totalBatches: 1,
        processedQuestions: 0,
        totalQuestions: totalQuestions,
        results: null
      });

      console.log(`Processing assessment for document ${documentId} with ${totalQuestions} questions`);
      
      setAssessmentState(prev => ({
        ...prev,
        currentStep: 'Running AI assessment...',
        progress: 30,
        processedQuestions: Math.floor(totalQuestions * 0.2),
        totalQuestions: totalQuestions
      }));

      // Set up a timeout warning after 3 minutes
      timeoutId = setTimeout(() => {
        setAssessmentState(prev => ({
          ...prev,
          currentStep: 'Assessment is taking longer than expected... Please wait',
          progress: 60
        }));
      }, 3 * 60 * 1000); // 3 minutes

      const { data, error } = await supabase.functions.invoke('assess-document', {
        body: { documentId, userId }
      });

      // Clear timeout on success
      clearTimeout(timeoutId);

      if (error) {
        console.error('Invoke error:', error);
        
        // Handle specific error types
        if (error.message?.includes('Failed to fetch')) {
          throw new Error('Network connection lost during assessment. Please check your internet connection and try again.');
        } else {
          throw new Error(error.message || 'Failed to invoke assessment function');
        }
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
        processedQuestions: data.processedQuestions || totalQuestions,
        totalQuestions: data.totalQuestions || totalQuestions,
        results
      }));

      toast({
        title: 'Assessment Completed',
        description: `Your document scored ${data.credibilityScore}% credibility.`,
      });

    } catch (error: any) {
      // Clear timeout on error
      if (timeoutId) clearTimeout(timeoutId);
      
      console.error('Assessment error:', error);
      
      let errorMessage = error.message || 'Failed to process assessment';
      
      // Provide more specific error messages
      if (errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Network connection error. Please check your internet connection and try again.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Assessment timed out. The document may be too large or the server is experiencing high load. Please try again later.';
      }
      
      setAssessmentState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage
      }));

      toast({
        title: 'Assessment Failed',
        description: errorMessage,
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
