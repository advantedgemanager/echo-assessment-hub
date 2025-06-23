
export interface DocumentChunk {
  text: string;
  index: number;
  relevanceScore?: number;
}

export const createDocumentChunks = (
  documentText: string, 
  chunkSize: number = 5000, 
  overlap: number = 1000
): string[] => {
  if (documentText.length <= chunkSize) {
    return [documentText];
  }
  
  console.log(`📄 Creating enhanced document chunks: ${documentText.length} chars, chunk size: ${chunkSize}, overlap: ${overlap}`);
  
  // Enhanced preprocessing to identify and preserve important sections
  const importantSections = identifyImportantSections(documentText);
  console.log(`🎯 Identified ${importantSections.length} important sections`);
  
  const chunks: string[] = [];
  let processedLength = 0;
  
  // First, create chunks that preserve important sections
  for (const section of importantSections) {
    if (section.text.length <= chunkSize) {
      chunks.push(section.text);
      processedLength += section.text.length;
    } else {
      // Split large important sections carefully
      const sectionChunks = splitSection(section.text, chunkSize, overlap);
      chunks.push(...sectionChunks);
      processedLength += section.text.length;
    }
  }
  
  // Then, create standard chunks for the remaining content
  const remainingText = getRemainingText(documentText, importantSections);
  if (remainingText.length > 0) {
    const standardChunks = createStandardChunks(remainingText, chunkSize, overlap);
    chunks.push(...standardChunks);
  }
  
  // Deduplicate and sort by relevance
  const uniqueChunks = deduplicateChunks(chunks);
  const scoredChunks = scoreChunkRelevance(uniqueChunks);
  
  console.log(`✅ Created ${scoredChunks.length} enhanced chunks (${chunks.length} before deduplication)`);
  
  return scoredChunks;
};

const identifyImportantSections = (text: string): Array<{text: string, score: number, type: string}> => {
  const sections: Array<{text: string, score: number, type: string}> = [];
  
  // Define patterns for important transition plan sections
  const sectionPatterns = [
    {
      name: 'Net Zero Strategy',
      patterns: [
        /net.{0,5}zero[\s\S]{0,2000}/gi,
        /carbon.{0,5}neutral[\s\S]{0,2000}/gi,
        /climate.{0,10}strategy[\s\S]{0,2000}/gi
      ],
      score: 10
    },
    {
      name: 'Science-Based Targets',
      patterns: [
        /science.{0,5}based.{0,5}target[\s\S]{0,1500}/gi,
        /SBTi?[\s\S]{0,1500}/gi,
        /paris.{0,10}agreement[\s\S]{0,1500}/gi
      ],
      score: 9
    },
    {
      name: 'Emissions Disclosure',
      patterns: [
        /scope\s*[123][\s\S]{0,2000}/gi,
        /ghg.{0,10}emission[\s\S]{0,2000}/gi,
        /carbon.{0,10}footprint[\s\S]{0,1500}/gi,
        /emission.{0,10}baseline[\s\S]{0,1500}/gi
      ],
      score: 8
    },
    {
      name: 'Governance Structure',
      patterns: [
        /board.{0,10}oversight[\s\S]{0,1500}/gi,
        /governance.{0,10}structure[\s\S]{0,1500}/gi,
        /climate.{0,10}governance[\s\S]{0,1500}/gi
      ],
      score: 8
    },
    {
      name: 'Progress Reporting',
      patterns: [
        /progress.{0,10}report[\s\S]{0,1500}/gi,
        /monitoring.{0,10}framework[\s\S]{0,1500}/gi,
        /third.{0,5}party.{0,5}verification[\s\S]{0,1500}/gi
      ],
      score: 7
    },
    {
      name: 'Executive Compensation',
      patterns: [
        /executive.{0,10}compensation[\s\S]{0,1500}/gi,
        /climate.{0,10}performance.{0,10}incentive[\s\S]{0,1500}/gi,
        /pay.{0,10}link[\s\S]{0,1000}/gi
      ],
      score: 7
    },
    {
      name: 'Implementation Plan',
      patterns: [
        /implementation.{0,10}plan[\s\S]{0,2000}/gi,
        /transition.{0,10}roadmap[\s\S]{0,2000}/gi,
        /action.{0,10}plan[\s\S]{0,1500}/gi
      ],
      score: 6
    },
    {
      name: 'Financial Resources',
      patterns: [
        /capital.{0,10}allocation[\s\S]{0,1500}/gi,
        /investment.{0,10}plan[\s\S]{0,1500}/gi,
        /funding.{0,10}strategy[\s\S]{0,1500}/gi,
        /capex[\s\S]{0,1000}/gi
      ],
      score: 6
    }
  ];
  
  for (const sectionType of sectionPatterns) {
    for (const pattern of sectionType.patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (match.length > 100) { // Only consider substantial matches
            sections.push({
              text: match.trim(),
              score: sectionType.score,
              type: sectionType.name
            });
          }
        }
      }
    }
  }
  
  // Sort by score and remove overlaps
  return sections
    .sort((a, b) => b.score - a.score)
    .filter((section, index, array) => {
      // Remove sections that are largely contained within higher-scored sections
      return !array.slice(0, index).some(otherSection => 
        otherSection.text.includes(section.text.substring(0, 200)) ||
        section.text.includes(otherSection.text.substring(0, 200))
      );
    })
    .slice(0, 15); // Limit to top 15 sections
};

const splitSection = (text: string, chunkSize: number, overlap: number): string[] => {
  const chunks: string[] = [];
  
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    let chunk = text.slice(i, i + chunkSize);
    
    // Try to end at sentence boundaries for better context
    if (i + chunkSize < text.length) {
      const lastSentenceEnd = Math.max(
        chunk.lastIndexOf('.'),
        chunk.lastIndexOf('!'),
        chunk.lastIndexOf('?')
      );
      
      if (lastSentenceEnd > chunkSize * 0.7) {
        chunk = chunk.slice(0, lastSentenceEnd + 1);
      }
    }
    
    if (chunk.trim().length > 100) {
      chunks.push(chunk.trim());
    }
  }
  
  return chunks;
};

const createStandardChunks = (text: string, chunkSize: number, overlap: number): string[] => {
  const chunks: string[] = [];
  
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    const chunk = text.slice(i, i + chunkSize);
    
    if (chunk.length < 100 && chunks.length > 0) {
      // Append small chunks to the previous chunk
      chunks[chunks.length - 1] += ' ' + chunk;
    } else if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
  }
  
  return chunks;
};

const getRemainingText = (originalText: string, importantSections: Array<{text: string}>): string => {
  let remainingText = originalText;
  
  // Remove important sections from the text to avoid duplication
  for (const section of importantSections) {
    const sectionStart = remainingText.indexOf(section.text.substring(0, 100));
    if (sectionStart !== -1) {
      remainingText = remainingText.slice(0, sectionStart) + remainingText.slice(sectionStart + section.text.length);
    }
  }
  
  return remainingText;
};

const deduplicateChunks = (chunks: string[]): string[] => {
  const uniqueChunks: string[] = [];
  const seenContent = new Set<string>();
  
  for (const chunk of chunks) {
    const fingerprint = chunk.slice(0, 200).toLowerCase().replace(/\s+/g, ' ');
    
    if (!seenContent.has(fingerprint)) {
      seenContent.add(fingerprint);
      uniqueChunks.push(chunk);
    }
  }
  
  return uniqueChunks;
};

const scoreChunkRelevance = (chunks: string[]): string[] => {
  const transitionKeywords = [
    'net zero', 'carbon neutral', 'emissions reduction', 'climate strategy',
    'science based', 'SBTi', 'governance', 'oversight', 'progress report',
    'verification', 'compensation', 'implementation', 'transition plan',
    'sustainability', 'decarbonization', 'scope 1', 'scope 2', 'scope 3'
  ];
  
  const scoredChunks = chunks.map(chunk => {
    let score = 0;
    const chunkLower = chunk.toLowerCase();
    
    // Count keyword occurrences
    for (const keyword of transitionKeywords) {
      const matches = (chunkLower.match(new RegExp(keyword, 'g')) || []).length;
      score += matches * 2;
    }
    
    // Boost chunks with numbers/percentages (likely contain targets)
    const numberMatches = (chunk.match(/\d+%|\d+\s*(tonne|ton|MW|GW|year|20\d{2})/g) || []).length;
    score += numberMatches;
    
    // Boost chunks with governance terms
    const governanceTerms = ['board', 'committee', 'executive', 'management', 'director'];
    for (const term of governanceTerms) {
      if (chunkLower.includes(term)) score += 1;
    }
    
    return { chunk, score };
  });
  
  // Sort by relevance score (descending) and return chunks
  return scoredChunks
    .sort((a, b) => b.score - a.score)
    .map(item => item.chunk);
};
