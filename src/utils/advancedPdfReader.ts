
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Configura il worker per pdf.js
GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  metadata?: any;
  hasImages: boolean;
}

export const extractTextFromPdfAdvanced = async (file: File): Promise<PdfExtractionResult> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    let hasImages = false;
    const pageCount = pdf.numPages;

    // Estrai testo da ogni pagina
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      
      // Estrai contenuto testuale
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n';

      // Verifica presenza di immagini
      const operatorList = await page.getOperatorList();
      const hasPageImages = operatorList.fnArray.some((fn: number) => 
        fn === 74 || fn === 92 // OPS.paintImageXObject or OPS.paintInlineImageXObject
      );
      
      if (hasPageImages) {
        hasImages = true;
      }
    }

    // Pulisci e normalizza il testo
    const cleanedText = cleanExtractedText(fullText);

    return {
      text: cleanedText,
      pageCount,
      hasImages,
      metadata: await pdf.getMetadata()
    };

  } catch (error) {
    console.error('Errore nell\'estrazione PDF avanzata:', error);
    throw new Error('Impossibile estrarre il testo dal PDF');
  }
};

const cleanExtractedText = (text: string): string => {
  return text
    .replace(/\s+/g, ' ') // Normalizza spazi multipli
    .replace(/\n\s*\n/g, '\n') // Rimuovi righe vuote multiple
    .replace(/[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]/g, ' ') // Mantieni solo caratteri stampabili
    .trim();
};

export const isPdfReadable = (text: string): boolean => {
  if (!text || text.length < 50) return false;
  
  // Calcola il rapporto di caratteri leggibili
  const readableChars = text.match(/[a-zA-Z0-9\s.,!?;:()\-]/g)?.length || 0;
  const totalChars = text.length;
  
  return (readableChars / totalChars) > 0.7; // Almeno 70% di caratteri leggibili
};
