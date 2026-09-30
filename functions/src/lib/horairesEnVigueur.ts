/**
 * Miroir de `horaireEnVigueurLe` (@booking-app/shared/utils/horaires) — les
 * functions n'importent pas le paquet partagé à l'exécution.
 *
 * Les horaires d'UN jour de la semaine en vigueur LE jour `jour` (date
 * calendaire du lieu) : parmi les documents de ce jour de la semaine, celui
 * dont la date d'effet est la plus récente sans dépasser `jour` ; les
 * horaires de base (`effectiveFrom` nul) valent depuis toujours. Le calcul de
 * la prochaine disponibilité gardait le dernier document lu : un changement
 * programmé pour plus tard s'appliquait dès aujourd'hui.
 */
export function horaireEnVigueurLe<T extends { dayOfWeek: number; effectiveFrom?: Date | null }>(
  docs: readonly T[],
  jourSemaine: number,
  jour: string,
  jourDEffet: (d: Date) => string,
): T | null {
  let retenu: T | null = null;
  let effetRetenu = '';
  for (const d of docs) {
    if (d.dayOfWeek !== jourSemaine) continue;
    const effet = d.effectiveFrom ? jourDEffet(new Date(d.effectiveFrom)) : '';
    if (effet && effet > jour) continue;
    if (!retenu || effet >= effetRetenu) {
      retenu = d;
      effetRetenu = effet;
    }
  }
  return retenu;
}
