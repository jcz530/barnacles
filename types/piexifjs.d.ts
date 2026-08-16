declare module 'piexifjs' {
  /** Returns the JPEG binary string with all EXIF data removed. */
  export function remove(jpegBinaryString: string): string;
  /** Parses EXIF from a JPEG binary string into piexif's tag-keyed object. */
  export function load(jpegBinaryString: string): Record<string, unknown>;
  /** Serializes a piexif tag object back into an EXIF binary string. */
  export function dump(exifObject: Record<string, unknown>): string;
  /** Inserts an EXIF binary string into a JPEG binary string. */
  export function insert(exifBinaryString: string, jpegBinaryString: string): string;
}
