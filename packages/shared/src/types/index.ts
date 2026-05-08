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
  depositsAddonActive: boolean;                // gated by the +5€/mo Stripe subscription item
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

  createdAt: Date;
  updatedAt: Date;
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
  bookingId: string;
  clientId: string | null;  // null for anonymous reviews (from email link)
  clientEmail: string | null; // normalized email for dedup (one review per client per provider)
  memberId: string | null;
  clientName: string;
  clientPhoto: string | null;
  rating: number;
  comment: string | null;
  isPublic: boolean;
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
