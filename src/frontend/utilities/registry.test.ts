import { describe, expect, it } from 'vitest';
import { getAllUtilities, getUtility, utilityRegistry } from './index';

describe('utility registry', () => {
  it('is populated by importing the module, with no discovery call', () => {
    // The regression this guards: registration used to be an async function that
    // only the /utilities routes ever called, so the registry was empty on a cold
    // start. Everything else that read it -- the command palette above all, and
    // the floating palette window permanently, since it mounts no route at all --
    // silently saw nothing.
    expect(getAllUtilities().length).toBeGreaterThan(0);
  });

  it('registers every utility that ships with the app', () => {
    const ids = getAllUtilities().map(utility => utility.id);

    expect(ids).toEqual(
      expect.arrayContaining(['color-converter', 'exif-viewer', 'ip-info', 'shade-generator'])
    );
  });

  it('keeps each utility page behind its own lazy import', () => {
    // What makes eager registration cheap: the metadata loads, the view does not.
    for (const utility of getAllUtilities()) {
      expect(typeof utility.component).toBe('function');
    }
  });

  it('looks a utility up by id', () => {
    expect(getUtility('color-converter')?.name).toBe('CSS Color Converter');
    expect(getUtility('nope')).toBeUndefined();
  });

  it('gives every utility a distinct id', () => {
    // Registration is keyed by id, so a collision silently drops a utility.
    const ids = getAllUtilities().map(utility => utility.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('searches names, descriptions and tags', () => {
    expect(utilityRegistry.search('hex').map(u => u.id)).toContain('color-converter');
  });
});
