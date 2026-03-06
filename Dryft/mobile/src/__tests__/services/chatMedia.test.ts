import chatMediaService, { chatMediaService as namedChatMediaService } from '../../services/chatMedia';

describe('services/chatMedia', () => {
  it('exports chat media singleton', () => {
    expect(chatMediaService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(chatMediaService).toBe(namedChatMediaService);
  });

  it('exposes media helpers', () => {
    expect(typeof (chatMediaService as any).pickImage).toBe('function');
    expect(typeof (chatMediaService as any).uploadMedia).toBe('function');
  });
});
