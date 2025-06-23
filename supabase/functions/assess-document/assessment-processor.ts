import { evaluateQuestionAgainstChunks, QuestionEvaluation } from './ai-evaluator.ts';

export interface SectionResult {
  sectionId: string;
  sectionTitle: string;
  questions: QuestionEvaluation[];
  yesCount: number;
  noCount: number;
  naCount: number;
  yesPercentage: number;
  completeness: number;
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
  assessmentCompleteness: number;
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
  console.log('Starting comprehensive assessment for large questionnaire (up to 265 questions)');
  
  // Enhanced questionnaire extraction with fallback handling
  let questionnaire = questionnaireData;
  if (questionnaireData.questionnaire) {
    questionnaire = questionnaireData.questionnaire;
  }
  
  // Additional fallback for nested structures
  if (questionnaire.transition_plan_questionnaire) {
    questionnaire = questionnaire.transition_plan_questionnaire;
  }
  
  if (!questionnaire.sections && questionnaire.basic_assessment_sections) {
    // Transform the structure if needed
    const sections = [];
    for (const [sectionKey, sectionData] of Object.entries(questionnaire.basic_assessment_sections)) {
      sections.push({
        id: sectionKey,
        title: sectionData.title,
        description: sectionData.description,
        questions: sectionData.questions || []
      });
    }
    questionnaire.sections = sections;
  }
  
  if (!questionnaire.sections || !Array.isArray(questionnaire.sections)) {
    console.error('Invalid questionnaire structure:', questionnaire);
    throw new Error('Invalid questionnaire format: no sections found');
  }

  console.log(`Processing ${questionnaire.sections.length} sections with comprehensive methodology`);
  console.log('Available sections:', questionnaire.sections.map(s => ({ id: s.id, title: s.title, questions: s.questions?.length || 0 })));
  
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
  
  // REMOVED LIMITS - Process ALL questions available (up to 265)
  const maxQuestionsToProcess = totalQuestionsCount; // Process ALL questions
  
  console.log(`Total questions available: ${totalQuestionsCount}, processing ALL questions (${maxQuestionsToProcess})`);

  // Process each section with comprehensive coverage
  for (const section of questionnaire.sections) {
    if (checkTimeout) checkTimeout();
    
    console.log(`Processing section: ${section.title || section.id}`);
    
    if (!section.questions || !Array.isArray(section.questions)) {
      console.warn(`Section ${section.id} has no questions or invalid question format`);
      continue;
    }
    
    const questionEvaluations: QuestionEvaluation[] = [];
    let sectionYesCount = 0;
    let sectionNoCount = 0;
    let sectionNaCount = 0;
    
    // REMOVED PER-SECTION LIMITS - Process ALL questions in each section
    const questionsToProcess = section.questions; // Process ALL questions in section
    
    console.log(`Processing ${questionsToProcess.length} questions in section: ${section.title || section.id}`);
    
    // Process questions in batches to manage memory and performance
    const batchSize = 10; // Process 10 questions at a time
    for (let i = 0; i < questionsToProcess.length; i += batchSize) {
      if (checkTimeout) checkTimeout();
      
      const batch = questionsToProcess.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(questionsToProcess.length/batchSize)} (questions ${i+1}-${Math.min(i+batchSize, questionsToProcess.length)})`);
      
      for (const question of batch) {
        if (checkTimeout) checkTimeout();
        
        // Handle different question formats
        const questionId = question.id || question.questionId || `q_${questionsProcessed}`;
        const questionText = question.question_text || question.text || question.questionText;
        
        if (!questionText) {
          console.warn(`Question ${questionId} has no text, skipping`);
          continue;
        }
        
        console.log(`Processing question ${questionId}: ${questionText.substring(0, 100)}...`);
        
        try {
          const questionEvaluation = await evaluateQuestionAgainstChunks(
            {
              id: questionId,
              text: questionText,
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
          
          // Add small delay between questions to prevent rate limiting
          if (questionsProcessed % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
        } catch (questionError) {
          console.error(`Error processing question ${questionId}:`, questionError);
          
          // Enhanced fallback with better error tracking
          const fallbackEvaluation: QuestionEvaluation = {
            questionId: questionId,
            questionText: questionText,
            response: 'Not enough information',
            score: (question.score_na || 0) * 0.5,
            weight: 1
          };
          
          sectionNaCount++;
          totalScore += fallbackEvaluation.score;
          maxPossibleScore += question.score_yes || 1;
          questionEvaluations.push(fallbackEvaluation);
          questionsProcessed++;
        }
      }
      
      // Progress update after each batch
      const progressPercentage = Math.round((questionsProcessed / totalQuestionsCount) * 100);
      console.log(`Progress: ${questionsProcessed}/${totalQuestionsCount} questions processed (${progressPercentage}%)`);
    }
    
    const totalSectionQuestions = questionEvaluations.length;
    const yesPercentage = totalSectionQuestions > 0 ? Math.round((sectionYesCount / totalSectionQuestions) * 100) : 0;
    const sectionCompleteness = sectionTotalQuestions > 0 ? Math.round((totalSectionQuestions / sectionTotalQuestions) * 100) : 0;
    
    sectionResults.push({
      sectionId: section.id,
      sectionTitle: section.title || section.id,
      questions: questionEvaluations,
      yesCount: sectionYesCount,
      noCount: sectionNoCount,
      naCount: sectionNaCount,
      yesPercentage,
      completeness: sectionCompleteness
    });
    
    console.log(`Section ${section.title || section.id} completed: ${sectionYesCount}/${totalSectionQuestions} yes responses (${yesPercentage}%), completeness: ${sectionCompleteness}%`);
  }

  // Enhanced overall assessment calculation
  const assessmentResult = calculateEnhancedOverallResult(sectionResults, questionsProcessed, totalQuestionsCount);
  const assessmentCompleteness = totalQuestionsCount > 0 ? Math.round((questionsProcessed / totalQuestionsCount) * 100) : 0;
  
  console.log(`Comprehensive assessment completed with result: ${assessmentResult.overallResult}`);
  console.log(`Questions processed: ${questionsProcessed}/${totalQuestionsCount} (${assessmentCompleteness}%)`);
  console.log(`Red flag triggered: ${assessmentResult.redFlagTriggered}`);
  console.log(`Reasoning: ${assessmentResult.reasoning}`);

  return {
    sections: sectionResults,
    overallResult: assessmentResult.overallResult,
    totalScore,
    maxPossibleScore,
    credibilityScore: getEnhancedCredibilityScore(assessmentResult.overallResult, assessmentCompleteness, sectionResults),
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
  const completeness = totalQuestions > 0 ? (processedQuestions / totalQuestions) * 100 : 0;

  // Enhanced section identification with multiple fallback strategies
  const redFlagSection = sectionResults.find(s => 
    s.sectionId.toLowerCase().includes('red') || 
    s.sectionId.toLowerCase().includes('flag') ||
    s.sectionTitle.toLowerCase().includes('red flag') ||
    s.sectionTitle.toLowerCase().includes('misaligned') ||
    s.sectionId === 'section_1_red_flags'
  );
  
  const accountabilitySection = sectionResults.find(s => 
    s.sectionId.toLowerCase().includes('accountability') ||
    s.sectionTitle.toLowerCase().includes('accountability') ||
    s.sectionId === 'section_2_accountability'
  );
  
  const depthSection = sectionResults.find(s => 
    s.sectionId.toLowerCase().includes('depth') ||
    s.sectionTitle.toLowerCase().includes('depth') ||
    s.sectionTitle.toLowerCase().includes('planning') ||
    s.sectionId === 'section_3_depth'
  );
  
  const actionSection = sectionResults.find(s => 
    s.sectionId.toLowerCase().includes('action') ||
    s.sectionTitle.toLowerCase().includes('action') ||
    s.sectionTitle.toLowerCase().includes('implementation') ||
    s.sectionId === 'section_4_action'
  );

  console.log('Section identification results:');
  console.log('Red flag section:', redFlagSection?.sectionTitle || 'Not found');
  console.log('Accountability section:', accountabilitySection?.sectionTitle || 'Not found');
  console.log('Depth section:', depthSection?.sectionTitle || 'Not found');
  console.log('Action section:', actionSection?.sectionTitle || 'Not found');

  // Enhanced red flag detection
  if (redFlagSection && redFlagSection.questions.length > 0) {
    const redFlagQuestions: string[] = [];
    for (const question of redFlagSection.questions) {
      if (question.response === 'No') {
        redFlagQuestions.push(`Question ${question.questionId}: ${question.questionText}`);
      }
    }
    
    if (redFlagQuestions.length > 0) {
      return {
        overallResult: 'Misaligned',
        redFlagTriggered: true,
        redFlagQuestions,
        reasoning: `Red flag triggered by ${redFlagQuestions.length} question(s) answered "No" in ${redFlagSection.sectionTitle} (Assessment ${completeness.toFixed(0)}% complete)`
      };
    }
  }

  // Enhanced scoring with better fallback logic
  let baseSection = accountabilitySection;
  if (!baseSection && sectionResults.length > 0) {
    // Use the section with the most questions as fallback
    baseSection = sectionResults.reduce((prev, current) => 
      (prev.questions.length > current.questions.length) ? prev : current
    );
    console.log(`Using fallback section for scoring: ${baseSection.sectionTitle}`);
  }

  if (!baseSection) {
    return {
      overallResult: 'Partially Aligned',
      redFlagTriggered: false,
      redFlagQuestions: [],
      reasoning: `No suitable section found for scoring, defaulting to Partially Aligned (Assessment ${completeness.toFixed(0)}% complete)`
    };
  }

  // Adjust scoring thresholds based on completeness and section performance
  let baseThreshold = 40;
  let alignedThreshold = 70;
  
  if (completeness < 70) {
    baseThreshold = 35;
    alignedThreshold = 65;
  }

  // Enhanced scoring considers overall performance across all sections
  const overallYesPercentage = sectionResults.length > 0 ? 
    Math.round(sectionResults.reduce((sum, section) => sum + section.yesPercentage, 0) / sectionResults.length) : 0;
  
  const primaryScore = baseSection.yesPercentage;
  const combinedScore = Math.round((primaryScore * 0.6) + (overallYesPercentage * 0.4));

  console.log(`Scoring: Primary section (${baseSection.sectionTitle}): ${primaryScore}%, Overall average: ${overallYesPercentage}%, Combined: ${combinedScore}%`);

  let baseResult: 'Misaligned' | 'Partially Aligned' | 'Aligning' | 'Aligned';
  if (combinedScore >= alignedThreshold) {
    baseResult = 'Aligned';
  } else if (combinedScore >= baseThreshold) {
    baseResult = 'Aligning';
  } else if (combinedScore >= 20) {
    baseResult = 'Partially Aligned';
  } else {
    baseResult = 'Misaligned';
  }

  // Enhanced evaluation of other sections with more balanced approach
  let finalResult = baseResult;
  const downgrades: string[] = [];
  let upgrades: string[] = [];

  if (depthSection && depthSection.questions.length > 0) {
    if (depthSection.yesPercentage < 30) {
      downgrades.push(`${depthSection.sectionTitle} (${depthSection.yesPercentage}%)`);
      finalResult = downgradeResult(finalResult);
    } else if (depthSection.yesPercentage > 70) {
      upgrades.push(`${depthSection.sectionTitle} (${depthSection.yesPercentage}%)`);
    }
  }

  if (actionSection && actionSection.questions.length > 0) {
    if (actionSection.yesPercentage < 30) {
      downgrades.push(`${actionSection.sectionTitle} (${actionSection.yesPercentage}%)`);
      finalResult = downgradeResult(finalResult);
    } else if (actionSection.yesPercentage > 70) {
      upgrades.push(`${actionSection.sectionTitle} (${actionSection.yesPercentage}%)`);
    }
  }

  if (upgrades.length >= 2 && downgrades.length === 0 && finalResult === 'Aligning') {
    finalResult = 'Aligned';
    upgrades.push('multiple strong sections');
  }

  let reasoning = `Base score: ${baseResult} (Combined score: ${combinedScore}% from ${baseSection.sectionTitle}: ${primaryScore}% and overall: ${overallYesPercentage}%)`;
  
  if (downgrades.length > 0) {
    reasoning += `, downgraded due to: ${downgrades.join(', ')}`;
  }
  if (upgrades.length > 0) {
    reasoning += `, positive factors: ${upgrades.join(', ')}`;
  }
  reasoning += ` (Assessment ${completeness.toFixed(0)}% complete)`;

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

function getEnhancedCredibilityScore(overallResult: string, completeness: number, sectionResults: SectionResult[]): number {
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
  
  // Enhanced scoring considers actual performance data
  if (sectionResults.length > 0) {
    const averageYesPercentage = sectionResults.reduce((sum, section) => sum + section.yesPercentage, 0) / sectionResults.length;
    
    // Adjust base score based on actual performance
    const performanceAdjustment = (averageYesPercentage - 50) * 0.3;
    baseScore = Math.round(baseScore + performanceAdjustment);
  }
  
  // Minimal completeness penalty for comprehensive assessments
  if (completeness < 90) {
    const completenessAdjustment = (completeness / 100) * 0.05;
    baseScore = Math.round(baseScore * (0.95 + completenessAdjustment));
  }
  
  return Math.max(20, Math.min(95, baseScore));
}
