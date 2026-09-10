<script setup lang="ts">
import { computed, ref } from 'vue';
import { Button } from '@/components/ui/button';
import { eventToAccelerator, formatAccelerator } from '@/utils/accelerator';
import { useIsMac } from '@/composables/useIsMac';

const props = defineProps<{ disabled?: boolean }>();

const accelerator = defineModel<string>({ required: true });

const isRecording = ref(false);
const hint = ref<string | null>(null);

const isMac = useIsMac();
const display = computed(() =>
  accelerator.value ? formatAccelerator(accelerator.value, isMac.value) : 'Not set'
);

const startRecording = () => {
  if (props.disabled) return;
  isRecording.value = true;
  hint.value = null;
};

const stopRecording = () => {
  isRecording.value = false;
};

const onKeydown = (event: KeyboardEvent) => {
  if (!isRecording.value) return;

  // Always swallow the keystroke: the point of recording is to capture combos
  // that would otherwise trigger something else on the page.
  event.preventDefault();
  event.stopPropagation();

  if (event.key === 'Escape') {
    stopRecording();
    return;
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    accelerator.value = '';
    stopRecording();
    return;
  }

  const next = eventToAccelerator(event);

  // Null while only modifiers are held -- keep listening so the combo can be
  // completed rather than rejecting a half-pressed shortcut.
  if (!next) {
    hint.value = 'Hold a modifier (⌘, ⌃, ⌥ or ⇧) and press a key';
    return;
  }

  accelerator.value = next;
  hint.value = null;
  stopRecording();
};
</script>

<template>
  <div class="flex flex-col items-end gap-1">
    <Button
      type="button"
      variant="outline"
      class="min-w-32 font-mono"
      :disabled="disabled"
      :aria-label="isRecording ? 'Press your shortcut' : `Shortcut: ${display}`"
      @click="startRecording"
      @blur="stopRecording"
      @keydown="onKeydown"
    >
      {{ isRecording ? 'Press your shortcut…' : display }}
    </Button>
    <p v-if="hint" class="text-muted-foreground text-xs">{{ hint }}</p>
    <p v-else-if="isRecording" class="text-muted-foreground text-xs">
      Esc to cancel, Delete to clear
    </p>
  </div>
</template>
