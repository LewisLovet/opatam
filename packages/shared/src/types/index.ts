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
  role: 'client' | 'provider' | 'both';
  providerId: string | null;
  city: string | null;
  birthYear: number | null;
  gender: 'male' | 'female' | 'other' | null;
  cancellationCount: number;
  pushTokens: string[]; // Expo push tokens for notifications (device-specific)
  notificationSettings?: NotificationSettings;
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
  minPrice: number | null;       // Minimum price from active services (in centimes)
  searchTokens: string[];        // Normalized words from businessName for search (e.g., ["salon", "hugo"])
  geopoint: { latitude: number; longitude: number } | null; // From default location, for proximity search
  // Availability cache (computed by Cloud Functions)
  nextAvailableSlot: Date | null; // Next available booking slot (null if none or not computed)
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialLinks {
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  website: string | null;
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
}

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
}

// Member types (Teams)
export interface Member {
  name: string;
  email: string;
  phone: string | null;
  photoURL: string | null;
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
  duration: number;
  price: number;
  bufferTime: number;
  categoryId: string | null;
  locationIds: string[];
  memberIds: string[] | null;
  isActive: boolean;
  sortOrder: number;
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
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'noshow';

export interface Booking {
  providerId: string;
  clientId: string | null;
  memberId: string | null;
  providerName: string;
  providerPhoto: string | null;
  memberName: string | null;
  memberPhoto: string | null;
  locationId: string;
  locationName: string;
  locationAddress: string;
  serviceId: string;
  serviceName: string;
  duration: number;
  price: number;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientInfo {
  name: string;
  email: string;
  phone: string;
}

// Review types
export interface Review {
  providerId: string;
  bookingId: string;
  clientId: string | null;  // null for anonymous reviews (from email link)
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
