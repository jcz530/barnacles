import type { UtilityRegistration } from '../types';

const registration: UtilityRegistration = {
  metadata: {
    id: 'exif-viewer',
    name: 'EXIF Viewer',
    description: 'View, export, and remove EXIF metadata from images',
    icon: 'Image',
    route: '/utilities/exif-viewer',
    component: () => import('./ExifViewerView.vue'),
    cli: true,
    api: false,
    category: 'Image Tools',
    tags: ['exif', 'metadata', 'privacy', 'images', 'photos'],
  },
};

export default registration;
