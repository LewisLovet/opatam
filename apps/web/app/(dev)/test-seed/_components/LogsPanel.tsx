'use client';

import { useEffect, useRef } from 'react';
import type { SeedLog } from '../_hooks/useSeedData';
import { Check, X, AlertTriangle, Circle } from 'lucide-react';

interface LogsPanelProps {
  logs: SeedLog[];
  onClear: () => void;
}

export function LogsPanel({ logs, onClear }: LogsPanelProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogColor = (type: SeedLog['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getLogIcon = (type: SeedLog['type']) => {
    switch (type) {
      case 'success':
        return <Check className="w-3 h-3" />;
      case 'error':
        return <X className="w-3 h-3" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3" />;
      default:
        return <Circle className="w-2 h-2" />;
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-200">Logs</h3>
        {logs.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Effacer
          </button>
        )}
      </div>

      <div className="h-64 overflow-y-auto p-4 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            Les logs apparaitront ici...
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <span className="text-gray-500 flex-shrink-0">[{log.time}]</span>
              <span className={`flex-shrink-0 ${getLogColor(log.type)}`}>
                {getLogIcon(log.type)}
              </span>
              <span className={getLogColor(log.type)}>{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
