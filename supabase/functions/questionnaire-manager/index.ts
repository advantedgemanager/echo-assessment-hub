
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, questionnaire_data, version, description } = await req.json();
    console.log(`Request method: ${req.method} Action: ${action}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'upload') {
      console.log('Processing questionnaire upload...');
      
      try {
        // Validate the questionnaire structure
        if (!questionnaire_data || !questionnaire_data.transition_plan_questionnaire) {
          throw new Error('Invalid questionnaire format: missing transition_plan_questionnaire');
        }

        const questionnaire = questionnaire_data.transition_plan_questionnaire;
        
        if (!questionnaire.metadata || !questionnaire.basic_assessment_sections) {
          throw new Error('Invalid questionnaire format: missing required sections');
        }

        // Use the version parameter directly from request, with fallback
        const finalVersion = version || questionnaire.metadata.version || '1.0';
        console.log(`Using version: ${finalVersion}`);

        // Transform the uploaded structure to match the expected format
        const transformedQuestionnaire = {
          version: finalVersion,
          title: questionnaire.metadata.title || 'Transition Plan Credibility Assessment',
          description: questionnaire.metadata.description || description || 'Credibility assessment questionnaire',
          sections: []
        };

        // Transform sections
        const sections = questionnaire.basic_assessment_sections;
        for (const sectionKey of Object.keys(sections)) {
          const section = sections[sectionKey];
          transformedQuestionnaire.sections.push({
            id: sectionKey,
            title: section.title,
            description: section.description,
            questions: section.questions
          });
        }

        console.log(`Transformed questionnaire with ${transformedQuestionnaire.sections.length} sections`);

        // Construct file metadata with proper fallbacks
        const fileName = `questionnaire_v${finalVersion}.json`;
        const filePath = `/questionnaires/v${finalVersion}`;
        
        console.log(`File metadata - name: ${fileName}, path: ${filePath}`);

        // Deactivate all existing questionnaires
        await supabase
          .from('questionnaire_metadata')
          .update({ is_active: false })
          .neq('id', '00000000-0000-0000-0000-000000000000');

        // Insert the new questionnaire with proper file metadata
        const { data: insertData, error: insertError } = await supabase
          .from('questionnaire_metadata')
          .insert({
            file_name: fileName,
            file_path: filePath,
            version: finalVersion,
            description: transformedQuestionnaire.description,
            questionnaire_data: transformedQuestionnaire,
            is_active: true
          })
          .select()
          .single();

        if (insertError) {
          console.error('Database insert error:', insertError);
          throw new Error(`Failed to save questionnaire: ${insertError.message}`);
        }

        console.log('Questionnaire uploaded successfully:', insertData.id);

        return new Response(JSON.stringify({ 
          success: true, 
          questionnaire_id: insertData.id,
          message: 'Questionnaire uploaded and activated successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (uploadError) {
        console.error('Error processing upload:', uploadError);
        return new Response(
          JSON.stringify({ error: uploadError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    if (action === 'retrieve') {
      console.log('Retrieving questionnaire...');
      
      try {
        // First try to get active questionnaire from database
        const { data: activeQuestionnaire, error: dbError } = await supabase
          .from('questionnaire_metadata')
          .select('*')
          .eq('is_active', true)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!dbError && activeQuestionnaire) {
          console.log('Found active questionnaire in database');
          const response = {
            questionnaire: activeQuestionnaire.questionnaire_data,
            metadata: {
              version: activeQuestionnaire.version,
              uploaded_at: activeQuestionnaire.uploaded_at,
              description: activeQuestionnaire.description
            }
          };

          return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('No active questionnaire in database, loading embedded questionnaire...');
        
        // Fallback to embedded questionnaire
        const questionnaireText = await Deno.readTextFile('./complete_transition_questionnaire.json');
        const questionnaireData = JSON.parse(questionnaireText);
        
        console.log('Embedded questionnaire loaded successfully');
        
        const response = {
          questionnaire: questionnaireData,
          metadata: {
            version: questionnaireData.version || '1.0',
            uploaded_at: new Date().toISOString(),
            description: questionnaireData.description || 'Embedded transition plan questionnaire'
          }
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (retrieveError) {
        console.error('Error retrieving questionnaire:', retrieveError);
        
        // Final fallback: return a basic questionnaire structure
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
            }
          ]
        };

        const response = {
          questionnaire: fallbackQuestionnaire,
          metadata: {
            version: '1.0',
            uploaded_at: new Date().toISOString(),
            description: 'Fallback questionnaire due to loading error'
          }
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Supported actions: retrieve, upload' }),
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
