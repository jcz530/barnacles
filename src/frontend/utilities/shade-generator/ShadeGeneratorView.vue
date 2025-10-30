<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, Copy, Download } from 'lucide-vue-next';
import {
  checkShadeContrast,
  generateShades,
  type GeneratedPalette,
} from '../../../shared/utilities/shade-generator';
import { exportPalette, type ExportFormat } from '../../../shared/utilities/palette-exporter';

const colorInput = ref('#3b82f6');
const colorPickerValue = ref('#3b82f6');
const colorName = ref('primary');
const algorithm = ref<'tailwind' | 'vibrant' | 'natural'>('tailwind');
const exportFormat = ref<ExportFormat>('tailwind');

const palette = ref<GeneratedPalette | null>(null);
const error = ref<string | null>(null);
const copiedShade = ref<string | null>(null);
const copiedExport = ref(false);

// Sync color picker with text input
watch(colorInput, newValue => {
  if (newValue.match(/^#[0-9A-Fa-f]{6}$/)) {
    colorPickerValue.value = newValue;
  }
});

watch(colorPickerValue, newValue => {
  colorInput.value = newValue;
});

// Generate palette when inputs change
watch(
  [colorInput, algorithm],
  () => {
    try {
      const result = generateShades({
        baseColor: colorInput.value,
        algorithm: algorithm.value,
      });

      if (result) {
        palette.value = result;
        error.value = null;
      } else {
        error.value = 'Invalid color format';
        palette.value = null;
      }
    } catch {
      error.value = 'Invalid color format';
      palette.value = null;
    }
  },
  { immediate: true }
);

const exportCode = computed(() => {
  if (!palette.value) return '';
  return exportPalette(palette.value, exportFormat.value, colorName.value);
});

async function copyShade(shade: string, hex: string) {
  try {
    await navigator.clipboard.writeText(hex);
    copiedShade.value = shade;
    setTimeout(() => {
      copiedShade.value = null;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

async function copyExportCode() {
  try {
    await navigator.clipboard.writeText(exportCode.value);
    copiedExport.value = true;
    setTimeout(() => {
      copiedExport.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

function downloadPalette() {
  const blob = new Blob([exportCode.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${colorName.value}-palette.${exportFormat.value === 'tailwind' ? 'js' : exportFormat.value}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const algorithmOptions = [
  { value: 'tailwind', label: 'Tailwind', description: 'Balanced, Tailwind-style palette' },
  { value: 'vibrant', label: 'Vibrant', description: 'High saturation throughout' },
  { value: 'natural', label: 'Natural', description: 'Desaturated extremes' },
];

const exportFormatOptions = [
  { value: 'tailwind', label: 'Tailwind Config' },
  { value: 'css', label: 'CSS Variables' },
  { value: 'scss', label: 'SCSS Variables' },
  { value: 'json', label: 'JSON' },
];
</script>

<template>
  <div>
    <section class="mt-8">
      <div class="mb-6">
        <h2 class="text-2xl font-semibold">Shade Generator</h2>
        <p class="text-muted-foreground mt-1">
          Generate perceptually uniform color palettes for design systems
        </p>
      </div>

      <div class="space-y-6">
        <!-- Input Controls -->
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Configure your base color and algorithm</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <!-- Base Color -->
              <div class="space-y-2">
                <Label for="color-input">Base Color</Label>
                <div class="flex gap-2">
                  <input
                    v-model="colorPickerValue"
                    type="color"
                    class="border-input h-10 w-14 cursor-pointer rounded-md border"
                    title="Pick a color"
                  />
                  <Input
                    id="color-input"
                    v-model="colorInput"
                    placeholder="#3b82f6"
                    :class="{ 'border-destructive': error }"
                    class="flex-1"
                  />
                </div>
                <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
              </div>

              <!-- Color Name -->
              <div class="space-y-2">
                <Label for="color-name">Color Name</Label>
                <Input id="color-name" v-model="colorName" placeholder="primary" />
              </div>
            </div>

            <!-- Algorithm Selection -->
            <div class="space-y-2">
              <Label for="algorithm">Algorithm</Label>
              <Select v-model="algorithm">
                <SelectTrigger id="algorithm">
                  <SelectValue placeholder="Select algorithm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in algorithmOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    <div>
                      <div class="font-medium">{{ option.label }}</div>
                      <div class="text-muted-foreground text-xs">{{ option.description }}</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <!-- Palette Preview -->
        <Card v-if="palette">
          <CardHeader>
            <CardTitle>Generated Palette</CardTitle>
            <CardDescription>
              Base color detected at shade {{ palette.shades[palette.baseShadeIndex].name }}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-2">
              <div
                v-for="shade in palette.shades"
                :key="shade.name"
                class="group hover:bg-muted/50 flex items-center gap-3 rounded-lg border p-3 transition-colors"
              >
                <!-- Color Swatch -->
                <div
                  class="border-border h-12 w-12 flex-shrink-0 rounded-md border-2 shadow-sm"
                  :style="{ backgroundColor: shade.hex }"
                  :title="`L: ${shade.lch.l}, C: ${shade.lch.c}, H: ${shade.lch.h}`"
                />

                <!-- Shade Info -->
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold">{{ shade.name }}</span>
                    <Badge
                      v-if="palette.baseShadeIndex === palette.shades.indexOf(shade)"
                      variant="secondary"
                      class="text-xs"
                    >
                      Base
                    </Badge>
                  </div>
                  <code class="text-muted-foreground text-sm">{{ shade.hex }}</code>
                </div>

                <!-- Contrast Indicators -->
                <div class="hidden items-center gap-2 md:flex">
                  <div
                    class="flex h-8 w-16 items-center justify-center rounded text-xs font-medium"
                    :style="{ backgroundColor: shade.hex, color: '#ffffff' }"
                  >
                    Aa
                  </div>
                  <div
                    class="flex h-8 w-16 items-center justify-center rounded text-xs font-medium"
                    :style="{ backgroundColor: shade.hex, color: '#000000' }"
                  >
                    Aa
                  </div>
                </div>

                <!-- Copy Button -->
                <Button
                  variant="ghost"
                  size="sm"
                  class="opacity-0 transition-opacity group-hover:opacity-100"
                  @click="copyShade(shade.name, shade.hex)"
                >
                  <Check v-if="copiedShade === shade.name" class="h-4 w-4 text-green-500" />
                  <Copy v-else class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Export Panel -->
        <Card v-if="palette">
          <CardHeader>
            <div class="flex items-center justify-between">
              <div>
                <CardTitle>Export</CardTitle>
                <CardDescription>Copy or download in various formats</CardDescription>
              </div>
              <div class="flex gap-2">
                <Button variant="outline" size="sm" @click="copyExportCode">
                  <Check v-if="copiedExport" class="mr-2 h-4 w-4 text-green-500" />
                  <Copy v-else class="mr-2 h-4 w-4" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" @click="downloadPalette">
                  <Download class="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent class="space-y-4">
            <!-- Format Selector -->
            <Select v-model="exportFormat">
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in exportFormatOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>

            <!-- Code Preview -->
            <div class="bg-muted overflow-x-auto rounded-lg p-4">
              <pre class="text-sm"><code>{{ exportCode }}</code></pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  </div>
</template>
