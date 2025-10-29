<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-vue-next';
import { RadioGroupItem } from '../../ui/radio-group';
import { Label } from '../../ui/label';
import type { FileNode } from '@/types/folder-tree';

interface Props {
  node: FileNode;
  level?: number;
  selectedPath?: string;
  parentPath: string;
}

const props = withDefaults(defineProps<Props>(), {
  level: 0,
});

const emit = defineEmits<{
  select: [path: string];
}>();

const isExpanded = ref(true); // Expanded by default
const fullPath = computed(() => `${props.parentPath}/${props.node.name}`);
const hasChildren = computed(() => props.node.children && props.node.children.length > 0);
const directories = computed(
  () => props.node.children?.filter(child => child.type === 'directory') || []
);
const isSelected = computed(() => props.selectedPath === fullPath.value);

const toggleExpanded = () => {
  if (hasChildren.value) {
    isExpanded.value = !isExpanded.value;
  }
};

const handleSelect = () => {
  emit('select', fullPath.value);
};
</script>

<template>
  <div>
    <div
      class="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-slate-100"
      :class="{ 'bg-sky-50 hover:bg-sky-100': isSelected }"
      :style="{ paddingLeft: `${level * 16 + 8}px` }"
    >
      <!-- Expand/collapse button -->
      <button
        v-if="hasChildren"
        type="button"
        @click="toggleExpanded"
        class="flex h-4 w-4 items-center justify-center text-slate-500 hover:text-slate-700"
      >
        <ChevronRight v-if="!isExpanded" :size="14" />
        <ChevronDown v-else :size="14" />
      </button>
      <div v-else class="w-4" />

      <!-- Radio button -->
      <RadioGroupItem :id="fullPath" :value="fullPath" @click="handleSelect" />

      <!-- Folder icon and name -->
      <Label
        :for="fullPath"
        class="flex flex-1 cursor-pointer items-center gap-2 text-sm font-normal"
        @click="handleSelect"
      >
        <Folder v-if="!isExpanded" :size="16" class="text-sky-500" />
        <FolderOpen v-else :size="16" class="text-sky-500" />
        <span class="truncate">{{ node.name }}</span>
      </Label>
    </div>

    <!-- Children (only directories) -->
    <div v-if="isExpanded && hasChildren">
      <FolderTreeItem
        v-for="child in directories"
        :key="child.path"
        :node="child"
        :level="level + 1"
        :selected-path="selectedPath"
        :parent-path="fullPath"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>
