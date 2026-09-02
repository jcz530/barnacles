import { terminalDisplayName } from '../../shared/constants/terminals.js';

/**
 * Detects which terminal the CLI is currently running in
 * by checking environment variables
 */
export function detectCurrentTerminal(): string | null {
  // Check various environment variables that terminals set
  const termProgram = process.env.TERM_PROGRAM;
  const terminalEmulator = process.env.TERMINAL_EMULATOR;
  const lcterminal = process.env.LC_TERMINAL;

  // iTerm2
  if (termProgram === 'iTerm.app' || lcterminal === 'iTerm2') {
    return 'iterm';
  }

  // macOS Terminal.app
  if (termProgram === 'Apple_Terminal') {
    return 'terminal';
  }

  // Warp
  if (termProgram === 'WarpTerminal') {
    return 'warp';
  }

  // Hyper
  if (terminalEmulator === 'Hyper') {
    return 'hyper';
  }

  // Alacritty
  if (process.env.ALACRITTY_SOCKET || process.env.ALACRITTY_LOG) {
    return 'alacritty';
  }

  // Kitty
  if (process.env.KITTY_WINDOW_ID) {
    return 'kitty';
  }

  // WezTerm
  if (process.env.WEZTERM_EXECUTABLE) {
    return 'wezterm';
  }

  // GNOME Terminal
  if (process.env.GNOME_TERMINAL_SCREEN || process.env.VTE_VERSION) {
    return 'gnome-terminal';
  }

  // Konsole
  if (process.env.KONSOLE_VERSION) {
    return 'konsole';
  }

  // Generic TERM_PROGRAM fallback (covers many terminals)
  if (termProgram) {
    return termProgram.toLowerCase();
  }

  // Could not detect
  return null;
}

/**
 * Gets a human-readable name for the detected terminal.
 *
 * Names live in shared/ because the renderer displays the same ids and cannot
 * import CLI code; keeping a second table here meant a newly supported terminal
 * landed in one map and not the other.
 */
export function getTerminalName(terminalId: string | null): string {
  return terminalDisplayName(terminalId) ?? 'Unknown Terminal';
}
