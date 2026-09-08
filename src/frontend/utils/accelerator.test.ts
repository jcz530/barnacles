import { describe, expect, it } from 'vitest';
import {
  eventToAccelerator,
  formatAccelerator,
  isRiskyAccelerator,
  normalizeKey,
  type ShortcutKeyEvent,
} from './accelerator';

const keyEvent = (
  code: string,
  modifiers: Partial<Omit<ShortcutKeyEvent, 'code'>> = {}
): ShortcutKeyEvent => ({
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});

describe('normalizeKey', () => {
  it('maps letter and digit codes to their bare character', () => {
    expect(normalizeKey('KeyP')).toBe('P');
    expect(normalizeKey('Digit7')).toBe('7');
  });

  it('maps function keys through unchanged', () => {
    expect(normalizeKey('F5')).toBe('F5');
    expect(normalizeKey('F24')).toBe('F24');
  });

  it('renames keys Electron spells differently', () => {
    expect(normalizeKey('ArrowUp')).toBe('Up');
    expect(normalizeKey('Enter')).toBe('Return');
    expect(normalizeKey('Comma')).toBe(',');
    expect(normalizeKey('Backslash')).toBe('\\');
  });

  it('rejects modifiers pressed on their own', () => {
    expect(normalizeKey('ShiftLeft')).toBeNull();
    expect(normalizeKey('MetaRight')).toBeNull();
    expect(normalizeKey('CapsLock')).toBeNull();
  });

  it('rejects codes with no accelerator equivalent', () => {
    expect(normalizeKey('F25')).toBeNull();
    expect(normalizeKey('MediaPlayPause')).toBeNull();
  });
});

describe('eventToAccelerator', () => {
  it('builds a combo from modifiers and a key', () => {
    expect(eventToAccelerator(keyEvent('KeyP', { metaKey: true, shiftKey: true }))).toBe(
      'CommandOrControl+Shift+P'
    );
  });

  it('collapses Meta and Control to one portable token', () => {
    expect(eventToAccelerator(keyEvent('KeyK', { metaKey: true }))).toBe('CommandOrControl+K');
    expect(eventToAccelerator(keyEvent('KeyK', { ctrlKey: true }))).toBe('CommandOrControl+K');
  });

  it('reads the physical key, not the composed character', () => {
    // Alt+P on macOS reports key "π", which Electron cannot parse. Reading
    // event.code instead keeps the physical key resolving to P.
    const event = keyEvent('KeyP', { altKey: true, metaKey: true });
    expect(eventToAccelerator(event)).toBe('CommandOrControl+Alt+P');
  });

  it('orders modifiers consistently regardless of press order', () => {
    const event = keyEvent('Space', { shiftKey: true, altKey: true, ctrlKey: true });
    expect(eventToAccelerator(event)).toBe('CommandOrControl+Alt+Shift+Space');
  });

  it('rejects a key with no modifier', () => {
    // A bare letter registered globally would swallow that key everywhere else.
    expect(eventToAccelerator(keyEvent('KeyP'))).toBeNull();
  });

  it('rejects a modifier pressed alone', () => {
    expect(eventToAccelerator(keyEvent('ShiftLeft', { shiftKey: true }))).toBeNull();
  });

  it('rejects an unmappable key even with modifiers', () => {
    expect(eventToAccelerator(keyEvent('MediaPlayPause', { metaKey: true }))).toBeNull();
  });
});

describe('formatAccelerator', () => {
  it('renders macOS glyphs with no separators', () => {
    expect(formatAccelerator('CommandOrControl+Shift+P', true)).toBe('⌘⇧P');
  });

  it('renders words joined by plus elsewhere', () => {
    expect(formatAccelerator('CommandOrControl+Shift+P', false)).toBe('Ctrl+Shift+P');
  });

  it('renders an empty accelerator as empty', () => {
    expect(formatAccelerator('', true)).toBe('');
  });
});

describe('isRiskyAccelerator', () => {
  it('flags combos the OS or common apps already own', () => {
    expect(isRiskyAccelerator('CommandOrControl+Space')).toBe(true);
    expect(isRiskyAccelerator('CommandOrControl+Q')).toBe(true);
  });

  it('leaves an unclaimed combo alone', () => {
    expect(isRiskyAccelerator('CommandOrControl+Shift+P')).toBe(false);
  });
});
