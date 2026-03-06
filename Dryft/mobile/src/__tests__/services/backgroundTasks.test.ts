import backgroundTasksService, { backgroundTasksService as namedBackgroundTasksService } from '../../services/backgroundTasks';

describe('services/backgroundTasks', () => {
  it('exports background tasks singleton', () => {
    expect(backgroundTasksService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(backgroundTasksService).toBe(namedBackgroundTasksService);
  });

  it('exposes register/sync APIs', () => {
    expect(typeof (backgroundTasksService as any).initialize).toBe('function');
    expect(typeof (backgroundTasksService as any).performSync).toBe('function');
  });
});
