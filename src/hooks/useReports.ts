
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ReportData {
  id: string;
  credibility_score: number;
  created_at: string;
  report_type: string;
  company_name: string;
  file_name: string;
}

export const useReports = () => {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchReports = async () => {
      if (!user) {
        setReports([]);
        setIsLoading(false);
        return;
      }

      try {
        setError(null);
        
        // Fetch reports with associated document information
        const { data: reportsData, error: reportsError } = await supabase
          .from('assessment_reports')
          .select(`
            id,
            credibility_score,
            created_at,
            report_type,
            company_name,
            user_id
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (reportsError) throw reportsError;

        // For each report, we need to find the associated document to get the file name
        const reportsWithFileNames = await Promise.all(
          (reportsData || []).map(async (report) => {
            // Try to find a document that was assessed around the same time
            const { data: documentData } = await supabase
              .from('uploaded_documents')
              .select('file_name, created_at')
              .eq('user_id', user.id)
              .eq('assessment_status', 'completed')
              .order('created_at', { ascending: false })
              .limit(1);

            // Use the most recent document's file name, or fallback to company name
            const fileName = documentData?.[0]?.file_name || report.company_name || 'Unknown Document';

            return {
              ...report,
              file_name: fileName
            };
          })
        );

        setReports(reportsWithFileNames);
      } catch (error: any) {
        console.error('Error fetching reports:', error);
        setError(error.message);
        toast({
          title: 'Error',
          description: 'Failed to load assessment reports',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, [user, toast]);

  return { reports, isLoading, error };
};
