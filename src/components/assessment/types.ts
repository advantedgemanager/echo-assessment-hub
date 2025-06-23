
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
  }>;
  totalScore: number;
  maxPossibleScore: number;
  questionnaire_version?: string;
}

export interface DetailedAssessmentSummaryProps {
  credibilityScore: number;
  totalScore: number;
  maxPossibleScore: number;
  reportId: string;
  sectionsProcessed: number;
}
