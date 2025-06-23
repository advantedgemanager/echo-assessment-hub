
export interface QuestionResult {
  questionId: string;
  questionText: string;
  response: string;
  score: number;
  weight: number;
  sectionTitle: string;
}

export interface SectionStats {
  sectionTitle: string;
  yesCount: number;
  noCount: number;
  naCount: number;
  totalQuestions: number;
  yesPercentage: number;
  completeness?: number; // Track section completeness
}

export interface AssessmentData {
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
    completeness?: number;
  }>;
  overallResult?: string;
  totalScore: number;
  maxPossibleScore: number;
  redFlagTriggered?: boolean;
  redFlagQuestions?: string[];
  reasoning?: string;
  questionnaire_version?: string;
  assessmentCompleteness?: number; // Overall assessment completeness
  processedQuestions?: number;
  totalQuestions?: number;
  wasTruncated?: boolean;
}

export interface DetailedAssessmentSummaryProps {
  credibilityScore: number;
  totalScore: number;
  maxPossibleScore: number;
  reportId: string;
  sectionsProcessed: number;
  overallResult?: string;
  redFlagTriggered?: boolean;
  reasoning?: string;
  assessmentCompleteness?: number;
  processedQuestions?: number;
  totalQuestions?: number;
  wasTruncated?: boolean;
}
