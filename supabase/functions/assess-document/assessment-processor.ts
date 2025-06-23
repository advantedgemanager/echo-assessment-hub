
import { evaluateQuestionAgainstChunks, QuestionEvaluation } from './ai-evaluator.ts';

export interface SectionResult {
  sectionId: string;
  sectionTitle: string;
  questions: QuestionEvaluation[];
}

export interface AssessmentResults {
  sections: SectionResult[];
  totalScore: number;
  maxPossibleScore: number;
  credibilityScore: number;
}

export const processAssessment = async (
  questionnaire: any,
  documentChunks: string[],
  mistralApiKey: string
): Promise<AssessmentResults> => {
  const assessmentResults: SectionResult[] = [];
  let totalScore = 0;
  let maxPossibleScore = 0;

  // Process each section
  for (const section of questionnaire.sections) {
    console.log(`Processing section: ${section.title}`);
    
    const sectionResults: QuestionEvaluation[] = [];
    
    // Process each question in the section
    for (const question of section.questions) {
      console.log(`Processing question: ${question.id}`);
      
      const questionEvaluation = await evaluateQuestionAgainstChunks(
        question,
        documentChunks,
        mistralApiKey
      );
      
      totalScore += questionEvaluation.score;
      maxPossibleScore += questionEvaluation.weight;
      
      sectionResults.push(questionEvaluation);
    }
    
    assessmentResults.push({
      sectionId: section.id,
      sectionTitle: section.title,
      questions: sectionResults
    });
  }

  // Calculate final credibility score (0-100)
  const credibilityScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

  return {
    sections: assessmentResults,
    totalScore,
    maxPossibleScore,
    credibilityScore
  };
};
