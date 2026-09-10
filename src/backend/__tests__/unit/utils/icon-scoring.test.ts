import { describe, expect, it } from 'vitest';
import {
  compareCandidates,
  type IconCandidate,
  rankCandidates,
  scoreCandidate,
} from '@backend/utils/icon-finder/scoring';

/**
 * These assertions pin the *relative* orderings the weight tables are meant to
 * produce. The individual numbers in definitions.ts are judgement calls and may
 * be retuned; a retune that inverts one of these rankings changes which icon a
 * project displays, so it should fail here rather than pass silently.
 */
describe('icon scoring', () => {
  const wins = (winner: IconCandidate, loser: IconCandidate) =>
    expect(compareCandidates(winner, loser)).toBeLessThan(0);

  describe('format preference', () => {
    it('prefers a scalable svg to a raster of the same name', () => {
      wins(
        scoreCandidate('public/favicon.svg', 'convention'),
        scoreCandidate('public/favicon.png', 'convention')
      );
    });

    it('prefers png to ico, which is often only 16x16', () => {
      wins(
        scoreCandidate('public/favicon.png', 'convention'),
        scoreCandidate('public/favicon.ico', 'convention')
      );
    });

    it('prefers a declared png to an svg we merely guessed at', () => {
      // Format is a tiebreak, never a trump: what a project declares about
      // itself outranks a filename we recognized. In practice the projects
      // that ship both declare both, so the svg still wins within its tier.
      wins(
        scoreCandidate('public/favicon/favicon-96x96.png', 'webmanifest'),
        scoreCandidate('public/favicon/favicon.svg', 'convention')
      );
    });

    it('prefers the svg when both are declared together', () => {
      wins(
        scoreCandidate('public/favicon/favicon.svg', 'html-link'),
        scoreCandidate('public/favicon/favicon-96x96.png', 'html-link')
      );
    });
  });

  describe('name preference', () => {
    it('prefers favicon to apple-touch-icon at the same format', () => {
      wins(
        scoreCandidate('public/favicon.png', 'convention'),
        scoreCandidate('public/apple-touch-icon.png', 'convention')
      );
    });

    it('prefers a plain logo to a logo variant', () => {
      wins(
        scoreCandidate('public/logo.png', 'convention'),
        scoreCandidate('public/logo-dark.png', 'convention')
      );
    });

    it('prefers favicon.ico to a logo variant png', () => {
      wins(
        scoreCandidate('public/favicon.ico', 'convention'),
        scoreCandidate('public/logo-dark.png', 'convention')
      );
    });
  });

  describe('source preference', () => {
    it('prefers a declared icon to a conventional one', () => {
      wins(
        scoreCandidate('assets/icons/app.png', 'electron-builder'),
        scoreCandidate('public/favicon.png', 'convention')
      );
    });

    it('prefers a conventional icon to one found by walking', () => {
      wins(
        scoreCandidate('public/icon.png', 'convention'),
        scoreCandidate('public/icon.png', 'glob')
      );
    });
  });

  describe('penalties', () => {
    it('ranks build output below the source it was built from', () => {
      wins(
        scoreCandidate('frontend/public/favicon/favicon.svg', 'convention', 1),
        scoreCandidate('public/spa/favicon/favicon.svg', 'convention')
      );
    });

    it('keeps a built svg from outranking a source png', () => {
      // The build penalty has to exceed the whole format spread, or a stale
      // compiled copy would win purely on being an svg.
      wins(
        scoreCandidate('public/favicon.png', 'convention'),
        scoreCandidate('dist/favicon.svg', 'convention')
      );
    });

    it('rejects macOS template images, which render as a black blob', () => {
      wins(
        scoreCandidate('assets/icons/app.png', 'convention'),
        scoreCandidate('src/main/assets/tray-iconTemplate.png', 'convention')
      );
    });

    it('ranks a docs sub-app below the primary app', () => {
      wins(
        scoreCandidate('frontend/public/favicon.svg', 'convention', 1),
        scoreCandidate('docs-site/public/favicon.svg', 'convention', 1)
      );
    });

    it("keeps a nested svg from outranking the root app's png", () => {
      // Format is the weakest signal: a sub-app shipping an svg must not
      // displace the icon the project itself declares at its root.
      wins(
        scoreCandidate('public/favicon.png', 'convention', 0),
        scoreCandidate('frontend/public/favicon.svg', 'convention', 1)
      );
    });

    it("keeps a docs sub-app svg from outranking the root app's png", () => {
      wins(
        scoreCandidate('public/favicon.png', 'convention', 0),
        scoreCandidate('docs-site/public/favicon.svg', 'convention', 1)
      );
    });

    it('denies build output the location bonuses of a served directory', () => {
      // `public/spa/favicon/` reads like a served icon dir by name; without
      // stripping those bonuses a compiled copy recovers most of its penalty.
      wins(
        scoreCandidate('assets/favicon.png', 'convention'),
        scoreCandidate('public/spa/favicon.svg', 'convention')
      );
      wins(
        scoreCandidate('src/assets/icon.png', 'convention'),
        scoreCandidate('public/spa/favicon/favicon.svg', 'convention')
      );
    });

    it('ranks every monochrome mask below real artwork', () => {
      // These are recognized by NAME_RULES so they can be scored and rejected
      // here, rather than being invisible to the model entirely.
      for (const mask of [
        'public/safari-pinned-tab.svg',
        'assets/iconTemplate.png',
        'assets/icon-symbolic.svg',
        'public/favicon-mono.png',
      ]) {
        wins(
          scoreCandidate('public/favicon.png', 'convention'),
          scoreCandidate(mask, 'convention')
        );
      }
    });

    it('ranks a nested app below the project root', () => {
      wins(
        scoreCandidate('public/favicon.svg', 'convention', 0),
        scoreCandidate('frontend/public/favicon.svg', 'convention', 1)
      );
    });
  });

  describe('comparator totality', () => {
    const paths = [
      'public/favicon.svg',
      'public/favicon.png',
      'public/logo.svg',
      'assets/icons/app.png',
      'dist/favicon.svg',
      'frontend/public/favicon.ico',
      'apple-touch-icon.png',
    ];

    it('is antisymmetric', () => {
      const candidates = paths.map(p => scoreCandidate(p, 'convention'));
      for (const a of candidates) {
        for (const b of candidates) {
          // `|| 0` normalises the -0 that negating a zero sign produces.
          expect(Math.sign(compareCandidates(a, b))).toBe(-Math.sign(compareCandidates(b, a)) || 0);
        }
      }
    });

    it('orders identically regardless of input order', () => {
      // Guards the property the whole design rests on: the winner must not
      // depend on fs.readdir order, which is not stable across filesystems.
      const forward = rankCandidates(paths.map(p => scoreCandidate(p, 'convention')));
      const reversed = rankCandidates(
        [...paths].reverse().map(p => scoreCandidate(p, 'convention'))
      );
      expect(reversed.map(c => c.path)).toEqual(forward.map(c => c.path));
    });

    it('breaks a genuine score tie deterministically', () => {
      const a = scoreCandidate('public/aaa.png', 'convention');
      const b = scoreCandidate('public/bbb.png', 'convention');
      expect(a.score).toBe(b.score);
      expect(compareCandidates(a, b)).toBeLessThan(0);
    });
  });

  describe('rankCandidates', () => {
    it('collapses duplicate paths, keeping the best score', () => {
      const ranked = rankCandidates([
        scoreCandidate('public/favicon.svg', 'glob'),
        scoreCandidate('public/favicon.svg', 'electron-builder'),
      ]);

      expect(ranked).toHaveLength(1);
      expect(ranked[0].source).toBe('electron-builder');
    });
  });
});
