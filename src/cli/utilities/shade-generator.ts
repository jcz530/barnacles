import { checkShadeContrast, generateShades } from '../../shared/utilities/shade-generator.js';
import { type ExportFormat, exportPalette } from '../../shared/utilities/palette-exporter.js';
import { intro, isCancel, log, outro, select, text } from '@clack/prompts';
import { compactLogo } from '../utils/branding.js';
import pc from 'picocolors';

/**
 * Display a single shade with color preview in terminal
 */
function displayShade(name: string, hex: string, isBase: boolean = false): void {
  // Create a colored block - picocolors doesn't support custom hex backgrounds
  // so we'll use ANSI escape codes directly
  const rgbMatch = hex.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  let colorBlock = '    ';
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 16);
    const g = parseInt(rgbMatch[2], 16);
    const b = parseInt(rgbMatch[3], 16);
    colorBlock = `\x1b[48;2;${r};${g};${b}m    \x1b[0m`;
  }

  const contrast = checkShadeContrast(hex);

  // Text contrast indicators
  const whiteText = contrast.white >= 4.5 ? '✓' : '✗';
  const blackText = contrast.black >= 4.5 ? '✓' : '✗';

  const baseBadge = isBase ? pc.yellow(' [BASE]') : '';
  const shadeName = pc.bold(name.padEnd(4));
  const hexValue = pc.cyan(hex.padEnd(8));
  const contrastInfo = pc.dim(`W:${whiteText} B:${blackText}`);

  console.log(`  ${colorBlock}  ${shadeName} ${hexValue} ${contrastInfo}${baseBadge}`);
}

/**
 * Display full palette with all shades
 */
function displayPalette(
  colorInput: string,
  algorithm: 'tailwind' | 'vibrant' | 'natural'
): boolean {
  const palette = generateShades({
    baseColor: colorInput,
    algorithm,
  });

  if (!palette) {
    log.error('Invalid color format');
    log.info('Supported formats: HEX (#3b82f6), RGB (rgb(59, 130, 246)), HSL (hsl(217, 91%, 60%))');
    return false;
  }

  console.log('\n' + pc.bold(`Generated Palette (${algorithm} algorithm):`));
  console.log(pc.dim('─'.repeat(60)));

  palette.shades.forEach((shade, index) => {
    const isBase = index === palette.baseShadeIndex;
    displayShade(shade.name, shade.hex, isBase);
  });

  console.log(pc.dim('─'.repeat(60)));
  console.log(pc.dim('Contrast: ✓ = WCAG AA (4.5:1), ✗ = Below AA\n'));

  return true;
}

/**
 * Display exported code in specified format
 */
function displayExport(
  colorInput: string,
  algorithm: 'tailwind' | 'vibrant' | 'natural',
  format: ExportFormat,
  colorName: string
): void {
  const palette = generateShades({
    baseColor: colorInput,
    algorithm,
  });

  if (!palette) {
    log.error('Failed to generate palette');
    return;
  }

  const code = exportPalette(palette, format, colorName);

  console.log('\n' + pc.bold(`Export (${format}):`));
  console.log(pc.dim('─'.repeat(60)));
  console.log(code);
  console.log(pc.dim('─'.repeat(60)) + '\n');
}

export const shadeGeneratorCli = {
  id: 'shade-generator',
  name: 'Shade Generator',
  description: 'Generate perceptually uniform color palettes using OKLCH for design systems',
  handler: {
    async execute(args: string[]) {
      const colorInput = args[0];

      // If a color is provided as argument, generate once and exit
      if (colorInput) {
        intro(`${compactLogo} Shade Generator`);
        const success = displayPalette(colorInput, 'tailwind');
        if (success) {
          outro('Done! Run without arguments for interactive mode.');
        } else {
          outro('Generation failed');
        }
        return;
      }

      // Interactive mode
      intro(`${compactLogo} Shade Generator`);
      log.info(
        'Generate color palettes for design systems. Press Ctrl+C or type "exit" to quit.\n'
      );

      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Get base color
        const colorPrompt = await text({
          message: 'Enter a base color:',
          placeholder: 'e.g., #3b82f6, rgb(59, 130, 246), hsl(217, 91%, 60%)',
          validate: value => {
            if (!value) return 'Please enter a color value';
            if (value.toLowerCase() === 'exit') return undefined;
            return undefined;
          },
        });

        if (isCancel(colorPrompt)) {
          outro('Cancelled');
          break;
        }

        const color = String(colorPrompt).trim();

        if (color.toLowerCase() === 'exit') {
          outro('Goodbye!');
          break;
        }

        // Select algorithm
        const algorithmChoice = await select({
          message: 'Choose an algorithm:',
          options: [
            {
              value: 'tailwind',
              label: 'Tailwind',
              hint: 'Balanced, Tailwind-style palette',
            },
            {
              value: 'vibrant',
              label: 'Vibrant',
              hint: 'High saturation throughout',
            },
            {
              value: 'natural',
              label: 'Natural',
              hint: 'Desaturated extremes',
            },
          ],
        });

        if (isCancel(algorithmChoice)) {
          outro('Cancelled');
          break;
        }

        const algorithm = String(algorithmChoice) as 'tailwind' | 'vibrant' | 'natural';

        // Display the palette
        displayPalette(color, algorithm);

        // Ask if they want to export
        const wantsExport = await select({
          message: 'Would you like to export this palette?',
          options: [
            { value: 'no', label: 'No, continue' },
            { value: 'tailwind3', label: 'Export as Tailwind v3 Config' },
            { value: 'tailwind4', label: 'Export as Tailwind v4 (CSS)' },
            { value: 'css', label: 'Export as CSS Variables' },
            { value: 'scss', label: 'Export as SCSS Variables' },
            { value: 'json', label: 'Export as JSON' },
          ],
        });

        if (isCancel(wantsExport)) {
          outro('Cancelled');
          break;
        }

        const exportChoice = String(wantsExport);

        if (exportChoice !== 'no') {
          // Get color name
          const colorNamePrompt = await text({
            message: 'Color name for export:',
            placeholder: 'primary',
            defaultValue: 'primary',
          });

          if (isCancel(colorNamePrompt)) {
            outro('Cancelled');
            break;
          }

          const colorName = String(colorNamePrompt).trim() || 'primary';

          displayExport(color, algorithm, exportChoice as ExportFormat, colorName);
        }

        console.log(''); // Add spacing
      }
    },
    helpText: 'Generate color shade palettes using perceptually uniform OKLCH color space',
    examples: [
      'barnacles utilities shade-generator "#3b82f6"',
      'barnacles utilities shade-generator "rgb(59, 130, 246)"',
      'barnacles utilities shade-generator',
    ],
  },
};
