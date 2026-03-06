import storiesService, { storiesService as namedStoriesService } from '../../services/stories';

describe('services/stories', () => {
  it('exports stories singleton', () => {
    expect(storiesService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(storiesService).toBe(namedStoriesService);
  });

  it('exposes story APIs', () => {
    expect(typeof (storiesService as any).getStoryFeed).toBe('function');
    expect(typeof (storiesService as any).createStory).toBe('function');
  });
});
