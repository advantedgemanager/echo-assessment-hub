
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
      console.log('Processing enhanced questionnaire upload...');
      
      try {
        // Enhanced validation for large questionnaire uploads (265 questions)
        if (!questionnaire_data) {
          throw new Error('Missing questionnaire data');
        }

        let questionnaire;
        let finalVersion;
        let totalQuestions = 0;

        // Handle different input formats with enhanced validation
        if (questionnaire_data.transition_plan_questionnaire) {
          // Format 1: Nested structure
          questionnaire = questionnaire_data.transition_plan_questionnaire;
          finalVersion = version || questionnaire.metadata?.version || '4.0';
        } else if (questionnaire_data.sections) {
          // Format 2: Direct structure
          questionnaire = questionnaire_data;
          finalVersion = version || questionnaire.version || '4.0';
        } else if (questionnaire_data.basic_assessment_sections) {
          // Format 3: Legacy structure - transform it
          questionnaire = {
            title: 'Enhanced Transition Plan Credibility Assessment',
            description: 'Comprehensive 265-question credibility assessment questionnaire',
            sections: []
          };
          
          for (const [sectionKey, sectionData] of Object.entries(questionnaire_data.basic_assessment_sections)) {
            const section = {
              id: sectionKey,
              title: sectionData.title,
              description: sectionData.description,
              questions: sectionData.questions || []
            };
            questionnaire.sections.push(section);
            totalQuestions += section.questions.length;
          }
          
          finalVersion = version || '4.0';
        } else {
          throw new Error('Invalid questionnaire format: unrecognized structure');
        }

        if (!questionnaire.sections || !Array.isArray(questionnaire.sections)) {
          throw new Error('Invalid questionnaire format: missing sections array');
        }

        // Count total questions for validation
        if (totalQuestions === 0) {
          questionnaire.sections.forEach(section => {
            if (section.questions && Array.isArray(section.questions)) {
              totalQuestions += section.questions.length;
            }
          });
        }

        console.log(`Processing enhanced questionnaire with ${questionnaire.sections.length} sections and ${totalQuestions} total questions, version: ${finalVersion}`);

        // Validate large questionnaire structure
        if (totalQuestions > 300) {
          console.warn(`Very large questionnaire detected: ${totalQuestions} questions. Performance may be impacted.`);
        }

        if (totalQuestions === 0) {
          throw new Error('No questions found in questionnaire sections');
        }

        // Enhanced questionnaire structure with metadata
        const transformedQuestionnaire = {
          version: finalVersion,
          title: questionnaire.title || 'Enhanced Transition Plan Credibility Assessment',
          description: questionnaire.description || description || `Comprehensive ${totalQuestions}-question credibility assessment questionnaire`,
          totalQuestions: totalQuestions,
          sections: questionnaire.sections,
          uploadedAt: new Date().toISOString(),
          enhanced: true
        };

        const fileName = `enhanced_questionnaire_v${finalVersion}.json`;
        const filePath = `/questionnaires/enhanced/v${finalVersion}`;
        
        console.log(`Saving enhanced questionnaire - name: ${fileName}, path: ${filePath}, questions: ${totalQuestions}`);

        // Deactivate all existing questionnaires
        const { error: deactivateError } = await supabase
          .from('questionnaire_metadata')
          .update({ is_active: false })
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (deactivateError) {
          console.warn('Warning: Could not deactivate existing questionnaires:', deactivateError);
        }

        // Insert the new enhanced questionnaire
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
          throw new Error(`Failed to save enhanced questionnaire: ${insertError.message}`);
        }

        console.log('Enhanced questionnaire uploaded successfully:', {
          id: insertData.id,
          version: finalVersion,
          totalQuestions: totalQuestions,
          sections: questionnaire.sections.length
        });

        return new Response(JSON.stringify({ 
          success: true, 
          questionnaire_id: insertData.id,
          version: finalVersion,
          sections_count: transformedQuestionnaire.sections.length,
          total_questions: totalQuestions,
          message: `Enhanced questionnaire with ${totalQuestions} questions uploaded and activated successfully`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (uploadError) {
        console.error('Error processing enhanced upload:', uploadError);
        return new Response(
          JSON.stringify({ 
            error: uploadError.message,
            success: false,
            action: 'upload'
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    if (action === 'retrieve') {
      console.log('Retrieving enhanced questionnaire...');
      
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
          const questionnaireData = activeQuestionnaire.questionnaire_data;
          console.log(`Found active questionnaire in database: version ${activeQuestionnaire.version}`);
          console.log(`Questionnaire details:`, {
            sections: questionnaireData?.sections?.length || 0,
            totalQuestions: questionnaireData?.totalQuestions || 'unknown',
            enhanced: questionnaireData?.enhanced || false
          });
          
          const response = {
            questionnaire: questionnaireData,
            metadata: {
              version: activeQuestionnaire.version,
              uploaded_at: activeQuestionnaire.uploaded_at,
              description: activeQuestionnaire.description,
              totalQuestions: questionnaireData?.totalQuestions,
              enhanced: questionnaireData?.enhanced
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
          
          // Count questions in embedded questionnaire
          let embeddedQuestions = 0;
          if (questionnaireData.sections) {
            questionnaireData.sections.forEach(section => {
              if (section.questions) {
                embeddedQuestions += section.questions.length;
              }
            });
          }
          
          console.log('Embedded questionnaire loaded successfully');
          console.log(`Embedded questionnaire details:`, {
            sections: questionnaireData.sections?.length || 0,
            totalQuestions: embeddedQuestions
          });
          
          const response = {
            questionnaire: questionnaireData,
            metadata: {
              version: questionnaireData.version || '1.0',
              uploaded_at: new Date().toISOString(),
              description: questionnaireData.description || 'Embedded transition plan questionnaire',
              totalQuestions: embeddedQuestions,
              enhanced: false
            }
          };

          return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
          
        } catch (fileError) {
          console.error('Error loading embedded questionnaire:', fileError);
          
          // Enhanced fallback questionnaire with comprehensive structure for testing
          const fallbackQuestionnaire = {
            version: "4.0",
            title: "Enhanced Transition Plan Credibility Assessment",
            description: "Enhanced fallback questionnaire for transition plan assessment",
            totalQuestions: 6,
            enhanced: true,
            sections: [
              {
                id: "section_1_red_flags",
                title: "Red Flag Questions",
                description: "Critical questions that if answered 'No' result in Misaligned rating",
                questions: [
                  {
                    id: "rf1",
                    question_text: "Does the organization have a documented net-zero transition strategy with specific timelines?",
                    score_yes: 1,
                    score_no: 0,
                    score_na: 0
                  },
                  {
                    id: "rf2",
                    question_text: "Has the organization set science-based targets (SBTi) for emissions reduction?",
                    score_yes: 1,
                    score_no: 0,
                    score_na: 0
                  },
                  {
                    id: "rf3",
                    question_text: "Does the organization disclose its current greenhouse gas emissions baseline (Scope 1, 2, and 3)?",
                    score_yes: 1,
                    score_no: 0,
                    score_na: 0
                  }
                ]
              },
              {
                id: "section_2_accountability",
                title: "Accountability and Governance",
                description: "Questions that determine governance and accountability mechanisms",
                questions: [
                  {
                    id: "acc1",
                    question_text: "Are there clear board-level governance structures overseeing the transition plan implementation?",
                    score_yes: 1,
                    score_no: 0,
                    score_na: 0
                  },
                  {
                    id: "acc2",
                    question_text: "Does the organization report progress against transition targets regularly with third-party verification?",
                    score_yes: 1,
                    score_no: 0,
                    score_na: 0
                  },
                  {
                    id: "acc3",
                    question_text: "Are executive compensation packages explicitly linked to climate performance metrics?",
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
              version: '4.0',
              uploaded_at: new Date().toISOString(),
              description: 'Enhanced fallback questionnaire due to loading error',
              totalQuestions: 6,
              enhanced: true
            }
          };

          console.log('Using enhanced fallback questionnaire');
          return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
      } catch (retrieveError) {
        console.error('Error retrieving enhanced questionnaire:', retrieveError);
        throw retrieveError;
      }
    }

    return new Response(
      JSON.stringify({ 
        error: 'Invalid action. Supported actions: retrieve, upload',
        success: false
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in enhanced questionnaire-manager:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
