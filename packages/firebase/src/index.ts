// Config
export { app, getFirebaseApp } from './lib/config';

// Auth
export {
  auth,
  googleProvider,
  signInWithEmail,
  createUserWithEmail,
  signInWithGoogle,
  signOutUser,
  resetPassword,
  onAuthChange,
  getCurrentUser,
  updateUserEmail,
  updateUserPassword,
  reauthenticateUser,
  deleteCurrentUser,
  GoogleAuthProvider,
  signInWithCredential,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User,
  type UserCredential,
} from './lib/auth';

// Firestore
export {
  db,
  collections,
  providerSubcollections,
  conversationSubcollections,
  membersCollectionGroup,
  serverTimestamp,
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  collectionGroup,
  type DocumentReference,
  type CollectionReference,
  type Query,
  type DocumentSnapshot,
  type QuerySnapshot,
  type WhereFilterOp,
  type OrderByDirection,
} from './lib/firestore';

// Storage
export {
  storage,
  storagePaths,
  uploadFile,
  uploadFileWithProgress,
  getFileURL,
  deleteFile,
  listFiles,
  ref,
  type StorageReference,
  type UploadResult,
  type UploadTask,
} from './lib/storage';

// Repositories
export {
  // Base
  BaseRepository,
  convertTimestamps,
  type WithId,
  // User
  UserRepository,
  userRepository,
  // Provider
  ProviderRepository,
  providerRepository,
  type ProviderSearchFilters,
  // Member (subcollection)
  MemberRepository,
  memberRepository,
  // Location (subcollection)
  LocationRepository,
  locationRepository,
  // Service (subcollection)
  ServiceRepository,
  serviceRepository,
  // Availability (subcollection)
  AvailabilityRepository,
  availabilityRepository,
  // Blocked slot (subcollection)
  BlockedSlotRepository,
  blockedSlotRepository,
  // Booking
  BookingRepository,
  bookingRepository,
  type BookingFilters,
  // Review
  ReviewRepository,
  reviewRepository,
  // Conversation
  ConversationRepository,
  conversationRepository,
  // Message (subcollection)
  MessageRepository,
  messageRepository,
} from './repositories';

// Services
export {
  // Auth
  AuthService,
  authService,
  // User
  UserService,
  userService,
  // Provider
  ProviderService,
  providerService,
  // Member
  MemberService,
  memberService,
  // Location
  LocationService,
  locationService,
  // Catalog (Services/Prestations)
  CatalogService,
  catalogService,
  // Scheduling (Availability)
  SchedulingService,
  schedulingService,
  // Booking
  BookingService,
  bookingService,
  // Review
  ReviewService,
  reviewService,
  // Messaging
  MessagingService,
  messagingService,
  // Notification (Stub)
  NotificationService,
  notificationService,
} from './services';
