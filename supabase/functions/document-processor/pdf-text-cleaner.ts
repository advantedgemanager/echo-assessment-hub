export const cleanExtractedText = (rawText: string): string => {
  console.log('Starting optimized text cleaning...');
  
  // Remove PDF metadata and structural elements but be less aggressive
  let cleanedText = rawText
    // Remove clear PDF objects and streams
    .replace(/\d+\s+\d+\s+obj\s*<<.*?>>\s*endobj/gs, ' ')
    .replace(/<<.*?>>/g, ' ')
    .replace(/\bendobj\b/g, ' ')
    .replace(/\bobj\b/g, ' ')
    .replace(/\bstream\b.*?\bendstream\b/gs, ' ')
    
    // Remove PDF operators and commands
    .replace(/\b(BT|ET|Tj|TJ|Tf|Tm|Td|TD|T\*)\b/g, ' ')
    .replace(/\/F\d+/g, ' ')
    .replace(/\/Type\s*\/\w+/g, ' ')
    .replace(/\/Filter\s*\/\w+/g, ' ')
    .replace(/\/Length\s*\d+/g, ' ')
    
    // Remove coordinate sequences (but be more selective)
    .replace(/\b\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+[ml]\b/g, ' ')
    
    // Remove hex encoded content
    .replace(/<[0-9a-fA-F\s]+>/g, ' ')
    
    // Remove remaining PDF artifacts
    .replace(/\bxref\b/g, ' ')
    .replace(/\btrailer\b/g, ' ')
    .replace(/\bstartxref\b/g, ' ')
    .replace(/%%EOF/g, ' ')
    
    // Clean up whitespace and special characters (more conservative)
    .replace(/\s*\\\s*/g, ' ') // Remove backslashes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\n\s*\n/g, '\n') // Clean multiple newlines
    .trim();

  // More lenient sentence extraction - keep more content
  const sentences = cleanedText
    .split(/[.!?]+/)
    .map(sentence => sentence.trim())
    .filter(sentence => {
      // More lenient filtering - keep more sentences
      if (sentence.length < 5) return false; // Reduced from 10 to 5
      if (/^[\d\s\-.,()]+$/.test(sentence)) return false; // Only numbers and punctuation
      
      // Keep sentences with meaningful content (more lenient)
      const meaningfulWordCount = sentence
        .split(' ')
        .filter(word => word.length > 2 && /[a-zA-Z]/.test(word))
        .length;
      
      return meaningfulWordCount >= 2; // Reduced from 3 to 2
    });

  // Also preserve paragraphs that might contain useful content
  const paragraphs = cleanedText
    .split(/\n\s*\n/)
    .filter(paragraph => {
      const trimmed = paragraph.trim();
      return trimmed.length > 20 && // Keep longer paragraphs
             /[a-zA-Z]/.test(trimmed) && // Must contain letters
             !/^[\d\s\-.,()]+$/.test(trimmed); // Not just numbers/punctuation
    });

  // Combine sentences and paragraphs, removing duplicates
  const allContent = [...sentences, ...paragraphs];
  const uniqueContent = Array.from(new Set(allContent));
  
  // Reconstruct clean text with better preservation
  const finalText = uniqueContent.join('. ') + '.';
  
  console.log(`Optimized text cleaning completed: ${rawText.length} -> ${finalText.length} chars`);
  console.log(`Preserved ${sentences.length} sentences and ${paragraphs.length} paragraphs`);
  
  return finalText;
};

export const extractKeyTransitionContent = (text: string): string => {
  // More comprehensive transition plan keywords
  const transitionKeywords = [
    'transition plan', 'climate', 'net zero', 'carbon', 'emission',
    'sustainability', 'environmental', 'greenhouse gas', 'GHG',
    'renewable', 'clean energy', 'decarbonization', 'Paris Agreement',
    'scope 1', 'scope 2', 'scope 3', 'carbon neutral', 'climate change',
    'energy efficiency', 'green', 'sustainable', 'carbon footprint',
    'climate risk', 'ESG', 'environment', 'mitigation', 'adaptation'
  ];
  
  const paragraphs = text.split(/\n\s*\n/);
  const relevantParagraphs = paragraphs.filter(paragraph => {
    const lowerParagraph = paragraph.toLowerCase();
    return transitionKeywords.some(keyword => 
      lowerParagraph.includes(keyword.toLowerCase())
    );
  });
  
  if (relevantParagraphs.length > 0) {
    console.log(`Found ${relevantParagraphs.length} transition-related paragraphs`);
    return relevantParagraphs.join('\n\n');
  }
  
  // If no specific transition content found, return original text
  // (instead of filtering it out completely)
  console.log('No specific transition keywords found, returning full cleaned text');
  return text;
};
