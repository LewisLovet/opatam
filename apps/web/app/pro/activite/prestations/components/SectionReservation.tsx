'use client';

import { CalendarOff } from 'lucide-react';
import { Input, Switch } from '@/components/ui';
import { EditorSection } from './EditorSection';
import type { ServiceFormData } from './types';

interface SectionReservationProps {
  data: ServiceFormData;
  update: (patch: Partial<ServiceFormData>) => void;
}

/**
 * Suspendre la réservation en ligne d'une prestation SANS la retirer du
 * catalogue : elle reste affichée sur la page publique, grisée et marquée
 * « Indisponible ».
 *
 * À distinguer de la désactivation, qui la fait disparaître complètement —
 * la cliente ne sait alors même pas qu'elle existe, et revient l'année
 * suivante en croyant qu'elle n'est plus proposée. Ici l'information passe :
 * « c'est momentané, revenez ».
 *
 * Le prestataire, lui, peut toujours inscrire un rendez-vous depuis son
 * agenda : l'indisponibilité vise la réservation en ligne, pas l'appel
 * téléphonique.
 */
export function SectionReservation({ data, update }: SectionReservationProps) {
  const unavailable = data.isAvailable === false;

  return (
    <EditorSection
      title="Réservation en ligne"
      description="Suspendre temporairement sans masquer la prestation."
      icon={<CalendarOff className="w-5 h-5" />}
      defaultOpen={unavailable}
      badge={
        unavailable ? (
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40 px-2 py-0.5 rounded">
            Indisponible
          </span>
        ) : undefined
      }
    >
      <label className="flex items-start justify-between gap-3 cursor-pointer">
        <span className="text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Réservable en ligne
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Désactivez pour la laisser visible sur votre page, marquée
            « Indisponible ». Vous pourrez toujours l&apos;inscrire vous-même
            depuis votre agenda.
          </span>
        </span>
        <Switch
          checked={!unavailable}
          onChange={(e) =>
            update({
              isAvailable: e.target.checked,
              // Redevenir réservable efface la note : elle annoncerait une
              // rupture sur une prestation à nouveau ouverte.
              unavailableNote: e.target.checked ? null : data.unavailableNote,
            })
          }
        />
      </label>

      {unavailable && (
        <Input
          label="Raison affichée à vos clientes (optionnel)"
          value={data.unavailableNote ?? ''}
          onChange={(e) => update({ unavailableNote: e.target.value || null })}
          maxLength={120}
          placeholder="Ex : rupture de produit, de retour début septembre"
        />
      )}
    </EditorSection>
  );
}
