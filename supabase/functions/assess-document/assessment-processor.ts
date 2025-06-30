
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

export const processAssessment = async (
  questionnaireData: any,
  documentChunks: string[],
  mistralApiKey: string,
  checkTimeout: () => void,
  documentWasTruncated: boolean = false
) => {
  console.log('=== Starting enhanced assessment processing v5.3 ===');
  console.log(`Processing ${documentChunks.length} document chunks`);
  
  const questionnaire = questionnaireData.questionnaire as Questionnaire;
  const sections = questionnaire.sections;
  
  console.log(`Found ${sections.length} sections in questionnaire`);
  
  let totalQuestions = 0;
  sections.forEach(section => {
    totalQuestions += section.questions.length;
  });
  
  console.log(`Total questions to process: ${totalQuestions}`);
  
  const processedSections = [];
  let processedQuestions = 0;
  let totalScore = 0;
  let maxPossibleScore = 0;
  let redFlagTriggered = false;
  
  // Process each section
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];
    console.log(`\n📋 Processing section ${sectionIndex + 1}/${sections.length}: ${section.title}`);
    console.log(`Section has ${section.questions.length} questions`);
    
    checkTimeout();
    
    const sectionQuestions = [];
    let sectionScore = 0;
    let sectionMaxScore = 0;
    
    // Process each question in the section
    for (let questionIndex = 0; questionIndex < section.questions.length; questionIndex++) {
      const rawQuestion = section.questions[questionIndex];
      processedQuestions++;
      
      // Enhanced null/undefined checking for question properties
      if (!rawQuestion || !rawQuestion.id || (!rawQuestion.text && !rawQuestion.question_text)) {
        console.error(`❌ Invalid question at index ${questionIndex}:`, rawQuestion);
        
        // Create fallback result for invalid question
        const fallbackResult = {
          questionId: rawQuestion?.id || `invalid_${questionIndex}`,
          questionText: rawQuestion?.text || rawQuestion?.question_text || 'Invalid question',
          response: 'Not enough information' as const,
          score: 0,
          weight: rawQuestion?.weight || rawQuestion?.score_yes || 1
        };
        
        sectionQuestions.push(fallbackResult);
        sectionMaxScore += rawQuestion?.weight || rawQuestion?.score_yes || 1;
        continue;
      }
      
      // Normalize the question to standard format
      const question = normalizeQuestion(rawQuestion);
      
      // Safe logging with proper null checks
      console.log(`\n🔍 Processing question ${processedQuestions}/${totalQuestions} (Section: ${section.title}, Question ${questionIndex + 1}/${section.questions.length})`);
      console.log(`Question ID: ${question.id}`);
      console.log(`Question text: ${question.text.length > 150 ? question.text.substring(0, 150) + '...' : question.text}`);
      console.log(`Question weight: ${question.weight}`);
      
      // Timeout check più frequente
      checkTimeout();
      
      try {
        const startTime = Date.now();
        console.log(`⏱️  Starting evaluation for question ${question.id} at ${new Date().toISOString()}`);
        
        // Valuta la domanda contro i chunk del documento con timeout specifico
        const questionResult = await Promise.race([
          evaluateQuestionAgainstChunks(question, documentChunks, mistralApiKey),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Question ${question.id} timeout`)), 4 * 60 * 1000) // Ridotto a 4 minuti per domanda
          )
        ]);
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ Question ${question.id} completed in ${Math.round(processingTime/1000)}s`);
        console.log(`Result: ${questionResult.response}, Score: ${questionResult.score}/${questionResult.weight}`);
        
        sectionQuestions.push(questionResult);
        sectionScore += questionResult.score;
        sectionMaxScore += question.weight;
        
        // Check for red flags (section 1 questions that are critical)
        if (section.id === 'section_1_red_flags' && questionResult.response === 'No') {
          console.log(`🚨 RED FLAG TRIGGERED: Question ${question.id} answered "No"`);
          redFlagTriggered = true;
        }
        
        console.log(`Progress: ${processedQuestions}/${totalQuestions} questions completed (${Math.round((processedQuestions/totalQuestions)*100)}%)`);
        
      } catch (error) {
        console.error(`❌ Error processing question ${question.id}:`, error);
        
        // In caso di errore, crea una risposta di fallback
        const fallbackResult = {
          questionId: question.id,
          questionText: question.text,
          response: 'Not enough information' as const,
          score: (question.weight || 1) * 0.2, // 20% del punteggio massimo
          weight: question.weight || 1
        };
        
        sectionQuestions.push(fallbackResult);
        sectionScore += fallbackResult.score;
        sectionMaxScore += question.weight;
        
        console.log(`⚠️  Used fallback result for question ${question.id}: ${fallbackResult.response}, Score: ${fallbackResult.score}/${fallbackResult.weight}`);
      }
    }
    
    totalScore += sectionScore;
    maxPossibleScore += sectionMaxScore;
    
    const sectionData = {
      sectionId: section.id,
      sectionTitle: section.title,
      questions: sectionQuestions,
      sectionScore,
      sectionMaxScore,
      sectionPercentage: sectionMaxScore > 0 ? Math.round((sectionScore / sectionMaxScore) * 100) : 0
    };
    
    processedSections.push(sectionData);
    
    console.log(`📊 Section ${section.title} completed:`);
    console.log(`  Questions: ${sectionQuestions.length}`);
    console.log(`  Score: ${sectionScore}/${sectionMaxScore} (${sectionData.sectionPercentage}%)`);
  }
  
  // Calculate final credibility score
  let credibilityScore = 0;
  
  if (redFlagTriggered) {
    credibilityScore = 0; // Misaligned if any red flag is triggered
    console.log('🚨 FINAL RESULT: MISALIGNED (Red flag triggered)');
  } else {
    credibilityScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
    console.log(`📈 FINAL CREDIBILITY SCORE: ${credibilityScore}%`);
  }
  
  // Determine overall result
  let overallResult = 'Misaligned';
  if (!redFlagTriggered) {
    if (credibilityScore >= 80) {
      overallResult = 'Well-aligned';
    } else if (credibilityScore >= 50) {
      overallResult = 'Partially aligned';
    } else {
      overallResult = 'Misaligned';
    }
  }
  
  const assessmentCompleteness = Math.round((processedQuestions / totalQuestions) * 100);
  
  console.log('=== Enhanced assessment processing completed ===');
  console.log(`Total questions processed: ${processedQuestions}/${totalQuestions} (${assessmentCompleteness}%)`);
  console.log(`Final score: ${totalScore}/${maxPossibleScore}`);
  console.log(`Credibility score: ${credibilityScore}%`);
  console.log(`Overall result: ${overallResult}`);
  console.log(`Red flag triggered: ${redFlagTriggered}`);
  
  return {
    sections: processedSections,
    totalScore,
    maxPossibleScore,
    credibilityScore,
    overallResult,
    redFlagTriggered,
    processedQuestions,
    totalQuestions,
    assessmentCompleteness,
    reasoning: redFlagTriggered 
      ? 'Assessment marked as Misaligned due to critical deficiencies in fundamental transition plan requirements.'
      : `Assessment completed with ${credibilityScore}% credibility score based on comprehensive evaluation of ${processedQuestions} questions across ${processedSections.length} key areas.`
  };
};
