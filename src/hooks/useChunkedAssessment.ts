
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
      console.log(`Processing batch ${batchNumber} for document ${documentId}`);
      
      setAssessmentState(prev => ({
        ...prev,
        currentStep: 'Running AI assessment...',
        progress: 30
      }));

      const { data, error } = await supabase.functions.invoke('assess-document-chunked', {
        body: { documentId, userId, batchIndex: batchNumber }
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

      // Update progress based on completion
      const progressPercentage = data.isComplete ? 100 : Math.min(90, 30 + (data.batchIndex * 20));

      setAssessmentState(prev => ({
        ...prev,
        progress: progressPercentage,
        currentStep: data.isComplete ? 'Assessment completed!' : `Processing batch ${data.batchIndex + 1}...`,
        currentBatch: data.batchIndex,
        totalBatches: 1,
        processedQuestions: data.processedQuestions || 1,
        totalQuestions: data.totalQuestions || 1
      }));

      if (data.isComplete) {
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
          results
        }));

        toast({
          title: 'Assessment Completed',
          description: `Your document scored ${data.credibilityScore}% credibility.`,
        });
      } else if (data.nextBatchNumber !== null && data.nextBatchNumber !== undefined) {
        // Process next batch after a short delay
        setTimeout(() => {
          processBatch(documentId, userId, data.nextBatchNumber);
        }, 1000);
      } else {
        // No more batches but not marked as complete - this shouldn't happen
        console.warn('Assessment not marked complete but no next batch');
        throw new Error('Assessment completed but status is unclear');
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
