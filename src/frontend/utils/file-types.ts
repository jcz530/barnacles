import type { LucideIcon } from 'lucide-vue-next';
import {
  FileText,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileJson,
  File,
  Folder,
  FolderOpen,
} from 'lucide-vue-next';

export type FileCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'code'
  | 'data'
  | 'archive'
  | 'other';

export interface FileTypeInfo {
  category: FileCategory;
  icon: LucideIcon;
  canPreview: boolean;
  language?: string; // For syntax highlighting
}

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'svg',
  'webp',
  'bmp',
  'ico',
  'tiff',
  'heic',
]);

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v']);

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus']);

const DOCUMENT_EXTENSIONS = new Set(['md', 'markdown', 'txt', 'pdf', 'doc', 'docx', 'rtf', 'odt']);

const ARCHIVE_EXTENSIONS = new Set(['zip', 'tar', 'gz', 'bz2', 'rar', '7z', 'xz', 'tgz']);

const DATA_EXTENSIONS = new Set(['json', 'xml', 'yaml', 'yml', 'toml', 'csv', 'sql']);

// Map file extensions to programming languages for syntax highlighting
const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  php: 'php',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  cs: 'csharp',
  go: 'go',
  rs: 'rust',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sh: 'bash',
  bash: 'bash',
  zsh: 'zsh',
  fish: 'fish',
  ps1: 'powershell',
  r: 'r',
  m: 'objective-c',
  sql: 'sql',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  json: 'json',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  markdown: 'markdown',
  vue: 'vue',
  svelte: 'svelte',
  astro: 'astro',
  dockerfile: 'dockerfile',
  graphql: 'graphql',
  gql: 'graphql',
};

/**
 * Get file type information based on file extension
 */
export function getFileTypeInfo(extension?: string): FileTypeInfo {
  if (!extension) {
    return {
      category: 'other',
      icon: File,
      canPreview: false,
    };
  }

  const ext = extension.toLowerCase();

  if (IMAGE_EXTENSIONS.has(ext)) {
    return {
      category: 'image',
      icon: FileImage,
      canPreview: true,
    };
  }

  if (VIDEO_EXTENSIONS.has(ext)) {
    return {
      category: 'video',
      icon: FileVideo,
      canPreview: false,
    };
  }

  if (AUDIO_EXTENSIONS.has(ext)) {
    return {
      category: 'audio',
      icon: FileAudio,
      canPreview: false,
    };
  }

  if (DOCUMENT_EXTENSIONS.has(ext)) {
    return {
      category: 'document',
      icon: FileText,
      canPreview: ext === 'md' || ext === 'markdown' || ext === 'txt',
      language: LANGUAGE_MAP[ext],
    };
  }

  if (DATA_EXTENSIONS.has(ext)) {
    return {
      category: 'data',
      icon: ext === 'json' ? FileJson : FileCode,
      canPreview: true,
      language: LANGUAGE_MAP[ext],
    };
  }

  if (ARCHIVE_EXTENSIONS.has(ext)) {
    return {
      category: 'archive',
      icon: FileArchive,
      canPreview: false,
    };
  }

  // Check if it's a code file
  if (LANGUAGE_MAP[ext]) {
    return {
      category: 'code',
      icon: FileCode,
      canPreview: true,
      language: LANGUAGE_MAP[ext],
    };
  }

  return {
    category: 'other',
    icon: File,
    canPreview: false,
  };
}

/**
 * Get folder icon
 */
export function getFolderIcon(isOpen: boolean): LucideIcon {
  return isOpen ? FolderOpen : Folder;
}

/**
 * Check if a file matches a category filter
 */
export function matchesCategory(extension: string | undefined, category: FileCategory): boolean {
  const info = getFileTypeInfo(extension);
  return info.category === category;
}

/**
 * Get all available file categories for filtering
 */
export function getFileCategories(): Array<{ value: FileCategory; label: string }> {
  return [
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Videos' },
    { value: 'audio', label: 'Audio' },
    { value: 'document', label: 'Documents' },
    { value: 'code', label: 'Code' },
    { value: 'data', label: 'Data Files' },
    { value: 'archive', label: 'Archives' },
  ];
}

/**
 * Get extensions for a specific category
 */
export function getExtensionsByCategory(category: FileCategory): string[] {
  switch (category) {
    case 'image':
      return Array.from(IMAGE_EXTENSIONS).sort();
    case 'video':
      return Array.from(VIDEO_EXTENSIONS).sort();
    case 'audio':
      return Array.from(AUDIO_EXTENSIONS).sort();
    case 'document':
      return Array.from(DOCUMENT_EXTENSIONS).sort();
    case 'data':
      return Array.from(DATA_EXTENSIONS).sort();
    case 'archive':
      return Array.from(ARCHIVE_EXTENSIONS).sort();
    case 'code':
      return Object.keys(LANGUAGE_MAP)
        .filter(ext => {
          const info = getFileTypeInfo(ext);
          return info.category === 'code';
        })
        .sort();
    default:
      return [];
  }
}

/**
 * Format file size to human readable format
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
