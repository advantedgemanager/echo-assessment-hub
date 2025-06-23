
import React from 'react';
import { DetailedAssessmentSummaryProps } from './assessment/types';
import { useAssessmentData } from './assessment/useAssessmentData';
import { usePdfGenerator } from './assessment/usePdfGenerator';
import AssessmentSummaryCard from './assessment/AssessmentSummaryCard';
import SectionStatisticsCard from './assessment/SectionStatisticsCard';
import DetailedResultsTable from './assessment/DetailedResultsTable';
import { AlertTriangle, Info, CheckCircle, Clock } from 'lucide-react';
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
  wasTruncated,
  version
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
        <div className="text-center p-8 flex items-center justify-center gap-2">
          <Clock className="h-5 w-5 animate-spin" />
          Loading detailed results...
        </div>
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
  const assessmentVersion = assessmentData?.questionnaire_version || version;

  return (
    <div className="space-y-6">
      {/* Enhanced Assessment Quality Indicators */}
      {assessmentVersion && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Assessment completed using questionnaire version {assessmentVersion}
          </AlertDescription>
        </Alert>
      )}

      {(finalAssessmentCompleteness !== undefined && finalAssessmentCompleteness < 100) && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Assessment completeness: {finalAssessmentCompleteness}% 
            ({finalProcessedQuestions}/{finalTotalQuestions} questions processed)
            {finalAssessmentCompleteness < 80 && " - Results may be less comprehensive due to incomplete assessment."}
            {finalAssessmentCompleteness >= 80 && " - Assessment quality is good with substantial coverage."}
          </AlertDescription>
        </Alert>
      )}

      {finalWasTruncated && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Document was truncated due to size limits. Assessment is based on the first portion of the document.
            For more comprehensive results, consider submitting a shorter document or key sections.
          </AlertDescription>
        </Alert>
      )}

      {/* Enhanced Assessment Summary */}
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

      {/* Enhanced Section Statistics */}
      <SectionStatisticsCard sectionStats={sectionStats} />

      {/* Detailed Results Table */}
      <DetailedResultsTable questionResults={questionResults} />
      
      {/* Enhanced Red Flag Display */}
      {finalRedFlagTriggered && assessmentData?.redFlagQuestions && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Red Flag Questions:
          </h3>
          <ul className="text-sm text-red-700 space-y-1">
            {assessmentData.redFlagQuestions.map((question, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-red-500 mt-1">•</span>
                <span>{question}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 p-3 bg-red-100 rounded text-sm text-red-800">
            <strong>Impact:</strong> Red flag questions answered "No" result in an automatic "Misaligned" rating, 
            indicating critical gaps in the transition plan that require immediate attention.
          </div>
        </div>
      )}

      {/* Assessment Quality Information */}
      {finalAssessmentCompleteness !== undefined && finalAssessmentCompleteness < 100 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Info className="h-5 w-5" />
            Assessment Information:
          </h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p>
              This assessment processed {finalProcessedQuestions} out of {finalTotalQuestions} available questions 
              ({finalAssessmentCompleteness}% coverage).
            </p>
            {finalWasTruncated && (
              <p>
                The document was truncated due to size limitations. For the most comprehensive assessment, 
                consider submitting key sections separately or a condensed version of your transition plan.
              </p>
            )}
            <p>
              The AI evaluation system analyzes multiple document sections for each question to provide 
              the most accurate assessment possible within the available content.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailedAssessmentSummary;
