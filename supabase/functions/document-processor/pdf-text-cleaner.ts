export const cleanExtractedText = (rawText: string): string => {
  console.log('Starting advanced text cleaning...');
  
  // Remove PDF metadata and structural elements
  let cleanedText = rawText
    // Remove PDF objects and streams
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
    
    // Remove coordinate and numeric sequences
    .replace(/\b\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\b/g, ' ')
    .replace(/\b\d+\s+\d+\s+m\b/g, ' ')
    .replace(/\b\d+\s+\d+\s+l\b/g, ' ')
    
    // Remove hex encoded content
    .replace(/<[0-9a-fA-F\s]+>/g, ' ')
    
    // Remove remaining PDF artifacts
    .replace(/\bxref\b/g, ' ')
    .replace(/\btrailer\b/g, ' ')
    .replace(/\bstartxref\b/g, ' ')
    .replace(/%%EOF/g, ' ')
    
    // Clean up whitespace and special characters
    .replace(/\s*\\\s*/g, ' ') // Remove backslashes
    .replace(/\s*\(\s*/g, ' (') // Clean parentheses
    .replace(/\s*\)\s*/g, ') ')
    .replace(/\[\s*/g, '[') // Clean brackets
    .replace(/\s*\]/g, ']')
    
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  // Extract meaningful sentences and paragraphs
  const sentences = cleanedText
    .split(/[.!?]+/)
    .map(sentence => sentence.trim())
    .filter(sentence => {
      // Filter out sentences that are likely PDF artifacts
      if (sentence.length < 10) return false;
      if (/^[\d\s\-.,()]+$/.test(sentence)) return false; // Only numbers and punctuation
      if (/^[A-Z\s\-.,()]{1,5}$/.test(sentence)) return false; // Very short uppercase strings
      if (sentence.split(' ').length < 3) return false; // Less than 3 words
      
      // Keep sentences with meaningful content
      const meaningfulWordCount = sentence
        .split(' ')
        .filter(word => word.length > 2 && /[a-zA-Z]/.test(word))
        .length;
      
      return meaningfulWordCount >= 3;
    });

  // Reconstruct clean text
  const finalText = sentences.join('. ') + '.';
  
  console.log(`Text cleaning completed: ${rawText.length} -> ${finalText.length} chars`);
  console.log(`Extracted ${sentences.length} meaningful sentences`);
  
  return finalText;
};

export const extractKeyTransitionContent = (text: string): string => {
  // Look for transition plan related content specifically
  const transitionKeywords = [
    'transition plan', 'climate', 'net zero', 'carbon', 'emission',
    'sustainability', 'environmental', 'greenhouse gas', 'GHG',
    'renewable', 'clean energy', 'decarbonization', 'Paris Agreement'
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
  
  return text;
};
