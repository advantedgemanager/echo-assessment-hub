
export const getDocument = async (supabaseClient: any, documentId: string, userId: string) => {
  const { data: document, error: docError } = await supabaseClient
    .from('uploaded_documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', userId)
    .single();

  if (docError || !document) {
    throw new Error('Document not found or not accessible');
  }

  if (!document.document_text) {
    throw new Error('Document text not available. Please process the document first.');
  }

  return document;
};

export const getQuestionnaire = async (supabaseClient: any) => {
  console.log('🔍 Fetching FRESH embedded questionnaire (no cache)...');
  
  try {
    const questionnaireResponse = await supabaseClient.functions.invoke('questionnaire-manager', {
      body: { 
        action: 'retrieve',
        forceRefresh: Date.now(), // Cache-busting parameter
        timestamp: new Date().toISOString()
      }
    });

    console.log('📥 Questionnaire response received');

    if (questionnaireResponse.error) {
      console.error('Questionnaire function error:', questionnaireResponse.error);
      throw new Error(`Failed to retrieve questionnaire: ${questionnaireResponse.error.message}`);
    }

    if (!questionnaireResponse.data) {
      console.error('No questionnaire data received');
      throw new Error('No questionnaire data received from function');
    }

    // Validate the questionnaire structure
    const data = questionnaireResponse.data;
    if (!data.questionnaire || !data.questionnaire.sections) {
      console.error('Invalid questionnaire structure:', data);
      throw new Error('Invalid questionnaire structure received');
    }

    const cacheBuster = data.metadata?.cache_buster || Date.now();
    const queryTimestamp = data.metadata?.query_timestamp;
    
    console.log(`✅ Questionnaire loaded with ${data.questionnaire.sections.length} sections`);
    console.log(`🔄 Cache-buster: ${cacheBuster}`);
    console.log(`🕒 Query timestamp: ${queryTimestamp}`);
    console.log(`📊 Total questions: ${data.questionnaire.totalQuestions || 'unknown'}`);
    
    return data;

  } catch (error) {
    console.error('Failed to retrieve questionnaire:', error);
    throw new Error(`Failed to retrieve embedded questionnaire: ${error.message}`);
  }
};

export const saveAssessmentReport = async (
  supabaseClient: any,
  userId: string,
  document: any,
  assessmentResults: any,
  credibilityScore: number,
  questionnaireVersion: string
) => {
  const { data: reportData, error: reportError } = await supabaseClient
    .from('assessment_reports')
    .insert({
      user_id: userId,
      company_name: document.file_name || 'Document Assessment',
      assessment_data: {
        sections: assessmentResults.sections,
        overallResult: assessmentResults.overallResult,
        totalScore: assessmentResults.totalScore,
        maxPossibleScore: assessmentResults.maxPossibleScore,
        redFlagTriggered: assessmentResults.redFlagTriggered,
        redFlagQuestions: assessmentResults.redFlagQuestions,
        reasoning: assessmentResults.reasoning,
        questionnaire_version: questionnaireVersion
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

  return reportData;
};

export const updateDocumentStatus = async (supabaseClient: any, documentId: string) => {
  await supabaseClient
    .from('uploaded_documents')
    .update({
      assessment_status: 'completed',
      is_temporary: false
    })
    .eq('id', documentId);
};
