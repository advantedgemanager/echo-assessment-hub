
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { QuestionResult, SectionStats } from './types';
import { getOverallRating } from './utils';
import jsPDF from 'jspdf';

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
      
      // Create new PDF document
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      let currentY = margin;

      // Helper function to add new page if needed
      const checkNewPage = (neededHeight: number) => {
        if (currentY + neededHeight > pageHeight - margin) {
          doc.addPage();
          currentY = margin;
        }
      };

      // Helper function to add text with word wrapping
      const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 12) => {
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y);
        return lines.length * (fontSize * 0.4);
      };

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Report di Valutazione Piano di Transizione', margin, currentY);
      currentY += 15;

      // Company name
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text(reportData.company_name, margin, currentY);
      currentY += 10;

      // Date and ID
      doc.setFontSize(12);
      const createdDate = new Date(reportData.created_at).toLocaleDateString('it-IT');
      doc.text(`Data generazione: ${createdDate}`, margin, currentY);
      currentY += 8;
      doc.text(`ID Report: ${reportId.slice(-12)}`, margin, currentY);
      currentY += 15;

      // Rating and Score
      const { rating } = getOverallRating(credibilityScore);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Valutazione: ${rating}`, margin, currentY);
      currentY += 10;
      
      doc.setFontSize(24);
      doc.text(`${credibilityScore}%`, margin, currentY);
      currentY += 10;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Punteggio: ${totalScore.toFixed(1)} / ${maxPossibleScore} punti`, margin, currentY);
      currentY += 20;

      // Section Statistics
      checkNewPage(30);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Statistiche per Sezione', margin, currentY);
      currentY += 15;

      sectionStats.forEach((stat, index) => {
        checkNewPage(25);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${stat.sectionTitle}`, margin, currentY);
        currentY += 8;
        
        doc.setFont('helvetica', 'normal');
        doc.text(`Sì: ${stat.yesCount} (${stat.yesPercentage}%) | No: ${stat.noCount} | N/A: ${stat.naCount}`, margin + 5, currentY);
        currentY += 8;
        doc.text(`Totale domande: ${stat.totalQuestions}`, margin + 5, currentY);
        currentY += 12;
      });

      // Detailed Results
      checkNewPage(30);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Risultati Dettagliati', margin, currentY);
      currentY += 15;

      questionResults.forEach((question, index) => {
        checkNewPage(30);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ID: ${question.questionId}`, margin, currentY);
        currentY += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.text(`Sezione: ${question.sectionTitle}`, margin, currentY);
        currentY += 6;
        
        // Question text with wrapping
        const questionHeight = addWrappedText(
          `Domanda: ${question.questionText}`, 
          margin, 
          currentY, 
          maxWidth, 
          10
        );
        currentY += questionHeight + 2;
        
        doc.text(`Risposta: ${question.response} | Punteggio: ${question.score}/${question.weight}`, margin, currentY);
        currentY += 10;
      });

      // Footer
      checkNewPage(20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Report generato automaticamente dal sistema di valutazione AI', margin, currentY);
      currentY += 6;
      doc.text(`Documento contiene ${questionResults.length} domande analizzate su ${sectionStats.length} sezioni`, margin, currentY);

      // Save the PDF
      const fileName = `assessment-report-${reportData.company_name.replace(/[^a-z0-9]/gi, '_')}-${reportId.slice(-8)}.pdf`;
      doc.save(fileName);

      toast({
        title: 'Report generato',
        description: 'Il report PDF è stato scaricato con successo.'
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
