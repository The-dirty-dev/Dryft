import favoritesService, { favoritesService as namedFavoritesService } from '../../services/favorites';

describe('services/favorites', () => {
  it('exports favorites service singleton', () => {
    expect(favoritesService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(favoritesService).toBe(namedFavoritesService);
  });

  it('exposes favorites APIs', () => {
    expect(typeof (favoritesService as any).addFavorite).toBe('function');
    expect(typeof (favoritesService as any).removeFavorite).toBe('function');
  });
});
