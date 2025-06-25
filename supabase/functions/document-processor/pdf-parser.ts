
// Enhanced PDF parsing utility using multiple extraction strategies
export class PDFTextExtractor {
  private static readonly MAX_CHUNK_SIZE = 300 * 1024; // 300KB
  
  /**
   * Primary PDF text extraction using advanced patterns and algorithms
   */
  static async extractText(arrayBuffer: ArrayBuffer): Promise<string> {
    console.log('🔍 Starting enhanced PDF text extraction...');
    
    try {
      const uint8Array = new Uint8Array(arrayBuffer);
      console.log(`📄 Processing PDF: ${uint8Array.length} bytes`);
      
      // Strategy 1: Advanced text stream extraction
      let extractedText = await this.extractWithAdvancedPatterns(uint8Array);
      
      // Strategy 2: If first strategy fails, try OCR-like text reconstruction
      if (extractedText.length < 200) {
        console.log('🔄 First strategy yielded insufficient text, trying alternative extraction...');
        extractedText = await this.extractWithAlternativeMethod(uint8Array);
      }
      
      // Strategy 3: If both fail, try basic content extraction
      if (extractedText.length < 200) {
        console.log('🔄 Alternative method failed, trying basic content extraction...');
        extractedText = await this.extractBasicContent(uint8Array);
      }
      
      // Final validation and cleanup
      if (extractedText.length < 100) {
        throw new Error('PDF appears to be image-based or encrypted. Please try converting to text-based PDF or use DOCX format.');
      }
      
      // Enhanced text cleanup and normalization
      const cleanedText = this.enhancedTextCleanup(extractedText);
      
      console.log(`✅ PDF extraction successful: ${cleanedText.length} characters extracted`);
      return cleanedText;
      
    } catch (error) {
      console.error('❌ PDF extraction failed:', error);
      throw new Error(`Enhanced PDF extraction failed: ${error.message}`);
    }
  }
  
  /**
   * Advanced pattern-based text extraction with improved algorithms
   */
  private static async extractWithAdvancedPatterns(uint8Array: Uint8Array): Promise<string> {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let extractedText = '';
    
    // Enhanced patterns for modern PDF structures
    const advancedPatterns = [
      // Standard text objects with improved capture
      /BT\s*(?:\/[A-Za-z]+\d*\s+\d+(?:\.\d+)?\s+Tf\s*)?(.+?)ET/gs,
      
      // Text showing operations with better Unicode support
      /\(([^)]*(?:\\.[^)]*)*)\)\s*Tj/gs,
      /\[([^\]]*(?:\\.[^\]]*)*)\]\s*TJ/gs,
      
      // Font-based text extraction
      /\/F\d+\s+[\d.]+\s+Tf\s*(.+?)(?=BT|ET|endstream|obj)/gs,
      
      // Stream content extraction
      /stream\s*(.+?)\s*endstream/gs,
      
      // Improved parentheses text extraction
      /\(\s*([^)]+(?:\\.[^)]*)*)\s*\)/gs,
      
      // Text arrays with positioning
      /\[\s*([^[\]]*(?:\([^)]*\)[^[\]]*)*)\s*\]\s*TJ/gs,
      
      // Advanced Unicode text extraction
      /<([0-9A-Fa-f\s]+)>\s*Tj/gs,
      
      // Content stream text
      /q\s+(.+?)\s+Q/gs
    ];
    
    const chunkSize = 100000; // Process in 100KB chunks
    
    for (let i = 0; i < uint8Array.length && extractedText.length < this.MAX_CHUNK_SIZE; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      const chunkText = decoder.decode(chunk);
      
      for (const pattern of advancedPatterns) {
        const matches = [...chunkText.matchAll(pattern)];
        
        for (const match of matches) {
          let textContent = match[1] || match[0];
          
          // Enhanced text processing
          textContent = this.processTextContent(textContent);
          
          if (this.isValidText(textContent)) {
            extractedText += textContent + ' ';
          }
          
          // Prevent memory overload
          if (extractedText.length > this.MAX_CHUNK_SIZE) {
            console.log('📏 Reached extraction limit, stopping...');
            return extractedText;
          }
        }
      }
    }
    
    return extractedText;
  }
  
  /**
   * Alternative extraction method for complex PDFs
   */
  private static async extractWithAlternativeMethod(uint8Array: Uint8Array): Promise<string> {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let extractedText = '';
    
    // Try to find and parse content streams more aggressively
    const contentStreamPattern = /stream\s*([\s\S]*?)\s*endstream/g;
    const fullText = decoder.decode(uint8Array);
    
    const contentMatches = [...fullText.matchAll(contentStreamPattern)];
    
    for (const match of contentMatches) {
      const streamContent = match[1];
      
      // Try to extract text from the stream content
      const textFromStream = this.extractTextFromStream(streamContent);
      
      if (textFromStream.length > 0) {
        extractedText += textFromStream + ' ';
      }
      
      if (extractedText.length > this.MAX_CHUNK_SIZE) {
        break;
      }
    }
    
    return extractedText;
  }
  
  /**
   * Basic content extraction as last resort
   */
  private static async extractBasicContent(uint8Array: Uint8Array): Promise<string> {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const text = decoder.decode(uint8Array.slice(0, 200000)); // Only first 200KB
    
    // Remove PDF structure and extract readable content
    return text
      .replace(/\/[A-Za-z]+/g, ' ') // Remove PDF commands
      .replace(/\d+\s+\d+\s+obj/g, ' ') // Remove object definitions
      .replace(/<<[^>]*>>/g, ' ') // Remove dictionary objects
      .replace(/stream[\s\S]*?endstream/g, ' ') // Remove streams
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Keep only printable ASCII
      .replace(/\s+/g, ' ') // Normalize whitespace
      .split(' ')
      .filter(word => word.length > 2 && /[a-zA-Z]/.test(word))
      .join(' ')
      .trim();
  }
  
  /**
   * Process and clean individual text content
   */
  private static processTextContent(text: string): string {
    return text
      .replace(/\\n/g, ' ') // Convert escaped newlines
      .replace(/\\r/g, ' ') // Convert escaped carriage returns
      .replace(/\\t/g, ' ') // Convert escaped tabs
      .replace(/\\([()\\])/g, '$1') // Unescape PDF special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
  
  /**
   * Extract text from PDF content streams
   */
  private static extractTextFromStream(streamContent: string): string {
    // Look for text patterns within streams
    const streamTextPatterns = [
      /\(([^)]+)\)/g,
      /\[([^\]]+)\]/g,
      /<([0-9A-Fa-f\s]+)>/g
    ];
    
    let extractedText = '';
    
    for (const pattern of streamTextPatterns) {
      const matches = [...streamContent.matchAll(pattern)];
      for (const match of matches) {
        const content = this.processTextContent(match[1]);
        if (this.isValidText(content)) {
          extractedText += content + ' ';
        }
      }
    }
    
    return extractedText;
  }
  
  /**
   * Validate if extracted text is meaningful
   */
  private static isValidText(text: string): boolean {
    return text.length > 3 && 
           /[a-zA-Z]/.test(text) && 
           !/^[^a-zA-Z]*$/.test(text) &&
           !text.match(/^[\d\s\-+.()]+$/); // Not just numbers and symbols
  }
  
  /**
   * Enhanced text cleanup and normalization
   */
  private static enhancedTextCleanup(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize all whitespace
      .replace(/(.)\1{4,}/g, '$1$1$1') // Remove excessive repetition
      .replace(/[^\x20-\x7E\n\r\t\s]/g, ' ') // Remove non-printable chars
      .replace(/\b(\w)\1{3,}\b/g, '$1$1') // Fix repeated characters in words
      .split(' ')
      .filter(word => word.length > 0 && word !== ' ')
      .join(' ')
      .trim();
  }
}
