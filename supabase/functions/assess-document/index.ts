
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createDocumentChunks } from './document-processor.ts';
import { processAssessment } from './assessment-processor.ts';
import { 
  getDocument, 
  getQuestionnaire, 
  saveAssessmentReport, 
  updateDocumentStatus 
} from './database-operations.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const mistralApiKey = Deno.env.get('MISTRAL_API_KEY');

// Enhanced resource limits for comprehensive 265-question assessment
const MAX_PROCESSING_TIME = 20 * 60 * 1000; // Increased to 20 minutes for 265 questions
const MAX_DOCUMENT_LENGTH = 300000; // Increased to 300k characters
const MAX_CHUNKS = 75; // Increased chunk limit for better coverage

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    console.log('=== Starting comprehensive 265-question assessment v3.0 ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId, userId } = await req.json();
    console.log(`Processing comprehensive assessment for document: ${documentId}, user: ${userId}`);

    if (!documentId || !userId) {
      throw new Error('Document ID and User ID are required');
    }

    if (!mistralApiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is not set');
    }

    // Enhanced timeout checking for longer processing
    const checkTimeout = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_PROCESSING_TIME) {
        throw new Error(`Processing timeout - comprehensive assessment taking too long (${Math.round(elapsed/1000)}s)`);
      }
    };

    // Get document with enhanced validation
    console.log('Fetching document...');
    checkTimeout();
    const document = await getDocument(supabaseClient, documentId, userId);
    console.log(`Document fetched: ${document.file_name}, text length: ${document.document_text?.length || 0}`);

    if (!document.document_text) {
      throw new Error('Document text not available. Please process the document first.');
    }

    // Enhanced document handling with better truncation strategy
    let documentWasTruncated = false;
    let processedText = document.document_text;
    
    if (document.document_text.length > MAX_DOCUMENT_LENGTH) {
      console.warn(`Document size: ${document.document_text.length} chars, truncating to ${MAX_DOCUMENT_LENGTH}`);
      
      // Smart truncation - try to keep complete sections
      const text = document.document_text;
      const truncationPoint = MAX_DOCUMENT_LENGTH;
      
      // Look for section breaks near the truncation point
      const sectionBreaks = ['\n\n', '\n#', '\nSection', '\nChapter'];
      let bestTruncationPoint = truncationPoint;
      
      for (const breakPattern of sectionBreaks) {
        const lastBreak = text.lastIndexOf(breakPattern, truncationPoint);
        if (lastBreak > truncationPoint * 0.8) {
          bestTruncationPoint = lastBreak;
          break;
        }
      }
      
      processedText = text.substring(0, bestTruncationPoint);
      documentWasTruncated = true;
      console.log(`Smart truncation applied at position ${bestTruncationPoint}`);
    }

    // Get questionnaire with enhanced error handling and debugging
    console.log('Fetching comprehensive questionnaire (up to 265 questions)...');
    checkTimeout();
    const questionnaireData = await getQuestionnaire(supabaseClient);
    console.log('Questionnaire structure:', JSON.stringify(questionnaireData, null, 2).substring(0, 1000));
    
    // Count total questions for logging
    let totalQuestions = 0;
    if (questionnaireData?.questionnaire?.sections) {
      questionnaireData.questionnaire.sections.forEach(section => {
        if (section.questions && Array.isArray(section.questions)) {
          totalQuestions += section.questions.length;
        }
      });
    }
    console.log(`Questionnaire loaded with ${totalQuestions} total questions`);
    
    // Enhanced document chunking with better overlap strategy for comprehensive assessment
    console.log('Creating document chunks with enhanced strategy for comprehensive assessment...');
    const documentChunks = createDocumentChunks(processedText, 3000, 500); // Larger chunks for better context
    
    const chunksToProcess = documentChunks.slice(0, MAX_CHUNKS);
    console.log(`Created ${documentChunks.length} chunks, processing ${chunksToProcess.length}`);
    console.log('Sample chunk preview:', chunksToProcess[0]?.substring(0, 200) + '...');

    checkTimeout();

    // Enhanced comprehensive assessment processing
    console.log(`Starting comprehensive AI assessment v3.0 for ${totalQuestions} questions...`);
    const assessmentResults = await processAssessment(
      questionnaireData,
      chunksToProcess,
      mistralApiKey,
      checkTimeout,
      documentWasTruncated
    );
    console.log('Comprehensive AI assessment completed successfully');
    console.log('Assessment summary:', {
      overallResult: assessmentResults.overallResult,
      credibilityScore: assessmentResults.credibilityScore,
      sectionsProcessed: assessmentResults.sections.length,
      questionsProcessed: assessmentResults.processedQuestions,
      totalQuestions: assessmentResults.totalQuestions,
      completeness: assessmentResults.assessmentCompleteness
    });

    checkTimeout();

    // Enhanced assessment report storage
    console.log('Saving comprehensive assessment report...');
    const reportData = await saveAssessmentReport(
      supabaseClient,
      userId,
      document,
      assessmentResults,
      assessmentResults.credibilityScore,
      questionnaireData.metadata?.version || '3.0'
    );
    console.log(`Comprehensive assessment report saved with ID: ${reportData.id}`);

    // Update document status
    console.log('Updating document status...');
    await updateDocumentStatus(supabaseClient, documentId);
    console.log('Document status updated');

    const processingTime = Date.now() - startTime;
    console.log(`=== Comprehensive 265-question assessment v3.0 completed successfully in ${processingTime}ms ===`);

    // Enhanced response with comprehensive metadata
    return new Response(
      JSON.stringify({
        success: true,
        credibilityScore: assessmentResults.credibilityScore,
        totalScore: assessmentResults.totalScore,
        maxPossibleScore: assessmentResults.maxPossibleScore,
        reportId: reportData.id,
        sectionsProcessed: assessmentResults.sections.length,
        processingTime,
        chunksProcessed: chunksToProcess.length,
        wasTruncated: documentWasTruncated,
        assessmentCompleteness: assessmentResults.assessmentCompleteness,
        processedQuestions: assessmentResults.processedQuestions,
        totalQuestions: assessmentResults.totalQuestions,
        overallResult: assessmentResults.overallResult,
        redFlagTriggered: assessmentResults.redFlagTriggered,
        reasoning: assessmentResults.reasoning,
        version: '3.0'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('Error in comprehensive assess-document v3.0:', error);
    console.error('Error stack:', error.stack);
    console.error(`Failed after ${processingTime}ms`);
    
    // Enhanced error categorization and user feedback for comprehensive assessments
    let errorMessage = error.message;
    let errorCode = 'PROCESSING_ERROR';
    
    if (error.message.includes('timeout') || processingTime > MAX_PROCESSING_TIME) {
      errorMessage = 'Comprehensive assessment timed out. The 265-question assessment may require more time. Please try again or contact support.';
      errorCode = 'TIMEOUT_ERROR';
    } else if (error.message.includes('Rate limit') || error.message.includes('429')) {
      errorMessage = 'AI service is experiencing high demand during comprehensive assessment. Please wait a few minutes and try again.';
      errorCode = 'RATE_LIMIT_ERROR';
    } else if (error.message.includes('questionnaire') || error.message.includes('sections')) {
      errorMessage = 'There was an issue with the comprehensive questionnaire. Please ensure the 265-question questionnaire is properly uploaded.';
      errorCode = 'QUESTIONNAIRE_ERROR';
    } else if (error.message.includes('MISTRAL_API_KEY')) {
      errorMessage = 'AI service configuration error. Please contact support.';
      errorCode = 'CONFIG_ERROR';
    } else if (error.message.includes('document_text')) {
      errorMessage = 'Document text could not be extracted. Please ensure the document is properly formatted and try uploading again.';
      errorCode = 'DOCUMENT_ERROR';
    } else if (error.message.includes('fetch') || error.message.includes('network')) {
      errorMessage = 'Network error while connecting to AI service during comprehensive assessment. Please check your connection and try again.';
      errorCode = 'NETWORK_ERROR';
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        errorCode,
        processingTime,
        success: false,
        details: error.message,
        version: '3.0'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
