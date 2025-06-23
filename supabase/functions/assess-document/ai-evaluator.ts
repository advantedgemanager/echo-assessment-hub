
export interface QuestionEvaluation {
  questionId: string;
  questionText: string;
  response: 'Yes' | 'No' | 'Not enough information';
  score: number;
  weight: number;
}

const API_TIMEOUT = 60000; // Increased to 60 seconds
const MAX_RETRIES = 4; // Increased retries
const RATE_LIMIT_DELAY = 1500; // Reduced delay for better throughput
const MAX_CONCURRENT_REQUESTS = 3; // Increased concurrent requests

// Enhanced delay function with jitter to prevent thundering herd
const delay = (ms: number) => new Promise(resolve => 
  setTimeout(resolve, ms + Math.random() * 500)
);

// Improved exponential backoff with circuit breaker pattern
const getBackoffDelay = (attempt: number, isRateLimit: boolean = false) => {
  const baseDelay = isRateLimit ? 3000 : 1000;
  return Math.min(baseDelay * Math.pow(2, attempt), 15000);
};

export const evaluateQuestionAgainstChunks = async (
  question: any,
  documentChunks: string[],
  mistralApiKey: string
): Promise<QuestionEvaluation> => {
  let bestResponse: 'Yes' | 'No' | 'Not enough information' = 'Not enough information';
  let successfulCalls = 0;
  const maxChunksToProcess = Math.min(documentChunks.length, 5); // Increased chunk processing
  
  console.log(`Evaluating question ${question.id} against ${maxChunksToProcess} chunks`);
  
  // Process chunks with improved strategy
  for (let i = 0; i < maxChunksToProcess; i++) {
    const chunk = documentChunks[i];
    
    // Adaptive delay based on success rate
    if (i > 0) {
      const adaptiveDelay = successfulCalls > 0 ? RATE_LIMIT_DELAY / 2 : RATE_LIMIT_DELAY;
      await delay(adaptiveDelay);
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
        
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mistralApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'mistral-large-latest',
            messages: [
              {
                role: 'system',
                content: 'You are a transition plan evaluator. Analyze the document excerpt and answer the question with exactly one word: "Yes", "No", or "Not enough information". Be precise and evidence-based. Only answer "Yes" if there is clear evidence in the text that addresses the question. Answer "No" if the question is clearly not addressed or contradicted. Answer "Not enough information" if the text is unclear or insufficient.'
              },
              {
                role: 'user',
                content: `QUESTION: ${question.text}\n\nDOCUMENT EXCERPT: ${chunk.substring(0, 1500)}` // Increased chunk size
              }
            ],
            max_tokens: 15,
            temperature: 0.0 // More deterministic responses
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
        } else if (responseLower === 'no' || responseLower.startsWith('no')) {
          normalizedResponse = 'No';
        }
        
        console.log(`Chunk ${i + 1} response for question ${question.id}: ${normalizedResponse}`);
        
        // Improved response prioritization
        if (normalizedResponse === 'Yes') {
          bestResponse = 'Yes';
          // Continue processing to get more evidence
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
          await delay(5000 + (retry * 3000)); // Longer delay for rate limits
        }
        
        if (error.name === 'AbortError') {
          console.warn(`Timeout processing chunk ${i + 1} for question ${question.id}`);
          await delay(2000);
        }
      }
    }
    
    // Don't stop on individual chunk failures if we have some successes
    if (successfulCalls === 0 && i >= 2) {
      console.warn(`No successful API calls after processing ${i + 1} chunks for question ${question.id}`);
      break;
    }
  }
  
  // Enhanced scoring logic
  let questionScore = 0;
  if (bestResponse === 'Yes') {
    questionScore = question.weight || 1;
  } else if (bestResponse === 'No') {
    questionScore = 0;
  } else {
    // Reduce penalty for "Not enough information" when we had some successful calls
    const infoScore = successfulCalls > 0 ? 0.3 : 0.5;
    questionScore = (question.weight || 1) * infoScore;
  }
  
  console.log(`Question ${question.id} final result: ${bestResponse} (score: ${questionScore}/${question.weight || 1}, successful calls: ${successfulCalls})`);
  
  return {
    questionId: question.id,
    questionText: question.text,
    response: bestResponse,
    score: questionScore,
    weight: question.weight || 1
  };
};
