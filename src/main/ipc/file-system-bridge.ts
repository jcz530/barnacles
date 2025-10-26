import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, statSync } from 'fs';

// Directories and files to exclude from the tree
const EXCLUDED_DIRS = new Set([
  '.DS_Store',
  '.cache',
  '.data',
  '.git',
  '.idea',
  '.next',
  '.nuxt',
  '.run',
  '.vscode',
  '.wrangler',
  'Thumbs.db',
  '__pycache__',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'vendor',
]);

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
  extension?: string;
}

export interface SearchResult {
  filePath: string;
  fileName: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

/**
 * Recursively read a directory and build a tree structure
 */
async function readDirectoryTree(dirPath: string, relativeTo: string): Promise<FileNode[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      // Skip excluded directories and files
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(relativeTo, fullPath);

      if (entry.isDirectory()) {
        // Recursively read subdirectories
        const children = await readDirectoryTree(fullPath, relativeTo);
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children,
        });
      } else if (entry.isFile()) {
        // Get file stats for size
        const stats = await fs.stat(fullPath);
        const ext = path.extname(entry.name);

        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'file',
          size: stats.size,
          extension: ext ? ext.slice(1) : undefined, // Remove leading dot
        });
      }
    }

    // Sort: directories first, then files, both alphabetically
    return nodes.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      return a.type === 'directory' ? -1 : 1;
    });
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
}

/**
 * Search for a query string in file contents
 */
async function searchInFiles(
  dirPath: string,
  query: string,
  maxResults = 100
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const searchQuery = query.toLowerCase();

  async function searchDir(currentPath: string): Promise<void> {
    if (results.length >= maxResults) return;

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxResults) break;

        // Skip excluded directories
        if (EXCLUDED_DIRS.has(entry.name)) {
          continue;
        }

        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await searchDir(fullPath);
        } else if (entry.isFile()) {
          // Only search text files (skip large files and binaries)
          const stats = await fs.stat(fullPath);
          if (stats.size > 1024 * 1024) continue; // Skip files > 1MB

          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) break;

              const line = lines[i];
              const lowerLine = line.toLowerCase();
              const matchIndex = lowerLine.indexOf(searchQuery);

              if (matchIndex !== -1) {
                results.push({
                  filePath: fullPath,
                  fileName: entry.name,
                  lineNumber: i + 1,
                  lineContent: line.trim(),
                  matchStart: matchIndex,
                  matchEnd: matchIndex + query.length,
                });
              }
            }
          } catch (err) {
            // Skip files that can't be read as text (likely binary)
            continue;
          }
        }
      }
    } catch (error) {
      console.error(`Error searching directory ${currentPath}:`, error);
    }
  }

  await searchDir(dirPath);
  return results;
}

export const setupFileSystemBridge = (): void => {
  // Handler for reading directory tree
  ipcMain.handle('files:read-directory', async (_, dirPath: string) => {
    try {
      // Validate path exists
      if (!existsSync(dirPath)) {
        throw new Error(`Path does not exist: ${dirPath}`);
      }

      const stats = statSync(dirPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${dirPath}`);
      }

      const tree = await readDirectoryTree(dirPath, dirPath);
      return { success: true, data: tree };
    } catch (error) {
      console.error('Error reading directory:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Handler for reading file contents
  ipcMain.handle('files:read-file', async (_, filePath: string, forceText = false) => {
    try {
      // Validate path exists
      if (!existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      const stats = statSync(filePath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      // If forcing text mode, read as text
      if (forceText) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          return {
            success: true,
            data: {
              content,
              type: 'text',
              size: stats.size,
            },
          };
        } catch {
          // If text reading fails, still try binary
          const content = await fs.readFile(filePath);
          return {
            success: true,
            data: {
              content: content.toString('base64'),
              type: 'binary',
              size: stats.size,
            },
          };
        }
      }

      // Image extensions that should always be read as binary (unless forceText)
      const imageExtensions = new Set([
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

      const ext = path.extname(filePath).toLowerCase().slice(1);
      const isImage = imageExtensions.has(ext);

      // Read images as binary to enable preview
      if (isImage) {
        const content = await fs.readFile(filePath);
        return {
          success: true,
          data: {
            content: content.toString('base64'),
            type: 'binary',
            size: stats.size,
          },
        };
      }

      // Try to read non-images as text first
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return {
          success: true,
          data: {
            content,
            type: 'text',
            size: stats.size,
          },
        };
      } catch {
        // If text reading fails, read as binary
        const content = await fs.readFile(filePath);
        return {
          success: true,
          data: {
            content: content.toString('base64'),
            type: 'binary',
            size: stats.size,
          },
        };
      }
    } catch (error) {
      console.error('Error reading file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Handler for searching file contents
  ipcMain.handle('files:search-content', async (_, dirPath: string, query: string) => {
    try {
      if (!query || query.trim().length === 0) {
        return { success: true, data: [] };
      }

      const results = await searchInFiles(dirPath, query.trim());
      return { success: true, data: results };
    } catch (error) {
      console.error('Error searching files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
};
