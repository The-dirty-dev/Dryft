import icebreakersService, { icebreakersService as namedIcebreakersService } from '../../services/icebreakers';

describe('services/icebreakers', () => {
  it('exports icebreakers service singleton', () => {
    expect(icebreakersService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(icebreakersService).toBe(namedIcebreakersService);
  });

  it('exposes icebreaker APIs', () => {
    expect(typeof (icebreakersService as any).getAllIcebreakers).toBe('function');
    expect(typeof (icebreakersService as any).recordUsage).toBe('function');
  });
});
