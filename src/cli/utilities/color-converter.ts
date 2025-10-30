import { convertColor } from '../../shared/utilities/color-converter.js';
import { intro, isCancel, log, outro, text } from '@clack/prompts';
import { compactLogo } from '../utils/branding.js';
import pc from 'picocolors';

/**
 * Display color conversion results
 */
function displayConversion(colorInput: string): boolean {
  const result = convertColor(colorInput);

  if (!result) {
    log.error('Invalid color format');
    log.info('Supported formats: HEX (#3b82f6), RGB (rgb(59, 130, 246)), HSL (hsl(217, 91%, 60%))');
    return false;
  }

  console.log('\n' + pc.bold('Color Conversions:'));
  console.log(pc.dim('─'.repeat(50)));
  console.log(pc.bold('HEX:  ') + pc.cyan(result.hex));
  console.log(pc.bold('RGB:  ') + pc.cyan(result.rgb));
  console.log(pc.bold('RGBA: ') + pc.cyan(result.rgba));
  console.log(pc.bold('HSL:  ') + pc.cyan(result.hsl));
  console.log(pc.bold('HSLA: ') + pc.cyan(result.hsla));
  console.log(pc.dim('─'.repeat(50)) + '\n');
  return true;
}

export const colorConverterCli = {
  id: 'color-converter',
  name: 'CSS Color Converter',
  description: 'Convert between HEX, RGB, RGBA, HSL, and HSLA color formats',
  handler: {
    async execute(args: string[]) {
      const colorInput = args[0];

      // If a color is provided as argument, convert it once and exit
      if (colorInput) {
        intro(`${compactLogo} CSS Color Converter`);
        const success = displayConversion(colorInput);
        if (success) {
          outro('Done! Run without arguments for interactive mode.');
        } else {
          outro('Conversion failed');
        }
        return;
      }

      // Interactive mode - keep asking for colors
      intro(`${compactLogo} CSS Color Converter`);
      log.info('Enter colors to convert. Press Ctrl+C or type "exit" to quit.\n');

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const input = await text({
          message: 'Enter a color value:',
          placeholder: 'e.g., #3b82f6, rgb(59, 130, 246), hsl(217, 91%, 60%)',
          validate: value => {
            if (!value) return 'Please enter a color value';
            // Allow 'exit' to quit
            if (value.toLowerCase() === 'exit') return undefined;
            return undefined;
          },
        });

        if (isCancel(input)) {
          outro('Cancelled');
          break;
        }

        const colorValue = String(input).trim();

        // Check if user wants to exit
        if (colorValue.toLowerCase() === 'exit') {
          outro('Goodbye!');
          break;
        }

        // Convert and display the color
        displayConversion(colorValue);
      }
    },
    helpText: 'Convert CSS colors between different formats (HEX, RGB, HSL)',
    examples: [
      'barnacles utilities color-converter "#3b82f6"',
      'barnacles utilities color-converter "rgb(59, 130, 246)"',
      'barnacles utilities color-converter "hsl(217, 91%, 60%)"',
    ],
  },
};
