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
 * Strip EXIF data from image buffer (for JPEG files)
 * Note: This uses piexifjs which only works with JPEG files
 */
export async function stripExifData(
  buffer: ArrayBuffer,
  imageType: string
): Promise<ArrayBuffer | null> {
  // For now, we'll return null for unsupported formats
  // In a full implementation, you'd use piexifjs here for JPEG files
  if (!imageType.includes('jpeg') && !imageType.includes('jpg')) {
    return null;
  }

  // This is a placeholder - actual implementation would use piexifjs
  // to remove EXIF data from the JPEG buffer
  return buffer;
}
