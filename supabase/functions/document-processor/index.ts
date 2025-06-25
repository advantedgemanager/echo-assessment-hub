
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractTextFromPdfAdvanced, extractTextFromDocxAdvanced } from './advanced-text-extractor.ts';
import { cleanExtractedText, extractKeyTransitionContent } from './pdf-text-cleaner.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Starting ADVANCED document processing v2.0 ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId } = await req.json();

    if (!documentId) {
      throw new Error('Document ID is required');
    }

    console.log(`🚀 Processing document with advanced extractors: ${documentId}`);

    // Get document from database
    const { data: document, error: docError } = await supabaseClient
      .from('uploaded_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error(`Document not found: ${docError?.message || 'Unknown error'}`);
    }

    console.log(`📋 Document: ${document.file_name}, Size: ${document.file_size} bytes, Type: ${document.file_type}`);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`);
    }

    console.log('✅ Document downloaded successfully');
    
    const arrayBuffer = await fileData.arrayBuffer();
    console.log(`📊 File buffer size: ${arrayBuffer.byteLength} bytes`);

    let extractedText = '';

    // Use advanced extractors based on file type
    if (document.file_type === 'application/pdf') {
      console.log('🔍 Using ADVANCED PDF extractor...');
      extractedText = await extractTextFromPdfAdvanced(arrayBuffer);
    } else if (document.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log('🔍 Using ADVANCED DOCX extractor...');
      extractedText = await extractTextFromDocxAdvanced(arrayBuffer);
    } else {
      throw new Error(`Unsupported file type: ${document.file_type}`);
    }

    console.log(`📝 Raw extracted text length: ${extractedText.length} characters`);

    if (extractedText.length < 100) {
      throw new Error('Advanced text extraction failed: ' + (extractedText || 'No text could be extracted'));
    }

    // Apply text cleaning and transition content filtering
    console.log('🧹 Applying optimized text cleaning and transition content filtering...');
    const cleanedText = cleanExtractedText(extractedText);
    const finalText = extractKeyTransitionContent(cleanedText);

    console.log(`✨ Final processed text length: ${finalText.length} characters`);

    // More lenient threshold - accept documents with at least 200 characters
    if (finalText.length < 200) {
      throw new Error('Document does not contain enough readable text for assessment.');
    }

    // Update document with extracted text
    const { error: updateError } = await supabaseClient
      .from('uploaded_documents')
      .update({
        document_text: finalText,
        assessment_status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    console.log('✅ Document processing completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Document processed successfully',
        textLength: finalText.length,
        documentId: documentId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ Error in ADVANCED document-processor v2.0:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
