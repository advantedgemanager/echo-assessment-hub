
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
    console.log(`🚀 Enhanced questionnaire manager v3.0 - Action: ${action}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'upload') {
      console.log('=== Enhanced Questionnaire Upload v3.0 ===');
      
      try {
        if (!questionnaire_data) {
          throw new Error('Missing questionnaire data');
        }

        console.log('🔍 Raw questionnaire structure analysis:', JSON.stringify({
          hasTransitionPlan: !!questionnaire_data.transition_plan_questionnaire,
          hasSections: !!questionnaire_data.sections,
          hasBasicSections: !!questionnaire_data.basic_assessment_sections,
          hasCredibilityQuestionnaire: !!questionnaire_data.transition_plan_credibility_questionnaire,
          topLevelKeys: Object.keys(questionnaire_data),
          dataType: typeof questionnaire_data
        }, null, 2));

        let transformedQuestionnaire;
        let finalVersion;
        let totalQuestions = 0;

        // Enhanced structure transformation with comprehensive logging
        if (questionnaire_data.transition_plan_questionnaire) {
          console.log('📋 Processing Format 1: Nested transition_plan_questionnaire structure');
          transformedQuestionnaire = await processNestedStructure(questionnaire_data.transition_plan_questionnaire, version);
        } else if (questionnaire_data.transition_plan_credibility_questionnaire) {
          console.log('📋 Processing Format 2: transition_plan_credibility_questionnaire structure');
          transformedQuestionnaire = await processCredibilityStructure(questionnaire_data.transition_plan_credibility_questionnaire, version);
        } else if (questionnaire_data.sections && Array.isArray(questionnaire_data.sections)) {
          console.log('📋 Processing Format 3: Direct sections structure');
          transformedQuestionnaire = await processDirectSections(questionnaire_data, version);
        } else if (questionnaire_data.basic_assessment_sections) {
          console.log('📋 Processing Format 4: Legacy basic_assessment_sections structure');
          transformedQuestionnaire = await processBasicSections(questionnaire_data.basic_assessment_sections, version);
        } else {
          console.log('📋 Processing Format 5: Auto-detection fallback');
          transformedQuestionnaire = await processUnknownFormat(questionnaire_data, version);
        }

        if (!transformedQuestionnaire) {
          throw new Error('Failed to transform questionnaire structure');
        }

        // Validate the transformed questionnaire
        if (!transformedQuestionnaire.sections || !Array.isArray(transformedQuestionnaire.sections)) {
          console.error('❌ Validation failed: missing or invalid sections array');
          console.error('Questionnaire structure:', JSON.stringify(transformedQuestionnaire, null, 2));
          throw new Error('Invalid questionnaire format: sections must be an array');
        }

        // Count total questions
        totalQuestions = countTotalQuestions(transformedQuestionnaire.sections);
        finalVersion = transformedQuestionnaire.version;

        console.log(`✅ Questionnaire validated successfully: ${transformedQuestionnaire.sections.length} sections, ${totalQuestions} questions, version: ${finalVersion}`);

        if (totalQuestions === 0) {
          throw new Error('No questions found in questionnaire sections');
        }

        // Enhanced questionnaire structure with metadata
        const enhancedQuestionnaire = {
          version: finalVersion,
          title: transformedQuestionnaire.title || 'Enhanced Transition Plan Credibility Assessment',
          description: transformedQuestionnaire.description || description || `Comprehensive ${totalQuestions}-question credibility assessment questionnaire`,
          totalQuestions: totalQuestions,
          sections: transformedQuestionnaire.sections,
          uploadedAt: new Date().toISOString(),
          enhanced: true
        };

        const fileName = `enhanced_questionnaire_v${finalVersion}.json`;
        const filePath = `/questionnaires/enhanced/v${finalVersion}`;
        
        console.log(`💾 Saving questionnaire - name: ${fileName}, path: ${filePath}, questions: ${totalQuestions}`);

        // Deactivate existing questionnaires
        console.log('🔄 Deactivating existing questionnaires...');
        const { error: deactivateError } = await supabase
          .from('questionnaire_metadata')
          .update({ is_active: false })
          .eq('is_active', true);

        if (deactivateError) {
          console.warn('⚠️ Warning: Could not deactivate existing questionnaires:', deactivateError);
        } else {
          console.log('✅ Successfully deactivated existing questionnaires');
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

        console.log('🎉 Enhanced questionnaire uploaded successfully:', {
          id: insertData.id,
          version: finalVersion,
          totalQuestions: totalQuestions,
          sections: enhancedQuestionnaire.sections.length,
          isActive: insertData.is_active
        });

        return new Response(JSON.stringify({ 
          success: true, 
          questionnaire_id: insertData.id,
          version: finalVersion,
          sections_count: enhancedQuestionnaire.sections.length,
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
      console.log('=== Enhanced Questionnaire Retrieval v3.0 ===');
      
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
          console.log(`📊 Questionnaire details:`, {
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
            embeddedQuestions = countTotalQuestions(questionnaireData.sections);
          }
          
          console.log('✅ Embedded questionnaire loaded successfully');
          console.log(`📊 Embedded questionnaire details:`, {
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
          const fallbackQuestionnaire = createFallbackQuestionnaire();

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
    console.error('❌ Error in enhanced questionnaire-manager v3.0:', error);
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

// Helper functions for structure processing
async function processNestedStructure(nestedData: any, version?: string) {
  console.log('🔧 Processing nested transition_plan_questionnaire structure');
  
  if (nestedData.basic_assessment_sections) {
    return await processBasicSections(nestedData.basic_assessment_sections, version || nestedData.metadata?.version || '4.0');
  } else if (nestedData.sections) {
    return {
      version: version || nestedData.version || '4.0',
      title: nestedData.title || 'Enhanced Transition Plan Credibility Assessment',
      description: nestedData.description || 'Comprehensive credibility assessment questionnaire',
      sections: nestedData.sections
    };
  }
  
  throw new Error('Invalid nested structure: missing sections or basic_assessment_sections');
}

async function processCredibilityStructure(credibilityData: any, version?: string) {
  console.log('🔧 Processing transition_plan_credibility_questionnaire structure');
  console.log('📋 Credibility data keys:', Object.keys(credibilityData));
  
  if (credibilityData.basic_assessment_sections) {
    return await processBasicSections(credibilityData.basic_assessment_sections, version || '4.0');
  } else if (credibilityData.sections) {
    return {
      version: version || credibilityData.version || '4.0',
      title: credibilityData.title || 'Enhanced Transition Plan Credibility Assessment',
      description: credibilityData.description || 'Comprehensive credibility assessment questionnaire',
      sections: credibilityData.sections
    };
  }
  
  // Try to find any nested questionnaire structure
  for (const [key, value] of Object.entries(credibilityData)) {
    if (value && typeof value === 'object' && (value.sections || value.basic_assessment_sections)) {
      console.log(`🔍 Found nested questionnaire in key: ${key}`);
      if (value.basic_assessment_sections) {
        return await processBasicSections(value.basic_assessment_sections, version || '4.0');
      } else if (value.sections) {
        return {
          version: version || value.version || '4.0',
          title: value.title || 'Enhanced Transition Plan Credibility Assessment',
          description: value.description || 'Comprehensive credibility assessment questionnaire',
          sections: value.sections
        };
      }
    }
  }
  
  throw new Error(`Invalid credibility questionnaire structure: no recognizable format found in keys: ${Object.keys(credibilityData).join(', ')}`);
}

async function processDirectSections(data: any, version?: string) {
  console.log('🔧 Processing direct sections structure');
  
  return {
    version: version || data.version || '4.0',
    title: data.title || 'Enhanced Transition Plan Credibility Assessment',
    description: data.description || 'Comprehensive credibility assessment questionnaire',
    sections: data.sections
  };
}

async function processBasicSections(basicSections: any, version?: string) {
  console.log('🔧 Processing basic_assessment_sections structure');
  console.log('📋 Basic sections keys:', Object.keys(basicSections));
  
  const sections = [];
  
  for (const [sectionKey, sectionData] of Object.entries(basicSections)) {
    if (!sectionData || typeof sectionData !== 'object') {
      console.warn(`⚠️ Skipping invalid section: ${sectionKey}`);
      continue;
    }
    
    const section = {
      id: sectionKey,
      title: sectionData.title || sectionKey,
      description: sectionData.description || '',
      questions: Array.isArray(sectionData.questions) ? sectionData.questions : []
    };
    
    console.log(`📝 Section ${sectionKey}: ${section.questions.length} questions`);
    sections.push(section);
  }
  
  if (sections.length === 0) {
    throw new Error('No valid sections found in basic_assessment_sections');
  }
  
  return {
    version: version || '4.0',
    title: 'Enhanced Transition Plan Credibility Assessment',
    description: 'Comprehensive credibility assessment questionnaire',
    sections: sections
  };
}

async function processUnknownFormat(data: any, version?: string) {
  console.log('🔧 Processing unknown format, attempting auto-detection...');
  const keys = Object.keys(data);
  console.log('🔍 Available keys for auto-detection:', keys);
  
  for (const key of keys) {
    const value = data[key];
    if (value && typeof value === 'object') {
      if (value.basic_assessment_sections) {
        console.log(`✅ Found basic_assessment_sections in key: ${key}`);
        return await processBasicSections(value.basic_assessment_sections, version || '4.0');
      } else if (value.sections && Array.isArray(value.sections)) {
        console.log(`✅ Found sections array in key: ${key}`);
        return {
          version: version || value.version || '4.0',
          title: value.title || 'Enhanced Transition Plan Credibility Assessment',
          description: value.description || 'Comprehensive credibility assessment questionnaire',
          sections: value.sections
        };
      }
    }
  }
  
  throw new Error(`Invalid questionnaire format: no recognized structure found in keys: ${keys.join(', ')}`);
}

function countTotalQuestions(sections: any[]): number {
  let total = 0;
  for (const section of sections) {
    if (section.questions && Array.isArray(section.questions)) {
      total += section.questions.length;
    }
  }
  return total;
}

function createFallbackQuestionnaire() {
  return {
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
}
