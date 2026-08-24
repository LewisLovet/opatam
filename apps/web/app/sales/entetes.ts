'use client';

import { getAuth } from 'firebase/auth';

/**
 * En-têtes des appels /api/sales/* — jeton + « vue commerciale ».
 *
 * La vue commerciale permet à un manager/admin de voir l'espace EXACTEMENT
 * comme un commercial : l'en-tête demande au serveur de le traiter avec le
 * rôle 'sales' (cloisonné sur son propre uid). C'est une RESTRICTION
 * volontaire — le serveur ne sait qu'abaisser un rôle sur cet en-tête,
 * jamais l'élever — donc un client qui l'enverrait à tort ne gagne rien.
 */

export const CLE_VUE_COMMERCIALE = 'sales-vue-commerciale';

export function vueCommercialeActive(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem(CLE_VUE_COMMERCIALE) === '1';
}

export function basculerVueCommerciale(active: boolean): void {
  if (active) localStorage.setItem(CLE_VUE_COMMERCIALE, '1');
  else localStorage.removeItem(CLE_VUE_COMMERCIALE);
  // Toutes les pages refont leurs appels avec le nouveau périmètre.
  window.location.reload();
}

export async function enTetesStaff(): Promise<Record<string, string>> {
  const t = await getAuth().currentUser?.getIdToken();
  return {
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
    ...(vueCommercialeActive() ? { 'x-sales-scope': 'self' } : {}),
  };
}
