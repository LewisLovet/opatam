'use client';

import { Avatar } from '../ui/Avatar';

interface Member {
  id: string;
  name: string;
  photoURL?: string | null;
  role?: string | null;
}

interface MemberPickerProps {
  members: Member[];
  selectedId?: string | null;
  onSelect: (memberId: string | null) => void;
  showAnyOption?: boolean;
  anyOptionLabel?: string;
  className?: string;
}

export function MemberPicker({
  members,
  selectedId,
  onSelect,
  showAnyOption = true,
  anyOptionLabel = 'Peu importe',
  className = '',
}: MemberPickerProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* "Any" option */}
      {showAnyOption && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`
            w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left
            ${
              selectedId === null
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }
          `}
        >
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className={`font-medium ${selectedId === null ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
              {anyOptionLabel}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Premier disponible
            </p>
          </div>
          {selectedId === null && (
            <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      )}

      {/* Member options */}
      {members.map((member) => (
        <button
          key={member.id}
          type="button"
          onClick={() => onSelect(member.id)}
          className={`
            w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left
            ${
              selectedId === member.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }
          `}
        >
          <Avatar src={member.photoURL} alt={member.name} size="md" />
          <div className="flex-1">
            <p className={`font-medium ${selectedId === member.id ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
              {member.name}
            </p>
            {member.role && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{member.role}</p>
            )}
          </div>
          {selectedId === member.id && (
            <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
