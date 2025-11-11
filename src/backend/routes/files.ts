import { Hono } from 'hono';
import path from 'path';
import { BadRequestException, NotFoundException } from '../exceptions/http-exceptions';

const files = new Hono();

/**
 * GET /serve?path=...
 * Serve any file from the filesystem with HTTP range request support
 * Used for related files and other files outside the project directory
 */
files.get('/serve', async c => {
  const filePath = c.req.query('path');

  if (!filePath) {
    throw new BadRequestException('File path is required');
  }

  // Security: Only allow absolute paths (relative paths could be exploited)
  if (!path.isAbsolute(filePath)) {
    throw new BadRequestException('Only absolute file paths are allowed');
  }

  const fs = await import('fs/promises');

  // Check if file exists and get stats
  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch {
    throw new NotFoundException('File not found');
  }

  // Security: Only allow files (not directories)
  if (!stats.isFile()) {
    throw new BadRequestException('Path must be a file, not a directory');
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
    const fileBuffer = await fs.readFile(filePath);

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
    throw new BadRequestException('Requested range not satisfiable');
  }

  // Read the requested chunk
  const buffer = Buffer.alloc(chunkSize);
  const fileHandle = await fs.open(filePath, 'r');
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
});

export default files;
