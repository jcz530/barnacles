import ExifReader from 'exifreader';

export interface ExifTag {
  description: string;
  value: string | number | number[];
}

export interface ExifData {
  [key: string]: ExifTag;
}

export interface ExifCategory {
  name: string;
  fields: Array<{
    key: string;
    label: string;
    value: string;
  }>;
}

export interface ParsedExifData {
  categories: ExifCategory[];
  hasGPS: boolean;
  gpsData?: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
  raw: ExifData;
}

/**
 * Parse EXIF data from an image buffer
 */
export function parseExifData(buffer: ArrayBuffer): ParsedExifData {
  const tags = ExifReader.load(buffer, { expanded: true }) as any;

  const categories: ExifCategory[] = [];
  let hasGPS = false;
  let gpsData: ParsedExifData['gpsData'];

  // Extract GPS data if available
  if (tags.gps) {
    const { Latitude, Longitude, Altitude } = tags.gps;
    if (Latitude?.description && Longitude?.description) {
      hasGPS = true;
      gpsData = {
        latitude: parseFloat(Latitude.description),
        longitude: parseFloat(Longitude.description),
        altitude: Altitude?.description ? parseFloat(Altitude.description) : undefined,
      };
    }
  }

  // Process camera/EXIF data
  if (tags.exif) {
    const fields: Array<{ key: string; label: string; value: string }> = [];
    const exifKeys = Object.keys(tags.exif);

    exifKeys.forEach(key => {
      const tag = tags.exif[key];
      if (tag?.description) {
        fields.push({
          key,
          label: formatLabel(key),
          value: String(tag.description),
        });
      }
    });

    if (fields.length > 0) {
      categories.push({
        name: 'Camera & EXIF',
        fields,
      });
    }
  }

  // Process file data
  if (tags.file) {
    const fields: Array<{ key: string; label: string; value: string }> = [];
    const fileKeys = Object.keys(tags.file);

    fileKeys.forEach(key => {
      const tag = tags.file[key];
      if (tag?.description) {
        fields.push({
          key,
          label: formatLabel(key),
          value: String(tag.description),
        });
      }
    });

    if (fields.length > 0) {
      categories.push({
        name: 'File Information',
        fields,
      });
    }
  }

  // Process GPS data
  if (tags.gps) {
    const fields: Array<{ key: string; label: string; value: string }> = [];
    const gpsKeys = Object.keys(tags.gps);

    gpsKeys.forEach(key => {
      const tag = tags.gps[key];
      if (tag?.description) {
        fields.push({
          key,
          label: formatLabel(key),
          value: String(tag.description),
        });
      }
    });

    if (fields.length > 0) {
      categories.push({
        name: 'GPS Location',
        fields,
      });
    }
  }

  // Process IPTC data (metadata)
  if (tags.iptc) {
    const fields: Array<{ key: string; label: string; value: string }> = [];
    const iptcKeys = Object.keys(tags.iptc);

    iptcKeys.forEach(key => {
      const tag = tags.iptc[key];
      if (tag?.description) {
        fields.push({
          key,
          label: formatLabel(key),
          value: String(tag.description),
        });
      }
    });

    if (fields.length > 0) {
      categories.push({
        name: 'IPTC Metadata',
        fields,
      });
    }
  }

  // Process XMP data
  if (tags.xmp) {
    const fields: Array<{ key: string; label: string; value: string }> = [];
    const xmpKeys = Object.keys(tags.xmp);

    xmpKeys.forEach(key => {
      const tag = tags.xmp[key];
      if (tag?.description) {
        fields.push({
          key,
          label: formatLabel(key),
          value: String(tag.description),
        });
      }
    });

    if (fields.length > 0) {
      categories.push({
        name: 'XMP Data',
        fields,
      });
    }
  }

  return {
    categories,
    hasGPS,
    gpsData,
    raw: tags as ExifData,
  };
}

/**
 * Convert a field key to a human-readable label
 */
function formatLabel(key: string): string {
  // Handle common abbreviations
  const abbreviations: Record<string, string> = {
    ISO: 'ISO',
    GPS: 'GPS',
    EXIF: 'EXIF',
    IPTC: 'IPTC',
    XMP: 'XMP',
    DPI: 'DPI',
    RGB: 'RGB',
    CMYK: 'CMYK',
  };

  // Split on capital letters and join with spaces
  const words = key
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ');

  return words
    .map(word => {
      const upper = word.toUpperCase();
      if (abbreviations[upper]) {
        return abbreviations[upper];
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Export EXIF data as JSON string
 */
export function exportExifAsJson(data: ParsedExifData): string {
  const exportData = {
    hasGPS: data.hasGPS,
    gpsData: data.gpsData,
    categories: data.categories.reduce(
      (acc, category) => {
        acc[category.name] = category.fields.reduce(
          (fieldAcc, field) => {
            fieldAcc[field.label] = field.value;
            return fieldAcc;
          },
          {} as Record<string, string>
        );
        return acc;
      },
      {} as Record<string, Record<string, string>>
    ),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Convert ArrayBuffer to binary string for piexifjs
 */
function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
}

/**
 * Convert binary string to ArrayBuffer
 */
function binaryStringToArrayBuffer(binary: string): ArrayBuffer {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Strip EXIF data from image buffer (for JPEG files)
 * Note: This uses piexifjs which only works with JPEG files
 */
export async function stripExifData(
  buffer: ArrayBuffer,
  imageType: string
): Promise<{ buffer: ArrayBuffer; success: boolean; error?: string }> {
  // Check if image type is supported
  if (!imageType.includes('jpeg') && !imageType.includes('jpg')) {
    return {
      buffer,
      success: false,
      error: 'Only JPEG/JPG images are supported for EXIF stripping',
    };
  }

  try {
    // Dynamically import piexifjs (browser-only)
    // For Node.js (CLI), we'll need a different approach
    if (typeof window !== 'undefined') {
      // Browser environment
      const piexif = await import('piexifjs');
      const binaryString = arrayBufferToBinaryString(buffer);
      const strippedBinary = piexif.remove(binaryString);
      const strippedBuffer = binaryStringToArrayBuffer(strippedBinary);

      return {
        buffer: strippedBuffer,
        success: true,
      };
    } else {
      // Node.js environment - piexifjs doesn't work well in Node
      // We'll use a simple approach: find and remove EXIF segments
      const bytes = new Uint8Array(buffer);

      // Check for JPEG marker
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
        return {
          buffer,
          success: false,
          error: 'Invalid JPEG file',
        };
      }

      const output: number[] = [0xff, 0xd8]; // Start with SOI marker
      let i = 2;

      while (i < bytes.length) {
        // Check for marker
        if (bytes[i] !== 0xff) {
          // Copy rest of data as-is (image data)
          for (let j = i; j < bytes.length; j++) {
            output.push(bytes[j]);
          }
          break;
        }

        const marker = bytes[i + 1];

        // APP1 marker (0xE1) contains EXIF data - skip it
        if (marker === 0xe1) {
          const segmentSize = (bytes[i + 2] << 8) | bytes[i + 3];
          i += segmentSize + 2; // Skip entire APP1 segment
          continue;
        }

        // APP0 marker (0xE0) might contain JFIF - keep it
        // SOS marker (0xDA) starts image data - copy rest
        if (marker === 0xda) {
          // Copy from here to end
          for (let j = i; j < bytes.length; j++) {
            output.push(bytes[j]);
          }
          break;
        }

        // For other markers, copy them
        output.push(bytes[i], bytes[i + 1]);

        // If marker has a length field
        if (marker >= 0xe0 && marker <= 0xef) {
          const segmentSize = (bytes[i + 2] << 8) | bytes[i + 3];
          for (let j = 0; j < segmentSize; j++) {
            output.push(bytes[i + 2 + j]);
          }
          i += segmentSize + 2;
        } else {
          i += 2;
        }
      }

      const strippedBuffer = new Uint8Array(output).buffer;
      return {
        buffer: strippedBuffer,
        success: true,
      };
    }
  } catch (error) {
    return {
      buffer,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to strip EXIF data',
    };
  }
}
