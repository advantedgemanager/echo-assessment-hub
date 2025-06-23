
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { uploadCredibilityQuestionnaire } from '@/utils/questionnaireUtils';
import { useToast } from '@/hooks/use-toast';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';

const AdminUploadPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('1.0');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const { toast } = useToast();

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
    // Basic validation of the questionnaire structure
    if (!data.transition_plan_questionnaire) {
      setErrorMessage('Invalid questionnaire format: missing transition_plan_questionnaire');
      return false;
    }

    const questionnaire = data.transition_plan_questionnaire;
    
    if (!questionnaire.metadata) {
      setErrorMessage('Invalid questionnaire format: missing metadata');
      return false;
    }

    if (!questionnaire.basic_assessment_sections) {
      setErrorMessage('Invalid questionnaire format: missing basic_assessment_sections');
      return false;
    }

    // Check if sections have questions
    const sections = questionnaire.basic_assessment_sections;
    for (const sectionKey of Object.keys(sections)) {
      const section = sections[sectionKey];
      if (!section.questions || !Array.isArray(section.questions)) {
        setErrorMessage(`Invalid questionnaire format: section ${sectionKey} missing questions array`);
        return false;
      }
    }

    return true;
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');

    try {
      // Read and parse the JSON file
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });

      let questionnaireData;
      try {
        questionnaireData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('Invalid JSON format');
      }

      // Validate the structure
      if (!validateQuestionnaireStructure(questionnaireData)) {
        setUploadStatus('error');
        setIsUploading(false);
        return;
      }

      // Upload using the utility function
      const success = await uploadCredibilityQuestionnaire(
        questionnaireData,
        version,
        description || 'Credibility assessment questionnaire'
      );

      if (success) {
        setUploadStatus('success');
        toast({
          title: 'Upload Successful',
          description: 'Questionnaire has been uploaded and is now active.',
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
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Upload a valid JSON file containing the questionnaire data</li>
            <li>• The file will be validated before upload</li>
            <li>• Once uploaded, the questionnaire becomes active for AI assessments</li>
            <li>• Previous versions will be automatically deactivated</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminUploadPage;
