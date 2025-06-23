
import { evaluateQuestionAgainstChunks, QuestionEvaluation } from './ai-evaluator.ts';

export interface SectionResult {
  sectionId: string;
  sectionTitle: string;
  questions: QuestionEvaluation[];
  yesCount: number;
  noCount: number;
  naCount: number;
  yesPercentage: number;
  completeness: number; // Track how many questions were processed vs total
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
  assessmentCompleteness: number; // Overall completeness percentage
  processedQuestions: number;
  totalQuestions: number;
  wasTruncated: boolean;
}

export const processAssessment = async (
  questionnaireData: any,
  documentChunks: string[],
  mistralApiKey: string,
  checkTimeout?: () => void,
  documentWasTruncated: boolean = false
): Promise<AssessmentResults> => {
  console.log('Starting enhanced assessment with improved reliability');
  
  // Extract the questionnaire from the nested structure
  let questionnaire = questionnaireData;
  if (questionnaireData.questionnaire) {
    questionnaire = questionnaireData.questionnaire;
  }
  
  if (!questionnaire.sections || !Array.isArray(questionnaire.sections)) {
    throw new Error('Invalid questionnaire format: no sections found');
  }

  console.log(`Processing ${questionnaire.sections.length} sections with enhanced methodology`);
  
  const sectionResults: SectionResult[] = [];
  let totalScore = 0;
  let maxPossibleScore = 0;
  let questionsProcessed = 0;
  let totalQuestionsCount = 0;
  
  // Count total questions for completeness tracking
  questionnaire.sections.forEach(section => {
    if (section.questions && Array.isArray(section.questions)) {
      totalQuestionsCount += section.questions.length;
    }
  });
  
  // Remove artificial limits for better assessment coverage
  const maxQuestionsToProcess = Math.min(totalQuestionsCount, 50); // Increased limit
  
  console.log(`Total questions available: ${totalQuestionsCount}, processing up to: ${maxQuestionsToProcess}`);

  // Process each section with enhanced tracking
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
    
    // Process more questions per section for better coverage
    const questionsToProcess = section.questions.slice(0, Math.min(section.questions.length, 12));
    const sectionTotalQuestions = section.questions.length;
    
    for (const question of questionsToProcess) {
      if (questionsProcessed >= maxQuestionsToProcess) {
        console.log(`Reached maximum question limit (${maxQuestionsToProcess}), stopping processing`);
        break;
      }
      
      if (checkTimeout) checkTimeout();
      
      console.log(`Processing question ${question.id}: ${question.question_text?.substring(0, 100)}...`);
      
      try {
        const questionEvaluation = await evaluateQuestionAgainstChunks(
          {
            id: question.id,
            text: question.question_text,
            weight: 1
          },
          documentChunks,
          mistralApiKey
        );
        
        // Enhanced scoring with proper weight handling
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
        
        // Enhanced fallback with better error tracking
        const fallbackEvaluation: QuestionEvaluation = {
          questionId: question.id,
          questionText: question.question_text,
          response: 'Not enough information',
          score: (question.score_na || 0) * 0.3, // Reduced score for failed questions
          weight: 1
        };
        
        sectionNaCount++;
        totalScore += fallbackEvaluation.score;
        maxPossibleScore += question.score_yes || 1;
        questionEvaluations.push(fallbackEvaluation);
        questionsProcessed++;
      }
    }
    
    const totalSectionQuestions = questionEvaluations.length;
    const yesPercentage = totalSectionQuestions > 0 ? Math.round((sectionYesCount / totalSectionQuestions) * 100) : 0;
    const sectionCompleteness = sectionTotalQuestions > 0 ? Math.round((totalSectionQuestions / sectionTotalQuestions) * 100) : 0;
    
    sectionResults.push({
      sectionId: section.id,
      sectionTitle: section.title,
      questions: questionEvaluations,
      yesCount: sectionYesCount,
      noCount: sectionNoCount,
      naCount: sectionNaCount,
      yesPercentage,
      completeness: sectionCompleteness
    });
    
    console.log(`Section ${section.title} completed: ${sectionYesCount}/${totalSectionQuestions} yes responses (${yesPercentage}%), completeness: ${sectionCompleteness}%`);
    
    if (questionsProcessed >= maxQuestionsToProcess) {
      break;
    }
  }

  // Enhanced scoring methodology with completeness consideration
  const assessmentResult = calculateEnhancedOverallResult(sectionResults, questionsProcessed, totalQuestionsCount);
  const assessmentCompleteness = totalQuestionsCount > 0 ? Math.round((questionsProcessed / totalQuestionsCount) * 100) : 0;
  
  console.log(`Assessment completed with result: ${assessmentResult.overallResult}`);
  console.log(`Questions processed: ${questionsProcessed}/${totalQuestionsCount} (${assessmentCompleteness}%)`);
  console.log(`Red flag triggered: ${assessmentResult.redFlagTriggered}`);
  console.log(`Reasoning: ${assessmentResult.reasoning}`);

  return {
    sections: sectionResults,
    overallResult: assessmentResult.overallResult,
    totalScore,
    maxPossibleScore,
    credibilityScore: getEnhancedCredibilityScore(assessmentResult.overallResult, assessmentCompleteness),
    redFlagTriggered: assessmentResult.redFlagTriggered,
    redFlagQuestions: assessmentResult.redFlagQuestions,
    reasoning: assessmentResult.reasoning,
    assessmentCompleteness,
    processedQuestions: questionsProcessed,
    totalQuestions: totalQuestionsCount,
    wasTruncated: documentWasTruncated
  };
};

function calculateEnhancedOverallResult(sectionResults: SectionResult[], processedQuestions: number, totalQuestions: number): {
  overallResult: 'Misaligned' | 'Partially Aligned' | 'Aligning' | 'Aligned';
  redFlagTriggered: boolean;
  redFlagQuestions: string[];
  reasoning: string;
} {
  // Find sections by ID with fallback to title matching
  const section1 = sectionResults.find(s => 
    s.sectionId === 'section_1_red_flags' || 
    s.sectionTitle.toLowerCase().includes('red flag')
  );
  const section2 = sectionResults.find(s => 
    s.sectionId === 'section_2_accountability' || 
    s.sectionTitle.toLowerCase().includes('accountability')
  );
  const section3 = sectionResults.find(s => 
    s.sectionId === 'section_3_depth' || 
    s.sectionTitle.toLowerCase().includes('depth')
  );
  const section4 = sectionResults.find(s => 
    s.sectionId === 'section_4_action' || 
    s.sectionTitle.toLowerCase().includes('action')
  );

  const completeness = totalQuestions > 0 ? (processedQuestions / totalQuestions) * 100 : 0;

  // Enhanced red flag detection
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
        reasoning: `Red flag triggered by ${redFlagQuestions.length} question(s) answered "No" in Section 1 (Assessment ${completeness.toFixed(0)}% complete)`
      };
    }
  }

  // Enhanced base scoring with completeness consideration
  if (!section2) {
    return {
      overallResult: 'Partially Aligned',
      redFlagTriggered: false,
      redFlagQuestions: [],
      reasoning: `Section 2 (Accountability) not found, defaulting to Partially Aligned (Assessment ${completeness.toFixed(0)}% complete)`
    };
  }

  // Adjust scoring based on completeness
  let baseThreshold = 50;
  let alignedThreshold = 75;
  
  if (completeness < 70) {
    // More lenient thresholds for incomplete assessments
    baseThreshold = 45;
    alignedThreshold = 70;
  }

  let baseResult: 'Misaligned' | 'Partially Aligned' | 'Aligning' | 'Aligned';
  if (section2.yesPercentage >= alignedThreshold) {
    baseResult = 'Aligned';
  } else if (section2.yesPercentage >= baseThreshold) {
    baseResult = 'Aligning';
  } else {
    baseResult = 'Partially Aligned';
  }

  // Enhanced evaluation of other sections
  if (section2.yesPercentage < baseThreshold) {
    return {
      overallResult: baseResult,
      redFlagTriggered: false,
      redFlagQuestions: [],
      reasoning: `Base score from Section 2: ${section2.yesPercentage}% (< ${baseThreshold}%), Sections 3 and 4 not evaluated (Assessment ${completeness.toFixed(0)}% complete)`
    };
  }

  let finalResult = baseResult;
  const downgrades: string[] = [];

  if (section3 && section3.questions.length > 0) {
    const section3MostlyPositive = section3.yesPercentage > 50;
    if (!section3MostlyPositive) {
      downgrades.push('Section 3 (Depth) mostly negative');
      finalResult = downgradeResult(finalResult);
    }
  }

  if (section4 && section4.questions.length > 0) {
    const section4MostlyPositive = section4.yesPercentage > 50;
    if (!section4MostlyPositive) {
      downgrades.push('Section 4 (Action) mostly negative');
      finalResult = downgradeResult(finalResult);
    }
  }

  const reasoning = downgrades.length > 0 
    ? `Base score: ${baseResult} (Section 2: ${section2.yesPercentage}%), downgraded due to: ${downgrades.join(', ')} (Assessment ${completeness.toFixed(0)}% complete)`
    : `Base score maintained: ${baseResult} (Section 2: ${section2.yesPercentage}%), Sections 3 and 4 mostly positive (Assessment ${completeness.toFixed(0)}% complete)`;

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
      return 'Partially Aligned';
    default:
      return 'Partially Aligned';
  }
}

function getEnhancedCredibilityScore(overallResult: string, completeness: number): number {
  let baseScore = 0;
  switch (overallResult) {
    case 'Aligned':
      baseScore = 85;
      break;
    case 'Aligning':
      baseScore = 70;
      break;
    case 'Partially Aligned':
      baseScore = 50;
      break;
    case 'Misaligned':
      baseScore = 25;
      break;
    default:
      baseScore = 0;
  }
  
  // Adjust score based on completeness
  if (completeness < 80) {
    const completenessAdjustment = (completeness / 100) * 0.15; // Up to 15% adjustment
    baseScore = Math.round(baseScore * (0.85 + completenessAdjustment));
  }
  
  return Math.max(15, Math.min(95, baseScore)); // Keep within reasonable bounds
}
