import type { UtilityRegistration } from '../types';

const registration: UtilityRegistration = {
  metadata: {
    id: 'shade-generator',
    name: 'Shade Generator',
    description: 'Generate perceptually uniform color palettes using OKLCH for design systems',
    icon: 'Palette',
    route: '/utilities/shade-generator',
    component: () => import('./ShadeGeneratorView.vue'),
    cli: true,
    api: false,
    category: 'CSS & Design',
    tags: ['color', 'palette', 'tailwind', 'design-system', 'shades', 'oklch'],
  },
};

export default registration;
