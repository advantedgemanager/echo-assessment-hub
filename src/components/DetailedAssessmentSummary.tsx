
import React from 'react';
import { DetailedAssessmentSummaryProps } from './assessment/types';
import { useAssessmentData } from './assessment/useAssessmentData';
import { usePdfGenerator } from './assessment/usePdfGenerator';
import AssessmentSummaryCard from './assessment/AssessmentSummaryCard';
import SectionStatisticsCard from './assessment/SectionStatisticsCard';
import DetailedResultsTable from './assessment/DetailedResultsTable';
import { AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const DetailedAssessmentSummary: React.FC<DetailedAssessmentSummaryProps> = ({
  credibilityScore,
  totalScore,
  maxPossibleScore,
  reportId,
  sectionsProcessed,
  overallResult,
  redFlagTriggered,
  reasoning,
  assessmentCompleteness,
  processedQuestions,
  totalQuestions,
  wasTruncated
}) => {
  const { questionResults, sectionStats, isLoading, assessmentData } = useAssessmentData(reportId);
  const { generatePdfReport, isGeneratingPdf } = usePdfGenerator();

  const handleGeneratePdf = () => {
    generatePdfReport(
      credibilityScore,
      totalScore,
      maxPossibleScore,
      reportId,
      sectionStats,
      questionResults
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center p-8">Loading detailed results...</div>
      </div>
    );
  }

  // Use data from assessment if available, otherwise use props
  const finalOverallResult = assessmentData?.overallResult || overallResult;
  const finalRedFlagTriggered = assessmentData?.redFlagTriggered || redFlagTriggered;
  const finalReasoning = assessmentData?.reasoning || reasoning;
  const finalAssessmentCompleteness = assessmentData?.assessmentCompleteness || assessmentCompleteness;
  const finalProcessedQuestions = assessmentData?.processedQuestions || processedQuestions;
  const finalTotalQuestions = assessmentData?.totalQuestions || totalQuestions;
  const finalWasTruncated = assessmentData?.wasTruncated || wasTruncated;

  return (
    <div className="space-y-6">
      {/* Assessment Quality Indicators */}
      {(finalAssessmentCompleteness !== undefined && finalAssessmentCompleteness < 100) && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Assessment completeness: {finalAssessmentCompleteness}% 
            ({finalProcessedQuestions}/{finalTotalQuestions} questions processed)
            {finalAssessmentCompleteness < 80 && " - Consider reviewing results as assessment may be incomplete."}
          </AlertDescription>
        </Alert>
      )}

      {finalWasTruncated && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Document was truncated due to size limits. Assessment is based on the first portion of the document.
          </AlertDescription>
        </Alert>
      )}

      <AssessmentSummaryCard
        credibilityScore={credibilityScore}
        totalScore={totalScore}
        maxPossibleScore={maxPossibleScore}
        sectionsProcessed={sectionsProcessed}
        overallResult={finalOverallResult}
        redFlagTriggered={finalRedFlagTriggered}
        reasoning={finalReasoning}
        onGeneratePdf={handleGeneratePdf}
        isGeneratingPdf={isGeneratingPdf}
      />

      <SectionStatisticsCard sectionStats={sectionStats} />

      <DetailedResultsTable questionResults={questionResults} />
      
      {finalRedFlagTriggered && assessmentData?.redFlagQuestions && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 mb-2">Red Flag Questions:</h3>
          <ul className="text-sm text-red-700 space-y-1">
            {assessmentData.redFlagQuestions.map((question, index) => (
              <li key={index}>• {question}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DetailedAssessmentSummary;
