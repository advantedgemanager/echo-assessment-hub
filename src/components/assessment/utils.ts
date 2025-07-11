
export const getOverallRating = (score: number) => {
  if (score >= 85) return { rating: 'Aligned', color: 'bg-green-500' };
  if (score >= 70) return { rating: 'Aligning', color: 'bg-green-400' };
  if (score >= 50) return { rating: 'Partially Aligned', color: 'bg-orange-500' };
  return { rating: 'Misaligned', color: 'bg-red-500' };
};

export const getOverallRatingFromResult = (result: string) => {
  switch (result) {
    case 'Aligned':
      return { rating: 'Aligned', color: 'bg-green-500' };
    case 'Aligning':
      return { rating: 'Aligning', color: 'bg-green-400' };
    case 'Partially Aligned':
      return { rating: 'Partially Aligned', color: 'bg-orange-500' };
    case 'Misaligned':
      return { rating: 'Misaligned', color: 'bg-red-500' };
    default:
      return { rating: 'Unknown', color: 'bg-gray-500' };
  }
};

export const getResponseBadgeColor = (response: string) => {
  switch (response) {
    case 'Yes':
      return 'bg-green-500';
    case 'No':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};
