
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createDocumentChunks } from './document-processor.ts';
import { processAssessment } from './assessment-processor.ts';
import { processBatchedAssessment } from './batched-assessment-processor.ts';
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

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

// Enhanced resource limits for comprehensive 265-question assessment
const MAX_PROCESSING_TIME = 25 * 60 * 1000; // Increased to 25 minutes for 265 questions
const MAX_DOCUMENT_LENGTH = 500000; // Increased to 500k characters for larger documents
const MAX_CHUNKS = 100; // Increased chunk limit for better coverage

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    console.log('=== Starting batched assessment v6.0 ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId, userId, batchIndex = 0, batchSize = 20 } = await req.json();
    console.log(`Processing batched assessment for document: ${documentId}, user: ${userId}, batch: ${batchIndex}, size: ${batchSize}`);

    if (!documentId || !userId) {
      throw new Error('Document ID and User ID are required');
    }

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY environment variable is not set');
    }

    // Enhanced timeout checking for longer processing
    const checkTimeout = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_PROCESSING_TIME) {
        throw new Error(`Processing timeout - enhanced assessment taking too long (${Math.round(elapsed/1000)}s)`);
      }
    };

    // Get document with enhanced validation
    console.log('Fetching document...');
    checkTimeout();
    const document = await getDocument(supabaseClient, documentId, userId);
    console.log(`Document fetched: ${document.file_name}, text length: ${document.document_text?.length || 0}`);

    // Check if document already has extracted text (from frontend)
    if (!document.document_text || document.document_text.length < 50) {
      // If no text available, try to process the document
      console.log('No pre-extracted text found, attempting document processing...');
      
      // Try to process the document to extract text
      try {
        const { data: processData, error: processError } = await supabaseClient.functions.invoke('document-processor', {
          body: { documentId }
        });

        if (processError || !processData?.success) {
          throw new Error('Document processing failed - text extraction required for assessment');
        }

        // Refetch document after processing
        const updatedDocument = await getDocument(supabaseClient, documentId, userId);
        Object.assign(document, updatedDocument);
        console.log(`Document processed, final text length: ${document.document_text?.length || 0}`);
      } catch (error) {
        throw new Error('Document text not available and processing failed. Please ensure the document is properly formatted and try uploading again.');
      }
    } else {
      console.log('Using pre-extracted text from frontend upload');
    }

    if (!document.document_text || document.document_text.length < 50) {
      throw new Error('Document text is too short for assessment. Please upload a document with more readable text content.');
    }

    // Enhanced document handling with smarter truncation strategy
    let documentWasTruncated = false;
    let processedText = document.document_text;
    
    if (document.document_text.length > MAX_DOCUMENT_LENGTH) {
      console.warn(`Document size: ${document.document_text.length} chars, applying smart truncation to ${MAX_DOCUMENT_LENGTH}`);
      
      // Smart truncation - prioritize transition plan content
      const text = document.document_text;
      const transitionKeywords = [
        'transition plan', 'net zero', 'carbon neutral', 'climate',
        'emissions', 'sustainability', 'environmental', 'ESG',
        'greenhouse gas', 'GHG', 'scope 1', 'scope 2', 'scope 3',
        'carbon footprint', 'renewable energy', 'clean energy'
      ];
      
      // Find sections with high concentration of transition-related keywords
      const chunks = [];
      const chunkSize = 50000;
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.substring(i, i + chunkSize);
        const keywordCount = transitionKeywords.reduce((count, keyword) => 
          count + (chunk.toLowerCase().match(new RegExp(keyword, 'gi')) || []).length, 0
        );
        chunks.push({ text: chunk, keywordCount, position: i });
      }
      
      // Sort by keyword relevance and keep most relevant sections
      chunks.sort((a, b) => b.keywordCount - a.keywordCount);
      const selectedChunks = chunks.slice(0, Math.floor(MAX_DOCUMENT_LENGTH / chunkSize));
      selectedChunks.sort((a, b) => a.position - b.position);
      
      processedText = selectedChunks.map(chunk => chunk.text).join('\n');
      
      if (processedText.length > MAX_DOCUMENT_LENGTH) {
        processedText = processedText.substring(0, MAX_DOCUMENT_LENGTH);
      }
      
      documentWasTruncated = true;
      console.log(`Smart truncation applied, final length: ${processedText.length}`);
    }

    // Get questionnaire with enhanced error handling and debugging
    console.log('Fetching comprehensive questionnaire (up to 265 questions)...');
    checkTimeout();
    const questionnaireData = await getQuestionnaire(supabaseClient);
    console.log('Questionnaire structure preview:', JSON.stringify({
      hasQuestionnaire: !!questionnaireData?.questionnaire,
      sections: questionnaireData?.questionnaire?.sections?.length || 0,
      metadata: questionnaireData?.metadata
    }, null, 2));
    
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
    
    if (totalQuestions === 0) {
      throw new Error('No questions found in questionnaire. Please check questionnaire upload.');
    }
    
    // Enhanced document chunking with better overlap strategy for comprehensive assessment
    console.log('Creating document chunks with enhanced strategy for comprehensive assessment...');
    const documentChunks = createDocumentChunks(processedText, 4000, 800); // Larger chunks with more overlap
    
    const chunksToProcess = documentChunks.slice(0, MAX_CHUNKS);
    console.log(`Created ${documentChunks.length} chunks, processing ${chunksToProcess.length}`);
    console.log('Sample chunk preview:', chunksToProcess[0]?.substring(0, 300) + '...');

    checkTimeout();

    // Check if this is a batched request or full assessment
    if (batchIndex !== undefined && batchIndex >= 0) {
      // Batched assessment processing
      console.log(`Starting batched AI assessment v6.0 for batch ${batchIndex}...`);
      const batchResults = await processBatchedAssessment(
        questionnaireData,
        chunksToProcess,
        lovableApiKey,
        checkTimeout,
        documentWasTruncated,
        batchIndex,
        batchSize
      );
      console.log('Batched AI assessment completed successfully');
      
      const processingTime = Date.now() - startTime;
      console.log(`=== Batch ${batchIndex + 1}/${batchResults.totalBatches} completed in ${processingTime}ms ===`);
      
      // Return batch results
      return new Response(
        JSON.stringify({
          success: true,
          isBatch: true,
          batchIndex: batchResults.batchIndex,
          totalBatches: batchResults.totalBatches,
          questionsInBatch: batchResults.questionsInBatch,
          totalQuestions: batchResults.totalQuestions,
          batchResults: batchResults.batchResults,
          completed: batchResults.completed,
          processingTime,
          chunksProcessed: chunksToProcess.length,
          wasTruncated: documentWasTruncated,
          version: '6.0-batched'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Full assessment processing (legacy support)
    console.log(`Starting full AI assessment v6.0 for ${totalQuestions} questions...`);
    const assessmentResults = await processAssessment(
      questionnaireData,
      chunksToProcess,
      lovableApiKey,
      checkTimeout,
      documentWasTruncated
    );
    console.log('Full AI assessment completed successfully');
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
    console.log('Saving full assessment report...');
    const reportData = await saveAssessmentReport(
      supabaseClient,
      userId,
      document,
      assessmentResults,
      assessmentResults.credibilityScore,
      questionnaireData.metadata?.version || '5.0'
    );
    console.log(`Enhanced assessment report saved with ID: ${reportData.id}`);

    // Update document status
    console.log('Updating document status...');
    await updateDocumentStatus(supabaseClient, documentId);
    console.log('Document status updated');

    const processingTime = Date.now() - startTime;
    console.log(`=== Full assessment v6.0 completed successfully in ${processingTime}ms ===`);

    // Enhanced response with comprehensive metadata
    return new Response(
      JSON.stringify({
        success: true,
        isBatch: false,
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
        version: '6.0',
        textSource: 'frontend_extracted'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('Error in assess-document v6.0:', error);
    console.error('Error stack:', error.stack);
    console.error(`Failed after ${processingTime}ms`);
    
    // Enhanced error categorization
    let errorMessage = error.message;
    let errorCode = 'PROCESSING_ERROR';
    
    if (error.message.includes('timeout') || processingTime > MAX_PROCESSING_TIME) {
      errorMessage = 'Assessment timed out. Please try again or contact support.';
      errorCode = 'TIMEOUT_ERROR';
    } else if (error.message.includes('Rate limit') || error.message.includes('429')) {
      errorMessage = 'AI service rate limit reached. Please wait a few minutes and try again.';
      errorCode = 'RATE_LIMIT_ERROR';
    } else if (error.message.includes('questionnaire') || error.message.includes('sections') || error.message.includes('No questions found')) {
      errorMessage = 'Issue with questionnaire. Please ensure it is properly uploaded and active.';
      errorCode = 'QUESTIONNAIRE_ERROR';
    } else if (error.message.includes('LOVABLE_API_KEY')) {
      errorMessage = 'AI service configuration error. Please contact support.';
      errorCode = 'CONFIG_ERROR';
    } else if (error.message.includes('document_text') || error.message.includes('text extraction')) {
      errorMessage = 'Document text extraction failed. Please ensure the document contains readable text.';
      errorCode = 'DOCUMENT_ERROR';
    } else if (error.message.includes('fetch') || error.message.includes('network')) {
      errorMessage = 'Network error. Please check your connection and try again.';
      errorCode = 'NETWORK_ERROR';
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        errorCode,
        processingTime,
        success: false,
        details: error.message,
        version: '6.0'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
