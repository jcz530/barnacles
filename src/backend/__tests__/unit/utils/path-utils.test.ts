import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { collapseTilde, expandTilde } from '@backend/utils/path-utils';

describe('path-utils', () => {
  const home = os.homedir();

  describe('expandTilde', () => {
    it('expands a bare tilde to the home directory', () => {
      expect(expandTilde('~')).toBe(home);
    });

    it('expands a tilde-prefixed path', () => {
      expect(expandTilde('~/clients')).toBe(path.join(home, 'clients'));
    });

    it('expands a backslash-separated tilde path', () => {
      // Windows callers hand over `~\projects`; stored values always use `~/`,
      // so both forms have to resolve.
      expect(expandTilde('~\\clients')).toBe(path.join(home, 'clients'));
    });

    it('leaves an absolute path alone', () => {
      expect(expandTilde('/opt/code')).toBe('/opt/code');
    });

    it('does not expand a tilde in the middle of a path', () => {
      expect(expandTilde('/opt/~/code')).toBe('/opt/~/code');
    });
  });

  describe('collapseTilde', () => {
    it('collapses the home directory itself', () => {
      expect(collapseTilde(home)).toBe('~');
    });

    it('collapses a path under home', () => {
      expect(collapseTilde(path.join(home, 'clients'))).toBe('~/clients');
    });

    it('emits forward slashes regardless of platform separator', () => {
      // The value is stored and later read by expandTilde, which keys off `~/`.
      // Emitting the native separator would make Windows entries unresolvable.
      expect(collapseTilde(path.join(home, 'clients', 'acme'))).toBe('~/clients/acme');
    });

    it('leaves a path outside home alone', () => {
      expect(collapseTilde('/opt/code')).toBe('/opt/code');
    });

    it('does not collapse a sibling with a shared prefix', () => {
      expect(collapseTilde(`${home}-backup/code`)).toBe(`${home}-backup/code`);
    });

    it('round-trips through expandTilde', () => {
      const original = path.join(home, 'clients', 'acme');

      expect(expandTilde(collapseTilde(original))).toBe(original);
    });
  });
});
