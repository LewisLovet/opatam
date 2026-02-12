'use client';

import { useState } from 'react';
import { Badge, Switch, useToast } from '@/components/ui';
import { Eye, EyeOff, Copy, Mail } from 'lucide-react';
import type { Member, Location, Service } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface MemberCardProps {
  member: WithId<Member>;
  locations: WithId<Location>[];
  services: WithId<Service>[];
  memberServiceIds: string[];
  onToggleActive: (memberId: string, isActive: boolean) => Promise<void>;
  onClick: () => void;
}

// Generate a consistent color based on the name
function getAvatarColor(name: string): string {
  const colors = [
    'bg-primary-500',
    'bg-secondary-500',
    'bg-accent-500',
    'bg-success-500',
    'bg-warning-500',
    'bg-error-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// Get initials from name (max 2 characters)
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function MemberCard({
  member,
  locations,
  services,
  memberServiceIds,
  onToggleActive,
  onClick,
}: MemberCardProps) {
  const toast = useToast();
  const [toggling, setToggling] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    try {
      await onToggleActive(member.id, checked);
    } finally {
      setToggling(false);
    }
  };

  const handleCopyCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(member.accessCode);
      toast.success('Code copié dans le presse-papier');
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  const handleToggleShowCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCode(!showCode);
  };

  // Get assigned location (NOUVEAU MODÈLE: 1 membre = 1 lieu)
  const assignedLocation = locations.find((loc) => loc.id === member.locationId);

  // Get assigned services
  const assignedServices = services.filter((svc) =>
    memberServiceIds.includes(svc.id)
  );

  // Format services display (max 2-3 names then "+X")
  const formatServicesDisplay = () => {
    if (assignedServices.length === 0) return null;
    const maxShow = 2;
    const shown = assignedServices.slice(0, maxShow).map((s) => s.name);
    const remaining = assignedServices.length - maxShow;
    if (remaining > 0) {
      return `${shown.join(', ')}, +${remaining}`;
    }
    return shown.join(', ');
  };

  const servicesDisplay = formatServicesDisplay();
  const avatarColor = getAvatarColor(member.name);
  const initials = getInitials(member.name);

  return (
    <div
      className={`
        group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
        transition-all duration-200 cursor-pointer
        hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md
        ${!member.isActive ? 'opacity-60' : ''}
      `}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className={`
              w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0
              ${avatarColor}
            `}
          >
            {member.photoURL ? (
              <img
                src={member.photoURL}
                alt={member.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Name and status */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {member.name}
              </h3>
              <Badge variant={member.isActive ? 'success' : 'default'}>
                {member.isActive ? 'Actif' : 'Inactif'}
              </Badge>
            </div>

            {/* Email */}
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
              {member.email}
            </p>

            {/* Assigned location (NOUVEAU MODÈLE: 1 membre = 1 lieu) */}
            {assignedLocation && (
              <div className="mt-2">
                <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                  {assignedLocation.name}
                </span>
              </div>
            )}

            {/* Assigned services */}
            {servicesDisplay && (
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                Prestations : {servicesDisplay}
              </p>
            )}

            {/* Access code */}
            <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono">
                <span className="text-gray-700 dark:text-gray-300">
                  {showCode ? member.accessCode : '••••••••'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleShowCode}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title={showCode ? 'Masquer le code' : 'Voir le code'}
              >
                {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Copier le code"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Toggle switch */}
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={member.isActive}
              onChange={(e) => handleToggle(e.target.checked)}
              disabled={toggling}
              aria-label={member.isActive ? 'Désactiver' : 'Activer'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
