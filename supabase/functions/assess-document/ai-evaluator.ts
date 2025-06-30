
export interface QuestionEvaluation {
  questionId: string;
  questionText: string;
  response: 'Yes' | 'No' | 'Not enough information';
  score: number;
  weight: number;
}

const API_TIMEOUT = 300000; // Increased to 5 minutes (300 seconds)
const MAX_RETRIES = 3; // Increased retries
const RATE_LIMIT_DELAY = 2000; // Reduced delay for better throughput
const MAX_CONCURRENT_REQUESTS = 1; // Sequential processing

// Enhanced delay function with jitter
const delay = (ms: number) => new Promise(resolve => 
  setTimeout(resolve, ms + Math.random() * 500)
);

// Improved exponential backoff
const getBackoffDelay = (attempt: number, isRateLimit: boolean = false) => {
  const baseDelay = isRateLimit ? 10000 : 2000;
  return Math.min(baseDelay * Math.pow(2, attempt), 60000);
};

// Enhanced transition plan content detection with better keyword extraction
const findRelevantContent = (chunk: string, questionText: string): string => {
  const keywords = extractEnhancedTransitionKeywords(questionText);
  const sentences = chunk.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  // Enhanced sentence scoring with context awareness
  const scoredSentences = sentences.map(sentence => {
    let score = 0;
    const sentenceLower = sentence.toLowerCase();
    
    // Direct keyword matches
    keywords.forEach(keyword => {
      if (sentenceLower.includes(keyword.toLowerCase())) {
        score += 2;
      }
    });
    
    // Context-aware scoring for transition plan elements
    const transitionPatterns = [
      /net.{0,5}zero/i,
      /carbon.{0,5}neutral/i,
      /emission.{0,10}reduction/i,
      /climate.{0,10}target/i,
      /science.{0,5}based/i,
      /transition.{0,10}plan/i,
      /sustainability.{0,10}strategy/i,
      /decarboni[sz]ation/i,
      /scope\s*[123]/i,
      /ghg\s*emission/i,
      /renewable.{0,10}energy/i,
      /governance.{0,10}structure/i,
      /board.{0,10}oversight/i,
      /progress.{0,10}report/i,
      /third.{0,5}party.{0,5}verification/i,
      /executive.{0,10}compensation/i,
      /climate.{0,10}performance/i
    ];
    
    transitionPatterns.forEach(pattern => {
      if (pattern.test(sentence)) {
        score += 3;
      }
    });
    
    // Boost score for sentences with numbers/percentages (often indicate targets)
    if (/\d+%|\d+\s*(tonne|ton|kg|kilogram|MW|GW|TWh|year|by\s*20\d{2})/i.test(sentence)) {
      score += 1;
    }
    
    return { sentence, score, length: sentence.length };
  });
  
  // Sort by relevance score and select best content
  scoredSentences.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.length - a.length; // Prefer longer sentences if scores are equal
  });
  
  const selectedSentences = scoredSentences.slice(0, 6).filter(s => s.score > 0);
  
  if (selectedSentences.length > 0) {
    return selectedSentences.map(s => s.sentence.trim()).join('. ') + '.';
  }
  
  // Enhanced fallback: return chunk around potential keywords
  const keywordIndex = keywords.findIndex(keyword => 
    chunk.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (keywordIndex !== -1) {
    const keyword = keywords[keywordIndex];
    const keywordPos = chunk.toLowerCase().indexOf(keyword.toLowerCase());
    const start = Math.max(0, keywordPos - 1000);
    const end = Math.min(chunk.length, keywordPos + 2000);
    return chunk.substring(start, end);
  }
  
  return chunk.substring(0, 2500); // Increased fallback size
};

const extractEnhancedTransitionKeywords = (questionText: string): string[] => {
  const enhancedKeywordMap: { [key: string]: string[] } = {
    'net-zero': ['net zero', 'net-zero', 'carbon neutral', 'carbon neutrality', 'emissions reduction', 'climate neutral'],
    'science-based': ['science based', 'science-based', 'SBT', 'SBTi', 'scientific targets', 'evidence-based', 'paris agreement'],
    'greenhouse gas': ['GHG', 'greenhouse gas', 'emissions', 'carbon dioxide', 'CO2', 'methane', 'scope 1', 'scope 2', 'scope 3', 'carbon footprint'],
    'governance': ['governance', 'oversight', 'board oversight', 'management', 'leadership', 'corporate governance', 'stewardship'],
    'progress': ['progress reporting', 'monitoring', 'tracking', 'measurement', 'KPIs', 'metrics', 'performance indicators'],
    'compensation': ['executive compensation', 'incentives', 'pay', 'bonus', 'remuneration', 'performance-linked pay'],
    'milestones': ['milestones', 'interim targets', 'short-term', 'medium-term', 'long-term', 'roadmap', 'timeline'],
    'verification': ['third party verification', 'third-party verification', 'audit', 'validation', 'assurance', 'independent review', 'external verification'],
    'strategy': ['transition strategy', 'climate strategy', 'sustainability strategy', 'decarbonization', 'decarbonisation'],
    'implementation': ['implementation plan', 'action plan', 'execution', 'deployment', 'operationalization'],
    'resources': ['financial resources', 'budget', 'funding', 'investment', 'capital allocation', 'CAPEX', 'capital expenditure'],
    'partnerships': ['partnerships', 'collaboration', 'alliance', 'cooperation', 'stakeholder engagement', 'joint ventures'],
    'renewable': ['renewable energy', 'clean energy', 'solar', 'wind', 'green energy', 'sustainable energy'],
    'efficiency': ['energy efficiency', 'operational efficiency', 'process improvement', 'optimization'],
    'supply chain': ['supply chain', 'value chain', 'suppliers', 'procurement', 'vendor management'],
    'technology': ['technology roadmap', 'innovation', 'R&D', 'clean technology', 'green technology'],
    'disclosure': ['disclosure', 'transparency', 'reporting', 'publication', 'communication'],
    'baseline': ['baseline', 'starting point', 'current state', 'benchmark', 'reference point'],
    'scenario': ['scenario analysis', 'climate scenarios', 'stress testing', 'pathway analysis']
  };
  
  const question = questionText.toLowerCase();
  const keywords: string[] = [];
  
  for (const [category, words] of Object.entries(enhancedKeywordMap)) {
    if (words.some(word => question.includes(word))) {
      keywords.push(...words);
    }
  }
  
  // Add specific keywords from the question text
  const questionWords = question.split(/\s+/).filter(word => word.length > 3);
  keywords.push(...questionWords);
  
  return [...new Set(keywords)]; // Remove duplicates
};

export const evaluateQuestionAgainstChunks = async (
  question: any,
  documentChunks: string[],
  mistralApiKey: string
): Promise<QuestionEvaluation> => {
  let bestResponse: 'Yes' | 'No' | 'Not enough information' = 'Not enough information';
  let successfulCalls = 0;
  let hasPositiveEvidence = false;
  let hasNegativeEvidence = false;
  let confidenceScore = 0;
  
  const maxChunksToProcess = Math.min(documentChunks.length, 8); // Increased chunk processing
  
  console.log(`🔍 Evaluating question ${question.id} against ${maxChunksToProcess} chunks`);
  console.log(`Question: ${question.text.substring(0, 100)}...`);
  
  // Process chunks with enhanced strategy
  for (let i = 0; i < maxChunksToProcess; i++) {
    const chunk = documentChunks[i];
    const relevantContent = findRelevantContent(chunk, question.text);
    
    console.log(`Processing chunk ${i + 1}/${maxChunksToProcess} for question ${question.id}`);
    console.log(`Relevant content length: ${relevantContent.length} chars`);
    
    if (i > 0) {
      await delay(RATE_LIMIT_DELAY);
    }
    
    let lastError: Error | null = null;
    let isRateLimit = false;
    
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        if (retry > 0) {
          const backoffDelay = getBackoffDelay(retry, isRateLimit);
          console.log(`⏳ Retrying chunk ${i + 1} for question ${question.id} (attempt ${retry + 1}) after ${backoffDelay}ms`);
          await delay(backoffDelay);
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        
        // Enhanced system prompt with better instructions
        const systemPrompt = `You are an expert transition plan evaluator specializing in corporate climate transition plans, net-zero commitments, and sustainability reporting. Your role is to analyze document excerpts and determine if they provide evidence for specific transition plan criteria.

CRITICAL EVALUATION RULES:
1. Answer "Yes" ONLY if you find explicit, clear, and specific evidence that directly addresses the question
2. Answer "No" if the document clearly contradicts the question or explicitly states the opposite
3. Answer "Not enough information" if the content is vague, insufficient, or doesn't directly address the question

WHAT CONSTITUTES STRONG EVIDENCE:
- Specific commitments with dates, targets, or percentages
- Concrete actions and implementation details
- Clear governance structures and responsibility assignments
- Detailed measurement frameworks and reporting mechanisms
- Explicit resource allocation and funding commitments
- Third-party verification or assurance statements
- Science-based methodologies and standards compliance

TRANSITION PLAN FOCUS AREAS:
- Net-zero commitments and carbon neutrality goals
- Science-based targets (SBTi) and Paris Agreement alignment
- Comprehensive GHG emissions disclosure (Scope 1, 2, 3)
- Board-level governance and oversight mechanisms
- Regular progress monitoring and transparent reporting
- Executive compensation linked to climate performance
- Detailed implementation roadmaps and milestones
- Financial planning and capital expenditure allocation
- Third-party verification and independent assurance

ANALYSIS APPROACH:
- Look for substance over declarations
- Prioritize quantitative data and specific commitments
- Consider the comprehensiveness and detail level
- Evaluate the credibility and verifiability of claims`;

        const userPrompt = `EVALUATION TASK:
Question: "${question.text}"

Document Content:
${relevantContent}

ANALYSIS REQUIRED:
Based on this document excerpt, evaluate whether there is clear and specific evidence to support a "Yes" answer to the question.

Consider:
1. Does the content directly address the specific aspect asked about in the question?
2. Are there concrete details, commitments, frameworks, or data provided?
3. Is the information specific and measurable rather than vague statements?
4. Would this evidence satisfy a rigorous external auditor or validator?

RESPONSE FORMAT:
Respond with exactly one word: "Yes", "No", or "Not enough information"

Think carefully - only answer "Yes" if the evidence is clear and specific.`;

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mistralApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'mistral-small-2312', // Updated to Mistral Small 3.1
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 20,
            temperature: 0.0 // Reduced temperature to 0.0 for maximum consistency
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          isRateLimit = true;
          throw new Error('Rate limit exceeded');
        }

        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error('Invalid API response structure');
        }
        
        const aiResponse = data.choices[0].message.content?.trim() || 'Not enough information';
        successfulCalls++;
        
        // Enhanced response processing
        let normalizedResponse: 'Yes' | 'No' | 'Not enough information' = 'Not enough information';
        const responseLower = aiResponse.toLowerCase();
        
        if (responseLower === 'yes' || responseLower.startsWith('yes')) {
          normalizedResponse = 'Yes';
          hasPositiveEvidence = true;
          confidenceScore += 3;
        } else if (responseLower === 'no' || responseLower.startsWith('no')) {
          normalizedResponse = 'No';
          hasNegativeEvidence = true;
          confidenceScore += 1;
        } else {
          confidenceScore += 0.5;
        }
        
        console.log(`✅ Chunk ${i + 1} response for question ${question.id}: ${normalizedResponse}`);
        
        // Enhanced response prioritization
        if (normalizedResponse === 'Yes') {
          bestResponse = 'Yes';
        } else if (normalizedResponse === 'No' && bestResponse !== 'Yes') {
          if (bestResponse === 'Not enough information' || !hasPositiveEvidence) {
            bestResponse = 'No';
          }
        }
        
        // Early termination with higher confidence threshold
        if (hasPositiveEvidence && successfulCalls >= 4 && confidenceScore >= 10) {
          console.log(`🎯 Early termination: Strong positive evidence found (confidence: ${confidenceScore})`);
          break;
        }
        
        break; // Break out of retry loop on success
        
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Error processing chunk ${i + 1} for question ${question.id} (retry ${retry + 1}):`, error.message);
        
        if (error.message.includes('429') || error.message.includes('Rate limit')) {
          isRateLimit = true;
        }
        
        if (error.name === 'AbortError') {
          console.warn(`⏰ Timeout processing chunk ${i + 1} for question ${question.id}`);
        }
      }
    }
    
    // Break if we have strong evidence
    if (hasPositiveEvidence && successfulCalls >= 3 && confidenceScore >= 8) {
      break;
    }
  }
  
  // Enhanced scoring with confidence weighting
  let questionScore = 0;
  if (bestResponse === 'Yes') {
    questionScore = question.weight || 1;
  } else if (bestResponse === 'No') {
    questionScore = 0;
  } else {
    // Improved scoring for insufficient information based on success rate and confidence
    const infoMultiplier = Math.min(0.4, (successfulCalls / maxChunksToProcess) * 0.4 + (confidenceScore / 20) * 0.2);
    questionScore = (question.weight || 1) * infoMultiplier;
  }
  
  console.log(`📊 Question ${question.id} final result: ${bestResponse} (score: ${questionScore}/${question.weight || 1}, calls: ${successfulCalls}, confidence: ${confidenceScore})`);
  
  return {
    questionId: question.id,
    questionText: question.text,
    response: bestResponse,
    score: questionScore,
    weight: question.weight || 1
  };
};
