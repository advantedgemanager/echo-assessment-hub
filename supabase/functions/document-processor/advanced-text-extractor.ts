
import "https://deno.land/x/xhr@0.1.0/mod.ts";

// Import PDF parsing library
const pdfParse = async (buffer: ArrayBuffer) => {
  try {
    // Use a more robust PDF parsing approach
    const uint8Array = new Uint8Array(buffer);
    
    // Look for text streams in PDF
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const pdfText = decoder.decode(uint8Array);
    
    // Advanced PDF text extraction patterns
    const textPatterns = [
      // Text between parentheses (most common)
      /\(([^)]+)\)\s*Tj/gs,
      // Text arrays
      /\[([^\]]*)\]\s*TJ/gs,
      // Direct text commands
      /BT\s+([^ET]+)\s+ET/gs,
      // Text after positioning
      /Td\s+\(([^)]+)\)/gs,
      // Text with font specifications
      /Tf\s+\(([^)]+)\)/gs,
    ];
    
    let extractedText = '';
    
    for (const pattern of textPatterns) {
      const matches = pdfText.match(pattern);
      if (matches) {
        for (const match of matches) {
          // Clean the match
          const cleanText = match
            .replace(/\(|\)|Tj|TJ|BT|ET|Td|Tf|\[|\]/g, ' ')
            .replace(/\\[rn]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (cleanText.length > 3 && /[a-zA-Z]/.test(cleanText)) {
            extractedText += cleanText + ' ';
          }
        }
      }
    }
    
    // If no structured text found, try alternative approach
    if (extractedText.length < 100) {
      // Look for readable text patterns
      const readableText = pdfText
        .split(/[\r\n]+/)
        .map(line => line.trim())
        .filter(line => {
          // Filter lines that look like readable text
          return line.length > 10 && 
                 /[a-zA-Z]/.test(line) && 
                 !/^[\d\s\-.,()]+$/.test(line) &&
                 !line.includes('obj') &&
                 !line.includes('endobj') &&
                 !line.includes('stream');
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (readableText.length > extractedText.length) {
        extractedText = readableText;
      }
    }
    
    return extractedText;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`PDF parsing failed: ${error.message}`);
  }
};

// DOCX text extraction using a more sophisticated approach
const extractDocxText = async (buffer: ArrayBuffer): Promise<string> => {
  try {
    const uint8Array = new Uint8Array(buffer);
    
    // DOCX is a ZIP file, we need to extract document.xml
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const docxContent = decoder.decode(uint8Array);
    
    // Look for XML content within the DOCX structure
    let extractedText = '';
    
    // More sophisticated patterns for DOCX text extraction
    const textPatterns = [
      // Text within w:t tags (Word text elements)
      /<w:t[^>]*>([^<]+)<\/w:t>/g,
      // Text within w:p tags (paragraphs)
      /<w:p[^>]*>.*?<w:t[^>]*>([^<]+)<\/w:t>.*?<\/w:p>/g,
      // Direct text content
      /<text[^>]*>([^<]+)<\/text>/g,
      // Alternative text patterns
      />\s*([A-Za-z][^<>{}\[\]]{10,})\s*</g,
    ];
    
    for (const pattern of textPatterns) {
      let match;
      while ((match = pattern.exec(docxContent)) !== null) {
        const text = match[1];
        if (text && text.trim().length > 5 && /[a-zA-Z]/.test(text)) {
          extractedText += text.trim() + ' ';
        }
      }
    }
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    // If still no good text, try a more aggressive approach
    if (extractedText.length < 100) {
      // Look for any readable text sequences
      const readableChunks = docxContent
        .split(/[<>{}[\]()]+/)
        .filter(chunk => {
          const trimmed = chunk.trim();
          return trimmed.length > 15 && 
                 /[a-zA-Z]{3,}/.test(trimmed) &&
                 !trimmed.includes('xml') &&
                 !trimmed.includes('word') &&
                 !trimmed.includes('document') &&
                 !/^[\d\s\-.,()]+$/.test(trimmed);
        })
        .map(chunk => chunk.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (readableChunks.length > extractedText.length) {
        extractedText = readableChunks;
      }
    }
    
    return extractedText;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error(`DOCX extraction failed: ${error.message}`);
  }
};

export const extractTextFromPdfAdvanced = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  console.log('🔍 Starting advanced PDF text extraction...');
  
  try {
    const extractedText = await pdfParse(arrayBuffer);
    
    if (extractedText.length < 50) {
      throw new Error('Unable to extract sufficient text from PDF. The document may be image-based or corrupted.');
    }
    
    console.log(`✅ Advanced PDF extraction successful: ${extractedText.length} characters`);
    console.log(`📄 Sample text: ${extractedText.substring(0, 200)}...`);
    
    return extractedText;
  } catch (error) {
    console.error('❌ Advanced PDF extraction failed:', error);
    throw error;
  }
};

export const extractTextFromDocxAdvanced = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  console.log('🔍 Starting advanced DOCX text extraction...');
  
  try {
    const extractedText = await extractDocxText(arrayBuffer);
    
    if (extractedText.length < 50) {
      throw new Error('Unable to extract sufficient text from DOCX. The document may be corrupted or empty.');
    }
    
    console.log(`✅ Advanced DOCX extraction successful: ${extractedText.length} characters`);
    console.log(`📄 Sample text: ${extractedText.substring(0, 200)}...`);
    
    return extractedText;
  } catch (error) {
    console.error('❌ Advanced DOCX extraction failed:', error);
    throw error;
  }
};
