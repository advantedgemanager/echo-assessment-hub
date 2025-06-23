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
  let batchNumber = 0; // Initialize batchNumber at the top level
  
  try {
    console.log('=== Starting optimized chunked assessment ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody = await req.json();
    const { documentId, userId } = requestBody;
    batchNumber = requestBody.batchNumber || 0; // Safely assign batchNumber
    
    console.log(`Processing batch ${batchNumber} for document: ${documentId}`);

    if (!documentId || !userId) {
      throw new Error('Document ID and User ID are required');
    }

    if (!mistralApiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is not set');
    }

    // Get document with better error handling
    const { data: document, error: docError } = await supabaseClient
      .from('uploaded_documents')
      .select('id, file_name, document_text, file_path, file_type, assessment_status')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (docError || !document) {
      console.error('Document fetch error:', docError);
      throw new Error(`Document not found or not accessible: ${docError?.message || 'Unknown error'}`);
    }

    console.log(`Document status: ${document.assessment_status}, Text length: ${document.document_text?.length || 0}`);

    // Enhanced document processing logic
    if (!document.document_text || document.document_text.trim().length < 100) {
      console.log('Document text not available or too short, processing document first...');
      
      try {
        const { data: processResult, error: processError } = await supabaseClient.functions.invoke('document-processor', {
          body: { documentId }
        });

        if (processError) {
          console.error('Document processing invoke error:', processError);
          throw new Error(`Document processing failed: ${processError.message}`);
        }

        if (!processResult?.success) {
          console.error('Document processing result:', processResult);
          throw new Error(`Document processing failed: ${processResult?.error || 'Unknown processing error'}`);
        }

        console.log('Document processing completed, refetching document...');

        // Refetch the document after processing with retry logic
        let retryCount = 0;
        let processedDocument = null;
        
        while (retryCount < 3 && !processedDocument?.document_text) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          
          const { data: refetchedDoc, error: refetchError } = await supabaseClient
            .from('uploaded_documents')
            .select('id, file_name, document_text')
            .eq('id', documentId)
            .eq('user_id', userId)
            .single();

          if (!refetchError && refetchedDoc?.document_text?.length > 100) {
            processedDocument = refetchedDoc;
            break;
          }
          
          retryCount++;
          console.log(`Retry ${retryCount}: Document text still not available`);
        }

        if (!processedDocument?.document_text) {
          throw new Error('Document text still not available after processing and retries');
        }

        document.document_text = processedDocument.document_text;
        console.log(`Document processed successfully, final text length: ${document.document_text.length}`);
        
      } catch (processingError) {
        console.error('Document processing error:', processingError);
        throw new Error(`Failed to process document: ${processingError.message}`);
      }
    }

    // Enhanced text validation
    const textContent = document.document_text.trim();
    if (textContent.length < 100) {
      throw new Error('Document text is too short for assessment');
    }

    // Check for binary data indicators
    const binaryDataRatio = (textContent.match(/[\x00-\x08\x0E-\x1F\x7F-\xFF]/g) || []).length / textContent.length;
    if (binaryDataRatio > 0.1) {
      console.warn(`High binary data ratio detected: ${(binaryDataRatio * 100).toFixed(1)}%`);
      throw new Error('Document appears to contain mostly binary data - text extraction may have failed');
    }

    console.log(`Working with document text: ${textContent.length} characters`);
    console.log(`Text sample: ${textContent.substring(0, 300).replace(/\s+/g, ' ')}...`);

    // Get or create assessment progress record with better error handling
    let assessmentProgress;
    try {
      const { data: progressData, error: progressError } = await supabaseClient
        .from('assessment_progress')
        .select('*')
        .eq('document_id', documentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (progressError) {
        console.error('Progress fetch error:', progressError);
        throw new Error(`Failed to fetch progress: ${progressError.message}`);
      }

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

        if (createError) {
          console.error('Progress creation error:', createError);
          throw new Error(`Failed to create progress record: ${createError.message}`);
        }
        assessmentProgress = newProgress;
      } else {
        assessmentProgress = progressData;
      }
    } catch (progressErr) {
      console.error('Assessment progress error:', progressErr);
      throw new Error(`Progress handling failed: ${progressErr.message}`);
    }

    // Get questionnaire with timeout and error handling
    let questionnaireData;
    try {
      const questionnaireResponse = await Promise.race([
        supabaseClient.functions.invoke('questionnaire-manager', {
          body: { action: 'retrieve' }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Questionnaire fetch timeout')), 10000)
        )
      ]);

      if (questionnaireResponse.error || !questionnaireResponse.data) {
        throw new Error(`Failed to retrieve questionnaire: ${questionnaireResponse.error?.message || 'Unknown error'}`);
      }

      questionnaireData = questionnaireResponse.data;
    } catch (questionnaireErr) {
      console.error('Questionnaire fetch error:', questionnaireErr);
      throw new Error(`Questionnaire retrieval failed: ${questionnaireErr.message}`);
    }

    const questionnaire = questionnaireData.questionnaire?.sections || [];
    
    if (!Array.isArray(questionnaire) || questionnaire.length === 0) {
      throw new Error('Invalid questionnaire format - no sections found');
    }

    // ... keep existing code (flatten questions efficiently)
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
    const batchSize = 3; // Further reduced for stability
    const totalBatches = Math.ceil(totalQuestions / batchSize);

    console.log(`Total questions: ${totalQuestions}, Batch size: ${batchSize}, Total batches: ${totalBatches}`);

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

    // Process current batch with enhanced error handling
    const startIndex = batchNumber * batchSize;
    const endIndex = Math.min(startIndex + batchSize, totalQuestions);
    const batchQuestions = allQuestions.slice(startIndex, endIndex);

    console.log(`Processing batch ${batchNumber + 1}/${totalBatches} (questions ${startIndex + 1}-${endIndex})`);

    if (batchQuestions.length === 0) {
      throw new Error(`No questions found for batch ${batchNumber}`);
    }

    // Create optimized document chunks for analysis
    const documentChunks = createOptimizedChunks(textContent, 2000, 300);
    const chunksToProcess = documentChunks.slice(0, 3); // Limit chunks for memory
    
    console.log(`Created ${documentChunks.length} chunks, processing ${chunksToProcess.length}`);
    
    if (chunksToProcess.length === 0) {
      throw new Error('No document chunks available for analysis');
    }

    // Process questions in this batch with improved error handling
    const batchResults = [];
    for (let i = 0; i < batchQuestions.length; i++) {
      const question = batchQuestions[i];
      try {
        console.log(`Processing question ${i + 1}/${batchQuestions.length}: ${question.text.substring(0, 100)}...`);
        
        const questionResult = await processQuestionWithMistral(
          question,
          chunksToProcess,
          mistralApiKey
        );
        
        batchResults.push(questionResult);
        console.log(`Question ${question.globalIndex + 1} result: ${questionResult.response}`);
        
        // Small delay between questions to avoid rate limits
        if (i < batchQuestions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`Error processing question ${question.globalIndex}:`, error);
        batchResults.push({
          questionId: question.id,
          questionText: question.text,
          response: 'Insufficient',
          score: 0,
          weight: 1,
          sectionTitle: question.sectionTitle,
          sectionIndex: question.sectionIndex,
          error: error.message
        });
      }
    }

    // Update progress efficiently with error handling
    const newProcessedCount = assessmentProgress.processed_questions + batchResults.length;
    const progressPercentage = Math.round((newProcessedCount / totalQuestions) * 100);

    // Store results efficiently
    const existingResults = Array.isArray(assessmentProgress.batch_results) 
      ? assessmentProgress.batch_results 
      : [];
    
    try {
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
    } catch (updateError) {
      console.error('Progress update error:', updateError);
      throw new Error(`Failed to update progress: ${updateError.message}`);
    }

    const isComplete = newProcessedCount >= totalQuestions;
    
    if (isComplete) {
      // Finalize assessment
      try {
        await finalizeAssessment(supabaseClient, assessmentProgress.id, userId, document, questionnaireData);
      } catch (finalizeError) {
        console.error('Assessment finalization error:', finalizeError);
        // Don't throw here - the batch processing was successful
        console.log('Continuing despite finalization error...');
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`Batch ${batchNumber + 1} completed successfully in ${processingTime}ms`);

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
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        processingTime,
        batchNumber, // Now properly defined
        details: error.stack
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
    let chunk = text.substring(start, end);
    
    // Try to end at sentence boundaries for better context
    if (end < text.length) {
      const lastSentenceEnd = Math.max(
        chunk.lastIndexOf('.'),
        chunk.lastIndexOf('!'),
        chunk.lastIndexOf('?')
      );
      
      if (lastSentenceEnd > chunkSize * 0.7) {
        chunk = chunk.substring(0, lastSentenceEnd + 1);
      }
    }
    
    // Only add chunks with meaningful content
    if (chunk.trim().length > 200) {
      chunks.push(chunk.trim());
      chunkCount++;
    }
    
    start = end - overlap;
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
  
  console.log(`Processing question: ${question.text.substring(0, 100)}...`);
  console.log(`Using chunk of ${relevantChunk.length} characters`);

  const systemPrompt = `You are an expert evaluator of corporate climate transition plans. Analyze the document content carefully and answer whether it provides clear evidence for the specific question asked.

CRITICAL INSTRUCTIONS:
- Read the document content thoroughly
- Answer with exactly ONE WORD: "Yes", "No", or "Insufficient"
- "Yes" ONLY if there is explicit, specific evidence in the document that directly answers the question
- "No" if the document clearly contradicts or explicitly lacks the requirement
- "Insufficient" if the content is vague, unclear, incomplete, or doesn't directly address the question

Base your answer ONLY on what is explicitly stated in the document content provided.`;

  const userPrompt = `Question: "${question.text}"

Document Content to Analyze:
${relevantChunk}

Based ONLY on the document content above, does it provide clear and explicit evidence to answer this question positively? Answer with one word only: Yes, No, or Insufficient`;

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
      const errorText = await response.text();
      console.error(`Mistral API error: ${response.status} - ${errorText}`);
      throw new Error(`Mistral API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content?.trim() || 'Insufficient';
    
    console.log(`AI response for question: ${aiResponse}`);
    
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
    throw error;
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
      const keywordLower = keyword.toLowerCase();
      // Count occurrences of each keyword
      const matches = (chunkLower.match(new RegExp(keywordLower, 'gi')) || []).length;
      score += matches * 3; // Weight keyword matches higher
    });

    // Bonus for chunk length (longer chunks likely have more context)
    score += Math.min(chunk.length / 1000, 2);

    if (score > highestScore) {
      highestScore = score;
      bestChunk = chunk;
    }
  }

  // Ensure chunk is not too long for API
  return bestChunk.substring(0, 1800);
}

function extractKeywords(questionText: string): string[] {
  const commonKeywords = [
    'net zero', 'carbon neutral', 'emissions', 'climate', 'transition',
    'targets', 'governance', 'board', 'strategy', 'plan', 'progress',
    'scope 1', 'scope 2', 'scope 3', 'ghg', 'greenhouse gas',
    'verification', 'monitoring', 'compensation', 'executive'
  ];

  const questionWords = questionText.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !['what', 'does', 'have', 'been', 'will', 'this', 'that', 'with', 'from', 'they', 'their'].includes(word))
    .slice(0, 6);

  return [...commonKeywords.slice(0, 10), ...questionWords];
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
