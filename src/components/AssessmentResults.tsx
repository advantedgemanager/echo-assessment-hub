
import React from 'react';
import DetailedAssessmentSummary from './DetailedAssessmentSummary';

interface AssessmentResultsProps {
  credibilityScore: number;
  totalScore: number;
  maxPossibleScore: number;
  reportId: string;
  sectionsProcessed: number;
}

const AssessmentResults: React.FC<AssessmentResultsProps> = (props) => {
  return <DetailedAssessmentSummary {...props} />;
};

export default AssessmentResults;
