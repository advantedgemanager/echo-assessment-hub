
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { QuestionResult, SectionStats } from './types';
import { getOverallRating } from './utils';

export const usePdfGenerator = () => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();

  const fetchReportData = async (reportId: string) => {
    const { data: report, error } = await supabase
      .from('assessment_reports')
      .select('assessment_data, company_name, created_at, credibility_score')
      .eq('id', reportId)
      .single();

    if (error) throw error;
    return report;
  };

  const generatePdfContent = (
    reportData: any,
    credibilityScore: number,
    totalScore: number,
    maxPossibleScore: number,
    reportId: string,
    sectionStats: SectionStats[],
    questionResults: QuestionResult[]
  ) => {
    const { rating } = getOverallRating(credibilityScore);
    const createdDate = new Date(reportData.created_at).toLocaleDateString('it-IT');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Assessment Report - ${reportData.company_name}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            line-height: 1.6;
            color: #333;
        }
        .header { 
            text-align: center; 
            margin-bottom: 40px; 
            border-bottom: 2px solid #ddd;
            padding-bottom: 20px;
        }
        .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
            margin: 10px 0;
        }
        .rating { 
            padding: 15px 25px; 
            border-radius: 8px; 
            color: white; 
            display: inline-block; 
            font-size: 18px;
            font-weight: bold;
            margin: 15px 0;
        }
        .rating.aligned { background: linear-gradient(135deg, #10b981, #059669); }
        .rating.aligning { background: linear-gradient(135deg, #84cc16, #65a30d); }
        .rating.partially { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .rating.misaligned { background: linear-gradient(135deg, #ef4444, #dc2626); }
        
        .score-summary {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: center;
        }
        .score-large {
            font-size: 48px;
            font-weight: bold;
            color: #2c3e50;
            margin: 10px 0;
        }
        .score-detail {
            font-size: 16px;
            color: #666;
        }

        .section-stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 20px; 
            margin: 30px 0; 
        }
        .stat-card { 
            border: 1px solid #ddd; 
            padding: 20px; 
            border-radius: 8px; 
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-card h3 {
            margin-top: 0;
            color: #2c3e50;
            font-size: 16px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
        }
        .stat-label { font-weight: 500; }
        .stat-value { font-weight: bold; }
        .yes-count { color: #10b981; }
        .no-count { color: #ef4444; }
        .na-count { color: #64748b; }

        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 30px 0; 
            font-size: 12px;
        }
        th, td { 
            border: 1px solid #ddd; 
            padding: 12px 8px; 
            text-align: left; 
            vertical-align: top;
        }
        th { 
            background-color: #f1f5f9; 
            font-weight: bold;
            color: #334155;
        }
        tr:nth-child(even) { background-color: #f8fafc; }
        
        .response-badge {
            padding: 4px 8px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            font-size: 11px;
        }
        .response-yes { background-color: #10b981; }
        .response-no { background-color: #ef4444; }
        .response-na { background-color: #64748b; }
        
        .question-text {
            max-width: 300px;
            word-wrap: break-word;
        }
        
        .page-break { page-break-before: always; }
        
        @media print { 
            body { margin: 0; }
            .page-break { page-break-before: always; }
        }
        
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Report di Valutazione Piano di Transizione</h1>
        <div class="company-name">${reportData.company_name}</div>
        <p><strong>Data generazione:</strong> ${createdDate}</p>
        <p><strong>ID Report:</strong> ${reportId.slice(-12)}</p>
        
        <div class="rating ${rating.toLowerCase().replace(/\s+/g, '')}">
            ${rating}
        </div>
        
        <div class="score-summary">
            <div class="score-large">${credibilityScore}%</div>
            <div class="score-detail">
                Punteggio di Credibilità<br>
                ${totalScore.toFixed(1)} / ${maxPossibleScore} punti totali
            </div>
        </div>
    </div>

    <h2>Statistiche per Sezione</h2>
    <div class="section-stats">
        ${sectionStats.map(stat => `
            <div class="stat-card">
                <h3>${stat.sectionTitle}</h3>
                <div class="stat-row">
                    <span class="stat-label">Sì:</span>
                    <span class="stat-value yes-count">${stat.yesCount} (${stat.yesPercentage}%)</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">No:</span>
                    <span class="stat-value no-count">${stat.noCount}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">N/A:</span>
                    <span class="stat-value na-count">${stat.naCount}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"><strong>Totale:</strong></span>
                    <span class="stat-value">${stat.totalQuestions}</span>
                </div>
            </div>
        `).join('')}
    </div>

    <div class="page-break"></div>
    <h2>Risultati Dettagliati</h2>
    <p>Analisi completa di tutte le domande e risposte AI</p>
    
    <table>
        <thead>
            <tr>
                <th style="width: 60px;">ID</th>
                <th style="width: 120px;">Sezione</th>
                <th style="width: 300px;">Domanda</th>
                <th style="width: 80px;">Risposta AI</th>
                <th style="width: 80px;">Punteggio</th>
            </tr>
        </thead>
        <tbody>
            ${questionResults.map(q => `
                <tr>
                    <td><code>${q.questionId}</code></td>
                    <td><small>${q.sectionTitle}</small></td>
                    <td class="question-text">${q.questionText}</td>
                    <td>
                        <span class="response-badge response-${q.response.toLowerCase()}">
                            ${q.response}
                        </span>
                    </td>
                    <td><strong>${q.score}/${q.weight}</strong></td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div class="footer">
        <p>Report generato automaticamente dal sistema di valutazione AI</p>
        <p>Questo documento contiene ${questionResults.length} domande analizzate su ${sectionStats.length} sezioni</p>
    </div>
</body>
</html>`;
  };

  const generatePdfReport = async (
    credibilityScore: number,
    totalScore: number,
    maxPossibleScore: number,
    reportId: string,
    sectionStats: SectionStats[],
    questionResults: QuestionResult[]
  ) => {
    setIsGeneratingPdf(true);
    try {
      // Fetch complete report data
      const reportData = await fetchReportData(reportId);
      
      // Generate comprehensive PDF content
      const pdfContent = generatePdfContent(
        reportData,
        credibilityScore,
        totalScore,
        maxPossibleScore,
        reportId,
        sectionStats,
        questionResults
      );
      
      // Create and download HTML file (which browsers can print to PDF)
      const blob = new Blob([pdfContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `assessment-report-${reportData.company_name.replace(/[^a-z0-9]/gi, '_')}-${reportId.slice(-8)}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Report generato',
        description: 'Il report dettagliato è stato scaricato. Aprilo nel browser e usa "Stampa > Salva come PDF" per ottenere un PDF.'
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile generare il report PDF',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return { generatePdfReport, isGeneratingPdf };
};
