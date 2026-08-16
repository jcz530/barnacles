import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import { ProjectRescanSchedulerService } from '@backend/services/project-rescan-scheduler-service';

mockDatabaseForUnit();

/**
 * Demo projects point at paths that do not exist, so rescanning them produces
 * only churn and error logs — and risks overwriting fixture data if a fake path
 * ever collided with a real directory.
 */
describe('ProjectRescanSchedulerService in demo mode', () => {
  const context = createUnitTestContext();

  beforeEach(async () => {
    await context.setup();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not start when demo mode is enabled', async () => {
    vi.stubEnv('BARNACLES_DEMO', '1');
    vi.stubEnv('BARNACLES_DATA_DIR', '/tmp/barnacles-demo-test/.demo-data');
    const service = new ProjectRescanSchedulerService();

    await service.start();

    expect(service.getStatus().isRunning).toBe(false);
    service.stop();
  });

  it('stays disabled when updateInterval re-arms the scheduler', async () => {
    vi.stubEnv('BARNACLES_DEMO', '1');
    vi.stubEnv('BARNACLES_DATA_DIR', '/tmp/barnacles-demo-test/.demo-data');
    const service = new ProjectRescanSchedulerService();

    // updateInterval calls start() again — the guard must live inside start()
    // for this path to stay suppressed.
    await service.updateInterval(5);

    expect(service.getStatus().isRunning).toBe(false);
    service.stop();
  });

  it('still starts normally when demo mode is off', async () => {
    vi.stubEnv('BARNACLES_DEMO', '');
    const service = new ProjectRescanSchedulerService();

    await service.start();

    expect(service.getStatus().isRunning).toBe(true);
    service.stop();
  });
});
