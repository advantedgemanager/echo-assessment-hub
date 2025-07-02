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
    console.log('🔍 Request received:', {
      action: requestBody.action,
      hasQuestionnaireData: !!requestBody.questionnaire_data,
      topLevelKeys: requestBody.questionnaire_data ? Object.keys(requestBody.questionnaire_data) : []
    });
    
    const { action, questionnaire_data, version, description } = requestBody;
    console.log(`🚀 Questionnaire manager v5.1 - Action: ${action} - Timestamp: ${new Date().toISOString()}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'upload') {
      console.log('=== Questionnaire Upload v5.1 ===');
      
      try {
        if (!questionnaire_data) {
          throw new Error('Missing questionnaire data in request');
        }

        console.log('📋 Analyzing questionnaire structure...');
        console.log('Available top-level keys:', Object.keys(questionnaire_data));

        let transformedQuestionnaire;
        let finalVersion = version || '5.1';
        let totalQuestions = 0;

        // Handle nested transition_plan_questionnaire structure
        if (questionnaire_data.transition_plan_questionnaire) {
          console.log('📋 Processing nested transition_plan_questionnaire format');
          const tpq = questionnaire_data.transition_plan_questionnaire;
          
          console.log('TPQ structure keys:', Object.keys(tpq));
          
          // Extract metadata if available
          const metadata = tpq.metadata || {};
          const title = metadata.title || 'Transition Plan Credibility Assessment';
          const desc = metadata.description || 'Comprehensive credibility assessment questionnaire';
          
          let sectionsArray = [];
          
          // Handle basic_assessment_sections (object format)
          if (tpq.basic_assessment_sections) {
            console.log('🔧 Converting basic_assessment_sections object to array format');
            const sections = tpq.basic_assessment_sections;
            
            for (const [sectionKey, sectionData] of Object.entries(sections)) {
              if (sectionData && typeof sectionData === 'object') {
                const section = {
                  id: sectionKey,
                  title: sectionData.title || sectionKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                  description: sectionData.description || '',
                  questions: sectionData.questions || []
                };
                sectionsArray.push(section);
                totalQuestions += section.questions.length;
                console.log(`✅ Section ${sectionKey}: ${section.questions.length} questions`);
              }
            }
          }
          // Handle direct sections array
          else if (tpq.sections && Array.isArray(tpq.sections)) {
            console.log('📋 Using direct sections array');
            sectionsArray = tpq.sections;
            totalQuestions = sectionsArray.reduce((total, section) => {
              return total + (section.questions ? section.questions.length : 0);
            }, 0);
          }
          // Handle sections as object (convert to array)
          else if (tpq.sections && typeof tpq.sections === 'object') {
            console.log('🔧 Converting sections object to array format');
            for (const [sectionKey, sectionData] of Object.entries(tpq.sections)) {
              if (sectionData && typeof sectionData === 'object') {
                const section = {
                  id: sectionKey,
                  title: sectionData.title || sectionKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                  description: sectionData.description || '',
                  questions: sectionData.questions || []
                };
                sectionsArray.push(section);
                totalQuestions += section.questions.length;
                console.log(`✅ Section ${sectionKey}: ${section.questions.length} questions`);
              }
            }
          }
          
          if (sectionsArray.length === 0) {
            throw new Error('No valid sections found in transition_plan_questionnaire structure');
          }
          
          transformedQuestionnaire = {
            version: finalVersion,
            title: title,
            description: desc,
            sections: sectionsArray
          };
        }
        // Handle direct sections array format
        else if (questionnaire_data.sections && Array.isArray(questionnaire_data.sections)) {
          console.log('📋 Processing direct sections array format');
          transformedQuestionnaire = {
            version: finalVersion,
            title: questionnaire_data.title || 'Transition Plan Credibility Assessment',
            description: questionnaire_data.description || 'Comprehensive credibility assessment questionnaire',
            sections: questionnaire_data.sections
          };
          totalQuestions = transformedQuestionnaire.sections.reduce((total, section) => {
            return total + (section.questions ? section.questions.length : 0);
          }, 0);
        }
        else {
          const availableKeys = Object.keys(questionnaire_data);
          console.error('❌ Unsupported questionnaire format. Available keys:', availableKeys);
          throw new Error(`Unsupported questionnaire format. Available keys: ${availableKeys.join(', ')}`);
        }

        // Final validation
        if (!transformedQuestionnaire.sections || !Array.isArray(transformedQuestionnaire.sections)) {
          console.error('❌ Transformation failed: sections is not an array');
          throw new Error('Questionnaire transformation failed: sections must be an array');
        }

        console.log(`✅ Questionnaire transformed successfully:`);
        console.log(`   - Sections: ${transformedQuestionnaire.sections.length}`);
        console.log(`   - Total Questions: ${totalQuestions}`);
        console.log(`   - Title: ${transformedQuestionnaire.title}`);

        if (totalQuestions === 0) {
          throw new Error('No questions found in questionnaire sections');
        }

        // Enhanced questionnaire structure with metadata and cache-busting timestamp
        const enhancedQuestionnaire = {
          version: finalVersion,
          title: transformedQuestionnaire.title,
          description: transformedQuestionnaire.description,
          totalQuestions: totalQuestions,
          sections: transformedQuestionnaire.sections,
          uploadedAt: new Date().toISOString(),
          lastModified: Date.now(), // Cache-busting timestamp
          enhanced: true
        };

        const fileName = `questionnaire_v${finalVersion}.json`;
        const filePath = `/questionnaires/v${finalVersion}`;
        
        console.log(`💾 Saving questionnaire: ${fileName} (${totalQuestions} questions) - Fresh at ${enhancedQuestionnaire.lastModified}`);

        // Deactivate existing questionnaires with explicit timestamp logging
        console.log('🔄 Deactivating existing questionnaires...');
        const { error: deactivateError } = await supabase
          .from('questionnaire_metadata')
          .update({ 
            is_active: false,
            updated_at: new Date().toISOString() // Force timestamp update
          })
          .eq('is_active', true);

        if (deactivateError) {
          console.warn('⚠️ Warning: Could not deactivate existing questionnaires:', deactivateError);
        }

        // Insert the new questionnaire with explicit timestamps
        console.log('📥 Inserting new questionnaire with fresh timestamp...');
        const { data: insertData, error: insertError } = await supabase
          .from('questionnaire_metadata')
          .insert({
            file_name: fileName,
            file_path: filePath,
            version: finalVersion,
            description: enhancedQuestionnaire.description,
            questionnaire_data: enhancedQuestionnaire,
            is_active: true,
            uploaded_at: new Date().toISOString(),
            updated_at: new Date().toISOString() // Explicit update timestamp
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Database insert error:', insertError);
          throw new Error(`Failed to save questionnaire: ${insertError.message}`);
        }

        console.log('🎉 Questionnaire uploaded successfully with fresh data!');
        console.log(`   - ID: ${insertData.id}`);
        console.log(`   - Version: ${finalVersion}`);
        console.log(`   - Questions: ${totalQuestions}`);
        console.log(`   - Sections: ${transformedQuestionnaire.sections.length}`);
        console.log(`   - Active: ${insertData.is_active}`);
        console.log(`   - Cache-busting timestamp: ${enhancedQuestionnaire.lastModified}`);

        return new Response(JSON.stringify({ 
          success: true, 
          questionnaire_id: insertData.id,
          version: finalVersion,
          sections_count: transformedQuestionnaire.sections.length,
          total_questions: totalQuestions,
          is_active: insertData.is_active,
          cache_buster: enhancedQuestionnaire.lastModified,
          message: `Questionnaire with ${totalQuestions} questions uploaded and activated successfully`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (uploadError) {
        console.error('❌ Upload processing error:', uploadError);
        console.error('Error details:', {
          message: uploadError.message,
          stack: uploadError.stack
        });
        
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
      console.log('=== Questionnaire Retrieval v5.1 - FRESH QUERY ===');
      
      try {
        // Force fresh query with explicit ordering and no cache
        console.log('🔍 Executing FRESH database query for active questionnaire...');
        const { data: activeQuestionnaire, error: dbError } = await supabase
          .from('questionnaire_metadata')
          .select('*')
          .eq('is_active', true)
          .order('uploaded_at', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (dbError) {
          console.error('Database error:', dbError);
          throw new Error(`Database error: ${dbError.message}`);
        }

        if (activeQuestionnaire) {
          const questionnaireData = activeQuestionnaire.questionnaire_data;
          const cacheBuster = questionnaireData?.lastModified || Date.now();
          
          console.log(`✅ Found FRESH active questionnaire: version ${activeQuestionnaire.version}`);
          console.log(`📊 Details: ${questionnaireData?.sections?.length || 0} sections, ${questionnaireData?.totalQuestions || 'unknown'} questions`);
          console.log(`🕒 Uploaded: ${activeQuestionnaire.uploaded_at}`);
          console.log(`🔄 Cache-buster: ${cacheBuster}`);
          
          return new Response(JSON.stringify({
            questionnaire: questionnaireData,
            metadata: {
              version: activeQuestionnaire.version,
              uploaded_at: activeQuestionnaire.uploaded_at,
              updated_at: activeQuestionnaire.updated_at,
              description: activeQuestionnaire.description,
              totalQuestions: questionnaireData?.totalQuestions,
              enhanced: questionnaireData?.enhanced,
              is_active: activeQuestionnaire.is_active,
              cache_buster: cacheBuster,
              query_timestamp: new Date().toISOString()
            }
          }), {
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
          });
        }

        console.log('⚠️ No active questionnaire found, returning fallback...');
        
        // Fallback questionnaire
        const fallbackQuestionnaire = {
          version: "5.1",
          title: "Fallback Transition Plan Assessment",
          description: "Basic fallback questionnaire",
          totalQuestions: 4,
          enhanced: true,
          lastModified: Date.now(),
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
            version: '5.1',
            uploaded_at: new Date().toISOString(),
            description: 'Fallback questionnaire',
            totalQuestions: 4,
            enhanced: true,
            is_active: false,
            cache_buster: Date.now(),
            is_fallback: true
          }
        }), {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
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
    console.error('❌ Error in questionnaire-manager v5.1:', error);
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
