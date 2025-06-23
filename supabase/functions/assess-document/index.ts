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

// Enhanced resource limits for better assessment quality
const MAX_PROCESSING_TIME = 12 * 60 * 1000; // Increased to 12 minutes
const MAX_DOCUMENT_LENGTH = 200000; // Increased to 200k characters
const MAX_CHUNKS = 50; // Increased chunk limit

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    console.log('=== Starting enhanced document assessment v2.0 ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId, userId } = await req.json();
    console.log(`Processing assessment for document: ${documentId}, user: ${userId}`);

    if (!documentId || !userId) {
      throw new Error('Document ID and User ID are required');
    }

    if (!mistralApiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is not set');
    }

    // Enhanced timeout checking
    const checkTimeout = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_PROCESSING_TIME) {
        throw new Error(`Processing timeout - assessment taking too long (${Math.round(elapsed/1000)}s)`);
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
        if (lastBreak > truncationPoint * 0.8) { // Don't truncate too early
          bestTruncationPoint = lastBreak;
          break;
        }
      }
      
      processedText = text.substring(0, bestTruncationPoint);
      documentWasTruncated = true;
      console.log(`Smart truncation applied at position ${bestTruncationPoint}`);
    }

    // Get questionnaire with enhanced error handling and debugging
    console.log('Fetching questionnaire...');
    checkTimeout();
    const questionnaireData = await getQuestionnaire(supabaseClient);
    console.log('Questionnaire structure:', JSON.stringify(questionnaireData, null, 2).substring(0, 1000));
    
    // Enhanced document chunking with better overlap strategy
    console.log('Creating document chunks with enhanced strategy...');
    const documentChunks = createDocumentChunks(processedText, 2500, 400); // Larger chunks with better overlap
    
    const chunksToProcess = documentChunks.slice(0, MAX_CHUNKS);
    console.log(`Created ${documentChunks.length} chunks, processing ${chunksToProcess.length}`);
    console.log('Sample chunk preview:', chunksToProcess[0]?.substring(0, 200) + '...');

    checkTimeout();

    // Enhanced assessment processing with better error handling
    console.log('Starting enhanced AI assessment v2.0...');
    const assessmentResults = await processAssessment(
      questionnaireData,
      chunksToProcess,
      mistralApiKey,
      checkTimeout,
      documentWasTruncated
    );
    console.log('Enhanced AI assessment completed successfully');
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
    console.log('Saving enhanced assessment report...');
    const reportData = await saveAssessmentReport(
      supabaseClient,
      userId,
      document,
      assessmentResults,
      assessmentResults.credibilityScore,
      questionnaireData.metadata?.version || '2.0'
    );
    console.log(`Enhanced assessment report saved with ID: ${reportData.id}`);

    // Update document status
    console.log('Updating document status...');
    await updateDocumentStatus(supabaseClient, documentId);
    console.log('Document status updated');

    const processingTime = Date.now() - startTime;
    console.log(`=== Enhanced assessment v2.0 completed successfully in ${processingTime}ms ===`);

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
        version: '2.0'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('Error in enhanced assess-document v2.0:', error);
    console.error('Error stack:', error.stack);
    console.error(`Failed after ${processingTime}ms`);
    
    // Enhanced error categorization and user feedback
    let errorMessage = error.message;
    let errorCode = 'PROCESSING_ERROR';
    
    if (error.message.includes('timeout') || processingTime > MAX_PROCESSING_TIME) {
      errorMessage = 'Document assessment timed out. The document may be too large or complex. Please try with a smaller document or contact support.';
      errorCode = 'TIMEOUT_ERROR';
    } else if (error.message.includes('Rate limit') || error.message.includes('429')) {
      errorMessage = 'AI service is currently experiencing high demand. Please wait a few minutes and try again.';
      errorCode = 'RATE_LIMIT_ERROR';
    } else if (error.message.includes('questionnaire') || error.message.includes('sections')) {
      errorMessage = 'There was an issue with the assessment questionnaire. Please contact support.';
      errorCode = 'QUESTIONNAIRE_ERROR';
    } else if (error.message.includes('MISTRAL_API_KEY')) {
      errorMessage = 'AI service configuration error. Please contact support.';
      errorCode = 'CONFIG_ERROR';
    } else if (error.message.includes('document_text')) {
      errorMessage = 'Document text could not be extracted. Please ensure the document is properly formatted and try uploading again.';
      errorCode = 'DOCUMENT_ERROR';
    } else if (error.message.includes('fetch') || error.message.includes('network')) {
      errorMessage = 'Network error while connecting to AI service. Please check your connection and try again.';
      errorCode = 'NETWORK_ERROR';
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        errorCode,
        processingTime,
        success: false,
        details: error.message,
        version: '2.0'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
