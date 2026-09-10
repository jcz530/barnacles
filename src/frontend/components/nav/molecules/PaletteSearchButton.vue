<script setup lang="ts">
import { SearchIcon } from 'lucide-vue-next';
import KeyHint from '@/components/atoms/KeyHint.vue';
import { Button } from '@/components/ui/button';
import { useCommandPaletteState } from '@/composables/useCommandPaletteState';

const { open } = useCommandPaletteState();
</script>

<template>
  <!--
    Shaped like a search field rather than labelled as a command palette: people
    recognise a search box without being told what it is, and clicking one is
    the thing they try first. The shortcut rides along beside it, so a few
    clicks in they stop needing to click.

    A button, not an input -- typing happens in the palette itself, and a real
    field here would swallow a keystroke and then throw it away. The outline
    variant already reads as a field, and brings the app's own border, hover and
    focus ring with it; its shadow is dropped, since a field sits flat in the
    chrome rather than lifting off it the way a button does. SidebarInput does
    the same.
  -->
  <Button
    variant="outline"
    size="sm"
    class="text-muted-foreground w-64 justify-start gap-2 pr-1.5 pl-2.5 font-normal shadow-none"
    @click="open"
  >
    <SearchIcon class="size-4 shrink-0 opacity-70" />
    <span class="truncate">Search…</span>
    <!--
      Wrapped so the gap sits outside the chip's border. Padding on the chip
      itself would push its glyph around inside the box instead of separating
      the chip from the label.
    -->
    <span class="ml-auto shrink-0 pl-2">
      <KeyHint accelerator="CommandOrControl+K" size="sm" />
    </span>
  </Button>
</template>

<style scoped>
/*
 * The title bar is a drag region, and a scoped rule there cannot reach into
 * this component -- without this the button moves the window instead of
 * opening anything.
 */
button {
  -webkit-app-region: no-drag;
}
</style>
