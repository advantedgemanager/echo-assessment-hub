
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Get document with text
    console.log('Fetching document...');
    const document = await getDocument(supabaseClient, documentId, userId);
    console.log(`Document fetched: ${document.file_name}`);

    // Get questionnaire
    console.log('Fetching questionnaire...');
    const questionnaireData = await getQuestionnaire(supabaseClient);
    console.log('Questionnaire fetched successfully');
    
    // Split document into manageable chunks
    console.log('Creating document chunks...');
    const documentChunks = createDocumentChunks(document.document_text);
    console.log(`Created ${documentChunks.length} document chunks`);

    // Process the assessment - pass the full questionnaireData
    console.log('Starting AI assessment...');
    const assessmentResults = await processAssessment(
      questionnaireData,
      documentChunks,
      mistralApiKey
    );
    console.log('AI assessment completed');

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

    console.log('=== Assessment completed successfully ===');

    return new Response(
      JSON.stringify({
        success: true,
        credibilityScore: assessmentResults.credibilityScore,
        totalScore: assessmentResults.totalScore,
        maxPossibleScore: assessmentResults.maxPossibleScore,
        reportId: reportData.id,
        sectionsProcessed: assessmentResults.sections.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in assess-document:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
