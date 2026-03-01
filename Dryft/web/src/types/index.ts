export * from '../../../shared/types/src';

// =============================================================================
// Web-local Types
// =============================================================================

export interface ItemReview {
  id: string;
  item_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export type SettingsPayload = import('../../../shared/types/src').UserSettings;

export interface SettingsResponse {
  settings: import('../../../shared/types/src').UserSettings;
  updatedAt?: string;
}
