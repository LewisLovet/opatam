/**
 * Miroir LOCAL de `isAccessOverrideActive` (packages/shared/src/utils/access.ts).
 *
 * `functions` ne peut pas importer `@booking-app/shared` — même règle que les
 * autres miroirs de ce dossier. Toute modification de la sémantique côté
 * shared doit être reportée ici.
 *
 * Un accès offert actif interdit aux crons et webhooks de traiter le
 * prestataire comme un abonné expiré : pas de dépublication, pas d'e-mail
 * « votre essai est terminé », pas d'alerte de fin d'essai Sérénité.
 */

interface AccessOverrideLike {
  active?: boolean;
  until?: { toDate?: () => Date } | Date | string | number | null;
}

function toDate(raw: unknown): Date | null {
  let d: Date | null = null;
  if (raw instanceof Date) d = raw;
  else if (typeof (raw as { toDate?: () => Date })?.toDate === 'function') {
    d = (raw as { toDate: () => Date }).toDate();
  } else if (typeof raw === 'string' || typeof raw === 'number') d = new Date(raw);
  return d && !isNaN(d.getTime()) ? d : null;
}

export function isAccessOverrideActive(
  override: AccessOverrideLike | null | undefined,
): boolean {
  if (!override?.active) return false;
  if (!override.until) return true; // sans date de fin
  const until = toDate(override.until);
  return !!until && until.getTime() > Date.now();
}
