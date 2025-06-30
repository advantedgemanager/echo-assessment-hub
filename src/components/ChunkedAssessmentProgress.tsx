
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, AlertCircle, Zap } from 'lucide-react';

interface ChunkedAssessmentProgressProps {
  status: 'processing' | 'completed' | 'error';
  progress: number;
  currentStep?: string;
  error?: string;
  currentBatch?: number;
  totalBatches?: number;
  processedQuestions?: number;
  totalQuestions?: number;
}

const ChunkedAssessmentProgress: React.FC<ChunkedAssessmentProgressProps> = ({
  status,
  progress,
  currentStep,
  error,
  currentBatch = 0,
  totalBatches = 0,
  processedQuestions = 0,
  totalQuestions = 0
}) => {
  const getIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Zap className="h-5 w-5 text-blue-500 animate-pulse" />;
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'processing':
        return 'AI Assessment in Progress';
      case 'completed':
        return 'Assessment Completed';
      case 'error':
        return 'Assessment Failed';
      default:
        return 'Processing...';
    }
  };

  const getDescription = () => {
    if (status === 'error') return 'An error occurred during assessment';
    if (status === 'completed') return 'Your document has been successfully analyzed';
    return 'Analyzing your document with advanced AI processing';
  };

  // Calculate more accurate progress percentage
  const calculateDetailedProgress = () => {
    if (status === 'completed') return 100;
    if (totalQuestions > 0 && processedQuestions > 0) {
      return Math.min(95, Math.round((processedQuestions / totalQuestions) * 100));
    }
    return progress;
  };

  const detailedProgress = calculateDetailedProgress();
  const progressText = status === 'processing' ? `${detailedProgress}%` : `${progress}%`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getIcon()}
          {getTitle()}
          {status === 'processing' && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {progressText}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {getDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={detailedProgress} className="w-full" />
        
        <div className="text-sm text-muted-foreground space-y-2">
          {error ? (
            <p className="text-red-600 font-medium">{error}</p>
          ) : (
            <>
              {currentStep && (
                <p className="font-medium flex items-center justify-between">
                  <span>{currentStep}</span>
                  {status === 'processing' && (
                    <span className="text-blue-600 font-semibold">{progressText}</span>
                  )}
                </p>
              )}
              
              {totalQuestions > 0 && (
                <div className="grid grid-cols-2 gap-4 mt-3 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-semibold text-foreground">Questions Progress</p>
                    <p className="flex items-center justify-between">
                      <span>{processedQuestions} / {totalQuestions} questions</span>
                      <span className="text-xs text-blue-600 font-medium">
                        {totalQuestions > 0 ? Math.round((processedQuestions / totalQuestions) * 100) : 0}%
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Batch Progress</p>
                    <p className="flex items-center justify-between">
                      <span>{currentBatch} / {totalBatches} batches</span>
                      <span className="text-xs text-blue-600 font-medium">
                        {totalBatches > 0 ? Math.round((currentBatch / totalBatches) * 100) : 0}%
                      </span>
                    </p>
                  </div>
                </div>
              )}
              
              {status === 'processing' && (
                <div className="flex items-center gap-2 text-blue-600 mt-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Processing is more reliable with chunked batches</span>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ChunkedAssessmentProgress;
