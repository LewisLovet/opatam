'use client';

import {
  Briefcase,
  Calendar,
  XCircle,
  Star,
  UserPlus,
} from 'lucide-react';
import type { ActivityEvent } from '@/services/admin/types';

interface ActivityFeedProps {
  events: ActivityEvent[];
}

const eventConfig: Record<
  ActivityEvent['type'],
  { icon: typeof Briefcase; color: string; bg: string }
> = {
  new_provider: {
    icon: Briefcase,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
  },
  new_booking: {
    icon: Calendar,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
  },
  cancelled_booking: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-500/10',
  },
  new_review: {
    icon: Star,
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
  },
  new_user: {
    icon: UserPlus,
    color: 'text-gray-500',
    bg: 'bg-gray-50 dark:bg-gray-500/10',
  },
};

function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHours < 24) return `il y a ${diffHours}h`;
  if (diffDays === 1) return 'hier';
  return `il y a ${diffDays}j`;
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aucune activité récente
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700/50">
      {events.map((event) => {
        const config = eventConfig[event.type];
        const Icon = config.icon;

        return (
          <div key={event.id} className="flex items-start gap-3 p-4">
            <div
              className={`flex-shrink-0 w-9 h-9 rounded-full ${config.bg} flex items-center justify-center`}
            >
              <Icon className={`w-4 h-4 ${config.color}`} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {event.title}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {event.description}
              </p>
            </div>

            <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {getRelativeTime(event.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
