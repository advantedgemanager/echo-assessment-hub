
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import FileUpload from '@/components/FileUpload';
import { Play, LogOut, FileText } from 'lucide-react';

const Dashboard = () => {
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleUploadComplete = (documentId: string) => {
    setUploadedDocumentId(documentId);
  };

  const handleStartAssessment = () => {
    if (uploadedDocumentId) {
      console.log('Starting assessment for document:', uploadedDocumentId);
      // TODO: Implement assessment logic
      alert('Assessment feature will be implemented next!');
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Credibility Assessment Dashboard</h1>
            <p className="text-muted-foreground">Welcome, {user.email}</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Transition Plan Assessment</h2>
            <p className="text-xl text-muted-foreground">
              Upload your transition plan document to begin the credibility assessment
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* File Upload Section */}
            <div>
              <FileUpload onUploadComplete={handleUploadComplete} />
            </div>

            {/* Assessment Action Section */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Start Assessment
                  </CardTitle>
                  <CardDescription>
                    Begin the AI-powered credibility assessment of your uploaded document
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleStartAssessment}
                    disabled={!uploadedDocumentId}
                    className="w-full"
                    size="lg"
                  >
                    <FileText className="h-5 w-5 mr-2" />
                    Start Assessment
                  </Button>
                  {!uploadedDocumentId && (
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      Please upload a document first
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Upload your transition plan document (PDF or DOCX format)</li>
                <li>Click "Start Assessment" to begin the AI analysis</li>
                <li>The system will evaluate your plan against credibility criteria</li>
                <li>Receive a detailed assessment report with recommendations</li>
                <li>Your document will be permanently stored for future reference</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
