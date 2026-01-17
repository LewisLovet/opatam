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
  createdAt: Date;
  updatedAt: Date;
}

// Provider types
export type ProviderPlan = 'trial' | 'solo' | 'team';

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
}

export interface Subscription {
  plan: ProviderPlan;
  tier: 'standard' | 'advanced';
  memberCount: number;
  validUntil: Date;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

// Member types (Teams)
export interface Member {
  name: string;
  email: string;
  phone: string | null;
  photoURL: string | null;
  accessCode: string;
  locationIds: string[];
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

// Service types
export interface Service {
  name: string;
  description: string | null;
  duration: number;
  price: number;
  bufferTime: number;
  locationIds: string[];
  memberIds: string[] | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// Availability types
export interface Availability {
  memberId: string | null;
  locationId: string;
  dayOfWeek: number;
  slots: TimeSlot[];
  isOpen: boolean;
  updatedAt: Date;
}

export interface TimeSlot {
  start: string;
  end: string;
}

// Blocked slot types
export interface BlockedSlot {
  memberId: string | null;
  locationId: string | null;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  createdAt: Date;
}

// Booking types
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'noshow';

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
  clientId: string;
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
