'use client';

import { MapPin, Clock, Info } from 'lucide-react';
import { LocationCard } from './LocationCard';
import { HoursCard } from './HoursCard';
import { TeamSection } from './TeamSection';

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  type: 'fixed' | 'mobile';
  travelRadius: number | null;
}

interface Member {
  id: string;
  name: string;
  photoURL: string | null;
  locationId: string;
}

interface Availability {
  memberId: string;
  dayOfWeek: number;
  slots: { start: string; end: string }[];
  isOpen: boolean;
}

interface InfosSectionProps {
  locations: Location[];
  members: Member[];
  availabilities: Availability[];
  isTeam: boolean;
}

const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function InfosSection({ locations, members, availabilities, isTeam }: InfosSectionProps) {
  // Get default member for schedule display (in solo mode)
  const defaultMember = members.find((m) => m.name === 'Principal') || members[0];

  // Get schedule for display (use default member's schedule)
  const schedule = defaultMember
    ? availabilities.filter((a) => a.memberId === defaultMember.id)
    : [];

  // Sort schedule by day (Monday first)
  const sortedSchedule = [...schedule].sort((a, b) => {
    // Convert to Monday-first (0=Mon, 6=Sun)
    const dayA = a.dayOfWeek === 0 ? 6 : a.dayOfWeek - 1;
    const dayB = b.dayOfWeek === 0 ? 6 : b.dayOfWeek - 1;
    return dayA - dayB;
  });

  // Build full week schedule
  const weekSchedule = [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
    const daySchedule = sortedSchedule.find((s) => s.dayOfWeek === dayOfWeek);
    return {
      day: dayNames[dayOfWeek],
      isOpen: daySchedule?.isOpen ?? false,
      slots: daySchedule?.slots ?? [],
    };
  });

  return (
    <section className="py-10 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-6">
        <Info className="w-6 h-6 text-primary-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Informations pratiques
        </h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Locations Column */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary-500" />
            {locations.length > 1 ? 'Lieux' : 'Lieu'}
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm rounded-full">
              {locations.length}
            </span>
          </h3>
          <div className="space-y-4">
            {locations.map((location) => (
              <LocationCard key={location.id} location={location} />
            ))}
          </div>
        </div>

        {/* Hours Column */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-500" />
            Horaires d'ouverture
          </h3>
          <HoursCard weekSchedule={weekSchedule} />
        </div>
      </div>

      {/* Team Section */}
      {isTeam && members.length > 1 && (
        <div className="mt-10">
          <TeamSection members={members} />
        </div>
      )}
    </section>
  );
}
