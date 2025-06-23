
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
    console.log(`Enhanced questionnaire manager v2.0 - Action: ${action}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'upload') {
      console.log('=== Enhanced Questionnaire Upload v2.0 ===');
      
      try {
        if (!questionnaire_data) {
          throw new Error('Missing questionnaire data');
        }

        console.log('Raw questionnaire structure analysis:', JSON.stringify({
          hasTransitionPlan: !!questionnaire_data.transition_plan_questionnaire,
          hasSections: !!questionnaire_data.sections,
          hasBasicSections: !!questionnaire_data.basic_assessment_sections,
          topLevelKeys: Object.keys(questionnaire_data),
          dataType: typeof questionnaire_data
        }, null, 2));

        let questionnaire;
        let finalVersion;
        let totalQuestions = 0;

        // Enhanced structure transformation with better logging
        if (questionnaire_data.transition_plan_questionnaire) {
          console.log('Processing Format 1: Nested transition_plan_questionnaire structure');
          const nestedData = questionnaire_data.transition_plan_questionnaire;
          
          if (nestedData.basic_assessment_sections) {
            questionnaire = {
              title: 'Enhanced Transition Plan Credibility Assessment',
              description: 'Comprehensive 265-question credibility assessment questionnaire',
              sections: []
            };
            
            for (const [sectionKey, sectionData] of Object.entries(nestedData.basic_assessment_sections)) {
              const section = {
                id: sectionKey,
                title: sectionData.title,
                description: sectionData.description,
                questions: sectionData.questions || []
              };
              questionnaire.sections.push(section);
              totalQuestions += section.questions.length;
            }
          } else if (nestedData.sections) {
            questionnaire = nestedData;
            questionnaire.sections.forEach(section => {
              if (section.questions && Array.isArray(section.questions)) {
                totalQuestions += section.questions.length;
              }
            });
          } else {
            questionnaire = nestedData;
          }
          finalVersion = version || nestedData.metadata?.version || '4.0';
        } else if (questionnaire_data.sections) {
          console.log('Processing Format 2: Direct sections structure');
          questionnaire = questionnaire_data;
          questionnaire.sections.forEach(section => {
            if (section.questions && Array.isArray(section.questions)) {
              totalQuestions += section.questions.length;
            }
          });
          finalVersion = version || questionnaire.version || '4.0';
        } else if (questionnaire_data.basic_assessment_sections) {
          console.log('Processing Format 3: Legacy basic_assessment_sections structure');
          questionnaire = {
            title: 'Enhanced Transition Plan Credibility Assessment',
            description: 'Comprehensive credibility assessment questionnaire',
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
          console.log('Processing unknown format, attempting auto-detection...');
          const keys = Object.keys(questionnaire_data);
          console.log('Available keys for auto-detection:', keys);
          
          let foundData = null;
          for (const key of keys) {
            const value = questionnaire_data[key];
            if (value && typeof value === 'object' && (value.sections || value.basic_assessment_sections)) {
              foundData = value;
              console.log(`Found questionnaire data in key: ${key}`);
              break;
            }
          }
          
          if (foundData) {
            if (foundData.basic_assessment_sections) {
              questionnaire = {
                title: 'Enhanced Transition Plan Credibility Assessment',
                description: 'Comprehensive credibility assessment questionnaire',
                sections: []
              };
              
              for (const [sectionKey, sectionData] of Object.entries(foundData.basic_assessment_sections)) {
                const section = {
                  id: sectionKey,
                  title: sectionData.title,
                  description: sectionData.description,
                  questions: sectionData.questions || []
                };
                questionnaire.sections.push(section);
                totalQuestions += section.questions.length;
              }
            } else {
              questionnaire = foundData;
              questionnaire.sections.forEach(section => {
                if (section.questions && Array.isArray(section.questions)) {
                  totalQuestions += section.questions.length;
                }
              });
            }
            finalVersion = version || foundData.version || '4.0';
          } else {
            throw new Error(`Invalid questionnaire format: unrecognized structure. Available keys: ${keys.join(', ')}`);
          }
        }

        // Enhanced validation AFTER transformation
        if (!questionnaire.sections || !Array.isArray(questionnaire.sections)) {
          console.error('Validation failed after transformation:', JSON.stringify({
            hasSections: !!questionnaire.sections,
            sectionsType: typeof questionnaire.sections,
            isArray: Array.isArray(questionnaire.sections),
            questionnaireKeys: Object.keys(questionnaire)
          }, null, 2));
          throw new Error('Invalid questionnaire format: missing or invalid sections array after transformation');
        }

        if (totalQuestions === 0) {
          questionnaire.sections.forEach(section => {
            if (section.questions && Array.isArray(section.questions)) {
              totalQuestions += section.questions.length;
            }
          });
        }

        console.log(`✅ Questionnaire validated successfully: ${questionnaire.sections.length} sections, ${totalQuestions} questions, version: ${finalVersion}`);

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
        
        console.log(`Saving questionnaire - name: ${fileName}, path: ${filePath}, questions: ${totalQuestions}`);

        // FIXED: Properly deactivate existing questionnaires with explicit WHERE clause
        console.log('Deactivating existing questionnaires...');
        const { error: deactivateError } = await supabase
          .from('questionnaire_metadata')
          .update({ is_active: false })
          .eq('is_active', true);

        if (deactivateError) {
          console.warn('Warning: Could not deactivate existing questionnaires:', deactivateError);
        } else {
          console.log('✅ Successfully deactivated existing questionnaires');
        }

        // Insert the new questionnaire with enhanced error handling
        console.log('Inserting new questionnaire...');
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

        console.log('✅ Enhanced questionnaire uploaded successfully:', {
          id: insertData.id,
          version: finalVersion,
          totalQuestions: totalQuestions,
          sections: transformedQuestionnaire.sections.length,
          isActive: insertData.is_active
        });

        return new Response(JSON.stringify({ 
          success: true, 
          questionnaire_id: insertData.id,
          version: finalVersion,
          sections_count: transformedQuestionnaire.sections.length,
          total_questions: totalQuestions,
          is_active: insertData.is_active,
          message: `Enhanced questionnaire with ${totalQuestions} questions uploaded and activated successfully`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (uploadError) {
        console.error('❌ Error processing enhanced upload:', uploadError);
        console.error('Error stack:', uploadError.stack);
        return new Response(
          JSON.stringify({ 
            error: uploadError.message,
            success: false,
            action: 'upload',
            details: uploadError.stack
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    if (action === 'retrieve') {
      console.log('=== Enhanced Questionnaire Retrieval v2.0 ===');
      
      try {
        const { data: activeQuestionnaire, error: dbError } = await supabase
          .from('questionnaire_metadata')
          .select('*')
          .eq('is_active', true)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!dbError && activeQuestionnaire) {
          const questionnaireData = activeQuestionnaire.questionnaire_data;
          console.log(`✅ Found active questionnaire: version ${activeQuestionnaire.version}`);
          console.log(`Questionnaire details:`, {
            sections: questionnaireData?.sections?.length || 0,
            totalQuestions: questionnaireData?.totalQuestions || 'unknown',
            enhanced: questionnaireData?.enhanced || false,
            isActive: activeQuestionnaire.is_active
          });
          
          const response = {
            questionnaire: questionnaireData,
            metadata: {
              version: activeQuestionnaire.version,
              uploaded_at: activeQuestionnaire.uploaded_at,
              description: activeQuestionnaire.description,
              totalQuestions: questionnaireData?.totalQuestions,
              enhanced: questionnaireData?.enhanced,
              is_active: activeQuestionnaire.is_active
            }
          };

          return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('⚠️ No active questionnaire in database, loading embedded questionnaire...');
        
        // Enhanced fallback to embedded questionnaire
        try {
          const questionnaireText = await Deno.readTextFile('./complete_transition_questionnaire.json');
          const questionnaireData = JSON.parse(questionnaireText);
          
          let embeddedQuestions = 0;
          if (questionnaireData.sections) {
            questionnaireData.sections.forEach(section => {
              if (section.questions) {
                embeddedQuestions += section.questions.length;
              }
            });
          }
          
          console.log('✅ Embedded questionnaire loaded successfully');
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
              enhanced: false,
              is_active: false
            }
          };

          return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
          
        } catch (fileError) {
          console.error('❌ Error loading embedded questionnaire:', fileError);
          
          // Enhanced fallback questionnaire for testing
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
              enhanced: true,
              is_active: false
            }
          };

          console.log('⚠️ Using enhanced fallback questionnaire');
          return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
      } catch (retrieveError) {
        console.error('❌ Error retrieving enhanced questionnaire:', retrieveError);
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
    console.error('❌ Error in enhanced questionnaire-manager v2.0:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
