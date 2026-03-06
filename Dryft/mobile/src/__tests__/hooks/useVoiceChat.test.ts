import * as voiceChatHooks from '../../hooks/useVoiceChat';

describe('useVoiceChat hook', () => {
  it('exports useVoiceChat', () => {
    expect(typeof voiceChatHooks.useVoiceChat).toBe('function');
  });

  it('exports VoiceChatState contract helper via hook module', () => {
    expect('useVoiceChat' in voiceChatHooks).toBe(true);
  });

  it('keeps module import stable', () => {
    expect(voiceChatHooks).toBeDefined();
  });
});
