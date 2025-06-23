
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId } = await req.json();

    if (!documentId) {
      throw new Error('Document ID is required');
    }

    // Get document info from database
    const { data: document, error: docError } = await supabaseClient
      .from('uploaded_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download document');
    }

    // Convert file to text (simplified extraction)
    let extractedText = '';
    
    if (document.file_type === 'application/pdf') {
      // For PDF files, we'll use a simplified text extraction
      // In a real implementation, you'd use a proper PDF parser
      const arrayBuffer = await fileData.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);
      // Basic PDF text extraction (this is very simplified)
      extractedText = text.replace(/[^\x20-\x7E\n]/g, ' ').trim();
    } else if (document.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // For DOCX files, simplified extraction
      const arrayBuffer = await fileData.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);
      extractedText = text.replace(/[^\x20-\x7E\n]/g, ' ').trim();
    } else {
      throw new Error('Unsupported file type');
    }

    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    if (!extractedText || extractedText.length < 50) {
      throw new Error('Could not extract meaningful text from document');
    }

    // Update document with extracted text
    const { error: updateError } = await supabaseClient
      .from('uploaded_documents')
      .update({
        document_text: extractedText,
        processed_at: new Date().toISOString(),
        assessment_status: 'processed'
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error('Failed to update document with extracted text');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Document processed successfully',
        textLength: extractedText.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in document-processor:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
