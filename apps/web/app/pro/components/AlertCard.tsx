'use client';

import Link from 'next/link';
import { AlertCircle, ChevronRight, CheckCircle } from 'lucide-react';

export interface Alert {
  id: string;
  message: string;
  action: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
}

interface AlertCardProps {
  alerts: Alert[];
}

const priorityStyles = {
  high: 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400',
  medium: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
  low: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
};

export function AlertCard({ alerts }: AlertCardProps) {
  if (alerts.length === 0) {
    return (
      <div className="bg-success-50 dark:bg-success-900/10 border border-success-200 dark:border-success-800 rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-success-700 dark:text-success-400">
              Tout est en ordre !
            </p>
            <p className="text-sm text-success-600 dark:text-success-500">
              Votre profil est complet et prêt à recevoir des réservations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 sm:px-5 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-warning-500" />
          Actions requises
          <span className="ml-auto text-sm font-normal text-gray-500 dark:text-gray-400">
            {alerts.length}
          </span>
        </h3>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {alerts.map((alert) => (
          <Link
            key={alert.id}
            href={alert.href}
            className="flex items-center gap-3 p-4 sm:px-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              alert.priority === 'high'
                ? 'bg-warning-500'
                : alert.priority === 'medium'
                  ? 'bg-primary-500'
                  : 'bg-gray-400'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {alert.message}
              </p>
              <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
                {alert.action}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
