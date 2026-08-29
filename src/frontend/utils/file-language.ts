/**
 * Shared language resolution for viewing and editing files.
 *
 * FileViewer renders with Shiki and FileEditor edits with CodeMirror. Both need to
 * answer "what language is this file?", and they must agree — otherwise a file
 * highlights one way in view mode and another in edit mode.
 */

import type { Extension } from '@codemirror/state';
import { StreamLanguage } from '@codemirror/language';
import { getFileTypeInfo } from './file-types';

/**
 * Languages loaded into the Shiki highlighter.
 *
 * Shiki throws when asked for a language it wasn't created with, and the caller
 * silently falls back to unhighlighted text. Keeping the list here next to the
 * lookup means a language in LANGUAGE_MAP that isn't loaded degrades predictably
 * to plaintext rather than throwing.
 */
export const SHIKI_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'html',
  'css',
  'json',
  'jsonc',
  'markdown',
  'bash',
  'yaml',
  'rust',
  'go',
  'java',
  'php',
  'ruby',
  'vue',
  'xml',
  'ini',
  'properties',
  'dockerfile',
  'makefile',
  'plaintext',
  // Previously absent, so these silently fell back to plain text.
  'c',
  'cpp',
  'csharp',
  'sql',
  'toml',
  'swift',
  'kotlin',
  'scala',
  'shell',
  'powershell',
  'graphql',
  'scss',
  'less',
  'svelte',
  'astro',
] as const;

const SHIKI_LANGUAGE_SET = new Set<string>(SHIKI_LANGUAGES);

/**
 * Languages Shiki has no grammar for, mapped to its nearest equivalent.
 * Without these, view mode falls back to unhighlighted text while edit mode
 * highlights -- the exact inconsistency this module exists to prevent.
 */
const SHIKI_ALIASES: Record<string, string> = {
  zsh: 'bash',
  fish: 'bash',
  shell: 'bash',
  sass: 'scss',
  'objective-c': 'plaintext',
  r: 'plaintext',
};

/**
 * Config files that carry no extension, or whose extension misidentifies them.
 * Keyed by exact filename.
 */
const CONFIG_FILE_LANGUAGES: Record<string, string> = {
  '.npmrc': 'ini',
  '.yarnrc': 'ini',
  '.bashrc': 'bash',
  '.bash_profile': 'bash',
  '.profile': 'bash',
  '.zshrc': 'bash',
  '.zshenv': 'bash',
  '.zprofile': 'bash',
  '.zlogin': 'bash',
  '.zlogout': 'bash',
  '.zsh_profile': 'bash',
  '.gitconfig': 'ini',
  '.gitignore_global': 'plaintext',
  '.editorconfig': 'ini',
  '.env': 'properties',
  '.prettierrc': 'json',
  '.eslintrc': 'json',
  '.curlrc': 'plaintext',
  '.wgetrc': 'plaintext',
  '.inputrc': 'plaintext',
  '.tmux.conf': 'bash',
  '.vimrc': 'plaintext',
  '.psqlrc': 'plaintext',
  '.gemrc': 'yaml',
  '.condarc': 'yaml',
  '.tool-versions': 'plaintext',
  '.netrc': 'plaintext',
  config: 'ini', // ~/.ssh/config, ~/.aws/config, ~/.docker/config
  '.terraformrc': 'plaintext',
  Dockerfile: 'dockerfile',
  Makefile: 'makefile',
  Rakefile: 'ruby',
  Gemfile: 'ruby',
  Podfile: 'ruby',
  '.dockerignore': 'plaintext',
  '.gitignore': 'plaintext',
  '.nvmrc': 'plaintext',
  'tsconfig.json': 'jsonc',
};

/** Extracts the filename from a path that may use either separator. */
function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

/** Extracts the extension, or undefined when the name has none. */
function extensionOf(filePath: string): string | undefined {
  const name = basename(filePath);
  // A leading dot marks a hidden file, not an extension: `.zshrc` has none.
  const withoutLeadingDot = name.startsWith('.') ? name.slice(1) : name;
  const parts = withoutLeadingDot.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : undefined;
}

/**
 * The canonical language id for a file, resolved from its name then its extension.
 */
export function resolveLanguageId(filePath: string | null | undefined): string {
  if (!filePath) return 'plaintext';

  const name = basename(filePath);
  if (CONFIG_FILE_LANGUAGES[name]) {
    return CONFIG_FILE_LANGUAGES[name];
  }

  return getFileTypeInfo(extensionOf(filePath)).language || 'plaintext';
}

/**
 * The language id to hand to Shiki, guaranteed to be one it was created with.
 */
export function resolveShikiLanguage(filePath: string | null | undefined): string {
  const lang = resolveLanguageId(filePath);
  const aliased = SHIKI_ALIASES[lang] ?? lang;
  return SHIKI_LANGUAGE_SET.has(aliased) ? aliased : 'plaintext';
}

/**
 * The CodeMirror extension for a file, loaded on demand.
 *
 * Language packages are dynamically imported so the editor's grammars stay out of
 * the initial bundle — most sessions never open the editor at all.
 */
export async function resolveCodeMirrorLanguage(
  filePath: string | null | undefined
): Promise<Extension | null> {
  const lang = resolveLanguageId(filePath);

  switch (lang) {
    case 'javascript':
      return (await import('@codemirror/lang-javascript')).javascript();
    case 'typescript':
      return (await import('@codemirror/lang-javascript')).javascript({ typescript: true });
    // PHP is grouped with HTML: legacy-modes ships no PHP mode, and HTML is the
    // closest fit given how PHP interleaves with markup.
    case 'vue':
    case 'svelte':
    case 'astro':
    case 'html':
    case 'php':
      return (await import('@codemirror/lang-html')).html();
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return (await import('@codemirror/lang-css')).css();
    case 'json':
    case 'jsonc':
      return (await import('@codemirror/lang-json')).json();
    case 'yaml':
      return (await import('@codemirror/lang-yaml')).yaml();
    case 'python':
      return (await import('@codemirror/lang-python')).python();
    case 'markdown':
      return (await import('@codemirror/lang-markdown')).markdown();
    case 'bash':
    case 'zsh':
    case 'fish':
    case 'shell': {
      const { shell } = await import('@codemirror/legacy-modes/mode/shell');
      return StreamLanguage.define(shell);
    }
    case 'toml': {
      const { toml } = await import('@codemirror/legacy-modes/mode/toml');
      return StreamLanguage.define(toml);
    }
    case 'ini':
    case 'properties': {
      const { properties } = await import('@codemirror/legacy-modes/mode/properties');
      return StreamLanguage.define(properties);
    }
    case 'dockerfile': {
      const { dockerFile } = await import('@codemirror/legacy-modes/mode/dockerfile');
      return StreamLanguage.define(dockerFile);
    }
    case 'ruby': {
      const { ruby } = await import('@codemirror/legacy-modes/mode/ruby');
      return StreamLanguage.define(ruby);
    }
    case 'xml': {
      const { xml } = await import('@codemirror/legacy-modes/mode/xml');
      return StreamLanguage.define(xml);
    }
    case 'swift': {
      const { swift } = await import('@codemirror/legacy-modes/mode/swift');
      return StreamLanguage.define(swift);
    }
    case 'powershell': {
      const { powerShell } = await import('@codemirror/legacy-modes/mode/powershell');
      return StreamLanguage.define(powerShell);
    }
    case 'sql': {
      const { standardSQL } = await import('@codemirror/legacy-modes/mode/sql');
      return StreamLanguage.define(standardSQL);
    }
    case 'go': {
      const { go } = await import('@codemirror/legacy-modes/mode/go');
      return StreamLanguage.define(go);
    }
    case 'rust': {
      const { rust } = await import('@codemirror/legacy-modes/mode/rust');
      return StreamLanguage.define(rust);
    }
    case 'java':
    case 'c':
    case 'cpp':
    case 'csharp':
    case 'scala':
    case 'kotlin': {
      const clike = await import('@codemirror/legacy-modes/mode/clike');
      const mode = {
        java: clike.java,
        c: clike.c,
        cpp: clike.cpp,
        csharp: clike.csharp,
        scala: clike.scala,
        kotlin: clike.kotlin,
      }[lang];
      return mode ? StreamLanguage.define(mode) : null;
    }
    default:
      // Plain text: line numbers and editing still work, just without colors.
      return null;
  }
}
