import { describe, it, expect, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { usePersistedSetting, arrayEquals } from './usePersistedSetting';
import type { Setting } from '@shared/types/api';

/** A settings row, with the fields these tests do not care about filled in. */
function row(key: string, value: string, type: Setting['type'] = 'string'): Setting {
  return { key, value, type, updatedAt: new Date(0) };
}

/** Reads a string setting the way the real components do. */
function readKey(key: string) {
  return (data: Setting[]) => data.find(s => s.key === key)?.value;
}

describe('usePersistedSetting', () => {
  it('does not write when the server value arrives', async () => {
    const data = ref<Setting[] | undefined>(undefined);
    const write = vi.fn().mockResolvedValue(undefined);

    const setting = usePersistedSetting(() => data.value, {
      read: readKey('defaultIde'),
      write,
      initial: '',
    });

    // The payload lands, as it does on page load.
    data.value = [row('defaultIde', 'vscode')];
    await nextTick();

    expect(setting.value.value).toBe('vscode');
    expect(write).not.toHaveBeenCalled();
  });

  it('writes when the user changes the value', async () => {
    const data = ref<Setting[] | undefined>([row('defaultIde', 'vscode')]);
    const write = vi.fn().mockResolvedValue(undefined);

    const setting = usePersistedSetting(() => data.value, {
      read: readKey('defaultIde'),
      write,
      initial: '',
    });
    await nextTick();

    setting.value.value = 'zed';
    await nextTick();

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('zed');
  });

  it('skips a write when the user reselects the persisted value', async () => {
    const data = ref<Setting[] | undefined>([row('defaultIde', 'vscode')]);
    const write = vi.fn().mockResolvedValue(undefined);

    const setting = usePersistedSetting(() => data.value, {
      read: readKey('defaultIde'),
      write,
      initial: '',
    });
    await nextTick();

    setting.value.value = 'zed';
    await nextTick();
    setting.value.value = 'vscode';
    await nextTick();
    // Back to 'zed' -- a real change again, not a no-op.
    setting.value.value = 'zed';
    await nextTick();

    expect(write.mock.calls).toEqual([['zed'], ['vscode'], ['zed']]);
  });

  it('does not write when a refetch returns unchanged data', async () => {
    const data = ref<Setting[] | undefined>([row('defaultIde', 'vscode')]);
    const write = vi.fn().mockResolvedValue(undefined);

    usePersistedSetting(() => data.value, {
      read: readKey('defaultIde'),
      write,
      initial: '',
    });
    await nextTick();

    // A window refocus refetch: new array identity, same contents.
    data.value = [row('defaultIde', 'vscode')];
    await nextTick();

    expect(write).not.toHaveBeenCalled();
  });

  it('does not write when the payload has no row for the setting', async () => {
    const data = ref<Setting[] | undefined>(undefined);
    const write = vi.fn().mockResolvedValue(undefined);

    const setting = usePersistedSetting(() => data.value, {
      read: readKey('missing'),
      write,
      initial: 'fallback',
    });

    data.value = [row('other', 'x')];
    await nextTick();

    expect(setting.value.value).toBe('fallback');
    expect(write).not.toHaveBeenCalled();
  });

  it('holds back writes until the server value has arrived', async () => {
    const data = ref<Setting[] | undefined>(undefined);
    const write = vi.fn().mockResolvedValue(undefined);

    const setting = usePersistedSetting(() => data.value, {
      read: readKey('defaultIde'),
      write,
      initial: '',
    });

    // An edit before hydration would race the incoming payload.
    setting.value.value = 'zed';
    await nextTick();

    expect(write).not.toHaveBeenCalled();
  });

  it('rejects invalid values without writing or advancing the baseline', async () => {
    const data = ref<Setting[] | undefined>([row('scanMaxDepth', '3')]);
    const write = vi.fn().mockResolvedValue(undefined);

    const setting = usePersistedSetting<number>(() => data.value, {
      read: data_ => Number(data_.find(s => s.key === 'scanMaxDepth')?.value),
      write,
      initial: 3,
      isValid: v => Number.isFinite(v) && v >= 1 && v <= 10,
    });
    await nextTick();

    // Mid-edit: the field is cleared, yielding NaN.
    setting.value.value = NaN;
    await nextTick();
    expect(write).not.toHaveBeenCalled();
    expect(setting.lastPersisted.value).toBe(3);

    setting.value.value = 5;
    await nextTick();
    expect(write).toHaveBeenCalledWith(5);
  });

  it('rolls the baseline back when a write fails, so a retry still sends', async () => {
    const data = ref<Setting[] | undefined>([row('showTrayIcon', 'false')]);
    const write = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const onError = vi.fn();

    const setting = usePersistedSetting<boolean>(() => data.value, {
      read: d => d.find(s => s.key === 'showTrayIcon')?.value === 'true',
      write,
      initial: false,
      onError,
    });
    await nextTick();

    setting.value.value = true;
    await nextTick();
    await nextTick();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(setting.lastPersisted.value).toBe(false);

    // The user toggles off and on again; the retry must not be swallowed.
    setting.value.value = false;
    await nextTick();
    setting.value.value = true;
    await nextTick();

    expect(write).toHaveBeenLastCalledWith(true);
  });

  it('treats a boolean whose stored value differs from the initial as hydration', async () => {
    // The old per-component code only looked correct for booleans because the
    // ref default usually matched the stored value. This is the case that
    // exposed it.
    const data = ref<Setting[] | undefined>(undefined);
    const write = vi.fn().mockResolvedValue(undefined);

    const setting = usePersistedSetting<boolean>(() => data.value, {
      read: d => d.find(s => s.key === 'showTrayIcon')?.value === 'true',
      write,
      initial: false,
    });

    data.value = [row('showTrayIcon', 'true')];
    await nextTick();

    expect(setting.value.value).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });

  it('does not write array settings on hydration', async () => {
    const data = ref<Setting[] | undefined>(undefined);
    const write = vi.fn().mockResolvedValue(undefined);

    const setting = usePersistedSetting<string[]>(() => data.value, {
      read: d => {
        const raw = d.find(s => s.key === 'gitEmails')?.value;
        return raw ? (JSON.parse(raw) as string[]) : undefined;
      },
      write,
      initial: [],
      equals: arrayEquals,
    });

    data.value = [row('gitEmails', '["a@example.com"]')];
    await nextTick();

    expect(setting.value.value).toEqual(['a@example.com']);
    expect(write).not.toHaveBeenCalled();

    // A deep mutation is still a user change.
    setting.value.value = [...setting.value.value, 'b@example.com'];
    await nextTick();

    expect(write).toHaveBeenCalledWith(['a@example.com', 'b@example.com']);
  });

  it('seeds from defaults when the payload carries no row for the setting', async () => {
    // `isHydrated` says a payload arrived; `hasStoredValue` says this setting
    // was in it. A caller seeding from backend defaults must gate on the
    // latter, or whichever query resolves first decides whether the defaults
    // ever appear.
    const data = ref<Setting[] | undefined>(undefined);

    const setting = usePersistedSetting<string[]>(() => data.value, {
      read: d => {
        const stored = d.find(s => s.key === 'scanIncludedDirectories');
        return stored ? (JSON.parse(stored.value) as string[]) : undefined;
      },
      write: vi.fn().mockResolvedValue(undefined),
      initial: [],
      equals: arrayEquals,
    });

    data.value = [row('somethingElse', '[]')];
    await nextTick();

    expect(setting.isHydrated.value).toBe(true);
    expect(setting.hasStoredValue.value).toBe(false);
  });

  it('reports a stored value that is present', async () => {
    const data = ref<Setting[] | undefined>(undefined);

    const setting = usePersistedSetting(() => data.value, {
      read: readKey('defaultIde'),
      write: vi.fn().mockResolvedValue(undefined),
      initial: '',
    });

    data.value = [row('defaultIde', 'vscode')];
    await nextTick();

    expect(setting.hasStoredValue.value).toBe(true);
  });

  it('ignores a stale refetch that lands while a write is in flight', async () => {
    const data = ref<Setting[] | undefined>([row('defaultIde', 'vscode')]);
    let settle: () => void = () => {};
    const write = vi.fn().mockImplementation(
      () =>
        new Promise<void>(resolve => {
          settle = resolve;
        })
    );

    const setting = usePersistedSetting(() => data.value, {
      read: readKey('defaultIde'),
      write,
      initial: '',
    });
    await nextTick();

    setting.value.value = 'zed';
    await nextTick();
    expect(write).toHaveBeenCalledWith('zed');

    /*
     * A refetch that started before the edit returns the pre-edit value.
     * Applying it would snap the control back to VS Code while the PUT writing
     * Zed succeeds, leaving the screen disagreeing with the database.
     */
    data.value = [row('defaultIde', 'vscode')];
    await nextTick();
    expect(setting.value.value).toBe('zed');

    settle();
    await nextTick();
    await nextTick();
    expect(setting.value.value).toBe('zed');
  });

  it('keeps the newer value when an older write fails after a newer one succeeded', async () => {
    const data = ref<Setting[] | undefined>([row('defaultIde', 'a')]);
    const settlers: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];
    const write = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve, reject) => {
          settlers.push({ resolve: () => resolve(), reject });
        })
    );
    const onError = vi.fn();

    const setting = usePersistedSetting(() => data.value, {
      read: readKey('defaultIde'),
      write,
      initial: '',
      onError,
    });
    await nextTick();

    setting.value.value = 'b';
    await nextTick();
    setting.value.value = 'c';
    await nextTick();

    // They settle out of order: the newer write lands first, the older fails.
    settlers[1].resolve();
    await nextTick();
    settlers[0].reject(new Error('offline'));
    await nextTick();
    await nextTick();

    /*
     * Rolling back to 'a' here would leave the baseline behind both the UI and
     * the server, so the next selection of 'c' would re-send it -- the
     * redundant PUT this composable exists to prevent.
     */
    expect(setting.lastPersisted.value).toBe('c');
  });

  it('detects an in-place mutation of an array setting', async () => {
    const data = ref<Setting[] | undefined>(undefined);
    const write = vi.fn().mockResolvedValue(undefined);

    const setting = usePersistedSetting<string[]>(() => data.value, {
      read: d => {
        const stored = d.find(s => s.key === 'gitEmails');
        return stored ? (JSON.parse(stored.value) as string[]) : undefined;
      },
      write,
      initial: [],
      equals: arrayEquals,
    });

    data.value = [row('gitEmails', '["a@example.com"]')];
    await nextTick();
    expect(write).not.toHaveBeenCalled();

    /*
     * `deep: true` exists to catch this. If `lastPersisted` aliased the same
     * array, the comparison would be against the mutated array itself and the
     * write would be silently dropped.
     */
    setting.value.value.push('b@example.com');
    await nextTick();

    expect(write).toHaveBeenCalledWith(['a@example.com', 'b@example.com']);
  });

  it('runs onHydrate on every hydration, including the first', async () => {
    const data = ref<Setting[] | undefined>(undefined);
    const onHydrate = vi.fn();

    usePersistedSetting(() => data.value, {
      read: readKey('reducedMotion'),
      write: vi.fn().mockResolvedValue(undefined),
      initial: 'system',
      onHydrate,
    });

    data.value = [row('reducedMotion', 'always')];
    await nextTick();

    expect(onHydrate).toHaveBeenCalledWith('always');
  });
});

describe('arrayEquals', () => {
  it('compares contents, not identity', () => {
    expect(arrayEquals(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(arrayEquals(['a'], ['a', 'b'])).toBe(false);
    expect(arrayEquals(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(arrayEquals([], [])).toBe(true);
  });
});
