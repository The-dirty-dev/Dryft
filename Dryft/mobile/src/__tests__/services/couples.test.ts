import * as couplesService from '../../services/couples';

describe('services/couples', () => {
  it('exports getDashboard', () => {
    expect(typeof couplesService.getDashboard).toBe('function');
  });

  it('exports invitePartner', () => {
    expect(typeof couplesService.sendCoupleInvite).toBe('function');
  });

  it('exports getActivities', () => {
    expect(typeof couplesService.getActivities).toBe('function');
  });
});
