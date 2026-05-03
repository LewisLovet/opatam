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

  /**
   * Per-service deposit override. When set, takes precedence over the
   * provider's `settings.depositDefault`. When null, fall back to the
   * default. When both are null, no deposit is required.
   *
   * - type: 'fixed'   → value is in cents, must be ≤ this service's price
   * - type: 'percent' → value is 1-100
   */
  deposit?: {
    type: 'fixed' | 'percent';
    value: number;
    refundDeadlineHours: number;  // 0 = never refund, default 24
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

// Blocked slot types
// Périodes bloquées (vacances, absences, etc.)
export interface BlockedSlot {
  memberId: string;          // Obligatoire - lié au membre
  locationId: string;        // Dénormalisé depuis member.locationId
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  startTime: string | null;  // Si allDay=false
  endTime: string | null;    // Si allDay=false
  reason: string | null;
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
