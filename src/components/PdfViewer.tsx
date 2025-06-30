
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { extractTextFromPdfAdvanced, isPdfReadable, PdfExtractionResult } from '@/utils/advancedPdfReader';

const PdfViewer: React.FC = () => {
  const [extractionResult, setExtractionResult] = useState<PdfExtractionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Per favore seleziona un file PDF');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setExtractionResult(null);

    try {
      const result = await extractTextFromPdfAdvanced(file);
      setExtractionResult(result);
      
      if (!isPdfReadable(result.text)) {
        setError('Il PDF sembra contenere principalmente immagini o testo non leggibile');
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'estrazione del testo');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Lettore PDF Avanzato
          </CardTitle>
          <CardDescription>
            Carica un PDF per estrarre e analizzare il contenuto testuale
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileUpload}
              disabled={isProcessing}
              className="hidden"
              id="pdf-upload"
            />
            <label htmlFor="pdf-upload">
              <Button asChild disabled={isProcessing}>
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  {isProcessing ? 'Elaborazione...' : 'Carica PDF'}
                </span>
              </Button>
            </label>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {extractionResult && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  PDF analizzato con successo! {extractionResult.pageCount} pagine, 
                  {extractionResult.text.length} caratteri estratti
                  {extractionResult.hasImages && ' (contiene immagini)'}
                </AlertDescription>
              </Alert>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Testo Estratto:
                </label>
                <Textarea
                  value={extractionResult.text}
                  readOnly
                  className="min-h-[300px] font-mono text-sm"
                  placeholder="Il testo estratto apparirà qui..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Pagine:</strong> {extractionResult.pageCount}
                </div>
                <div>
                  <strong>Caratteri:</strong> {extractionResult.text.length}
                </div>
                <div>
                  <strong>Contiene immagini:</strong> {extractionResult.hasImages ? 'Sì' : 'No'}
                </div>
                <div>
                  <strong>Leggibile:</strong> {isPdfReadable(extractionResult.text) ? 'Sì' : 'No'}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PdfViewer;
