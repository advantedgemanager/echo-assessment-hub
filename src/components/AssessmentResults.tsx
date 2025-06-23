
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, HelpCircle, TrendingUp } from 'lucide-react';

interface AssessmentResultsProps {
  credibilityScore: number;
  totalScore: number;
  maxPossibleScore: number;
  reportId: string;
  sectionsProcessed: number;
}

const AssessmentResults: React.FC<AssessmentResultsProps> = ({
  credibilityScore,
  totalScore,
  maxPossibleScore,
  reportId,
  sectionsProcessed
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge variant="default" className="bg-green-500">Excellent</Badge>;
    if (score >= 60) return <Badge variant="default" className="bg-yellow-500">Good</Badge>;
    if (score >= 40) return <Badge variant="default" className="bg-orange-500">Fair</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Assessment Results
        </CardTitle>
        <CardDescription>
          AI-powered credibility assessment of your transition plan
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className={`text-4xl font-bold ${getScoreColor(credibilityScore)}`}>
            {credibilityScore}%
          </div>
          <p className="text-muted-foreground">Credibility Score</p>
          <div className="mt-2">
            {getScoreBadge(credibilityScore)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold">{totalScore.toFixed(1)}</div>
            <div className="text-muted-foreground">Points Scored</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">{maxPossibleScore}</div>
            <div className="text-muted-foreground">Total Possible</div>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between text-sm">
            <span>Sections Analyzed:</span>
            <span className="font-semibold">{sectionsProcessed}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Report ID:</span>
            <span className="font-mono text-xs">{reportId.slice(-8)}</span>
          </div>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Next Steps:</h4>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Review detailed assessment breakdown</li>
            <li>• Address areas marked as "No" or "Not enough information"</li>
            <li>• Consider updating your transition plan based on feedback</li>
            <li>• Re-assess after making improvements</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default AssessmentResults;
