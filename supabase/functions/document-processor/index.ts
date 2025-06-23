
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum document size (3MB in characters, roughly)
const MAX_DOCUMENT_SIZE = 3 * 1024 * 1024;
// Maximum chunk size for processing
const MAX_CHUNK_SIZE = 500 * 1024; // 500KB chunks

const extractTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  // Simple PDF text extraction - in production, you'd want a more robust solution
  const uint8Array = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let text = decoder.decode(uint8Array);
  
  // Basic cleanup for PDF content
  text = text.replace(/[^\x20-\x7E\n\r\t]/g, ' '); // Remove non-printable chars
  text = text.replace(/\s+/g, ' ').trim(); // Normalize whitespace
  
  return text;
};

const extractTextFromDocx = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  // Simple DOCX text extraction - basic implementation
  const uint8Array = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let text = decoder.decode(uint8Array);
  
  // Basic cleanup for DOCX content
  text = text.replace(/[^\x20-\x7E\n\r\t]/g, ' '); // Remove non-printable chars
  text = text.replace(/\s+/g, ' ').trim(); // Normalize whitespace
  
  return text;
};

const truncateText = (text: string, maxSize: number): { text: string, wasTruncated: boolean } => {
  if (text.length <= maxSize) {
    return { text, wasTruncated: false };
  }
  
  // Truncate at word boundary near the limit
  const truncated = text.substring(0, maxSize);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  const finalText = lastSpaceIndex > maxSize * 0.9 ? truncated.substring(0, lastSpaceIndex) : truncated;
  
  return { text: finalText, wasTruncated: true };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Starting document processing ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId } = await req.json();
    console.log(`Processing document: ${documentId}`);

    if (!documentId) {
      throw new Error('Document ID is required');
    }

    // Get document metadata
    const { data: document, error: docError } = await supabaseClient
      .from('uploaded_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    console.log(`Document details: ${document.file_name}, Size: ${document.file_size} bytes`);

    // Check file size limit (convert to rough character estimate)
    const estimatedTextSize = document.file_size * 2; // Rough estimate
    if (estimatedTextSize > MAX_DOCUMENT_SIZE) {
      console.warn(`Document too large: ${estimatedTextSize} chars (limit: ${MAX_DOCUMENT_SIZE})`);
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download document');
    }

    console.log('Document downloaded successfully');

    // Extract text based on file type
    let extractedText = '';
    const arrayBuffer = await fileData.arrayBuffer();
    
    if (document.file_type === 'application/pdf') {
      extractedText = await extractTextFromPdf(arrayBuffer);
    } else if (document.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractedText = await extractTextFromDocx(arrayBuffer);
    } else {
      throw new Error('Unsupported file type');
    }

    console.log(`Extracted text length: ${extractedText.length} characters`);

    // Handle large documents by truncating
    const { text: finalText, wasTruncated } = truncateText(extractedText, MAX_CHUNK_SIZE);
    
    if (wasTruncated) {
      console.warn(`Document was truncated from ${extractedText.length} to ${finalText.length} characters`);
    }

    // Update document with extracted text
    const { error: updateError } = await supabaseClient
      .from('uploaded_documents')
      .update({
        document_text: finalText,
        processed_at: new Date().toISOString(),
        assessment_status: wasTruncated ? 'processed_truncated' : 'processed'
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error('Failed to save extracted text');
    }

    console.log('Document processing completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        textLength: finalText.length,
        wasTruncated,
        message: wasTruncated 
          ? 'Document was truncated due to size limits but processing completed'
          : 'Document processed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in document-processor:', error);
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
