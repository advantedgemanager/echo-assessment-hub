
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
    const requestBody = await req.json();
    console.log('🔍 Raw request body:', JSON.stringify(requestBody, null, 2));
    
    const { action, questionnaire_data, version, description } = requestBody;
    console.log(`🚀 Questionnaire manager v4.0 - Action: ${action}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'upload') {
      console.log('=== Questionnaire Upload v4.0 ===');
      
      try {
        if (!questionnaire_data) {
          throw new Error('Missing questionnaire data in request');
        }

        console.log('📋 Analyzing questionnaire structure...');
        console.log('Top-level keys:', Object.keys(questionnaire_data));

        let transformedQuestionnaire;
        let finalVersion = version || '4.0';
        let totalQuestions = 0;

        // Enhanced structure detection and transformation
        if (questionnaire_data.transition_plan_credibility_questionnaire) {
          console.log('📋 Processing transition_plan_credibility_questionnaire format');
          const credibilityData = questionnaire_data.transition_plan_credibility_questionnaire;
          console.log('Credibility data keys:', Object.keys(credibilityData));
          
          if (credibilityData.sections && typeof credibilityData.sections === 'object') {
            console.log('🔧 Converting sections object to array format');
            
            const sectionsArray = [];
            for (const [sectionKey, sectionData] of Object.entries(credibilityData.sections)) {
              if (sectionData && typeof sectionData === 'object' && Array.isArray(sectionData.questions)) {
                const section = {
                  id: sectionKey,
                  title: sectionData.title || sectionKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                  description: sectionData.description || '',
                  questions: sectionData.questions
                };
                sectionsArray.push(section);
                console.log(`✅ Section ${sectionKey}: ${section.questions.length} questions`);
              }
            }
            
            transformedQuestionnaire = {
              version: finalVersion,
              title: credibilityData.title || 'Transition Plan Credibility Assessment',
              description: credibilityData.description || 'Comprehensive credibility assessment questionnaire',
              sections: sectionsArray
            };
          } else {
            throw new Error('Invalid credibility questionnaire format: sections must be an object with question arrays');
          }
        } else if (questionnaire_data.sections && Array.isArray(questionnaire_data.sections)) {
          console.log('📋 Processing direct sections array format');
          transformedQuestionnaire = {
            version: finalVersion,
            title: questionnaire_data.title || 'Transition Plan Credibility Assessment',
            description: questionnaire_data.description || 'Comprehensive credibility assessment questionnaire',
            sections: questionnaire_data.sections
          };
        } else {
          throw new Error(`Unsupported questionnaire format. Available keys: ${Object.keys(questionnaire_data).join(', ')}`);
        }

        // Validate the transformed questionnaire
        if (!transformedQuestionnaire.sections || !Array.isArray(transformedQuestionnaire.sections)) {
          console.error('❌ Transformation failed: sections is not an array');
          console.error('Transformed structure:', JSON.stringify(transformedQuestionnaire, null, 2));
          throw new Error('Questionnaire transformation failed: sections must be an array');
        }

        // Count total questions
        totalQuestions = transformedQuestionnaire.sections.reduce((total, section) => {
          if (section.questions && Array.isArray(section.questions)) {
            return total + section.questions.length;
          }
          return total;
        }, 0);

        console.log(`✅ Questionnaire validated: ${transformedQuestionnaire.sections.length} sections, ${totalQuestions} questions`);

        if (totalQuestions === 0) {
          throw new Error('No questions found in questionnaire sections');
        }

        // Enhanced questionnaire structure with metadata
        const enhancedQuestionnaire = {
          version: finalVersion,
          title: transformedQuestionnaire.title,
          description: transformedQuestionnaire.description,
          totalQuestions: totalQuestions,
          sections: transformedQuestionnaire.sections,
          uploadedAt: new Date().toISOString(),
          enhanced: true
        };

        const fileName = `questionnaire_v${finalVersion}.json`;
        const filePath = `/questionnaires/v${finalVersion}`;
        
        console.log(`💾 Saving questionnaire: ${fileName} (${totalQuestions} questions)`);

        // Deactivate existing questionnaires
        console.log('🔄 Deactivating existing questionnaires...');
        const { error: deactivateError } = await supabase
          .from('questionnaire_metadata')
          .update({ is_active: false })
          .eq('is_active', true);

        if (deactivateError) {
          console.warn('⚠️ Warning: Could not deactivate existing questionnaires:', deactivateError);
        }

        // Insert the new questionnaire
        console.log('📥 Inserting new questionnaire...');
        const { data: insertData, error: insertError } = await supabase
          .from('questionnaire_metadata')
          .insert({
            file_name: fileName,
            file_path: filePath,
            version: finalVersion,
            description: enhancedQuestionnaire.description,
            questionnaire_data: enhancedQuestionnaire,
            is_active: true
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Database insert error:', insertError);
          throw new Error(`Failed to save questionnaire: ${insertError.message}`);
        }

        console.log('🎉 Questionnaire uploaded successfully:', {
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
          message: `Questionnaire with ${totalQuestions} questions uploaded and activated successfully`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (uploadError) {
        console.error('❌ Upload processing error:', uploadError);
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
      console.log('=== Questionnaire Retrieval v4.0 ===');
      
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
          console.log(`📊 Details: ${questionnaireData?.sections?.length || 0} sections, ${questionnaireData?.totalQuestions || 'unknown'} questions`);
          
          return new Response(JSON.stringify({
            questionnaire: questionnaireData,
            metadata: {
              version: activeQuestionnaire.version,
              uploaded_at: activeQuestionnaire.uploaded_at,
              description: activeQuestionnaire.description,
              totalQuestions: questionnaireData?.totalQuestions,
              enhanced: questionnaireData?.enhanced,
              is_active: activeQuestionnaire.is_active
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('⚠️ No active questionnaire found, loading fallback...');
        
        // Fallback questionnaire
        const fallbackQuestionnaire = {
          version: "4.0",
          title: "Fallback Transition Plan Assessment",
          description: "Basic fallback questionnaire",
          totalQuestions: 4,
          enhanced: true,
          sections: [
            {
              id: "basic_assessment",
              title: "Basic Assessment",
              description: "Essential transition plan questions",
              questions: [
                {
                  id: "q1",
                  question_text: "Does the organization have a documented transition strategy?",
                  score_yes: 1,
                  score_no: 0,
                  score_na: 0
                },
                {
                  id: "q2",
                  question_text: "Are there specific emissions reduction targets?",
                  score_yes: 1,
                  score_no: 0,
                  score_na: 0
                },
                {
                  id: "q3",
                  question_text: "Is there board-level oversight of the transition plan?",
                  score_yes: 1,
                  score_no: 0,
                  score_na: 0
                },
                {
                  id: "q4",
                  question_text: "Are progress reports published regularly?",
                  score_yes: 1,
                  score_no: 0,
                  score_na: 0
                }
              ]
            }
          ]
        };

        return new Response(JSON.stringify({
          questionnaire: fallbackQuestionnaire,
          metadata: {
            version: '4.0',
            uploaded_at: new Date().toISOString(),
            description: 'Fallback questionnaire',
            totalQuestions: 4,
            enhanced: true,
            is_active: false
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (retrieveError) {
        console.error('❌ Error retrieving questionnaire:', retrieveError);
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
    console.error('❌ Error in questionnaire-manager v4.0:', error);
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
