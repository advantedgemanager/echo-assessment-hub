
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
        progress: 5,
        currentStep: 'Initializing assessment...',
        error: null,
        currentBatch: 0,
        totalBatches: 0,
        processedQuestions: 0,
        totalQuestions: 0,
        results: null
      });

      // Start with batch 0
      await processBatch(documentId, userId, 0);

    } catch (error: any) {
      console.error('Assessment error:', error);
      setAssessmentState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'An unexpected error occurred'
      }));

      toast({
        title: 'Assessment Failed',
        description: error.message || 'Failed to start assessment',
        variant: 'destructive',
      });
    }
  };

  const processBatch = async (documentId: string, userId: string, batchNumber: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('assess-document-chunked', {
        body: { documentId, userId, batchNumber }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to process batch');
      }

      const progressPercentage = Math.round((data.processedQuestions / data.totalQuestions) * 100);

      setAssessmentState(prev => ({
        ...prev,
        progress: progressPercentage,
        currentStep: `Processing questions ${data.processedQuestions}/${data.totalQuestions} (Batch ${data.batchNumber}/${data.totalBatches})`,
        currentBatch: data.batchNumber,
        totalBatches: data.totalBatches,
        processedQuestions: data.processedQuestions,
        totalQuestions: data.totalQuestions
      }));

      if (data.isComplete) {
        // Get final results
        const finalResults = await getFinalResults(documentId, userId);
        
        setAssessmentState(prev => ({
          ...prev,
          status: 'completed',
          progress: 100,
          currentStep: 'Assessment completed successfully!',
          results: finalResults
        }));

        toast({
          title: 'Assessment Completed',
          description: `Your document scored ${finalResults.credibilityScore}% credibility.`,
        });
      } else if (data.nextBatchNumber !== null) {
        // Process next batch after a short delay
        setTimeout(() => {
          processBatch(documentId, userId, data.nextBatchNumber);
        }, 1000);
      }

    } catch (error: any) {
      console.error('Batch processing error:', error);
      setAssessmentState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'Failed to process assessment batch'
      }));

      toast({
        title: 'Assessment Failed',
        description: error.message || 'Failed to process assessment',
        variant: 'destructive',
      });
    }
  };

  const getFinalResults = async (documentId: string, userId: string) => {
    try {
      // Get the assessment progress to find the report ID
      const { data: progress, error: progressError } = await supabase
        .from('assessment_progress')
        .select('report_id')
        .eq('document_id', documentId)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .maybeSingle();

      if (progressError) {
        console.error('Error fetching progress:', progressError);
        throw new Error('Failed to fetch assessment progress');
      }

      if (progress?.report_id) {
        const { data: report, error: reportError } = await supabase
          .from('assessment_reports')
          .select('*')
          .eq('id', progress.report_id)
          .maybeSingle();

        if (reportError) {
          console.error('Error fetching report:', reportError);
          throw new Error('Failed to fetch assessment report');
        }

        if (report) {
          // Safely parse the assessment_data JSON
          const assessmentData = report.assessment_data as AssessmentData;
          
          return {
            credibilityScore: report.credibility_score,
            totalScore: assessmentData?.totalScore || 0,
            maxPossibleScore: assessmentData?.maxPossibleScore || 100,
            reportId: report.id,
            sectionsProcessed: assessmentData?.sections?.length || 0
          };
        }
      }

      // Fallback if no report found
      return {
        credibilityScore: 0,
        totalScore: 0,
        maxPossibleScore: 100,
        reportId: '',
        sectionsProcessed: 0
      };
    } catch (error: any) {
      console.error('Error getting final results:', error);
      // Return fallback values instead of throwing
      return {
        credibilityScore: 0,
        totalScore: 0,
        maxPossibleScore: 100,
        reportId: '',
        sectionsProcessed: 0
      };
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
