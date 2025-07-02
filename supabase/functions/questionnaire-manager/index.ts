
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
    console.log(`🚀 Questionnaire manager v6.0 - Action: ${action} - Timestamp: ${new Date().toISOString()}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'upload') {
      console.log('=== Questionnaire Upload v6.0 - NO TRANSFORMATIONS ===');
      
      try {
        if (!questionnaire_data) {
          throw new Error('Missing questionnaire data in request');
        }

        console.log('📋 Saving original JSON structure without modifications...');
        console.log('Original JSON keys:', Object.keys(questionnaire_data));

        const finalVersion = version || '6.0';
        const fileName = `questionnaire_v${finalVersion}.json`;
        const filePath = `/questionnaires/v${finalVersion}`;
        
        console.log(`💾 Saving questionnaire: ${fileName} - Original structure preserved`);

        // Deactivate existing questionnaires
        console.log('🔄 Deactivating existing questionnaires...');
        const { error: deactivateError } = await supabase
          .from('questionnaire_metadata')
          .update({ 
            is_active: false
          })
          .eq('is_active', true);

        if (deactivateError) {
          console.warn('⚠️ Warning: Could not deactivate existing questionnaires:', deactivateError);
        }

        // Insert the new questionnaire with ORIGINAL structure
        console.log('📥 Inserting new questionnaire with original JSON structure...');
        const { data: insertData, error: insertError } = await supabase
          .from('questionnaire_metadata')
          .insert({
            file_name: fileName,
            file_path: filePath,
            version: finalVersion,
            description: description || 'Questionnaire uploaded without modifications',
            questionnaire_data: questionnaire_data, // ORIGINAL JSON - NO TRANSFORMATIONS
            is_active: true,
            uploaded_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Database insert error:', insertError);
          throw new Error(`Failed to save questionnaire: ${insertError.message}`);
        }

        console.log('🎉 Questionnaire uploaded successfully with original structure!');
        console.log(`   - ID: ${insertData.id}`);
        console.log(`   - Version: ${finalVersion}`);
        console.log(`   - Structure: ORIGINAL (no transformations)`);
        console.log(`   - Active: ${insertData.is_active}`);

        return new Response(JSON.stringify({ 
          success: true, 
          questionnaire_id: insertData.id,
          version: finalVersion,
          is_active: insertData.is_active,
          structure: 'original',
          message: `Questionnaire uploaded successfully with original JSON structure preserved`
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
      console.log('=== Questionnaire Retrieval v6.0 - ORIGINAL STRUCTURE ===');
      
      try {
        console.log('🔍 Executing database query for active questionnaire...');
        const { data: activeQuestionnaire, error: dbError } = await supabase
          .from('questionnaire_metadata')
          .select('*')
          .eq('is_active', true)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (dbError) {
          console.error('Database error:', dbError);
          throw new Error(`Database error: ${dbError.message}`);
        }

        if (activeQuestionnaire) {
          const questionnaireData = activeQuestionnaire.questionnaire_data;
          
          console.log(`✅ Found active questionnaire: version ${activeQuestionnaire.version}`);
          console.log(`📊 Structure: ORIGINAL (no transformations applied)`);
          console.log(`🕒 Uploaded: ${activeQuestionnaire.uploaded_at}`);
          
          return new Response(JSON.stringify({
            questionnaire: questionnaireData, // ORIGINAL structure
            metadata: {
              version: activeQuestionnaire.version,
              uploaded_at: activeQuestionnaire.uploaded_at,
              description: activeQuestionnaire.description,
              is_active: activeQuestionnaire.is_active,
              structure: 'original',
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
        
        // Simple fallback questionnaire
        const fallbackQuestionnaire = {
          fallback: true,
          message: "No active questionnaire found"
        };

        return new Response(JSON.stringify({
          questionnaire: fallbackQuestionnaire,
          metadata: {
            version: '6.0',
            uploaded_at: new Date().toISOString(),
            description: 'Fallback questionnaire',
            is_active: false,
            is_fallback: true,
            structure: 'original'
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
    console.error('❌ Error in questionnaire-manager v6.0:', error);
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
