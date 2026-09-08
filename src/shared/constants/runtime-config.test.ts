import { beforeEach, describe, expect, it } from 'vitest';
import { RUNTIME_CONFIG, updateRuntimeConfig } from './index';

/**
 * The renderer resolves image and file URLs from RUNTIME_CONFIG.API_BASE_URL.
 * It is a separate JS context from the main process, so it has to be told the
 * port its own server bound to -- otherwise it keeps the compiled-in 51000 and,
 * when a second instance is running, asks the *other* app's server for images.
 */
describe('RUNTIME_CONFIG', () => {
  const original = { ...RUNTIME_CONFIG };

  beforeEach(() => {
    updateRuntimeConfig(original);
  });

  it('defaults to the preferred port', () => {
    expect(RUNTIME_CONFIG.API_BASE_URL).toBe('http://localhost:51000');
  });

  it('picks up the port this instance actually got', () => {
    updateRuntimeConfig({ API_PORT: 51001, API_BASE_URL: 'http://localhost:51001' });

    expect(RUNTIME_CONFIG.API_PORT).toBe(51001);
    expect(RUNTIME_CONFIG.API_BASE_URL).toBe('http://localhost:51001');
  });

  it('is visible to modules that read it after the update', () => {
    // The binding is reassigned rather than mutated, so callers must read the
    // property at call time. Anything destructuring it at import would freeze
    // the old value and silently keep pointing at 51000.
    const readBaseUrl = () => RUNTIME_CONFIG.API_BASE_URL;

    updateRuntimeConfig({ API_BASE_URL: 'http://localhost:51002' });

    expect(readBaseUrl()).toBe('http://localhost:51002');
  });

  it('leaves unrelated fields alone', () => {
    updateRuntimeConfig({ WS_TOKEN: 'token' });
    updateRuntimeConfig({ API_PORT: 51005 });

    expect(RUNTIME_CONFIG.WS_TOKEN).toBe('token');
  });
});
