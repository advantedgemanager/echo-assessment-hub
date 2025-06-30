
import mammoth from 'mammoth';

export interface DocxExtractionResult {
  text: string;
  metadata?: any;
  wordCount: number;
}

export const extractTextFromDocxAdvanced = async (file: File): Promise<DocxExtractionResult> => {
  try {
    console.log('🔍 Starting advanced DOCX extraction...');
    
    const arrayBuffer = await file.arrayBuffer();
    
    // Usa mammoth per estrarre il testo dal DOCX
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    if (!result.value || result.value.length < 10) {
      throw new Error('Unable to extract text from DOCX file');
    }

    // Pulisci e normalizza il testo
    const cleanedText = cleanExtractedText(result.value);
    
    // Conta le parole
    const wordCount = cleanedText.split(/\s+/).filter(word => word.length > 0).length;

    console.log(`✅ DOCX extraction successful: ${cleanedText.length} characters, ${wordCount} words`);

    return {
      text: cleanedText,
      metadata: {
        messages: result.messages,
        originalLength: result.value.length
      },
      wordCount
    };

  } catch (error) {
    console.error('❌ DOCX extraction failed:', error);
    throw new Error('Unable to extract text from DOCX file');
  }
};

const cleanExtractedText = (text: string): string => {
  return text
    .replace(/\s+/g, ' ') // Normalizza spazi multipli
    .replace(/\n\s*\n/g, '\n') // Rimuovi righe vuote multiple
    .replace(/[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]/g, ' ') // Mantieni solo caratteri stampabili
    .trim();
};

export const isDocxReadable = (text: string): boolean => {
  if (!text || text.length < 50) return false;
  
  // Calcola il rapporto di caratteri leggibili
  const readableChars = text.match(/[a-zA-Z0-9\s.,!?;:()\-]/g)?.length || 0;
  const totalChars = text.length;
  
  return (readableChars / totalChars) > 0.7; // Almeno 70% di caratteri leggibili
};
