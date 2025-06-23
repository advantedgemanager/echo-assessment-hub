
import { supabase } from "@/integrations/supabase/client";

export interface QuestionnaireMetadata {
  version: string;
  uploaded_at: string;
  description: string;
}

export interface QuestionnaireResponse {
  questionnaire: any;
  metadata: QuestionnaireMetadata;
}

/**
 * Retrieves the active credibility questionnaire from the backend
 * This function is used internally by AI assessment functions
 */
export const getCredibilityQuestionnaire = async (): Promise<QuestionnaireResponse | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('questionnaire-manager', {
      body: { action: 'retrieve' }
    });

    if (error) {
      console.error('Error retrieving questionnaire:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch questionnaire:', error);
    return null;
  }
};

/**
 * Uploads a new version of the credibility questionnaire
 * This is an admin function for updating the questionnaire
 */
export const uploadCredibilityQuestionnaire = async (
  questionnaireData: any,
  version: string = '1.0',
  description?: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('questionnaire-manager', {
      body: {
        action: 'upload',
        questionnaire_data: questionnaireData,
        version,
        description
      }
    });

    if (error) {
      console.error('Error uploading questionnaire:', error);
      return false;
    }

    console.log('Questionnaire uploaded successfully:', data);
    return true;
  } catch (error) {
    console.error('Failed to upload questionnaire:', error);
    return false;
  }
};
