
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QuestionResult, SectionStats, AssessmentData } from './types';

export const useAssessmentData = (reportId: string) => {
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
  const [sectionStats, setSectionStats] = useState<SectionStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDetailedResults = async () => {
      try {
        const { data: report, error } = await supabase
          .from('assessment_reports')
          .select('assessment_data')
          .eq('id', reportId)
          .single();

        if (error) throw error;

        // Type guard to ensure assessment_data has the expected structure
        const assessmentData = report.assessment_data as unknown as AssessmentData;
        
        if (!assessmentData || !assessmentData.sections || !Array.isArray(assessmentData.sections)) {
          throw new Error('Invalid assessment data structure');
        }

        const sections = assessmentData.sections;
        const allQuestions: QuestionResult[] = [];
        const stats: SectionStats[] = [];

        sections.forEach((section) => {
          let yesCount = 0;
          let noCount = 0;
          let naCount = 0;

          if (section.questions && Array.isArray(section.questions)) {
            section.questions.forEach((q) => {
              allQuestions.push({
                questionId: q.questionId,
                questionText: q.questionText,
                response: q.response,
                score: q.score,
                weight: q.weight,
                sectionTitle: section.sectionTitle
              });

              switch (q.response) {
                case 'Yes':
                  yesCount++;
                  break;
                case 'No':
                  noCount++;
                  break;
                default:
                  naCount++;
                  break;
              }
            });
          }

          const totalQuestions = section.questions ? section.questions.length : 0;
          stats.push({
            sectionTitle: section.sectionTitle,
            yesCount,
            noCount,
            naCount,
            totalQuestions,
            yesPercentage: totalQuestions > 0 ? Math.round((yesCount / totalQuestions) * 100) : 0
          });
        });

        setQuestionResults(allQuestions);
        setSectionStats(stats);
      } catch (error) {
        console.error('Error fetching detailed results:', error);
        toast({
          title: 'Error',
          description: 'Failed to load detailed assessment results',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetailedResults();
  }, [reportId, toast]);

  return { questionResults, sectionStats, isLoading };
};
