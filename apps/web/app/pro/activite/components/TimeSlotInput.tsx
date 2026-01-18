'use client';

import { X } from 'lucide-react';

interface TimeSlotInputProps {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  onRemove?: () => void;
  error?: string;
  showRemove?: boolean;
}

// Generate time options from 00:00 to 23:30 by 30 min increments
const generateTimeOptions = () => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const value = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      options.push({ value, label: value });
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

export function TimeSlotInput({
  start,
  end,
  onChange,
  onRemove,
  error,
  showRemove = false,
}: TimeSlotInputProps) {
  const handleStartChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value, end);
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(start, e.target.value);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <select
          value={start}
          onChange={handleStartChange}
          className={`
            flex-1 px-3 py-2 rounded-lg border appearance-none
            text-gray-900 dark:text-gray-100
            bg-white dark:bg-gray-800
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-0
            ${error
              ? 'border-error-500 focus:border-error-500 focus:ring-error-500'
              : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500'
            }
          `}
        >
          {TIME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <span className="text-gray-500 dark:text-gray-400">-</span>

        <select
          value={end}
          onChange={handleEndChange}
          className={`
            flex-1 px-3 py-2 rounded-lg border appearance-none
            text-gray-900 dark:text-gray-100
            bg-white dark:bg-gray-800
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-0
            ${error
              ? 'border-error-500 focus:border-error-500 focus:ring-error-500'
              : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500'
            }
          `}
        >
          {TIME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {showRemove && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-2 text-gray-400 hover:text-error-500 dark:hover:text-error-400 transition-colors"
            aria-label="Supprimer ce creneau"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
      )}
    </div>
  );
}
