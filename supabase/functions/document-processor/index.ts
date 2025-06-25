
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum document size (1.5MB in characters for stability)
const MAX_DOCUMENT_SIZE = 1.5 * 1024 * 1024;
// Maximum chunk size for processing (reduced for memory efficiency)
const MAX_CHUNK_SIZE = 300 * 1024; // 300KB chunks

const extractTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  console.log('Extracting text from PDF...');
  
  try {
    // Convert ArrayBuffer to Uint8Array with memory management
    const uint8Array = new Uint8Array(arrayBuffer);
    console.log(`Processing PDF of size: ${uint8Array.length} bytes`);
    
    // Process in smaller chunks to avoid memory issues
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const chunkSize = 50000; // Process 50KB at a time
    let extractedText = '';
    
    // Look for text streams in PDF with improved patterns
    const textPatterns = [
      /BT\s+(.+?)\s+ET/gs, // Text between BT (Begin Text) and ET (End Text)
      /\(([^)]+)\)\s*Tj/gs, // Text in parentheses before Tj
      /\[([^\]]+)\]\s*TJ/gs, // Text arrays before TJ
      /\/F\d+\s+\d+\s+Tf\s*(.+?)(?=BT|ET|endstream)/gs // Text after font commands
    ];
    
    // Process the PDF in chunks to avoid memory overload
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      const chunkText = decoder.decode(chunk);
      
      for (const pattern of textPatterns) {
        const matches = chunkText.match(pattern);
        if (matches) {
          for (const match of matches) {
            // Clean up the match more efficiently
            let cleanText = match
              .replace(/BT|ET|Tj|TJ|\[|\]|\(|\)|\/F\d+|\d+\s+Tf/g, '') // Remove PDF operators
              .replace(/[^\x20-\x7E\n\r\t\s]/g, ' ') // Keep only printable ASCII and spaces
              .replace(/\s+/g, ' ') // Normalize whitespace
              .trim();
            
            // Only add meaningful text chunks
            if (cleanText.length > 20 && /[a-zA-Z]/.test(cleanText)) {
              extractedText += cleanText + ' ';
            }
          }
        }
      }
      
      // Memory management - break if we have enough text
      if (extractedText.length > MAX_CHUNK_SIZE) {
        console.log('Reached maximum text length, stopping extraction');
        break;
      }
    }
    
    // If no structured text found, try basic extraction on first 100KB only
    if (extractedText.length < 200) {
      console.log('Trying basic text extraction on limited data...');
      const limitedData = uint8Array.slice(0, 100000); // Only process first 100KB
      const rawText = decoder.decode(limitedData);
      
      extractedText = rawText
        .replace(/[^\x20-\x7E\n\r\t\s]/g, ' ') // Remove non-printable chars
        .replace(/\s+/g, ' ') // Normalize whitespace
        .split(' ')
        .filter(word => word.length > 2 && /[a-zA-Z]/.test(word)) // Keep words with letters
        .join(' ')
        .trim();
    }
    
    console.log(`PDF text extraction result: ${extractedText.length} characters`);
    
    if (extractedText.length < 100) {
      throw new Error('Unable to extract sufficient readable text from PDF. The PDF may be image-based, encrypted, or corrupted.');
    }
    
    // Clean up the extracted text for better AI processing
    extractedText = extractedText
      .replace(/\s+/g, ' ') // Normalize all whitespace
      .replace(/(.)\1{4,}/g, '$1$1$1') // Remove excessive character repetition
      .trim();
    
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
    console.log(`Processing DOCX of size: ${uint8Array.length} bytes`);
    
    // Process in chunks for memory efficiency
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const chunkSize = 50000;
    let extractedText = '';
    
    // Look for XML text content in DOCX with improved patterns
    const textPatterns = [
      /<w:t[^>]*>([^<]+)<\/w:t>/g,
      /<w:p[^>]*>([^<]*)<\/w:p>/g,
      /<text[^>]*>([^<]+)<\/text>/g
    ];
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      const chunkText = decoder.decode(chunk);
      
      for (const pattern of textPatterns) {
        const matches = chunkText.match(pattern);
        if (matches) {
          for (const match of matches) {
            const textContent = match.replace(/<[^>]+>/g, '').trim();
            if (textContent.length > 0 && /[a-zA-Z]/.test(textContent)) {
              extractedText += textContent + ' ';
            }
          }
        }
      }
      
      // Memory management
      if (extractedText.length > MAX_CHUNK_SIZE) {
        console.log('Reached maximum text length, stopping extraction');
        break;
      }
    }
    
    // Fallback to basic extraction if needed
    if (extractedText.length < 200) {
      console.log('Trying basic DOCX extraction...');
      const limitedData = uint8Array.slice(0, 100000);
      const text = decoder.decode(limitedData);
      
      extractedText = text
        .replace(/<[^>]+>/g, ' ') // Remove XML tags
        .replace(/[^\x20-\x7E\n\r\t\s]/g, ' ') // Remove non-printable chars
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    }
    
    console.log(`DOCX text extraction result: ${extractedText.length} characters`);
    
    if (extractedText.length < 100) {
      throw new Error('Unable to extract sufficient readable text from DOCX.');
    }
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/(.)\1{4,}/g, '$1$1$1')
      .trim();
    
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
  
  console.log(`Truncating text from ${text.length} to ${maxSize} characters`);
  
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

  const startTime = Date.now();
  
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

    // Get document metadata with error handling
    const { data: document, error: docError } = await supabaseClient
      .from('uploaded_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document fetch error:', docError);
      throw new Error(`Document not found: ${docError?.message || 'Unknown error'}`);
    }

    console.log(`Document details: ${document.file_name}, Size: ${document.file_size} bytes, Type: ${document.file_type}`);

    // Check file size before processing
    if (document.file_size > 5 * 1024 * 1024) { // 5MB limit
      throw new Error('Document too large. Please use a smaller file (max 5MB).');
    }

    // Download file from storage with timeout
    let fileData;
    try {
      const downloadPromise = supabaseClient.storage
        .from('documents')
        .download(document.file_path);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Download timeout')), 30000)
      );
      
      const downloadResult = await Promise.race([downloadPromise, timeoutPromise]);
      
      if (downloadResult.error || !downloadResult.data) {
        console.error('Download error:', downloadResult.error);
        throw new Error(`Failed to download document: ${downloadResult.error?.message || 'Unknown error'}`);
      }
      
      fileData = downloadResult.data;
    } catch (downloadError) {
      console.error('Download failed:', downloadError);
      throw new Error(`Document download failed: ${downloadError.message}`);
    }

    console.log('Document downloaded successfully');

    // Extract text based on file type with improved error handling
    let extractedText = '';
    let arrayBuffer;
    
    try {
      arrayBuffer = await fileData.arrayBuffer();
      console.log(`File type: ${document.file_type}, Array buffer size: ${arrayBuffer.byteLength}`);
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Downloaded file is empty');
      }
      
    } catch (bufferError) {
      console.error('ArrayBuffer conversion error:', bufferError);
      throw new Error(`Failed to process file data: ${bufferError.message}`);
    }
    
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
    
    // Enhanced text validation
    if (extractedText.length < 100) {
      throw new Error('Extracted text is too short. The document may be empty, image-based, or corrupted.');
    }

    // Check for meaningful content
    const wordCount = extractedText.split(/\s+/).filter(word => word.length > 2 && /[a-zA-Z]/.test(word)).length;
    if (wordCount < 50) {
      throw new Error('Document does not contain enough readable text for assessment.');
    }

    // Check text quality
    const totalChars = extractedText.length;
    const meaningfulChars = (extractedText.match(/[a-zA-Z0-9\s.,;:!?()-]/g) || []).length;
    const qualityRatio = meaningfulChars / totalChars;
    
    if (qualityRatio < 0.8) {
      console.warn(`Low text quality ratio: ${(qualityRatio * 100).toFixed(1)}%`);
    }

    console.log(`Text preview: ${extractedText.substring(0, 500).replace(/\s+/g, ' ')}...`);

    // Handle large documents by smart truncation
    const { text: finalText, wasTruncated } = truncateText(extractedText, MAX_CHUNK_SIZE);
    
    if (wasTruncated) {
      console.warn(`Document was truncated from ${extractedText.length} to ${finalText.length} characters`);
    }

    // Update document with extracted text
    try {
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
        throw new Error(`Failed to save extracted text: ${updateError.message}`);
      }
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      throw new Error(`Database update failed: ${dbError.message}`);
    }

    const processingTime = Date.now() - startTime;
    console.log(`Document processing completed successfully in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        textLength: finalText.length,
        wordCount: wordCount,
        wasTruncated,
        extractionMethod: document.file_type,
        processingTime,
        qualityRatio: Math.round(qualityRatio * 100),
        message: wasTruncated 
          ? 'Document was truncated due to size limits but processing completed'
          : 'Document processed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('Error in document-processor:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        processingTime,
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
