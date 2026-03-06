import * as favoritesHooks from '../../hooks/useFavorites';

describe('useFavorites hooks', () => {
  it('exports useFavorites', () => {
    expect(typeof favoritesHooks.useFavorites).toBe('function');
  });

  it('exports useFavoriteProfile', () => {
    expect(typeof favoritesHooks.useFavoriteProfile).toBe('function');
  });

  it('exports useFavoriteButton', () => {
    expect(typeof favoritesHooks.useFavoriteButton).toBe('function');
  });
});
