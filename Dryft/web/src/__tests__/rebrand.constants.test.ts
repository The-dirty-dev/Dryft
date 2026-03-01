import { beforeEach, describe, expect, it } from 'vitest';
import apiClient, { API_ERROR_EVENT } from '@/lib/api';

describe('Dryft rebrand constants (web)', () => {
  beforeEach(() => {
    localStorage.clear();
    apiClient.clearTokens();
  });

  it('uses dryft API error event naming', () => {
    expect(API_ERROR_EVENT).toBe('dryft:api-error');
  });

  it('stores auth tokens under dryft key', () => {
    apiClient.saveTokens({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(localStorage.getItem('dryft_tokens')).not.toBeNull();
    expect(localStorage.getItem('drift_tokens')).toBeNull();
  });
});
