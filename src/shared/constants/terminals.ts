/**
 * Display names for the terminal ids produced by `detectCurrentTerminal()`.
 *
 * Lives in shared rather than beside the detector because the detector is CLI
 * code the renderer cannot import, and the MCP page has to render what the CLI
 * recorded.
 */
const TERMINAL_DISPLAY_NAMES: Record<string, string> = {
  iterm: 'iTerm2',
  terminal: 'Terminal',
  warp: 'Warp',
  hyper: 'Hyper',
  alacritty: 'Alacritty',
  kitty: 'Kitty',
  wezterm: 'WezTerm',
  ghostty: 'Ghostty',
  vscode: 'VS Code',
  cursor: 'Cursor',
  'gnome-terminal': 'GNOME Terminal',
  konsole: 'Konsole',
  xterm: 'xterm',
};

/**
 * Human-readable name for a recorded terminal id.
 *
 * Falls back to the id itself rather than "Unknown": the detector already lets
 * an unrecognized `TERM_PROGRAM` through lowercased, so a terminal missing from
 * the table above still carries a usable name. Discarding it would throw away
 * the only signal we have.
 */
export function terminalDisplayName(terminalId: string | null | undefined): string | null {
  if (!terminalId) return null;
  return TERMINAL_DISPLAY_NAMES[terminalId] ?? terminalId;
}
