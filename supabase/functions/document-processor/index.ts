
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum document size (2MB in characters)
const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024;
// Maximum chunk size for processing
const MAX_CHUNK_SIZE = 400 * 1024; // 400KB chunks

const extractTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  console.log('Extracting text from PDF...');
  
  try {
    // Convert ArrayBuffer to Uint8Array
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Try to find text streams in PDF
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let rawText = decoder.decode(uint8Array);
    
    // Look for text between stream markers
    const textPatterns = [
      /BT\s+(.+?)\s+ET/gs, // Text between BT (Begin Text) and ET (End Text)
      /Tj\s*\((.*?)\)/gs,  // Text in Tj operators
      /TJ\s*\[(.*?)\]/gs,  // Text in TJ operators
      /\((.*?)\)\s*Tj/gs   // Text before Tj operators
    ];
    
    let extractedText = '';
    
    for (const pattern of textPatterns) {
      const matches = rawText.match(pattern);
      if (matches) {
        for (const match of matches) {
          // Clean up the match
          let cleanText = match
            .replace(/BT|ET|Tj|TJ|\[|\]|\(|\)/g, '') // Remove PDF operators
            .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Keep only printable ASCII
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
          
          if (cleanText.length > 10) { // Only add meaningful text
            extractedText += cleanText + ' ';
          }
        }
      }
    }
    
    // If no structured text found, try basic extraction
    if (extractedText.length < 100) {
      console.log('Trying basic text extraction...');
      extractedText = rawText
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Remove non-printable chars
        .replace(/\s+/g, ' ') // Normalize whitespace
        .split(' ')
        .filter(word => word.length > 2 && /[a-zA-Z]/.test(word)) // Keep words with letters
        .join(' ')
        .trim();
    }
    
    console.log(`PDF text extraction result: ${extractedText.length} characters`);
    
    if (extractedText.length < 50) {
      throw new Error('Unable to extract readable text from PDF. The PDF may be image-based or encrypted.');
    }
    
    return extractedText;
    
  } catch (error) {
    console.error('PDF text extraction error:', error);
    throw new Error(`PDF text extraction failed: ${error.message}`);
  }
};

const extractTextFromDocx = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  console.log('Extracting text from DOCX...');
  
  try {
    const uint8Array = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let text = decoder.decode(uint8Array);
    
    // Look for XML text content in DOCX
    const textMatches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    let extractedText = '';
    
    if (textMatches) {
      for (const match of textMatches) {
        const textContent = match.replace(/<[^>]+>/g, '').trim();
        if (textContent.length > 0) {
          extractedText += textContent + ' ';
        }
      }
    }
    
    // Fallback to basic extraction if structured extraction fails
    if (extractedText.length < 100) {
      extractedText = text
        .replace(/<[^>]+>/g, ' ') // Remove XML tags
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Remove non-printable chars
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    }
    
    console.log(`DOCX text extraction result: ${extractedText.length} characters`);
    
    if (extractedText.length < 50) {
      throw new Error('Unable to extract readable text from DOCX.');
    }
    
    return extractedText;
    
  } catch (error) {
    console.error('DOCX text extraction error:', error);
    throw new Error(`DOCX text extraction failed: ${error.message}`);
  }
};

const truncateText = (text: string, maxSize: number): { text: string, wasTruncated: boolean } => {
  if (text.length <= maxSize) {
    return { text, wasTruncated: false };
  }
  
  // Truncate at sentence boundary near the limit
  const truncated = text.substring(0, maxSize);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?')
  );
  
  const finalText = lastSentenceEnd > maxSize * 0.8 
    ? truncated.substring(0, lastSentenceEnd + 1)
    : truncated;
  
  return { text: finalText, wasTruncated: true };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Starting enhanced document processing ===');
    
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

    console.log(`Document details: ${document.file_name}, Size: ${document.file_size} bytes, Type: ${document.file_type}`);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      throw new Error('Failed to download document from storage');
    }

    console.log('Document downloaded successfully');

    // Extract text based on file type
    let extractedText = '';
    const arrayBuffer = await fileData.arrayBuffer();
    
    console.log(`File type: ${document.file_type}, Array buffer size: ${arrayBuffer.byteLength}`);
    
    try {
      if (document.file_type === 'application/pdf' || document.file_name.toLowerCase().endsWith('.pdf')) {
        extractedText = await extractTextFromPdf(arrayBuffer);
      } else if (document.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                 document.file_name.toLowerCase().endsWith('.docx')) {
        extractedText = await extractTextFromDocx(arrayBuffer);
      } else if (document.file_type.startsWith('text/') || document.file_name.toLowerCase().endsWith('.txt')) {
        // Handle plain text files
        const decoder = new TextDecoder('utf-8');
        extractedText = decoder.decode(arrayBuffer);
      } else {
        throw new Error(`Unsupported file type: ${document.file_type}. Supported types: PDF, DOCX, TXT`);
      }
    } catch (extractionError) {
      console.error('Text extraction error:', extractionError);
      throw new Error(`Text extraction failed: ${extractionError.message}`);
    }

    console.log(`Extracted text length: ${extractedText.length} characters`);
    console.log(`Text preview: ${extractedText.substring(0, 500)}...`);

    // Validate extracted text quality
    if (extractedText.length < 100) {
      throw new Error('Extracted text is too short. The document may be empty, image-based, or corrupted.');
    }

    // Check for meaningful content
    const wordCount = extractedText.split(/\s+/).filter(word => word.length > 2).length;
    if (wordCount < 50) {
      throw new Error('Document does not contain enough readable text for assessment.');
    }

    // Handle large documents by smart truncation
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
      console.error('Database update error:', updateError);
      throw new Error('Failed to save extracted text to database');
    }

    console.log('Document processing completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        textLength: finalText.length,
        wordCount: wordCount,
        wasTruncated,
        extractionMethod: document.file_type,
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
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
