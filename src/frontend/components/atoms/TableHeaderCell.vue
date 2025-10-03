<script setup lang="ts">
defineProps<{
  content: string;
}>();
</script>

<template>
  <th class="border-b-2 px-4 py-2 text-left font-semibold">
    {{ content }}
  </th>
</template>
