// =============================================================================
// Auth Types
// =============================================================================

export interface User {
  id: string;
  email: string;
  display_name?: string;
  bio?: string;
  profile_photo?: string;
  verified: boolean;
  verified_at?: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name?: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RefreshRequest {
  refresh_token: string;
}

// =============================================================================
// Profile Types
// =============================================================================

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  bio?: string;
  age?: number;
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  };
  photos: string[];
  interests?: string[];
  verified: boolean;
  created_at: string;
}

export interface UserPublicProfile {
  id: string;
  display_name: string;
  bio?: string;
  age?: number;
  profile_photo?: string;
  photos?: string[];
  interests?: string[];
  verified: boolean;
}

export interface UpdateProfileRequest {
  display_name?: string;
  bio?: string;
  interests?: string[];
}

export interface UserPreferences {
  min_age: number;
  max_age: number;
  max_distance_km: number;
  gender_preference: 'male' | 'female' | 'all';
  show_me_to: 'male' | 'female' | 'all';
}

// =============================================================================
// Matching Types
// =============================================================================

export type SwipeDirection = 'like' | 'pass';

export interface DiscoverProfile extends UserPublicProfile {
  distance_km?: number;
}

export interface DiscoverResponse {
  profiles: DiscoverProfile[];
}

export interface SwipeRequest {
  user_id: string;
  direction: SwipeDirection;
}

export interface SwipeResult {
  matched: boolean;
  match_id?: string;
  conversation_id?: string;
}

export interface Match {
  id: string;
  user_a_id: string;
  user_b_id: string;
  matched_at: string;
  unmatched_at?: string;
}

export interface MatchWithUser {
  id: string;
  other_user: UserPublicProfile;
  matched_at: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
}

export interface MatchesResponse {
  matches: MatchWithUser[];
}

// =============================================================================
// Chat Types
// =============================================================================

export type MessageType = 'text' | 'image' | 'gif' | 'haptic';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MessageType;
  content: string;
  read_at?: string;
  created_at: string;
}

export interface MessagePreview {
  id: string;
  sender_id: string;
  type: MessageType;
  preview: string;
  created_at: string;
  is_read: boolean;
}

export interface Conversation {
  id: string;
  match_id: string;
  other_user: UserPublicProfile;
  last_message?: MessagePreview;
  unread_count: number;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationsResponse {
  conversations: Conversation[];
}

export interface MessagesResponse {
  messages: Message[];
  has_more: boolean;
  cursor?: string;
}

export interface SendMessageRequest {
  content: string;
  content_type?: MessageType;
}

// =============================================================================
// Haptic Types
// =============================================================================

export interface HapticDevice {
  id: string;
  user_id: string;
  device_index: number;
  device_name: string;
  device_address?: string;
  can_vibrate: boolean;
  can_rotate: boolean;
  can_linear: boolean;
  can_battery: boolean;
  vibrate_count: number;
  rotate_count: number;
  linear_count: number;
  display_name?: string;
  is_primary: boolean;
  max_intensity: number;
  last_connected?: string;
  created_at: string;
}

export interface HapticDevicePublic {
  id: string;
  device_name: string;
  display_name?: string;
  can_vibrate: boolean;
  can_rotate: boolean;
  can_linear: boolean;
  is_primary: boolean;
}

export type HapticPermissionType = 'always' | 'request' | 'never';
export type HapticCommandType = 'vibrate' | 'rotate' | 'linear' | 'stop' | 'pattern';

export interface HapticPermission {
  id: string;
  owner_id: string;
  controller_id: string;
  match_id: string;
  permission_type: HapticPermissionType;
  max_intensity: number;
  expires_at?: string;
  granted_at: string;
}

export interface PatternStep {
  time_ms: number;
  intensity: number;
  motor_index: number;
}

export interface HapticPattern {
  id: string;
  name: string;
  description?: string;
  is_public: boolean;
  pattern_data: PatternStep[];
  duration_ms: number;
  use_count: number;
}

export interface HapticCommand {
  target_user_id: string;
  match_id: string;
  device_id?: string;
  command_type: HapticCommandType;
  intensity: number;
  duration_ms: number;
  motor_index?: number;
  pattern_id?: string;
}

export interface RegisterDeviceRequest {
  device_index: number;
  device_name: string;
  device_address?: string;
  can_vibrate: boolean;
  can_rotate: boolean;
  can_linear: boolean;
  can_battery: boolean;
  vibrate_count: number;
  rotate_count: number;
  linear_count: number;
}

// =============================================================================
// Companion Session Types
// =============================================================================

export type SessionStatus = 'active' | 'ended' | 'expired';
export type DeviceType = 'vr' | 'mobile' | 'web';

export interface CompanionSession {
  id: string;
  host_id: string;
  session_code: string;
  status: SessionStatus;
  max_participants: number;
  vr_device_type?: string;
  vr_room?: string;
  created_at: string;
  expires_at: string;
  ended_at?: string;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  display_name: string;
  device_type: DeviceType;
  is_host: boolean;
  joined_at: string;
  left_at?: string;
}

export interface ParticipantInfo {
  user_id: string;
  display_name: string;
  photo_url?: string;
  device_type: DeviceType;
  is_host: boolean;
  joined_at: string;
}

export interface SessionInfo {
  session: CompanionSession;
  participants: ParticipantInfo[];
  host: ParticipantInfo;
}

export interface CreateSessionRequest {
  max_participants?: number;
  vr_device_type?: string;
  expires_in_mins?: number;
}

export interface CreateSessionResponse {
  session_id: string;
  session_code: string;
  expires_at: string;
}

export interface JoinSessionRequest {
  session_code: string;
  display_name?: string;
  device_type: DeviceType;
}

// =============================================================================
// Verification Types
// =============================================================================

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'manual_review';

export interface VerificationStatusResponse {
  status: VerificationStatus;
  overall_status: VerificationStatus;
  card_verified: boolean;
  id_verified: boolean;
  face_match_verified: boolean;
  phone_verified?: boolean;
  email_verified?: boolean;
  rejection_reason?: string;
  can_retry: boolean;
  retry_available_at?: string;
}

export interface VerificationScoreResponse {
  score: number;
  components: {
    photo: boolean;
    phone: boolean;
    email: boolean;
    id: boolean;
    social: boolean;
  };
}

export interface CardVerificationInitResponse {
  client_secret: string;
}

export interface IDVerificationInitResponse {
  redirect_url?: string;
  sdk_token?: string;
}

// =============================================================================
// Safety Types
// =============================================================================

export type ReportReason =
  | 'harassment'
  | 'inappropriate_content'
  | 'spam'
  | 'fake_profile'
  | 'underage'
  | 'scam'
  | 'other';

export type ReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: ReportReason;
  description?: string;
  evidence_urls?: string[];
  status: ReportStatus;
  created_at: string;
  reviewed_at?: string;
}

export interface CreateReportRequest {
  reported_user_id: string;
  reason: ReportReason;
  description?: string;
  evidence_urls?: string[];
}

export interface BlockedUser {
  id: string;
  user_id: string;
  blocked_user_id: string;
  blocked_at: string;
}

export interface SafetyWarning {
  id: string;
  user_id: string;
  warning_type: string;
  message: string;
  created_at: string;
  acknowledged_at?: string;
}

export interface PanicRequest {
  location?: {
    latitude: number;
    longitude: number;
  };
  message?: string;
}

// =============================================================================
// Settings Types
// =============================================================================

export interface UserSettings {
  // Notifications
  notifications: {
    push_enabled: boolean;
    email_enabled: boolean;
    new_matches: boolean;
    new_messages: boolean;
    new_likes: boolean;
    promotions: boolean;
  };

  // Privacy
  privacy: {
    show_online_status: boolean;
    show_last_active: boolean;
    show_distance: boolean;
    allow_screenshots: boolean;
    incognito_mode: boolean;
  };

  // Appearance
  appearance: {
    theme: 'light' | 'dark' | 'system';
    language: string;
  };

  // VR Settings
  vr: {
    default_avatar_id?: string;
    haptic_feedback: boolean;
    voice_chat_enabled: boolean;
    spatial_audio: boolean;
  };

  // Haptic Settings
  haptic: {
    enabled: boolean;
    max_intensity: number;
    default_permission: HapticPermissionType;
  };

  // Matching Settings
  matching: {
    auto_advance: boolean;
    show_boost_prompt: boolean;
  };

  // Safety Settings
  safety: {
    panic_button_enabled: boolean;
    emergency_contacts: string[];
    share_location_on_panic: boolean;
  };
}

export interface UpdateSettingsRequest {
  notifications?: Partial<UserSettings['notifications']>;
  privacy?: Partial<UserSettings['privacy']>;
  appearance?: Partial<UserSettings['appearance']>;
  vr?: Partial<UserSettings['vr']>;
  haptic?: Partial<UserSettings['haptic']>;
  matching?: Partial<UserSettings['matching']>;
  safety?: Partial<UserSettings['safety']>;
}

// =============================================================================
// Notification Types
// =============================================================================

export type NotificationType =
  | 'new_match'
  | 'new_message'
  | 'new_like'
  | 'system'
  | 'promo'
  | 'safety';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

export interface RegisterDeviceTokenRequest {
  token: string;
  platform: 'ios' | 'android' | 'web';
  device_id?: string;
}

// =============================================================================
// Calls / WebRTC Types
// =============================================================================

export type CallType = 'voice' | 'video';
export type CallStatus = 'ringing' | 'connected' | 'ended' | 'missed' | 'declined';

export interface Call {
  id: string;
  match_id: string;
  caller_id: string;
  callee_id: string;
  call_type: CallType;
  status: CallStatus;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  created_at: string;
}

export interface InitiateCallRequest {
  match_id: string;
  call_type: CallType;
}

export interface InitiateCallResponse {
  call_id: string;
  ice_servers: RTCIceServer[];
}

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface CallSignal {
  call_id: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: string;
}

// =============================================================================
// Avatar Types
// =============================================================================

export interface Avatar {
  id: string;
  user_id: string;
  name: string;
  model_url?: string;
  thumbnail_url?: string;
  colors: AvatarColors;
  equipped_items: string[];
  visibility: 'public' | 'matches' | 'private';
  created_at: string;
  updated_at: string;
}

export interface AvatarColors {
  skin: string;
  hair: string;
  eyes: string;
  primary: string;
  secondary: string;
}

export interface UpdateAvatarRequest {
  name?: string;
  colors?: Partial<AvatarColors>;
  visibility?: Avatar['visibility'];
}

export interface EquipItemRequest {
  item_id: string;
}

// =============================================================================
// Links Types
// =============================================================================

export type LinkType = 'profile' | 'vr_invite' | 'referral' | 'custom';

export interface DeepLink {
  id: string;
  code: string;
  type: LinkType;
  creator_id: string;
  data?: Record<string, string>;
  expires_at?: string;
  max_uses?: number;
  use_count: number;
  created_at: string;
}

export interface CreateLinkRequest {
  type: LinkType;
  data?: Record<string, string>;
  expires_in_hours?: number;
  max_uses?: number;
}

export interface CreateLinkResponse {
  code: string;
  url: string;
  expires_at?: string;
}

export interface VRInvite {
  id: string;
  code: string;
  inviter_id: string;
  invitee_id?: string;
  session_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  created_at: string;
  expires_at: string;
}

// =============================================================================
// Subscription Types
// =============================================================================

export type SubscriptionTier = 'free' | 'plus' | 'premium' | 'vip';
export type EntitlementType =
  | 'unlimited_likes'
  | 'see_who_likes'
  | 'super_likes'
  | 'boosts'
  | 'rewind'
  | 'passport'
  | 'read_receipts'
  | 'priority_matching'
  | 'vr_access'
  | 'haptic_patterns';

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  is_active: boolean;
  expires_at?: string;
  auto_renew: boolean;
  platform: 'ios' | 'android' | 'web';
  entitlements: EntitlementType[];
}

export interface EntitlementsResponse {
  entitlements: EntitlementType[];
  boosts_remaining: number;
  super_likes_remaining: number;
  likes_remaining?: number;
  resets_at?: string;
}

export interface VerifyReceiptRequest {
  receipt_data: string;
  platform: 'ios' | 'android';
}

// =============================================================================
// Marketplace Types
// =============================================================================

export type ItemType = 'avatar' | 'outfit' | 'toy' | 'effect' | 'gesture';
export type ItemStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'disabled';
export type PurchaseStatus = 'pending' | 'completed' | 'refunded' | 'failed';

export interface ItemCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  icon_url?: string;
}

export interface StoreItem {
  id: string;
  creator_id: string;
  creator_name: string;
  item_type: ItemType;
  name: string;
  description: string;
  price: number;
  currency: string;
  thumbnail_url?: string;
  preview_url?: string;
  preview_urls?: string[];
  asset_bundle_url?: string;
  tags: string[];
  purchase_count: number;
  rating: number;
  rating_count: number;
  is_featured: boolean;
  is_owned: boolean;
  status: ItemStatus;
  created_at: string;
}

export interface StoreItemsResponse {
  items: StoreItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  item_id: string;
  purchase_id: string;
  is_equipped: boolean;
  acquired_at: string;
  item?: StoreItem;
  // Flattened fields from item for convenience
  item_type?: ItemType;
  name?: string;
  thumbnail_url?: string;
}

export interface InventoryResponse {
  items: InventoryItem[];
  limit: number;
  offset: number;
}

export interface PurchaseResult {
  purchase_id: string;
  client_secret?: string;
  amount: number;
  currency: string;
  status: PurchaseStatus;
}

export interface Creator {
  id: string;
  user_id: string;
  display_name: string;
  store_name?: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  stripe_onboarded: boolean;
  payouts_enabled: boolean;
  total_sales: number;
  total_earnings: number;
  item_count: number;
  average_rating: number;
  is_verified: boolean;
  is_featured: boolean;
  created_at: string;
}

export interface EarningsSummary {
  total_earnings: number;
  total_paid_out: number;
  available_balance: number;
  last_30_days: number;
  last_7_days: number;
  total_sales: number;
}

// =============================================================================
// Analytics Types
// =============================================================================

export interface AnalyticsEvent {
  event_type: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

export interface AnalyticsEventsRequest {
  events: AnalyticsEvent[];
}

export interface UserAnalytics {
  user_id: string;
  total_matches: number;
  total_messages_sent: number;
  total_messages_received: number;
  total_calls: number;
  avg_session_duration_mins: number;
  last_active_at: string;
}

export interface DailyMetrics {
  date: string;
  new_users: number;
  active_users: number;
  matches_created: number;
  messages_sent: number;
  calls_made: number;
  revenue: number;
}

// =============================================================================
// Admin Types
// =============================================================================

export interface AdminUser extends User {
  role: 'user' | 'moderator' | 'admin' | 'super_admin';
  is_banned: boolean;
  banned_at?: string;
  ban_reason?: string;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface BanUserRequest {
  user_id: string;
  reason: string;
  duration_days?: number;
}

export interface AdminReport extends Report {
  reporter: UserPublicProfile;
  reported_user: UserPublicProfile;
  reviewed_by?: string;
  action_taken?: string;
}

export interface AdminReportsResponse {
  reports: AdminReport[];
  total: number;
  pending_count: number;
}

export interface ReviewReportRequest {
  action: 'dismiss' | 'warn' | 'suspend' | 'ban';
  notes?: string;
  duration_days?: number;
}

export interface VerificationQueueItem {
  id: string;
  user: UserPublicProfile;
  status: VerificationStatus;
  photo_url?: string;
  document_type?: string;
  document_country?: string;
  face_match_score?: number;
  created_at: string;
}

export interface VerificationQueueResponse {
  items: VerificationQueueItem[];
  total: number;
}

export interface ReviewVerificationRequest {
  action: 'approve' | 'reject';
  rejection_reason?: string;
}

// =============================================================================
// Shared Constants
// =============================================================================

export { API_BASE_PATH, API_ENDPOINTS, WS_BASE_PATH, WS_EVENTS } from './constants';
export {
  ERROR_CODES,
  ERROR_MESSAGES,
  HTTP_STATUS_TO_ERROR_CODE,
  createApiError,
  getErrorCodeForStatus,
  isRetryableError,
} from './errors';
export type { ApiError, ErrorCode } from './errors';

// =============================================================================
// WebSocket Event Types
// =============================================================================

export interface WSMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
}

export interface NewMessagePayload {
  message: Message;
  conversation_id: string;
}

export interface TypingPayload {
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
}

export interface PresencePayload {
  user_id: string;
  is_online: boolean;
  last_seen?: string;
}

export interface NewMatchPayload {
  match_id: string;
  conversation_id: string;
  user: UserPublicProfile;
  matched_at: string;
}

export interface UnmatchPayload {
  match_id: string;
  conversation_id: string;
}

export interface CallEventPayload {
  call_id: string;
  match_id: string;
  caller_id: string;
  call_type: CallType;
  event: 'incoming' | 'accepted' | 'rejected' | 'ended' | 'missed';
}

export interface HapticEventPayload {
  sender_id: string;
  command_type: HapticCommandType;
  intensity: number;
  duration_ms: number;
  motor_index?: number;
  pattern_data?: PatternStep[];
}

export interface SessionEventPayload {
  session_id: string;
  event: 'participant_joined' | 'participant_left' | 'session_ended' | 'chat' | 'haptic';
  participant?: ParticipantInfo;
  message?: string;
}

// =============================================================================
// Utility Types
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, string>;
}
