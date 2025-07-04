
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

  // Helper function to get color based on response
  const getResponseColor = (response: string): [number, number, number] => {
    switch (response) {
      case 'Yes':
      case 'Sì':
        return [34, 197, 94]; // Green
      case 'No':
        return [239, 68, 68]; // Red
      case 'N/A':
      case 'NA':
        return [107, 114, 128]; // Gray
      default:
        return [0, 0, 0]; // Black
    }
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

      // Section Statistics with colored counts
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
        
        // Yes count in green
        doc.setTextColor(...getResponseColor('Yes'));
        doc.text(`Sì: ${stat.yesCount} (${stat.yesPercentage}%)`, margin + 5, currentY);
        
        // No count in red
        doc.setTextColor(...getResponseColor('No'));
        doc.text(`No: ${stat.noCount}`, margin + 70, currentY);
        
        // N/A count in gray
        doc.setTextColor(...getResponseColor('N/A'));
        doc.text(`N/A: ${stat.naCount}`, margin + 110, currentY);
        
        // Reset color to black
        doc.setTextColor(0, 0, 0);
        currentY += 8;
        doc.text(`Totale domande: ${stat.totalQuestions}`, margin + 5, currentY);
        currentY += 12;
      });

      // Detailed Results
      checkNewPage(30);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Risultati Dettagliati', margin, currentY);
      currentY += 15;

      questionResults.forEach((question, index) => {
        checkNewPage(40);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
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
        
        // Response with color
        doc.setTextColor(...getResponseColor(question.response));
        doc.text(`Risposta: ${question.response}`, margin, currentY);
        
        // Score in black
        doc.setTextColor(0, 0, 0);
        doc.text(`Punteggio: ${question.score}/${question.weight}`, margin + 80, currentY);
        currentY += 10;
      });

      // Footer
      checkNewPage(20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(0, 0, 0);
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
