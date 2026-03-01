import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

// Response types for verification API calls
interface VerificationApiResponse {
  success: boolean;
  error?: string;
  verification_id?: string;
  verifications?: Array<{
    type: string;
    status: string;
    submitted_at?: string;
    reviewed_at?: string;
    expires_at?: string;
    rejection_reason?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export type VerificationType = 'photo' | 'phone' | 'email' | 'id' | 'social';

export type VerificationStatus =
  | 'none'
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface Verification {
  type: VerificationType;
  status: VerificationStatus;
  submittedAt?: string;
  reviewedAt?: string;
  expiresAt?: string;
  rejectionReason?: string;
  metadata?: Record<string, any>;
}

export interface VerificationState {
  verifications: Record<VerificationType, Verification>;
  isLoading: boolean;
  error: string | null;

  // Computed
  isPhotoVerified: boolean;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isFullyVerified: boolean;
  verificationScore: number;

  // Actions
  fetchVerificationStatus: () => Promise<void>;
  submitPhotoVerification: (photoUri: string, poseType: string) => Promise<boolean>;
  submitPhoneVerification: (phoneNumber: string) => Promise<{ success: boolean; verificationId?: string }>;
  verifyPhoneCode: (verificationId: string, code: string) => Promise<boolean>;
  submitEmailVerification: () => Promise<boolean>;
  verifyEmailCode: (token: string) => Promise<boolean>;
  submitIdVerification: (frontUri: string, backUri?: string) => Promise<boolean>;
  connectSocialAccount: (provider: string, token: string) => Promise<boolean>;
  clearError: () => void;
  reset: () => void;
}

const defaultVerification: Verification = {
  type: 'photo',
  status: 'none',
};

const initialState = {
  verifications: {
    photo: { ...defaultVerification, type: 'photo' as VerificationType },
    phone: { ...defaultVerification, type: 'phone' as VerificationType },
    email: { ...defaultVerification, type: 'email' as VerificationType },
    id: { ...defaultVerification, type: 'id' as VerificationType },
    social: { ...defaultVerification, type: 'social' as VerificationType },
  },
  isLoading: false,
  error: null,
};

export const useVerificationStore = create<VerificationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Computed getters
      get isPhotoVerified() {
        return get().verifications.photo.status === 'approved';
      },
      get isPhoneVerified() {
        return get().verifications.phone.status === 'approved';
      },
      get isEmailVerified() {
        return get().verifications.email.status === 'approved';
      },
      get isFullyVerified() {
        const v = get().verifications;
        return v.photo.status === 'approved' && v.email.status === 'approved';
      },
      get verificationScore() {
        const v = get().verifications;
        let score = 0;
        if (v.photo.status === 'approved') score += 40;
        if (v.phone.status === 'approved') score += 20;
        if (v.email.status === 'approved') score += 20;
        if (v.id.status === 'approved') score += 15;
        if (v.social.status === 'approved') score += 5;
        return score;
      },

      fetchVerificationStatus: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.get<VerificationApiResponse>('/verification/status');
          const data = response.data;

          const verifications = { ...get().verifications };
          for (const v of data?.verifications ?? []) {
            verifications[v.type as VerificationType] = {
              type: v.type as VerificationType,
              status: v.status as VerificationStatus,
              submittedAt: v.submitted_at,
              reviewedAt: v.reviewed_at,
              expiresAt: v.expires_at,
              rejectionReason: v.rejection_reason,
              metadata: v.metadata,
            };
          }

          set({ verifications, isLoading: false });
        } catch (error: any) {
          set({
            error: error.message || 'Failed to fetch verification status',
            isLoading: false
          });
        }
      },

      submitPhotoVerification: async (photoUri: string, poseType: string) => {
        set({ isLoading: true, error: null });
        try {
          const formData = new FormData();
          formData.append('photo', {
            uri: photoUri,
            type: 'image/jpeg',
            name: 'verification.jpg',
          } as any);
          formData.append('pose_type', poseType);

          const response = await api.post<VerificationApiResponse>('/verification/photo', formData);

          if (response.data?.success) {
            set((state) => ({
              verifications: {
                ...state.verifications,
                photo: {
                  ...state.verifications.photo,
                  status: 'pending',
                  submittedAt: new Date().toISOString(),
                },
              },
              isLoading: false,
            }));
            return true;
          }

          set({ error: response.data?.error || 'Verification failed', isLoading: false });
          return false;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to submit photo verification',
            isLoading: false
          });
          return false;
        }
      },

      submitPhoneVerification: async (phoneNumber: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<VerificationApiResponse>('/verification/phone/send', {
            phone_number: phoneNumber,
          });

          set({ isLoading: false });

          if (response.data?.success) {
            return {
              success: true,
              verificationId: response.data?.verification_id
            };
          }

          set({ error: response.data?.error });
          return { success: false };
        } catch (error: any) {
          set({
            error: error.message || 'Failed to send verification code',
            isLoading: false
          });
          return { success: false };
        }
      },

      verifyPhoneCode: async (verificationId: string, code: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<VerificationApiResponse>('/verification/phone/verify', {
            verification_id: verificationId,
            code,
          });

          if (response.data?.success) {
            set((state) => ({
              verifications: {
                ...state.verifications,
                phone: {
                  ...state.verifications.phone,
                  status: 'approved',
                  reviewedAt: new Date().toISOString(),
                },
              },
              isLoading: false,
            }));
            return true;
          }

          set({ error: response.data?.error || 'Invalid code', isLoading: false });
          return false;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to verify code',
            isLoading: false
          });
          return false;
        }
      },

      submitEmailVerification: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<VerificationApiResponse>('/verification/email/send');

          set({ isLoading: false });
          return response.data?.success ?? false;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to send verification email',
            isLoading: false
          });
          return false;
        }
      },

      verifyEmailCode: async (token: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<VerificationApiResponse>('/verification/email/verify', { token });

          if (response.data?.success) {
            set((state) => ({
              verifications: {
                ...state.verifications,
                email: {
                  ...state.verifications.email,
                  status: 'approved',
                  reviewedAt: new Date().toISOString(),
                },
              },
              isLoading: false,
            }));
            return true;
          }

          set({ error: response.data?.error, isLoading: false });
          return false;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to verify email',
            isLoading: false
          });
          return false;
        }
      },

      submitIdVerification: async (frontUri: string, backUri?: string) => {
        set({ isLoading: true, error: null });
        try {
          const formData = new FormData();
          formData.append('front', {
            uri: frontUri,
            type: 'image/jpeg',
            name: 'id_front.jpg',
          } as any);

          if (backUri) {
            formData.append('back', {
              uri: backUri,
              type: 'image/jpeg',
              name: 'id_back.jpg',
            } as any);
          }

          const response = await api.post<VerificationApiResponse>('/verification/id', formData);

          if (response.data?.success) {
            set((state) => ({
              verifications: {
                ...state.verifications,
                id: {
                  ...state.verifications.id,
                  status: 'pending',
                  submittedAt: new Date().toISOString(),
                },
              },
              isLoading: false,
            }));
            return true;
          }

          set({ error: response.data?.error, isLoading: false });
          return false;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to submit ID verification',
            isLoading: false
          });
          return false;
        }
      },

      connectSocialAccount: async (provider: string, token: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<VerificationApiResponse>('/verification/social', {
            provider,
            token,
          });

          if (response.data?.success) {
            set((state) => ({
              verifications: {
                ...state.verifications,
                social: {
                  ...state.verifications.social,
                  status: 'approved',
                  reviewedAt: new Date().toISOString(),
                  metadata: { provider },
                },
              },
              isLoading: false,
            }));
            return true;
          }

          set({ error: response.data?.error, isLoading: false });
          return false;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to connect social account',
            isLoading: false
          });
          return false;
        }
      },

      clearError: () => set({ error: null }),

      reset: () => set(initialState),
    }),
    {
      name: 'dryft-verification',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        verifications: state.verifications,
      }),
    }
  )
);
