
export interface QuestionEvaluation {
  questionId: string;
  questionText: string;
  response: 'Yes' | 'No' | 'Not enough information';
  score: number;
  weight: number;
}

const API_TIMEOUT = 120000; // Increased to 2 minutes for better reliability
const MAX_RETRIES = 2; // Optimized retry count
const RATE_LIMIT_DELAY = 3000; // Increased delay between requests
const MAX_CONCURRENT_REQUESTS = 1; // Sequential processing for reliability

// Enhanced delay function with jitter
const delay = (ms: number) => new Promise(resolve => 
  setTimeout(resolve, ms + Math.random() * 1000)
);

// Improved exponential backoff
const getBackoffDelay = (attempt: number, isRateLimit: boolean = false) => {
  const baseDelay = isRateLimit ? 8000 : 3000;
  return Math.min(baseDelay * Math.pow(1.5, attempt), 45000);
};

// Enhanced transition plan content detection
const findRelevantContent = (chunk: string, questionText: string): string => {
  const keywords = extractTransitionKeywords(questionText);
  const sentences = chunk.split(/[.!?]+/).filter(s => s.trim().length > 15);
  
  // Find sentences that contain relevant keywords
  const relevantSentences = sentences.filter(sentence => 
    keywords.some(keyword => 
      sentence.toLowerCase().includes(keyword.toLowerCase())
    )
  );
  
  if (relevantSentences.length > 0) {
    // Prioritize sentences with multiple keyword matches
    const scoredSentences = relevantSentences.map(sentence => {
      const score = keywords.reduce((count, keyword) => 
        count + (sentence.toLowerCase().includes(keyword.toLowerCase()) ? 1 : 0), 0
      );
      return { sentence, score };
    });
    
    scoredSentences.sort((a, b) => b.score - a.score);
    return scoredSentences.slice(0, 4).map(s => s.sentence).join('. ') + '.';
  }
  
  return chunk.substring(0, 2000); // Increased fallback chunk size
};

const extractTransitionKeywords = (questionText: string): string[] => {
  const enhancedKeywordMap: { [key: string]: string[] } = {
    'net-zero': ['net zero', 'carbon neutral', 'emissions reduction', 'climate neutral', 'carbon neutrality'],
    'science-based': ['science based', 'SBT', 'SBTi', 'scientific targets', 'evidence-based'],
    'greenhouse gas': ['GHG', 'greenhouse gas', 'emissions', 'carbon dioxide', 'CO2', 'methane', 'scope 1', 'scope 2', 'scope 3'],
    'governance': ['governance', 'oversight', 'board oversight', 'management', 'leadership', 'corporate governance'],
    'progress': ['progress reporting', 'monitoring', 'tracking', 'measurement', 'KPIs', 'metrics'],
    'compensation': ['executive compensation', 'incentives', 'pay', 'bonus', 'remuneration'],
    'milestones': ['milestones', 'interim targets', 'short-term', 'medium-term', 'long-term', 'roadmap'],
    'verification': ['third party verification', 'audit', 'validation', 'assurance', 'independent review'],
    'strategy': ['transition strategy', 'climate strategy', 'sustainability strategy', 'decarbonization'],
    'implementation': ['implementation plan', 'action plan', 'execution', 'deployment'],
    'resources': ['financial resources', 'budget', 'funding', 'investment', 'capital allocation'],
    'partnerships': ['partnerships', 'collaboration', 'alliance', 'cooperation', 'stakeholder engagement'],
    'renewable': ['renewable energy', 'clean energy', 'solar', 'wind', 'green energy'],
    'efficiency': ['energy efficiency', 'operational efficiency', 'process improvement'],
    'supply chain': ['supply chain', 'value chain', 'suppliers', 'procurement'],
    'technology': ['technology roadmap', 'innovation', 'R&D', 'clean technology']
  };
  
  const question = questionText.toLowerCase();
  const keywords: string[] = [];
  
  for (const [category, words] of Object.entries(enhancedKeywordMap)) {
    if (words.some(word => question.includes(word))) {
      keywords.push(...words);
    }
  }
  
  return keywords.length > 0 ? keywords : ['transition', 'plan', 'climate', 'sustainability', 'environmental'];
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
  const maxChunksToProcess = Math.min(documentChunks.length, 6); // Optimized chunk processing
  
  console.log(`Evaluating question ${question.id} against ${maxChunksToProcess} chunks`);
  
  // Process chunks with enhanced strategy focusing on quality over quantity
  for (let i = 0; i < maxChunksToProcess; i++) {
    const chunk = documentChunks[i];
    const relevantContent = findRelevantContent(chunk, question.text);
    
    if (i > 0) {
      await delay(RATE_LIMIT_DELAY);
    }
    
    let lastError: Error | null = null;
    let isRateLimit = false;
    
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        if (retry > 0) {
          const backoffDelay = getBackoffDelay(retry, isRateLimit);
          console.log(`Retrying chunk ${i + 1} for question ${question.id} (attempt ${retry + 1}) after ${backoffDelay}ms`);
          await delay(backoffDelay);
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        
        // Enhanced system prompt specifically for transition plan evaluation
        const systemPrompt = `You are an expert transition plan evaluator specializing in corporate climate transition plans, net-zero commitments, and sustainability reporting. Your task is to carefully analyze document excerpts and determine if they provide evidence for specific transition plan criteria.

EVALUATION FRAMEWORK:
1. Answer "Yes" ONLY if you find explicit, clear evidence in the text that directly addresses the question
2. Answer "No" if the question is clearly not addressed, contradicted, or if the document explicitly states the opposite
3. Answer "Not enough information" if the text is unclear, insufficient, or ambiguous

WHAT TO LOOK FOR:
- Specific commitments, targets, and timelines
- Concrete actions and implementation plans
- Governance structures and accountability mechanisms
- Measurement and reporting frameworks
- Resource allocation and funding details
- Third-party verification or assurance
- Science-based methodologies and standards

TRANSITION PLAN CONTEXT:
Focus on evidence related to:
- Net-zero or carbon neutrality commitments
- Science-based targets (SBTi alignment)
- Greenhouse gas emissions (Scope 1, 2, 3)
- Governance and oversight structures
- Progress monitoring and reporting
- Executive compensation linkage to climate performance
- Implementation roadmaps and milestones
- Financial planning and resource allocation

Be thorough but precise. Look for substance over declarations.`;

        const userPrompt = `QUESTION: ${question.text}

DOCUMENT EXCERPT:
${relevantContent}

Based on this excerpt from a corporate transition plan or sustainability document, does the text provide clear evidence to answer "Yes" to this question? 

Consider:
- Are there specific details, commitments, or frameworks mentioned?
- Does the content directly address what the question is asking about?
- Is there measurable or concrete information provided?

Respond with exactly one word: "Yes", "No", or "Not enough information".`;

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mistralApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'mistral-large-latest',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 10,
            temperature: 0.1 // More deterministic for consistency
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
        
        // Enhanced response normalization and tracking
        let normalizedResponse: 'Yes' | 'No' | 'Not enough information' = 'Not enough information';
        const responseLower = aiResponse.toLowerCase();
        
        if (responseLower === 'yes' || responseLower.startsWith('yes')) {
          normalizedResponse = 'Yes';
          hasPositiveEvidence = true;
        } else if (responseLower === 'no' || responseLower.startsWith('no')) {
          normalizedResponse = 'No';
          hasNegativeEvidence = true;
        }
        
        console.log(`Chunk ${i + 1} response for question ${question.id}: ${normalizedResponse}`);
        
        // Enhanced response prioritization with evidence weighting
        if (normalizedResponse === 'Yes') {
          bestResponse = 'Yes';
          // Found positive evidence, continue to gather more but this is strong
        } else if (normalizedResponse === 'No' && bestResponse !== 'Yes') {
          if (bestResponse === 'Not enough information' || hasNegativeEvidence) {
            bestResponse = 'No';
          }
        }
        
        // Early termination if we have strong positive evidence from multiple chunks
        if (hasPositiveEvidence && successfulCalls >= 3) {
          console.log(`Early termination: Found positive evidence in ${successfulCalls} chunks`);
          break;
        }
        
        // Break out of retry loop on success
        break;
        
      } catch (error) {
        lastError = error as Error;
        console.error(`Error processing chunk ${i + 1} for question ${question.id} (retry ${retry + 1}):`, error.message);
        
        if (error.message.includes('429') || error.message.includes('Rate limit')) {
          isRateLimit = true;
          await delay(12000 + (retry * 8000)); // Longer delay for rate limits
        }
        
        if (error.name === 'AbortError') {
          console.warn(`Timeout processing chunk ${i + 1} for question ${question.id}`);
          await delay(5000);
        }
      }
    }
    
    // If we have clear positive evidence, we can be confident
    if (hasPositiveEvidence && successfulCalls >= 2) {
      break;
    }
  }
  
  // Enhanced scoring logic with better evidence weighting
  let questionScore = 0;
  if (bestResponse === 'Yes') {
    questionScore = question.weight || 1;
  } else if (bestResponse === 'No') {
    questionScore = 0;
  } else {
    // More nuanced scoring for "Not enough information" based on API success
    const infoScore = successfulCalls >= 3 ? 0.3 : (successfulCalls >= 1 ? 0.2 : 0.1);
    questionScore = (question.weight || 1) * infoScore;
  }
  
  console.log(`Question ${question.id} final result: ${bestResponse} (score: ${questionScore}/${question.weight || 1}, successful calls: ${successfulCalls}, positive evidence: ${hasPositiveEvidence}, negative evidence: ${hasNegativeEvidence})`);
  
  return {
    questionId: question.id,
    questionText: question.text,
    response: bestResponse,
    score: questionScore,
    weight: question.weight || 1
  };
};
