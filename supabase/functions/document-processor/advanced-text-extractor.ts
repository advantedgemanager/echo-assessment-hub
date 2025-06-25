import "https://deno.land/x/xhr@0.1.0/mod.ts";

// Enhanced PDF text extraction using multiple strategies
const extractPdfText = async (buffer: ArrayBuffer): Promise<string> => {
  try {
    const uint8Array = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const pdfContent = decoder.decode(uint8Array);
    
    let extractedText = '';
    
    // Strategy 1: Extract text from text objects (BT...ET blocks)
    const textObjectPattern = /BT\s+(.*?)\s+ET/gs;
    const textObjects = pdfContent.match(textObjectPattern) || [];
    
    for (const textObj of textObjects) {
      // Extract text from parentheses and brackets
      const textMatches = textObj.match(/\(([^)]*)\)|<([^>]*)>/g) || [];
      for (const match of textMatches) {
        const cleanText = match.replace(/[()<>]/g, '').trim();
        if (cleanText.length > 2 && /[a-zA-Z]/.test(cleanText)) {
          extractedText += cleanText + ' ';
        }
      }
    }
    
    // Strategy 2: Extract from text positioning commands
    const textCommands = [
      /Tj\s*\(([^)]+)\)/gs,
      /TJ\s*\[([^\]]+)\]/gs,
      /'([^']+)'\s*Tj/gs,
      /\"([^"]+)\"\s*Tj/gs
    ];
    
    for (const pattern of textCommands) {
      const matches = pdfContent.match(pattern) || [];
      for (const match of matches) {
        const textMatch = match.match(/\(([^)]+)\)|'([^']+)'|"([^"]+)"/);
        if (textMatch) {
          const text = textMatch[1] || textMatch[2] || textMatch[3];
          if (text && text.length > 2 && /[a-zA-Z]/.test(text)) {
            extractedText += text + ' ';
          }
        }
      }
    }
    
    // Strategy 3: Look for stream content with text
    const streamPattern = /stream\s+(.*?)\s+endstream/gs;
    const streams = pdfContent.match(streamPattern) || [];
    
    for (const stream of streams) {
      const streamContent = stream.replace(/stream|endstream/g, '').trim();
      // Look for readable text patterns in streams
      const readableMatches = streamContent.match(/[a-zA-Z][a-zA-Z\s]{10,}/g) || [];
      for (const text of readableMatches) {
        if (!text.includes('obj') && !text.includes('endobj')) {
          extractedText += text + ' ';
        }
      }
    }
    
    // Clean and sanitize the extracted text
    extractedText = sanitizeText(extractedText);
    
    console.log(`PDF extraction result: ${extractedText.length} characters`);
    console.log(`Sample: ${extractedText.substring(0, 200)}...`);
    
    return extractedText;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`PDF parsing failed: ${error.message}`);
  }
};

// Enhanced DOCX text extraction using ZIP and XML parsing
const extractDocxText = async (buffer: ArrayBuffer): Promise<string> => {
  try {
    console.log('🔍 Starting enhanced DOCX text extraction...');
    
    // DOCX files are ZIP archives - we need to find and extract document.xml
    const uint8Array = new Uint8Array(buffer);
    
    // Simple ZIP file signature check
    if (uint8Array[0] !== 0x50 || uint8Array[1] !== 0x4B) {
      throw new Error('Invalid DOCX file format - not a ZIP archive');
    }
    
    // Convert to string for pattern matching (use latin1 to preserve bytes)
    const zipContent = Array.from(uint8Array)
      .map(byte => String.fromCharCode(byte))
      .join('');
    
    console.log('ZIP content length:', zipContent.length);
    
    // Look for document.xml within the ZIP structure
    let documentXml = '';
    
    // Strategy 1: Find document.xml file content
    const docXmlMarkers = [
      'word/document.xml',
      'document.xml'
    ];
    
    for (const marker of docXmlMarkers) {
      const markerIndex = zipContent.indexOf(marker);
      if (markerIndex !== -1) {
        console.log(`Found ${marker} at index:`, markerIndex);
        
        // Look for XML content after the marker
        const searchStart = markerIndex + marker.length;
        const xmlStart = zipContent.indexOf('<?xml', searchStart);
        
        if (xmlStart !== -1) {
          // Find the end of the XML document
          const xmlEnd = zipContent.indexOf('</w:document>', xmlStart);
          if (xmlEnd !== -1) {
            documentXml = zipContent.substring(xmlStart, xmlEnd + 13);
            console.log('Extracted document.xml, length:', documentXml.length);
            break;
          }
        }
      }
    }
    
    // Strategy 2: Look for any w:t (text) elements in the entire content
    if (!documentXml) {
      console.log('Fallback: searching for w:t elements in entire content');
      documentXml = zipContent;
    }
    
    let extractedText = '';
    
    // Extract text from w:t elements (Word text nodes)
    const textElementRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
    let match;
    
    while ((match = textElementRegex.exec(documentXml)) !== null) {
      const text = match[1];
      if (text && text.trim().length > 0) {
        // Decode XML entities
        const decodedText = text
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        
        extractedText += decodedText + ' ';
      }
    }
    
    // Strategy 3: Look for readable text between XML tags
    if (extractedText.length < 100) {
      console.log('Fallback: extracting text between XML tags');
      
      // Remove XML tags and extract readable content
      const cleanContent = documentXml
        .replace(/<[^>]*>/g, ' ')
        .replace(/&[a-zA-Z0-9#]+;/g, ' ');
      
      // Split into words and filter
      const words = cleanContent.split(/\s+/)
        .filter(word => 
          word.length > 2 && 
          /^[a-zA-Z0-9\s\-.,!?()]+$/.test(word) &&
          !word.includes('xml') &&
          !word.includes('word') &&
          !word.includes('rels') &&
          !word.includes('Content_Types')
        );
      
      if (words.length > 10) {
        extractedText = words.join(' ');
      }
    }
    
    // Clean and sanitize the final text
    extractedText = sanitizeText(extractedText);
    
    console.log(`DOCX extraction result: ${extractedText.length} characters`);
    console.log(`Sample: ${extractedText.substring(0, 200)}...`);
    
    return extractedText;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error(`DOCX extraction failed: ${error.message}`);
  }
};

// Comprehensive text sanitization function
const sanitizeText = (text: string): string => {
  if (!text) return '';
  
  // Remove null characters and other control characters that cause DB issues
  let sanitized = text
    .replace(/\u0000/g, '') // Remove null characters
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // Remove other control chars
    .replace(/[\uFFF0-\uFFFF]/g, '') // Remove Unicode specials
    .replace(/\\[nr]/g, ' ') // Replace escaped newlines
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Ensure the text is valid UTF-8
  try {
    // Test if string can be encoded/decoded properly
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const encoded = encoder.encode(sanitized);
    sanitized = decoder.decode(encoded);
  } catch (error) {
    console.warn('Text encoding issue, applying aggressive sanitization');
    // Fallback: keep only basic ASCII and common Unicode
    sanitized = sanitized.replace(/[^\x20-\x7E\u00A0-\u024F\u2010-\u205F]/g, ' ');
  }
  
  return sanitized.trim();
};

export const extractTextFromPdfAdvanced = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  console.log('🔍 Starting enhanced PDF text extraction...');
  
  try {
    const extractedText = await extractPdfText(arrayBuffer);
    
    if (extractedText.length < 50) {
      throw new Error('Unable to extract sufficient readable text from PDF. The document may be image-based, corrupted, or password-protected.');
    }
    
    console.log(`✅ Enhanced PDF extraction successful: ${extractedText.length} characters`);
    return extractedText;
  } catch (error) {
    console.error('❌ Enhanced PDF extraction failed:', error);
    throw error;
  }
};

export const extractTextFromDocxAdvanced = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  console.log('🔍 Starting enhanced DOCX text extraction...');
  
  try {
    const extractedText = await extractDocxText(arrayBuffer);
    
    if (extractedText.length < 50) {
      throw new Error('Unable to extract sufficient readable text from DOCX. The document may be corrupted, empty, or in an unsupported format.');
    }
    
    console.log(`✅ Enhanced DOCX extraction successful: ${extractedText.length} characters`);
    return extractedText;
  } catch (error) {
    console.error('❌ Enhanced DOCX extraction failed:', error);
    throw error;
  }
};
