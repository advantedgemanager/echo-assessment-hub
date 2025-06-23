
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, ArrowLeft, FileText, Download, Calendar } from 'lucide-react';
import { useReports } from '@/hooks/useReports';
import { Badge } from '@/components/ui/badge';
import { getOverallRating } from '@/components/assessment/utils';
import { usePdfGenerator } from '@/components/assessment/usePdfGenerator';

const MyReports = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { reports, isLoading, error } = useReports();
  const { generatePdfReport, isGeneratingPdf } = usePdfGenerator();

  React.useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleDownloadPdf = async (report: any) => {
    // We'll need to fetch the detailed data for PDF generation
    // For now, we'll use the basic data available
    await generatePdfReport(
      report.credibility_score,
      0, // We don't have total score in the report view
      100, // Default max score
      report.id,
      [], // Empty section stats for now
      [] // Empty question results for now
    );
  };

  if (loading || isLoading) {
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
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">My Assessment Reports</h1>
              <p className="text-muted-foreground">View your assessment history</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {error && (
            <Card className="mb-6 border-red-200">
              <CardContent className="pt-6">
                <p className="text-red-600">Error loading reports: {error}</p>
              </CardContent>
            </Card>
          )}

          {reports.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Reports Yet</h3>
                <p className="text-muted-foreground mb-4">
                  You haven't completed any assessments yet.
                </p>
                <Button onClick={() => navigate('/dashboard')}>
                  Start Your First Assessment
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold mb-2">
                  {reports.length} Assessment Report{reports.length !== 1 ? 's' : ''}
                </h2>
                <p className="text-muted-foreground">
                  Click on any report to download the detailed PDF
                </p>
              </div>

              <div className="grid gap-4">
                {reports.map((report) => {
                  const { rating, color } = getOverallRating(report.credibility_score);
                  
                  return (
                    <Card key={report.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <FileText className="h-5 w-5" />
                              {report.file_name}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-2">
                              <Calendar className="h-4 w-4" />
                              Assessed on {new Date(report.created_at).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold mb-2">
                              {report.credibility_score}%
                            </div>
                            <Badge className={`${color} text-white`}>
                              {rating}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-muted-foreground">
                            Report Type: {report.report_type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </div>
                          <Button 
                            onClick={() => handleDownloadPdf(report)}
                            disabled={isGeneratingPdf}
                            variant="outline"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MyReports;
