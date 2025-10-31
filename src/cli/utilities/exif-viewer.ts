import {
  parseExifData,
  exportExifAsJson,
  stripExifData,
} from '../../shared/utilities/exif-reader.js';
import { intro, isCancel, log, outro, text, select } from '@clack/prompts';
import { compactLogo } from '../utils/branding.js';
import pc from 'picocolors';
import fs from 'fs/promises';
import path from 'path';

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Display EXIF data in a formatted table
 */
function displayExifData(exifData: ReturnType<typeof parseExifData>): void {
  console.log('\n' + pc.bold('EXIF Metadata:'));
  console.log(pc.dim('─'.repeat(80)));

  // Display GPS data if present
  if (exifData.hasGPS && exifData.gpsData) {
    console.log(pc.green('📍 GPS Location Found:'));
    console.log(`   Latitude:  ${pc.cyan(exifData.gpsData.latitude.toFixed(6))}`);
    console.log(`   Longitude: ${pc.cyan(exifData.gpsData.longitude.toFixed(6))}`);
    if (exifData.gpsData.altitude) {
      console.log(`   Altitude:  ${pc.cyan(exifData.gpsData.altitude.toFixed(2) + 'm')}`);
    }
    console.log(pc.dim('─'.repeat(80)));
  }

  // Display each category
  exifData.categories.forEach(category => {
    console.log(pc.bold(`\n${category.name}:`));
    category.fields.forEach(field => {
      const label = field.label.padEnd(30, ' ');
      console.log(`  ${pc.dim(label)} ${pc.cyan(field.value)}`);
    });
  });

  console.log(pc.dim('\n' + '─'.repeat(80)));

  const totalFields = exifData.categories.reduce((sum, cat) => sum + cat.fields.length, 0);
  console.log(pc.dim(`\nTotal: ${totalFields} metadata fields\n`));
}

/**
 * Export EXIF data to JSON file
 */
async function exportToJson(
  exifData: ReturnType<typeof parseExifData>,
  outputPath: string
): Promise<void> {
  const jsonString = exportExifAsJson(exifData);
  await fs.writeFile(outputPath, jsonString, 'utf-8');
  log.success(`Exported EXIF data to ${pc.cyan(outputPath)}`);
}

/**
 * Display GPS coordinates only
 */
function displayGpsOnly(exifData: ReturnType<typeof parseExifData>): void {
  if (!exifData.hasGPS || !exifData.gpsData) {
    log.warn('No GPS data found in image');
    return;
  }

  console.log('\n' + pc.bold('GPS Coordinates:'));
  console.log(pc.dim('─'.repeat(60)));
  console.log(`Latitude:  ${pc.cyan(exifData.gpsData.latitude.toFixed(6))}`);
  console.log(`Longitude: ${pc.cyan(exifData.gpsData.longitude.toFixed(6))}`);
  if (exifData.gpsData.altitude) {
    console.log(`Altitude:  ${pc.cyan(exifData.gpsData.altitude.toFixed(2) + 'm')}`);
  }
  console.log(pc.dim('─'.repeat(60)) + '\n');

  const mapsUrl = `https://www.google.com/maps?q=${exifData.gpsData.latitude},${exifData.gpsData.longitude}`;
  log.info(`Google Maps: ${pc.cyan(mapsUrl)}`);
}

/**
 * Process an image file and display/export EXIF data
 */
async function processImageFile(
  imagePath: string,
  flags: Record<string, string | boolean>
): Promise<boolean> {
  try {
    // Read the image file
    const resolvedPath = path.resolve(imagePath);
    const buffer = await fs.readFile(resolvedPath);

    log.info(`Reading: ${pc.cyan(path.basename(resolvedPath))}`);

    // Parse EXIF data
    const exifData = parseExifData(buffer.buffer);

    // Handle different output modes
    if (flags.gps) {
      // Show GPS coordinates only
      displayGpsOnly(exifData);
    } else if (flags.export) {
      // Export to JSON
      const outputPath =
        typeof flags.export === 'string'
          ? flags.export
          : `${path.basename(resolvedPath, path.extname(resolvedPath))}_exif.json`;
      await exportToJson(exifData, outputPath);
    } else if (flags.strip) {
      // Strip EXIF data
      const result = await stripExifData(buffer.buffer, 'image/jpeg');

      if (!result.success) {
        log.error(result.error || 'Failed to strip EXIF data');
        return false;
      }

      // Save stripped image
      const outputPath =
        typeof flags.strip === 'string'
          ? flags.strip
          : `${path.basename(resolvedPath, path.extname(resolvedPath))}_no_exif${path.extname(resolvedPath)}`;

      await fs.writeFile(outputPath, Buffer.from(result.buffer));
      log.success(`EXIF data stripped and saved to ${pc.cyan(outputPath)}`);

      // Show file size comparison
      const originalSize = buffer.length;
      const strippedSize = result.buffer.byteLength;
      const savedBytes = originalSize - strippedSize;
      const savedPercent = ((savedBytes / originalSize) * 100).toFixed(1);

      console.log(
        pc.dim(
          `\nOriginal: ${formatBytes(originalSize)} → Stripped: ${formatBytes(strippedSize)} (saved ${formatBytes(savedBytes)}, ${savedPercent}%)`
        )
      );
    } else {
      // Default: display all EXIF data
      displayExifData(exifData);
    }

    return true;
  } catch (error) {
    if (error instanceof Error) {
      log.error(`Failed to read image: ${error.message}`);
    } else {
      log.error('Failed to read image');
    }
    return false;
  }
}

export const exifViewerCli = {
  id: 'exif-viewer',
  name: 'EXIF Viewer',
  description: 'View, export, and remove EXIF metadata from images',
  handler: {
    async execute(args: string[], flags: Record<string, string | boolean>) {
      let imagePath = args[0];

      // If no image path provided, enter interactive mode
      if (!imagePath) {
        intro(`${compactLogo} EXIF Viewer`);
        log.info('Enter image paths to analyze. Press Ctrl+C or type "exit" to quit.\n');

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const input = await text({
            message: 'Enter image file path:',
            placeholder: 'e.g., photo.jpg, /path/to/image.png',
            validate: value => {
              if (!value) return 'Please enter an image path';
              if (value.toLowerCase() === 'exit') return undefined;
              return undefined;
            },
          });

          if (isCancel(input)) {
            outro('Cancelled');
            break;
          }

          const pathValue = String(input).trim();

          // Check if user wants to exit
          if (pathValue.toLowerCase() === 'exit') {
            outro('Goodbye!');
            break;
          }

          // Process the image
          await processImageFile(pathValue, flags);

          // Ask if they want to analyze another image
          const continuePrompt = await select({
            message: 'What would you like to do?',
            options: [
              { value: 'another', label: 'Analyze another image' },
              { value: 'exit', label: 'Exit' },
            ],
          });

          if (isCancel(continuePrompt) || continuePrompt === 'exit') {
            outro('Goodbye!');
            break;
          }
        }

        return;
      }

      // Non-interactive mode - process single image
      intro(`${compactLogo} EXIF Viewer`);

      const success = await processImageFile(imagePath, flags);

      if (success) {
        outro('Done!');
      } else {
        outro('Error occurred');
      }
    },
    helpText: 'View and manage EXIF metadata from images',
    examples: [
      'barnacles utilities exif-viewer photo.jpg',
      'barnacles utilities exif-viewer photo.jpg --gps',
      'barnacles utilities exif-viewer photo.jpg --export metadata.json',
      'barnacles utilities exif-viewer photo.jpg --strip',
      'barnacles utilities exif-viewer photo.jpg --strip output.jpg',
    ],
  },
};
