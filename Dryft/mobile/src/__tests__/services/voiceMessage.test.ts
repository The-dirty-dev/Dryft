import voiceMessageService, { voiceMessageService as namedVoiceMessageService } from '../../services/voiceMessage';

describe('services/voiceMessage', () => {
  it('exports voice message singleton', () => {
    expect(voiceMessageService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(voiceMessageService).toBe(namedVoiceMessageService);
  });

  it('exposes recording APIs', () => {
    expect(typeof (voiceMessageService as any).startRecording).toBe('function');
    expect(typeof (voiceMessageService as any).stopRecording).toBe('function');
  });
});
