
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const mistralApiKey = Deno.env.get('MISTRAL_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    console.log('=== Starting optimized chunked assessment ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId, userId, batchNumber = 0 } = await req.json();
    console.log(`Processing batch ${batchNumber} for document: ${documentId}`);

    if (!documentId || !userId) {
      throw new Error('Document ID and User ID are required');
    }

    if (!mistralApiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is not set');
    }

    // Get document
    const { data: document, error: docError } = await supabaseClient
      .from('uploaded_documents')
      .select('id, file_name, document_text')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found or not accessible');
    }

    // If document text is not available, process it first
    if (!document.document_text) {
      console.log('Document text not available, processing document first...');
      
      const { data: processResult, error: processError } = await supabaseClient.functions.invoke('document-processor', {
        body: { documentId }
      });

      if (processError || !processResult?.success) {
        throw new Error('Document processing failed');
      }

      // Refetch the document after processing
      const { data: processedDocument, error: refetchError } = await supabaseClient
        .from('uploaded_documents')
        .select('id, file_name, document_text')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single();

      if (refetchError || !processedDocument?.document_text) {
        throw new Error('Document text still not available after processing');
      }

      document.document_text = processedDocument.document_text;
      console.log('Document processed successfully');
    }

    // Get or create assessment progress record
    const { data: progressData, error: progressError } = await supabaseClient
      .from('assessment_progress')
      .select('*')
      .eq('document_id', documentId)
      .eq('user_id', userId)
      .maybeSingle();

    let assessmentProgress;
    if (!progressData) {
      // Create new progress record
      const { data: newProgress, error: createError } = await supabaseClient
        .from('assessment_progress')
        .insert({
          document_id: documentId,
          user_id: userId,
          status: 'processing',
          current_batch: 0,
          total_batches: 0,
          processed_questions: 0,
          total_questions: 0,
          batch_results: [],
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) throw createError;
      assessmentProgress = newProgress;
    } else if (progressError) {
      throw progressError;
    } else {
      assessmentProgress = progressData;
    }

    // Get questionnaire with minimal data transfer
    const questionnaireResponse = await supabaseClient.functions.invoke('questionnaire-manager', {
      body: { action: 'retrieve' }
    });

    if (questionnaireResponse.error || !questionnaireResponse.data) {
      throw new Error('Failed to retrieve questionnaire');
    }

    const questionnaireData = questionnaireResponse.data;
    const questionnaire = questionnaireData.questionnaire?.sections || [];
    
    if (!Array.isArray(questionnaire) || questionnaire.length === 0) {
      throw new Error('Invalid questionnaire format');
    }

    // Flatten questions efficiently
    const allQuestions = [];
    questionnaire.forEach((section, sectionIndex) => {
      if (section.questions && Array.isArray(section.questions)) {
        section.questions.forEach((question, questionIndex) => {
          allQuestions.push({
            id: question.id || `q_${allQuestions.length}`,
            text: question.question_text || question.text || question.questionText,
            sectionIndex,
            sectionTitle: section.title || section.id,
            questionIndex,
            globalIndex: allQuestions.length
          });
        });
      }
    });

    const totalQuestions = allQuestions.length;
    const batchSize = 5; // Reduced batch size for memory optimization
    const totalBatches = Math.ceil(totalQuestions / batchSize);

    // Update progress with total counts
    if (assessmentProgress.total_questions === 0) {
      await supabaseClient
        .from('assessment_progress')
        .update({
          total_questions: totalQuestions,
          total_batches: totalBatches
        })
        .eq('id', assessmentProgress.id);
    }

    // Process current batch
    const startIndex = batchNumber * batchSize;
    const endIndex = Math.min(startIndex + batchSize, totalQuestions);
    const batchQuestions = allQuestions.slice(startIndex, endIndex);

    console.log(`Processing batch ${batchNumber + 1}/${totalBatches} (questions ${startIndex + 1}-${endIndex})`);

    // Create smaller, more efficient document chunks
    const documentChunks = createOptimizedChunks(document.document_text, 2000, 300);
    const chunksToProcess = documentChunks.slice(0, 3); // Limit to 3 chunks for memory efficiency

    // Process questions in this batch with memory optimization
    const batchResults = [];
    for (const question of batchQuestions) {
      try {
        const questionResult = await processQuestionWithMistral(
          question,
          chunksToProcess,
          mistralApiKey
        );
        batchResults.push(questionResult);
        console.log(`Processed question ${question.globalIndex + 1}/${totalQuestions}: ${questionResult.response}`);
        
        // Clear memory between questions
        if (global.gc) global.gc();
      } catch (error) {
        console.error(`Error processing question ${question.globalIndex}:`, error);
        batchResults.push({
          questionId: question.id,
          questionText: question.text,
          response: 'Insufficient',
          score: 0,
          weight: 1,
          sectionTitle: question.sectionTitle,
          sectionIndex: question.sectionIndex
        });
      }
    }

    // Update progress efficiently
    const newProcessedCount = assessmentProgress.processed_questions + batchResults.length;
    const progressPercentage = Math.round((newProcessedCount / totalQuestions) * 100);

    // Store results efficiently
    const existingResults = Array.isArray(assessmentProgress.batch_results) 
      ? assessmentProgress.batch_results 
      : [];
    
    await supabaseClient
      .from('assessment_progress')
      .update({
        current_batch: batchNumber + 1,
        processed_questions: newProcessedCount,
        progress_percentage: progressPercentage,
        batch_results: [...existingResults, ...batchResults],
        updated_at: new Date().toISOString()
      })
      .eq('id', assessmentProgress.id);

    const isComplete = newProcessedCount >= totalQuestions;
    
    if (isComplete) {
      // Finalize assessment
      await finalizeAssessment(supabaseClient, assessmentProgress.id, userId, document, questionnaireData);
    }

    const processingTime = Date.now() - startTime;
    console.log(`Batch ${batchNumber + 1} completed in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        batchNumber: batchNumber + 1,
        totalBatches,
        processedQuestions: newProcessedCount,
        totalQuestions,
        progressPercentage,
        isComplete,
        processingTime,
        nextBatchNumber: isComplete ? null : batchNumber + 1
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('Error in chunked assessment:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        processingTime,
        batchNumber
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function createOptimizedChunks(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  // Limit total chunks to prevent memory issues
  const maxChunks = 5;
  let chunkCount = 0;
  
  while (start < text.length && chunkCount < maxChunks) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start = end - overlap;
    chunkCount++;
    if (start >= text.length) break;
  }
  
  return chunks;
}

async function processQuestionWithMistral(
  question: any,
  documentChunks: string[],
  apiKey: string
): Promise<any> {
  // Find most relevant chunk efficiently
  const relevantChunk = findMostRelevantChunk(documentChunks, question.text);
  
  const systemPrompt = `You are an expert evaluator of corporate climate transition plans. Analyze the document content and answer whether it provides clear evidence for the specific question asked.

INSTRUCTIONS:
- Answer with exactly one word: "Yes", "No", or "Insufficient"
- "Yes" only if there is explicit, specific evidence
- "No" if the document clearly contradicts or lacks the requirement
- "Insufficient" if the content is vague or doesn't directly address the question`;

  const userPrompt = `Question: "${question.text}"

Document Content:
${relevantChunk}

Answer with one word only: Yes, No, or Insufficient`;

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 5,
        temperature: 0.0
      }),
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content?.trim() || 'Insufficient';
    
    let normalizedResponse: 'Yes' | 'No' | 'Insufficient' = 'Insufficient';
    const responseLower = aiResponse.toLowerCase();
    
    if (responseLower.includes('yes')) {
      normalizedResponse = 'Yes';
    } else if (responseLower.includes('no')) {
      normalizedResponse = 'No';
    }

    const score = normalizedResponse === 'Yes' ? 1 : 0;

    return {
      questionId: question.id,
      questionText: question.text,
      response: normalizedResponse,
      score,
      weight: 1,
      sectionTitle: question.sectionTitle,
      sectionIndex: question.sectionIndex
    };

  } catch (error) {
    console.error(`Error processing question ${question.globalIndex}:`, error);
    return {
      questionId: question.id,
      questionText: question.text,
      response: 'Insufficient',
      score: 0,
      weight: 1,
      sectionTitle: question.sectionTitle,
      sectionIndex: question.sectionIndex
    };
  }
}

function findMostRelevantChunk(chunks: string[], questionText: string): string {
  const keywords = extractKeywords(questionText);
  let bestChunk = chunks[0] || '';
  let highestScore = 0;

  for (const chunk of chunks) {
    let score = 0;
    const chunkLower = chunk.toLowerCase();
    
    keywords.forEach(keyword => {
      if (chunkLower.includes(keyword.toLowerCase())) {
        score += 1;
      }
    });

    if (score > highestScore) {
      highestScore = score;
      bestChunk = chunk;
    }
  }

  return bestChunk.substring(0, 1500); // Limit size for memory efficiency
}

function extractKeywords(questionText: string): string[] {
  const commonKeywords = [
    'net zero', 'carbon neutral', 'emissions', 'climate', 'transition',
    'targets', 'governance', 'board', 'strategy', 'plan', 'progress'
  ];

  const questionWords = questionText.toLowerCase().split(/\s+/)
    .filter(word => word.length > 3)
    .slice(0, 5); // Limit keywords for memory efficiency

  return [...commonKeywords.slice(0, 6), ...questionWords];
}

async function finalizeAssessment(
  supabaseClient: any,
  progressId: string,
  userId: string,
  document: any,
  questionnaireData: any
) {
  console.log('Finalizing assessment...');
  
  // Get all batch results efficiently
  const { data: progress } = await supabaseClient
    .from('assessment_progress')
    .select('batch_results')
    .eq('id', progressId)
    .single();

  if (!progress?.batch_results || !Array.isArray(progress.batch_results)) return;

  // Aggregate results by section efficiently
  const sectionMap = new Map();
  let totalScore = 0;
  let maxPossibleScore = 0;

  progress.batch_results.forEach((result: any) => {
    const sectionKey = result.sectionTitle || 'Unknown Section';
    
    if (!sectionMap.has(sectionKey)) {
      sectionMap.set(sectionKey, {
        sectionTitle: sectionKey,
        questions: [],
        yesCount: 0,
        noCount: 0,
        naCount: 0
      });
    }

    const section = sectionMap.get(sectionKey);
    section.questions.push(result);
    
    if (result.response === 'Yes') section.yesCount++;
    else if (result.response === 'No') section.noCount++;
    else section.naCount++;

    totalScore += result.score;
    maxPossibleScore += result.weight;
  });

  const sections = Array.from(sectionMap.values()).map(section => ({
    ...section,
    yesPercentage: section.questions.length > 0 ? 
      Math.round((section.yesCount / section.questions.length) * 100) : 0
  }));

  const credibilityScore = maxPossibleScore > 0 ? 
    Math.round((totalScore / maxPossibleScore) * 100) : 0;

  const overallResult = calculateOverallResult(sections, credibilityScore);

  // Save final assessment report
  const { data: reportData, error: reportError } = await supabaseClient
    .from('assessment_reports')
    .insert({
      user_id: userId,
      company_name: document.file_name || 'Document Assessment',
      assessment_data: {
        sections,
        overallResult: overallResult.result,
        totalScore,
        maxPossibleScore,
        redFlagTriggered: overallResult.redFlagTriggered,
        redFlagQuestions: overallResult.redFlagQuestions,
        reasoning: overallResult.reasoning,
        questionnaire_version: questionnaireData.metadata?.version || '5.0'
      },
      credibility_score: credibilityScore,
      report_type: 'transition-plan-assessment'
    })
    .select()
    .single();

  if (reportError) {
    console.error('Failed to save assessment report:', reportError);
    throw new Error('Failed to save assessment report');
  }

  // Update progress as completed
  await supabaseClient
    .from('assessment_progress')
    .update({
      status: 'completed',
      report_id: reportData.id,
      final_score: credibilityScore,
      completed_at: new Date().toISOString()
    })
    .eq('id', progressId);

  console.log(`Assessment completed with score: ${credibilityScore}%`);
}

function calculateOverallResult(sections: any[], credibilityScore: number) {
  let result = 'Partially Aligned';
  let redFlagTriggered = false;
  let redFlagQuestions: string[] = [];

  // Check for red flags
  const redFlagSection = sections.find(s => 
    s.sectionTitle.toLowerCase().includes('red flag') ||
    s.sectionTitle.toLowerCase().includes('misaligned')
  );

  if (redFlagSection) {
    const noQuestions = redFlagSection.questions.filter(q => q.response === 'No');
    if (noQuestions.length > 0) {
      redFlagTriggered = true;
      redFlagQuestions = noQuestions.map(q => q.questionText);
      result = 'Misaligned';
    }
  }

  if (!redFlagTriggered) {
    if (credibilityScore >= 75) result = 'Aligned';
    else if (credibilityScore >= 50) result = 'Aligning';
    else if (credibilityScore >= 25) result = 'Partially Aligned';
    else result = 'Misaligned';
  }

  const reasoning = redFlagTriggered ? 
    `Red flag triggered by ${redFlagQuestions.length} critical issues` :
    `Assessment score: ${credibilityScore}%`;

  return { result, redFlagTriggered, redFlagQuestions, reasoning };
}
