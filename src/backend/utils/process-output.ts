/**
 * Returns the last `count` entries of `output`. If `countParam` is missing or
 * not a positive integer, returns `output` unchanged.
 */
export function tailLines(output: string[], countParam: string | undefined): string[] {
  const count = Number(countParam);
  if (!countParam || !Number.isInteger(count) || count <= 0) {
    return output;
  }
  return output.slice(-count);
}
