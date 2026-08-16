import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SHOTS, outputFileName } from '../../../../../screenshots/manifest.mjs';
import { DEMO_PROJECTS } from '@shared/database/demo/data/projects';

/**
 * Guards the manifest against drifting from the app it documents — the most
 * likely long-term breakage, since routes and demo ids change in other files.
 */
describe('screenshot manifest', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const routerSource = readFileSync(path.join(repoRoot, 'src/frontend/router/index.ts'), 'utf-8');

  it('gives every shot a unique name', () => {
    const names = SHOTS.map(s => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('produces a distinct output filename per shot', () => {
    const files = SHOTS.filter(s => !s.manual).map(s => outputFileName(s));
    expect(new Set(files).size).toBe(files.length);
    for (const file of files) {
      expect(file.endsWith('.png')).toBe(true);
    }
  });

  it('gives every shot the copy the publish step needs', () => {
    for (const shot of SHOTS) {
      expect(shot.title, `${shot.name} needs a title`).toBeTruthy();
      expect(shot.description, `${shot.name} needs a description`).toBeTruthy();
      expect(shot.alt, `${shot.name} needs alt text`).toBeTruthy();
      expect(shot.targets, `${shot.name} needs targets`).toBeDefined();
    }
  });

  it('references only routes that exist in the router', () => {
    // Reduce each route to its first static segment and confirm the router
    // declares it, so a renamed or removed page fails here rather than
    // producing a blank screenshot.
    const staticSegments = SHOTS.filter(s => !s.manual)
      .map(s => s.route.split('/').filter(Boolean)[0])
      .filter(Boolean);

    for (const segment of new Set(staticSegments)) {
      expect(routerSource, `router has no '${segment}' route`).toContain(`/${segment}`);
    }
  });

  it('points project routes at a demo project that exists', () => {
    const demoIds = new Set(DEMO_PROJECTS.map(p => p.id));

    for (const shot of SHOTS) {
      const match = shot.route.match(/^\/projects\/([^/]+)/);
      if (!match) continue;
      expect(demoIds, `${shot.name} references unknown demo project`).toContain(match[1]);
    }
  });

  it('keeps marketing targets pointed at real AppShowcase steps', () => {
    // The marketing repo is a sibling checkout and may be absent; skip rather
    // than fail when it is not present.
    const showcasePath = path.resolve(
      repoRoot,
      '../barnacles-marketing/app/components/organisms/AppShowcase.vue'
    );

    let showcase: string;
    try {
      showcase = readFileSync(showcasePath, 'utf-8');
    } catch {
      return;
    }

    for (const shot of SHOTS) {
      const target = shot.targets.marketing;
      if (!target || target.stepId === 'new') continue;
      expect(showcase, `AppShowcase has no step id ${target.stepId}`).toContain(
        `id: ${target.stepId}`
      );
    }
  });

  it('does not capture pages that expose the real machine', () => {
    // /configs renders the home directory and /hosts renders /etc/hosts, so
    // neither can be published. This asserts the exclusion stays in place.
    const routes = SHOTS.map(s => s.route);
    expect(routes).not.toContain('/configs');
    expect(routes).not.toContain('/hosts');
  });
});
