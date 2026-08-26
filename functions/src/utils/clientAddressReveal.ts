import * as admin from 'firebase-admin';

/**
 * Adresse d'intervention de la CLIENTE (prestation à domicile).
 *
 * MIROIR de packages/shared/src/utils/address.ts → isClientAddressRevealed
 * (les Cloud Functions n'importent pas le package partagé) — tenir les deux
 * synchronisés ; le test jumeau clientAddressReveal.test.ts verrouille la
 * table de statuts.
 *
 * Règle : visible du pro dès la CONFIRMATION (pas de fenêtre 48 h — il doit
 * pouvoir planifier sa tournée). Avant : ville seule.
 */
export function isClientAddressRevealed(booking: { status: string }): boolean {
  return booking.status === 'confirmed' || booking.status === 'completed';
}

export interface ResolvedClientAddress {
  /** Adresse complète si révélée, sinon la ville seule. */
  line: string;
  revealed: boolean;
}

/**
 * Résout l'adresse d'intervention pour un e-mail. L'adresse exacte vit dans
 * `bookings/{id}/private/clientAddress` (Admin-only) — jamais sur le doc
 * public, qui ne porte que la ville (`travel.clientCity`).
 */
export async function resolveClientAddress(
  bookingId: string,
  booking: { status: string; travel?: { clientCity?: string } | null },
): Promise<ResolvedClientAddress | null> {
  if (!booking.travel) return null;
  const city = booking.travel.clientCity ?? '';
  if (!isClientAddressRevealed(booking)) {
    return { line: city, revealed: false };
  }
  try {
    const snap = await admin
      .firestore()
      .collection('bookings')
      .doc(bookingId)
      .collection('private')
      .doc('clientAddress')
      .get();
    const data = snap.data();
    if (data?.address) {
      return { line: data.address as string, revealed: true };
    }
  } catch (e) {
    console.error(`[clientAddressReveal] lecture privée échouée (${bookingId}):`, e);
  }
  // Doc privé illisible/absent : dégrader en ville plutôt qu'échouer.
  return { line: city, revealed: false };
}
