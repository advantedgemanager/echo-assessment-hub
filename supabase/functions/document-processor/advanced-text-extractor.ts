
import "https://deno.land/x/xhr@0.1.0/mod.ts";

// Simple but effective PDF text extraction for Deno
const extractPdfText = async (buffer: ArrayBuffer): Promise<string> => {
  try {
    console.log('📄 Starting Deno-compatible PDF extraction...');
    
    const uint8Array = new Uint8Array(buffer);
    const decoder = new TextDecoder('latin1', { fatal: false });
    const pdfContent = decoder.decode(uint8Array);
    
    console.log(`📊 PDF buffer size: ${buffer.byteLength} bytes`);
    
    let extractedText = '';
    
    // Extract text from PDF text objects - improved patterns
    const textPatterns = [
      // Standard text showing operators
      /\(((?:[^()\\]|\\[\\()nrtbf]|\\[0-7]{1,3})*)\)\s*Tj/g,
      /\[((?:[^\[\]\\]|\\[\\()\[\]nrtbf]|\\[0-7]{1,3})*)\]\s*TJ/g,
      // Text in BT/ET blocks
      /BT\s+.*?\(((?:[^()\\]|\\[\\()nrtbf]|\\[0-7]{1,3})*)\)\s*Tj.*?ET/gs,
      // Alternative text patterns
      /'([^']{3,})'/g,
      /"([^"]{3,})"/g
    ];
    
    for (const pattern of textPatterns) {
      let match;
      while ((match = pattern.exec(pdfContent)) !== null) {
        let text = match[1];
        if (text && text.length > 2) {
          // Basic unescape for common PDF escape sequences
          text = text
            .replace(/\\n/g, ' ')
            .replace(/\\r/g, ' ')
            .replace(/\\t/g, ' ')
            .replace(/\\b/g, ' ')
            .replace(/\\f/g, ' ')
            .replace(/\\\\/g, '\\')
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .trim();
          
          // Filter meaningful text
          if (text.length > 3 && /[a-zA-Z]/.test(text) && !/^[\d\s\-.,()]+$/.test(text)) {
            extractedText += text + ' ';
          }
        }
      }
    }
    
    // If still no text, try broader extraction
    if (extractedText.length < 100) {
      console.log('🔄 Trying broader PDF text extraction...');
      const broadTextRegex = /[a-zA-Z][a-zA-Z\s.,;:!?'"()-]{10,}/g;
      const matches = pdfContent.match(broadTextRegex) || [];
      
      for (const match of matches) {
        const cleanMatch = match.trim();
        if (cleanMatch.length > 10 && !cleanMatch.includes('obj') && !cleanMatch.includes('endobj')) {
          extractedText += cleanMatch + ' ';
        }
      }
    }
    
    return sanitizeText(extractedText);
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Unable to extract text from PDF');
  }
};

// Simple but effective DOCX text extraction for Deno
const extractDocxText = async (buffer: ArrayBuffer): Promise<string> => {
  try {
    console.log('📄 Starting Deno-compatible DOCX extraction...');
    
    const uint8Array = new Uint8Array(buffer);
    
    // Check ZIP signature
    if (uint8Array[0] !== 0x50 || uint8Array[1] !== 0x4B) {
      throw new Error('Invalid DOCX file - not a ZIP archive');
    }
    
    console.log(`📊 DOCX buffer size: ${buffer.byteLength} bytes`);
    
    // Convert to string for text search
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let zipContent = decoder.decode(uint8Array);
    
    let extractedText = '';
    
    // Look for document.xml content in the ZIP
    const docXmlPattern = /word\/document\.xml/;
    const docXmlMatch = zipContent.match(docXmlPattern);
    
    if (docXmlMatch) {
      const docXmlIndex = zipContent.indexOf('word/document.xml');
      
      // Find the actual XML content after the ZIP directory entry
      let searchStart = docXmlIndex + 17; // Skip past "word/document.xml"
      
      // Look for XML declaration or document start
      const xmlStartPattern = /<\?xml[^>]*>|<w:document[^>]*>/;
      const xmlStartMatch = zipContent.substring(searchStart).match(xmlStartPattern);
      
      if (xmlStartMatch) {
        const xmlStart = searchStart + xmlStartMatch.index!;
        const xmlEnd = zipContent.indexOf('</w:document>', xmlStart);
        
        if (xmlEnd !== -1) {
          const documentXml = zipContent.substring(xmlStart, xmlEnd + 13);
          
          // Extract text from w:t elements with improved regex
          const textRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
          let match;
          
          while ((match = textRegex.exec(documentXml)) !== null) {
            const text = match[1];
            if (text && text.trim().length > 0) {
              extractedText += text + ' ';
            }
          }
          
          // Also try to extract from <w:p> (paragraph) elements
          if (extractedText.length < 50) {
            const paragraphRegex = /<w:p[^>]*>(.*?)<\/w:p>/gs;
            let pMatch;
            
            while ((pMatch = paragraphRegex.exec(documentXml)) !== null) {
              const pContent = pMatch[1];
              // Remove XML tags and extract text
              const textOnly = pContent.replace(/<[^>]*>/g, ' ').trim();
              if (textOnly.length > 3 && /[a-zA-Z]/.test(textOnly)) {
                extractedText += textOnly + ' ';
              }
            }
          }
        }
      }
    }
    
    // Fallback: search for readable text in the entire ZIP
    if (extractedText.length < 50) {
      console.log('🔄 Trying fallback DOCX text extraction...');
      
      // Look for any readable text sequences
      const readableTextRegex = /[a-zA-Z][a-zA-Z\s.,;:!?'"()-]{15,}/g;
      const matches = zipContent.match(readableTextRegex) || [];
      
      for (const match of matches) {
        const cleanMatch = match.trim();
        // Filter out XML artifacts and file paths
        if (cleanMatch.length > 15 && 
            !cleanMatch.includes('xml') && 
            !cleanMatch.includes('rels') && 
            !cleanMatch.includes('word/') &&
            !cleanMatch.includes('docProps')) {
          extractedText += cleanMatch + ' ';
        }
      }
    }
    
    return sanitizeText(extractedText);
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Unable to extract text from DOCX');
  }
};

// Enhanced text sanitization for database storage
const sanitizeText = (text: string): string => {
  if (!text) return '';
  
  console.log(`🧹 Sanitizing text: ${text.length} characters`);
  
  // Remove problematic characters that cause database issues
  let sanitized = text
    .replace(/\u0000/g, '') // Remove null characters
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // Remove control chars
    .replace(/[\uFFF0-\uFFFF]/g, '') // Remove Unicode specials
    .replace(/[\uFFFE\uFFFF]/g, '') // Remove invalid Unicode
    .replace(/\\[nr]/g, ' ') // Replace escaped newlines
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Additional cleanup for common artifacts
  sanitized = sanitized
    .replace(/[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF\u2010-\u205F]/g, ' ') // Keep only printable chars
    .replace(/\s+/g, ' ') // Normalize whitespace again
    .trim();
  
  console.log(`✨ Sanitized to: ${sanitized.length} characters`);
  
  return sanitized;
};

export const extractTextFromPdfAdvanced = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  console.log('🔍 Starting Deno-compatible PDF text extraction...');
  
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
  console.log('🔍 Starting Deno-compatible DOCX text extraction...');
  
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
