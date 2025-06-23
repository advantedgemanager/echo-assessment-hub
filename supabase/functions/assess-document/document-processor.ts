
export interface DocumentChunk {
  text: string;
  index: number;
}

export const createDocumentChunks = (documentText: string, chunkSize: number = 2000, overlap: number = 200): string[] => {
  const chunks: string[] = [];
  
  for (let i = 0; i < documentText.length; i += chunkSize - overlap) {
    const chunk = documentText.slice(i, i + chunkSize);
    chunks.push(chunk);
  }
  
  return chunks;
};
