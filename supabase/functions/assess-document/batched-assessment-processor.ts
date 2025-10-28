
import { evaluateQuestionAgainstChunks } from './ai-evaluator.ts';

interface Question {
  id: string;
  text?: string;
  question_text?: string;
  weight?: number;
  score_yes?: number;
  score_no?: number;
  score_na?: number;
}

interface Section {
  id: string;
  title: string;
  questions: Question[];
}

interface Questionnaire {
  sections: Section[];
}

// Helper function to normalize question format
const normalizeQuestion = (question: Question) => {
  return {
    id: question.id,
    text: question.text || question.question_text || '',
    weight: question.weight || question.score_yes || 1
  };
};

export const processBatchedAssessment = async (
  questionnaireData: any,
  documentChunks: string[],
  lovableApiKey: string,
  checkTimeout: () => void,
  documentWasTruncated: boolean = false,
  batchIndex: number = 0,
  batchSize: number = 20
) => {
  console.log(`=== Starting batched assessment processing v6.0 (batch ${batchIndex}) ===`);
  console.log(`Processing ${documentChunks.length} document chunks`);
  
  const questionnaire = questionnaireData.questionnaire as Questionnaire;
  const sections = questionnaire.sections;
  
  console.log(`Found ${sections.length} sections in questionnaire`);
  
  // Flatten all questions across sections
  const allQuestions: Array<{ question: any, sectionId: string, sectionTitle: string, questionIndex: number, sectionIndex: number }> = [];
  sections.forEach((section, sectionIndex) => {
    section.questions.forEach((question, questionIndex) => {
      allQuestions.push({ 
        question, 
        sectionId: section.id, 
        sectionTitle: section.title,
        questionIndex,
        sectionIndex
      });
    });
  });
  
  const totalQuestions = allQuestions.length;
  console.log(`Total questions in questionnaire: ${totalQuestions}`);
  
  // Calculate batch boundaries
  const startIndex = batchIndex * batchSize;
  const endIndex = Math.min(startIndex + batchSize, totalQuestions);
  const batchQuestions = allQuestions.slice(startIndex, endIndex);
  const totalBatches = Math.ceil(totalQuestions / batchSize);
  
  console.log(`Processing batch ${batchIndex + 1}/${totalBatches}: questions ${startIndex + 1}-${endIndex} of ${totalQuestions}`);
  
  if (batchQuestions.length === 0) {
    console.log('No questions in this batch');
    return {
      batchIndex,
      totalBatches,
      startIndex,
      endIndex,
      questionsInBatch: 0,
      totalQuestions,
      batchResults: [],
      completed: true
    };
  }
  
  const batchResults = [];
  let processedInBatch = 0;
  
  // Process each question in the batch
  for (const { question: rawQuestion, sectionId, sectionTitle, questionIndex, sectionIndex } of batchQuestions) {
    const globalIndex = startIndex + processedInBatch + 1;
    
    // Enhanced null/undefined checking
    if (!rawQuestion || !rawQuestion.id || (!rawQuestion.text && !rawQuestion.question_text)) {
      console.error(`❌ Invalid question at global index ${globalIndex}:`, rawQuestion);
      
      const fallbackResult = {
        questionId: rawQuestion?.id || `invalid_${globalIndex}`,
        questionText: rawQuestion?.text || rawQuestion?.question_text || 'Invalid question',
        response: 'Not enough information' as const,
        score: 0,
        weight: rawQuestion?.weight || rawQuestion?.score_yes || 1,
        sectionId,
        sectionTitle
      };
      
      batchResults.push(fallbackResult);
      processedInBatch++;
      continue;
    }
    
    const question = normalizeQuestion(rawQuestion);
    
    console.log(`\n🔍 Processing question ${globalIndex}/${totalQuestions} (Batch ${batchIndex + 1}, Question ${processedInBatch + 1}/${batchQuestions.length})`);
    console.log(`Section: ${sectionTitle}, Question ID: ${question.id}`);
    console.log(`Text: ${question.text.length > 100 ? question.text.substring(0, 100) + '...' : question.text}`);
    console.log(`Weight: ${question.weight}`);
    
    checkTimeout();
    
    try {
      const startTime = Date.now();
      console.log(`⏱️  Starting evaluation for question ${question.id} at ${new Date().toISOString()}`);
      
      // Evaluate question with timeout
      const questionResult = await Promise.race([
        evaluateQuestionAgainstChunks(question, documentChunks, lovableApiKey),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Question ${question.id} timeout`)), 3 * 60 * 1000)
        )
      ]);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Question ${question.id} completed in ${Math.round(processingTime/1000)}s`);
      console.log(`Result: ${questionResult.response}, Score: ${questionResult.score}/${questionResult.weight}`);
      
      batchResults.push({
        ...questionResult,
        sectionId,
        sectionTitle
      });
      
      processedInBatch++;
      console.log(`Batch progress: ${processedInBatch}/${batchQuestions.length} questions in batch, ${globalIndex}/${totalQuestions} overall (${Math.round((globalIndex/totalQuestions)*100)}%)`);
      
    } catch (error) {
      console.error(`❌ Error processing question ${question.id}:`, error);
      
      const fallbackResult = {
        questionId: question.id,
        questionText: question.text,
        response: 'Not enough information' as const,
        score: (question.weight || 1) * 0.2,
        weight: question.weight || 1,
        sectionId,
        sectionTitle
      };
      
      batchResults.push(fallbackResult);
      processedInBatch++;
      console.log(`⚠️  Used fallback result for question ${question.id}`);
    }
  }
  
  console.log(`=== Batch ${batchIndex + 1}/${totalBatches} completed ===`);
  console.log(`Processed ${processedInBatch} questions in this batch`);
  
  return {
    batchIndex,
    totalBatches,
    startIndex,
    endIndex,
    questionsInBatch: processedInBatch,
    totalQuestions,
    batchResults,
    completed: endIndex >= totalQuestions
  };
};
