import type { UtilityRegistration } from '../types';

const registration: UtilityRegistration = {
  metadata: {
    id: 'shade-generator',
    name: 'Shade Generator',
    description: 'Generate perceptually uniform color palettes for design systems like Tailwind',
    icon: 'Palette',
    route: '/utilities/shade-generator',
    component: () => import('./ShadeGeneratorView.vue'),
    cli: true,
    api: false,
    category: 'CSS & Design',
    tags: ['color', 'palette', 'tailwind', 'design-system', 'shades', 'lch'],
  },
};

export default registration;
