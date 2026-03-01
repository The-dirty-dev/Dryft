import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { api } from '../api/client';

// Types for queued actions
export type QueuedActionType =
  | 'like'
  | 'pass'
  | 'super_like'
  | 'send_message'
  | 'update_profile'
  | 'block_user'
  | 'report_user'
  | 'read_receipt';

export interface QueuedAction {
  id: string;
  type: QueuedActionType;
  payload: Record<string, any>;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  priority: number; // Higher = more important
}

// Cached data types
export interface CachedProfile {
  id: string;
  name: string;
  age: number;
  photos: string[];
  bio: string;
  distance?: number;
  cachedAt: number;
}

export interface CachedMatch {
  id: string;
  matchedUserId: string;
  matchedUserName: string;
  matchedUserPhoto: string;
  lastMessage?: string;
  lastMessageAt?: number;
  unreadCount: number;
  cachedAt: number;
}

export interface CachedMessage {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: number;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

interface OfflineState {
  // Network status
  isOnline: boolean;
  connectionType: string | null;
  lastOnlineAt: number | null;

  // Action queue
  actionQueue: QueuedAction[];
  isProcessingQueue: boolean;
  lastSyncAt: number | null;

  // Cached data
  cachedProfiles: CachedProfile[];
  cachedMatches: CachedMatch[];
  cachedMessages: Record<string, CachedMessage[]>; // matchId -> messages

  // Settings
  maxCachedProfiles: number;
  maxCachedMessages: number;
  cacheExpiryMs: number;

  // Actions
  setNetworkStatus: (state: NetInfoState) => void;
  queueAction: (action: Omit<QueuedAction, 'id' | 'createdAt' | 'retryCount'>) => void;
  processQueue: () => Promise<void>;
  removeFromQueue: (actionId: string) => void;
  clearQueue: () => void;

  // Cache actions
  cacheProfiles: (profiles: CachedProfile[]) => void;
  getCachedProfiles: () => CachedProfile[];
  cacheMatches: (matches: CachedMatch[]) => void;
  cacheMessages: (matchId: string, messages: CachedMessage[]) => void;
  addPendingMessage: (matchId: string, message: CachedMessage) => void;
  updateMessageStatus: (matchId: string, messageId: string, status: CachedMessage['status']) => void;
  clearExpiredCache: () => void;
  clearAllCache: () => void;

  // Sync
  syncData: () => Promise<void>;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHED_PROFILES = 50;
const MAX_CACHED_MESSAGES = 100;
const MAX_RETRIES = 3;

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      // Initial state
      isOnline: true,
      connectionType: null,
      lastOnlineAt: null,
      actionQueue: [],
      isProcessingQueue: false,
      lastSyncAt: null,
      cachedProfiles: [],
      cachedMatches: [],
      cachedMessages: {},
      maxCachedProfiles: MAX_CACHED_PROFILES,
      maxCachedMessages: MAX_CACHED_MESSAGES,
      cacheExpiryMs: CACHE_EXPIRY_MS,

      setNetworkStatus: (state: NetInfoState) => {
        const wasOffline = !get().isOnline;
        const isNowOnline = !!(state.isConnected && state.isInternetReachable !== false);

        set({
          isOnline: isNowOnline,
          connectionType: state.type,
          lastOnlineAt: isNowOnline ? Date.now() : get().lastOnlineAt,
        });

        // If we just came back online, process the queue
        if (wasOffline && isNowOnline) {
          get().processQueue();
          get().syncData();
        }
      },

      queueAction: (action) => {
        const queuedAction: QueuedAction = {
          ...action,
          id: generateId(),
          createdAt: Date.now(),
          retryCount: 0,
          maxRetries: action.maxRetries ?? MAX_RETRIES,
          priority: action.priority ?? 0,
        };

        set((state) => ({
          actionQueue: [...state.actionQueue, queuedAction].sort(
            (a, b) => b.priority - a.priority
          ),
        }));

        // Try to process immediately if online
        if (get().isOnline) {
          get().processQueue();
        }
      },

      processQueue: async () => {
        const { isOnline, actionQueue, isProcessingQueue } = get();

        if (!isOnline || isProcessingQueue || actionQueue.length === 0) {
          return;
        }

        set({ isProcessingQueue: true });

        const queue = [...actionQueue];
        const failedActions: QueuedAction[] = [];

        for (const action of queue) {
          try {
            await processAction(action);
            // Remove successful action
            set((state) => ({
              actionQueue: state.actionQueue.filter((a) => a.id !== action.id),
            }));
          } catch (error) {
            console.error(`Failed to process action ${action.type}:`, error);

            if (action.retryCount < action.maxRetries) {
              failedActions.push({
                ...action,
                retryCount: action.retryCount + 1,
              });
            }
            // If max retries exceeded, action is dropped
          }
        }

        // Update queue with failed actions
        set((state) => ({
          actionQueue: [
            ...state.actionQueue.filter(
              (a) => !queue.find((q) => q.id === a.id)
            ),
            ...failedActions,
          ],
          isProcessingQueue: false,
          lastSyncAt: Date.now(),
        }));
      },

      removeFromQueue: (actionId) => {
        set((state) => ({
          actionQueue: state.actionQueue.filter((a) => a.id !== actionId),
        }));
      },

      clearQueue: () => {
        set({ actionQueue: [] });
      },

      // Cache methods
      cacheProfiles: (profiles) => {
        const now = Date.now();
        const cachedProfiles = profiles.map((p) => ({
          ...p,
          cachedAt: now,
        }));

        set((state) => {
          // Merge with existing, keeping newest
          const existingMap = new Map(
            state.cachedProfiles.map((p) => [p.id, p])
          );

          cachedProfiles.forEach((p) => {
            existingMap.set(p.id, p);
          });

          // Limit cache size
          const sorted = Array.from(existingMap.values())
            .sort((a, b) => b.cachedAt - a.cachedAt)
            .slice(0, state.maxCachedProfiles);

          return { cachedProfiles: sorted };
        });
      },

      getCachedProfiles: () => {
        const { cachedProfiles, cacheExpiryMs } = get();
        const now = Date.now();
        return cachedProfiles.filter(
          (p) => now - p.cachedAt < cacheExpiryMs
        );
      },

      cacheMatches: (matches) => {
        const now = Date.now();
        set({
          cachedMatches: matches.map((m) => ({
            ...m,
            cachedAt: now,
          })),
        });
      },

      cacheMessages: (matchId, messages) => {
        set((state) => ({
          cachedMessages: {
            ...state.cachedMessages,
            [matchId]: messages.slice(-state.maxCachedMessages),
          },
        }));
      },

      addPendingMessage: (matchId, message) => {
        set((state) => {
          const existing = state.cachedMessages[matchId] || [];
          return {
            cachedMessages: {
              ...state.cachedMessages,
              [matchId]: [...existing, message].slice(-state.maxCachedMessages),
            },
          };
        });
      },

      updateMessageStatus: (matchId, messageId, status) => {
        set((state) => {
          const messages = state.cachedMessages[matchId];
          if (!messages) return state;

          return {
            cachedMessages: {
              ...state.cachedMessages,
              [matchId]: messages.map((m) =>
                m.id === messageId ? { ...m, status } : m
              ),
            },
          };
        });
      },

      clearExpiredCache: () => {
        const { cacheExpiryMs } = get();
        const now = Date.now();

        set((state) => ({
          cachedProfiles: state.cachedProfiles.filter(
            (p) => now - p.cachedAt < cacheExpiryMs
          ),
          cachedMatches: state.cachedMatches.filter(
            (m) => now - m.cachedAt < cacheExpiryMs
          ),
        }));
      },

      clearAllCache: () => {
        set({
          cachedProfiles: [],
          cachedMatches: [],
          cachedMessages: {},
        });
      },

      syncData: async () => {
        const { isOnline } = get();
        if (!isOnline) return;

        try {
          // Sync matches
          const matchesResponse = await api.get('/matches');
          if (matchesResponse.data?.matches) {
            get().cacheMatches(
              matchesResponse.data.matches.map((m: any) => ({
                id: m.id,
                matchedUserId: m.other_user?.id || '',
                matchedUserName: m.other_user?.display_name || '',
                matchedUserPhoto: m.other_user?.profile_photo || '',
                lastMessage: m.last_message,
                lastMessageAt: m.last_message_at,
                unreadCount: m.unread_count,
                cachedAt: Date.now(),
              }))
            );
          }

          set({ lastSyncAt: Date.now() });
        } catch (error) {
          console.error('Sync failed:', error);
        }
      },
    }),
    {
      name: 'dryft-offline',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        actionQueue: state.actionQueue,
        cachedProfiles: state.cachedProfiles,
        cachedMatches: state.cachedMatches,
        cachedMessages: state.cachedMessages,
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
);

// Action processor
async function processAction(action: QueuedAction): Promise<void> {
  switch (action.type) {
    case 'like':
      await api.post(`/discover/${action.payload.userId}/like`);
      break;
    case 'pass':
      await api.post(`/discover/${action.payload.userId}/pass`);
      break;
    case 'super_like':
      await api.post(`/discover/${action.payload.userId}/super-like`);
      break;
    case 'send_message':
      await api.post(`/matches/${action.payload.matchId}/messages`, {
        content: action.payload.content,
        client_id: action.payload.clientId,
      });
      break;
    case 'update_profile':
      await api.put('/profile', action.payload);
      break;
    case 'block_user':
      await api.post(`/safety/block/${action.payload.userId}`);
      break;
    case 'report_user':
      await api.post(`/safety/report`, action.payload);
      break;
    case 'read_receipt':
      await api.post(`/matches/${action.payload.matchId}/read`);
      break;
    default:
      console.warn(`Unknown action type: ${action.type}`);
  }
}

// Initialize network listener
export function initializeNetworkListener() {
  return NetInfo.addEventListener((state) => {
    useOfflineStore.getState().setNetworkStatus(state);
  });
}
