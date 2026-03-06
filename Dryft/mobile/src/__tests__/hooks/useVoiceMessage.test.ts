import * as voiceMessageHooks from '../../hooks/useVoiceMessage';

describe('useVoiceMessage hooks', () => {
  it('exports useVoiceRecording', () => {
    expect(typeof voiceMessageHooks.useVoiceRecording).toBe('function');
  });

  it('exports useVoicePlayback', () => {
    expect(typeof voiceMessageHooks.useVoicePlayback).toBe('function');
  });

  it('exports useVoiceMessage', () => {
    expect(typeof voiceMessageHooks.useVoiceMessage).toBe('function');
  });
});
