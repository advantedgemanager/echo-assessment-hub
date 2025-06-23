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

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId, userId } = await req.json();

    if (!documentId || !userId) {
      throw new Error('Document ID and User ID are required');
    }

    // Get document with text
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

    // Get questionnaire
    const questionnaireResponse = await supabaseClient.functions.invoke('questionnaire-manager', {
      body: { action: 'retrieve' }
    });

    if (questionnaireResponse.error || !questionnaireResponse.data?.questionnaire) {
      throw new Error('Failed to retrieve questionnaire');
    }

    const questionnaire = questionnaireResponse.data.questionnaire;
    
    // Split document into manageable chunks (max 2000 chars per chunk with overlap)
    const chunkSize = 2000;
    const overlap = 200;
    const documentChunks: string[] = [];
    
    for (let i = 0; i < document.document_text.length; i += chunkSize - overlap) {
      const chunk = document.document_text.slice(i, i + chunkSize);
      documentChunks.push(chunk);
    }

    const assessmentResults: any[] = [];
    let totalScore = 0;
    let maxPossibleScore = 0;

    // Process each section
    for (const section of questionnaire.sections) {
      console.log(`Processing section: ${section.title}`);
      
      const sectionResults: any[] = [];
      
      // Process each question in the section
      for (const question of section.questions) {
        console.log(`Processing question: ${question.id}`);
        
        let questionScore = 0;
        let bestResponse = 'Not enough information';
        
        // Evaluate question against each document chunk
        for (const chunk of documentChunks) {
          try {
            const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${mistralApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'mistral-large-latest',
                messages: [
                  {
                    role: 'system',
                    content: 'You are a transition plan evaluator. Your job is to read the transition plan and answer the following question with only one of these exact responses: "Yes", "No", or "Not enough information". Be strictly faithful to the document. Do not guess or invent scoring logic. Only respond with one of the three allowed answers.'
                  },
                  {
                    role: 'user',
                    content: `QUESTION: ${question.text}\n\nDOCUMENT EXCERPT: ${chunk}`
                  }
                ],
                max_tokens: 10,
                temperature: 0.1
              }),
            });

            const data = await response.json();
            const aiResponse = data.choices[0]?.message?.content?.trim() || 'Not enough information';
            
            // Normalize response
            let normalizedResponse = 'Not enough information';
            if (aiResponse.toLowerCase().includes('yes')) {
              normalizedResponse = 'Yes';
            } else if (aiResponse.toLowerCase().includes('no')) {
              normalizedResponse = 'No';
            }
            
            // If we get a "Yes" from any chunk, that's our best answer
            if (normalizedResponse === 'Yes') {
              bestResponse = 'Yes';
              break;
            } else if (normalizedResponse === 'No' && bestResponse === 'Not enough information') {
              bestResponse = 'No';
            }
            
          } catch (error) {
            console.error(`Error processing chunk for question ${question.id}:`, error);
          }
        }
        
        // Convert response to score
        if (bestResponse === 'Yes') {
          questionScore = question.weight || 1;
        } else if (bestResponse === 'No') {
          questionScore = 0;
        } else {
          questionScore = (question.weight || 1) * 0.5; // Half points for "Not enough information"
        }
        
        totalScore += questionScore;
        maxPossibleScore += (question.weight || 1);
        
        sectionResults.push({
          questionId: question.id,
          questionText: question.text,
          response: bestResponse,
          score: questionScore,
          weight: question.weight || 1
        });
      }
      
      assessmentResults.push({
        sectionId: section.id,
        sectionTitle: section.title,
        questions: sectionResults
      });
    }

    // Calculate final credibility score (0-100)
    const credibilityScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

    // Store assessment report with document file name as company name
    const { data: reportData, error: reportError } = await supabaseClient
      .from('assessment_reports')
      .insert({
        user_id: userId,
        company_name: document.file_name || 'Document Assessment',
        assessment_data: {
          sections: assessmentResults,
          totalScore,
          maxPossibleScore,
          questionnaire_version: questionnaireResponse.data.metadata.version
        },
        credibility_score: credibilityScore,
        report_type: 'comprehensive-questionnaire'
      })
      .select()
      .single();

    if (reportError) {
      throw new Error('Failed to save assessment report');
    }

    // Update document status and make it permanent
    await supabaseClient
      .from('uploaded_documents')
      .update({
        assessment_status: 'completed',
        is_temporary: false
      })
      .eq('id', documentId);

    return new Response(
      JSON.stringify({
        success: true,
        credibilityScore,
        totalScore,
        maxPossibleScore,
        reportId: reportData.id,
        sectionsProcessed: assessmentResults.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in assess-document:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
