'use client';

import { Avatar } from '../ui/Avatar';
import { Card, CardBody } from '../ui/Card';
import { RatingDisplay } from './RatingDisplay';

interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    comment?: string | null;
    clientName: string;
    clientPhotoURL?: string | null;
    serviceName?: string | null;
    createdAt: Date;
  };
  className?: string;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Aujourd\'hui';
  } else if (diffDays === 1) {
    return 'Hier';
  } else if (diffDays < 7) {
    return `Il y a ${diffDays} jours`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `Il y a ${months} mois`;
  } else {
    return formatDate(date);
  }
}

export function ReviewCard({ review, className = '' }: ReviewCardProps) {
  return (
    <Card variant="bordered" className={className}>
      <CardBody>
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar
            src={review.clientPhotoURL}
            alt={review.clientName}
            size="md"
            className="flex-shrink-0"
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {review.clientName}
                </h4>
                {review.serviceName && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {review.serviceName}
                  </p>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                {timeAgo(review.createdAt)}
              </span>
            </div>

            {/* Rating */}
            <div className="mt-2">
              <RatingDisplay rating={review.rating} showCount={false} size="sm" />
            </div>

            {/* Comment */}
            {review.comment && (
              <p className="mt-3 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                {review.comment}
              </p>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
