<script setup lang="ts">
import { SearchIcon } from 'lucide-vue-next';
import KeyHint from '@/components/atoms/KeyHint.vue';
import { useCommandPaletteState } from '@/composables/useCommandPaletteState';

const { open } = useCommandPaletteState();
</script>

<template>
  <!--
    Shaped like a search field rather than labelled as a command palette: people
    recognise a search box without being told what it is, and clicking one is
    the thing they try first. The shortcut rides along beside it, so a few
    clicks in they stop needing the button.

    A button, not an input -- typing happens in the palette itself, and a real
    field here would take a keystroke and then throw it away.
  -->
  <button
    type="button"
    class="text-muted-foreground flex h-7 w-56 items-center gap-2 rounded-md border border-slate-300 px-2.5 text-sm transition-colors hover:bg-slate-50"
    @click="open"
  >
    <SearchIcon class="size-3.5 shrink-0 opacity-70" />
    <span class="truncate">Search…</span>
    <KeyHint accelerator="CommandOrControl+K" class="ml-auto shrink-0 scale-90" />
  </button>
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
