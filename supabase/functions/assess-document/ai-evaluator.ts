
export interface QuestionEvaluation {
  questionId: string;
  questionText: string;
  response: 'Yes' | 'No' | 'Not enough information';
  score: number;
  weight: number;
}

const API_TIMEOUT = 45000; // Increased to 45 seconds
const MAX_RETRIES = 3; // Increased retries
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests
const MAX_CONCURRENT_REQUESTS = 2; // Limit concurrent requests

// Simple delay function for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Exponential backoff for retries
const getBackoffDelay = (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 10000);

export const evaluateQuestionAgainstChunks = async (
  question: any,
  documentChunks: string[],
  mistralApiKey: string
): Promise<QuestionEvaluation> => {
  let bestResponse: 'Yes' | 'No' | 'Not enough information' = 'Not enough information';
  let successfulCalls = 0;
  const maxChunksToProcess = Math.min(documentChunks.length, 3); // Reduced chunks per question
  
  console.log(`Evaluating question ${question.id} against ${maxChunksToProcess} chunks`);
  
  // Process chunks sequentially to avoid rate limiting
  for (let i = 0; i < maxChunksToProcess; i++) {
    const chunk = documentChunks[i];
    
    // Add delay between requests to avoid rate limiting
    if (i > 0) {
      await delay(RATE_LIMIT_DELAY);
    }
    
    let lastError: Error | null = null;
    
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        // Exponential backoff for retries
        if (retry > 0) {
          const backoffDelay = getBackoffDelay(retry);
          console.log(`Retrying chunk ${i + 1} for question ${question.id} after ${backoffDelay}ms delay`);
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
                content: 'You are a transition plan evaluator. Your job is to read the transition plan and answer the following question with only one of these exact responses: "Yes", "No", or "Not enough information". Be strictly faithful to the document. Do not guess or invent scoring logic. Only respond with one of the three allowed answers.'
              },
              {
                role: 'user',
                content: `QUESTION: ${question.text}\n\nDOCUMENT EXCERPT: ${chunk.substring(0, 1200)}` // Reduced chunk size
              }
            ],
            max_tokens: 10,
            temperature: 0.1
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        }

        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error('Invalid API response structure');
        }
        
        const aiResponse = data.choices[0].message.content?.trim() || 'Not enough information';
        successfulCalls++;
        
        // Normalize response
        let normalizedResponse: 'Yes' | 'No' | 'Not enough information' = 'Not enough information';
        if (aiResponse.toLowerCase().includes('yes')) {
          normalizedResponse = 'Yes';
        } else if (aiResponse.toLowerCase().includes('no')) {
          normalizedResponse = 'No';
        }
        
        console.log(`Chunk ${i + 1} response: ${normalizedResponse}`);
        
        // If we get a "Yes" from any chunk, that's our best answer
        if (normalizedResponse === 'Yes') {
          bestResponse = 'Yes';
          break;
        } else if (normalizedResponse === 'No' && bestResponse === 'Not enough information') {
          bestResponse = 'No';
        }
        
        // Break out of retry loop on success
        break;
        
      } catch (error) {
        lastError = error as Error;
        console.error(`Error processing chunk ${i + 1} for question ${question.id} (retry ${retry + 1}):`, error);
        
        // If it's a rate limit error, wait longer before retrying
        if (error.message.includes('429') || error.message.includes('Rate limit')) {
          await delay(5000 + (retry * 2000)); // Longer delay for rate limits
        }
        
        // If it's an abort error (timeout), don't retry immediately
        if (error.name === 'AbortError') {
          await delay(1000);
        }
      }
    }
    
    // If we found a definitive answer, no need to check more chunks
    if (bestResponse === 'Yes') {
      break;
    }
    
    // If we've had too many failures, stop processing more chunks
    if (successfulCalls === 0 && i >= 1) {
      console.warn(`No successful API calls after processing ${i + 1} chunks, stopping`);
      break;
    }
  }
  
  // Convert response to score
  let questionScore = 0;
  if (bestResponse === 'Yes') {
    questionScore = question.weight || 1;
  } else if (bestResponse === 'No') {
    questionScore = 0;
  } else {
    questionScore = (question.weight || 1) * 0.5; // Half points for "Not enough information"
  }
  
  console.log(`Question ${question.id} final result: ${bestResponse} (score: ${questionScore}/${question.weight || 1})`);
  
  return {
    questionId: question.id,
    questionText: question.text,
    response: bestResponse,
    score: questionScore,
    weight: question.weight || 1
  };
};
