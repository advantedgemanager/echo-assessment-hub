
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { method } = req
    let action: string | null = null;
    let requestData: any = {};

    // Parse request body for action and data
    if (method === 'POST') {
      requestData = await req.json()
      action = requestData.action
    }

    console.log('Request method:', method, 'Action:', action)

    if (method === 'POST' && action === 'upload') {
      // Upload questionnaire file
      const { questionnaire_data, version = '1.0', description } = requestData
      
      if (!questionnaire_data) {
        return new Response(
          JSON.stringify({ error: 'questionnaire_data is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const fileName = `credibility_questionnaire_v${version}.json`
      const filePath = `questionnaires/${fileName}`

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('questionnaires')
        .upload(filePath, JSON.stringify(questionnaire_data, null, 2), {
          contentType: 'application/json',
          upsert: true
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        return new Response(
          JSON.stringify({ error: 'Failed to upload questionnaire', details: uploadError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Deactivate previous versions
      await supabaseClient
        .from('questionnaire_metadata')
        .update({ is_active: false })
        .eq('is_active', true)

      // Insert metadata
      const { data: metadataData, error: metadataError } = await supabaseClient
        .from('questionnaire_metadata')
        .insert({
          file_name: fileName,
          file_path: filePath,
          version,
          description: description || 'Credibility assessment questionnaire',
          is_active: true
        })

      if (metadataError) {
        console.error('Metadata error:', metadataError)
        return new Response(
          JSON.stringify({ error: 'Failed to save metadata', details: metadataError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Questionnaire uploaded successfully',
          file_path: filePath
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'retrieve') {
      // Get active questionnaire
      const { data: metadata, error: metadataError } = await supabaseClient
        .from('questionnaire_metadata')
        .select('*')
        .eq('is_active', true)
        .single()

      if (metadataError || !metadata) {
        return new Response(
          JSON.stringify({ error: 'No active questionnaire found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Download file from storage
      const { data: fileData, error: downloadError } = await supabaseClient.storage
        .from('questionnaires')
        .download(metadata.file_path)

      if (downloadError || !fileData) {
        console.error('Download error:', downloadError)
        return new Response(
          JSON.stringify({ error: 'Failed to retrieve questionnaire' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const questionnaireText = await fileData.text()
      const questionnaireData = JSON.parse(questionnaireText)

      return new Response(
        JSON.stringify({ 
          questionnaire: questionnaireData,
          metadata: {
            version: metadata.version,
            uploaded_at: metadata.uploaded_at,
            description: metadata.description
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use action: "upload" or "retrieve" in request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
