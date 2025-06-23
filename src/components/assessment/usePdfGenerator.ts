
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { QuestionResult, SectionStats } from './types';
import { getOverallRating } from './utils';

export const usePdfGenerator = () => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();

  const generatePdfContent = (
    credibilityScore: number,
    totalScore: number,
    maxPossibleScore: number,
    reportId: string,
    sectionStats: SectionStats[],
    questionResults: QuestionResult[]
  ) => {
    const { rating } = getOverallRating(credibilityScore);
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

  const generatePdfReport = async (
    credibilityScore: number,
    totalScore: number,
    maxPossibleScore: number,
    reportId: string,
    sectionStats: SectionStats[],
    questionResults: QuestionResult[]
  ) => {
    setIsGeneratingPdf(true);
    try {
      // Generate PDF content
      const pdfContent = generatePdfContent(
        credibilityScore,
        totalScore,
        maxPossibleScore,
        reportId,
        sectionStats,
        questionResults
      );
      
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

  return { generatePdfReport, isGeneratingPdf };
};
