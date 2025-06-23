
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

// Resource limits
const MAX_PROCESSING_TIME = 4 * 60 * 1000; // 4 minutes
const MAX_DOCUMENT_LENGTH = 100000; // 100k characters max for assessment
const MAX_CHUNKS = 20; // Limit number of chunks to process

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    console.log('=== Starting document assessment ===');
    
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

    // Check elapsed time periodically
    const checkTimeout = () => {
      if (Date.now() - startTime > MAX_PROCESSING_TIME) {
        throw new Error('Processing timeout - document too large or complex');
      }
    };

    // Get document with text
    console.log('Fetching document...');
    checkTimeout();
    const document = await getDocument(supabaseClient, documentId, userId);
    console.log(`Document fetched: ${document.file_name}, text length: ${document.document_text?.length || 0}`);

    // Validate document size
    if (!document.document_text) {
      throw new Error('Document text not available. Please process the document first.');
    }

    if (document.document_text.length > MAX_DOCUMENT_LENGTH) {
      console.warn(`Document too large for assessment: ${document.document_text.length} chars, truncating to ${MAX_DOCUMENT_LENGTH}`);
      document.document_text = document.document_text.substring(0, MAX_DOCUMENT_LENGTH);
    }

    // Get questionnaire
    console.log('Fetching questionnaire...');
    checkTimeout();
    const questionnaireData = await getQuestionnaire(supabaseClient);
    console.log('Questionnaire fetched successfully');
    
    // Split document into manageable chunks
    console.log('Creating document chunks...');
    const documentChunks = createDocumentChunks(document.document_text, 1500, 150); // Smaller chunks
    
    // Limit number of chunks to process
    const chunksToProcess = documentChunks.slice(0, MAX_CHUNKS);
    console.log(`Created ${documentChunks.length} chunks, processing first ${chunksToProcess.length}`);

    checkTimeout();

    // Process the assessment with timeout checks
    console.log('Starting AI assessment...');
    const assessmentResults = await processAssessment(
      questionnaireData,
      chunksToProcess,
      mistralApiKey,
      checkTimeout
    );
    console.log('AI assessment completed');

    checkTimeout();

    // Store assessment report
    console.log('Saving assessment report...');
    const reportData = await saveAssessmentReport(
      supabaseClient,
      userId,
      document,
      assessmentResults,
      assessmentResults.credibilityScore,
      questionnaireData.metadata?.version || '1.0'
    );
    console.log(`Assessment report saved with ID: ${reportData.id}`);

    // Update document status and make it permanent
    console.log('Updating document status...');
    await updateDocumentStatus(supabaseClient, documentId);
    console.log('Document status updated');

    const processingTime = Date.now() - startTime;
    console.log(`=== Assessment completed successfully in ${processingTime}ms ===`);

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
        wasTruncated: document.document_text.length === MAX_DOCUMENT_LENGTH
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('Error in assess-document:', error);
    console.error('Error stack:', error.stack);
    console.error(`Failed after ${processingTime}ms`);
    
    // Determine error type for better user feedback
    let errorMessage = error.message;
    let errorCode = 'PROCESSING_ERROR';
    
    if (error.message.includes('timeout') || processingTime > MAX_PROCESSING_TIME) {
      errorMessage = 'Document assessment timed out. The document may be too large or complex. Please try with a smaller document.';
      errorCode = 'TIMEOUT_ERROR';
    } else if (error.message.includes('not iterable') || error.message.includes('sections')) {
      errorMessage = 'There was an issue with the assessment questionnaire. Please try again or contact support.';
      errorCode = 'QUESTIONNAIRE_ERROR';
    } else if (error.message.includes('MISTRAL_API_KEY')) {
      errorMessage = 'AI service configuration error. Please contact support.';
      errorCode = 'CONFIG_ERROR';
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        errorCode,
        processingTime
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
