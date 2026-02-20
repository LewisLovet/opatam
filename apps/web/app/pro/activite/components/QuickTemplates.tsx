'use client';

import { Briefcase, Coffee, Scissors, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { DaySchedule } from '../hooks/useScheduleReducer';

interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  icon: typeof Briefcase;
  schedule: DaySchedule[];
}

const TEMPLATES: ScheduleTemplate[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'Lun-Ven, 9h-18h',
    icon: Briefcase,
    schedule: [
      { dayOfWeek: 0, isOpen: false, slots: [] },
      { dayOfWeek: 1, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
      { dayOfWeek: 2, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
      { dayOfWeek: 3, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
      { dayOfWeek: 4, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
      { dayOfWeek: 5, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
      { dayOfWeek: 6, isOpen: false, slots: [] },
    ],
  },
  {
    id: 'with-break',
    name: 'Avec pause',
    description: 'Lun-Ven, 9h-12h + 14h-18h',
    icon: Coffee,
    schedule: [
      { dayOfWeek: 0, isOpen: false, slots: [] },
      { dayOfWeek: 1, isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
      { dayOfWeek: 2, isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
      { dayOfWeek: 3, isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
      { dayOfWeek: 4, isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
      { dayOfWeek: 5, isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
      { dayOfWeek: 6, isOpen: false, slots: [] },
    ],
  },
  {
    id: 'salon',
    name: 'Salon / Commerce',
    description: 'Mar-Sam, 9h-19h',
    icon: Scissors,
    schedule: [
      { dayOfWeek: 0, isOpen: false, slots: [] },
      { dayOfWeek: 1, isOpen: false, slots: [] },
      { dayOfWeek: 2, isOpen: true, slots: [{ start: '09:00', end: '19:00' }] },
      { dayOfWeek: 3, isOpen: true, slots: [{ start: '09:00', end: '19:00' }] },
      { dayOfWeek: 4, isOpen: true, slots: [{ start: '09:00', end: '19:00' }] },
      { dayOfWeek: 5, isOpen: true, slots: [{ start: '09:00', end: '19:00' }] },
      { dayOfWeek: 6, isOpen: true, slots: [{ start: '09:00', end: '19:00' }] },
    ],
  },
];

// Mini week preview: 7 dots (Mon-Sun order)
const DOT_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface QuickTemplatesProps {
  onApply: (schedule: DaySchedule[]) => void;
}

export function QuickTemplates({ onApply }: QuickTemplatesProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span>Modèles rapides</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map((template) => {
            const Icon = template.icon;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onApply(template.schedule)}
                className="flex flex-col items-start gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all text-left"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
                    <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {template.name}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {template.description}
                </span>
                {/* Mini week dots */}
                <div className="flex gap-1 mt-1">
                  {DOT_ORDER.map((day) => {
                    const daySchedule = template.schedule.find((d) => d.dayOfWeek === day);
                    const isOpen = daySchedule?.isOpen ?? false;
                    return (
                      <div
                        key={day}
                        className={`w-2 h-2 rounded-full ${
                          isOpen
                            ? 'bg-primary-500 dark:bg-primary-400'
                            : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
