
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import FileUpload from '@/components/FileUpload';
import AssessmentProgress from '@/components/AssessmentProgress';
import AssessmentResults from '@/components/AssessmentResults';
import { useAssessment } from '@/hooks/useAssessment';
import { Play, LogOut, FileText, RotateCcw, History } from 'lucide-react';

const Dashboard = () => {
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { assessmentState, startAssessment, resetAssessment } = useAssessment();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleUploadComplete = (documentId: string) => {
    setUploadedDocumentId(documentId);
    // Reset any previous assessment
    resetAssessment();
  };

  const handleStartAssessment = async () => {
    if (uploadedDocumentId && user) {
      await startAssessment(uploadedDocumentId, user.id);
    }
  };

  const handleStartNewAssessment = () => {
    setUploadedDocumentId(null);
    resetAssessment();
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/my-reports')}>
              <History className="h-4 w-4 mr-2" />
              My Reports
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Transition Plan Assessment</h2>
            <p className="text-xl text-muted-foreground">
              Upload your transition plan document to begin the AI-powered credibility assessment
            </p>
          </div>

          {/* Show assessment results if completed */}
          {assessmentState.status === 'completed' && assessmentState.results && (
            <div className="space-y-6">
              <AssessmentResults {...assessmentState.results} />
              <div className="text-center space-x-4">
                <Button onClick={handleStartNewAssessment} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Start New Assessment
                </Button>
                <Button onClick={() => navigate('/my-reports')} variant="outline">
                  <History className="h-4 w-4 mr-2" />
                  View All Reports
                </Button>
              </div>
            </div>
          )}

          {/* Show assessment progress if in progress */}
          {(assessmentState.status === 'processing' || assessmentState.status === 'assessing' || assessmentState.status === 'error') && (
            <AssessmentProgress
              status={assessmentState.status}
              progress={assessmentState.progress}
              currentStep={assessmentState.currentStep}
              error={assessmentState.error || undefined}
            />
          )}

          {/* Show upload and assessment interface if not completed */}
          {assessmentState.status !== 'completed' && (
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
                      disabled={!uploadedDocumentId || assessmentState.status !== 'idle'}
                      className="w-full"
                      size="lg"
                    >
                      <FileText className="h-5 w-5 mr-2" />
                      {assessmentState.status === 'idle' ? 'Start Assessment' : 'Assessment in Progress...'}
                    </Button>
                    {!uploadedDocumentId && assessmentState.status === 'idle' && (
                      <p className="text-sm text-muted-foreground mt-2 text-center">
                        Please upload a document first
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Upload your transition plan document (PDF or DOCX format)</li>
                <li>Click "Start Assessment" to begin the AI analysis</li>
                <li>The system will extract text and evaluate your plan against credibility criteria</li>
                <li>Each question is answered with "Yes", "No", or "Not enough information"</li>
                <li>Receive a detailed assessment report with your credibility score</li>
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
