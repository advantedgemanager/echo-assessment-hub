
export interface QuestionEvaluation {
  questionId: string;
  questionText: string;
  response: 'Yes' | 'No' | 'Not enough information';
  score: number;
  weight: number;
}

const API_TIMEOUT = 90000; // Increased to 90 seconds
const MAX_RETRIES = 3; // Reduced for faster processing
const RATE_LIMIT_DELAY = 2000; // Increased delay between requests
const MAX_CONCURRENT_REQUESTS = 2; // Reduced concurrent requests

// Enhanced delay function with jitter
const delay = (ms: number) => new Promise(resolve => 
  setTimeout(resolve, ms + Math.random() * 1000)
);

// Improved exponential backoff
const getBackoffDelay = (attempt: number, isRateLimit: boolean = false) => {
  const baseDelay = isRateLimit ? 5000 : 2000;
  return Math.min(baseDelay * Math.pow(2, attempt), 30000);
};

// Enhanced document section detection
const findRelevantContent = (chunk: string, questionText: string): string => {
  const keywords = extractKeywords(questionText);
  const sentences = chunk.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Find sentences that contain relevant keywords
  const relevantSentences = sentences.filter(sentence => 
    keywords.some(keyword => 
      sentence.toLowerCase().includes(keyword.toLowerCase())
    )
  );
  
  if (relevantSentences.length > 0) {
    return relevantSentences.slice(0, 3).join('. ') + '.';
  }
  
  return chunk.substring(0, 1500); // Fallback to chunk beginning
};

const extractKeywords = (questionText: string): string[] => {
  const keywordMap: { [key: string]: string[] } = {
    'net-zero': ['net zero', 'carbon neutral', 'emissions', 'climate', 'carbon'],
    'science-based': ['science based', 'SBT', 'targets', 'scientific'],
    'greenhouse gas': ['GHG', 'greenhouse gas', 'emissions', 'carbon dioxide', 'CO2'],
    'governance': ['governance', 'oversight', 'board', 'management', 'leadership'],
    'progress': ['progress', 'reporting', 'monitoring', 'tracking', 'measurement'],
    'compensation': ['compensation', 'incentives', 'executive', 'pay', 'bonus'],
    'milestones': ['milestones', 'interim', 'targets', 'goals', 'objectives'],
    'verification': ['verification', 'third party', 'audit', 'validation', 'assurance'],
    'strategy': ['strategy', 'plan', 'approach', 'methodology', 'framework'],
    'implementation': ['implementation', 'action', 'execution', 'deployment'],
    'resources': ['resources', 'budget', 'funding', 'investment', 'capital'],
    'partnerships': ['partnerships', 'collaboration', 'alliance', 'cooperation']
  };
  
  const question = questionText.toLowerCase();
  const keywords: string[] = [];
  
  for (const [category, words] of Object.entries(keywordMap)) {
    if (words.some(word => question.includes(word))) {
      keywords.push(...words);
    }
  }
  
  return keywords.length > 0 ? keywords : ['transition', 'plan', 'climate', 'sustainability'];
};

export const evaluateQuestionAgainstChunks = async (
  question: any,
  documentChunks: string[],
  mistralApiKey: string
): Promise<QuestionEvaluation> => {
  let bestResponse: 'Yes' | 'No' | 'Not enough information' = 'Not enough information';
  let successfulCalls = 0;
  let hasPositiveEvidence = false;
  const maxChunksToProcess = Math.min(documentChunks.length, 8); // Increased chunk processing
  
  console.log(`Evaluating question ${question.id} against ${maxChunksToProcess} chunks`);
  
  // Process chunks with enhanced strategy
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
        
        // Enhanced system prompt for better evaluation
        const systemPrompt = `You are an expert transition plan evaluator. Your task is to carefully analyze document excerpts and determine if they provide evidence for specific transition plan criteria.

EVALUATION RULES:
1. Answer "Yes" ONLY if you find clear, explicit evidence in the text that directly addresses the question
2. Answer "No" if the question is clearly not addressed or contradicted by the text
3. Answer "Not enough information" if the text is unclear, insufficient, or doesn't contain relevant information

Be thorough in your analysis. Look for:
- Direct statements that answer the question
- Implicit evidence that strongly suggests the answer
- Specific details, numbers, or commitments mentioned
- Strategic frameworks or methodologies referenced

Focus on finding positive evidence where it exists, but maintain accuracy.`;

        const userPrompt = `QUESTION: ${question.text}

DOCUMENT EXCERPT:
${relevantContent}

Based on this excerpt, does the document provide evidence to answer "Yes" to this question? Respond with exactly one word: "Yes", "No", or "Not enough information".`;

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
            temperature: 0.1 // Slightly more deterministic
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
        
        // Enhanced response normalization
        let normalizedResponse: 'Yes' | 'No' | 'Not enough information' = 'Not enough information';
        const responseLower = aiResponse.toLowerCase();
        
        if (responseLower === 'yes' || responseLower.startsWith('yes')) {
          normalizedResponse = 'Yes';
          hasPositiveEvidence = true;
        } else if (responseLower === 'no' || responseLower.startsWith('no')) {
          normalizedResponse = 'No';
        }
        
        console.log(`Chunk ${i + 1} response for question ${question.id}: ${normalizedResponse}`);
        
        // Enhanced response prioritization - if we find positive evidence, that takes precedence
        if (normalizedResponse === 'Yes') {
          bestResponse = 'Yes';
          // Continue to gather more evidence but we have a positive result
        } else if (normalizedResponse === 'No' && bestResponse !== 'Yes') {
          bestResponse = 'No';
        }
        
        // Break out of retry loop on success
        break;
        
      } catch (error) {
        lastError = error as Error;
        console.error(`Error processing chunk ${i + 1} for question ${question.id} (retry ${retry + 1}):`, error.message);
        
        if (error.message.includes('429') || error.message.includes('Rate limit')) {
          isRateLimit = true;
          await delay(8000 + (retry * 5000)); // Longer delay for rate limits
        }
        
        if (error.name === 'AbortError') {
          console.warn(`Timeout processing chunk ${i + 1} for question ${question.id}`);
          await delay(3000);
        }
      }
    }
    
    // If we have positive evidence, we can be more confident in our assessment
    if (hasPositiveEvidence && successfulCalls >= 2) {
      break; // We have enough evidence
    }
  }
  
  // Enhanced scoring logic with better handling of evidence
  let questionScore = 0;
  if (bestResponse === 'Yes') {
    questionScore = question.weight || 1;
  } else if (bestResponse === 'No') {
    questionScore = 0;
  } else {
    // More generous scoring for "Not enough information" when we had successful API calls
    const infoScore = successfulCalls > 2 ? 0.4 : 0.2;
    questionScore = (question.weight || 1) * infoScore;
  }
  
  console.log(`Question ${question.id} final result: ${bestResponse} (score: ${questionScore}/${question.weight || 1}, successful calls: ${successfulCalls}, positive evidence: ${hasPositiveEvidence})`);
  
  return {
    questionId: question.id,
    questionText: question.text,
    response: bestResponse,
    score: questionScore,
    weight: question.weight || 1
  };
};
