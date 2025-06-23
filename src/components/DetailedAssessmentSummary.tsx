
import React from 'react';
import { DetailedAssessmentSummaryProps } from './assessment/types';
import { useAssessmentData } from './assessment/useAssessmentData';
import { usePdfGenerator } from './assessment/usePdfGenerator';
import AssessmentSummaryCard from './assessment/AssessmentSummaryCard';
import SectionStatisticsCard from './assessment/SectionStatisticsCard';
import DetailedResultsTable from './assessment/DetailedResultsTable';

const DetailedAssessmentSummary: React.FC<DetailedAssessmentSummaryProps> = ({
  credibilityScore,
  totalScore,
  maxPossibleScore,
  reportId,
  sectionsProcessed
}) => {
  const { questionResults, sectionStats, isLoading } = useAssessmentData(reportId);
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

  return (
    <div className="space-y-6">
      <AssessmentSummaryCard
        credibilityScore={credibilityScore}
        totalScore={totalScore}
        maxPossibleScore={maxPossibleScore}
        sectionsProcessed={sectionsProcessed}
        onGeneratePdf={handleGeneratePdf}
        isGeneratingPdf={isGeneratingPdf}
      />

      <SectionStatisticsCard sectionStats={sectionStats} />

      <DetailedResultsTable questionResults={questionResults} />
    </div>
  );
};

export default DetailedAssessmentSummary;
