
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
  questionnaireData: any,
  documentChunks: string[],
  mistralApiKey: string,
  checkTimeout?: () => void
): Promise<AssessmentResults> => {
  console.log('Raw questionnaire data received:', JSON.stringify(questionnaireData, null, 2));
  
  // Extract the actual questionnaire from the nested structure
  let questionnaire = questionnaireData;
  
  try {
    // Handle the nested structure from questionnaire-manager
    if (questionnaireData.questionnaire) {
      questionnaire = questionnaireData.questionnaire;
      console.log('Found nested questionnaire structure');
    }
    
    // Handle transition_plan_questionnaire structure
    if (questionnaire.transition_plan_questionnaire) {
      questionnaire = questionnaire.transition_plan_questionnaire;
      console.log('Found transition_plan_questionnaire structure');
    }
    
    console.log('Final questionnaire structure keys:', Object.keys(questionnaire));
    
    // Look for sections in different possible locations
    let sections = null;
    if (questionnaire.sections && Array.isArray(questionnaire.sections)) {
      sections = questionnaire.sections;
      console.log('Found sections array directly');
    } else if (questionnaire.basic_assessment_sections) {
      // Convert object format to array format
      sections = Object.keys(questionnaire.basic_assessment_sections).map(key => {
        const section = questionnaire.basic_assessment_sections[key];
        return {
          id: key,
          title: section.title || key,
          questions: section.questions || []
        };
      });
      console.log('Converted basic_assessment_sections to array format');
    } else {
      // Fallback: look for any property that might contain sections
      for (const [key, value] of Object.entries(questionnaire)) {
        if (Array.isArray(value) && value.length > 0 && value[0].questions) {
          sections = value;
          console.log(`Found sections in property: ${key}`);
          break;
        }
      }
    }
    
    if (!sections || !Array.isArray(sections)) {
      console.error('No valid sections found. Available keys:', Object.keys(questionnaire));
      throw new Error('Invalid questionnaire format: no sections found');
    }
    
    console.log(`Processing ${sections.length} sections`);
    
    const assessmentResults: SectionResult[] = [];
    let totalScore = 0;
    let maxPossibleScore = 0;
    let questionsProcessed = 0;
    const maxQuestionsToProcess = 50; // Limit total questions

    // Process each section with resource limits
    for (const section of sections) {
      if (checkTimeout) checkTimeout();
      
      console.log(`Processing section: ${section.title || section.id}`);
      
      if (!section.questions || !Array.isArray(section.questions)) {
        console.warn(`Section ${section.id} has no questions or questions is not an array`);
        continue;
      }
      
      const sectionResults: QuestionEvaluation[] = [];
      
      // Process each question in the section with limits
      for (const question of section.questions) {
        if (questionsProcessed >= maxQuestionsToProcess) {
          console.warn(`Reached maximum question limit (${maxQuestionsToProcess}), stopping processing`);
          break;
        }
        
        if (checkTimeout) checkTimeout();
        
        console.log(`Processing question ${questionsProcessed + 1}: ${question.id}`);
        
        try {
          const questionEvaluation = await evaluateQuestionAgainstChunks(
            question,
            documentChunks,
            mistralApiKey
          );
          
          totalScore += questionEvaluation.score;
          maxPossibleScore += questionEvaluation.weight;
          
          sectionResults.push(questionEvaluation);
          questionsProcessed++;
          
          console.log(`Question processed. Score: ${questionEvaluation.score}/${questionEvaluation.weight}`);
        } catch (questionError) {
          console.error(`Error processing question ${question.id}:`, questionError);
          // Continue with next question instead of failing entire assessment
          const fallbackEvaluation: QuestionEvaluation = {
            questionId: question.id,
            questionText: question.text,
            response: 'Not enough information',
            score: (question.weight || 1) * 0.5,
            weight: question.weight || 1
          };
          
          totalScore += fallbackEvaluation.score;
          maxPossibleScore += fallbackEvaluation.weight;
          sectionResults.push(fallbackEvaluation);
          questionsProcessed++;
        }
      }
      
      assessmentResults.push({
        sectionId: section.id,
        sectionTitle: section.title || section.id,
        questions: sectionResults
      });
      
      if (questionsProcessed >= maxQuestionsToProcess) {
        break;
      }
    }

    // Calculate final credibility score (0-100)
    const credibilityScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

    console.log(`Assessment completed: ${totalScore}/${maxPossibleScore} = ${credibilityScore}% (${questionsProcessed} questions processed)`);

    return {
      sections: assessmentResults,
      totalScore,
      maxPossibleScore,
      credibilityScore
    };
    
  } catch (error) {
    console.error('Error in processAssessment:', error);
    console.error('Questionnaire structure:', JSON.stringify(questionnaire, null, 2));
    throw error;
  }
};
