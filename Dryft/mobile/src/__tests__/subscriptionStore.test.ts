import { useSubscriptionStore } from '../store/subscriptionStore';

describe('subscriptionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks entitlement flags', () => {
    useSubscriptionStore.setState({
      entitlements: {
        dailyLikes: -1,
        dailySuperLikes: 0,
        rewind: true,
        seeWhoLikesYou: false,
        advancedFilters: false,
        vrAccess: true,
        privateVRRooms: false,
        customAvatars: false,
        premiumEnvironments: false,
        profileBoosts: 0,
        priorityMatching: false,
        readReceipts: true,
        incognitoMode: false,
        prioritySupport: false,
      },
    }, false);

    const state = useSubscriptionStore.getState();
    expect(state.hasEntitlement('dailyLikes')).toBe(true);
    expect(state.hasEntitlement('dailySuperLikes')).toBe(false);
    expect(state.hasEntitlement('readReceipts')).toBe(true);
  });

  it('clears errors', () => {
    useSubscriptionStore.setState({ error: 'Something went wrong' }, false);

    useSubscriptionStore.getState().clearError();

    expect(useSubscriptionStore.getState().error).toBeNull();
  });
});
