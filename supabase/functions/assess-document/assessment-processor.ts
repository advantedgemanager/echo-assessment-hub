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
  console.log('🚀 Starting enhanced assessment v5.0 for comprehensive questionnaire');
  
  // Enhanced questionnaire extraction with detailed logging
  let questionnaire = questionnaireData;
  if (questionnaireData.questionnaire) {
    questionnaire = questionnaireData.questionnaire;
    console.log('📋 Using nested questionnaire structure');
  }
  
  if (questionnaire.transition_plan_questionnaire) {
    questionnaire = questionnaire.transition_plan_questionnaire;
    console.log('📋 Using transition_plan_questionnaire structure');
  }
  
  if (!questionnaire.sections && questionnaire.basic_assessment_sections) {
    console.log('📋 Transforming basic_assessment_sections to sections format');
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
    console.error('❌ Invalid questionnaire structure after transformation:', {
      hasSections: !!questionnaire.sections,
      sectionsType: typeof questionnaire.sections,
      isArray: Array.isArray(questionnaire.sections),
      keys: Object.keys(questionnaire)
    });
    throw new Error('Invalid questionnaire format: no sections found after transformation');
  }

  // Enhanced logging with section analysis
  const sectionAnalysis = questionnaire.sections.map(section => ({
    id: section.id,
    title: section.title,
    questions: section.questions?.length || 0,
    hasQuestions: !!(section.questions && Array.isArray(section.questions))
  }));
  
  console.log('📊 Questionnaire analysis:', {
    totalSections: questionnaire.sections.length,
    sections: sectionAnalysis,
    documentChunks: documentChunks.length,
    documentWasTruncated
  });
  
  const sectionResults: SectionResult[] = [];
  let totalScore = 0;
  let maxPossibleScore = 0;
  let questionsProcessed = 0;
  let totalQuestionsCount = 0;
  
  // Count total questions with enhanced validation
  questionnaire.sections.forEach(section => {
    if (section.questions && Array.isArray(section.questions)) {
      totalQuestionsCount += section.questions.length;
    }
  });
  
  console.log(`📈 Processing ${totalQuestionsCount} total questions across ${questionnaire.sections.length} sections`);

  // Process each section with enhanced error handling and progress tracking
  for (let sectionIndex = 0; sectionIndex < questionnaire.sections.length; sectionIndex++) {
    const section = questionnaire.sections[sectionIndex];
    
    if (checkTimeout) checkTimeout();
    
    console.log(`🔄 Processing section ${sectionIndex + 1}/${questionnaire.sections.length}: ${section.title || section.id}`);
    
    if (!section.questions || !Array.isArray(section.questions)) {
      console.warn(`⚠️ Section ${section.id} has invalid questions format:`, {
        hasQuestions: !!section.questions,
        questionsType: typeof section.questions,
        isArray: Array.isArray(section.questions)
      });
      continue;
    }
    
    const questionEvaluations: QuestionEvaluation[] = [];
    let sectionYesCount = 0;
    let sectionNoCount = 0;
    let sectionNaCount = 0;
    
    const questionsToProcess = section.questions;
    const sectionTotalQuestions = questionsToProcess.length;
    
    console.log(`📝 Processing ${questionsToProcess.length} questions in section: ${section.title || section.id}`);
    
    // Enhanced batch processing with adaptive batch sizes
    const adaptiveBatchSize = Math.max(3, Math.min(8, Math.floor(questionsToProcess.length / 5)));
    console.log(`🔧 Using adaptive batch size: ${adaptiveBatchSize}`);
    
    for (let i = 0; i < questionsToProcess.length; i += adaptiveBatchSize) {
      if (checkTimeout) checkTimeout();
      
      const batch = questionsToProcess.slice(i, i + adaptiveBatchSize);
      const batchNumber = Math.floor(i / adaptiveBatchSize) + 1;
      const totalBatches = Math.ceil(questionsToProcess.length / adaptiveBatchSize);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (questions ${i + 1}-${Math.min(i + adaptiveBatchSize, questionsToProcess.length)}) in section ${section.title || section.id}`);
      
      for (const question of batch) {
        if (checkTimeout) checkTimeout();
        
        const questionId = question.id || question.questionId || `q_${questionsProcessed + 1}`;
        const questionText = question.question_text || question.text || question.questionText;
        
        if (!questionText || questionText.trim().length === 0) {
          console.warn(`⚠️ Question ${questionId} has no text, skipping`);
          continue;
        }
        
        console.log(`🔍 Processing question ${questionId} (${questionsProcessed + 1}/${totalQuestionsCount}): ${questionText.substring(0, 80)}...`);
        
        try {
          const startTime = Date.now();
          
          const questionEvaluation = await evaluateQuestionAgainstChunks(
            {
              id: questionId,
              text: questionText,
              weight: 1
            },
            documentChunks,
            mistralApiKey
          );
          
          const processingTime = Date.now() - startTime;
          console.log(`⏱️ Question ${questionId} processed in ${processingTime}ms`);
          
          // Enhanced scoring with detailed logging
          const scoreYes = question.score_yes || 1;
          const scoreNo = question.score_no || 0;
          const scoreNa = question.score_na || 0;
          
          switch (questionEvaluation.response) {
            case 'Yes':
              sectionYesCount++;
              totalScore += scoreYes;
              console.log(`✅ Question ${questionId}: YES (score: +${scoreYes})`);
              break;
            case 'No':
              sectionNoCount++;
              totalScore += scoreNo;
              console.log(`❌ Question ${questionId}: NO (score: +${scoreNo})`);
              break;
            default:
              sectionNaCount++;
              totalScore += scoreNa;
              console.log(`❓ Question ${questionId}: N/A (score: +${scoreNa})`);
              break;
          }
          
          maxPossibleScore += scoreYes;
          questionEvaluations.push(questionEvaluation);
          questionsProcessed++;
          
          // Enhanced progress reporting
          const progressPercentage = Math.round((questionsProcessed / totalQuestionsCount) * 100);
          if (questionsProcessed % 10 === 0) {
            console.log(`📊 Overall progress: ${questionsProcessed}/${totalQuestionsCount} questions (${progressPercentage}%)`);
            console.log(`📈 Current score: ${totalScore}/${maxPossibleScore} (${Math.round((totalScore / maxPossibleScore) * 100)}%)`);
          }
          
          // Dynamic delay to prevent rate limiting
          if (questionsProcessed % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }
          
        } catch (questionError) {
          console.error(`❌ Error processing question ${questionId}:`, {
            error: questionError.message,
            questionText: questionText.substring(0, 100)
          });
          
          // Enhanced fallback handling
          const fallbackEvaluation: QuestionEvaluation = {
            questionId: questionId,
            questionText: questionText,
            response: 'Not enough information',
            score: (question.score_na || 0) * 0.25, // Reduced fallback score
            weight: 1
          };
          
          sectionNaCount++;
          totalScore += fallbackEvaluation.score;
          maxPossibleScore += question.score_yes || 1;
          questionEvaluations.push(fallbackEvaluation);
          questionsProcessed++;
          
          console.log(`🔄 Question ${questionId}: FALLBACK (score: +${fallbackEvaluation.score})`);
        }
      }
      
      // Enhanced batch completion reporting
      const sectionProgress = Math.round((questionEvaluations.length / sectionTotalQuestions) * 100);
      console.log(`📋 Section batch ${batchNumber}/${totalBatches} completed. Section progress: ${questionEvaluations.length}/${sectionTotalQuestions} (${sectionProgress}%)`);
    }
    
    // Enhanced section completion analysis
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
    
    console.log(`✅ Section "${section.title || section.id}" completed:`, {
      questions: totalSectionQuestions,
      yesCount: sectionYesCount,
      noCount: sectionNoCount,
      naCount: sectionNaCount,
      yesPercentage: `${yesPercentage}%`,
      completeness: `${sectionCompleteness}%`
    });
  }

  // Enhanced overall assessment calculation with detailed analysis
  const assessmentCompleteness = totalQuestionsCount > 0 ? Math.round((questionsProcessed / totalQuestionsCount) * 100) : 0;
  const overallScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
  
  console.log('📊 Assessment completion summary:', {
    questionsProcessed,
    totalQuestionsCount,
    completeness: `${assessmentCompleteness}%`,
    totalScore,
    maxPossibleScore,
    overallScore: `${overallScore}%`,
    sectionsProcessed: sectionResults.length
  });
  
  const assessmentResult = calculateEnhancedOverallResult(sectionResults, questionsProcessed, totalQuestionsCount);
  
  console.log('🎯 Enhanced assessment completed:', {
    overallResult: assessmentResult.overallResult,
    redFlagTriggered: assessmentResult.redFlagTriggered,
    reasoning: assessmentResult.reasoning,
    completeness: `${assessmentCompleteness}%`
  });

  return {
    sections: sectionResults,
    overallResult: assessmentResult.overallResult,
    totalScore,
    maxPossibleScore,
    credibilityScore: getEnhancedCredibilityScore(assessmentResult.overallResult, assessmentCompleteness, sectionResults, overallScore),
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
  let baseThreshold = 35;
  let alignedThreshold = 65;
  
  if (completeness < 70) {
    baseThreshold = 30;
    alignedThreshold = 60;
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
  } else if (combinedScore >= 15) {
    baseResult = 'Partially Aligned';
  } else {
    baseResult = 'Misaligned';
  }

  // Enhanced evaluation of other sections with more balanced approach
  let finalResult = baseResult;
  const downgrades: string[] = [];
  const upgrades: string[] = [];

  if (depthSection && depthSection.questions.length > 0) {
    if (depthSection.yesPercentage < 25) {
      downgrades.push(`${depthSection.sectionTitle} (${depthSection.yesPercentage}%)`);
      finalResult = downgradeResult(finalResult);
    } else if (depthSection.yesPercentage > 75) {
      upgrades.push(`${depthSection.sectionTitle} (${depthSection.yesPercentage}%)`);
    }
  }

  if (actionSection && actionSection.questions.length > 0) {
    if (actionSection.yesPercentage < 25) {
      downgrades.push(`${actionSection.sectionTitle} (${actionSection.yesPercentage}%)`);
      finalResult = downgradeResult(finalResult);
    } else if (actionSection.yesPercentage > 75) {
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

function getEnhancedCredibilityScore(
  overallResult: string, 
  completeness: number, 
  sectionResults: SectionResult[], 
  overallScore: number
): number {
  let baseScore = 0;
  
  // Base score from overall result
  switch (overallResult) {
    case 'Aligned':
      baseScore = 88;
      break;
    case 'Aligning':
      baseScore = 72;
      break;
    case 'Partially Aligned':
      baseScore = 52;
      break;
    case 'Misaligned':
      baseScore = 28;
      break;
    default:
      baseScore = 35;
  }
  
  // Enhanced scoring considers actual performance data
  if (sectionResults.length > 0) {
    const averageYesPercentage = sectionResults.reduce((sum, section) => sum + section.yesPercentage, 0) / sectionResults.length;
    
    // Adjust base score based on actual performance with more nuanced scaling
    const performanceAdjustment = (averageYesPercentage - 50) * 0.25;
    baseScore = Math.round(baseScore + performanceAdjustment);
    
    // Additional adjustment based on overall score
    const scoreAdjustment = (overallScore - 50) * 0.15;
    baseScore = Math.round(baseScore + scoreAdjustment);
  }
  
  // Minimal completeness penalty for comprehensive assessments
  if (completeness < 95) {
    const completenessAdjustment = (completeness / 100) * 0.03;
    baseScore = Math.round(baseScore * (0.97 + completenessAdjustment));
  }
  
  // Ensure score is within reasonable bounds
  const finalScore = Math.max(25, Math.min(92, baseScore));
  
  console.log(`🎯 Credibility score calculation:`, {
    overallResult,
    baseScore: baseScore,
    averageYesPercentage: sectionResults.length > 0 ? Math.round(sectionResults.reduce((sum, section) => sum + section.yesPercentage, 0) / sectionResults.length) : 0,
    overallScore,
    completeness: `${completeness}%`,
    finalScore
  });
  
  return finalScore;
}
