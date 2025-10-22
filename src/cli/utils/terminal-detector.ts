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

  // Could not detect
  return null;
}

/**
 * Gets a human-readable name for the detected terminal
 */
export function getTerminalName(terminalId: string | null): string {
  const names: Record<string, string> = {
    iterm: 'iTerm2',
    terminal: 'Terminal',
    warp: 'Warp',
    hyper: 'Hyper',
    alacritty: 'Alacritty',
    kitty: 'Kitty',
    wezterm: 'WezTerm',
  };

  return terminalId ? names[terminalId] || 'Unknown Terminal' : 'Unknown Terminal';
}
