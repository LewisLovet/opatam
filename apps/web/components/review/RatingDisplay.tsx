'use client';

import { useId } from 'react';

type RatingSize = 'sm' | 'md' | 'lg';

interface RatingDisplayProps {
  rating: number;
  count?: number;
  size?: RatingSize;
  showCount?: boolean;
  className?: string;
}

const sizeStyles: Record<RatingSize, { star: string; text: string; count: string }> = {
  sm: { star: 'w-3.5 h-3.5', text: 'text-sm', count: 'text-xs' },
  md: { star: 'w-4 h-4', text: 'text-base', count: 'text-sm' },
  lg: { star: 'w-5 h-5', text: 'text-lg', count: 'text-base' },
};

function StarIcon({
  filled,
  half,
  className,
  gradientId,
}: {
  filled: boolean;
  half: boolean;
  className: string;
  gradientId: string;
}) {
  if (half) {
    return (
      <svg className={className} viewBox="0 0 24 24">
        <defs>
          <linearGradient id={gradientId}>
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#d1d5db" />
          </linearGradient>
        </defs>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={`url(#${gradientId})`}
        />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={filled ? '#f59e0b' : '#d1d5db'}
        className={filled ? '' : 'dark:fill-gray-600'}
      />
    </svg>
  );
}

export function RatingDisplay({
  rating,
  count,
  size = 'md',
  showCount = true,
  className = '',
}: RatingDisplayProps) {
  const id = useId();
  const styles = sizeStyles[size];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* Stars */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: fullStars }).map((_, i) => (
          <StarIcon
            key={`full-${i}`}
            filled
            half={false}
            className={styles.star}
            gradientId={`${id}-full-${i}`}
          />
        ))}
        {hasHalfStar && (
          <StarIcon
            filled={false}
            half
            className={styles.star}
            gradientId={`${id}-half`}
          />
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <StarIcon
            key={`empty-${i}`}
            filled={false}
            half={false}
            className={styles.star}
            gradientId={`${id}-empty-${i}`}
          />
        ))}
      </div>

      {/* Rating Number */}
      <span className={`font-semibold text-gray-900 dark:text-white ${styles.text}`}>
        {rating.toFixed(1)}
      </span>

      {/* Count */}
      {showCount && count !== undefined && (
        <span className={`text-gray-500 dark:text-gray-400 ${styles.count}`}>
          ({count} avis)
        </span>
      )}
    </div>
  );
}
