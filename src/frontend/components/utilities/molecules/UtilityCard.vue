<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import * as LucideIcons from 'lucide-vue-next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { UtilityMetadata } from '@/utilities/types';

interface Props {
  utility: UtilityMetadata;
}

const props = defineProps<Props>();
const router = useRouter();

// Dynamically get the icon component
const IconComponent = computed(() => {
  const iconName = props.utility.icon as keyof typeof LucideIcons;
  return LucideIcons[iconName] || LucideIcons.Wrench;
});

function navigateToUtility() {
  router.push(props.utility.route);
}
</script>

<template>
  <Card
    class="hover:border-primary/50 cursor-pointer transition-all hover:shadow-lg"
    @click="navigateToUtility"
  >
    <CardHeader>
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="bg-primary/10 rounded-lg p-2">
            <component :is="IconComponent" class="text-primary h-6 w-6" />
          </div>
          <div>
            <CardTitle class="text-lg">{{ utility.name }}</CardTitle>
          </div>
        </div>
        <div v-if="utility.cli" class="flex gap-1">
          <Badge variant="secondary" class="text-xs">CLI</Badge>
        </div>
      </div>
      <CardDescription class="mt-2">{{ utility.description }}</CardDescription>
    </CardHeader>
    <CardContent v-if="utility.tags && utility.tags.length > 0" class="pt-0">
      <div class="flex flex-wrap gap-1">
        <Badge v-for="tag in utility.tags" :key="tag" variant="outline" class="text-xs">
          {{ tag }}
        </Badge>
      </div>
    </CardContent>
  </Card>
</template>
