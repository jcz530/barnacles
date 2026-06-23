# Linux Compatibility Audit

> Created: 2026-02-18
> Context: After adding Windows support in commit 916311a, an audit was done to identify remaining issues for Linux support.

## Background

The app was originally macOS-only. Windows support was added by:
- Creating `src/shared/utils/platform.ts` with cross-platform helpers (`isWindows`, `isMac`, `isLinux`, `commandExists`, `copyToClipboard`, `openInFileManager`, etc.)
- Adding Windows terminal/IDE definitions and detection
- Replacing bash build script with Node.js `scripts/build-production.mjs`
- Adding Windows to CI matrix
- Disabling CLI on Windows (symlink-based install doesn't apply)

The Windows commit also added some Linux groundwork (Linux terminal definitions, `xdg-open` for file manager, `isLinux` flag), but several areas still have macOS-only code paths that break or degrade on Linux.

## What Already Works on Linux

- Terminal detector service has `LINUX_TERMINALS` array (GNOME Terminal, Konsole, xterm, Alacritty, Kitty) with `openLinuxTerminal()` method in `src/backend/services/terminal-detector-service.ts`
- Font service (`src/backend/services/font-service.ts`) has Linux font directories (`/usr/share/fonts`, `~/.fonts`, `~/.local/share/fonts`)
- IDE detection uses `which` correctly on Linux via `commandExists()` in `src/shared/utils/platform.ts`
- Database path uses `~/.config/Barnacles` (XDG-compliant) in `src/backend/database/connection.ts`
- CLI install via `~/.local/bin` symlink works (`isCliSupported()` returns true on Linux)
- `electron-builder.yml` has Linux targets (AppImage, deb, rpm) for x64
- Window frame correctly enabled on Linux (`frame: !isMac` in window-manager.ts)
- Menu correctly omits macOS-specific items
- Tray popup positioning handles Linux correctly in `src/main/tray-popup-manager.ts`

## Issues Found

### Critical

**1. Hosts file write uses `osascript` on non-Windows (macOS-only)**

Files: `src/backend/routes/system.ts` (~line 317), `src/cli/commands/hosts.ts` (~line 305)

Both have this pattern:
```typescript
if (os.platform() === 'win32') {
  // Windows: uses PowerShell Start-Process with -Verb RunAs
} else {
  // Uses osascript (macOS-only) to prompt for admin password
  await execAsync(`osascript -e '...'`);
}
```

On Linux, `osascript` doesn't exist. Fix: add a Linux branch using `pkexec mv` (Polkit, available on most desktop Linux) with a `sudo mv` fallback.

### High

**2. PATH not fixed for packaged Linux apps**

File: `src/main/main.ts` (~line 133)

```typescript
if (process.platform === 'darwin') {
  const fullPath = execSync(`${shell} -ilc 'echo $PATH'`, ...);
  process.env.PATH = fullPath;
}
```

Linux Electron apps launched from desktop files / AppImage don't inherit the user's shell PATH either. Tools like `git`, `node`, `npm` won't be found. Fix: extend the condition to include `linux`.

**3. Clipboard uses only `xclip`, no Wayland or xsel fallback**

File: `src/shared/utils/platform.ts` (~line 61)

```typescript
return `printf '%s' "${escapedText}" | xclip -selection clipboard`;
```

Comment says "fall back to xsel" but code doesn't. Modern Ubuntu/Fedora default to Wayland where `xclip` may not work. Fix: check `WAYLAND_DISPLAY` env var and use `wl-copy` for Wayland, then fall back to `xclip || xsel`.

**4. CLI terminal detection ignores Linux terminals**

File: `src/cli/utils/terminal-detector.ts`

`detectCurrentTerminal()` only checks env vars for macOS terminals (iTerm2, Terminal.app, Warp, etc.). On Linux it always returns `null`. Missing checks:
- GNOME Terminal: `GNOME_TERMINAL_SCREEN` or `VTE_VERSION` env vars
- Konsole: `KONSOLE_VERSION` env var
- General: `$TERM_PROGRAM` env var

**5. `safeStorage` throws on Linux without keyring**

File: `src/backend/utils/key-manager.ts` (~line 20)

`safeStorage.isEncryptionAvailable()` requires `gnome-keyring`, `libsecret`, or `kwallet` on Linux. Without one, the app throws with no fallback. Fix: provide a degraded mode (warn user, skip encryption, or use a file-based fallback).

**6. Clipboard bridge uses macOS UTI for file URLs**

File: `src/main/ipc/clipboard-bridge.ts` (~line 9)

```typescript
clipboard.writeBuffer('public.file-url', Buffer.from(`file://${filePath}`));
```

`public.file-url` is a macOS Uniform Type Identifier. On Linux, use `text/uri-list`. This is a silent failure — no crash, just nothing copied.

### Medium

**7. Build script only creates `@libsql/darwin-x64` placeholder**

File: `scripts/build-production.mjs` (~line 143)

When building on/for Linux, needs `@libsql/linux-x64-gnu` placeholder too. Same issue in `.github/workflows/ci.yml` build-distributables job.

**8. CI doesn't build Linux distributables**

File: `.github/workflows/ci.yml` — `build-distributables` job matrix is `[macos-latest, windows-latest]`. Add `ubuntu-latest` to catch Linux build regressions.

**9. Release workflow has Linux commented out**

File: `.github/workflows/release.yml` (~line 20) — Linux matrix entry is commented out. Auto-updater has nothing to offer Linux users until this is enabled.

**10. Directory search doesn't exclude Linux system dirs**

File: `src/backend/routes/system.ts` (~line 167) — Excludes macOS dirs (`Library`, `System`, `Applications`, `Volumes`) but not Linux ones that would add noise when scanning from home: `snap`, `.cache`, etc. (Note: dotfiles are already excluded by the `startsWith('.')` check, so `.cache` is fine. But `snap` is not.)

**11. Tray icon uses macOS template image only**

File: `src/main/tray-manager.ts` — Only `tray-iconTemplate.png` exists. `setTemplateImage(true)` is a no-op on Linux but the monochrome icon may render poorly on some panel themes. Consider providing a colored variant for Linux.

### Low

**12. Tray popup vibrancy is macOS-only**

File: `src/main/tray-popup-manager.ts` (~line 133) — `vibrancy: 'menu'` is ignored on Linux. Combined with `transparent: true`, the popup might be invisible without a compositor. Could add a solid background fallback for Linux.

**13. TitleBar platform detection via user-agent**

File: `src/frontend/components/nav/molecules/TitleBar.vue` (~line 60) — Uses `navigator.userAgent.includes('mac')` instead of checking `process.platform` via preload bridge. Works currently but fragile.
