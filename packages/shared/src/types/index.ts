// Notification settings (shared by clients via User)
export interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  reminderNotifications: boolean;
  confirmationNotifications: boolean;
  cancellationNotifications: boolean;
  rescheduleNotifications: boolean;
}

// Notification preferences (for providers via ProviderSettings)
export interface ProviderNotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  newBookingNotifications: boolean;
  confirmationNotifications: boolean;
  cancellationNotifications: boolean;
  reminderNotifications: boolean;
  /**
   * Push for the in-app notification center events (announcements, import
   * reports, etc.) — independent from `pushEnabled` (which governs
   * booking/review pushes). Undefined = enabled (backward-compatible).
   */
  centerPushEnabled?: boolean;
}

// User types
export interface User {
  email: string;
  displayName: string;
  phone: string | null;
  photoURL: string | null;
  /**
   * Exclusive role per email. One user can only be one of:
   *  - 'client'    : books appointments at providers
   *  - 'provider'  : manages a salon / service business
   *  - 'affiliate' : only promotes Opatam via a referral code (no booking,
   *                  no salon). Transitional state — the user can later
   *                  upgrade to 'client' or 'provider' by registering, at
   *                  which point their affiliateId is preserved.
   *
   * The affiliate dimension is orthogonal to client/provider: any role can
   * ALSO have an affiliateId (a provider who promotes Opatam, for instance).
   */
  role: 'client' | 'provider' | 'affiliate';
  providerId: string | null;
  city: string | null;
  birthYear: number | null;
  gender: 'male' | 'female' | 'other' | null;
  cancellationCount: number;
  pushTokens: string[]; // Expo push tokens for notifications (device-specific)
  notificationSettings?: NotificationSettings;
  affiliateId: string | null; // Lien vers doc affiliates (si cet user est affilié)
  isAdmin?: boolean; // Admin dashboard access (only set for platform admins)
  isDisabled?: boolean; // Disabled by admin
  createdAt: Date;
  updatedAt: Date;
}

// Provider types
export type ProviderPlan = 'trial' | 'solo' | 'team' | 'test';

export interface Provider {
  userId: string;
  plan: ProviderPlan;
  businessName: string;
  description: string;
  category: string;
  slug: string;
  photoURL: string | null;
  coverPhotoURL: string | null;
  portfolioPhotos: string[];
  socialLinks: SocialLinks;
  rating: Rating;
  settings: ProviderSettings;
  subscription: Subscription;
  isPublished: boolean;
  isVerified: boolean;
  // Denormalized fields for search optimization
  cities: string[];              // Normalized cities from active locations
  region: string | null;         // Region from primary location (e.g., "Île-de-France")
  countryCode: string;           // ISO 3166-1 alpha-2 from default location (e.g., 'FR')
  minPrice: number | null;       // Minimum price from active services (in centimes)
  searchTokens: string[];        // Normalized words from businessName for search (e.g., ["salon", "hugo"])
  geopoint: { latitude: number; longitude: number } | null; // From default location, for proximity search
  // Availability cache (computed by Cloud Functions)
  nextAvailableSlot: Date | null; // Next available booking slot (null if none or not computed)
  // Affiliation
  affiliateCode: string | null;  // Code parrain utilisé à l'inscription
  affiliateId: string | null;    // ID du doc affilié

  // Stripe Connect (acomptes add-on) — nullable until the pro starts onboarding.
  // Fields are mirrored from Stripe via the account.updated webhook.
  stripeConnectAccountId: string | null;       // 'acct_...'
  stripeConnectStatus: 'pending' | 'active' | 'restricted' | null;
  stripeConnectChargesEnabled: boolean;        // can charge cards on the account
  stripeConnectPayoutsEnabled: boolean;        // can transfer funds to the bank account
  /**
   * Cached "Sérénité add-on is in effect" flag. Single source of
   * truth read by the booking flow and the UI. Synchronised by
   * the Stripe webhook from `serenity.status`:
   *   - true while serenity.status === 'active' || 'trialing'
   *   - flips to false on customer.subscription.deleted (period
   *     end after a user-triggered cancel-at-period-end)
   * Kept as a top-level boolean for O(1) reads in security rules
   * and per-booking checks.
   */
  depositsAddonActive: boolean;
  /**
   * Dedicated Sérénité (acomptes add-on) subscription state.
   *
   * Decoupled from `subscription.*` since v1.5: the base Pro plan
   * can be billed through Stripe / Apple / Google, but the
   * Sérénité add-on is ALWAYS a separate Stripe sub. That way an
   * Apple-billed pro can also subscribe to Sérénité — the two
   * billing channels never touch the same Firestore field.
   *
   * `null` when the pro has never activated Sérénité (default
   * state). Once activated, this object lives forever — even
   * after a cancellation — so the UI can show "résiliation
   * prévue le X" until the period ends.
   */
  serenity?: SerenitySubscription | null;
  // Analytics (pageViews.today incremented in real-time, rest updated nightly)
  stats?: {
    pageViews: PageViewStats;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Page view stats (denormalized on Provider, updated nightly by Cloud Function)
export interface PageViewStats {
  today: number;         // Incremented in real-time, reset nightly
  total: number;         // Accumulated total, updated nightly
  last7Days: number;     // Recalculated nightly from daily docs
  last30Days: number;    // Recalculated nightly from daily docs
}

// Daily page view document (pageViewsDaily collection)
export interface PageViewDaily {
  providerId: string;
  date: string;          // YYYY-MM-DD format
  count: number;         // Total views for that day
}

/**
 * Monthly page view document (pageViewsMonthly collection).
 *
 * Why a separate collection: pageViewsDaily has a 90-day retention
 * (the nightly aggregatePageViews cron deletes older docs), so it
 * cannot serve a 12-month evolution chart on its own. The monthly
 * collection is rolled up from dailies BEFORE they're purged and
 * is kept indefinitely. Same shape as PageViewDaily but the key
 * is YYYY-MM rather than YYYY-MM-DD.
 *
 * Doc id format: `{providerId}_{YYYY-MM}` — composite, queryable
 * via the `(providerId, month)` index.
 */
export interface PageViewMonthly {
  providerId: string;
  month: string;         // YYYY-MM format
  count: number;         // Total views for that month
  updatedAt: Date;
}

// ─── Provider business stats (3-tier aggregation) ───────────────────
// See `lib/providerStats.ts` for the aggregation logic shared by the
// backfill script, the bookings write-trigger, and the nightly cron.
//
// Storage layout:
//   providerStatsDaily/{providerId}_{YYYY-MM-DD}    — live, trigger-updated
//   providerStatsMonthly/{providerId}_{YYYY-MM}     — rolled up nightly
//   providerStatsRolling/{providerId}               — top-K snapshots
//
// Why three tiers: see the design doc that prompted this work — daily
// supports the live "today" KPIs, monthly powers the 12-month trend
// at fixed cost (12 reads), and rolling stores top-K results that
// would otherwise need to scan many daily docs at read time.

/**
 * Per-service breakdown stored inside a Daily/Monthly aggregate doc.
 * Service name is denormalized from `services/{id}` at booking
 * creation time (already on the Booking) so we don't need a join
 * when rendering the "top services" panel.
 */
export interface ProviderStatsServiceBreakdown {
  serviceId: string;
  serviceName: string;
  /** Number of bookings (any status — see counts below for filters). */
  bookingsCount: number;
  /** Confirmed bookings only — the revenue-contributing ones. */
  confirmedCount: number;
  /** Sum of `price` for confirmed bookings (in cents). */
  revenue: number;
}

/**
 * Per-member breakdown — only meaningful when the provider is on a
 * team plan and has multiple members. `memberId === null` is grouped
 * under a synthetic "self" entry (the provider themselves).
 */
export interface ProviderStatsMemberBreakdown {
  memberId: string | null;
  memberName: string;
  bookingsCount: number;
  confirmedCount: number;
  revenue: number;
}

/**
 * Per-category breakdown of paid activity revenue (sport, meeting,
 * perso, admin, voyage, imprévu, other). Mirrors
 * ProviderStatsServiceBreakdown but for the "Autres revenus" track —
 * money the pro earns off-platform (workshops, paid consultations,
 * etc.) tagged via the activity category field on a BlockedSlot.
 */
export interface ProviderStatsActivityBreakdown {
  category: ActivityCategory;
  /** Number of paid activities in this category on the day/month. */
  count: number;
  /** Sum of `amount` (cents) for paid activities in this category. */
  revenue: number;
}

/**
 * Daily aggregate — one document per (provider, calendar day). The
 * `date` field is the booking's `datetime.toISOString().slice(0,10)`
 * in the provider's timezone. NB: revenue here is the SUM of all
 * `confirmed` bookings on that calendar day, regardless of hour.
 * The "confirmed AND datetime in the past" rule is applied at READ
 * time — the daily for "today" includes future hours and the UI
 * filters them out by querying live bookings for today only.
 */
export interface ProviderStatsDaily {
  providerId: string;
  date: string;                     // YYYY-MM-DD

  /** Total bookings written for this day (all statuses). */
  bookingsCount: number;
  /** Status breakdown — sums to bookingsCount. */
  confirmedCount: number;
  pendingCount: number;
  pendingPaymentCount: number;
  cancelledCount: number;
  noshowCount: number;

  /** Revenue (cents) — sum of `price` over confirmed bookings on this day. */
  revenue: number;

  /**
   * "Autres revenus" — sum of `amount` (cents) over paid activities
   * (BlockedSlot with `category` set AND `amount > 0`) on this day.
   * Tracked separately from the booking `revenue` field so the UI
   * can show the two streams side by side without inflating the
   * core booking KPI. Defaults to 0 — backward-compatible with old
   * daily docs that pre-date this field.
   */
  activityRevenue: number;
  /** Number of paid activities on this day. */
  activityCount: number;
  /** Per-category breakdown of activity revenue. */
  activitiesByCategory: ProviderStatsActivityBreakdown[];

  /**
   * Distinct client identities. Hashed (sha256 hex) for privacy so
   * the aggregate doc carries no raw PII. Used to compute the
   * `uniqueClients` count for any time window by unioning across
   * daily docs at read time.
   */
  clientHashes: string[];
  /** Subset of `clientHashes` whose first booking ever falls on this day. */
  newClientHashes: string[];

  /** Per-service breakdown for "top services" panels. */
  services: ProviderStatsServiceBreakdown[];
  /** Per-member breakdown for team-plan dashboards. */
  members: ProviderStatsMemberBreakdown[];

  /** Hour-of-day distribution (0-23) of bookings — feeds the heatmap. */
  hourCounts: number[];             // length 24

  updatedAt: Date;
}

/**
 * Monthly aggregate — derived nightly from the daily docs of the
 * month. Same schema as Daily but `date` is YYYY-MM. Used to power
 * 12-month trend charts at fixed cost (12 reads).
 */
export interface ProviderStatsMonthly {
  providerId: string;
  month: string;                    // YYYY-MM

  bookingsCount: number;
  confirmedCount: number;
  pendingCount: number;
  pendingPaymentCount: number;
  cancelledCount: number;
  noshowCount: number;

  revenue: number;

  /** Paid-activity revenue track — mirror of the daily fields,
   *  rolled up across the calendar month. See ProviderStatsDaily
   *  for full semantics. */
  activityRevenue: number;
  activityCount: number;
  activitiesByCategory: ProviderStatsActivityBreakdown[];

  clientHashes: string[];
  newClientHashes: string[];

  services: ProviderStatsServiceBreakdown[];
  members: ProviderStatsMemberBreakdown[];
  hourCounts: number[];

  updatedAt: Date;
}

/**
 * Rolling snapshots — recomputed nightly. Stores the expensive top-K
 * rankings (services, clients) and pre-computed time windows so
 * panels render with a single read regardless of history depth.
 */
export interface ProviderStatsRolling {
  providerId: string;

  /** Top services by revenue, computed for several time windows. */
  topServices30d: ProviderStatsServiceBreakdown[];
  topServices90d: ProviderStatsServiceBreakdown[];
  topServicesAllTime: ProviderStatsServiceBreakdown[];

  /**
   * Top clients by lifetime revenue. Stored as hashes here to keep
   * the agg doc PII-free; the UI resolves names by querying recent
   * `bookings` for each hash on demand (max 10 client lookups).
   */
  topClients30d: { clientHash: string; bookingsCount: number; revenue: number }[];
  topClients90d: { clientHash: string; bookingsCount: number; revenue: number }[];
  topClientsAllTime: { clientHash: string; bookingsCount: number; revenue: number }[];

  /**
   * Day-of-week × hour-of-day heatmap over the last 90 days.
   * Stored flat (length 168) because Firestore doesn't allow
   * nested arrays. Read as `heatmap90d[dow * 24 + hour]` —
   * dow is 0=Sunday … 6=Saturday.
   */
  heatmap90d: number[];

  updatedAt: Date;
}

// ─── Provider clients (CRM-lite, populated by the same trigger) ─────
//
// One document per (provider, distinct client identity) — populated
// by the same booking write trigger that maintains providerStats*.
// Stored at `providerClients/{providerId}_{clientKey}` where
// clientKey is what `getClientKey()` returns (email-prefixed, or
// id-prefixed for registered users).
//
// Used by /pro/clients and (later) by the campaigns segment builder.

/**
 * Behaviour tags computed nightly from the aggregated stats. Tags
 * are NOT mutually exclusive — a client can be `vip + at_risk`,
 * which is exactly the segment to target with a re-activation
 * campaign. Recomputed in the cron from the denormalised counters
 * so we don't need to scan bookings.
 */
export type ProviderClientTag =
  | 'new'             // firstBookingAt within last 30 days
  | 'regular'         // ≥3 confirmed AND lastBookingAt within last 90 days
  | 'vip'             // ≥10 confirmed OR lifetime revenue ≥ 500€
  | 'at_risk'         // last booking 60-180 days ago
  | 'lost'            // last booking > 180 days ago
  | 'noshow_prone';   // ≥3 bookings AND noshow rate > 20%

export interface ProviderClient {
  providerId: string;
  /** `email:foo@bar.com` for anonymous bookers, `id:<userId>` for registered. */
  clientKey: string;

  // ── Identity (denormalised from the latest booking) ──────────
  email: string | null;
  phone: string | null;
  name: string;
  /** Set when the booker is a registered Opatam user. */
  clientId: string | null;
  /** From `User.photoURL` if registered, else null. */
  photoURL: string | null;

  // ── Counters (kept fresh by the booking trigger) ─────────────
  bookingsCount: number;
  confirmedCount: number;
  cancelledCount: number;
  noshowCount: number;
  /** Sum of `price` over confirmed bookings (cents). */
  totalRevenue: number;

  firstBookingAt: Date;
  lastBookingAt: Date;

  // ── Tags (recomputed nightly by the cron) ────────────────────
  tags: ProviderClientTag[];

  // ── Provider-editable fields (UI on /pro/clients) ────────────
  /** Free-form notes the provider keeps on this client. */
  notes: string | null;
  /** Arbitrary key/value preferences (e.g. "preferred_member": "alex"). */
  preferences: Record<string, string> | null;

  // ── Marketing consent (RGPD) ─────────────────────────────────
  /**
   * True when the most recent booking from this client had
   * `clientInfo.marketingOptIn === true`. The trigger updates this
   * on every booking write so a client can opt out by simply
   * unchecking the box on a future booking. Server-side opt-out
   * actions also stamp `marketingOptOutAt` for audit.
   */
  marketingOptIn: boolean;
  marketingOptInAt: Date | null;
  marketingOptOutAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface SocialLinks {
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  website: string | null;
  paypal: string | null;
}

export interface Rating {
  average: number;
  count: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface ProviderSettings {
  reminderTimes: number[];
  requiresConfirmation: boolean;
  defaultBufferTime: number;
  timezone: string;
  // Reservation policy settings
  minBookingNotice: number;          // Minimum hours before appointment (default: 2)
  maxBookingAdvance: number;         // Maximum days in advance (default: 60)
  allowClientCancellation: boolean;  // Allow clients to cancel (default: true)
  cancellationDeadline: number;      // Hours before appointment for cancellation (default: 24)
  slotInterval?: number;             // Minutes between each bookable slot (default: 15)
  notificationPreferences?: ProviderNotificationPreferences;
  bookingNotice?: string | null;     // Texte libre affiche avant confirmation de reservation
  autoReviewReminder?: boolean;      // Envoyer automatiquement une demande d'avis apres chaque RDV (default: true)

  /**
   * Default deposit applied to every service unless the service has its own
   * `deposit` field set (which overrides this). Always a percentage of the
   * service price — that way it scales naturally across services with
   * different prices and we never end up with deposit > price.
   *
   * Null when the pro hasn't configured a default (or hasn't activated
   * the deposits add-on at all).
   */
  depositDefault?: {
    percent: number;             // 1-100
    refundDeadlineHours: number; // hours before booking — 0 = never refund, default 24
  } | null;
}

/** Resolved deposit amount + refund policy for a specific (service, provider) pair. */
export interface ResolvedDeposit {
  amount: number;              // cents
  refundDeadlineHours: number;
  source: 'service' | 'default';
}

export type PaymentSource = 'stripe' | 'apple' | 'google' | null;

export interface Subscription {
  plan: ProviderPlan;
  tier: 'standard' | 'advanced';
  memberCount: number;
  validUntil: Date;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'incomplete';
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  // Payment source tracking (for cross-platform subscription management)
  paymentSource: PaymentSource;
  revenuecatAppUserId: string | null;
}

/**
 * Stripe subscription dedicated to the Sérénité add-on (acomptes).
 *
 * Always Stripe-billed regardless of the base Pro plan's
 * `paymentSource` (Apple-billed pros get a dedicated Stripe sub
 * just for this — that's the whole reason this object is split
 * from `Subscription`).
 *
 * Lifecycle:
 *  - activate    → creates a new Stripe sub with a single
 *                  Sérénité price item, populates this object,
 *                  flips `depositsAddonActive: true`
 *  - cancel      → sets `cancelAtPeriodEnd: true`, status stays
 *                  active, depositsAddonActive stays true. The
 *                  pro keeps access until `currentPeriodEnd`.
 *  - period end  → Stripe fires `customer.subscription.deleted`,
 *                  the webhook flips status to 'cancelled' AND
 *                  `depositsAddonActive: false`. This object
 *                  stays in place as a tombstone so the UI can
 *                  show "résiliation effective" history.
 *
 * The `stripeCustomerId` here may equal `subscription.stripeCustomerId`
 * when the base plan is also Stripe-billed (we reuse the same
 * Customer to keep one billing relationship). For Apple/Google-
 * billed bases, a NEW Stripe Customer is created on first
 * activate and lives in this field only.
 */
export interface SerenitySubscription {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'incomplete' | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

// Member types (Teams)
export interface Member {
  name: string;
  email: string;
  phone: string | null;
  photoURL: string | null;
  color: string | null;      // Hex color (#3B82F6), null = use default palette
  accessCode: string;
  locationId: string;        // UN seul lieu par membre
  isDefault: boolean;        // true = membre principal (créé auto à l'inscription)
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// Location types
export type LocationType = 'fixed' | 'mobile';

export interface Location {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  countryCode: string; // ISO 3166-1 alpha-2 (e.g., 'FR', 'BE', 'DE')
  geopoint: { latitude: number; longitude: number } | null;
  description: string | null;
  type: LocationType;
  travelRadius: number | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Service Category types
export interface ServiceCategory {
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Service configuration (variations + options + info fields) ────
//
// A Service can optionally expose CHOICES that the client makes at
// booking time. These choices determine the final price and
// duration. Three kinds of choices, see acid test in /docs:
//
// 1. Variation  → REQUIRED choice that the client must make for the
//    prestation to make sense (ex: "Longueur" for hair braids).
//    Multiple variations sum up: total = base + Σ chosen prices.
//
// 2. Option     → OPTIONAL add-on the client can check (ex: "Mèches
//    incluses"). When checked, can expose its OWN nested variations
//    and info fields that only appear conditionally.
//
// 3. Info field → INFORMATIVE field with NO price / duration impact
//    (ex: "Couleur du vernis"). Just captured for the pro to read.
//
// All prices are ABSOLUTE (in cents) — no deltas, no base anchor
// tied to one variation. The client's final price is computed as:
//    basePrice (Service.price)
//  + Σ selected ServiceVariationOption.price
//  + Σ selected ServiceOption.price (top-level + nested)
// Same logic for duration. The basePrice is the "fee plancher" —
// 0 for services where variations carry all the cost.

/** One row inside a variation, e.g. "Mi-dos 70€" under "Longueur". */
export interface ServiceVariationOption {
  id: string;                       // stable uuid
  name: string;                     // "Mi-dos"
  description?: string | null;      // optional helper text shown to client
  price: number;                    // absolute, in cents, can be 0
  duration: number;                 // absolute, in minutes, can be 0
}

/** A group of mutually-exclusive choices (radio), e.g. "Longueur". */
export interface ServiceVariation {
  id: string;
  name: string;                     // "Longueur"
  description?: string | null;      // optional group-level helper text
  options: ServiceVariationOption[]; // at least one option to be usable
}

/** A question with no price impact. `select` shows a list of choices,
 *  `text` a free input, `boolean` a simple Oui / Non. */
export interface ServiceInfoField {
  id: string;
  name: string;                     // "Couleur des mèches"
  description?: string | null;
  type: 'select' | 'text' | 'boolean';
  values?: string[];                // required when type='select'
  required: boolean;
}

/** A top-level add-on (checkbox). When checked, contributes its
 *  own price / duration AND can expose nested variations + info
 *  fields that are only visible while the option is checked. */
export interface ServiceOption {
  id: string;
  name: string;                     // "Mèches incluses"
  description?: string | null;
  price: number;                    // absolute, in cents, added when checked
  duration: number;                 // absolute, in minutes, added when checked
  nestedVariations: ServiceVariation[]; // only visible if this option is checked
  nestedInfoFields: ServiceInfoField[]; // only visible if this option is checked
}

// Service types
export interface Service {
  name: string;
  description: string | null;
  photoURL: string | null;  // URL d'une photo du portfolio provider
  duration: number;
  price: number;
  priceMax: number | null;  // prix max en centimes (null = prix fixe, sinon fourchette price → priceMax)
  bufferTime: number;
  categoryId: string | null;
  locationIds: string[];
  memberIds: string[] | null;
  isActive: boolean;
  sortOrder: number;
  /** Hex color (#RRGGBB) used to tint this service's bookings on the
   *  calendar. When null, the booking falls back to the member's color.
   *  Lets the pro segment their agenda by service type at a glance. */
  color?: string | null;

  /** Optional client-facing choices that determine the final price /
   *  duration at booking time. All three fields are OPTIONAL — a
   *  Service without them behaves exactly as before (flat price +
   *  duration), backward-compatible with every existing prestation
   *  in Firestore. See the doc block above for semantics. */
  variations?: ServiceVariation[];
  options?: ServiceOption[];
  infoFields?: ServiceInfoField[];

  /**
   * Per-service deposit configuration. Three states:
   *
   * - `null` (or undefined) → INHERIT from `provider.settings.depositDefault`.
   *   If the provider has no default either, no deposit is required.
   *
   * - `{ type: 'fixed' | 'percent', ... }` → CUSTOM override on this service.
   *   Takes precedence over the provider default.
   *     - 'fixed':   value in cents, must be ≤ the service's price
   *     - 'percent': value 1-100
   *
   * - `{ type: 'none' }` → EXPLICITLY DISABLED on this service.
   *   Prevents the provider default from applying. Use this when a
   *   prestation should never collect a deposit even though the
   *   provider has a default for everything else.
   */
  deposit?: {
    type: 'fixed' | 'percent' | 'none';
    value?: number;                  // unused when type === 'none'
    refundDeadlineHours?: number;    // unused when type === 'none'
  } | null;

  createdAt: Date;
  updatedAt: Date;
}

// Availability types
// Disponibilités centrées sur le membre (1 membre = 1 lieu = 1 agenda)
export interface Availability {
  memberId: string;          // Obligatoire - clé principale
  locationId: string;        // Dénormalisé depuis member.locationId pour perf
  dayOfWeek: number;         // 0=Dim, 1=Lun, 2=Mar, 3=Mer, 4=Jeu, 5=Ven, 6=Sam
  slots: TimeSlot[];
  isOpen: boolean;
  effectiveFrom: Date | null; // Date d'effet pour changements planifiés (null = immédiat)
  updatedAt: Date;
}

// Conflict detection for scheduled availability changes
export interface AvailabilityConflict {
  bookingId: string;
  bookingDate: Date;
  clientName: string;
  serviceName: string;
  conflictType: 'reduced_hours' | 'day_closed';
}

export interface TimeSlot {
  start: string;
  end: string;
}

// Blocked slot / activity types
//
// A `BlockedSlot` covers two UX flavors backed by the same underlying
// document — the only thing that distinguishes them is whether
// `category` is set:
//
//   - category === null → "période bloquée" (vacation, absence, training)
//                         displayed as a grey diagonal zone on the calendar.
//   - category !== null → "activité" (sport, meeting, perso, …) part of
//                         the pro's life-planner. Displayed with the
//                         category color + the optional `title`.
//
// Both flavors block client bookings via schedulingService — there's
// no special-casing in the slot-availability pipeline.
export type ActivityCategory =
  /**
   * Paid work performed off-platform (one-off service for a
   * client paid in cash, side gig, freelance booking taken
   * outside Opatam, etc.). The most useful default for the
   * "Autres revenus" track — appears first in pickers because
   * it's the typical reason a pro logs an activity with an amount.
   */
  | 'prestation'
  | 'sport'
  | 'meeting'
  | 'personal'
  | 'admin'
  | 'travel'
  | 'imprevu'
  | 'other';

export interface BlockedSlot {
  memberId: string;          // Obligatoire - lié au membre
  locationId: string;        // Dénormalisé depuis member.locationId
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  startTime: string | null;  // Si allDay=false
  endTime: string | null;    // Si allDay=false
  reason: string | null;
  /** When set, this entry is treated as a personal activity instead of
   *  a generic blocked period. Drives calendar styling and the
   *  "Activités" management screen. Absent or null for plain periods. */
  category?: ActivityCategory | null;
  /** Short label shown on the calendar tile when this is an activity
   *  (e.g. "Crossfit", "Déjeuner Sarah"). Absent or null for plain periods. */
  title?: string | null;
  /** Free-text address where the activity takes place (e.g. "Salle de
   *  sport, 12 rue X" or "Café Z"). Optional — distinct from the
   *  internal `locationId` which is always the member's home base. */
  address?: string | null;
  /** Amount earned for this activity, in cents. Optional — set
   *  only for paid activities (workshop, off-platform consultation,
   *  etc.). Currently displayed as a badge on the calendar; will
   *  be aggregated into the stats pipeline as "Autres revenus" in
   *  Phase 2. NOT counted in any ProviderClient revenue since
   *  activities aren't tied to a client. */
  amount?: number | null;
  createdAt: Date;
}

// Booking types
//   pending_payment → deposit required, awaiting Stripe Checkout completion.
//                     The slot is reserved for ~15 min then auto-purged if
//                     payment doesn't land. Booking flips to 'confirmed' when
//                     the checkout.session.completed webhook arrives.
//   pending         → confirmation by the pro is required (deposit optional)
//   confirmed       → fully confirmed
//   cancelled       → cancelled by client or pro
//   noshow          → marked as no-show after the appointment
export type BookingStatus =
  | 'pending_payment'
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'noshow';

export type BookingDepositStatus = 'pending' | 'paid' | 'refunded' | 'failed';

export interface BookingDeposit {
  amount: number;                 // cents — what the client paid (or owes)
  refundDeadlineHours: number;    // copied from service/default at booking time
  paymentIntentId: string | null; // 'pi_...' on the connected account
  /**
   * When set, the PaymentIntent lives on this connected account (Direct
   * charges flow — used by the web Stripe Checkout). When null, the PI
   * lives on the platform (Destination charges flow — used by the
   * mobile PaymentSheet, with `transfer_data` routing funds to the pro).
   * Determines which Stripe-Account header is used at refund time.
   */
  connectAccountId: string | null;
  checkoutSessionId: string | null; // 'cs_...' for the hosted checkout
  /** URL of the hosted Stripe Checkout. Stored so we can re-send it as
   *  a reminder if the client closes the tab mid-checkout. The URL is
   *  only valid until the session's expires_at (~30 min). */
  checkoutUrl: string | null;
  status: BookingDepositStatus;
  paidAt: Date | null;
  refundedAt: Date | null;
  /**
   * Stripe refund id (`re_...`) on the connected account. Stored after
   * a successful refund — useful for support/debugging and to make the
   * refund flow idempotent across webhook retries.
   */
  refundId: string | null;
  /**
   * Who triggered the refund:
   *   - 'client'   → cancel-by-token within the deadline window
   *   - 'provider' → pro-side cancel (in or out of deadline)
   *   - 'auto'     → reserved for future automation
   * null when no refund happened.
   */
  refundedBy: 'client' | 'provider' | 'auto' | null;
  /** Optional free-text reason supplied by the pro at force-refund time. */
  refundReason: string | null;
  /** Timestamp the "finish your payment" reminder email was sent. Used
   *  by the cron to avoid sending it twice. Null = never sent. */
  reminderSentAt: Date | null;
}

export interface Booking {
  providerId: string;
  clientId: string | null;
  memberId: string | null;
  providerName: string;
  providerPhoto: string | null;
  memberName: string | null;
  memberPhoto: string | null;
  memberColor: string | null;
  locationId: string;
  locationName: string;
  locationAddress: string;
  serviceId: string;
  serviceName: string;
  /** Denormalised from Service.color at booking creation so the
   *  calendar can tint the cell without an extra fetch. */
  serviceColor?: string | null;
  duration: number;
  price: number;
  priceMax: number | null;
  clientInfo: ClientInfo;
  datetime: Date;
  endDatetime: Date;
  status: BookingStatus;
  cancelledAt: Date | null;
  cancelledBy: 'client' | 'provider' | null;
  cancelReason: string | null;
  cancelToken: string | null;
  remindersSent: Date[];
  reviewRequestSentAt: Date | null;

  /**
   * Deposit info, present only when this booking required one. The
   * status flips paid/refunded based on Stripe webhooks. When null,
   * no deposit was required for this service.
   */
  deposit?: BookingDeposit | null;

  /**
   * Variation choices the client made when booking. Denormalised at
   * creation time so the booking detail reads the right labels even
   * if the pro renames or deletes a variation later. The booking's
   * `price` and `duration` already incorporate these — they're kept
   * here only for human display (recap on the booking, in the
   * confirmation email, etc.). Empty / undefined for legacy
   * bookings and for services without variations.
   */
  selectedVariations?: BookingSelectedVariation[];

  /**
   * Add-on options the client ticked. Each carries its own
   * denormalised nested choices (variations + info answers). Same
   * semantic as `selectedVariations` — for display only, the price
   * is already baked into `booking.price`.
   */
  selectedOptions?: BookingSelectedOption[];

  /**
   * Top-level info-field answers (questions with no price impact,
   * exposed directly on the service rather than nested under an
   * option). Keyed by infoField id → free-text or selected value.
   */
  selectedInfoValues?: Record<string, string>;

  /**
   * Labelled top-level info answers (question + answer), denormalised at
   * booking time so any surface can render them without the service. The
   * readable companion to `selectedInfoValues`. Absent on legacy docs.
   */
  selectedInfo?: BookingSelectedInfo[];

  /**
   * Multi-service appointments: the list of prestations booked back-to-back
   * in this single visit. When present (length ≥ 1), the top-level
   * `serviceId`/`serviceName`/`selected*` reflect the FIRST item and
   * `duration`/`price` are the AGGREGATE (sum) across all items — so
   * existing readers keep working. Absent for single-service bookings
   * (legacy + simple), which are equivalent to a one-item list.
   */
  items?: BookingServiceItem[];

  createdAt: Date;
  updatedAt: Date;
}

/** One info-field answer captured at booking time, WITH its question
 *  label denormalised — so every surface (calendar, réservations, emails,
 *  mobile) can render "Question : Réponse" without re-fetching the service.
 *  `selectedInfoValues` (id→value) is kept alongside for back-compat. */
export interface BookingSelectedInfo {
  fieldId: string;
  label: string;                    // the question, e.g. "Allergies ?"
  value: string;                    // the client's answer
}

/** One prestation inside a multi-service booking. Fully denormalised so
 *  the booking stays readable even if the service is later edited. */
export interface BookingServiceItem {
  serviceId: string;
  serviceName: string;
  serviceColor?: string | null;
  duration: number;                 // effective minutes for this prestation
  price: number;                    // effective price in cents
  selectedVariations: BookingSelectedVariation[];
  selectedOptions: BookingSelectedOption[];
  selectedInfoValues: Record<string, string>;
  /** Labelled info answers (question + answer). Absent on legacy docs. */
  selectedInfo?: BookingSelectedInfo[];
}

/** One variation choice captured at booking time. Fully denormalised
 *  — the booking remains readable even if the variation is later
 *  edited / deleted on the Service. */
export interface BookingSelectedVariation {
  variationId: string;
  variationName: string;            // "Longueur"
  optionId: string;
  optionName: string;               // "Mi-dos"
  price: number;                    // contribution to total, in cents
  duration: number;                 // contribution to total, in minutes
}

/** One add-on captured at booking time, with its nested choices. */
export interface BookingSelectedOption {
  optionId: string;
  optionName: string;               // "Mèches incluses"
  price: number;                    // option's own price
  duration: number;                 // option's own duration
  /** Variation choices made WITHIN this option (only relevant when
   *  the option exposes nested variations). */
  nestedVariations: BookingSelectedVariation[];
  /** Info answers made WITHIN this option, keyed by infoField id. */
  infoValues: Record<string, string>;
  /** Labelled version of `infoValues` (question + answer). Absent on
   *  legacy docs. */
  info?: BookingSelectedInfo[];
}

export interface ClientInfo {
  name: string;
  email: string;
  phone?: string;
  /**
   * Marketing opt-in: when `true`, the booker has explicitly
   * agreed that THIS provider may contact them with promotional
   * offers (per RGPD, consent must be tied to a named recipient,
   * not a generic platform-wide flag).
   *
   * Optional + backward-compatible: existing bookings without the
   * field are treated as `false`. The booking-form UI to actually
   * collect this consent ships separately — when present, this
   * value flows through the bookings → providerClients aggregation
   * pipeline and ends up on `ProviderClient.marketingOptIn`.
   */
  marketingOptIn?: boolean;
}

// Review types
export interface Review {
  providerId: string;
  /** null for imported reviews (no booking) — native reviews always have one. */
  bookingId: string | null;
  clientId: string | null;  // null for anonymous reviews (from email link)
  clientEmail: string | null; // normalized email for dedup (one review per client per provider)
  memberId: string | null;
  clientName: string;
  clientPhoto: string | null;
  rating: number;
  comment: string | null;
  isPublic: boolean;
  /**
   * Internal provenance. 'opatam' (or undefined) = native review created
   * through the app. For admin-imported reviews this holds the source
   * (e.g. 'planity', 'manuel'). NEVER shown publicly — the public page only
   * renders a neutral "Avis importé" badge driven by `imported`.
   */
  source?: string;
  /** true for admin-imported reviews. Drives the neutral public badge. */
  imported?: boolean;
  /**
   * Free-text prestation label carried over from the import (display-only).
   * Does NOT map to an Opatam service. null when absent.
   */
  serviceLabel?: string | null;
  /** External reference from the import source (CSV "N°"), used for dedup. */
  sourceRef?: string | null;
  createdAt: Date;
}

// Conversation types
export interface Conversation {
  providerId: string;
  clientId: string;
  providerName: string;
  providerPhoto: string | null;
  clientName: string;
  clientPhoto: string | null;
  lastMessage: LastMessage;
  unreadCount: {
    provider: number;
    client: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface LastMessage {
  text: string;
  senderId: string;
  sentAt: Date;
}

export interface Message {
  senderId: string;
  senderType: 'provider' | 'client';
  text: string;
  isRead: boolean;
  sentAt: Date;
}

// Affiliate types
export type DiscountDuration = 'once' | 'repeating_3' | 'repeating_12' | 'forever';

export interface Affiliate {
  userId: string | null;
  name: string;
  email: string;
  code: string;
  stripeAccountId: string;
  stripeAccountStatus: 'pending' | 'active' | 'restricted';
  commission: number;
  discount: number | null;
  discountDuration: DiscountDuration | null;
  stripeCouponId: string | null;
  stats: {
    totalReferrals: number;
    activeReferrals: number;
    trialReferrals: number;
    totalRevenue: number;
    totalCommission: number;
  };
  isActive: boolean;
  /**
   * Cron-driven onboarding reminder state for affiliates whose Stripe
   * Connect account is incomplete (status != 'active').
   *
   * - `onboardingResumeToken`: random secret put in the email link
   *   (`/affiliation/finalize?token=…`). Rotated each time we send
   *   a reminder so old links can't be replayed forever.
   * - `onboardingResumeTokenExpiresAt`: 7 days from issuance.
   * - `onboardingReminderLastSent`: throttle so we don't email the
   *   same affiliate more than once per ~14 days.
   */
  onboardingResumeToken?: string | null;
  onboardingResumeTokenExpiresAt?: Date | null;
  onboardingReminderLastSent?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ────────────────────────────────────────────────────────────
// Blog / Article types
// ────────────────────────────────────────────────────────────

/**
 * Categories are exclusive (one per article). "À la une" is NOT a category —
 * it's a separate boolean flag (`isFeatured`) so an article can be both
 * "Conseils" AND featured on the homepage.
 */
export type ArticleCategory = 'temoignages' | 'conseils' | 'tutoriels';

export const ARTICLE_CATEGORIES: ArticleCategory[] = ['temoignages', 'conseils', 'tutoriels'];

export const ARTICLE_CATEGORY_LABELS: Record<ArticleCategory, string> = {
  temoignages: 'Témoignages',
  conseils: 'Conseils',
  tutoriels: 'Tutoriels',
};

export type ArticleStatus = 'draft' | 'published';

export interface Article {
  // Routing + display
  slug: string;                  // 'comment-fideliser-vos-clients'
  title: string;
  excerpt: string;               // ~160 chars — also used as meta description fallback
  coverImageURL: string | null;  // hero image at top of article + social share fallback
  body: string;                  // Markdown content

  // Classification
  category: ArticleCategory;     // exclusive
  isFeatured: boolean;           // → "À la une" block on the homepage

  // Optional embedded video (YouTube only — we extract the ID at render)
  videoUrl: string | null;
  videoCoverURL: string | null;  // poster shown before user clicks play (fallback: YouTube maxres thumb)

  // Author — single text field, defaults to "Équipe Opatam"
  authorName: string;
  authorPhotoURL: string | null;

  // Lifecycle
  status: ArticleStatus;
  publishedAt: Date | null;      // set when status flips from draft → published

  // SEO overrides (optional — fall back to title / excerpt / coverImageURL when null)
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageURL: string | null;

  // Stats (incremented when the public article page is viewed, deduped per session)
  viewCount: number;

  // Standard timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ─── Landing galleries ────────────────────────────────────────────────
//
// Vertical landing pages (/nail-artist, future /coiffeur, /barbier, …)
// each get a visual "Vos créations" marquee fed from Firebase. Items
// live in Firestore so non-developers can manage them through the
// admin UI (/admin/galleries/[slug]) — no commit / no deploy needed.
//
// Storage model:
//   landingGalleries/{slug}    Firestore doc, one per vertical
//   ├─ items: LandingGalleryItem[]   ordered, max ~20
//   └─ updatedAt: Date
//
// Images themselves can come from anywhere — uploaded via the admin
// (then stored under `landing/galleries/{slug}/{uuid}.jpg` in Firebase
// Storage) OR pasted as external URLs (a previously-uploaded
// provider portfolio shot, for instance). We don't care about the
// origin, only that `src` is a reachable HTTPS URL.

export interface LandingGalleryItem {
  /** Stable identifier (uuid). Survives reordering / edits. */
  id: string;
  /** Full HTTPS URL of the image (Firebase Storage or external). */
  src: string;
  /** Alt text for accessibility AND SEO. */
  alt: string;
  /** Sort key (low to high). The admin reorders items by editing this. */
  order: number;
  /** When the item was added to the gallery. */
  uploadedAt?: Date;
  /** UID of the admin who added it (for audit). */
  uploadedBy?: string;
}

export interface LandingGallery {
  /** Slug of the vertical landing this gallery feeds, e.g. `nail-artist`. */
  slug: string;
  /** Ordered list of items (already sorted by `order` when read). */
  items: LandingGalleryItem[];
  /** Last write timestamp. */
  updatedAt: Date;
}

/**
 * Global runtime config for the MOBILE app, stored at Firestore `config/mobile`.
 * Read publicly by the app on launch; written only by admins (server-side).
 * Drives the "update required" / "maintenance" blocking gate.
 */
export interface MobileAppConfig {
  /** Installed native versions strictly BELOW this (semver) are blocked. */
  minSupportedVersion: string;
  /** Latest version available — shown on the gate / "update available". */
  latestVersion?: string;
  /**
   * Curated list of versions actually released (semver, newest first).
   * Feeds the admin dropdowns so the critical version fields are picked
   * from known builds instead of free-typed (avoids human error).
   */
  releasedVersions?: string[];
  /** Hard block for everyone regardless of version (emergency switch). */
  forceUpdate?: boolean;
  /** Maintenance mode — block everyone with a message. */
  maintenance?: boolean;
  /** Optional custom message shown on the block screen. */
  message?: string | null;
  /**
   * Structured "what's new" shown on the update screen, split into
   * new features and bug fixes. Rendered as a styled list client-side.
   */
  releaseNotes?: {
    features?: string[];
    fixes?: string[];
  } | null;
  /** Deep links to the stores (fallbacks used when absent). */
  iosStoreUrl?: string | null;
  androidStoreUrl?: string | null;
  updatedAt?: Date;
}

/**
 * In-app announcement / "what's new" item, authored from the admin
 * back-office and shown in the mobile notification center (the
 * clickable logo + right-side drawer + detail modal). Stored in the
 * top-level Firestore `appNotifications` collection.
 */
export type AppNotificationAudience =
  | 'pros'
  | 'clients'
  | 'all'
  | 'admins'
  | 'specific';

export type AppNotificationType = 'announcement' | 'feature' | 'tutorial';

export interface AppNotification {
  /** Short headline shown in the drawer row + push title. */
  title: string;
  /** One-line teaser shown under the title in the drawer + push body. */
  body: string;
  /** Longer rich text shown in the detail modal (falls back to body). */
  modalBody?: string | null;
  type: AppNotificationType;
  /** Who sees it. 'specific' targets a single user via targetUserId. */
  audience: AppNotificationAudience;
  /** Target user id when audience === 'specific' (= provider id). */
  targetUserId?: string | null;
  /** Human label for the target (business name) — admin display only. */
  targetLabel?: string | null;
  /** Optional Ionicons name shown on the row / modal header. */
  iconName?: string | null;
  /** Optional banner image shown in the detail modal. */
  imageUrl?: string | null;
  /**
   * Optional CTA. `ctaArticleSlug` deep-links to the in-app
   * Tutoriels & guides article (/(pro)/help/{slug}); `ctaLabel` is
   * the button text. When no slug, the modal shows info only.
   */
  ctaLabel?: string | null;
  ctaArticleSlug?: string | null;
  /** Thumbnail of the linked tutorial (video poster / cover) shown in
   *  the notification so users see the video without opening it. */
  ctaThumbUrl?: string | null;
  /** True when the linked tutorial has a video (renders a play badge). */
  ctaIsVideo?: boolean;
  /** Visibility switch — only published items reach the app. */
  isPublished: boolean;
  publishedAt?: Date | null;
  /**
   * Scheduled send time. When set on a NOT-yet-published notification, the
   * `publishScheduledNotifications` cron flips `isPublished: true` once
   * `scheduledAt <= now` (which then triggers the push, if `sendPush`).
   * Null/undefined = immediate publication (no scheduling).
   */
  scheduledAt?: Date | null;
  /** Whether a system push was requested for this item. */
  sendPush?: boolean;
  /** Set by the Cloud Function once the push has been dispatched
   *  (idempotency guard so re-publishing doesn't re-notify). */
  pushedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Per-user read receipt for an AppNotification.
 *  Stored at `users/{uid}/notificationReads/{notificationId}`. */
export interface NotificationRead {
  readAt: Date;
}
