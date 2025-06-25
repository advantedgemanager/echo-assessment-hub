
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Starting optimized chunked assessment ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId, userId, batchIndex = 0 } = await req.json();
    console.log(`Processing batch ${batchIndex} for document: ${documentId}`);

    if (!documentId || !userId) {
      throw new Error('Document ID and User ID are required');
    }

    // Get document from database
    const { data: document, error: docError } = await supabaseClient
      .from('uploaded_documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found or not accessible');
    }

    console.log(`Document status: ${document.assessment_status}, Text length: ${document.document_text?.length || 0}`);

    // Check if document needs processing first
    if (!document.document_text || document.document_text.length < 200) {
      console.log('Document text not available or too short, processing document first...');
      
      try {
        const { data: processData, error: processError } = await supabaseClient.functions.invoke('document-processor', {
          body: { documentId }
        });

        if (processError) {
          console.error('Document processing invoke error:', processError);
          throw new Error(`Document processing failed: ${processError.message}`);
        }

        if (!processData?.success) {
          console.error('Document processing error:', processData?.error);
          throw new Error(`Failed to process document: ${processData?.error || 'Unknown error'}`);
        }

        console.log('Document processing completed, refetching document...');
        
        // Refetch the document after processing
        const { data: updatedDocument, error: refetchError } = await supabaseClient
          .from('uploaded_documents')
          .select('*')
          .eq('id', documentId)
          .eq('user_id', userId)
          .single();

        if (refetchError || !updatedDocument?.document_text) {
          throw new Error('Document processing completed but text is still not available');
        }

        // Update our document reference
        Object.assign(document, updatedDocument);
        console.log(`Document processed successfully, final text length: ${document.document_text.length}`);

      } catch (error) {
        console.error('Document processing error:', error);
        throw new Error(`Failed to process document: ${error.message}`);
      }
    }

    // Enhanced text validation - more lenient for processed text
    const documentText = document.document_text;
    if (!documentText || documentText.length < 100) {
      throw new Error('Document text is too short for assessment');
    }

    // Improved binary data detection - be more lenient with processed text
    const textSample = documentText.substring(0, Math.min(2000, documentText.length));
    let binaryCharCount = 0;
    let totalValidChars = 0;

    for (let i = 0; i < textSample.length; i++) {
      const charCode = textSample.charCodeAt(i);
      
      // Count as valid: printable ASCII, common Unicode, whitespace, punctuation
      if (
        (charCode >= 32 && charCode <= 126) ||  // Printable ASCII
        (charCode >= 160 && charCode <= 255) ||  // Extended ASCII
        charCode === 9 || charCode === 10 || charCode === 13 || // Tab, LF, CR
        (charCode >= 256 && charCode <= 0x017F) || // Latin Extended
        (charCode >= 0x2000 && charCode <= 0x206F) // General Punctuation
      ) {
        totalValidChars++;
      } else if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
        // Count control characters (except tab, LF, CR) as binary
        binaryCharCount++;
      }
    }

    const binaryRatio = totalValidChars > 0 ? (binaryCharCount / (binaryCharCount + totalValidChars)) * 100 : 0;
    console.log(`Text validation: ${binaryCharCount} binary chars out of ${binaryCharCount + totalValidChars} total (${binaryRatio.toFixed(1)}% binary)`);

    // More lenient threshold for processed documents
    if (binaryRatio > 60) { // Increased from 30% to 60%
      console.error(`High binary data ratio detected: ${binaryRatio.toFixed(1)}%`);
      throw new Error('Document appears to contain mostly binary data - text extraction may have failed');
    }

    // Start the main assessment using the standard assess-document function
    const { data: assessData, error: assessError } = await supabaseClient.functions.invoke('assess-document', {
      body: { documentId, userId }
    });

    if (assessError) {
      console.error('Assessment error:', assessError);
      throw new Error(`Assessment failed: ${assessError.message}`);
    }

    if (!assessData?.success) {
      throw new Error(assessData?.error || 'Assessment failed');
    }

    console.log('Chunked assessment completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        batchIndex,
        credibilityScore: assessData.credibilityScore,
        totalScore: assessData.totalScore,
        maxPossibleScore: assessData.maxPossibleScore,
        reportId: assessData.reportId,
        sectionsProcessed: assessData.sectionsProcessed,
        processedQuestions: assessData.processedQuestions,
        totalQuestions: assessData.totalQuestions,
        overallResult: assessData.overallResult
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in chunked assessment:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        batchIndex: 0
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
