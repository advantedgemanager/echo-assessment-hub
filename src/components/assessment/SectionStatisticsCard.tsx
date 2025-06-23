
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';
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
          {sectionStats.map((stat, index) => {
            const getPerformanceColor = (percentage: number) => {
              if (percentage >= 70) return 'text-green-600';
              if (percentage >= 40) return 'text-yellow-600';
              return 'text-red-600';
            };

            const getPerformanceIcon = (percentage: number) => {
              if (percentage >= 70) return <CheckCircle className="h-4 w-4 text-green-500" />;
              if (percentage >= 40) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
              return <XCircle className="h-4 w-4 text-red-500" />;
            };

            return (
              <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">{stat.sectionTitle}</h4>
                  <div className="flex items-center gap-2">
                    {getPerformanceIcon(stat.yesPercentage)}
                    {stat.completeness !== undefined && (
                      <div className="flex items-center gap-1">
                        <Info className="h-3 w-3 text-gray-500" />
                        <span className="text-xs text-gray-600">{stat.completeness}%</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span>Yes:</span>
                    <span className={`font-medium ${getPerformanceColor(stat.yesPercentage)}`}>
                      {stat.yesCount} ({stat.yesPercentage}%)
                    </span>
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

                {/* Performance indicator bar */}
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        stat.yesPercentage >= 70 ? 'bg-green-500' : 
                        stat.yesPercentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${stat.yesPercentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1 text-center">
                    Performance: {stat.yesPercentage >= 70 ? 'Strong' : stat.yesPercentage >= 40 ? 'Moderate' : 'Needs Improvement'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {sectionStats.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <Info className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No section statistics available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SectionStatisticsCard;
