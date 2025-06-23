
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, CheckCircle, AlertCircle } from 'lucide-react';
import { SectionStats } from './types';

interface SectionStatisticsCardProps {
  sectionStats: SectionStats[];
}

const SectionStatisticsCard: React.FC<SectionStatisticsCardProps> = ({
  sectionStats
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Section Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sectionStats.map((stat, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm">{stat.sectionTitle}</h4>
                {stat.completeness !== undefined && (
                  <div className="flex items-center gap-1">
                    {stat.completeness >= 80 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="text-xs text-gray-600">{stat.completeness}%</span>
                  </div>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Yes:</span>
                  <span className="font-medium text-green-600">{stat.yesCount} ({stat.yesPercentage}%)</span>
                </div>
                <div className="flex justify-between">
                  <span>No:</span>
                  <span className="font-medium text-red-600">{stat.noCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>N/A:</span>
                  <span className="font-medium text-gray-600">{stat.naCount}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span>Total:</span>
                  <span className="font-medium">{stat.totalQuestions}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SectionStatisticsCard;
