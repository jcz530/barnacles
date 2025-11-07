/**
 * Global test setup file
 * Mocks native modules that can't run in test environment
 */

import { vi } from 'vitest';

// Mock node-pty which is compiled for Electron's Node version
// Our tests run in standalone Node which has a different MODULE_VERSION
vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    kill: vi.fn(),
    resize: vi.fn(),
    pid: 12345,
  })),
  IPty: vi.fn(),
}));
