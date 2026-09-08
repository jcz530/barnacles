import { describe, expect, it, vi } from 'vitest';

// The manager pulls in Electron at import time; none of it is needed to test
// the decision logic.
vi.mock('electron', () => ({
  app: { on: vi.fn(), isPackaged: false },
  BrowserWindow: { getAllWindows: () => [], getFocusedWindow: () => null },
  globalShortcut: { register: vi.fn(), unregister: vi.fn(), isRegistered: vi.fn() },
  screen: { getCursorScreenPoint: vi.fn(), getDisplayNearestPoint: vi.fn() },
}));

const { decideToggleAction } = await import('./command-palette-manager');

/** Comfortably outside the dismiss grace window. */
const LONG_AGO = 10_000;

describe('decideToggleAction', () => {
  it('closes the palette when it is open', () => {
    expect(
      decideToggleAction({
        paletteVisible: true,
        msSinceBlurHide: 0,
        appActive: false,
        hasMainWindow: true,
      })
    ).toBe('hide');
  });

  it('swallows the press that dismissed the palette', () => {
    // Pressing the shortcut while the palette has focus blurs it, and the blur
    // handler hides it before the shortcut callback runs. The palette therefore
    // looks closed by now -- without this the press would fall through and
    // summon the app, which is what it used to do.
    expect(
      decideToggleAction({
        paletteVisible: false,
        msSinceBlurHide: 5,
        appActive: true,
        hasMainWindow: true,
      })
    ).toBe('ignore');
  });

  it('reopens once the grace window has passed', () => {
    // Clicking away to another app also blurs the palette. That press comes far
    // later than the sub-millisecond race above, so it must still open.
    expect(
      decideToggleAction({
        paletteVisible: false,
        msSinceBlurHide: LONG_AGO,
        appActive: false,
        hasMainWindow: true,
      })
    ).toBe('show');
  });

  it('opens the in-app palette when Barnacles is frontmost', () => {
    expect(
      decideToggleAction({
        paletteVisible: false,
        msSinceBlurHide: LONG_AGO,
        appActive: true,
        hasMainWindow: true,
      })
    ).toBe('in-app');
  });

  it('floats the palette when another app is in front', () => {
    expect(
      decideToggleAction({
        paletteVisible: false,
        msSinceBlurHide: LONG_AGO,
        appActive: false,
        hasMainWindow: true,
      })
    ).toBe('show');
  });

  it('floats the palette when the app is active but every window is closed', () => {
    expect(
      decideToggleAction({
        paletteVisible: false,
        msSinceBlurHide: LONG_AGO,
        appActive: true,
        hasMainWindow: false,
      })
    ).toBe('show');
  });

  it('closes an open palette even inside the grace window', () => {
    // Visibility is checked first: an actually-open palette always closes.
    expect(
      decideToggleAction({
        paletteVisible: true,
        msSinceBlurHide: 1,
        appActive: true,
        hasMainWindow: true,
      })
    ).toBe('hide');
  });
});
