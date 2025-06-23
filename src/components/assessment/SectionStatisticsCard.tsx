
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
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
              <h4 className="font-semibold mb-3 text-sm">{stat.sectionTitle}</h4>
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
