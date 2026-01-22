'use client';

import { Avatar } from '@/components/ui/Avatar';
import { Users } from 'lucide-react';

interface Member {
  id: string;
  name: string;
  photoURL: string | null;
}

interface TeamSectionProps {
  members: Member[];
}

export function TeamSection({ members }: TeamSectionProps) {
  // Filter out the default "Principal" member for display
  const displayMembers = members.filter((m) => m.name !== 'Principal');

  if (displayMembers.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <Users className="w-5 h-5 text-primary-500" />
        L&apos;equipe
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {displayMembers.map((member) => (
          <div
            key={member.id}
            className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl"
          >
            <Avatar
              src={member.photoURL}
              alt={member.name}
              size="lg"
              className="w-16 h-16 mb-2"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-white text-center">
              {member.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
