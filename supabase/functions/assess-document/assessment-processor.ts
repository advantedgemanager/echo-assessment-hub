
import { evaluateQuestionAgainstChunks, QuestionEvaluation } from './ai-evaluator.ts';

export interface SectionResult {
  sectionId: string;
  sectionTitle: string;
  questions: QuestionEvaluation[];
  yesCount: number;
  noCount: number;
  naCount: number;
  yesPercentage: number;
}

export interface AssessmentResults {
  sections: SectionResult[];
  overallResult: 'Misaligned' | 'Partially Aligned' | 'Aligning' | 'Aligned';
  totalScore: number;
  maxPossibleScore: number;
  credibilityScore: number;
  redFlagTriggered: boolean;
  redFlagQuestions: string[];
  reasoning: string;
}

export const processAssessment = async (
  questionnaireData: any,
  documentChunks: string[],
  mistralApiKey: string,
  checkTimeout?: () => void
): Promise<AssessmentResults> => {
  console.log('Starting new assessment with embedded questionnaire logic');
  
  // Extract the questionnaire from the nested structure
  let questionnaire = questionnaireData;
  if (questionnaireData.questionnaire) {
    questionnaire = questionnaireData.questionnaire;
  }
  
  if (!questionnaire.sections || !Array.isArray(questionnaire.sections)) {
    throw new Error('Invalid questionnaire format: no sections found');
  }

  console.log(`Processing ${questionnaire.sections.length} sections with new methodology`);
  
  const sectionResults: SectionResult[] = [];
  let totalScore = 0;
  let maxPossibleScore = 0;
  let questionsProcessed = 0;
  const maxQuestionsToProcess = 20; // Reduced for efficiency

  // Process each section
  for (const section of questionnaire.sections) {
    if (checkTimeout) checkTimeout();
    
    console.log(`Processing section: ${section.title}`);
    
    if (!section.questions || !Array.isArray(section.questions)) {
      console.warn(`Section ${section.id} has no questions`);
      continue;
    }
    
    const questionEvaluations: QuestionEvaluation[] = [];
    let sectionYesCount = 0;
    let sectionNoCount = 0;
    let sectionNaCount = 0;
    
    // Process questions in the section
    for (const question of section.questions) {
      if (questionsProcessed >= maxQuestionsToProcess) {
        console.warn(`Reached maximum question limit, stopping processing`);
        break;
      }
      
      if (checkTimeout) checkTimeout();
      
      console.log(`Processing question ${question.id}: ${question.question_text}`);
      
      try {
        const questionEvaluation = await evaluateQuestionAgainstChunks(
          {
            id: question.id,
            text: question.question_text,
            weight: 1 // All questions have equal weight in new methodology
          },
          documentChunks,
          mistralApiKey
        );
        
        // Count responses for percentage calculations
        switch (questionEvaluation.response) {
          case 'Yes':
            sectionYesCount++;
            totalScore += question.score_yes || 1;
            break;
          case 'No':
            sectionNoCount++;
            totalScore += question.score_no || 0;
            break;
          default:
            sectionNaCount++;
            totalScore += question.score_na || 0;
            break;
        }
        
        maxPossibleScore += question.score_yes || 1;
        questionEvaluations.push(questionEvaluation);
        questionsProcessed++;
        
      } catch (questionError) {
        console.error(`Error processing question ${question.id}:`, questionError);
        // Add fallback evaluation
        const fallbackEvaluation: QuestionEvaluation = {
          questionId: question.id,
          questionText: question.question_text,
          response: 'Not enough information',
          score: question.score_na || 0,
          weight: 1
        };
        
        sectionNaCount++;
        totalScore += question.score_na || 0;
        maxPossibleScore += question.score_yes || 1;
        questionEvaluations.push(fallbackEvaluation);
        questionsProcessed++;
      }
    }
    
    const totalSectionQuestions = questionEvaluations.length;
    const yesPercentage = totalSectionQuestions > 0 ? Math.round((sectionYesCount / totalSectionQuestions) * 100) : 0;
    
    sectionResults.push({
      sectionId: section.id,
      sectionTitle: section.title,
      questions: questionEvaluations,
      yesCount: sectionYesCount,
      noCount: sectionNoCount,
      naCount: sectionNaCount,
      yesPercentage
    });
    
    if (questionsProcessed >= maxQuestionsToProcess) {
      break;
    }
  }

  // Apply new scoring methodology
  const assessmentResult = calculateOverallResult(sectionResults);
  
  console.log(`Assessment completed with result: ${assessmentResult.overallResult}`);
  console.log(`Red flag triggered: ${assessmentResult.redFlagTriggered}`);
  console.log(`Reasoning: ${assessmentResult.reasoning}`);

  return {
    sections: sectionResults,
    overallResult: assessmentResult.overallResult,
    totalScore,
    maxPossibleScore,
    credibilityScore: getCredibilityScore(assessmentResult.overallResult),
    redFlagTriggered: assessmentResult.redFlagTriggered,
    redFlagQuestions: assessmentResult.redFlagQuestions,
    reasoning: assessmentResult.reasoning
  };
};

function calculateOverallResult(sectionResults: SectionResult[]): {
  overallResult: 'Misaligned' | 'Partially Aligned' | 'Aligning' | 'Aligned';
  redFlagTriggered: boolean;
  redFlagQuestions: string[];
  reasoning: string;
} {
  // Find sections by ID
  const section1 = sectionResults.find(s => s.sectionId === 'section_1_red_flags');
  const section2 = sectionResults.find(s => s.sectionId === 'section_2_accountability');
  const section3 = sectionResults.find(s => s.sectionId === 'section_3_depth');
  const section4 = sectionResults.find(s => s.sectionId === 'section_4_action');

  // Check for red flags (Section 1)
  if (section1) {
    const redFlagQuestions: string[] = [];
    for (const question of section1.questions) {
      if (question.response === 'No') {
        redFlagQuestions.push(`Question ${question.questionId}: ${question.questionText}`);
      }
    }
    
    if (redFlagQuestions.length > 0) {
      return {
        overallResult: 'Misaligned',
        redFlagTriggered: true,
        redFlagQuestions,
        reasoning: `Red flag triggered by ${redFlagQuestions.length} question(s) answered "No" in Section 1`
      };
    }
  }

  // Calculate base score from Section 2 (Accountability)
  if (!section2) {
    return {
      overallResult: 'Partially Aligned',
      redFlagTriggered: false,
      redFlagQuestions: [],
      reasoning: 'Section 2 (Accountability) not found, defaulting to Partially Aligned'
    };
  }

  let baseResult: 'Misaligned' | 'Partially Aligned' | 'Aligning' | 'Aligned';
  if (section2.yesPercentage >= 75) {
    baseResult = 'Aligned';
  } else if (section2.yesPercentage >= 50) {
    baseResult = 'Aligning';
  } else {
    baseResult = 'Partially Aligned';
  }

  // If Section 2 score < 50%, don't evaluate Sections 3 and 4
  if (section2.yesPercentage < 50) {
    return {
      overallResult: baseResult,
      redFlagTriggered: false,
      redFlagQuestions: [],
      reasoning: `Base score from Section 2: ${section2.yesPercentage}% (< 50%), Sections 3 and 4 not evaluated`
    };
  }

  // Evaluate Sections 3 and 4 for potential downgrade
  let finalResult = baseResult;
  const downgrades: string[] = [];

  if (section3) {
    const section3MostlyPositive = section3.yesPercentage > 50;
    if (!section3MostlyPositive) {
      downgrades.push('Section 3 (Depth) mostly negative');
      finalResult = downgradeResult(finalResult);
    }
  }

  if (section4) {
    const section4MostlyPositive = section4.yesPercentage > 50;
    if (!section4MostlyPositive) {
      downgrades.push('Section 4 (Action) mostly negative');
      finalResult = downgradeResult(finalResult);
    }
  }

  const reasoning = downgrades.length > 0 
    ? `Base score: ${baseResult} (Section 2: ${section2.yesPercentage}%), downgraded due to: ${downgrades.join(', ')}`
    : `Base score maintained: ${baseResult} (Section 2: ${section2.yesPercentage}%), Sections 3 and 4 mostly positive`;

  return {
    overallResult: finalResult,
    redFlagTriggered: false,
    redFlagQuestions: [],
    reasoning
  };
}

function downgradeResult(result: 'Aligned' | 'Aligning' | 'Partially Aligned'): 'Aligned' | 'Aligning' | 'Partially Aligned' {
  switch (result) {
    case 'Aligned':
      return 'Aligning';
    case 'Aligning':
      return 'Partially Aligned';
    case 'Partially Aligned':
      return 'Partially Aligned'; // Cannot downgrade further
    default:
      return 'Partially Aligned';
  }
}

function getCredibilityScore(overallResult: string): number {
  switch (overallResult) {
    case 'Aligned':
      return 85;
    case 'Aligning':
      return 70;
    case 'Partially Aligned':
      return 50;
    case 'Misaligned':
      return 25;
    default:
      return 0;
  }
}
