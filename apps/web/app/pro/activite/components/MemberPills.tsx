'use client';

import type { Location, Member } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface MemberPillsProps {
  members: WithId<Member>[];
  locations: WithId<Location>[];
  selectedMemberId: string;
  onSelect: (memberId: string) => void;
  disabled?: boolean;
}

export function MemberPills({
  members,
  locations,
  selectedMemberId,
  onSelect,
  disabled = false,
}: MemberPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((member) => {
        const isActive = member.id === selectedMemberId;
        const location = locations.find((l) => l.id === member.locationId);

        return (
          <button
            key={member.id}
            type="button"
            onClick={() => onSelect(member.id)}
            disabled={disabled}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isActive
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }
            `}
          >
            <span>{member.name}</span>
            {location && (
              <span className={`text-xs ${isActive ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {location.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
