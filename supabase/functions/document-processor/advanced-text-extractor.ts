
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
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\\[nr]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`PDF extraction result: ${extractedText.length} characters`);
    console.log(`Sample: ${extractedText.substring(0, 200)}...`);
    
    return extractedText;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`PDF parsing failed: ${error.message}`);
  }
};

// Enhanced DOCX text extraction by parsing the XML structure
const extractDocxText = async (buffer: ArrayBuffer): Promise<string> => {
  try {
    // DOCX files are ZIP archives containing XML files
    // We need to extract and parse the document.xml file
    
    const uint8Array = new Uint8Array(buffer);
    
    // Look for the document.xml content within the ZIP structure
    // Find the start of document.xml content
    let documentXmlStart = -1;
    let documentXmlEnd = -1;
    
    // Convert to string to search for XML patterns
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const content = decoder.decode(uint8Array);
    
    // Look for word processing document content
    const xmlPatterns = [
      /<w:document[^>]*>.*?<\/w:document>/gs,
      /<w:body[^>]*>.*?<\/w:body>/gs,
      /<w:p[^>]*>.*?<\/w:p>/gs
    ];
    
    let extractedText = '';
    
    // Strategy 1: Extract from word processing XML tags
    for (const pattern of xmlPatterns) {
      const matches = content.match(pattern) || [];
      for (const match of matches) {
        // Extract text from w:t tags (Word text elements)
        const textMatches = match.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
        for (const textMatch of textMatches) {
          const text = textMatch.replace(/<[^>]*>/g, '').trim();
          if (text.length > 1 && /[a-zA-Z]/.test(text)) {
            extractedText += text + ' ';
          }
        }
      }
    }
    
    // Strategy 2: Look for any readable text between angle brackets
    if (extractedText.length < 100) {
      const readableTextPattern = />([^<>{}\[\]]{15,})</g;
      const readableMatches = content.match(readableTextPattern) || [];
      
      for (const match of readableMatches) {
        const text = match.replace(/[><]/g, '').trim();
        if (text.length > 10 && 
            /[a-zA-Z]{3,}/.test(text) &&
            !text.includes('xml') &&
            !text.includes('word') &&
            !text.includes('rels') &&
            !text.includes('Content_Types') &&
            !/^[\d\s\-.,()]+$/.test(text)) {
          extractedText += text + ' ';
        }
      }
    }
    
    // Strategy 3: Extract from plain text between XML elements
    if (extractedText.length < 100) {
      // Remove all XML tags and extract readable content
      const textOnly = content
        .replace(/<[^>]*>/g, ' ')
        .replace(/[{}[\]()]/g, ' ')
        .split(/\s+/)
        .filter(word => 
          word.length > 3 && 
          /[a-zA-Z]/.test(word) &&
          !word.includes('xml') &&
          !word.includes('docx') &&
          !word.includes('word')
        )
        .join(' ');
      
      if (textOnly.length > extractedText.length) {
        extractedText = textOnly;
      }
    }
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    console.log(`DOCX extraction result: ${extractedText.length} characters`);
    console.log(`Sample: ${extractedText.substring(0, 200)}...`);
    
    return extractedText;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error(`DOCX extraction failed: ${error.message}`);
  }
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
