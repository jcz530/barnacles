import { dialog, ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { existsSync, statSync } from 'fs';

// Directories and files to exclude from the tree
const EXCLUDED_DIRS = new Set([
  '.DS_Store',
  '.cache',
  '.data',
  '.git',
  '.idea',
  '.mypy_cache',
  '.next',
  '.nuxt',
  '.run',
  '.venv/bin',
  '.venv/lib',
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
 * Expands tilde (~) in paths to the user's home directory
 */
function expandTilde(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(2));
  }
  return filepath;
}

/**
 * Check if a path should be excluded based on exact name match or subdirectory pattern
 */
function isExcluded(
  entryName: string,
  relativePath: string,
  customExclusions?: Set<string>
): boolean {
  const normalizedPath = relativePath.split(path.sep).join('/');

  // Check hardcoded exclusions first
  for (const excluded of EXCLUDED_DIRS) {
    const pattern = excluded.replace(/\/+$/, ''); // Remove trailing slashes
    if (!pattern) continue;

    // Name pattern (no "/"): match exact directory/file name
    // Example: "node_modules" matches any directory named "node_modules"
    if (!pattern.includes('/') && entryName === pattern) {
      return true;
    }

    // Path pattern (contains "/"): match as a substring in the path hierarchy
    // Example: ".venv/lib" matches "backend/.venv/lib/python3.11/..."
    if (pattern.includes('/')) {
      const pathSegments = normalizedPath.split('/');
      const patternSegments = pattern.split('/');

      // Slide through path segments looking for pattern match
      for (let i = 0; i <= pathSegments.length - patternSegments.length; i++) {
        const slice = pathSegments.slice(i, i + patternSegments.length).join('/');
        if (slice === pattern) {
          const remaining = pathSegments.slice(i).join('/');
          if (remaining === pattern || remaining.startsWith(pattern + '/')) {
            return true;
          }
        }
      }
    }
  }

  // Check custom per-project exclusions
  if (customExclusions && customExclusions.size > 0) {
    // Check exact path match
    if (customExclusions.has(normalizedPath)) {
      return true;
    }

    // Check if this path is a child of an excluded path
    for (const excludedPath of customExclusions) {
      if (normalizedPath.startsWith(excludedPath + '/')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Recursively read a directory and build a tree structure
 */
async function readDirectoryTree(
  dirPath: string,
  relativeTo: string,
  customExclusions?: Set<string>
): Promise<FileNode[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(relativeTo, fullPath);

      // Skip excluded directories and files
      if (isExcluded(entry.name, relativePath, customExclusions)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Recursively read subdirectories
        const children = await readDirectoryTree(fullPath, relativeTo, customExclusions);
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

  async function searchDir(currentPath: string, rootPath: string): Promise<void> {
    if (results.length >= maxResults) return;

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxResults) break;

        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(rootPath, fullPath);

        // Skip excluded directories
        if (isExcluded(entry.name, relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          await searchDir(fullPath, rootPath);
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
          } catch {
            // Skip files that can't be read as text (likely binary)
            continue;
          }
        }
      }
    } catch (error) {
      console.error(`Error searching directory ${currentPath}:`, error);
    }
  }

  await searchDir(dirPath, dirPath);
  return results;
}

export const setupFileSystemBridge = (): void => {
  // Handler for reading directory tree
  ipcMain.handle(
    'files:read-directory',
    async (_, dirPath: string, customExclusions?: string[]) => {
      try {
        // Expand tilde in path
        const expandedPath = expandTilde(dirPath);

        // Validate path exists
        if (!existsSync(expandedPath)) {
          throw new Error(`Path does not exist: ${expandedPath}`);
        }

        const stats = statSync(expandedPath);
        if (!stats.isDirectory()) {
          throw new Error(`Path is not a directory: ${expandedPath}`);
        }

        // Convert custom exclusions array to Set for efficient lookup
        const exclusionsSet = customExclusions ? new Set(customExclusions) : undefined;

        const tree = await readDirectoryTree(expandedPath, expandedPath, exclusionsSet);
        return { success: true, data: tree };
      } catch (error) {
        console.error('Error reading directory:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // Handler for getting file stats without reading content
  ipcMain.handle('files:get-file-stats', async (_, filePath: string) => {
    try {
      // Expand tilde in path
      const expandedPath = expandTilde(filePath);

      // Validate path exists
      if (!existsSync(expandedPath)) {
        throw new Error(`File does not exist: ${expandedPath}`);
      }

      const stats = statSync(expandedPath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${expandedPath}`);
      }

      return {
        success: true,
        data: {
          size: stats.size,
          mtime: stats.mtime,
          ctime: stats.ctime,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
        },
      };
    } catch (error) {
      console.error('Error getting file stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Handler for reading file contents
  ipcMain.handle('files:read-file', async (_, filePath: string, forceText = false) => {
    try {
      // Expand tilde in path
      const expandedPath = expandTilde(filePath);

      // Validate path exists
      if (!existsSync(expandedPath)) {
        throw new Error(`File does not exist: ${expandedPath}`);
      }

      const stats = statSync(expandedPath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${expandedPath}`);
      }

      // If forcing text mode, read as text
      if (forceText) {
        try {
          const content = await fs.readFile(expandedPath, 'utf-8');
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
          const content = await fs.readFile(expandedPath);
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

      const ext = path.extname(expandedPath).toLowerCase().slice(1);
      const isImage = imageExtensions.has(ext);

      // Read images as binary to enable preview
      if (isImage) {
        const content = await fs.readFile(expandedPath);
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
        const content = await fs.readFile(expandedPath, 'utf-8');
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
        const content = await fs.readFile(expandedPath);
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

      // Expand tilde in path
      const expandedPath = expandTilde(dirPath);

      const results = await searchInFiles(expandedPath, query.trim());
      return { success: true, data: results };
    } catch (error) {
      console.error('Error searching files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Handler for showing native folder selection dialog
  ipcMain.handle('files:select-folder', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Folder',
        buttonLabel: 'Select',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      return { success: true, data: result.filePaths[0] };
    } catch (error) {
      console.error('Error showing folder dialog:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Handler for moving files to a folder
  ipcMain.handle('files:move-files', async (_, filePaths: string[], targetFolder: string) => {
    try {
      // Expand tilde in target folder path
      const expandedTargetFolder = expandTilde(targetFolder);

      // Validate target folder exists
      if (!existsSync(expandedTargetFolder)) {
        throw new Error(`Target folder does not exist: ${expandedTargetFolder}`);
      }

      const stats = statSync(expandedTargetFolder);
      if (!stats.isDirectory()) {
        throw new Error(`Target path is not a directory: ${expandedTargetFolder}`);
      }

      const results: Array<{ file: string; success: boolean; error?: string }> = [];

      for (const filePath of filePaths) {
        try {
          // Expand tilde in source file path
          const expandedFilePath = expandTilde(filePath);

          // Validate source file exists
          if (!existsSync(expandedFilePath)) {
            results.push({
              file: filePath,
              success: false,
              error: 'File does not exist',
            });
            continue;
          }

          // Get the file name
          const fileName = path.basename(expandedFilePath);
          const targetPath = path.join(expandedTargetFolder, fileName);

          // Check if file already exists at target
          if (existsSync(targetPath)) {
            results.push({
              file: filePath,
              success: false,
              error: 'File already exists in target folder',
            });
            continue;
          }

          // Move the file using fs.rename (same as mv)
          await fs.rename(expandedFilePath, targetPath);

          results.push({
            file: filePath,
            success: true,
          });
        } catch (error) {
          results.push({
            file: filePath,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Check if all moves were successful
      const allSuccess = results.every(r => r.success);

      return {
        success: allSuccess,
        results,
        error: allSuccess ? undefined : 'Some files failed to move',
      };
    } catch (error) {
      console.error('Error moving files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Handler for getting global exclusions that exist in a directory
  ipcMain.handle('files:get-global-exclusions', async (_, dirPath: string) => {
    try {
      // Expand tilde in path
      const expandedPath = expandTilde(dirPath);

      // Validate path exists
      if (!existsSync(expandedPath)) {
        return { success: false, error: `Path does not exist: ${expandedPath}` };
      }

      const existingExclusions: string[] = [];

      // Check which global exclusions exist in this directory
      for (const excluded of EXCLUDED_DIRS) {
        // For simple names (no slash), check if directory exists
        if (!excluded.includes('/')) {
          const fullPath = path.join(expandedPath, excluded);
          if (existsSync(fullPath)) {
            existingExclusions.push(excluded);
          }
        } else {
          // For path patterns like ".venv/bin", check if the path exists
          const fullPath = path.join(expandedPath, excluded);
          if (existsSync(fullPath)) {
            existingExclusions.push(excluded);
          }
        }
      }

      return { success: true, data: existingExclusions };
    } catch (error) {
      console.error('Error getting global exclusions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
};
