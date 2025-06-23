
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp } from 'lucide-react';
import { getOverallRating } from './utils';

interface AssessmentSummaryCardProps {
  credibilityScore: number;
  totalScore: number;
  maxPossibleScore: number;
  sectionsProcessed: number;
  onGeneratePdf: () => void;
  isGeneratingPdf: boolean;
}

const AssessmentSummaryCard: React.FC<AssessmentSummaryCardProps> = ({
  credibilityScore,
  totalScore,
  maxPossibleScore,
  sectionsProcessed,
  onGeneratePdf,
  isGeneratingPdf
}) => {
  const { rating, color } = getOverallRating(credibilityScore);

  return (
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
          onClick={onGeneratePdf} 
          disabled={isGeneratingPdf}
          className="w-full"
          size="lg"
        >
          <Download className="h-4 w-4 mr-2" />
          {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF Report'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AssessmentSummaryCard;
