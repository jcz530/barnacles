import { describe, expect, it, vi } from 'vitest';

// The manager pulls in Electron at import time; none of it is needed to test
// the decision logic.
vi.mock('electron', () => ({
  app: { on: vi.fn(), isPackaged: false },
  BrowserWindow: { getAllWindows: () => [], getFocusedWindow: () => null },
  globalShortcut: { register: vi.fn(), unregister: vi.fn(), isRegistered: vi.fn() },
  screen: { getCursorScreenPoint: vi.fn(), getDisplayNearestPoint: vi.fn() },
}));

const { decideCtrlCAction, decideEscapeAction, decideToggleAction } =
  await import('./command-palette-manager');

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

  it('swallows a press that lands just after a blur-driven hide', () => {
    // Covers the ordering rule only. Whether lastHiddenAt is set at all is
    // decided by hideCommandPalette's viaBlur gating, which this pure function
    // never sees -- so this does not pin that half of the behaviour.
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

describe('decideEscapeAction', () => {
  it('closes the palette from the root', () => {
    expect(decideEscapeAction(0)).toBe('hide');
  });

  it('lets the renderer back out of an item’s actions', () => {
    // Escape reaches the main process first. Swallowing it at depth would close
    // the whole palette when the person meant to leave one level.
    expect(decideEscapeAction(1)).toBe('forward');
    expect(decideEscapeAction(3)).toBe('forward');
  });

  it('treats a nonsense depth as the root', () => {
    // Better to close than to make Escape do nothing at all.
    expect(decideEscapeAction(-1)).toBe('hide');
  });
});

describe('decideCtrlCAction', () => {
  it('closes on macOS, where Ctrl+C is not the copy shortcut', () => {
    // Cmd+C copies there, so the chord is free to mean what it means in a
    // shell: get me out of this.
    expect(decideCtrlCAction('darwin')).toBe('hide');
  });

  it('leaves the decision to the renderer elsewhere', () => {
    // Windows and Linux copy with Ctrl+C in a text field. Only the renderer
    // can see whether anything is selected, so it decides there.
    expect(decideCtrlCAction('win32')).toBe('forward');
    expect(decideCtrlCAction('linux')).toBe('forward');
  });
});
