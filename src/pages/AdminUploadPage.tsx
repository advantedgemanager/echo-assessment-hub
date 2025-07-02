
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { uploadCredibilityQuestionnaire } from '@/utils/questionnaireUtils';
import { useToast } from '@/hooks/use-toast';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';

const AdminUploadPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('1.0');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [jsonPreview, setJsonPreview] = useState<string>('');
  const { toast } = useToast();

  // Clear any cached questionnaire data on component mount
  useEffect(() => {
    localStorage.removeItem('questionnaire-cache');
    sessionStorage.removeItem('questionnaire-cache');
    console.log('🧹 Cleared questionnaire cache on admin page load');
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/json' || selectedFile.name.endsWith('.json')) {
        setFile(selectedFile);
        setUploadStatus('idle');
        setErrorMessage('');
        
        // Show JSON preview
        try {
          const fileContent = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(selectedFile);
          });
          
          // Parse to validate JSON
          const parsedJson = JSON.parse(fileContent);
          
          // Show preview (first 500 characters)
          const preview = JSON.stringify(parsedJson, null, 2);
          setJsonPreview(preview.substring(0, 500) + (preview.length > 500 ? '...' : ''));
          
          console.log('✅ JSON file loaded successfully:', {
            size: selectedFile.size,
            topLevelKeys: Object.keys(parsedJson)
          });
        } catch (error) {
          setErrorMessage('Invalid JSON format');
          setFile(null);
          setJsonPreview('');
        }
      } else {
        setErrorMessage('Please select a valid JSON file');
        setFile(null);
        setJsonPreview('');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');

    try {
      console.log('🚀 Starting upload process - preserving original structure...');
      
      // Read and parse the JSON file
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });

      console.log('📄 File read successfully, parsing JSON...');

      let questionnaireData;
      try {
        questionnaireData = JSON.parse(fileContent);
        console.log('✅ JSON parsed successfully - will be saved as-is');
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid JSON format');
      }

      console.log('📤 Uploading original JSON structure to server...');

      // Upload using the utility function - NO TRANSFORMATIONS
      const success = await uploadCredibilityQuestionnaire(
        questionnaireData, // ORIGINAL structure
        version,
        description || 'Questionnaire uploaded with original structure preserved'
      );

      if (success) {
        console.log('🎉 Upload successful! Original JSON structure preserved.');
        setUploadStatus('success');
        
        // Clear any remaining cache
        localStorage.removeItem('questionnaire-cache');
        sessionStorage.removeItem('questionnaire-cache');
        
        toast({
          title: 'Upload Successful',
          description: 'Questionnaire uploaded with original JSON structure preserved.',
        });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
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
            Upload the questionnaire JSON file - original structure will be preserved exactly as uploaded
          </p>
        </div>

        {/* Original structure preservation notice */}
        <Alert className="mb-6">
          <FileText className="h-4 w-4" />
          <AlertDescription>
            <strong>Original Structure Mode:</strong> Your JSON will be saved exactly as uploaded without any transformations or modifications.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Questionnaire File
            </CardTitle>
            <CardDescription>
              Select a JSON file - it will be saved with its original structure preserved.
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

            {jsonPreview && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">JSON Preview:</Label>
                <div className="p-3 bg-muted rounded-md text-sm font-mono max-h-48 overflow-y-auto">
                  <pre>{jsonPreview}</pre>
                </div>
                <div className="text-xs text-green-600">
                  ✓ Valid JSON - structure will be preserved exactly as shown
                </div>
              </div>
            )}

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
                  Questionnaire uploaded successfully with original structure preserved!
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="w-full"
            >
              {isUploading ? 'Uploading Original Structure...' : 'Upload Questionnaire'}
            </Button>
          </CardContent>
        </Card>

        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">Original Structure Mode:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• ✅ No transformations applied to your JSON</li>
            <li>• ✅ Original structure preserved exactly</li>
            <li>• ✅ No automatic field additions or modifications</li>
            <li>• ✅ What you upload is what gets saved</li>
            <li>• ✅ Immediate activation after upload</li>
            <li>• 🔍 Check browser console for upload logs</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminUploadPage;
