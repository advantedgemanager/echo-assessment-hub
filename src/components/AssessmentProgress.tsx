
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface AssessmentProgressProps {
  status: 'processing' | 'assessing' | 'completed' | 'error';
  progress: number;
  currentStep?: string;
  error?: string;
}

const AssessmentProgress: React.FC<AssessmentProgressProps> = ({
  status,
  progress,
  currentStep,
  error
}) => {
  const getIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'processing':
        return 'Processing Document';
      case 'assessing':
        return 'AI Assessment in Progress';
      case 'completed':
        return 'Assessment Completed';
      case 'error':
        return 'Assessment Failed';
      default:
        return 'Processing...';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getIcon()}
          {getTitle()}
        </CardTitle>
        <CardDescription>
          {status === 'error' ? 'An error occurred during assessment' : 'Please wait while we analyze your document'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progress} className="w-full" />
        <div className="text-sm text-muted-foreground">
          {error ? (
            <p className="text-red-600">{error}</p>
          ) : currentStep ? (
            <p>{currentStep}</p>
          ) : (
            <p>{progress}% complete</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AssessmentProgress;
