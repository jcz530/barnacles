import { Hono } from 'hono';
import path from 'path';
import { projectService } from '../../services/project';
import { loadProject } from '../../middleware/project-loader';
import type { ProjectContext } from '../../types/hono';

const files = new Hono();

/**
 * GET /:id/readme
 * Get the README.md file content for a project
 */
files.get('/:id/readme', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    const readme = await projectService.getProjectReadme(project.id);

    if (!readme) {
      return c.json(
        {
          error: 'README.md not found',
        },
        404
      );
    }

    return c.json({
      data: readme,
    });
  } catch (error) {
    console.error('Error fetching README:', error);
    return c.json(
      {
        error: 'Failed to fetch README',
      },
      500
    );
  }
});

/**
 * GET /:id/file?path=...
 * Serve a file from the project directory with HTTP range request support for video/audio streaming
 */
files.get('/:id/file', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    const filePath = c.req.query('path');

    if (!filePath) {
      return c.json(
        {
          error: 'File path is required',
        },
        400
      );
    }

    const fs = await import('fs/promises');
    const fullPath = path.join(project.path, filePath);

    // Security: Ensure the resolved path is within the project directory
    const normalizedProjectPath = path.resolve(project.path);
    const normalizedFilePath = path.resolve(fullPath);

    if (!normalizedFilePath.startsWith(normalizedProjectPath)) {
      return c.json(
        {
          error: 'Access denied',
        },
        403
      );
    }

    // Check if file exists and get stats
    let stats;
    try {
      stats = await fs.stat(fullPath);
    } catch {
      return c.json(
        {
          error: 'File not found',
        },
        404
      );
    }

    const fileSize = stats.size;

    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      // Images
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      // Videos
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.m4v': 'video/mp4',
      // Audio
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
      '.m4a': 'audio/mp4',
      '.opus': 'audio/opus',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Check for range request header (used for video/audio seeking)
    const range = c.req.header('range');

    if (!range) {
      // No range request - serve entire file
      const fileBuffer = await fs.readFile(fullPath);
      c.header('Content-Type', contentType);
      c.header('Content-Length', fileSize.toString());
      c.header('Accept-Ranges', 'bytes');
      return new Response(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': fileSize.toString(),
          'Accept-Ranges': 'bytes',
        },
      });
    }

    // Parse range header (format: "bytes=start-end")
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    // Validate range
    if (start >= fileSize || end >= fileSize) {
      c.header('Content-Range', `bytes */${fileSize}`);
      return c.json(
        {
          error: 'Requested range not satisfiable',
        },
        416
      );
    }

    // Read the requested chunk
    const buffer = Buffer.alloc(chunkSize);
    const fileHandle = await fs.open(fullPath, 'r');
    await fileHandle.read(buffer, 0, chunkSize, start);
    await fileHandle.close();

    // Return partial content with appropriate headers
    return new Response(buffer, {
      status: 206, // Partial Content
      headers: {
        'Content-Type': contentType,
        'Content-Length': chunkSize.toString(),
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('Error serving project file:', error);
    return c.json(
      {
        error: 'Failed to serve file',
      },
      500
    );
  }
});

/**
 * GET /:id/icon
 * Serve the project icon file
 */
files.get('/:id/icon', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');

    if (!project.icon) {
      return c.json(
        {
          error: 'No icon found for this project',
        },
        404
      );
    }

    const fs = await import('fs/promises');
    const iconPath = path.join(project.path, project.icon);

    try {
      const iconData = await fs.readFile(iconPath);
      const ext = path.extname(project.icon).toLowerCase();

      // Set appropriate content type based on file extension
      const contentType =
        {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
        }[ext] || 'application/octet-stream';

      return new Response(new Uint8Array(iconData), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch {
      return c.json(
        {
          error: 'Icon file not found',
        },
        404
      );
    }
  } catch (error) {
    console.error('Error serving project icon:', error);
    return c.json(
      {
        error: 'Failed to serve project icon',
      },
      500
    );
  }
});

export default files;
