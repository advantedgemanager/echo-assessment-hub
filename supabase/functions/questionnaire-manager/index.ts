
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();
    console.log(`Request method: ${req.method} Action: ${action}`);

    if (action === 'retrieve') {
      console.log('Loading embedded questionnaire...');
      
      try {
        // Read the embedded questionnaire file
        const questionnaireText = await Deno.readTextFile('./complete_transition_questionnaire.json');
        const questionnaireData = JSON.parse(questionnaireText);
        
        console.log('Embedded questionnaire loaded successfully');
        
        // Return the questionnaire with metadata
        const response = {
          questionnaire: questionnaireData,
          metadata: {
            version: questionnaireData.version || '1.0',
            uploaded_at: new Date().toISOString(),
            description: questionnaireData.description || 'Transition Plan Credibility Assessment'
          }
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (fileError) {
        console.error('Error loading embedded questionnaire:', fileError);
        
        // Fallback: return a basic questionnaire structure if file not found
        const fallbackQuestionnaire = {
          version: "1.0",
          title: "Transition Plan Credibility Assessment",
          description: "Basic questionnaire for transition plan assessment",
          sections: [
            {
              id: "section_1_red_flags",
              title: "Red Flag Questions",
              questions: [
                {
                  id: "1",
                  question_text: "Does the organization have a documented transition strategy?",
                  score_yes: 1,
                  score_no: 0,
                  score_na: 0
                }
              ]
            },
            {
              id: "section_2_accountability",
              title: "Accountability",
              questions: [
                {
                  id: "2",
                  question_text: "Are there clear accountability measures in place?",
                  score_yes: 1,
                  score_no: 0,
                  score_na: 0
                }
              ]
            }
          ]
        };

        const response = {
          questionnaire: fallbackQuestionnaire,
          metadata: {
            version: '1.0',
            uploaded_at: new Date().toISOString(),
            description: 'Fallback questionnaire due to file loading error'
          }
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in questionnaire-manager:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
