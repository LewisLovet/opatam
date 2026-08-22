import type { AccessOverride } from '../types';

/** Firestore Timestamp / Date / ISO string / epoch → Date (null if invalid). */
function toDate(raw: unknown): Date | null {
  let d: Date | null = null;
  if (raw instanceof Date) {
    d = raw;
  } else if (typeof (raw as { toDate?: () => Date })?.toDate === 'function') {
    d = (raw as { toDate: () => Date }).toDate();
  } else if (typeof raw === 'string' || typeof raw === 'number') {
    d = new Date(raw);
  }
  return d && !isNaN(d.getTime()) ? d : null;
}

/**
 * Whether a manual "comp" access grant is currently in effect.
 *
 * Used by every access gate (web layout, /api/bookings, mobile
 * useSubscriptionStatus) and by the cancellation webhook (to skip unpublishing
 * comped providers). Robust to `until` arriving as a Date, a Firestore
 * Timestamp, or an ISO string, depending on how the doc was read.
 */
export function isAccessOverrideActive(override: AccessOverride | null | undefined): boolean {
  if (!override?.active) return false;
  if (!override.until) return true; // indefinite grant
  const until = toDate(override.until);
  return !!until && until.getTime() > Date.now();
}

/**
 * Whether the provider's FREE base trial is currently running.
 *
 * The trial is local-only (no Stripe/RevenueCat subscription behind it): it is
 * seeded at signup as `subscription.status: 'trialing'` + `validUntil`, and can
 * expire silently without any webhook. Gates must therefore COMPUTE this at
 * read time — never materialize it into a flag.
 */
export function isBaseTrialActive(
  subscription: { status?: string | null; validUntil?: unknown } | null | undefined,
): boolean {
  if (!subscription || subscription.status !== 'trialing') return false;
  const until = toDate(subscription.validUntil);
  return !!until && until.getTime() > Date.now();
}

/**
 * Deposits (Sérénité) access gate — the ONE rule for whether a provider may
 * configure and collect deposits:
 *   - paid Sérénité add-on or admin comp (both materialized into
 *     `depositsAddonActive` by the webhook / admin route), OR
 *   - the free base trial is running (deposits are included in the trial so
 *     pros experience them before paying; access drops by itself when the
 *     trial ends since this is computed at read time).
 *
 * Collecting still ALWAYS requires an active Stripe Connect account on top —
 * that guardrail is checked separately and never bypassed.
 */
/**
 * Fidélité — gate d'accès : le pro peut configurer/servir la carte de
 * fidélité seulement si
 *   - un plan payant est en cours (`status: 'active'`), OU
 *   - une carte est enregistrée : abonnement réel (Stripe ou RevenueCat)
 *     encore en période d'essai — par opposition à l'essai gratuit LOCAL
 *     seedé à l'inscription, qui n'a aucun moyen de paiement derrière, OU
 *   - un accès offert (comp) est actif.
 *
 * Comme les autres gates : calculé à la lecture, jamais matérialisé.
 */
export function hasLoyaltyAccess(
  provider:
    | {
        accessOverride?: AccessOverride | null;
        subscription?: {
          status?: string | null;
          stripeSubscriptionId?: string | null;
          revenuecatAppUserId?: string | null;
        } | null;
      }
    | null
    | undefined,
): boolean {
  if (!provider) return false;
  if (isAccessOverrideActive(provider.accessOverride)) return true;
  const sub = provider.subscription;
  if (!sub) return false;
  if (sub.status === 'active') return true;
  return sub.status === 'trialing' && !!(sub.stripeSubscriptionId || sub.revenuecatAppUserId);
}

export function hasDepositAccess(provider: EntitlementsInput | null | undefined): boolean {
  // Délègue au calcul central : le comp Sérénité est lu depuis l'override
  // lui-même, plus depuis le flag `depositsAddonActive` que l'octroi
  // matérialisait — c'est ce qui faisait survivre l'acompte à l'expiration.
  return computeEntitlements(provider).canUseDeposits;
}

// ─────────────────────────────────────────────────────────────────────────────
// Droits effectifs — LE calcul central
// ─────────────────────────────────────────────────────────────────────────────

/** Ce que `computeEntitlements` lit sur un provider. Structurel : accepte le
 *  document Firestore brut comme l'objet typé. */
export interface EntitlementsInput {
  accessOverride?: AccessOverride | null;
  subscription?: {
    status?: string | null;
    plan?: string | null;
    validUntil?: unknown;
    stripeSubscriptionId?: string | null;
    revenuecatAppUserId?: string | null;
  } | null;
  serenity?: { status?: string | null } | null;
  depositsAddonActive?: boolean | null;
}

export interface Entitlements {
  /** D'où vient le droit principal. Étiquette d'affichage : les droits
   *  eux-mêmes sont l'UNION des trois sources, pas la première qui matche. */
  source: 'paid' | 'trial' | 'comp' | 'none';
  /** Tier de fonctionnalités. L'essai gratuit donne l'accès complet ('team'),
   *  comme partout dans l'app. JAMAIS lu depuis `provider.plan` : c'est
   *  précisément la mutation durable qu'on supprime. */
  effectivePlan: 'solo' | 'team' | null;
  canAccessPro: boolean;
  canPublish: boolean;
  canReceiveBookings: boolean;
  canUseDeposits: boolean;
  canUseLoyalty: boolean;
  compActive: boolean;
  compExpiresAt: Date | null;
  /** Un abonnement réel facture encore derrière : la révocation d'un comp ne
   *  doit jamais dégrader ce droit-là. `past_due` compte — Stripe réessaie. */
  paidUnderneath: boolean;
}

/** 'team' > 'solo'. `trial`/`test` donnent l'accès complet. */
function planTier(plan: string | null | undefined): 'solo' | 'team' | null {
  if (plan === 'team' || plan === 'trial' || plan === 'test') return 'team';
  if (plan === 'solo') return 'solo';
  return null;
}

/**
 * Le modèle de droits : facturation (Stripe/RevenueCat) = source de vérité,
 * essai local = droit temporaire calculé, comp admin = couche indépendante.
 * Tout est dérivé À LA LECTURE — aucune de ces réponses n'est matérialisée,
 * donc une expiration (comp ou essai) rend les droits sous-jacents sans
 * qu'aucun nettoyage ne soit nécessaire.
 */
export function computeEntitlements(
  provider: EntitlementsInput | null | undefined,
): Entitlements {
  const none: Entitlements = {
    source: 'none', effectivePlan: null,
    canAccessPro: false, canPublish: false, canReceiveBookings: false,
    canUseDeposits: false, canUseLoyalty: false,
    compActive: false, compExpiresAt: null, paidUnderneath: false,
  };
  if (!provider) return none;

  const sub = provider.subscription;
  const override = provider.accessOverride;

  const paidUnderneath =
    sub?.status === 'active' ||
    sub?.status === 'past_due' ||
    (sub?.status === 'trialing' &&
      !!(sub.stripeSubscriptionId || sub.revenuecatAppUserId));
  const trialActive = isBaseTrialActive(sub);
  const compActive = isAccessOverrideActive(override);

  const hasAccess = paidUnderneath || trialActive || compActive;

  // Union des tiers : un comp 'solo' posé sur un abonnement 'team' encore
  // payant ne rétrograde pas le payant — et inversement le comp 'team'
  // surclasse un payant 'solo' le temps du comp.
  const tiers: Array<'solo' | 'team' | null> = [
    paidUnderneath ? planTier(sub?.plan) : null,
    trialActive ? 'team' : null,
    compActive ? planTier(override?.plan) : null,
  ];
  const effectivePlan = tiers.includes('team') ? 'team' : tiers.includes('solo') ? 'solo' : null;

  const serenityPaid =
    provider.serenity?.status === 'active' || provider.serenity?.status === 'trialing';

  // `depositsAddonActive` est un flag matérialisé : fiable quand il vient du
  // webhook de paiement, suspect quand il est l'empreinte d'un ancien comp
  // (l'octroi l'écrivait autrefois). Un doc qui porte `override.serenity` sans
  // Sérénité payée ne compte donc que si le comp est ENCORE actif.
  const depositsFlagTrustworthy =
    provider.depositsAddonActive === true && override?.serenity !== true;

  const canUseDeposits =
    trialActive ||
    serenityPaid ||
    (compActive && override?.serenity === true) ||
    depositsFlagTrustworthy;

  return {
    source: paidUnderneath ? 'paid' : trialActive ? 'trial' : compActive ? 'comp' : 'none',
    effectivePlan: hasAccess ? effectivePlan : null,
    canAccessPro: hasAccess,
    canPublish: hasAccess,
    canReceiveBookings: hasAccess,
    canUseDeposits,
    canUseLoyalty: compActive || paidUnderneath,
    compActive,
    compExpiresAt: override?.until ? toDate(override.until) : null,
    paidUnderneath,
  };
}

/**
 * Tier d'interface (filtres membres, multi-lieux, onglets Studio…).
 * Remplace les douze `plan === 'team' || plan === 'trial'` dispersés : eux
 * lisaient `provider.plan`, que l'octroi d'un accès offert mutait pour
 * simuler le tier — c'est cette mutation qui disparaît.
 */
export function isTeamTier(provider: EntitlementsInput | null | undefined): boolean {
  return computeEntitlements(provider).effectivePlan === 'team';
}

/**
 * Un webhook ou un cron peut-il dépublier ce prestataire ?
 * NON si un accès offert est actif : la facturation reste la source de vérité
 * de l'état d'abonnement (le webhook met à jour `subscription.*`), mais elle
 * ne retire pas un droit que l'admin a accordé à côté. Partagée par les
 * webhooks Stripe ET RevenueCat pour qu'ils ne divergent plus.
 */
export function canSystemUnpublish(provider: EntitlementsInput | null | undefined): boolean {
  return !computeEntitlements(provider).compActive;
}

/**
 * Une fiche est PUBLIQUEMENT accessible si le prestataire veut la publier
 * (`isPublished` — son intention) ET que ses droits le permettent encore
 * (`canPublish` — calculé). L'intention seule ne suffit plus : les règles
 * Firestore laissent le prestataire écrire `isPublished`, donc un compte
 * expiré pouvait remettre sa fiche en ligne — réservation refusée par l'API,
 * mais page, prestations et présence dans la recherche restaient visibles.
 *
 * À appliquer sur TOUTES les surfaces publiques : pages /p/[slug], réservation,
 * embed, recherche, listes, sitemap.
 */
export function isPubliclyVisible(
  provider: (EntitlementsInput & { isPublished?: boolean | null }) | null | undefined,
): boolean {
  if (!provider?.isPublished) return false;
  return computeEntitlements(provider).canPublish;
}

/**
 * Filtre de liste publique : ne garde que les fiches dont les droits calculés
 * autorisent encore la publication. Les requêtes Firestore garantissent déjà
 * `isPublished == true` ; les droits, eux, ne sont pas requêtables — d'où ce
 * post-filtrage, partagé par toutes les méthodes de liste du repository.
 */
export function filterPubliclyEntitled<T extends EntitlementsInput>(rows: T[]): T[] {
  return rows.filter((p) => computeEntitlements(p).canPublish);
}

// ─────────────────────────────────────────────────────────────────────────────
// Langue des notifications
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationLocale = 'fr' | 'en' | 'it' | 'pt' | 'de';

const NOTIFICATION_LOCALES: readonly NotificationLocale[] = ['fr', 'en', 'it', 'pt', 'de'];

/**
 * Langue déduite du pays, utilisée tant que le prestataire n'a rien choisi.
 * Espagne et Pays-Bas retombent sur l'anglais : ni l'espagnol ni le
 * néerlandais ne font partie des cinq langues servies.
 *
 * MIROIR de `functions/src/lib/providerPushI18n.ts` — `functions` ne peut pas
 * importer `@booking-app/shared`. Toute évolution doit être reportée là-bas.
 */
const COUNTRY_NOTIFICATION_LOCALES: Record<string, NotificationLocale> = {
  FR: 'fr', BE: 'fr', LU: 'fr', CH: 'fr',
  DE: 'de', IT: 'it', PT: 'pt',
  ES: 'en', NL: 'en',
};

/**
 * La langue dans laquelle le prestataire reçoit ses notifications.
 *
 * C'est un RÉGLAGE DE COMPTE, pas un reflet de l'appareil : synchroniser
 * automatiquement depuis l'application faisait basculer la préférence à
 * chaque ouverture — un téléphone en portugais puis un navigateur en
 * français se écrasaient mutuellement, et les notifications suivaient le
 * dernier appareil ouvert plutôt qu'une décision.
 *
 * Tant que rien n'est choisi, la déduction par pays sert de valeur initiale —
 * ce que le sélecteur affiche, pour que le prestataire voie l'état réel.
 */
export function notificationLocale(
  provider: { locale?: string | null; countryCode?: string | null } | null | undefined,
): NotificationLocale {
  const choisie = provider?.locale as NotificationLocale | undefined;
  if (choisie && NOTIFICATION_LOCALES.includes(choisie)) return choisie;
  return COUNTRY_NOTIFICATION_LOCALES[(provider?.countryCode ?? '').toUpperCase()] ?? 'fr';
}
