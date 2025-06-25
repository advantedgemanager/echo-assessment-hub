
import "https://deno.land/x/xhr@0.1.0/mod.ts";

// Enhanced PDF text extraction using pdf-parse library
const extractPdfText = async (buffer: ArrayBuffer): Promise<string> => {
  try {
    console.log('📄 Starting PDF-Parse library extraction...');
    
    // Import pdf-parse dynamically for Deno environment
    const pdfParse = await import('https://esm.sh/pdf-parse@1.1.1');
    
    // Convert ArrayBuffer to Buffer for pdf-parse
    const uint8Array = new Uint8Array(buffer);
    const nodeBuffer = Buffer.from(uint8Array);
    
    console.log(`📊 PDF buffer size: ${nodeBuffer.length} bytes`);
    
    // Parse PDF using pdf-parse library
    const data = await pdfParse.default(nodeBuffer);
    
    console.log(`📝 PDF pages found: ${data.numpages}`);
    console.log(`📝 Raw text length: ${data.text.length} characters`);
    
    if (data.text && data.text.length > 50) {
      const cleanText = sanitizeText(data.text);
      console.log(`✅ PDF extraction successful: ${cleanText.length} characters`);
      console.log(`Sample: ${cleanText.substring(0, 200)}...`);
      return cleanText;
    } else {
      throw new Error('PDF contains no readable text or is image-based');
    }
    
  } catch (error) {
    console.error('PDF-Parse error:', error);
    
    // Fallback to manual parsing if pdf-parse fails
    console.log('🔄 Falling back to manual PDF parsing...');
    return await fallbackPdfExtraction(buffer);
  }
};

// Fallback manual PDF extraction
const fallbackPdfExtraction = async (buffer: ArrayBuffer): Promise<string> => {
  try {
    const uint8Array = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const pdfContent = decoder.decode(uint8Array);
    
    let extractedText = '';
    
    // Extract text from PDF streams and objects
    const textPatterns = [
      /\((.*?)\)\s*Tj/gs,
      /\[(.*?)\]\s*TJ/gs,
      /BT\s+(.*?)\s+ET/gs
    ];
    
    for (const pattern of textPatterns) {
      const matches = pdfContent.match(pattern) || [];
      for (const match of matches) {
        // Clean extracted text
        const cleanMatch = match
          .replace(/\((.*?)\)\s*Tj/g, '$1')
          .replace(/\[(.*?)\]\s*TJ/g, '$1')
          .replace(/BT|ET|Tj|TJ/g, '')
          .trim();
        
        if (cleanMatch.length > 3 && /[a-zA-Z]/.test(cleanMatch)) {
          extractedText += cleanMatch + ' ';
        }
      }
    }
    
    return sanitizeText(extractedText);
  } catch (error) {
    console.error('Fallback PDF extraction failed:', error);
    throw new Error('Unable to extract text from PDF using any method');
  }
};

// Enhanced DOCX text extraction using mammoth library
const extractDocxText = async (buffer: ArrayBuffer): Promise<string> => {
  try {
    console.log('📄 Starting Mammoth library extraction...');
    
    // Import mammoth dynamically for Deno environment
    const mammoth = await import('https://esm.sh/mammoth@1.9.1');
    
    // Convert ArrayBuffer to Buffer for mammoth
    const uint8Array = new Uint8Array(buffer);
    const nodeBuffer = Buffer.from(uint8Array);
    
    console.log(`📊 DOCX buffer size: ${nodeBuffer.length} bytes`);
    
    // Extract text using mammoth
    const result = await mammoth.extractRawText({ buffer: nodeBuffer });
    
    if (result.text && result.text.length > 50) {
      const cleanText = sanitizeText(result.text);
      console.log(`✅ DOCX extraction successful: ${cleanText.length} characters`);
      console.log(`Sample: ${cleanText.substring(0, 200)}...`);
      
      if (result.messages && result.messages.length > 0) {
        console.log('⚠️ Mammoth warnings:', result.messages);
      }
      
      return cleanText;
    } else {
      throw new Error('DOCX contains no readable text or is corrupted');
    }
    
  } catch (error) {
    console.error('Mammoth extraction error:', error);
    
    // Fallback to manual ZIP parsing if mammoth fails
    console.log('🔄 Falling back to manual DOCX parsing...');
    return await fallbackDocxExtraction(buffer);
  }
};

// Fallback manual DOCX extraction
const fallbackDocxExtraction = async (buffer: ArrayBuffer): Promise<string> => {
  try {
    const uint8Array = new Uint8Array(buffer);
    
    // Check ZIP signature
    if (uint8Array[0] !== 0x50 || uint8Array[1] !== 0x4B) {
      throw new Error('Invalid DOCX file - not a ZIP archive');
    }
    
    // Convert to text for pattern matching
    const zipContent = Array.from(uint8Array)
      .map(byte => String.fromCharCode(byte))
      .join('');
    
    let extractedText = '';
    
    // Look for document.xml content
    const docXmlStart = zipContent.indexOf('word/document.xml');
    if (docXmlStart !== -1) {
      // Find XML content after the file entry
      let searchPos = docXmlStart + 17;
      const xmlStart = zipContent.indexOf('<?xml', searchPos);
      
      if (xmlStart !== -1) {
        const xmlEnd = zipContent.indexOf('</w:document>', xmlStart);
        if (xmlEnd !== -1) {
          const documentXml = zipContent.substring(xmlStart, xmlEnd + 13);
          
          // Extract text from w:t elements
          const textRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
          let match;
          
          while ((match = textRegex.exec(documentXml)) !== null) {
            const text = match[1];
            if (text && text.trim().length > 0) {
              extractedText += text + ' ';
            }
          }
        }
      }
    }
    
    if (extractedText.length < 50) {
      // Try extracting any readable text from the ZIP
      const readableTextRegex = /[a-zA-Z][a-zA-Z\s]{20,}/g;
      const matches = zipContent.match(readableTextRegex) || [];
      
      for (const match of matches) {
        if (!match.includes('xml') && !match.includes('rels') && !match.includes('word')) {
          extractedText += match + ' ';
        }
      }
    }
    
    return sanitizeText(extractedText);
  } catch (error) {
    console.error('Fallback DOCX extraction failed:', error);
    throw new Error('Unable to extract text from DOCX using any method');
  }
};

// Comprehensive text sanitization
const sanitizeText = (text: string): string => {
  if (!text) return '';
  
  // Remove problematic characters that cause database issues
  let sanitized = text
    .replace(/\u0000/g, '') // Remove null characters
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // Remove control chars
    .replace(/[\uFFF0-\uFFFF]/g, '') // Remove Unicode specials
    .replace(/\\[nr]/g, ' ') // Replace escaped newlines
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Ensure valid UTF-8 encoding
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const encoded = encoder.encode(sanitized);
    sanitized = decoder.decode(encoded);
  } catch (error) {
    console.warn('Text encoding issue, applying strict sanitization');
    sanitized = sanitized.replace(/[^\x20-\x7E\u00A0-\u024F\u2010-\u205F]/g, ' ');
  }
  
  return sanitized.trim();
};

export const extractTextFromPdfAdvanced = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  console.log('🔍 Starting advanced PDF text extraction with pdf-parse...');
  
  try {
    const extractedText = await extractPdfText(arrayBuffer);
    
    if (extractedText.length < 50) {
      throw new Error('Unable to extract sufficient readable text from PDF. The document may be image-based, corrupted, or password-protected.');
    }
    
    console.log(`✅ PDF extraction successful: ${extractedText.length} characters`);
    return extractedText;
  } catch (error) {
    console.error('❌ PDF extraction failed:', error);
    throw error;
  }
};

export const extractTextFromDocxAdvanced = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  console.log('🔍 Starting advanced DOCX text extraction with mammoth...');
  
  try {
    const extractedText = await extractDocxText(arrayBuffer);
    
    if (extractedText.length < 50) {
      throw new Error('Unable to extract sufficient readable text from DOCX. The document may be corrupted, empty, or in an unsupported format.');
    }
    
    console.log(`✅ DOCX extraction successful: ${extractedText.length} characters`);
    return extractedText;
  } catch (error) {
    console.error('❌ DOCX extraction failed:', error);
    throw error;
  }
};
