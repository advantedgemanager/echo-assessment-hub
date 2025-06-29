
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, File, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onUploadComplete: (documentId: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [error, setError] = useState('');
  const [sizeWarning, setSizeWarning] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();

  // Size limits
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const LARGE_FILE_WARNING = 3 * 1024 * 1024; // 3MB

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      
      if (!allowedTypes.includes(selectedFile.type)) {
        setError('Please select a PDF or DOCX file');
        setFile(null);
        setSizeWarning('');
        return;
      }

      if (selectedFile.size > MAX_FILE_SIZE) {
        setError(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
        setFile(null);
        setSizeWarning('');
        return;
      }

      setFile(selectedFile);
      setError('');
      setUploadComplete(false);

      // Show warning for large files
      if (selectedFile.size > LARGE_FILE_WARNING) {
        setSizeWarning(`Large file detected (${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB). Processing may take longer and the document might be truncated for assessment.`);
      } else {
        setSizeWarning('');
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setUploading(true);
    setError('');

    try {
      // Create a unique file path
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Record the document in the database
      const { data: documentData, error: dbError } = await supabase
        .from('uploaded_documents')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          is_temporary: true,
          assessment_status: 'pending'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setUploadComplete(true);
      toast({
        title: 'Upload Successful',
        description: 'Your document has been uploaded successfully.',
      });

      onUploadComplete(documentData.id);
    } catch (error: any) {
      console.error('Upload error:', error);
      setError(error.message || 'Upload failed');
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload document. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Transition Plan
        </CardTitle>
        <CardDescription>
          Upload your PDF or DOCX transition plan document for credibility assessment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="document">Document File</Label>
          <Input
            id="document"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            disabled={uploading || uploadComplete}
          />
          {file && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <File className="h-4 w-4" />
              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
        </div>

        {sizeWarning && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{sizeWarning}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {uploadComplete && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Document uploaded successfully! You can now start the assessment.
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleUpload}
          disabled={!file || uploading || uploadComplete}
          className="w-full"
        >
          {uploading ? 'Uploading...' : 'Upload Document'}
        </Button>

        <div className="text-xs text-muted-foreground">
          <p>• Maximum file size: {MAX_FILE_SIZE / (1024 * 1024)}MB</p>
          <p>• Supported formats: PDF, DOCX</p>
          <p>• Large documents may be truncated for processing</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUpload;
