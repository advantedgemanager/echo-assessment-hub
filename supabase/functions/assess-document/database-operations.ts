
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
  const questionnaireResponse = await supabaseClient.functions.invoke('questionnaire-manager', {
    body: { action: 'retrieve' }
  });

  if (questionnaireResponse.error || !questionnaireResponse.data?.questionnaire) {
    throw new Error('Failed to retrieve questionnaire');
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
        totalScore: assessmentResults.totalScore,
        maxPossibleScore: assessmentResults.maxPossibleScore,
        questionnaire_version: questionnaireVersion
      },
      credibility_score: credibilityScore,
      report_type: 'comprehensive-questionnaire'
    })
    .select()
    .single();

  if (reportError) {
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
