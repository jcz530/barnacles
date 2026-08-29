import { describe, expect, it } from 'vitest';
import { ref, toRaw } from 'vue';
import type { FileEncoding } from '@/types/window';

/**
 * `ipcRenderer.invoke` serializes its arguments with the structured clone
 * algorithm, which throws "An object could not be cloned." on Vue's reactive
 * Proxy. A ref's value passed straight into an IPC call therefore fails at the
 * boundary, and because the rejection surfaces as an unhandled promise the UI
 * looks inert rather than erroring.
 *
 * These tests pin the unwrapping that FileViewer.saveFile relies on.
 */
describe('IPC payload serialization', () => {
  const encoding: FileEncoding = {
    bom: false,
    lineEnding: 'lf',
    finalNewline: true,
    mixedLineEndings: false,
  };

  it('throws when a reactive ref value is passed directly', () => {
    const encodingRef = ref<FileEncoding>({ ...encoding });

    // structuredClone stands in for the same algorithm ipcRenderer.invoke uses.
    expect(() => structuredClone({ encoding: encodingRef.value })).toThrow();
  });

  it('serializes once the proxy is unwrapped', () => {
    const encodingRef = ref<FileEncoding>({ ...encoding });

    const payload = {
      filePath: '/tmp/example.conf',
      content: 'hello\n',
      encoding: { ...toRaw(encodingRef.value) },
      expectedMtimeMs: 1234,
      expectedSize: 6,
      force: false,
    };

    expect(() => structuredClone(payload)).not.toThrow();
    expect(structuredClone(payload).encoding).toEqual(encoding);
  });

  it('round-trips every field the write handler reads', () => {
    const encodingRef = ref<FileEncoding>({
      bom: true,
      lineEnding: 'crlf',
      finalNewline: false,
      mixedLineEndings: true,
    });

    const cloned = structuredClone({ ...toRaw(encodingRef.value) });

    // A dropped field would silently change how the file is re-encoded.
    expect(cloned).toEqual({
      bom: true,
      lineEnding: 'crlf',
      finalNewline: false,
      mixedLineEndings: true,
    });
  });
});
