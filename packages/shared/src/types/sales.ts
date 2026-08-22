/**
 * Domaine commercial — Phase 0 : le MODÈLE, avant toute interface.
 *
 * Trois décisions structurantes, héritées de l'audit :
 *
 *  - le personnel commercial vit dans `staffMembers`, PAS dans un champ de
 *    `users` : le flag `isAdmin` posé sur le document utilisateur a produit
 *    une escalade de privilège ; on ne recrée pas le piège. Cette collection
 *    n'est inscriptible que par l'Admin SDK.
 *
 *  - un prospect (`SalesLead`) est DISTINCT d'un compte Opatam : la plupart
 *    des prospects n'ont pas encore de compte, et un compte peut exister sans
 *    prospect. Le lien se fait par `linkedProviderId` quand l'inscription a
 *    lieu.
 *
 *  - l'ACTIVATION est calculée à la lecture depuis l'état réel du compte
 *    (voir computeActivation), jamais stockée : un commercial est récompensé
 *    pour des abonnés activés et conservés, pas pour des comptes vides — et
 *    un état stocké mentirait dès que le prestataire dépublie ou supprime
 *    ses prestations.
 */

// ── Personnel ────────────────────────────────────────────────────────────────

export type SalesStaffRole = 'sales' | 'sales_manager';

/** Document `staffMembers/{uid}` — uid = compte Firebase du commercial. */
export interface StaffMember {
  role: SalesStaffRole;
  /** Un commercial désactivé garde son historique mais perd tout accès. */
  active: boolean;
  displayName: string;
  email: string;
  createdAt: Date;
  createdBy: string;
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Le tunnel officiel, dans l'ordre. Chaque étape est franchie une fois —
 * l'historique des passages vit dans `salesActivities`, l'étape courante sur
 * le prospect.
 */
export const SALES_STAGES = [
  'prospect',
  'contacte',
  'reponse',
  'qualifie',
  'demo_planifiee',
  'demo_realisee',
  'essai_cree',
  'essai_active',
  'payant',
  'conserve_j90',
] as const;
export type SalesStage = (typeof SALES_STAGES)[number];

/** Un prospect perdu garde son étape d'origine + un motif. */
export const SALES_LOSS_REASONS = [
  'pas_de_reponse',
  'pas_interesse',
  'prix',
  'concurrent',
  'pas_le_bon_moment',
  'hors_cible',
  'autre',
] as const;
export type SalesLossReason = (typeof SALES_LOSS_REASONS)[number];

export const SALES_SECTORS = [
  'beaute',
  'coiffure',
  'onglerie',
  'bien_etre',
  'studio',
  'autre',
] as const;
export type SalesSector = (typeof SALES_SECTORS)[number];

/** Document `salesLeads/{id}`. */
export interface SalesLead {
  /** uid du commercial propriétaire (staffMembers). */
  ownerUid: string;
  stage: SalesStage;
  /** Renseigné uniquement quand le prospect est perdu. */
  lostReason: SalesLossReason | null;

  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  sector: SalesSector;
  isTeam: boolean;
  /** D'où vient le contact — obligation de traçabilité (CNIL). */
  source: string | null;
  /** Problème principal exprimé (temps, no-shows, visibilité, coordination). */
  mainPain: string | null;
  notes: string | null;

  /** Compte Opatam une fois l'inscription faite (Provider.id). */
  linkedProviderId: string | null;

  /** Opposition à la prospection : plus AUCUN contact sortant. */
  optOut: boolean;

  nextActionAt: Date | null;
  lastInteractionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Document `salesActivities/{id}` — journal immuable. */
export interface SalesActivity {
  leadId: string;
  /** uid de l'auteur (commercial ou manager). */
  authorUid: string;
  type: 'note' | 'appel' | 'email' | 'demo' | 'changement_etape';
  /** Pour un changement d'étape : l'étape atteinte. */
  stage: SalesStage | null;
  body: string | null;
  createdAt: Date;
}
