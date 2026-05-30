'use client';

import { MapPin } from 'lucide-react';
import type { Location, Member } from '@booking-app/shared';
import { EditorSection } from './EditorSection';
import type { ServiceFormData } from './types';

type WithId<T> = { id: string } & T;

interface SectionDisponibiliteProps {
  data: ServiceFormData;
  errors: Record<string, string>;
  locations: WithId<Location>[];
  members: WithId<Member>[];
  isTeamPlan: boolean;
  update: (patch: Partial<ServiceFormData>) => void;
}

/**
 * Where and by whom the prestation can be booked: locations (at least
 * one required) and, on team plans, the assigned members.
 */
export function SectionDisponibilite({
  data,
  errors,
  locations,
  members,
  isTeamPlan,
  update,
}: SectionDisponibiliteProps) {
  const toggleLocation = (locationId: string) => {
    const selected = data.locationIds.includes(locationId);
    update({
      locationIds: selected
        ? data.locationIds.filter((id) => id !== locationId)
        : [...data.locationIds, locationId],
    });
  };

  const toggleMember = (memberId: string) => {
    const current = data.memberIds || [];
    const selected = current.includes(memberId);
    const next = selected
      ? current.filter((id) => id !== memberId)
      : [...current, memberId];
    update({ memberIds: next.length > 0 ? next : null });
  };

  return (
    <EditorSection
      title="Disponibilité"
      description="Lieux et membres qui proposent cette prestation."
      icon={<MapPin className="w-5 h-5" />}
      defaultOpen={false}
      forceOpen={!!errors.locationIds}
    >
      {/* Locations */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Lieux disponibles
        </label>
        {locations.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            Aucun lieu configuré. Créez d&apos;abord un lieu dans l&apos;onglet «&nbsp;Lieux&nbsp;».
          </p>
        ) : (
          <div className="space-y-2">
            {locations.map((location) => (
              <label
                key={location.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={data.locationIds.includes(location.id)}
                  onChange={() => toggleLocation(location.id)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {location.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {location.address?.trim()
                      ? `${location.address}, ${location.city}`
                      : location.city}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
        {errors.locationIds && (
          <p className="mt-1.5 text-sm text-error-600 dark:text-error-400">
            {errors.locationIds}
          </p>
        )}
      </div>

      {/* Members (Teams only) */}
      {isTeamPlan && members.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Membres assignés
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Laissez vide pour que tous les membres puissent effectuer cette prestation
          </p>
          <div className="space-y-2">
            {members.map((member) => (
              <label
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={data.memberIds?.includes(member.id) || false}
                  onChange={() => toggleMember(member.id)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {member.name}
                  </p>
                  {member.email && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {member.email}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </EditorSection>
  );
}
