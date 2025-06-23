
export interface DocumentChunk {
  text: string;
  index: number;
}

export const createDocumentChunks = (
  documentText: string, 
  chunkSize: number = 1500, 
  overlap: number = 150
): string[] => {
  const chunks: string[] = [];
  
  // If document is very short, return as single chunk
  if (documentText.length <= chunkSize) {
    return [documentText];
  }
  
  for (let i = 0; i < documentText.length; i += chunkSize - overlap) {
    const chunk = documentText.slice(i, i + chunkSize);
    
    // Skip very short chunks at the end
    if (chunk.length < 100 && chunks.length > 0) {
      // Append to previous chunk instead
      chunks[chunks.length - 1] += ' ' + chunk;
    } else {
      chunks.push(chunk);
    }
  }
  
  return chunks;
};
