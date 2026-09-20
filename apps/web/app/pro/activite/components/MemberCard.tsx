'use client';

import { useState } from 'react';
import { Switch, useToast } from '@/components/ui';
import { AlertTriangle, CheckCircle2, ChevronRight, Copy, Eye, EyeOff } from 'lucide-react';
import type { Member, Location, Service, EtatMembre, BlocageMembre } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface MemberCardProps {
  member: WithId<Member>;
  locations: WithId<Location>[];
  services: WithId<Service>[];
  memberServiceIds: string[];
  /** Peut-il recevoir des réservations, et sinon pourquoi (voir diagnostiquerMembre). */
  etat?: EtatMembre;
  /** Rendez-vous encore possibles sur 7 jours. `null` = comptage en cours. */
  creneaux?: number | null;
  /** « Lun–Ven · 9h–18h », ou `null` si aucun horaire n'est enregistré. */
  resumeHoraires?: string | null;
  /** Dans une section de lieu, le lieu est déjà dans l'en-tête : ne pas le répéter. */
  masquerLieu?: boolean;
  /** Cette ligne est celle qu'affiche le panneau de réglage. */
  selectionne?: boolean;
  /** Emmène le professionnel là où le blocage se répare. */
  onCorriger?: () => void;
  onToggleActive: (memberId: string, isActive: boolean) => Promise<void>;
  onClick: () => void;
}

/**
 * Ce qui manque, dit simplement. Un membre « actif » sans horaires
 * enregistrés n'a AUCUN créneau, et rien ne le signalait : l'éditeur
 * d'horaires affiche des horaires par défaut même quand la base est vide.
 */
const MANQUES: Record<BlocageMembre, string> = {
  inactif: 'désactivé',
  sansHoraires: 'aucun horaire enregistré',
  sansPrestation: 'aucune prestation attribuée',
  lieuInactif: 'son lieu est désactivé',
};

function getAvatarColor(name: string): string {
  const colors = [
    'bg-primary-500', 'bg-secondary-500', 'bg-accent-500', 'bg-success-500',
    'bg-warning-500', 'bg-error-500', 'bg-purple-500', 'bg-pink-500',
    'bg-indigo-500', 'bg-teal-500',
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function MemberCard({
  member,
  locations,
  services,
  memberServiceIds,
  etat,
  creneaux = null,
  resumeHoraires = null,
  masquerLieu = false,
  selectionne = false,
  onToggleActive,
  onClick,
  onCorriger,
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

  const assignedLocation = locations.find((loc) => loc.id === member.locationId);
  const assignedServices = services.filter((svc) => memberServiceIds.includes(svc.id));

  const avatarColor = member.color ? '' : getAvatarColor(member.name);
  const initials = getInitials(member.name);

  const nombre = creneaux;
  const bloque = member.isActive && etat ? !etat.reservable : false;
  const manque = etat
    ? etat.blocages.filter((b) => b !== 'inactif').map((b) => MANQUES[b]).join(', ')
    : '';

  // Sous-titre : dans une section de lieu on décrit le travail (prestations
  // et horaires) ; hors section il faut d'abord dire OÙ se trouve la personne.
  const nbPrestations = `${assignedServices.length} prestation${assignedServices.length > 1 ? 's' : ''}`;
  const sousTitre = masquerLieu
    ? nbPrestations
    : `${assignedLocation ? assignedLocation.name : 'Aucun lieu'} · ${nbPrestations}`;
  // Les horaires sont utiles mais secondaires : sur téléphone ils se
  // faisaient tronquer en « Lun–Ve… », ce qui n'apprend rien. Ils
  // n'apparaissent donc qu'à partir de la largeur où ils tiennent.
  const horairesSecondaires = masquerLieu ? (resumeHoraires ?? 'Horaires à configurer') : null;

  return (
    <div
      className={`
        group relative flex items-center gap-3 px-4 py-3.5
        transition-colors cursor-pointer
        ${
          selectionne
            ? 'bg-primary-50/70 dark:bg-primary-950/20'
            : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700/40'
        }
        ${!member.isActive ? 'opacity-60' : ''}
      `}
      onClick={onClick}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${avatarColor}`}
        style={member.color ? { backgroundColor: member.color } : undefined}
      >
        {member.photoURL ? (
          <img src={member.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          initials
        )}
      </div>

      {/* Identité et chiffre. Côte à côte dès qu'il y a la place ; empilés
          sur téléphone, sinon le nom et le lieu se font tronquer par le
          chiffre alors qu'ils sont ce qu'on cherche des yeux. */}
      <div className="flex-1 min-w-0 sm:flex sm:items-center sm:gap-4">
        <div className="min-w-0 sm:flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{member.name}</h3>
            {!member.isActive ? (
              <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                Désactivé
              </span>
            ) : bloque ? (
              <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-semibold text-warning-700 dark:bg-warning-900/20 dark:text-warning-400">
                <AlertTriangle className="h-3 w-3" /> À compléter
              </span>
            ) : etat ? (
              <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700 dark:bg-success-900/20 dark:text-success-400">
                <CheckCircle2 className="h-3 w-3" /> Prêt
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 truncate">
            {sousTitre}
            {horairesSecondaires && <span className="hidden sm:inline"> · {horairesSecondaires}</span>}
          </p>
        </div>

        {/* LE chiffre : combien de rendez-vous cette personne peut encore
            recevoir cette semaine. Un zéro en orange se repère sans lire. */}
        {member.isActive && (
          <div className="mt-1 sm:mt-0 flex-shrink-0 sm:text-right">
            {nombre === null ? (
              <span className="text-sm text-gray-400">—</span>
            ) : (
              <>
                <p
                  className={`text-base sm:text-lg font-semibold leading-tight ${
                    nombre === 0
                      ? 'text-warning-700 dark:text-warning-400'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {nombre} créneau{nombre > 1 ? 'x' : ''}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {bloque ? manque : 'cette semaine'}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bouton d'action SEULEMENT là où il y a quelque chose à corriger. */}
      {bloque && onCorriger && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCorriger();
          }}
          className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-warning-300 text-warning-800 hover:bg-warning-50 dark:border-warning-800 dark:text-warning-300 dark:hover:bg-warning-950/20"
        >
          Corriger
        </button>
      )}

      {/* Code d'accès, replié : utile, mais il ne doit pas occuper la ligne. */}
      {/* Le code d'accès est utile mais secondaire : sur téléphone il
          encombrait la ligne au point de couper le nom. Il reste dans la
          fiche complète. */}
      <div
        className="hidden flex-shrink-0 items-center gap-1 sm:flex"
        onClick={(e) => e.stopPropagation()}
      >
        {showCode && (
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">
            {member.accessCode}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowCode(!showCode);
          }}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title={showCode ? 'Masquer le code d’accès' : 'Voir le code d’accès'}
          aria-label={showCode ? 'Masquer le code d’accès' : 'Voir le code d’accès'}
        >
          {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        {showCode && (
          <button
            type="button"
            onClick={handleCopyCode}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Copier le code"
            aria-label="Copier le code d’accès"
          >
            <Copy className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <Switch
          checked={member.isActive}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={toggling}
          aria-label={member.isActive ? 'Désactiver' : 'Activer'}
        />
      </div>

      <ChevronRight
        className={`h-5 w-5 flex-shrink-0 transition-colors ${
          selectionne
            ? 'text-primary-600 dark:text-primary-400'
            : 'text-gray-300 group-hover:text-primary-500 dark:text-gray-600'
        }`}
      />
    </div>
  );
}
