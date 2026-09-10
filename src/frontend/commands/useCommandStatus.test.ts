import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STATUS_TIMEOUT_MS,
  STATUS_VALUE_MAX,
  truncateValue,
  useCommandStatus,
} from './useCommandStatus';

describe('truncateValue', () => {
  it('leaves a value that already fits', () => {
    expect(truncateValue('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('keeps the tail of something too long', () => {
    // CSS truncation would keep the front and cut the filename off -- the one
    // part that says which path was copied.
    const path = `/Users/dev/${'nested/'.repeat(12)}alchemy`;

    const result = truncateValue(path);

    expect(result).toHaveLength(STATUS_VALUE_MAX);
    expect(result.startsWith('…')).toBe(true);
    expect(result.endsWith('alchemy')).toBe(true);
  });
});

describe('useCommandStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with nothing to say', () => {
    expect(useCommandStatus().status.value).toBeNull();
  });

  it('reports a success by default', () => {
    const { status, report } = useCommandStatus();

    report('Copied localhost:3000');

    expect(status.value).toMatchObject({ message: 'Copied localhost:3000', kind: 'success' });
  });

  it('reports a failure when asked', () => {
    const { status, report } = useCommandStatus();

    report('Could not kill port 3000', 'error');

    expect(status.value?.kind).toBe('error');
  });

  it('clears itself once the message has had its time', () => {
    const { status, report } = useCommandStatus();

    report('Copied');
    vi.advanceTimersByTime(STATUS_TIMEOUT_MS - 1);
    expect(status.value).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(status.value).toBeNull();
  });

  it('gives a repeat of the same message a new identity', () => {
    // Copying the same path twice produces identical text. Without something
    // changing, the second copy would neither re-animate nor be re-announced.
    const { status, report } = useCommandStatus();

    report('Copied /code/barnacles');
    const first = status.value?.id;

    report('Copied /code/barnacles');

    expect(status.value?.id).not.toBe(first);
    expect(status.value?.message).toBe('Copied /code/barnacles');
  });

  it('gives the newest message its full dwell rather than the first one’s', () => {
    // Running two commands in a row: the second message must not be cut short
    // by the first one's timer still running.
    const { status, report } = useCommandStatus();

    report('Killed port 3000');
    vi.advanceTimersByTime(STATUS_TIMEOUT_MS - 100);
    report('Killed port 5432');

    vi.advanceTimersByTime(200);
    expect(status.value?.message).toBe('Killed port 5432');

    vi.advanceTimersByTime(STATUS_TIMEOUT_MS);
    expect(status.value).toBeNull();
  });

  it('drops the message and its pending timer when cleared', () => {
    // reset() clears on reopen. The timer has to go with it, or a stale
    // expiry could blank a message raised by the next open.
    const { status, report, clear } = useCommandStatus();

    report('Copied');
    clear();
    expect(status.value).toBeNull();

    report('Killed port 3000');
    vi.advanceTimersByTime(STATUS_TIMEOUT_MS - 1);
    expect(status.value?.message).toBe('Killed port 3000');
  });
});
