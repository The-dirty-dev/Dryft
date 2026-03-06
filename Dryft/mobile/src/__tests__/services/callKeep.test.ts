const callKeepService = require('../../services/callKeep').default;

describe('services/callKeep', () => {
  const mockRNCallKeep = {
    setup: jest.fn(async () => true),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    displayIncomingCall: jest.fn(),
    endCall: jest.fn(),
    setCurrentCallActive: jest.fn(),
    endAllCalls: jest.fn(),
    reportEndCallWithUUID: jest.fn(),
    setMutedCall: jest.fn(),
    setOnHold: jest.fn(),
    updateDisplay: jest.fn(),
    startCall: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (callKeepService as any).initialized = false;
    (callKeepService as any).handlers = {};
    (callKeepService as any).activeCallId = null;
    (callKeepService as any).RNCallKeep = mockRNCallKeep;
  });

  it('registers native handlers on setup', () => {
    (callKeepService as any).registerEventListeners();

    expect(mockRNCallKeep.addEventListener).toHaveBeenCalled();
    expect(mockRNCallKeep.addEventListener).toHaveBeenCalledWith('answerCall', expect.any(Function));
    expect(mockRNCallKeep.addEventListener).toHaveBeenCalledWith('endCall', expect.any(Function));
  });

  it('displays incoming call and tracks active call id', () => {
    callKeepService.displayIncomingCall('call-1', 'Jamie', '+1555000', true);

    expect(mockRNCallKeep.displayIncomingCall).toHaveBeenCalledWith(
      'call-1',
      '+1555000',
      'Jamie',
      'generic',
      true
    );
    expect(callKeepService.getActiveCallId()).toBe('call-1');
  });

  it('ends call and clears active call state', () => {
    callKeepService.displayIncomingCall('call-2', 'Alex', '+1555888');

    callKeepService.endCall('call-2');

    expect(mockRNCallKeep.endCall).toHaveBeenCalledWith('call-2');
    expect(callKeepService.hasActiveCall()).toBe(false);
  });
});
