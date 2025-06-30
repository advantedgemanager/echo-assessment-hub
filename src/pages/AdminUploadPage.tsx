import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { uploadCredibilityQuestionnaire } from '@/utils/questionnaireUtils';
import { useToast } from '@/hooks/use-toast';
import { Upload, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';

const AdminUploadPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('1.0');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const { toast } = useToast();

  // Clear any cached questionnaire data on component mount
  useEffect(() => {
    // Force a refresh of any cached questionnaire data
    localStorage.removeItem('questionnaire-cache');
    sessionStorage.removeItem('questionnaire-cache');
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/json' || selectedFile.name.endsWith('.json')) {
        setFile(selectedFile);
        setUploadStatus('idle');
        setErrorMessage('');
      } else {
        setErrorMessage('Please select a valid JSON file');
        setFile(null);
      }
    }
  };

  const validateQuestionnaireStructure = (data: any): boolean => {
    console.log('Validating questionnaire structure:', {
      topLevelKeys: Object.keys(data),
      isArray: Array.isArray(data),
      hasTransitionPlan: !!data.transition_plan_questionnaire,
      hasSections: !!data.sections,
      hasBasicSections: !!data.basic_assessment_sections,
      hasQuestionnaireData: !!data.questionnaire_data
    });

    // Handle array wrapper format [{ questionnaire_data: {...} }]
    if (Array.isArray(data) && data.length > 0) {
      console.log('Found array wrapper, extracting first element');
      return validateQuestionnaireStructure(data[0]);
    }

    // Handle questionnaire_data wrapper format
    if (data.questionnaire_data) {
      console.log('Found questionnaire_data wrapper structure');
      const questionnaire = data.questionnaire_data;
      
      if (questionnaire.sections && Array.isArray(questionnaire.sections)) {
        console.log('Valid questionnaire_data with sections array');
        return true;
      }
      
      setErrorMessage('Invalid questionnaire_data format: missing sections array');
      return false;
    }

    // Enhanced validation - accept multiple formats
    if (data.transition_plan_questionnaire) {
      const questionnaire = data.transition_plan_questionnaire;
      console.log('Found nested transition_plan_questionnaire structure');
      
      if (!questionnaire.metadata && !questionnaire.basic_assessment_sections && !questionnaire.sections) {
        setErrorMessage('Invalid questionnaire format: nested structure missing required sections');
        return false;
      }
      return true;
    }

    if (data.sections && Array.isArray(data.sections)) {
      console.log('Found direct sections structure');
      return true;
    }

    if (data.basic_assessment_sections) {
      console.log('Found basic_assessment_sections structure');
      const sections = data.basic_assessment_sections;
      for (const sectionKey of Object.keys(sections)) {
        const section = sections[sectionKey];
        if (!section.questions || !Array.isArray(section.questions)) {
          setErrorMessage(`Invalid questionnaire format: section ${sectionKey} missing questions array`);
          return false;
        }
      }
      return true;
    }

    // Look for any nested questionnaire structure
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (value && typeof value === 'object' && (value.sections || value.basic_assessment_sections)) {
        console.log(`Found questionnaire data in nested key: ${key}`);
        return true;
      }
    }

    setErrorMessage(`Invalid questionnaire format: no recognized structure found. Available keys: ${Object.keys(data).join(', ')}`);
    return false;
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');

    try {
      console.log('Starting upload process...');
      
      // Read and parse the JSON file
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });

      console.log('File read successfully, parsing JSON...');

      let questionnaireData;
      try {
        questionnaireData = JSON.parse(fileContent);
        console.log('JSON parsed successfully, structure preview:', {
          topLevelKeys: Object.keys(questionnaireData),
          isArray: Array.isArray(questionnaireData),
          fileSize: fileContent.length
        });
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid JSON format');
      }

      // Validate the structure
      console.log('Validating questionnaire structure...');
      if (!validateQuestionnaireStructure(questionnaireData)) {
        setUploadStatus('error');
        setIsUploading(false);
        return;
      }

      // Transform the data if needed to extract from wrappers
      let finalQuestionnaireData = questionnaireData;
      
      // Handle array wrapper
      if (Array.isArray(questionnaireData) && questionnaireData.length > 0) {
        finalQuestionnaireData = questionnaireData[0];
        console.log('Extracted questionnaire from array wrapper');
      }
      
      // Handle questionnaire_data wrapper
      if (finalQuestionnaireData.questionnaire_data) {
        finalQuestionnaireData = finalQuestionnaireData.questionnaire_data;
        console.log('Extracted questionnaire from questionnaire_data wrapper');
      }

      console.log('Structure validation passed, uploading to server...');
      console.log('Final questionnaire data keys:', Object.keys(finalQuestionnaireData));
      console.log('Total questions:', finalQuestionnaireData.totalQuestions || 'unknown');

      // Upload using the utility function
      const success = await uploadCredibilityQuestionnaire(
        finalQuestionnaireData,
        version,
        description || finalQuestionnaireData.description || 'Credibility assessment questionnaire'
      );

      if (success) {
        console.log('Upload successful!');
        setUploadStatus('success');
        toast({
          title: 'Upload Successful',
          description: `Questionnaire with ${finalQuestionnaireData.totalQuestions || 'multiple'} questions has been uploaded and is now active.`,
        });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload questionnaire. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Admin: Upload Questionnaire</h1>
          <p className="text-muted-foreground mt-2">
            Upload the credibility assessment questionnaire JSON file
          </p>
        </div>

        {/* Clean state notification */}
        <Alert className="mb-6">
          <Trash2 className="h-4 w-4" />
          <AlertDescription>
            System has been reset. All previous questionnaires and assessment reports have been cleared. 
            You can now upload a fresh questionnaire.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Questionnaire File
            </CardTitle>
            <CardDescription>
              Select a JSON file containing the credibility questionnaire data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="file">Questionnaire JSON File</Label>
              <Input
                id="file"
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g., 1.0, 2.1"
                disabled={isUploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this questionnaire version"
                disabled={isUploading}
              />
            </div>

            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {uploadStatus === 'success' && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Questionnaire uploaded successfully and is now active!
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="w-full"
            >
              {isUploading ? 'Uploading...' : 'Upload Questionnaire'}
            </Button>
          </CardContent>
        </Card>

        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">Supported Formats:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Format 1:</strong> {"[{ questionnaire_data: { sections: [...] } }]"}</li>
            <li>• <strong>Format 2:</strong> {"{ questionnaire_data: { sections: [...] } }"}</li>
            <li>• <strong>Format 3:</strong> {"{ transition_plan_questionnaire: { basic_assessment_sections: {...} } }"}</li>
            <li>• <strong>Format 4:</strong> {"{ sections: [...] }"}</li>
            <li>• <strong>Format 5:</strong> {"{ basic_assessment_sections: {...} }"}</li>
            <li>• The system will automatically detect and transform your format</li>
            <li>• Check browser console for detailed validation logs</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminUploadPage;
