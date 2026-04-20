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
  mrr: number;
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
}

export interface ReviewFilters {
  search?: string;
  minRating?: number;
  maxRating?: number;
  isPublic?: 'true' | 'false' | 'all';
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
  mrr: number;
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

export interface RecentSignups {
  providers: RecentProvider[];
  clients: RecentSignup[];
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
    serviceName: string;
    memberName: string | null;
    status: string;
    datetime: string | null;
    createdAt: string | null;
    price: number;
  }[];
}
