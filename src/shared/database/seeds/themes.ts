import { themeService } from '../../../backend/services/theme-service';

export async function seedThemes() {
  console.log('  🎨 Seeding themes...');

  try {
    // Initialize default themes if they don't exist
    await themeService.initializeDefaultThemes();

    console.log('  ✅ Themes seeded successfully');
  } catch (error) {
    console.error('  ❌ Error seeding themes:', error);
    throw error;
  }
}
