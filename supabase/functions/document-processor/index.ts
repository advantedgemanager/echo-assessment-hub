
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cleanExtractedText, extractKeyTransitionContent } from './pdf-text-cleaner.ts';
import { extractTextFromPdfAdvanced, extractTextFromDocxAdvanced } from './advanced-text-extractor.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum document size (1.5MB in characters for stability)
const MAX_DOCUMENT_SIZE = 1.5 * 1024 * 1024;
// Maximum chunk size for processing (reduced for memory efficiency)
const MAX_CHUNK_SIZE = 300 * 1024; // 300KB chunks

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
    console.log('=== Starting ADVANCED document processing v2.0 ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId } = await req.json();
    console.log(`🚀 Processing document with advanced extractors: ${documentId}`);

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

    console.log(`📋 Document: ${document.file_name}, Size: ${document.file_size} bytes, Type: ${document.file_type}`);

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

    console.log('✅ Document downloaded successfully');

    // Extract text using ADVANCED extractors
    let extractedText = '';
    let arrayBuffer;
    
    try {
      arrayBuffer = await fileData.arrayBuffer();
      console.log(`📊 File buffer size: ${arrayBuffer.byteLength} bytes`);
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Downloaded file is empty');
      }
      
    } catch (bufferError) {
      console.error('ArrayBuffer conversion error:', bufferError);
      throw new Error(`Failed to process file data: ${bufferError.message}`);
    }
    
    try {
      if (document.file_type === 'application/pdf' || document.file_name.toLowerCase().endsWith('.pdf')) {
        console.log('🔍 Using ADVANCED PDF extractor...');
        extractedText = await extractTextFromPdfAdvanced(arrayBuffer);
      } else if (document.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                 document.file_name.toLowerCase().endsWith('.docx')) {
        console.log('🔍 Using ADVANCED DOCX extractor...');
        extractedText = await extractTextFromDocxAdvanced(arrayBuffer);
      } else if (document.file_type.startsWith('text/') || document.file_name.toLowerCase().endsWith('.txt')) {
        // Handle plain text files
        const decoder = new TextDecoder('utf-8');
        const rawText = decoder.decode(arrayBuffer);
        extractedText = cleanExtractedText(rawText);
      } else {
        throw new Error(`Unsupported file type: ${document.file_type}. Supported types: PDF, DOCX, TXT`);
      }
    } catch (extractionError) {
      console.error('❌ Advanced text extraction error:', extractionError);
      throw new Error(`Advanced text extraction failed: ${extractionError.message}`);
    }

    console.log(`📝 Raw extracted text length: ${extractedText.length} characters`);
    
    // Apply text cleaning and filtering
    console.log('🧹 Applying text cleaning and transition content filtering...');
    const cleanedText = cleanExtractedText(extractedText);
    const finalText = extractKeyTransitionContent(cleanedText);
    
    console.log(`✨ Final processed text length: ${finalText.length} characters`);
    
    // Enhanced text validation
    if (finalText.length < 100) {
      throw new Error('Extracted text is too short. The document may be empty, image-based, or corrupted.');
    }

    // Check for meaningful content
    const wordCount = finalText.split(/\s+/).filter(word => word.length > 2 && /[a-zA-Z]/.test(word)).length;
    if (wordCount < 50) {
      throw new Error('Document does not contain enough readable text for assessment.');
    }

    // Check text quality
    const totalChars = finalText.length;
    const meaningfulChars = (finalText.match(/[a-zA-Z0-9\s.,;:!?()-]/g) || []).length;
    const qualityRatio = meaningfulChars / totalChars;
    
    console.log(`📊 Text quality metrics:`);
    console.log(`   - Word count: ${wordCount}`);
    console.log(`   - Quality ratio: ${(qualityRatio * 100).toFixed(1)}%`);
    console.log(`   - Sample: ${finalText.substring(0, 300).replace(/\s+/g, ' ')}...`);

    if (qualityRatio < 0.7) {
      console.warn(`⚠️  Low text quality ratio: ${(qualityRatio * 100).toFixed(1)}%`);
    }

    // Handle large documents by smart truncation
    const { text: processedText, wasTruncated } = truncateText(finalText, MAX_CHUNK_SIZE);
    
    if (wasTruncated) {
      console.warn(`✂️  Document was truncated from ${finalText.length} to ${processedText.length} characters`);
    }

    // Update document with extracted text
    try {
      const { error: updateError } = await supabaseClient
        .from('uploaded_documents')
        .update({
          document_text: processedText,
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
    console.log(`🎉 ADVANCED document processing completed successfully in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        textLength: processedText.length,
        wordCount: wordCount,
        wasTruncated,
        extractionMethod: `advanced_${document.file_type}`,
        processingTime,
        qualityRatio: Math.round(qualityRatio * 100),
        message: wasTruncated 
          ? 'Document processed with advanced extractors but truncated due to size'
          : 'Document processed successfully with advanced extractors',
        version: '2.0_advanced'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Error in ADVANCED document-processor v2.0:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        processingTime,
        details: error.stack,
        version: '2.0_advanced'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
