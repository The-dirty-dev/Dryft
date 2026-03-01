import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import { DEEP_LINK_CONFIG } from '../services/deepLinking';

describe('Dryft rebrand constants (mobile)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await apiClient.clearTokens();
  });

  it('uses dryft deep link prefixes', () => {
    expect(DEEP_LINK_CONFIG.prefixes).toContain('dryft://');
    expect(DEEP_LINK_CONFIG.prefixes).toContain('https://dryft.site');
    expect(DEEP_LINK_CONFIG.prefixes).toContain('https://www.dryft.site');
    expect(DEEP_LINK_CONFIG.prefixes.join(' ')).not.toContain('drift://');
  });

  it('stores auth tokens with dryft secure storage key', async () => {
    await apiClient.saveTokens({
      access_token: 'access-2',
      refresh_token: 'refresh-2',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'dryft_auth_tokens',
      expect.any(String)
    );
  });
});
