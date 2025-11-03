<script setup lang="ts">
import { Button } from '@/components/ui/button';

const variants = [
  'default',
  'destructive',
  'success',
  'outline',
  'secondary',
  'ghost',
  'link',
] as const;
const sizes = ['default', 'sm', 'lg', 'icon'] as const;

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
</script>

<template>
  <div class="space-y-12 p-8">
    <div>
      <h1 class="mb-2 text-3xl font-bold">Design System</h1>
      <p class="text-muted-foreground">
        Development only - Visual reference for all button variants
      </p>
    </div>

    <!-- Button Variants Section -->
    <section>
      <h2 class="mb-6 text-2xl font-semibold">Button Variants</h2>

      <!-- All Variants with Default Size -->
      <div class="space-y-8">
        <div>
          <h3 class="mb-4 text-lg font-medium">Default Size</h3>
          <div class="flex flex-wrap gap-4">
            <div v-for="variant in variants" :key="variant" class="flex flex-col items-start gap-2">
              <Button :variant="variant">{{ variant }}</Button>
              <span class="text-muted-foreground text-xs">{{ variant }}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 class="mb-4 text-lg font-medium">Small Size</h3>
          <div class="flex flex-wrap gap-4">
            <div v-for="variant in variants" :key="variant" class="flex flex-col items-start gap-2">
              <Button :variant="variant" size="sm">{{ variant }}</Button>
              <span class="text-muted-foreground text-xs">{{ variant }}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 class="mb-4 text-lg font-medium">Large Size</h3>
          <div class="flex flex-wrap gap-4">
            <div v-for="variant in variants" :key="variant" class="flex flex-col items-start gap-2">
              <Button :variant="variant" size="lg">{{ variant }}</Button>
              <span class="text-muted-foreground text-xs">{{ variant }}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 class="mb-4 text-lg font-medium">Icon Size</h3>
          <div class="flex flex-wrap gap-4">
            <div v-for="variant in variants" :key="variant" class="flex flex-col items-start gap-2">
              <Button :variant="variant" size="icon" v-html="iconSvg" />
              <span class="text-muted-foreground text-xs">{{ variant }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Button States Section -->
    <section>
      <h2 class="mb-6 text-2xl font-semibold">Button States</h2>

      <div class="space-y-6">
        <div>
          <h3 class="mb-4 text-lg font-medium">Disabled State</h3>
          <div class="flex flex-wrap gap-4">
            <div v-for="variant in variants" :key="variant" class="flex flex-col items-start gap-2">
              <Button :variant="variant" disabled>{{ variant }}</Button>
              <span class="text-muted-foreground text-xs">{{ variant }}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 class="mb-4 text-lg font-medium">With Icon (Left)</h3>
          <div class="flex flex-wrap gap-4">
            <div
              v-for="variant in variants.slice(0, 4)"
              :key="variant"
              class="flex flex-col items-start gap-2"
            >
              <Button :variant="variant">
                <span v-html="iconSvg"></span>
                {{ variant }}
              </Button>
              <span class="text-muted-foreground text-xs">{{ variant }}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 class="mb-4 text-lg font-medium">With Icon (Right)</h3>
          <div class="flex flex-wrap gap-4">
            <div
              v-for="variant in variants.slice(0, 4)"
              :key="variant"
              class="flex flex-col items-start gap-2"
            >
              <Button :variant="variant">
                {{ variant }}
                <span v-html="iconSvg"></span>
              </Button>
              <span class="text-muted-foreground text-xs">{{ variant }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Size Comparison -->
    <section>
      <h2 class="mb-6 text-2xl font-semibold">Size Comparison (Default Variant)</h2>
      <div class="flex items-end gap-4">
        <div class="flex flex-col items-center gap-2">
          <Button size="sm">Small</Button>
          <span class="text-muted-foreground text-xs">sm</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Button size="default">Default</Button>
          <span class="text-muted-foreground text-xs">default</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Button size="lg">Large</Button>
          <span class="text-muted-foreground text-xs">lg</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Button size="icon" v-html="iconSvg" />
          <span class="text-muted-foreground text-xs">icon</span>
        </div>
      </div>
    </section>
  </div>
</template>
