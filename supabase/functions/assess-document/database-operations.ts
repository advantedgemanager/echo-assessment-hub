
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
  console.log('Fetching embedded questionnaire...');
  
  const questionnaireResponse = await supabaseClient.functions.invoke('questionnaire-manager', {
    body: { action: 'retrieve' }
  });

  console.log('Questionnaire response received');

  if (questionnaireResponse.error || !questionnaireResponse.data) {
    console.error('Failed to retrieve questionnaire:', questionnaireResponse.error);
    throw new Error('Failed to retrieve embedded questionnaire');
  }

  return questionnaireResponse.data;
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
