
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
        // Enhanced validation for multiple questionnaire formats
        if (!questionnaire_data) {
          throw new Error('Missing questionnaire data');
        }

        let questionnaire;
        let finalVersion;

        // Handle different input formats
        if (questionnaire_data.transition_plan_questionnaire) {
          // Format 1: Nested structure
          questionnaire = questionnaire_data.transition_plan_questionnaire;
          finalVersion = version || questionnaire.metadata?.version || '2.0';
        } else if (questionnaire_data.sections) {
          // Format 2: Direct structure
          questionnaire = questionnaire_data;
          finalVersion = version || questionnaire.version || '2.0';
        } else if (questionnaire_data.basic_assessment_sections) {
          // Format 3: Legacy structure - transform it
          questionnaire = {
            title: 'Transition Plan Credibility Assessment',
            description: 'Enhanced credibility assessment questionnaire',
            sections: []
          };
          
          for (const [sectionKey, sectionData] of Object.entries(questionnaire_data.basic_assessment_sections)) {
            questionnaire.sections.push({
              id: sectionKey,
              title: sectionData.title,
              description: sectionData.description,
              questions: sectionData.questions || []
            });
          }
          
          finalVersion = version || '2.0';
        } else {
          throw new Error('Invalid questionnaire format: unrecognized structure');
        }

        if (!questionnaire.sections || !Array.isArray(questionnaire.sections)) {
          throw new Error('Invalid questionnaire format: missing sections array');
        }

        console.log(`Processing questionnaire with ${questionnaire.sections.length} sections, version: ${finalVersion}`);

        // Enhanced questionnaire structure
        const transformedQuestionnaire = {
          version: finalVersion,
          title: questionnaire.title || 'Transition Plan Credibility Assessment',
          description: questionnaire.description || description || 'Enhanced credibility assessment questionnaire',
          sections: questionnaire.sections
        };

        const fileName = `questionnaire_v${finalVersion}.json`;
        const filePath = `/questionnaires/v${finalVersion}`;
        
        console.log(`Saving questionnaire - name: ${fileName}, path: ${filePath}`);

        // Deactivate all existing questionnaires
        await supabase
          .from('questionnaire_metadata')
          .update({ is_active: false })
          .neq('id', '00000000-0000-0000-0000-000000000000');

        // Insert the new questionnaire
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
          version: finalVersion,
          sections_count: transformedQuestionnaire.sections.length,
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
        // Enhanced retrieval with better fallback handling
        const { data: activeQuestionnaire, error: dbError } = await supabase
          .from('questionnaire_metadata')
          .select('*')
          .eq('is_active', true)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!dbError && activeQuestionnaire) {
          console.log(`Found active questionnaire in database: version ${activeQuestionnaire.version}`);
          console.log(`Questionnaire sections: ${activeQuestionnaire.questionnaire_data?.sections?.length || 0}`);
          
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
        
        // Enhanced fallback to embedded questionnaire
        try {
          const questionnaireText = await Deno.readTextFile('./complete_transition_questionnaire.json');
          const questionnaireData = JSON.parse(questionnaireText);
          
          console.log('Embedded questionnaire loaded successfully');
          console.log(`Embedded questionnaire sections: ${questionnaireData.sections?.length || 0}`);
          
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
          
        } catch (fileError) {
          console.error('Error loading embedded questionnaire:', fileError);
          
          // Enhanced fallback questionnaire with more comprehensive structure
          const fallbackQuestionnaire = {
            version: "2.0",
            title: "Transition Plan Credibility Assessment",
            description: "Enhanced fallback questionnaire for transition plan assessment",
            sections: [
              {
                id: "section_1_red_flags",
                title: "Red Flag Questions",
                description: "Critical questions that if answered 'No' result in Misaligned rating",
                questions: [
                  {
                    id: "rf1",
                    question_text: "Does the organization have a documented net-zero transition strategy?",
                    score_yes: 1,
                    score_no: 0,
                    score_na: 0
                  },
                  {
                    id: "rf2",
                    question_text: "Has the organization set science-based targets for emissions reduction?",
                    score_yes: 1,
                    score_no: 0,
                    score_na: 0
                  },
                  {
                    id: "rf3",
                    question_text: "Does the organization disclose its current greenhouse gas emissions baseline?",
                    score_yes: 1,
                    score_no: 0,
                    score_na: 0
                  }
                ]
              },
              {
                id: "section_2_accountability",
                title: "Accountability",
                description: "Questions that determine the base credibility score",
                questions: [
                  {
                    id: "acc1",
                    question_text: "Are there clear governance structures overseeing the transition plan?",
                    score_yes: 1,
                    score_no: 0,
                    score_na: 0
                  },
                  {
                    id: "acc2",
                    question_text: "Does the organization report progress against transition targets regularly?",
                    score_yes: 1,
                    score_no: 0,
                    score_na: 0
                  },
                  {
                    id: "acc3",
                    question_text: "Are executive compensation packages linked to climate performance?",
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
              version: '2.0',
              uploaded_at: new Date().toISOString(),
              description: 'Enhanced fallback questionnaire due to loading error'
            }
          };

          console.log('Using enhanced fallback questionnaire');
          return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
      } catch (retrieveError) {
        console.error('Error retrieving questionnaire:', retrieveError);
        throw retrieveError;
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
