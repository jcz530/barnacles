<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { convertColor, type ColorFormats } from '../../../shared/utilities/color-converter';
import CopyButton from '@/components/atoms/CopyButton.vue';

const colorInput = ref('#3b82f6');
const colorPickerValue = ref('#3b82f6');
const alpha = ref([1]);
const convertedColors = ref<ColorFormats | null>(null);
const error = ref<string | null>(null);

// Sync color picker with text input when text changes and is valid hex
watch(colorInput, newValue => {
  // Only update picker if it's a valid hex color
  if (newValue.match(/^#[0-9A-Fa-f]{6}$/)) {
    colorPickerValue.value = newValue;
  }
});

// Update text input when color picker changes
watch(colorPickerValue, newValue => {
  colorInput.value = newValue;
});

// Convert color whenever input or alpha changes
watch(
  [colorInput, alpha],
  () => {
    try {
      const result = convertColor(colorInput.value, alpha.value[0]);
      if (result) {
        convertedColors.value = result;
        error.value = null;
      } else {
        error.value = 'Invalid color format';
        convertedColors.value = null;
      }
    } catch {
      error.value = 'Invalid color format';
      convertedColors.value = null;
    }
  },
  { immediate: true }
);

const alphaPercent = computed(() => Math.round(alpha.value[0] * 100));

const colorFormats = computed(() => {
  if (!convertedColors.value) return [];

  return [
    { label: 'HEX', key: 'hex', value: convertedColors.value.hex },
    { label: 'RGB', key: 'rgb', value: convertedColors.value.rgb },
    { label: 'RGBA', key: 'rgba', value: convertedColors.value.rgba },
    { label: 'HSL', key: 'hsl', value: convertedColors.value.hsl },
    { label: 'HSLA', key: 'hsla', value: convertedColors.value.hsla },
    { label: 'LCH', key: 'lch', value: convertedColors.value.lch },
    { label: 'OKLCH', key: 'oklch', value: convertedColors.value.oklch },
  ];
});
</script>

<template>
  <div>
    <section class="mt-8">
      <div class="mb-6">
        <h2 class="text-2xl font-semibold">CSS Color Converter</h2>
        <p class="text-muted-foreground mt-1">
          Convert between different CSS color formats including modern LCH and OKLCH
        </p>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Input Section -->
        <Card>
          <CardHeader>
            <CardTitle>Input Color</CardTitle>
            <CardDescription>Enter a color in any CSS format</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <div class="space-y-2">
              <Label for="color-input">Color Value</Label>
              <div class="flex gap-2">
                <div class="relative">
                  <input
                    v-model="colorPickerValue"
                    type="color"
                    class="border-input h-10 w-14 cursor-pointer rounded-md border"
                    title="Pick a color"
                  />
                </div>
                <Input
                  id="color-input"
                  v-model="colorInput"
                  placeholder="e.g., #3b82f6, rgb(59, 130, 246), hsl(217, 91%, 60%)"
                  :class="{ 'border-destructive': error }"
                  class="flex-1"
                />
              </div>
              <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
              <p v-else class="text-muted-foreground text-sm">
                Supports HEX, RGB, HSL, LCH, OKLCH and more
              </p>
            </div>

            <div class="space-y-2">
              <Label for="alpha-slider">Opacity: {{ alphaPercent }}%</Label>
              <Slider
                id="alpha-slider"
                v-model="alpha"
                :min="0"
                :max="1"
                :step="0.01"
                class="w-full"
              />
            </div>

            <!-- Color Preview -->
            <div v-if="convertedColors" class="space-y-2">
              <Label>Preview</Label>
              <div
                class="border-border h-24 w-full rounded-lg border-2"
                :style="{ backgroundColor: convertedColors.rgba }"
              />
            </div>
          </CardContent>
        </Card>

        <!-- Output Section -->
        <Card>
          <CardHeader>
            <CardTitle>Converted Formats</CardTitle>
            <CardDescription>Click to copy any format to clipboard</CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="convertedColors" class="space-y-3">
              <div
                v-for="format in colorFormats"
                :key="format.key"
                class="bg-muted hover:bg-muted/80 flex items-center justify-between rounded-lg p-3 transition-colors"
              >
                <div class="min-w-0 flex-1">
                  <div class="mb-1 text-sm font-medium">{{ format.label }}</div>
                  <code class="text-muted-foreground text-xs break-all">{{ format.value }}</code>
                </div>
                <CopyButton :value="format.value" class="ml-2 flex-shrink-0" />
              </div>
            </div>

            <div v-else class="text-muted-foreground py-8 text-center">
              <p>Enter a valid color to see conversions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Examples Section -->
      <Card class="mt-6">
        <CardHeader>
          <CardTitle>Example Inputs</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="example in [
                '#3b82f6',
                '#ef4444',
                'rgb(59, 130, 246)',
                'hsl(217, 91%, 60%)',
                'rgba(239, 68, 68, 0.5)',
              ]"
              :key="example"
              variant="outline"
              size="sm"
              @click="colorInput = example"
            >
              {{ example }}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  </div>
</template>
