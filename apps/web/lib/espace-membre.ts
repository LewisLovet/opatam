/**
 * Espace membre — invitations et comptes, côté SERVEUR (Admin SDK).
 *
 * Un membre d'un salon Studio se connecte à l'app avec SON compte :
 *   1. le gérant l'invite (`preparerInvitation`) → e-mail avec un lien signé ;
 *   2. le membre ouvre le lien, crée son mot de passe ou se connecte, et
 *      accepte (`accepterInvitation`) → `memberAccounts/{uid}` est écrit ;
 *   3. le gérant peut retirer l'accès (`retirerAcces`) → le document
 *      disparaît, les règles Firestore refusent tout à la seconde.
 *
 * `memberAccounts` et `memberInvitations` ne s'écrivent QUE d'ici : les
 * règles les ferment au SDK client. Chaque fonction reçoit la base en
 * paramètre — les tests la jouent sur l'émulateur, telle quelle.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { computeEntitlements, espaceMembreOuvert, isTeamTier } from '@booking-app/shared';
import { MEMBER_INVITE_TTL_DAYS } from './member-invite';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normaliserEmail = (e: unknown) => (typeof e === 'string' ? e.trim().toLowerCase() : '');

/** Le salon a-t-il droit aux membres connectés ? Studio, abonnement valide. */
export function salonOuvertAuxMembres(provider: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!provider) return false;
  return isTeamTier(provider) && computeEntitlements(provider).canAccessPro;
}

export type RefusInvitation =
  /** Interrupteur `config/espaceMembre` fermé pour ce salon. */
  | 'pas-ouvert'
  /** L'adresse du membre est déjà prise (voir `emailDisponiblePourMembre`). */
  | RaisonEmailIndisponible
  | 'salon-introuvable'
  | 'plan'
  | 'membre-introuvable'
  | 'membre-principal'
  | 'membre-inactif'
  | 'sans-email';

export interface InvitationPreparee {
  invitationId: string;
  email: string;
  memberName: string;
  businessName: string;
  expiresAt: Date;
}

/**
 * Crée l'invitation de ce membre. Une seule en cours par membre : les
 * précédentes encore en attente passent à « remplacée » — leur lien cesse
 * de valoir, dans la même écriture.
 */
export async function preparerInvitation(
  db: Firestore,
  providerId: string,
  memberId: string,
  maintenant = new Date(),
  trouverCompte: (email: string) => Promise<string | null> = async () => null,
): Promise<{ ok: true; invitation: InvitationPreparee } | { ok: false; raison: RefusInvitation }> {
  const [config, provider, membre, enCours] = await Promise.all([
    db.collection('config').doc('espaceMembre').get(),
    db.collection('providers').doc(providerId).get(),
    db.collection('providers').doc(providerId).collection('members').doc(memberId).get(),
    db.collection('memberInvitations').where('providerId', '==', providerId).get(),
  ]);
  if (!espaceMembreOuvert(config.data(), providerId)) return { ok: false, raison: 'pas-ouvert' };
  if (!provider.exists) return { ok: false, raison: 'salon-introuvable' };
  if (!salonOuvertAuxMembres(provider.data())) return { ok: false, raison: 'plan' };
  if (!membre.exists) return { ok: false, raison: 'membre-introuvable' };
  // Le membre principal EST le gérant : il a déjà son accès.
  if (membre.get('isDefault') === true) return { ok: false, raison: 'membre-principal' };
  if (membre.get('isActive') !== true) return { ok: false, raison: 'membre-inactif' };
  const email = normaliserEmail(membre.get('email'));
  if (!EMAIL.test(email)) return { ok: false, raison: 'sans-email' };
  const dispo = await emailDisponiblePourMembre(db, trouverCompte, { providerId, email, memberId }, maintenant);
  if (!dispo.ok) return { ok: false, raison: dispo.raison };

  const expiresAt = new Date(maintenant.getTime() + MEMBER_INVITE_TTL_DAYS * 86_400_000);
  const ref = db.collection('memberInvitations').doc();
  const lot = db.batch();
  // Égalité seule, filtre en mémoire : aucun index composite.
  for (const ancienne of enCours.docs) {
    if (ancienne.get('memberId') === memberId && ancienne.get('status') === 'pending') {
      lot.update(ancienne.ref, { status: 'replaced' });
    }
  }
  lot.set(ref, {
    providerId,
    memberId,
    email,
    status: 'pending',
    createdAt: Timestamp.fromDate(maintenant),
    expiresAt: Timestamp.fromDate(expiresAt),
    acceptedAt: null,
    acceptedBy: null,
  });
  await lot.commit();
  return {
    ok: true,
    invitation: {
      invitationId: ref.id,
      email,
      memberName: String(membre.get('name') ?? ''),
      businessName: String(provider.get('businessName') ?? ''),
      expiresAt,
    },
  };
}

export type EtatInvitation = 'introuvable' | 'expiree' | 'acceptee' | 'remplacee' | 'retiree';

export interface InvitationLue {
  providerId: string;
  memberId: string;
  email: string;
  memberName: string;
  businessName: string;
}

/** Ce que la page « Rejoindre » affiche — ou pourquoi le lien ne vaut plus. */
export async function lireInvitation(
  db: Firestore,
  invitationId: string,
  maintenant = new Date(),
): Promise<{ ok: true; invitation: InvitationLue } | { ok: false; raison: EtatInvitation }> {
  const snap = await db.collection('memberInvitations').doc(invitationId).get();
  if (!snap.exists) return { ok: false, raison: 'introuvable' };
  const status = snap.get('status');
  if (status === 'accepted') return { ok: false, raison: 'acceptee' };
  if (status === 'replaced') return { ok: false, raison: 'remplacee' };
  if (status !== 'pending') return { ok: false, raison: 'retiree' };
  const expire = snap.get('expiresAt') as Timestamp | undefined;
  if (!expire || expire.toMillis() < maintenant.getTime()) return { ok: false, raison: 'expiree' };

  const providerId = String(snap.get('providerId'));
  const memberId = String(snap.get('memberId'));
  const [provider, membre] = await Promise.all([
    db.collection('providers').doc(providerId).get(),
    db.collection('providers').doc(providerId).collection('members').doc(memberId).get(),
  ]);
  if (!provider.exists || !membre.exists) return { ok: false, raison: 'retiree' };
  return {
    ok: true,
    invitation: {
      providerId,
      memberId,
      email: String(snap.get('email')),
      memberName: String(membre.get('name') ?? ''),
      businessName: String(provider.get('businessName') ?? ''),
    },
  };
}

export type RefusAcceptation =
  | EtatInvitation
  | 'plan'
  | 'membre-inactif'
  /** Le compte connecté n'a pas l'adresse invitée. */
  | 'autre-email'
  /** Un compte de salon ne devient pas membre d'un autre salon. */
  | 'compte-pro'
  /** Déjà relié à un AUTRE membre, d'ici ou d'ailleurs. */
  | 'deja-membre';

/**
 * Relie le compte `uid` au membre invité. En une transaction :
 * `memberAccounts/{uid}` créé, invitation « acceptée », et tout AUTRE
 * compte encore relié à ce membre détaché (un membre = un compte).
 * Crée la fiche utilisateur si le compte vient de naître.
 */
export async function accepterInvitation(
  db: Firestore,
  entree: { invitationId: string; uid: string; emailDuCompte: string | null | undefined },
  maintenant = new Date(),
): Promise<{ ok: true; providerId: string; memberId: string } | { ok: false; raison: RefusAcceptation }> {
  const refInvitation = db.collection('memberInvitations').doc(entree.invitationId);
  const refCompte = db.collection('memberAccounts').doc(entree.uid);
  const refUtilisateur = db.collection('users').doc(entree.uid);

  return db.runTransaction(async (tx) => {
    const invitation = await tx.get(refInvitation);
    if (!invitation.exists) return { ok: false, raison: 'introuvable' as const };
    const status = invitation.get('status');
    if (status === 'accepted') {
      // Double clic, ou retour sur la page : déjà fait POUR CE COMPTE = succès.
      return invitation.get('acceptedBy') === entree.uid
        ? { ok: true as const, providerId: String(invitation.get('providerId')), memberId: String(invitation.get('memberId')) }
        : { ok: false as const, raison: 'acceptee' as const };
    }
    if (status === 'replaced') return { ok: false, raison: 'remplacee' as const };
    if (status !== 'pending') return { ok: false, raison: 'retiree' as const };
    if ((invitation.get('expiresAt') as Timestamp).toMillis() < maintenant.getTime()) {
      return { ok: false, raison: 'expiree' as const };
    }
    if (normaliserEmail(entree.emailDuCompte) !== normaliserEmail(invitation.get('email'))) {
      return { ok: false, raison: 'autre-email' as const };
    }

    const providerId = String(invitation.get('providerId'));
    const memberId = String(invitation.get('memberId'));
    const refMembre = db.collection('providers').doc(providerId).collection('members').doc(memberId);
    const [provider, membre, utilisateur, compte, liesAuSalon] = await Promise.all([
      tx.get(db.collection('providers').doc(providerId)),
      tx.get(refMembre),
      tx.get(refUtilisateur),
      tx.get(refCompte),
      tx.get(db.collection('memberAccounts').where('providerId', '==', providerId)),
    ]);
    if (!salonOuvertAuxMembres(provider.data())) return { ok: false, raison: 'plan' as const };
    if (!membre.exists) return { ok: false, raison: 'retiree' as const };
    if (membre.get('isActive') !== true) return { ok: false, raison: 'membre-inactif' as const };
    if (utilisateur.exists && utilisateur.get('role') === 'provider') return { ok: false, raison: 'compte-pro' as const };
    if (
      compte.exists &&
      compte.get('active') === true &&
      (compte.get('providerId') !== providerId || compte.get('memberId') !== memberId)
    ) {
      return { ok: false, raison: 'deja-membre' as const };
    }

    // Un membre = un compte : un compte relié auparavant à CE membre (le
    // membre a changé d'adresse, on l'a réinvité) perd son accès.
    for (const autre of liesAuSalon.docs) {
      if (autre.id !== entree.uid && autre.get('memberId') === memberId) tx.delete(autre.ref);
    }
    tx.set(refCompte, {
      providerId,
      memberId,
      email: normaliserEmail(entree.emailDuCompte),
      active: true,
      linkedAt: Timestamp.fromDate(maintenant),
    });
    tx.update(refInvitation, {
      status: 'accepted',
      acceptedAt: Timestamp.fromDate(maintenant),
      acceptedBy: entree.uid,
    });
    if (!utilisateur.exists) {
      // Même forme qu'une inscription cliente (authService.registerClient) :
      // l'app sait ouvrir ce compte, et le membre peut aussi y réserver.
      tx.set(refUtilisateur, {
        email: normaliserEmail(entree.emailDuCompte),
        displayName: String(membre.get('name') ?? ''),
        phone: membre.get('phone') ?? null,
        photoURL: null,
        role: 'client',
        providerId: null,
        affiliateId: null,
        city: null,
        birthYear: null,
        gender: null,
        cancellationCount: 0,
        pushTokens: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return { ok: true as const, providerId, memberId };
  });
}

/**
 * Retire l'accès d'un membre à l'app : comptes détachés, invitations en
 * attente retirées. Le membre reste dans l'équipe ; seul son accès tombe.
 */
export async function retirerAcces(
  db: Firestore,
  providerId: string,
  memberId: string,
): Promise<{ comptes: number; invitations: number }> {
  const [comptes, invitations] = await Promise.all([
    db.collection('memberAccounts').where('providerId', '==', providerId).get(),
    db.collection('memberInvitations').where('providerId', '==', providerId).get(),
  ]);
  const lot = db.batch();
  const aDetacher = comptes.docs.filter((d) => d.get('memberId') === memberId);
  const aRetirer = invitations.docs.filter((d) => d.get('memberId') === memberId && d.get('status') === 'pending');
  aDetacher.forEach((d) => lot.delete(d.ref));
  aRetirer.forEach((d) => lot.update(d.ref, { status: 'revoked' }));
  if (aDetacher.length || aRetirer.length) await lot.commit();
  return { comptes: aDetacher.length, invitations: aRetirer.length };
}

/**
 * Le compte `uid` est-il le membre `memberId` du salon `providerId`, accès
 * actif ? Pour les routes qui accordent au membre les privilèges « pro »
 * (créer un rendez-vous dans SON agenda sans acompte, par exemple).
 */
export async function estMembreDuSalon(
  db: Firestore,
  uid: string | null | undefined,
  providerId: string,
  memberId: string | null | undefined,
): Promise<boolean> {
  if (!uid || !memberId) return false;
  const compte = await db.collection('memberAccounts').doc(uid).get();
  return (
    compte.exists &&
    compte.get('active') === true &&
    compte.get('providerId') === providerId &&
    compte.get('memberId') === memberId
  );
}

/**
 * Une invitation de membre attend-elle cette adresse (en attente, lien
 * valable) ? Pour prévenir avant la création d'un compte professionnel.
 */
export async function invitationEnAttentePour(db: Firestore, email: string, maintenant = new Date()): Promise<boolean> {
  // Égalité seule, filtre en mémoire : aucun index composite.
  const snap = await db.collection('memberInvitations').where('email', '==', normaliserEmail(email)).get();
  return snap.docs.some(
    (d) => d.get('status') === 'pending' && ((d.get('expiresAt') as Timestamp | undefined)?.toMillis() ?? 0) > maintenant.getTime(),
  );
}

export type RaisonEmailIndisponible =
  /** Déjà l'adresse d'un compte Opatam (gérant, cliente…) qui n'est pas ce membre. */
  | 'compte-existant'
  /** Un autre membre du même salon a déjà cette adresse. */
  | 'autre-membre'
  /** Une invitation en cours, d'un autre salon ou pour un autre membre. */
  | 'invite-ailleurs';

/**
 * Cette adresse peut-elle devenir celle d'un membre (et donc son identifiant
 * de connexion) ? Une adresse déjà prise mènerait le membre, à la
 * connexion, dans le compte de quelqu'un d'autre — ou changerait le mot de
 * passe de ce compte via « mot de passe oublié ».
 *
 * `trouverCompte(email)` : l'uid du compte Firebase de cette adresse, ou
 * `null` (injecté : l'Admin Auth en production, un double dans les tests).
 * Un compte SANS fiche utilisateur ni lien membre est un compte ouvert
 * depuis la page d'invitation, pas encore relié : il ne bloque pas.
 */
export async function emailDisponiblePourMembre(
  db: Firestore,
  trouverCompte: (email: string) => Promise<string | null>,
  entree: { providerId: string; email: string; memberId?: string | null },
  maintenant = new Date(),
): Promise<{ ok: true } | { ok: false; raison: RaisonEmailIndisponible }> {
  const email = normaliserEmail(entree.email);
  const [uid, membres, invitations] = await Promise.all([
    trouverCompte(email),
    db.collection('providers').doc(entree.providerId).collection('members').get(),
    db.collection('memberInvitations').where('email', '==', email).get(),
  ]);

  if (uid) {
    const [utilisateur, compte] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('memberAccounts').doc(uid).get(),
    ]);
    const cestLuiMeme =
      compte.exists && compte.get('providerId') === entree.providerId && compte.get('memberId') === entree.memberId;
    if (!cestLuiMeme && (utilisateur.exists || compte.exists)) return { ok: false, raison: 'compte-existant' };
  }
  if (membres.docs.some((m) => m.id !== entree.memberId && normaliserEmail(m.get('email')) === email)) {
    return { ok: false, raison: 'autre-membre' };
  }
  const ailleurs = invitations.docs.some(
    (d) =>
      d.get('status') === 'pending' &&
      ((d.get('expiresAt') as Timestamp | undefined)?.toMillis() ?? 0) > maintenant.getTime() &&
      (d.get('providerId') !== entree.providerId || d.get('memberId') !== entree.memberId),
  );
  if (ailleurs) return { ok: false, raison: 'invite-ailleurs' };
  return { ok: true };
}

/** Ce que voit le gérant quand l'adresse est refusée. */
export const MESSAGES_EMAIL_INDISPONIBLE: Record<RaisonEmailIndisponible, string> = {
  'compte-existant':
    "Cette adresse est déjà celle d'un compte Opatam. Pour que ce membre ait son propre accès, utilisez son adresse personnelle.",
  'autre-membre': 'Un autre membre de votre équipe utilise déjà cette adresse.',
  'invite-ailleurs': 'Cette adresse a déjà reçu une invitation d’un autre salon ou pour un autre membre.',
};
