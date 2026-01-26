'use client';

import type { Review, Member } from '@booking-app/shared';
import { Avatar } from '@/components/ui/Avatar';
import { Star, Lock } from 'lucide-react';

type WithId<T> = { id: string } & T;

interface ReviewCardProps {
  review: WithId<Review>;
  member?: WithId<Member>;
  isTeamPlan: boolean;
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Aujourd'hui";
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
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}

export function ReviewCard({ review, member, isTeamPlan }: ReviewCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <Avatar
          src={review.clientPhoto}
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
              {isTeamPlan && member && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  pour {member.name}
                </p>
              )}
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
              {timeAgo(review.createdAt)}
            </span>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= review.rating
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-gray-200 text-gray-200 dark:fill-gray-600 dark:text-gray-600'
                }`}
              />
            ))}
          </div>

          {/* Comment */}
          <div className="mt-3">
            {review.comment ? (
              <div>
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                  {review.comment}
                </p>
                {!review.isPublic && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <Lock className="w-3 h-3" />
                    <span>Visible uniquement par vous</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 text-sm italic">
                Aucun commentaire
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
