
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
    try {
      // Get the actual number of questions from the active questionnaire
      const totalQuestions = await getQuestionnaireInfo();
      
      // Calculate batch configuration
      const BATCH_SIZE = 20;
      const totalBatches = Math.ceil(totalQuestions / BATCH_SIZE);

      setAssessmentState({
        status: 'processing',
        progress: 5,
        currentStep: `Starting batched assessment (${totalBatches} batches)...`,
        error: null,
        currentBatch: 0,
        totalBatches: totalBatches,
        processedQuestions: 0,
        totalQuestions: totalQuestions,
        results: null
      });

      console.log(`Starting batched assessment: ${totalQuestions} questions in ${totalBatches} batches of ${BATCH_SIZE}`);
      
      // Collect all batch results
      const allBatchResults: any[] = [];
      let totalScore = 0;
      let maxPossibleScore = 0;
      
      // Process each batch sequentially
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchNumber = batchIndex + 1;
        const questionsInBatch = Math.min(BATCH_SIZE, totalQuestions - (batchIndex * BATCH_SIZE));
        
        console.log(`Processing batch ${batchNumber}/${totalBatches} (questions ${batchIndex * BATCH_SIZE + 1}-${batchIndex * BATCH_SIZE + questionsInBatch})`);
        
        setAssessmentState(prev => ({
          ...prev,
          currentStep: `Processing batch ${batchNumber} of ${totalBatches} (${questionsInBatch} questions)...`,
          currentBatch: batchNumber,
          progress: Math.floor((batchIndex / totalBatches) * 90) + 5
        }));

        const { data, error } = await supabase.functions.invoke('assess-document', {
          body: { 
            documentId, 
            userId,
            batchIndex,
            batchSize: BATCH_SIZE
          }
        });

        if (error) {
          console.error(`Batch ${batchNumber} invoke error:`, error);
          throw new Error(error.message || `Failed to process batch ${batchNumber}`);
        }

        if (!data?.success) {
          console.error(`Batch ${batchNumber} failed:`, data);
          throw new Error(data?.error || `Batch ${batchNumber} failed`);
        }

        console.log(`Batch ${batchNumber} completed:`, {
          questionsInBatch: data.questionsInBatch,
          resultsCount: data.batchResults?.length || 0
        });

        // Accumulate results from this batch
        if (data.batchResults) {
          allBatchResults.push(...data.batchResults);
          
          // Calculate scores
          data.batchResults.forEach((result: any) => {
            totalScore += result.score || 0;
            maxPossibleScore += result.weight || 1;
          });
        }

        // Update progress
        const processedSoFar = (batchIndex + 1) * BATCH_SIZE;
        const actualProcessed = Math.min(processedSoFar, totalQuestions);
        
        setAssessmentState(prev => ({
          ...prev,
          processedQuestions: actualProcessed,
          currentStep: `Batch ${batchNumber}/${totalBatches} completed (${actualProcessed}/${totalQuestions} questions processed)`
        }));

        // Small delay between batches to avoid rate limiting
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log('All batches completed, aggregating results...');
      
      // Calculate final credibility score
      const credibilityScore = maxPossibleScore > 0 
        ? Math.round((totalScore / maxPossibleScore) * 100) 
        : 0;

      // Group results by section for final report
      const sectionMap = new Map();
      allBatchResults.forEach(result => {
        if (!sectionMap.has(result.sectionId)) {
          sectionMap.set(result.sectionId, {
            sectionId: result.sectionId,
            sectionTitle: result.sectionTitle,
            questions: []
          });
        }
        sectionMap.get(result.sectionId).questions.push(result);
      });

      const sections = Array.from(sectionMap.values());

      // Save aggregated report to database
      setAssessmentState(prev => ({
        ...prev,
        currentStep: 'Saving assessment report...',
        progress: 95
      }));

      const { data: reportData, error: reportError } = await supabase
        .from('assessment_reports')
        .insert({
          user_id: userId,
          credibility_score: credibilityScore,
          assessment_data: {
            sections,
            totalScore,
            maxPossibleScore,
            credibilityScore,
            processedQuestions: totalQuestions,
            totalQuestions,
            overallResult: credibilityScore >= 80 ? 'Well-aligned' : 
                          credibilityScore >= 50 ? 'Partially aligned' : 'Misaligned',
            version: '6.0-batched'
          },
          company_name: 'Document Assessment',
          report_type: 'comprehensive-questionnaire'
        })
        .select()
        .single();

      if (reportError) {
        console.error('Error saving report:', reportError);
        throw new Error('Failed to save assessment report');
      }

      // Update document status
      await supabase
        .from('uploaded_documents')
        .update({ assessment_status: 'completed' })
        .eq('id', documentId);

      const results = {
        credibilityScore,
        totalScore,
        maxPossibleScore,
        reportId: reportData.id,
        sectionsProcessed: sections.length
      };
      
      setAssessmentState(prev => ({
        ...prev,
        status: 'completed',
        progress: 100,
        currentStep: 'Assessment completed successfully!',
        processedQuestions: totalQuestions,
        totalQuestions: totalQuestions,
        currentBatch: totalBatches,
        results
      }));

      toast({
        title: 'Assessment Completed',
        description: `Your document scored ${credibilityScore}% credibility (${totalQuestions} questions assessed).`,
      });

    } catch (error: any) {
      console.error('Batched assessment error:', error);
      
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
