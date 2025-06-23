import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, TrendingUp, FileText, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DetailedAssessmentSummaryProps {
  credibilityScore: number;
  totalScore: number;
  maxPossibleScore: number;
  reportId: string;
  sectionsProcessed: number;
}

interface QuestionResult {
  questionId: string;
  questionText: string;
  response: string;
  score: number;
  weight: number;
  sectionTitle: string;
}

interface SectionStats {
  sectionTitle: string;
  yesCount: number;
  noCount: number;
  naCount: number;
  totalQuestions: number;
  yesPercentage: number;
}

interface AssessmentData {
  sections: Array<{
    sectionId: string;
    sectionTitle: string;
    questions: Array<{
      questionId: string;
      questionText: string;
      response: string;
      score: number;
      weight: number;
    }>;
  }>;
  totalScore: number;
  maxPossibleScore: number;
  questionnaire_version?: string;
}

const DetailedAssessmentSummary: React.FC<DetailedAssessmentSummaryProps> = ({
  credibilityScore,
  totalScore,
  maxPossibleScore,
  reportId,
  sectionsProcessed
}) => {
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
  const [sectionStats, setSectionStats] = useState<SectionStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();

  const getOverallRating = (score: number) => {
    if (score >= 85) return { rating: 'Aligned', color: 'bg-green-500' };
    if (score >= 70) return { rating: 'Aligning', color: 'bg-green-400' };
    if (score >= 50) return { rating: 'Partially Aligned', color: 'bg-orange-500' };
    return { rating: 'Misaligned', color: 'bg-red-500' };
  };

  const getResponseBadgeColor = (response: string) => {
    switch (response) {
      case 'Yes':
        return 'bg-green-500';
      case 'No':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  useEffect(() => {
    const fetchDetailedResults = async () => {
      try {
        const { data: report, error } = await supabase
          .from('assessment_reports')
          .select('assessment_data')
          .eq('id', reportId)
          .single();

        if (error) throw error;

        // Type guard to ensure assessment_data has the expected structure
        const assessmentData = report.assessment_data as unknown as AssessmentData;
        
        if (!assessmentData || !assessmentData.sections || !Array.isArray(assessmentData.sections)) {
          throw new Error('Invalid assessment data structure');
        }

        const sections = assessmentData.sections;
        const allQuestions: QuestionResult[] = [];
        const stats: SectionStats[] = [];

        sections.forEach((section) => {
          let yesCount = 0;
          let noCount = 0;
          let naCount = 0;

          if (section.questions && Array.isArray(section.questions)) {
            section.questions.forEach((q) => {
              allQuestions.push({
                questionId: q.questionId,
                questionText: q.questionText,
                response: q.response,
                score: q.score,
                weight: q.weight,
                sectionTitle: section.sectionTitle
              });

              switch (q.response) {
                case 'Yes':
                  yesCount++;
                  break;
                case 'No':
                  noCount++;
                  break;
                default:
                  naCount++;
                  break;
              }
            });
          }

          const totalQuestions = section.questions ? section.questions.length : 0;
          stats.push({
            sectionTitle: section.sectionTitle,
            yesCount,
            noCount,
            naCount,
            totalQuestions,
            yesPercentage: totalQuestions > 0 ? Math.round((yesCount / totalQuestions) * 100) : 0
          });
        });

        setQuestionResults(allQuestions);
        setSectionStats(stats);
      } catch (error) {
        console.error('Error fetching detailed results:', error);
        toast({
          title: 'Error',
          description: 'Failed to load detailed assessment results',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetailedResults();
  }, [reportId, toast]);

  const generatePdfReport = async () => {
    setIsGeneratingPdf(true);
    try {
      // Generate PDF content
      const pdfContent = generatePdfContent();
      
      // Create and download PDF
      const blob = new Blob([pdfContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `assessment-report-${reportId.slice(-8)}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'PDF Generated',
        description: 'Assessment report has been downloaded'
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF report',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const generatePdfContent = () => {
    const { rating, color } = getOverallRating(credibilityScore);
    const now = new Date().toLocaleDateString();

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Assessment Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .rating { padding: 10px; border-radius: 5px; color: white; display: inline-block; }
        .rating.aligned { background-color: #10b981; }
        .rating.aligning { background-color: #84cc16; }
        .rating.partially { background-color: #f59e0b; }
        .rating.misaligned { background-color: #ef4444; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .section-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        @media print { body { margin: 0; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>Transition Plan Assessment Report</h1>
        <p>Generated on: ${now}</p>
        <p>Report ID: ${reportId.slice(-8)}</p>
        <div class="rating ${rating.toLowerCase().replace(' ', '')}">
            Overall Rating: ${rating}
        </div>
        <p><strong>Credibility Score: ${credibilityScore}%</strong></p>
        <p>Total Points: ${totalScore.toFixed(1)} / ${maxPossibleScore}</p>
    </div>

    <h2>Section Statistics</h2>
    <div class="section-stats">
        ${sectionStats.map(stat => `
            <div class="stat-card">
                <h3>${stat.sectionTitle}</h3>
                <p>Yes: ${stat.yesCount} (${stat.yesPercentage}%)</p>
                <p>No: ${stat.noCount}</p>
                <p>N/A: ${stat.naCount}</p>
                <p>Total: ${stat.totalQuestions}</p>
            </div>
        `).join('')}
    </div>

    <h2>Detailed Results</h2>
    <table>
        <thead>
            <tr>
                <th>Question ID</th>
                <th>Section</th>
                <th>Question Text</th>
                <th>AI Answer</th>
                <th>Score</th>
            </tr>
        </thead>
        <tbody>
            ${questionResults.map(q => `
                <tr>
                    <td>${q.questionId}</td>
                    <td>${q.sectionTitle}</td>
                    <td>${q.questionText}</td>
                    <td>${q.response}</td>
                    <td>${q.score}/${q.weight}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">Loading detailed results...</div>
        </CardContent>
      </Card>
    );
  }

  const { rating, color } = getOverallRating(credibilityScore);

  return (
    <div className="space-y-6">
      {/* Overall Rating Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Assessment Summary
          </CardTitle>
          <CardDescription>
            Comprehensive evaluation of your transition plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className={`text-4xl font-bold ${credibilityScore >= 85 ? 'text-green-600' : credibilityScore >= 70 ? 'text-green-500' : credibilityScore >= 50 ? 'text-orange-500' : 'text-red-500'}`}>
              {credibilityScore}%
            </div>
            <p className="text-muted-foreground mb-4">Credibility Score</p>
            <Badge className={`${color} text-white text-lg px-4 py-2`}>
              {rating}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="font-semibold">{totalScore.toFixed(1)}</div>
              <div className="text-muted-foreground">Points Scored</div>
            </div>
            <div>
              <div className="font-semibold">{maxPossibleScore}</div>
              <div className="text-muted-foreground">Total Possible</div>
            </div>
            <div>
              <div className="font-semibold">{sectionsProcessed}</div>
              <div className="text-muted-foreground">Sections</div>
            </div>
          </div>

          <Button 
            onClick={generatePdfReport} 
            disabled={isGeneratingPdf}
            className="w-full"
            size="lg"
          >
            <Download className="h-4 w-4 mr-2" />
            {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF Report'}
          </Button>
        </CardContent>
      </Card>

      {/* Section Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Section Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sectionStats.map((stat, index) => (
              <div key={index} className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-sm">{stat.sectionTitle}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Yes:</span>
                    <span className="font-medium text-green-600">{stat.yesCount} ({stat.yesPercentage}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>No:</span>
                    <span className="font-medium text-red-600">{stat.noCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>N/A:</span>
                    <span className="font-medium text-gray-600">{stat.naCount}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span>Total:</span>
                    <span className="font-medium">{stat.totalQuestions}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detailed Results
          </CardTitle>
          <CardDescription>
            Complete breakdown of all questions and AI responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question ID</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead className="max-w-md">Question Text</TableHead>
                  <TableHead>AI Answer</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questionResults.map((question, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-xs">{question.questionId}</TableCell>
                    <TableCell className="text-sm">{question.sectionTitle}</TableCell>
                    <TableCell className="max-w-md text-sm">{question.questionText}</TableCell>
                    <TableCell>
                      <Badge className={`${getResponseBadgeColor(question.response)} text-white`}>
                        {question.response}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {question.score}/{question.weight}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DetailedAssessmentSummary;
