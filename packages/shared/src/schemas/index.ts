// Auth schemas
export {
  loginSchema,
  registerClientSchema,
  registerProviderSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.schema';
export type {
  LoginInput,
  RegisterClientInput,
  RegisterProviderInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from './auth.schema';

// Provider schemas
export {
  socialLinksSchema,
  providerSettingsSchema,
  createProviderSchema,
  updateProviderSchema,
} from './provider.schema';
export type {
  SocialLinksInput,
  ProviderSettingsInput,
  CreateProviderInput,
  UpdateProviderInput,
} from './provider.schema';

// Member schemas
export {
  createMemberSchema,
  updateMemberSchema,
} from './member.schema';
export type {
  CreateMemberInput,
  UpdateMemberInput,
} from './member.schema';

// Location schemas
export {
  geopointSchema,
  createLocationSchema,
  updateLocationSchema,
} from './location.schema';
export type {
  GeopointInput,
  CreateLocationInput,
  UpdateLocationInput,
} from './location.schema';

// Service schemas
export {
  createServiceSchema,
  updateServiceSchema,
} from './service.schema';
export type {
  CreateServiceInput,
  UpdateServiceInput,
} from './service.schema';

// Availability schemas
export {
  timeSlotSchema,
  availabilitySchema,
  setAvailabilitySchema,
  blockedSlotSchema,
  exceptionSlotSchema,
} from './availability.schema';
export type {
  TimeSlotInput,
  AvailabilityInput,
  SetAvailabilityInput,
  BlockedSlotInput,
  ExceptionSlotInput,
} from './availability.schema';

// Booking schemas
export {
  clientInfoSchema,
  createBookingSchema,
  updateBookingStatusSchema,
  rescheduleBookingSchema,
  bookingFilterSchema,
} from './booking.schema';
export type {
  ClientInfoInput,
  CreateBookingInput,
  UpdateBookingStatusInput,
  RescheduleBookingInput,
  BookingFilterInput,
} from './booking.schema';

// Review schemas
export {
  createReviewSchema,
  updateReviewSchema,
  reviewResponseSchema,
  reviewFilterSchema,
} from './review.schema';
export type {
  CreateReviewInput,
  UpdateReviewInput,
  ReviewResponseInput,
  ReviewFilterInput,
} from './review.schema';

// Message schemas
export {
  sendMessageSchema,
  createConversationSchema,
  updateConversationSchema,
  messageFilterSchema,
} from './message.schema';
export type {
  SendMessageInput,
  CreateConversationInput,
  UpdateConversationInput,
  MessageFilterInput,
} from './message.schema';
