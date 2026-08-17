import type { User, Provider, Booking, Review, Service, Member, Location, Subscription, BookingStatus } from '@booking-app/shared';

// ── Dashboard Stats ──

export interface DashboardStats {
  totalUsers: number;
  totalClients: number;
  totalProviders: number;
  newSignupsToday: number;
  newSignupsWeek: number;
  newSignupsMonth: number;
  activeProviders: number;
  totalBookings: number;
  bookingsToday: number;
  bookingsWeek: number;
  bookingsMonth: number;
  /** Global provider page views (test providers excluded). */
  pageViewsToday: number;
  pageViews7Days: number;
  pageViews30Days: number;
  pageViewsTotal: number;
  /** Net recurring revenue (cents/month), all products, after discounts. */
  mrr: number;
  /** Real cash collected this month (sum of paid Stripe invoices, cents). */
  collectedThisMonth: number;
  cancellationRate: number;
  noshowRate: number;
  averageRating: number;
  trialConversionRate: number;
}

export interface TrendData {
  date: string;
  count: number;
}

export interface CategoryData {
  category: string;
  label: string;
  count: number;
}

// ── Filters ──

export interface UserFilters {
  search?: string;
  role?: 'client' | 'provider' | 'affiliate' | 'all';
  dateFrom?: string;
  dateTo?: string;
  city?: string;
}

export interface ProviderFilters {
  search?: string;
  plan?: string;
  isPublished?: 'true' | 'false' | 'all';
  isVerified?: 'true' | 'false' | 'all';
  category?: string;
}

// ── Paginated Result ──

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ── Detail Views ──

export type WithId<T> = { id: string } & T;

export interface UserDetail {
  user: WithId<User>;
  bookingsCount: number;
  recentBookings: WithId<Booking>[];
}

// ── Phase 2 Filters ──

export interface BookingFilters {
  search?: string;
  status?: BookingStatus | 'all';
  providerId?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Which date the Du/Au range applies to: the appointment date (`datetime`,
   *  default) or when the booking was made (`createdAt`). */
  dateField?: 'datetime' | 'createdAt';
}

export interface ReviewFilters {
  search?: string;
  minRating?: number;
  maxRating?: number;
  isPublic?: 'true' | 'false' | 'all';
  imported?: 'true' | 'all';
  providerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ── Phase 2 Detail Views ──

export interface BookingDetail {
  booking: WithId<Booking> & { providerName?: string; clientName?: string };
  provider: { id: string; businessName: string; photoURL?: string } | null;
  client: { id: string; displayName: string; email: string; photoURL?: string } | null;
}

export interface ReviewItem {
  id: string;
  providerId: string;
  providerName?: string;
  clientId: string | null;
  clientName: string;
  clientPhoto?: string;
  rating: number;
  comment: string | null;
  isPublic: boolean;
  createdAt: string | null;
}

// ── Revenue ──

export interface RevenueStats {
  /** Net MRR (cents/month), all products combined. */
  mrr: number;
  /** Net MRR from the core plans (Pro + Studio). */
  mrrPlans: number;
  /** Net MRR from the Sérénité (deposits) add-on. */
  mrrSerenity: number;
  /** Real cash collected (paid invoices), cents — the source of truth. */
  collectedThisMonth: number;
  collectedLast30d: number;
  collectedAllTime: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  cancelledThisMonth: number;
  subscriptionsByPlan: { plan: string; count: number; mrr: number }[];
  recentPayments: StripePayment[];
}

export interface StripePayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  customerEmail: string | null;
  providerName: string | null;
  description: string | null;
  created: string;
}

// ── Phase 3: Analytics ──

export interface AnalyticsData {
  topCities: { city: string; providers: number; bookings: number }[];
  topProviders: { id: string; businessName: string; photoURL?: string; category: string; bookings: number; rating: number; ratingCount: number }[];
  signupsByMonth: { month: string; clients: number; providers: number }[];
  peakHours: { hour: number; count: number }[];
  categoryBreakdown: { category: string; label: string; providers: number; bookings: number }[];
}

export interface ActivityEvent {
  id: string;
  type: 'new_provider' | 'new_booking' | 'cancelled_booking' | 'new_review' | 'new_user';
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

// ── Recent Signups ──

export interface RecentSignup {
  id: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt: string | null;
}

export interface RecentProvider {
  id: string;
  businessName: string;
  category: string;
  photoURL: string | null;
  plan: string;
  city: string | null;
  createdAt: string | null;
}

export interface RecentBookingRow {
  id: string;
  clientName: string;
  providerName: string;
  providerId: string | null;
  serviceName: string;
  price: number;
  status: string;
  datetime: string | null;
  createdAt: string | null;
}

export interface RecentSignups {
  providers: RecentProvider[];
  clients: RecentSignup[];
  bookings: RecentBookingRow[];
}

// ── Provider Detail ──

export interface ProviderDetail {
  provider: WithId<Provider>;
  user: WithId<User>;
  services: WithId<Service>[];
  members: WithId<Member>[];
  locations: WithId<Location>[];
  bookingStats: {
    total: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    noshow: number;
  };
  recentBookings: {
    id: string;
    clientName: string;
    clientEmail: string | null;
    clientPhone?: string | null;
    serviceName: string;
    memberName: string | null;
    status: string;
    datetime: string | null;
    createdAt: string | null;
    price: number;
  }[];
}

/**
 * Économie Stripe complète — recettes ET coûts.
 *
 * Distinct de `RevenueStats`, qui ne montre que ce qui entre. Les frais
 * Connect n'apparaissent sur aucune facture client : ils ne se lisent que
 * dans les transactions de solde, d'où ce second jeu de données.
 *
 * Tous les montants sont en CENTIMES, comme partout ailleurs.
 */
/**
 * Une ligne du relevé Stripe, conservée telle quelle.
 *
 * C'est la brique de traçabilité : tout total affiché doit pouvoir être
 * rouvert jusqu'aux transactions qui le composent, sinon un chiffre qui
 * surprend reste invérifiable.
 */
export interface StripeTx {
  id: string;
  /** ISO. */
  created: string;
  /** Type technique Stripe (charge, transfer, stripe_fee…). */
  type: string;
  /**
   * Poste comptable tel qu'on veut le lire. Le type Stripe ne dit pas si
   * l'argent nous appartient : un `transfer` est de l'argent qui transite,
   * un `charge` peut être un revenu ou un acompte selon sa description.
   */
  category:
    | 'revenu' | 'acompte' | 'frais-connect' | 'frais-billing'
    | 'remboursement' | 'reversement' | 'virement' | 'reserve' | 'autre';
  description: string | null;
  amount: number;
  /** Frais de traitement prélevés SUR cette transaction. */
  fee: number;
  net: number;
}

export interface StripeEconomics {
  /** MRR des abonnements ACTIFS, net de remise. N'inclut JAMAIS les essais. */
  mrrActive: number;
  /** Ce que les essais en cours rapporteraient s'ils convertissaient tous.
   *  Ce n'est PAS un revenu : jamais additionné au MRR, affiché à part. */
  pipelineTrials: number;
  /** Manque à gagner des coupons sur les abonnements actifs. Un code à 100 %
   *  donne un abonné actif qui ne rapporte rien. */
  mrrForfeitedToCoupons: number;
  activeCount: number;
  trialingCount: number;
  /** Abonnements actifs ramenés à zéro par un coupon. */
  freeByCouponCount: number;
  /** Ventilation par LIGNE d'abonnement : un abonnement peut porter un plan
   *  et le Pack sérénité, et les deux doivent apparaître séparément. */
  byProduct: { label: string; subscribers: number; mrr: number }[];
  months: {
    month: string;
    collected: number;
    processingFees: number;
    /** Négatif. */
    refunded: number;
    /** Négatif : argent reversé aux prestataires, qui ne vous appartient pas. */
    transferred: number;
    /** Négatif. */
    connectFees: number;
    /** Négatif. */
    billingFees: number;
  }[];
  connectByKind: { kind: string; amount: number }[];
  deposits: {
    volume: number;
    count: number;
    processingFees: number;
    connectFees: number;
    /** Commission plateforme perçue. Zéro aujourd'hui. */
    commission: number;
  };
  accounts: { connected: number; chargesEnabled: number };
  /** Le relevé complet, du plus récent au plus ancien. */
  transactions: StripeTx[];
  /**
   * Ce qui n'entre pas — lu dans Firestore, invisible depuis Stripe seul :
   * l'essai de l'application et l'accès offert n'y créent aucun abonnement.
   */
  funnel: {
    realProviders: number;
    paying: number;
    trialActive: number;
    /** Essai terminé, jamais converti. */
    trialExpiredNeverPaid: number;
    compAccess: { name: string; plan: string; until: string | null }[];
  };
  generatedAt: string;
}
