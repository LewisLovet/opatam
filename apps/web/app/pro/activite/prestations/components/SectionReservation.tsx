'use client';

import { CalendarOff } from 'lucide-react';
import { SERVICE_UNAVAILABLE_REASONS } from '@booking-app/shared';
import { Input, Switch } from '@/components/ui';
import { EditorSection } from './EditorSection';
import type { ServiceFormData } from './types';

interface SectionReservationProps {
  data: ServiceFormData;
  update: (patch: Partial<ServiceFormData>) => void;
}

/**
 * Libellés des motifs. En français ici parce que cet écran est l'espace PRO,
 * pas encore traduit ; la cliente, elle, verra le motif dans SA langue —
 * c'est tout l'intérêt de stocker un code plutôt qu'une phrase.
 */
const REASON_LABELS: Record<(typeof SERVICE_UNAVAILABLE_REASONS)[number], string> = {
  out_of_stock: 'Rupture de produit',
  equipment: 'Matériel indisponible',
  leave: 'Congés / absence',
  training: 'En formation',
  other: 'Autre…',
};

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
              // Redevenir réservable efface motif et note : ils annonceraient
              // une rupture sur une prestation rouverte. À la suspension, un
              // motif par défaut évite un affichage vide.
              unavailableReason: e.target.checked
                ? null
                : (data.unavailableReason ?? 'out_of_stock'),
              unavailableNote: e.target.checked ? null : data.unavailableNote,
            })
          }
        />
      </label>

      {unavailable && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Motif affiché à vos clientes
          </p>
          <div className="flex flex-wrap gap-2">
            {SERVICE_UNAVAILABLE_REASONS.map((reason) => {
              const selected = data.unavailableReason === reason;
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => update({ unavailableReason: reason })}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    selected
                      ? 'bg-amber-500 border-amber-500 text-white font-medium'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                  }`}
                >
                  {REASON_LABELS[reason]}
                </button>
              );
            })}
          </div>

          {/* Le texte libre n'apparaît QUE pour « Autre » : c'est le seul
              motif que la cliente ne verra pas dans sa langue. */}
          {data.unavailableReason === 'other' && (
            <Input
              label="Précisez (affiché tel quel, sans traduction)"
              value={data.unavailableNote ?? ''}
              onChange={(e) => update({ unavailableNote: e.target.value || null })}
              maxLength={120}
              placeholder="Ex : de retour début septembre"
            />
          )}
        </div>
      )}
    </EditorSection>
  );
}
