
export interface QuestionnaireSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

export interface Question {
  id: string;
  text: string;
  type: 'multiple_choice' | 'scale' | 'text' | 'yes_no';
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  scale_labels?: {
    min: string;
    max: string;
  };
  weight: number; // For scoring calculations
  required: boolean;
}

export interface CredibilityQuestionnaire {
  version: string;
  title: string;
  description: string;
  sections: QuestionnaireSection[];
  scoring: {
    max_score: number;
    thresholds: {
      high: number;
      medium: number;
      low: number;
    };
  };
}

// Sample questionnaire structure for reference
export const sampleQuestionnaire: CredibilityQuestionnaire = {
  version: "1.0",
  title: "Transition Plan Credibility Assessment",
  description: "Comprehensive assessment tool for evaluating the credibility of organizational transition plans",
  sections: [
    {
      id: "strategic_planning",
      title: "Strategic Planning & Vision",
      description: "Evaluates the clarity and feasibility of strategic objectives",
      questions: [
        {
          id: "sp_001",
          text: "How clearly defined are the transition objectives?",
          type: "scale",
          scale_min: 1,
          scale_max: 5,
          scale_labels: {
            min: "Very unclear",
            max: "Extremely clear"
          },
          weight: 0.8,
          required: true
        },
        {
          id: "sp_002",
          text: "Does the organization have a documented transition strategy?",
          type: "yes_no",
          weight: 0.6,
          required: true
        }
      ]
    },
    {
      id: "resource_management",
      title: "Resource Management",
      description: "Assesses the adequacy and allocation of resources for the transition",
      questions: [
        {
          id: "rm_001",
          text: "How adequate are the financial resources allocated for the transition?",
          type: "scale",
          scale_min: 1,
          scale_max: 5,
          scale_labels: {
            min: "Highly inadequate",
            max: "More than adequate"
          },
          weight: 0.9,
          required: true
        }
      ]
    }
  ],
  scoring: {
    max_score: 100,
    thresholds: {
      high: 80,
      medium: 60,
      low: 40
    }
  }
};
