'use client';

import type { Member } from '@booking-app/shared';
import { Users } from 'lucide-react';

type WithId<T> = { id: string } & T;

interface SelectMemberPromptProps {
  members: WithId<Member>[];
  onSelect: (memberId: string) => void;
}

export function SelectMemberPrompt({ members, onSelect }: SelectMemberPromptProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
        <Users className="w-8 h-8 text-primary-600 dark:text-primary-400" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Sélectionnez un membre
      </h3>

      {/* Subtitle */}
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md mb-8">
        Choisissez un membre de l&apos;équipe pour afficher son planning de la semaine
      </p>

      {/* Members grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full max-w-2xl">
        {members.map((member) => (
          <button
            key={member.id}
            onClick={() => onSelect(member.id)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
          >
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <span className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                {member.name.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Name */}
            <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 text-center truncate w-full">
              {member.name}
            </span>
          </button>
        ))}
      </div>

      {/* Empty state if no members */}
      {members.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aucun membre disponible
        </p>
      )}
    </div>
  );
}
