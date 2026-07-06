/**
 * Builds a minimal valid JPEG buffer containing a real EXIF APP1 segment
 * (a single Orientation tag), for use in MCP EXIF tool tests without
 * shipping binary fixture files.
 */
export function buildTestJpegWithExif(): Buffer {
  const tiff: number[] = [];
  const pushU16 = (arr: number[], v: number): void => {
    arr.push(v & 0xff, (v >> 8) & 0xff);
  };
  const pushU32 = (arr: number[], v: number): void => {
    arr.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
  };

  // TIFF header: byte order II (little endian), magic 42, offset to IFD0 = 8
  pushU16(tiff, 0x4949);
  pushU16(tiff, 42);
  pushU32(tiff, 8);

  // IFD0 with 1 entry: tag 0x0112 (Orientation), type SHORT (3), count 1, value 1
  pushU16(tiff, 1);
  pushU16(tiff, 0x0112);
  pushU16(tiff, 3);
  pushU32(tiff, 1);
  pushU16(tiff, 1);
  pushU16(tiff, 0);
  pushU32(tiff, 0); // next IFD offset = 0

  const exifHeader = Buffer.from('Exif\0\0', 'ascii');
  const app1Payload = Buffer.concat([exifHeader, Buffer.from(tiff)]);
  const app1Len = app1Payload.length + 2;

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]), // SOI
    Buffer.from([0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff]),
    app1Payload,
    Buffer.from([0xff, 0xd9]), // EOI
  ]);
}
