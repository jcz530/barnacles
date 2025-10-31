<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, ChevronDown, Copy, Download } from 'lucide-vue-next';
import {
  checkShadeContrast,
  type GeneratedPalette,
  generateShades,
} from '../../../shared/utilities/shade-generator';
import {
  type ColorFormat,
  type ExportFormat,
  exportPalette,
} from '../../../shared/utilities/palette-exporter';
import { convertColor } from '../../../shared/utilities/color-converter';

const colorInput = ref('#3b82f6');
const colorPickerValue = ref('#3b82f6');
const colorName = ref('primary');
const algorithm = ref<'tailwind' | 'vibrant' | 'natural'>('tailwind');
const baseColorFormat = ref<ColorFormat>('hex'); // Format for base color input
const exportFormat = ref<ExportFormat>('tailwind3');
const colorFormat = ref<ColorFormat>('hex'); // Format for export

// Fine-tuning controls
const lightnessCurve = ref([0.5]); // 0 = linear, 1 = fully eased
const chromaIntensity = ref([1]); // 0.5 = less saturated, 1.5 = more saturated
const minLightness = ref([15]); // 10 = very dark, 25 = lighter darks
const basePosition = ref<number | undefined>(undefined); // undefined = auto-detect
const showAdvanced = ref(false);

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
  // When color picker changes, update to hex format
  baseColorFormat.value = 'hex';
  colorFormat.value = 'hex';
});

// Convert base color when format changes
watch(baseColorFormat, (newFormat, oldFormat) => {
  if (oldFormat === newFormat) return;

  const converted = convertColor(colorInput.value);
  if (converted) {
    switch (newFormat) {
      case 'hex':
        colorInput.value = converted.hex;
        colorPickerValue.value = converted.hex;
        break;
      case 'rgb':
        colorInput.value = converted.rgb;
        break;
      case 'hsl':
        colorInput.value = converted.hsl;
        break;
      case 'oklch':
        colorInput.value = converted.oklch;
        break;
    }
    // Set export color format to match base color format
    colorFormat.value = newFormat;
  }
});

// Generate palette when inputs change
watch(
  [colorInput, algorithm, lightnessCurve, chromaIntensity, minLightness, basePosition],
  () => {
    try {
      const result = generateShades({
        baseColor: colorInput.value,
        algorithm: algorithm.value,
        lightnessCurve: lightnessCurve.value[0],
        chromaIntensity: chromaIntensity.value[0],
        minLightness: minLightness.value[0],
        basePosition: basePosition.value,
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
  return exportPalette(palette.value, exportFormat.value, colorName.value, colorFormat.value);
});

// Convert a hex color to the currently selected base color format
function getFormattedColor(hex: string): string {
  const converted = convertColor(hex);
  if (!converted) return hex;

  switch (baseColorFormat.value) {
    case 'hex':
      return converted.hex;
    case 'rgb':
      return converted.rgb;
    case 'hsl':
      return converted.hsl;
    case 'oklch':
      return converted.oklch;
    default:
      return hex;
  }
}

async function copyShade(shade: string, hex: string) {
  try {
    const formattedColor = getFormattedColor(hex);
    await navigator.clipboard.writeText(formattedColor);
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

  // Determine file extension based on format
  let extension = 'txt';
  if (exportFormat.value === 'tailwind3') {
    extension = 'js';
  } else if (exportFormat.value === 'tailwind4' || exportFormat.value === 'scss') {
    extension = 'css';
  } else if (exportFormat.value === 'json') {
    extension = 'json';
  }

  a.download = `${colorName.value}-palette.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generatePaletteSVG(): string {
  if (!palette.value) return '';

  const width = 1200;
  const height = 600;
  const shadeWidth = width / palette.value.shades.length;
  const barHeight = 200;
  const padding = 60;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  // Background
  svg += `<rect width="${width}" height="${height}" fill="#ffffff"/>`;

  // Title
  svg += `<text x="${width / 2}" y="40" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="600" fill="#000000">${colorName.value} Palette</text>`;

  // Color bar and details
  palette.value.shades.forEach((shade, index) => {
    const x = index * shadeWidth;
    const y = padding + 40;

    // Color rectangle
    svg += `<rect x="${x}" y="${y}" width="${shadeWidth}" height="${barHeight}" fill="${shade.hex}"/>`;

    // Shade name
    const textY = y + barHeight + 30;
    svg += `<text x="${x + shadeWidth / 2}" y="${textY}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" fill="#000000">${shade.name}</text>`;

    // Hex value
    svg += `<text x="${x + shadeWidth / 2}" y="${textY + 25}" text-anchor="middle" font-family="system-ui, -apple-system, monospace" font-size="14" fill="#666666">${shade.hex}</text>`;

    // Base indicator
    if (index === palette.value.baseShadeIndex) {
      svg += `<text x="${x + shadeWidth / 2}" y="${textY + 50}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="500" fill="#999999">BASE</text>`;
    }

    // Contrast indicators
    const contrast = checkShadeContrast(shade.hex);
    const contrastY = y + barHeight + 80;
    svg += `<text x="${x + shadeWidth / 2}" y="${contrastY}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#999999">W:${contrast.white.toFixed(1)} B:${contrast.black.toFixed(1)}</text>`;
  });

  // Footer
  svg += `<text x="${width / 2}" y="${height - 20}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#999999">Generated with Barnacles Shade Generator (${algorithm.value} algorithm)</text>`;

  svg += '</svg>';

  return svg;
}

function downloadPaletteImage() {
  const svg = generatePaletteSVG();
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${colorName.value}-palette.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const algorithmOptions = [
  { value: 'tailwind', label: 'Balanced', description: 'Tailwind-style palette' },
  { value: 'vibrant', label: 'Vibrant', description: 'High saturation throughout' },
  { value: 'natural', label: 'Natural', description: 'Desaturated extremes' },
];
const selectedAlgorith = computed(() => algorithmOptions.find(a => a.value === algorithm.value));

const exportFormatOptions = [
  { value: 'tailwind3', label: 'Tailwind v3 Config' },
  { value: 'tailwind4', label: 'Tailwind v4 (CSS)' },
  { value: 'css', label: 'CSS Variables' },
  { value: 'scss', label: 'SCSS Variables' },
  { value: 'json', label: 'JSON' },
];

const colorFormatOptions = [
  { value: 'hex', label: 'HEX (#3b82f6)' },
  { value: 'rgb', label: 'RGB (rgb(59, 130, 246))' },
  { value: 'hsl', label: 'HSL (hsl(217, 91%, 60%))' },
  { value: 'oklch', label: 'OKLCH (oklch(0.63, 0.23, 253))' },
];
</script>

<template>
  <div>
    <section class="mt-8">
      <div class="mb-6">
        <h2 class="text-2xl font-semibold">Shade Generator</h2>
        <p class="text-muted-foreground mt-1">
          Generate perceptually uniform color palettes using OKLCH for design systems
        </p>
      </div>

      <div class="space-y-3">
        <!-- Input Controls -->
        <Card class="max-w-xl border-none shadow-none">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Configure your base color and algorithm</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <!-- Base Color -->
            <div class="space-y-2">
              <Label for="color-input">Base Color</Label>
              <div class="flex gap-2">
                <input
                  v-model="colorPickerValue"
                  type="color"
                  class="border-input h-10 w-14 cursor-pointer rounded-md border shadow-sm"
                  title="Pick a color"
                />
                <div class="flex max-w-md flex-1 items-center rounded-md shadow-sm">
                  <Input
                    id="color-input"
                    v-model="colorInput"
                    placeholder="#3b82f6"
                    :class="{ 'border-destructive': error }"
                    class="h-full rounded-r-none border-r-0 py-0 shadow-none"
                  />
                  <Select v-model="baseColorFormat">
                    <SelectTrigger
                      class="!h-full w-[100px] rounded-l-none border-l-0 py-0 shadow-none focus:z-10"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="option in colorFormatOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.value.toUpperCase() }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
            </div>

            <div class="grid max-w-md grid-cols-1 gap-4 md:grid-cols-2">
              <!-- Color Name -->
              <div class="space-y-2">
                <Label for="color-name">Color Name</Label>
                <Input id="color-name" v-model="colorName" placeholder="primary" />
              </div>

              <!-- Algorithm Selection -->
              <div class="space-y-2">
                <Label for="algorithm">Algorithm</Label>
                <Select v-model="algorithm">
                  <SelectTrigger id="algorithm">
                    <SelectValue placeholder="Select algorithm">
                      {{ selectedAlgorith?.label ?? 'Select algorithm' }}
                      {{
                        selectedAlgorith?.description ? ` · ${selectedAlgorith?.description}` : ''
                      }}
                    </SelectValue>
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
            </div>

            <!-- Advanced Controls -->
            <Collapsible v-model:open="showAdvanced">
              <CollapsibleTrigger as-child>
                <Button variant="ghost" class="w-full justify-between">
                  <span>Advanced Settings</span>
                  <ChevronDown
                    class="h-4 w-4 transition-transform duration-200"
                    :class="{ 'rotate-180': showAdvanced }"
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent class="space-y-4 pt-4">
                <!-- Lightness Curve -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <Label for="lightness-curve">Lightness Curve</Label>
                    <span class="text-muted-foreground text-sm">
                      {{
                        lightnessCurve[0] === 0
                          ? 'Linear'
                          : lightnessCurve[0] === 1
                            ? 'Eased'
                            : 'Balanced'
                      }}
                    </span>
                  </div>
                  <Slider
                    id="lightness-curve"
                    v-model="lightnessCurve"
                    :min="0"
                    :max="1"
                    :step="0.1"
                    class="w-full"
                  />
                  <p class="text-muted-foreground text-xs">
                    Controls shade distribution. Linear = evenly spaced, Eased = more dark shades.
                  </p>
                </div>

                <!-- Chroma Intensity -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <Label for="chroma-intensity">Saturation Intensity</Label>
                    <span class="text-muted-foreground text-sm"
                      >{{ chromaIntensity[0].toFixed(1) }}x</span
                    >
                  </div>
                  <Slider
                    id="chroma-intensity"
                    v-model="chromaIntensity"
                    :min="0.5"
                    :max="1.5"
                    :step="0.1"
                    class="w-full"
                  />
                  <p class="text-muted-foreground text-xs">
                    Adjusts overall saturation. Lower = muted colors, Higher = vibrant colors.
                  </p>
                </div>

                <!-- Dark Shade Lightness -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <Label for="min-lightness">Dark Shade Lightness</Label>
                    <span class="text-muted-foreground text-sm">{{ minLightness[0] }}</span>
                  </div>
                  <Slider
                    id="min-lightness"
                    v-model="minLightness"
                    :min="10"
                    :max="25"
                    :step="1"
                    class="w-full"
                  />
                  <p class="text-muted-foreground text-xs">
                    Minimum lightness for darkest shade. Higher = more differentiation in dark
                    shades.
                  </p>
                </div>

                <!-- Reset Button -->
                <Button
                  variant="outline"
                  size="sm"
                  class="w-full"
                  @click="
                    () => {
                      lightnessCurve = [0.5];
                      chromaIntensity = [1];
                      minLightness = [15];
                      basePosition = undefined;
                    }
                  "
                >
                  Reset to Defaults
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
        <hr class="mx-6 border-pink-400/20" />
        <!-- Palette Preview -->
        <Card class="border-none shadow-none" v-if="palette">
          <CardHeader>
            <CardTitle>Generated Palette</CardTitle>
            <CardDescription>
              Base color detected at shade {{ palette.shades[palette.baseShadeIndex].name }}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <!-- Horizontal Color Bar -->
            <div class="border-border mb-6 flex h-16 overflow-hidden rounded-lg border-2 shadow-sm">
              <div
                v-for="shade in palette.shades"
                :key="shade.name"
                class="flex-1 transition-all hover:flex-[1.2]"
                :style="{ backgroundColor: shade.hex }"
                :title="`${shade.name}: ${shade.hex}`"
              />
            </div>

            <!-- Individual Shade Details -->
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
                  :title="`OKLCH(${shade.oklch.l}, ${shade.oklch.c}, ${shade.oklch.h})`"
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
                  <code class="text-muted-foreground text-sm">{{
                    getFormattedColor(shade.hex)
                  }}</code>
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
        <hr class="mx-6 border-pink-400/20" />
        <!-- Export Panel -->
        <Card class="border-none shadow-none" v-if="palette">
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
                  Code
                </Button>
                <Button variant="outline" size="sm" @click="downloadPaletteImage">
                  <Download class="mr-2 h-4 w-4" />
                  Image
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent class="space-y-4">
            <!-- Format Selectors -->
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="space-y-2">
                <Label for="export-format">Export Format</Label>
                <Select id="export-format" v-model="exportFormat">
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
              </div>

              <div class="space-y-2">
                <Label for="color-format">Color Format</Label>
                <Select id="color-format" v-model="colorFormat">
                  <SelectTrigger>
                    <SelectValue placeholder="Select color format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in colorFormatOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

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
