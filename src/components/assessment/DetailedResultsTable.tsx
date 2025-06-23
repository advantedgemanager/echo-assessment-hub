
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText } from 'lucide-react';
import { QuestionResult } from './types';
import { getResponseBadgeColor } from './utils';

interface DetailedResultsTableProps {
  questionResults: QuestionResult[];
}

const DetailedResultsTable: React.FC<DetailedResultsTableProps> = ({
  questionResults
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Detailed Results
        </CardTitle>
        <CardDescription>
          Complete breakdown of all questions and AI responses
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question ID</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="max-w-md">Question Text</TableHead>
                <TableHead>AI Answer</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questionResults.map((question, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-xs">{question.questionId}</TableCell>
                  <TableCell className="text-sm">{question.sectionTitle}</TableCell>
                  <TableCell className="max-w-md text-sm">{question.questionText}</TableCell>
                  <TableCell>
                    <Badge className={`${getResponseBadgeColor(question.response)} text-white`}>
                      {question.response}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {question.score}/{question.weight}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default DetailedResultsTable;
