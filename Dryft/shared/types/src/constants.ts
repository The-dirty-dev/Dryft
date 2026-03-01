// =============================================================================
// API & WebSocket Constants
// =============================================================================

export const API_BASE_PATH = '/v1';
export const WS_BASE_PATH = '/v1/ws';

// =============================================================================
// API Endpoints
// =============================================================================

export const API_ENDPOINTS = {
  auth: {
    login: '/v1/auth/login',
    register: '/v1/auth/register',
    refresh: '/v1/auth/refresh',
    logout: '/v1/auth/logout',
  },
  profile: {
    me: '/v1/profile',
    preferences: '/v1/profile/preferences',
    photos: '/v1/profile/photos',
    uploadUrl: '/v1/profile/photos/upload-url',
    location: '/v1/profile/location',
  },
  matches: '/v1/matches',
  discover: '/v1/discover',
  conversations: '/v1/conversations',
  notifications: '/v1/notifications',
  settings: '/v1/settings',
  store: {
    items: '/v1/store/items',
    item: '/v1/store/items/:itemId',
    purchase: '/v1/store/purchase',
    categories: '/v1/store/categories',
    creators: '/v1/store/creators',
    creator: '/v1/store/creators/:creatorId',
    creatorItems: '/v1/store/creators/:creatorId/items',
  },
  inventory: {
    list: '/v1/inventory',
    equipped: '/v1/inventory/equipped',
    equip: '/v1/inventory/:itemId/equip',
    unequip: '/v1/inventory/:itemId/unequip',
  },
  haptics: {
    devices: '/v1/haptics/devices',
    device: '/v1/haptics/devices/:deviceId',
    commands: '/v1/haptics/commands',
    permissions: '/v1/haptics/permissions',
  },
  calls: {
    initiate: '/v1/calls/initiate',
    accept: '/v1/calls/accept',
    reject: '/v1/calls/reject',
    end: '/v1/calls/end',
  },
  safety: {
    report: '/v1/safety/report',
    block: '/v1/safety/block',
    unblock: '/v1/safety/unblock',
    panic: '/v1/safety/panic',
  },
  subscriptions: {
    status: '/v1/subscriptions/status',
    entitlements: '/v1/subscriptions/entitlements',
    verify: '/v1/subscriptions/verify',
    restore: '/v1/subscriptions/restore',
    cancel: '/v1/subscriptions/cancel',
    useBoost: '/v1/subscriptions/use-boost',
    useSuperLike: '/v1/subscriptions/use-super-like',
    useLike: '/v1/subscriptions/use-like',
  },
  verification: {
    status: '/v1/verification/status',
    photo: '/v1/verification/photo',
    phone: '/v1/verification/phone',
    email: '/v1/verification/email',
    id: '/v1/verification/id',
    social: '/v1/verification/social',
  },
  avatar: {
    base: '/v1/avatar',
    equip: '/v1/avatar/equip',
    unequip: '/v1/avatar/unequip',
    colors: '/v1/avatar/colors',
    name: '/v1/avatar/name',
    visibility: '/v1/avatar/visibility',
    history: '/v1/avatar/history',
    batch: '/v1/avatar/batch',
  },
  links: {
    create: '/v1/links',
    get: '/v1/links/:linkId',
    validate: '/v1/links/validate',
    use: '/v1/links/use',
    profile: '/v1/links/profile',
    vrInvite: '/v1/links/vr/invite',
    vrValidate: '/v1/links/vr/validate',
    vrAccept: '/v1/links/vr/accept',
    vrDecline: '/v1/links/vr/decline',
    vrCancel: '/v1/links/vr/cancel',
  },
  analytics: {
    events: '/v1/analytics/events',
    user: '/v1/analytics/user',
    daily: '/v1/analytics/daily',
    dashboard: '/v1/analytics/dashboard',
  },
  admin: {
    users: '/v1/admin/users',
    user: '/v1/admin/users/:userId',
    verifications: '/v1/admin/verifications',
    verification: '/v1/admin/verifications/:verificationId',
    reviews: '/v1/admin/reviews',
    review: '/v1/admin/reviews/:reviewId',
    reports: '/v1/admin/reports',
    report: '/v1/admin/reports/:reportId',
  },
} as const;

// =============================================================================
// WebSocket Event Names
// =============================================================================

export const WS_EVENTS = {
  ping: 'ping',
  pong: 'pong',
  subscribe: 'subscribe',
  unsubscribe: 'unsubscribe',
  sendMessage: 'send_message',
  typingStart: 'typing_start',
  typingStop: 'typing_stop',
  markRead: 'mark_read',
  error: 'error',
  newMessage: 'new_message',
  messageSent: 'message_sent',
  typing: 'typing',
  presence: 'presence',
  newMatch: 'new_match',
  unmatched: 'unmatched',
  messagesRead: 'messages_read',
  callRequest: 'call_request',
  callAccept: 'call_accept',
  callReject: 'call_reject',
  callEnd: 'call_end',
  callBusy: 'call_busy',
  callOffer: 'call_offer',
  callAnswer: 'call_answer',
  callCandidate: 'call_candidate',
  callMute: 'call_mute',
  callUnmute: 'call_unmute',
  callVideoOff: 'call_video_off',
  callVideoOn: 'call_video_on',
} as const;

export type WSEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
