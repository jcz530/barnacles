/**
 * Translation between browser keyboard events and Electron accelerator strings.
 *
 * https://www.electronjs.org/docs/latest/api/accelerator
 */

/**
 * The parts of a keyboard event this module reads.
 *
 * Structural rather than the DOM's KeyboardEvent so the logic stays testable
 * from the node environment the test project runs in, which has no DOM lib.
 */
export interface ShortcutKeyEvent {
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/** Keys that only ever modify another key, never commit a shortcut on their own. */
const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'CapsLock',
]);

/** KeyboardEvent.code values Electron accepts, where the name differs. */
const SPECIAL_KEYS: Record<string, string> = {
  Space: 'Space',
  Enter: 'Return',
  NumpadEnter: 'Return',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Escape: 'Escape',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
};

/**
 * The key portion of an accelerator, from `event.code`.
 *
 * Deliberately not `event.key`: with Alt held on macOS that reports the
 * composed character (Alt+P gives "π"), which Electron cannot parse. `code`
 * describes the physical key and is unaffected by modifiers.
 */
export const normalizeKey = (code: string): string | null => {
  if (MODIFIER_CODES.has(code)) return null;

  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `num${code.slice(6)}`;
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;

  return SPECIAL_KEYS[code] ?? null;
};

/**
 * Build an Electron accelerator from a keydown, or null when the combination
 * isn't usable as a global shortcut.
 *
 * Rejects modifier-only presses and unmodified keys: a bare letter registered
 * system-wide would swallow that key in every other application.
 */
export const eventToAccelerator = (event: ShortcutKeyEvent): string | null => {
  const key = normalizeKey(event.code);
  if (!key) return null;

  const parts: string[] = [];

  // CommandOrControl resolves to Command on macOS and Control elsewhere, so one
  // stored value works on every platform.
  if (event.metaKey || event.ctrlKey) parts.push('CommandOrControl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');

  if (parts.length === 0) return null;

  parts.push(key);
  return parts.join('+');
};

/** Symbols macOS uses for modifiers in menus. */
const MAC_SYMBOLS: Record<string, string> = {
  CommandOrControl: '⌘',
  Command: '⌘',
  Control: '⌃',
  Alt: '⌥',
  Shift: '⇧',
};

/**
 * Glyphs for the non-modifier keys that have one.
 *
 * Shared by both platforms: an arrow or a return glyph reads the same
 * everywhere, unlike the modifiers, which macOS alone writes as symbols. Keys
 * without a conventional glyph keep their name.
 */
const KEY_SYMBOLS: Record<string, string> = {
  Return: '↩',
  Tab: '⇥',
  Escape: '⎋',
  Backspace: '⌫',
  Delete: '⌦',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
  Space: '␣',
};

const NON_MAC_LABELS: Record<string, string> = {
  CommandOrControl: 'Ctrl',
  Command: 'Win',
  Alt: 'Alt',
  Shift: 'Shift',
};

/**
 * Render an accelerator the way the platform writes shortcuts: glyphs run
 * together on macOS, words joined by "+" elsewhere.
 */
export const formatAccelerator = (accelerator: string, isMac: boolean): string => {
  if (!accelerator) return '';

  const parts = accelerator.split('+');

  if (isMac) {
    return parts.map(part => MAC_SYMBOLS[part] ?? KEY_SYMBOLS[part] ?? part).join('');
  }

  return parts.map(part => NON_MAC_LABELS[part] ?? KEY_SYMBOLS[part] ?? part).join('+');
};

/** Combos the OS or common apps already own; worth warning about, not blocking. */
const RISKY_ACCELERATORS = new Set([
  'CommandOrControl+Space',
  'CommandOrControl+Tab',
  'CommandOrControl+Q',
  'CommandOrControl+W',
  'CommandOrControl+C',
  'CommandOrControl+V',
]);

export const isRiskyAccelerator = (accelerator: string): boolean =>
  RISKY_ACCELERATORS.has(accelerator);
