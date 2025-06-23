
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
  mistralApiKey: string
): Promise<AssessmentResults> => {
  console.log('Raw questionnaire data received:', JSON.stringify(questionnaireData, null, 2));
  
  // Extract the actual questionnaire from the nested structure
  let questionnaire = questionnaireData;
  
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
  
  console.log('Final questionnaire structure:', JSON.stringify(questionnaire, null, 2));
  
  // Look for sections in different possible locations
  let sections = null;
  if (questionnaire.sections) {
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
    console.error('No sections found in questionnaire structure');
    throw new Error('Invalid questionnaire format: no sections found');
  }
  
  if (!sections || !Array.isArray(sections)) {
    console.error('Sections is not an array:', sections);
    throw new Error('Invalid questionnaire format: sections must be an array');
  }
  
  console.log(`Processing ${sections.length} sections`);
  
  const assessmentResults: SectionResult[] = [];
  let totalScore = 0;
  let maxPossibleScore = 0;

  // Process each section
  for (const section of sections) {
    console.log(`Processing section: ${section.title || section.id}`);
    
    if (!section.questions || !Array.isArray(section.questions)) {
      console.warn(`Section ${section.id} has no questions or questions is not an array`);
      continue;
    }
    
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
      sectionTitle: section.title || section.id,
      questions: sectionResults
    });
  }

  // Calculate final credibility score (0-100)
  const credibilityScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

  console.log(`Assessment completed: ${totalScore}/${maxPossibleScore} = ${credibilityScore}%`);

  return {
    sections: assessmentResults,
    totalScore,
    maxPossibleScore,
    credibilityScore
  };
};
