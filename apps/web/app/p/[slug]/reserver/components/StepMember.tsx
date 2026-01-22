'use client';

import { ArrowLeft, Check, MapPin, User } from 'lucide-react';
import Image from 'next/image';

interface Member {
  id: string;
  name: string;
  photoURL: string | null;
  locationId: string;
  isDefault: boolean;
}

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  type: 'fixed' | 'mobile';
}

interface StepMemberProps {
  members: Member[];
  locations: Location[];
  selectedMemberId: string | null;
  onSelect: (memberId: string) => void;
  onBack: () => void;
}

export function StepMember({
  members,
  locations,
  selectedMemberId,
  onSelect,
  onBack,
}: StepMemberProps) {
  const getLocationForMember = (member: Member): Location | undefined => {
    return locations.find((l) => l.id === member.locationId);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Choisissez un professionnel
        </h2>
      </div>

      <div className="space-y-3">
        {members.map((member) => {
          const isSelected = member.id === selectedMemberId;
          const location = getLocationForMember(member);

          return (
            <button
              key={member.id}
              onClick={() => onSelect(member.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Photo */}
                <div className="flex-shrink-0">
                  {member.photoURL ? (
                    <Image
                      src={member.photoURL}
                      alt={member.name}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {member.name}
                    </h3>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  {location && (
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">
                        {location.name} - {location.city}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
