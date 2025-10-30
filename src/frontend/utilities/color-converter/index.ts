import type { UtilityRegistration } from '../types';
import { convertColor } from '../../../shared/utilities/color-converter';

const registration: UtilityRegistration = {
  metadata: {
    id: 'color-converter',
    name: 'CSS Color Converter',
    description: 'Convert between HEX, RGB, RGBA, HSL, and HSLA color formats',
    icon: 'Palette',
    route: '/utilities/color-converter',
    component: () => import('./ColorConverterView.vue'),
    cli: true,
    api: false,
    category: 'CSS & Design',
    tags: ['color', 'css', 'hex', 'rgb', 'hsl', 'converter'],
  },
  cliHandler: {
    async execute(args: string[]) {
      const colorInput = args[0];

      if (!colorInput) {
        console.log('Usage: barnacles utilities color-converter <color>');
        console.log('\nExamples:');
        console.log('  barnacles utilities color-converter "#3b82f6"');
        console.log('  barnacles utilities color-converter "rgb(59, 130, 246)"');
        console.log('  barnacles utilities color-converter "hsl(217, 91%, 60%)"');
        return;
      }

      const result = convertColor(colorInput);

      if (!result) {
        console.error('Error: Invalid color format');
        console.log('\nSupported formats:');
        console.log('  - HEX: #3b82f6');
        console.log('  - RGB: rgb(59, 130, 246)');
        console.log('  - RGBA: rgba(59, 130, 246, 0.5)');
        console.log('  - HSL: hsl(217, 91%, 60%)');
        console.log('  - HSLA: hsla(217, 91%, 60%, 0.5)');
        return;
      }

      console.log('\nColor Conversions:');
      console.log('─────────────────────────────────────');
      console.log(`HEX:   ${result.hex}`);
      console.log(`RGB:   ${result.rgb}`);
      console.log(`RGBA:  ${result.rgba}`);
      console.log(`HSL:   ${result.hsl}`);
      console.log(`HSLA:  ${result.hsla}`);
      console.log('─────────────────────────────────────');
    },
    helpText: 'Convert CSS colors between different formats (HEX, RGB, HSL)',
    examples: [
      'barnacles utilities color-converter "#3b82f6"',
      'barnacles utilities color-converter "rgb(59, 130, 246)"',
      'barnacles utilities color-converter "hsl(217, 91%, 60%)"',
    ],
  },
};

export default registration;
