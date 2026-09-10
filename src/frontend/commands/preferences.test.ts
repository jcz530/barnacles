import { describe, expect, it } from 'vitest';
import { resolvePreferred } from './preferences';

const tool = (id: string, name = id) => ({ id, name });

const installed = [tool('cursor', 'Cursor'), tool('vscode', 'VS Code')];

describe('resolvePreferred', () => {
  it('prefers the project’s own choice over the global default', () => {
    expect(resolvePreferred(installed, 'cursor', 'vscode')?.id).toBe('cursor');
  });

  it('falls back to the global default when the project has no preference', () => {
    expect(resolvePreferred(installed, null, 'vscode')?.id).toBe('vscode');
  });

  it('falls through when the project prefers something no longer installed', () => {
    // Uninstalling an editor should not break every project that named it.
    expect(resolvePreferred(installed, 'sublime', 'vscode')?.id).toBe('vscode');
  });

  it('returns null when neither preference resolves', () => {
    // Meaningful rather than an error: the caller should ask instead of guess.
    expect(resolvePreferred(installed, null, null)).toBeNull();
    expect(resolvePreferred(installed, 'sublime', 'atom')).toBeNull();
  });

  it('returns null when nothing is installed at all', () => {
    expect(resolvePreferred([], 'cursor', 'vscode')).toBeNull();
  });
});
