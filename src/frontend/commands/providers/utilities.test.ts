import { describe, expect, it, vi } from 'vitest';
import { Palette, Wrench } from 'lucide-vue-next';
import type { UtilityMetadata } from '@/utilities/types';
import { utilityCommands } from './utilities';

const utility = (overrides: Partial<UtilityMetadata> = {}): UtilityMetadata => ({
  id: 'color-converter',
  name: 'CSS Color Converter',
  description: 'Convert between HEX, RGB, HSL and other formats',
  icon: 'Palette',
  route: '/utilities/color-converter',
  component: () => Promise.resolve({ default: {} }),
  cli: true,
  api: false,
  category: 'CSS & Design',
  tags: ['color', 'hex'],
  ...overrides,
});

describe('utilityCommands', () => {
  it('renders each utility with its own icon', () => {
    // A single shared glyph for every utility makes the group unscannable.
    const [command] = utilityCommands([utility()]);

    expect(command.icon).toBe(Palette);
  });

  it('falls back to a glyph when the recorded icon name is unknown', () => {
    const [command] = utilityCommands([utility({ icon: 'NoSuchIcon' })]);

    expect(command.icon).toBe(Wrench);
  });

  it('matches on tags and category as well as the name', () => {
    const [command] = utilityCommands([utility()]);

    expect(command.keywords).toEqual(
      expect.arrayContaining(['color', 'hex', 'CSS & Design', 'utility', 'tool'])
    );
  });

  it('drops empty keywords rather than matching every query', () => {
    // An absent category used to contribute '', which fuzzy-matches anything.
    const [command] = utilityCommands([utility({ category: undefined, tags: undefined })]);

    expect(command.keywords).not.toContain('');
  });

  it('navigates to the utility route', () => {
    const [command] = utilityCommands([utility()]);
    const navigate = vi.fn();

    command.run({
      surface: 'in-app',
      navigate,
      dismiss: vi.fn(),
      pop: vi.fn(),
      status: vi.fn(),
    });

    expect(navigate).toHaveBeenCalledWith('/utilities/color-converter');
  });
});
