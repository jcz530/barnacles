import * as fs from 'fs/promises';
import * as path from 'path';
import { projectScannerService } from '../project-scanner-service';

class ProjectFileSystemService {
  /**
   * Get README.md content for a project
   */
  async getProjectReadme(projectPath: string): Promise<string | null> {
    // Try common README file names
    const readmeFiles = ['README.md', 'readme.md', 'Readme.md', 'README.MD'];

    for (const filename of readmeFiles) {
      try {
        const readmePath = path.join(projectPath, filename);
        const content = await fs.readFile(readmePath, 'utf-8');
        return content;
      } catch {
        // File doesn't exist, try next
      }
    }

    return null;
  }

  /**
   * Delete third-party packages from a project
   */
  async deleteThirdPartyPackages(projectPath: string): Promise<{ deletedSize: number }> {
    const thirdPartyDirs = [
      'node_modules',
      'vendor',
      '.venv',
      'venv',
      'target/debug',
      'target/release',
    ];
    let deletedSize = 0;

    for (const dir of thirdPartyDirs) {
      const dirPath = path.join(projectPath, dir);
      try {
        await fs.access(dirPath);
        // Calculate size before deleting
        const size = await projectScannerService.getThirdPartySizeByPath(projectPath);
        // Delete the directory
        await fs.rm(dirPath, { recursive: true, force: true });
        deletedSize = size;
      } catch {
        // Directory doesn't exist or couldn't be deleted, skip
      }
    }

    return { deletedSize };
  }
}

export const projectFileSystemService = new ProjectFileSystemService();
