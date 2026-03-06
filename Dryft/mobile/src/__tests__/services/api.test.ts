import api, { api as namedApi, apiClient } from '../../services/api';

describe('services/api', () => {
  it('exports default api client', () => {
    expect(api).toBeDefined();
  });

  it('re-exports named api', () => {
    expect(namedApi).toBeDefined();
  });

  it('re-exports apiClient helper', () => {
    expect(apiClient).toBeDefined();
  });
});
