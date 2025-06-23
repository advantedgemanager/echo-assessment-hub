
export interface QuestionEvaluation {
  questionId: string;
  questionText: string;
  response: 'Yes' | 'No' | 'Not enough information';
  score: number;
  weight: number;
}

const API_TIMEOUT = 30000; // 30 seconds per API call
const MAX_RETRIES = 2;

export const evaluateQuestionAgainstChunks = async (
  question: any,
  documentChunks: string[],
  mistralApiKey: string
): Promise<QuestionEvaluation> => {
  let bestResponse: 'Yes' | 'No' | 'Not enough information' = 'Not enough information';
  let successfulCalls = 0;
  const maxChunksToProcess = Math.min(documentChunks.length, 5); // Limit chunks per question
  
  console.log(`Evaluating question ${question.id} against ${maxChunksToProcess} chunks`);
  
  // Evaluate question against a limited number of document chunks
  for (let i = 0; i < maxChunksToProcess; i++) {
    const chunk = documentChunks[i];
    
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
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
                content: `QUESTION: ${question.text}\n\nDOCUMENT EXCERPT: ${chunk.substring(0, 1500)}` // Limit chunk size
              }
            ],
            max_tokens: 10,
            temperature: 0.1
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

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
        console.error(`Error processing chunk ${i + 1} for question ${question.id} (retry ${retry + 1}):`, error);
        
        if (retry === MAX_RETRIES - 1) {
          console.warn(`Failed to process chunk ${i + 1} after ${MAX_RETRIES} retries`);
        }
        
        // If it's an abort error (timeout), don't retry
        if (error.name === 'AbortError') {
          break;
        }
      }
    }
    
    // If we found a definitive answer, no need to check more chunks
    if (bestResponse === 'Yes') {
      break;
    }
    
    // If we've had too many failures, stop processing more chunks
    if (successfulCalls === 0 && i >= 2) {
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
