<script setup lang="ts">
defineProps<{
  content: string | number;
}>();
</script>

<template>
  <td class="border-b px-4 py-2">
    {{ content }}
  </td>
</template>
