<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTheme } from '@/composables/useTheme';
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { generateShades } from '../../shared/utilities/shade-generator';
import { Copy, Save, Trash2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'vue-sonner';
import Card from '@/components/ui/card/Card.vue';
import CardHeader from '@/components/ui/card/CardHeader.vue';
import CardTitle from '@/components/ui/card/CardTitle.vue';
import CardDescription from '@/components/ui/card/CardDescription.vue';
import CardContent from '@/components/ui/card/CardContent.vue';
import FontPicker from '@/components/settings/molecules/FontPicker.vue';
import type { Theme } from '@/shared/types/theme';

const route = useRoute();
const router = useRouter();
const { setBreadcrumbs } = useBreadcrumbs();
const { themes, createTheme, updateTheme, deleteTheme, previewTheme, duplicateTheme } = useTheme();

// Form state
const themeName = ref('');
const primaryColor = ref('#00c2e5');
const secondaryColor = ref('#ec4899');
const tertiaryColor = ref('#8b5cf6');
const slateColor = ref('#64748b');
const successColor = ref('#10b981');
const dangerColor = ref('#ef4444');
const fontUi = ref<string>('');
const fontHeading = ref<string>('');
const fontCode = ref<string>('');
const borderRadius = ref<'none' | 'sm' | 'md' | 'lg' | 'xl'>('md');
const customCssVars = ref('');

const isSaving = ref(false);
const isDeleting = ref(false);

// Get current theme being edited
const themeId = computed(() => route.params.id as string | undefined);
const currentTheme = computed(() => {
  if (!themeId.value || themeId.value === 'new') return null;
  return themes.value.find(t => t.id === themeId.value) ?? null;
});

const isEditMode = computed(
  () => !!themeId.value && themeId.value !== 'new' && !!currentTheme.value
);
const isDefaultTheme = computed(() => currentTheme.value?.isDefault ?? false);

// Generate shade previews
const primaryShades = computed(() => {
  const result = generateShades({
    baseColor: primaryColor.value,
    algorithm: 'tailwind',
  });
  return result?.shades ?? [];
});

const secondaryShades = computed(() => {
  const result = generateShades({
    baseColor: secondaryColor.value,
    algorithm: 'tailwind',
  });
  return result?.shades ?? [];
});

const tertiaryShades = computed(() => {
  const result = generateShades({
    baseColor: tertiaryColor.value,
    algorithm: 'tailwind',
  });
  return result?.shades ?? [];
});

const slateShades = computed(() => {
  const result = generateShades({
    baseColor: slateColor.value,
    algorithm: 'tailwind',
  });
  return result?.shades ?? [];
});

const successShades = computed(() => {
  const result = generateShades({
    baseColor: successColor.value,
    algorithm: 'tailwind',
  });
  return result?.shades ?? [];
});

const dangerShades = computed(() => {
  const result = generateShades({
    baseColor: dangerColor.value,
    algorithm: 'tailwind',
  });
  return result?.shades ?? [];
});

// Live preview theme object
const previewThemeData = computed<Theme>(() => ({
  id: currentTheme.value?.id ?? 'preview',
  name: themeName.value,
  isDefault: false,
  isActive: false,
  primaryColor: primaryColor.value,
  secondaryColor: secondaryColor.value,
  tertiaryColor: tertiaryColor.value,
  slateColor: slateColor.value,
  successColor: successColor.value,
  dangerColor: dangerColor.value,
  fontUi: fontUi.value || null,
  fontHeading: fontHeading.value || null,
  fontCode: fontCode.value || null,
  borderRadius: borderRadius.value,
  customCssVars: customCssVars.value || null,
  createdAt: new Date(),
  updatedAt: new Date(),
}));

// Watch for theme changes and apply live preview
watch(
  previewThemeData,
  newTheme => {
    previewTheme(newTheme);
  },
  { deep: true }
);

// Initialize form when theme changes
watch(
  currentTheme,
  theme => {
    if (theme) {
      // Edit mode - load existing theme
      themeName.value = theme.name;
      primaryColor.value = theme.primaryColor;
      secondaryColor.value = theme.secondaryColor;
      tertiaryColor.value = theme.tertiaryColor;
      slateColor.value = theme.slateColor;
      successColor.value = theme.successColor;
      dangerColor.value = theme.dangerColor;
      fontUi.value = theme.fontUi || '';
      fontHeading.value = theme.fontHeading || '';
      fontCode.value = theme.fontCode || '';
      borderRadius.value = theme.borderRadius;
      customCssVars.value = theme.customCssVars || '';
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (isEditMode.value && currentTheme.value) {
    setBreadcrumbs([
      { label: 'Settings', href: '/settings' },
      { label: 'Themes', href: '/themes' },
      { label: currentTheme.value.name },
    ]);
  } else {
    setBreadcrumbs([
      { label: 'Settings', href: '/settings' },
      { label: 'Themes', href: '/themes' },
      { label: 'New Theme' },
    ]);
    // Set defaults for new theme
    themeName.value = 'My Custom Theme';
    primaryColor.value = '#00c2e5';
    secondaryColor.value = '#ec4899';
    tertiaryColor.value = '#8b5cf6';
    slateColor.value = '#64748b';
    successColor.value = '#10b981';
    dangerColor.value = '#ef4444';
    borderRadius.value = 'md';
    customCssVars.value = '';
  }
});

async function handleSave() {
  if (!themeName.value.trim()) {
    toast.error('Theme name is required');
    return;
  }

  try {
    isSaving.value = true;

    // Parse custom CSS vars if provided
    let parsedCssVars = null;
    if (customCssVars.value.trim()) {
      try {
        // Try to parse as JSON first
        parsedCssVars = JSON.parse(customCssVars.value);
      } catch {
        // If not JSON, parse as CSS variable declarations
        const vars: Record<string, string> = {};
        const lines = customCssVars.value.split('\n');
        for (const line of lines) {
          const match = line.trim().match(/^(--[\w-]+)\s*:\s*(.+?);?$/);
          if (match) {
            vars[match[1]] = match[2];
          }
        }
        parsedCssVars = Object.keys(vars).length > 0 ? vars : null;
      }
    }

    const themeData = {
      name: themeName.value.trim(),
      primaryColor: primaryColor.value,
      secondaryColor: secondaryColor.value,
      tertiaryColor: tertiaryColor.value,
      slateColor: slateColor.value,
      successColor: successColor.value,
      dangerColor: dangerColor.value,
      fontUi: fontUi.value || null,
      fontHeading: fontHeading.value || null,
      fontCode: fontCode.value || null,
      borderRadius: borderRadius.value,
      customCssVars: parsedCssVars,
    };

    if (isEditMode.value && currentTheme.value) {
      await updateTheme({ id: currentTheme.value.id, theme: themeData });
      toast.success('Theme updated successfully');
    } else {
      await createTheme(themeData);
      toast.success('Theme created successfully');
    }

    router.push('/themes');
  } catch (error) {
    console.error('Failed to save theme:', error);
    toast.error('Failed to save theme');
  } finally {
    isSaving.value = false;
  }
}

async function handleDelete() {
  if (!currentTheme.value || !confirm('Are you sure you want to delete this theme?')) {
    return;
  }

  try {
    isDeleting.value = true;
    await deleteTheme(currentTheme.value.id);
    toast.success('Theme deleted successfully');
    router.push('/themes');
  } catch (error) {
    console.error('Failed to delete theme:', error);
    toast.error('Failed to delete theme');
  } finally {
    isDeleting.value = false;
  }
}

async function handleDuplicate() {
  if (!currentTheme.value) return;

  try {
    const newTheme = await duplicateTheme({
      id: currentTheme.value.id,
      name: `${currentTheme.value.name} (Copy)`,
    });
    toast.success('Theme duplicated successfully');
    router.push(`/themes/${newTheme.data.id}/edit`);
  } catch (error) {
    console.error('Failed to duplicate theme:', error);
    toast.error('Failed to duplicate theme');
  }
}

function handleCancel() {
  router.push('/themes');
}
</script>

<template>
  <div class="pb-8">
    <section class="mt-8">
      <div class="mb-6">
        <h2 class="text-2xl font-semibold">
          {{ isEditMode ? 'Edit Theme' : 'Create Theme' }}
        </h2>
        <p class="text-muted-foreground mt-1">
          Customize your theme with live preview. Changes apply instantly.
        </p>
      </div>

      <div class="max-w-4xl space-y-6">
        <!-- Theme Name -->
        <Card>
          <CardHeader>
            <CardTitle>Theme Name</CardTitle>
            <CardDescription>Give your theme a memorable name</CardDescription>
          </CardHeader>
          <CardContent>
            <Input v-model="themeName" placeholder="My Custom Theme" :disabled="isDefaultTheme" />
            <p v-if="isDefaultTheme" class="text-muted-foreground mt-2 text-xs">
              Default themes cannot be renamed
            </p>
          </CardContent>
        </Card>

        <!-- Colors -->
        <Card>
          <CardHeader>
            <CardTitle>Colors</CardTitle>
            <CardDescription>Define your theme colors</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- Primary Color -->
            <div class="space-y-3">
              <Label for="primary-color">Primary Color</Label>
              <div class="flex gap-3">
                <input
                  id="primary-color"
                  v-model="primaryColor"
                  type="color"
                  class="h-10 w-16 cursor-pointer rounded border"
                  :disabled="isDefaultTheme"
                />
                <Input
                  v-model="primaryColor"
                  placeholder="#00c2e5"
                  class="flex-1"
                  :disabled="isDefaultTheme"
                />
              </div>
              <!-- Primary Shade Preview -->
              <div class="mt-2 flex gap-1">
                <div
                  v-for="shade in primaryShades"
                  :key="shade.name"
                  :style="{ backgroundColor: shade.hex }"
                  class="h-10 flex-1 rounded-sm border"
                  :title="`${shade.name}: ${shade.hex}`"
                />
              </div>
              <p class="text-muted-foreground text-xs">
                11 shades generated: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
              </p>
            </div>

            <!-- Secondary Color -->
            <div class="space-y-3">
              <Label for="secondary-color">Secondary Color</Label>
              <div class="flex gap-3">
                <input
                  id="secondary-color"
                  v-model="secondaryColor"
                  type="color"
                  class="h-10 w-16 cursor-pointer rounded border"
                  :disabled="isDefaultTheme"
                />
                <Input
                  v-model="secondaryColor"
                  placeholder="#ec4899"
                  class="flex-1"
                  :disabled="isDefaultTheme"
                />
              </div>
              <!-- Secondary Shade Preview -->
              <div class="mt-2 flex gap-1">
                <div
                  v-for="shade in secondaryShades"
                  :key="shade.name"
                  :style="{ backgroundColor: shade.hex }"
                  class="h-10 flex-1 rounded-sm border"
                  :title="`${shade.name}: ${shade.hex}`"
                />
              </div>
              <p class="text-muted-foreground text-xs">Used for accents and highlights</p>
            </div>

            <!-- Tertiary Color -->
            <div class="space-y-3">
              <Label for="tertiary-color">Tertiary Color</Label>
              <div class="flex gap-3">
                <input
                  id="tertiary-color"
                  v-model="tertiaryColor"
                  type="color"
                  class="h-10 w-16 cursor-pointer rounded border"
                  :disabled="isDefaultTheme"
                />
                <Input
                  v-model="tertiaryColor"
                  placeholder="#8b5cf6"
                  class="flex-1"
                  :disabled="isDefaultTheme"
                />
              </div>
              <!-- Tertiary Shade Preview -->
              <div class="mt-2 flex gap-1">
                <div
                  v-for="shade in tertiaryShades"
                  :key="shade.name"
                  :style="{ backgroundColor: shade.hex }"
                  class="h-10 flex-1 rounded-sm border"
                  :title="`${shade.name}: ${shade.hex}`"
                />
              </div>
              <p class="text-muted-foreground text-xs">Additional accent color</p>
            </div>

            <!-- Slate/Background Color -->
            <div class="space-y-3">
              <Label for="slate-color">Background/Text Color (Slate)</Label>
              <div class="flex gap-3">
                <input
                  id="slate-color"
                  v-model="slateColor"
                  type="color"
                  class="h-10 w-16 cursor-pointer rounded border"
                  :disabled="isDefaultTheme"
                />
                <Input
                  v-model="slateColor"
                  placeholder="#64748b"
                  class="flex-1"
                  :disabled="isDefaultTheme"
                />
              </div>
              <!-- Slate Shade Preview -->
              <div class="mt-2 flex gap-1">
                <div
                  v-for="shade in slateShades"
                  :key="shade.name"
                  :style="{ backgroundColor: shade.hex }"
                  class="h-10 flex-1 rounded-sm border"
                  :title="`${shade.name}: ${shade.hex}`"
                />
              </div>
              <p class="text-muted-foreground text-xs">
                Controls backgrounds, text, and neutral UI elements
              </p>
            </div>

            <!-- Success Color -->
            <div class="space-y-3">
              <Label for="success-color">Success Color</Label>
              <div class="flex gap-3">
                <input
                  id="success-color"
                  v-model="successColor"
                  type="color"
                  class="h-10 w-16 cursor-pointer rounded border"
                  :disabled="isDefaultTheme"
                />
                <Input
                  v-model="successColor"
                  placeholder="#10b981"
                  class="flex-1"
                  :disabled="isDefaultTheme"
                />
              </div>
              <!-- Success Shade Preview -->
              <div class="mt-2 flex gap-1">
                <div
                  v-for="shade in successShades"
                  :key="shade.name"
                  :style="{ backgroundColor: shade.hex }"
                  class="h-10 flex-1 rounded-sm border"
                  :title="`${shade.name}: ${shade.hex}`"
                />
              </div>
              <p class="text-muted-foreground text-xs">
                Used for success states and positive actions
              </p>
            </div>

            <!-- Danger Color -->
            <div class="space-y-3">
              <Label for="danger-color">Danger Color</Label>
              <div class="flex gap-3">
                <input
                  id="danger-color"
                  v-model="dangerColor"
                  type="color"
                  class="h-10 w-16 cursor-pointer rounded border"
                  :disabled="isDefaultTheme"
                />
                <Input
                  v-model="dangerColor"
                  placeholder="#ef4444"
                  class="flex-1"
                  :disabled="isDefaultTheme"
                />
              </div>
              <!-- Danger Shade Preview -->
              <div class="mt-2 flex gap-1">
                <div
                  v-for="shade in dangerShades"
                  :key="shade.name"
                  :style="{ backgroundColor: shade.hex }"
                  class="h-10 flex-1 rounded-sm border"
                  :title="`${shade.name}: ${shade.hex}`"
                />
              </div>
              <p class="text-muted-foreground text-xs">
                Used for errors, warnings, and destructive actions
              </p>
            </div>
          </CardContent>
        </Card>

        <!-- Design Tokens -->
        <Card>
          <CardHeader>
            <CardTitle>Design Tokens</CardTitle>
            <CardDescription>Customize border radius</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- Border Radius -->
            <div class="space-y-2">
              <Label for="border-radius">Border Radius</Label>
              <Select v-model="borderRadius">
                <SelectTrigger id="border-radius">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (0px)</SelectItem>
                  <SelectItem value="sm">Small (6px)</SelectItem>
                  <SelectItem value="md">Medium (10px)</SelectItem>
                  <SelectItem value="lg">Large (14px)</SelectItem>
                  <SelectItem value="xl">Extra Large (20px)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <!-- Fonts -->
        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
            <CardDescription>Customize fonts for different parts of your interface</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- UI/Body Font -->
            <FontPicker
              v-model="fontUi"
              label="UI & Body Font"
              placeholder="Search for UI font..."
            />

            <!-- Heading Font -->
            <FontPicker
              v-model="fontHeading"
              label="Heading Font"
              placeholder="Search for heading font..."
            />

            <!-- Code/Monospace Font -->
            <FontPicker
              v-model="fontCode"
              label="Code Font (Monospace)"
              placeholder="Search for code font..."
            />
          </CardContent>
        </Card>

        <!-- Advanced: Custom CSS Variables -->
        <Card>
          <CardHeader>
            <CardTitle>Custom CSS Variables</CardTitle>
            <CardDescription>Advanced customization for developers</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              v-model="customCssVars"
              placeholder="--accent: #ff0000;
--muted: #f5f5f5;"
              rows="8"
              class="font-mono text-xs"
            />
            <p class="text-muted-foreground mt-2 text-xs">
              Override any CSS variable. Format: <code>--variable-name: value;</code> (one per line)
            </p>
          </CardContent>
        </Card>

        <!-- Actions -->
        <div class="flex items-center justify-between">
          <div class="flex gap-2">
            <Button
              v-if="isEditMode && !isDefaultTheme"
              variant="destructive"
              :disabled="isDeleting || isSaving"
              @click="handleDelete"
            >
              <Trash2 class="mr-2 h-4 w-4" />
              Delete
            </Button>
            <Button
              v-if="isEditMode"
              variant="outline"
              :disabled="isDeleting || isSaving"
              @click="handleDuplicate"
            >
              <Copy class="mr-2 h-4 w-4" />
              Duplicate
            </Button>
          </div>
          <div class="flex gap-2">
            <Button variant="outline" @click="handleCancel" :disabled="isSaving || isDeleting">
              Cancel
            </Button>
            <Button @click="handleSave" :disabled="isSaving || isDeleting">
              <Save class="mr-2 h-4 w-4" />
              {{ isSaving ? 'Saving...' : 'Save Theme' }}
            </Button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
