'use client';

import Link from 'next/link';
import { AlertCircle, AlertTriangle, AlertOctagon, ChevronRight, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui';

export interface Alert {
  id: string;
  message: string;
  action: string;
  href: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface AlertCardProps {
  alerts: Alert[];
}

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

  const hasCritical = alerts.some((a) => a.priority === 'critical');
  const hasHighPriority = alerts.some((a) => a.priority === 'high');

  // Container style: critical = red, high = warning, default = neutral
  const containerStyle = hasCritical
    ? 'bg-error-50 dark:bg-error-900/10 border-error-200 dark:border-error-800'
    : hasHighPriority
      ? 'bg-warning-50 dark:bg-warning-900/10 border-warning-200 dark:border-warning-800'
      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';

  const headerBorderStyle = hasCritical
    ? 'border-error-200 dark:border-error-800'
    : hasHighPriority
      ? 'border-warning-200 dark:border-warning-800'
      : 'border-gray-200 dark:border-gray-700';

  const dividerStyle = hasCritical
    ? 'divide-error-200 dark:divide-error-800'
    : hasHighPriority
      ? 'divide-warning-200 dark:divide-warning-800'
      : 'divide-gray-200 dark:divide-gray-700';

  const hoverStyle = hasCritical
    ? 'hover:bg-error-100/50 dark:hover:bg-error-900/20'
    : hasHighPriority
      ? 'hover:bg-warning-100/50 dark:hover:bg-warning-900/20'
      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50';

  return (
    <div className={`rounded-xl border overflow-hidden ${containerStyle}`}>
      <div className={`p-4 sm:px-5 border-b ${headerBorderStyle}`}>
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {hasCritical ? (
            <AlertOctagon className="w-5 h-5 text-error-500" />
          ) : hasHighPriority ? (
            <AlertTriangle className="w-5 h-5 text-warning-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-warning-500" />
          )}
          Actions requises
          <span className="ml-auto text-sm font-normal text-gray-500 dark:text-gray-400">
            {alerts.length}
          </span>
        </h3>
      </div>

      <div className={`divide-y ${dividerStyle}`}>
        {alerts.map((alert) => (
          <Link
            key={alert.id}
            href={alert.href}
            className={`flex items-center gap-3 p-4 sm:px-5 transition-colors ${hoverStyle}`}
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              alert.priority === 'critical'
                ? 'bg-error-500'
                : alert.priority === 'high'
                  ? 'bg-warning-500'
                  : alert.priority === 'medium'
                    ? 'bg-primary-500'
                    : 'bg-gray-400'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-medium ${
                  alert.priority === 'critical'
                    ? 'text-error-700 dark:text-error-400'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {alert.message}
                </p>
                {alert.priority === 'critical' && (
                  <Badge variant="error" size="sm">Important</Badge>
                )}
                {alert.priority === 'high' && (
                  <Badge variant="warning" size="sm">Urgent</Badge>
                )}
              </div>
              <p className={`text-xs mt-0.5 ${
                alert.priority === 'critical'
                  ? 'text-error-600 dark:text-error-400 font-medium'
                  : 'text-primary-600 dark:text-primary-400'
              }`}>
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
