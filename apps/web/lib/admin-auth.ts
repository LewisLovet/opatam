import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

/**
 * Authentification des routes d'administration — LE point unique.
 *
 * AVANT : 23 routes acceptaient un en-tête `x-admin-uid` fourni par le client
 * et se contentaient de vérifier que ce uid portait `isAdmin: true` en base.
 * Connaître l'uid d'un administrateur — une chaîne qui transite dans chaque
 * requête du back-office — suffisait donc à lister les utilisateurs, lire les
 * revenus Stripe, offrir des accès ou supprimer des comptes.
 *
 * MAINTENANT : un vrai jeton Firebase est exigé (`Authorization: Bearer`),
 * vérifié cryptographiquement par l'Admin SDK ; l'uid en est EXTRAIT, jamais
 * déclaré. Le flag `isAdmin` est ensuite relu côté serveur — il n'est
 * inscriptible que par l'Admin SDK depuis la fermeture des règles `users`.
 *
 * L'en-tête `x-admin-uid` n'est plus lu nulle part : coupure nette, déployée
 * en même temps que les services client qui envoient désormais le jeton.
 *
 * Préparé pour le chantier commercial : `requireStaff(request, 'sales')`
 * acceptera d'autres rôles serveur sans réécrire les routes.
 */

export type StaffRole = 'admin';

export interface StaffIdentity {
  uid: string;
  role: StaffRole;
}

/** Réponse d'erreur prête à retourner quand l'authentification échoue. */
export type StaffAuthResult =
  | { ok: true; identity: StaffIdentity }
  | { ok: false; response: NextResponse };

export async function requireAdmin(request: NextRequest): Promise<StaffAuthResult> {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentification requise' }, { status: 401 }),
    };
  }

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(header.slice(7))).uid;
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Jeton invalide ou expiré' }, { status: 401 }),
    };
  }

  const snap = await getAdminFirestore().collection('users').doc(uid).get();
  if (!snap.exists || snap.data()?.isAdmin !== true) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 }),
    };
  }

  return { ok: true, identity: { uid, role: 'admin' } };
}
