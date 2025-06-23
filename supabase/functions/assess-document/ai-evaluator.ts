
export interface QuestionEvaluation {
  questionId: string;
  questionText: string;
  response: 'Yes' | 'No' | 'Not enough information';
  score: number;
  weight: number;
}

export const evaluateQuestionAgainstChunks = async (
  question: any,
  documentChunks: string[],
  mistralApiKey: string
): Promise<QuestionEvaluation> => {
  let bestResponse: 'Yes' | 'No' | 'Not enough information' = 'Not enough information';
  
  // Evaluate question against each document chunk
  for (const chunk of documentChunks) {
    try {
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
              content: `QUESTION: ${question.text}\n\nDOCUMENT EXCERPT: ${chunk}`
            }
          ],
          max_tokens: 10,
          temperature: 0.1
        }),
      });

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content?.trim() || 'Not enough information';
      
      // Normalize response
      let normalizedResponse: 'Yes' | 'No' | 'Not enough information' = 'Not enough information';
      if (aiResponse.toLowerCase().includes('yes')) {
        normalizedResponse = 'Yes';
      } else if (aiResponse.toLowerCase().includes('no')) {
        normalizedResponse = 'No';
      }
      
      // If we get a "Yes" from any chunk, that's our best answer
      if (normalizedResponse === 'Yes') {
        bestResponse = 'Yes';
        break;
      } else if (normalizedResponse === 'No' && bestResponse === 'Not enough information') {
        bestResponse = 'No';
      }
      
    } catch (error) {
      console.error(`Error processing chunk for question ${question.id}:`, error);
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
  
  return {
    questionId: question.id,
    questionText: question.text,
    response: bestResponse,
    score: questionScore,
    weight: question.weight || 1
  };
};
