<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTheme } from '@/composables/useTheme';
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { Check, Palette, Plus } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Card from '@/components/ui/card/Card.vue';
import CardHeader from '@/components/ui/card/CardHeader.vue';
import CardTitle from '@/components/ui/card/CardTitle.vue';
import CardDescription from '@/components/ui/card/CardDescription.vue';
import CardContent from '@/components/ui/card/CardContent.vue';

const router = useRouter();
const { setBreadcrumbs } = useBreadcrumbs();
const { themes, activeTheme, activateTheme, isLoading } = useTheme();

const defaultThemes = computed(() => themes.value.filter(t => t.isDefault));
const customThemes = computed(() => themes.value.filter(t => !t.isDefault));

onMounted(() => {
  setBreadcrumbs([{ label: 'Settings', to: '/settings' }, { label: 'Themes' }]);
});

async function handleActivateTheme(themeId: string) {
  try {
    await activateTheme(themeId);
  } catch (error) {
    console.error('Failed to activate theme:', error);
  }
}

function handleCreateTheme() {
  router.push('/themes/new');
}

function handleEditTheme(themeId: string) {
  router.push(`/themes/${themeId}/edit`);
}
</script>

<template>
  <div class="pb-8">
    <section class="mt-8">
      <div class="mb-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-semibold">Themes</h2>
            <p class="text-muted-foreground mt-1">Choose a theme or create your own</p>
          </div>
          <Button @click="handleCreateTheme">
            <Plus class="mr-2 h-4 w-4" />
            Create Theme
          </Button>
        </div>
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="text-muted-foreground text-sm">Loading themes...</div>
      </div>

      <div v-else class="space-y-8">
        <!-- Default Themes -->
        <Card>
          <CardHeader>
            <CardTitle>Default Themes</CardTitle>
            <CardDescription>Pre-designed themes from the Barnacles team</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <button
                v-for="theme in defaultThemes"
                :key="theme.id"
                class="group hover:border-primary/50 hover:bg-accent/50 relative flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all"
                :class="{
                  'border-primary bg-accent': activeTheme?.id === theme.id,
                  'border-border': activeTheme?.id !== theme.id,
                }"
                @click="handleActivateTheme(theme.id)"
              >
                <!-- Color Preview -->
                <div class="flex flex-shrink-0 gap-1.5">
                  <div
                    class="h-12 w-8 rounded border"
                    :style="{ backgroundColor: theme.primaryColor }"
                  />
                  <div
                    class="h-12 w-8 rounded border"
                    :style="{ backgroundColor: theme.slateColor }"
                  />
                </div>

                <!-- Theme Info -->
                <div class="min-w-0 flex-1 text-left">
                  <div class="mb-1.5 flex items-center gap-2">
                    <span class="truncate text-base font-medium">{{ theme.name }}</span>
                    <Check
                      v-if="activeTheme?.id === theme.id"
                      class="text-primary h-4 w-4 flex-shrink-0"
                    />
                  </div>
                  <div class="text-muted-foreground mb-2 flex items-center gap-2 text-xs">
                    <Badge variant="outline" class="px-1.5 py-0.5 text-[10px]">
                      {{ theme.borderRadius }}
                    </Badge>
                    <span>•</span>
                    <span>Shadow: {{ theme.shadowIntensity }}</span>
                  </div>
                  <button
                    class="text-primary text-xs font-medium hover:underline"
                    @click.stop="handleEditTheme(theme.id)"
                  >
                    Customize →
                  </button>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        <!-- Custom Themes -->
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <div>
                <CardTitle>Custom Themes</CardTitle>
                <CardDescription>Your personalized theme creations</CardDescription>
              </div>
              <Button variant="outline" size="sm" @click="handleCreateTheme">
                <Plus class="mr-1.5 h-4 w-4" />
                New Theme
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div v-if="customThemes.length === 0" class="py-12 text-center">
              <Palette class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 class="mb-2 text-lg font-semibold">No custom themes yet</h3>
              <p class="text-muted-foreground mb-6 text-sm">
                Create your first custom theme to match your style
              </p>
              <Button @click="handleCreateTheme">
                <Plus class="mr-2 h-4 w-4" />
                Create Your First Theme
              </Button>
            </div>

            <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <button
                v-for="theme in customThemes"
                :key="theme.id"
                class="group hover:border-primary/50 hover:bg-accent/50 relative flex items-start gap-3 rounded-lg border p-4 transition-all"
                :class="{
                  'border-primary bg-accent': activeTheme?.id === theme.id,
                  'border-border': activeTheme?.id !== theme.id,
                }"
                @click="handleActivateTheme(theme.id)"
              >
                <!-- Color Preview -->
                <div class="flex flex-shrink-0 gap-1.5">
                  <div
                    class="h-12 w-8 rounded border"
                    :style="{ backgroundColor: theme.primaryColor }"
                  />
                  <div
                    class="h-12 w-8 rounded border"
                    :style="{ backgroundColor: theme.slateColor }"
                  />
                </div>

                <!-- Theme Info -->
                <div class="min-w-0 flex-1 text-left">
                  <div class="mb-1.5 flex items-center gap-2">
                    <span class="truncate text-base font-medium">{{ theme.name }}</span>
                    <Check
                      v-if="activeTheme?.id === theme.id"
                      class="text-primary h-4 w-4 flex-shrink-0"
                    />
                  </div>
                  <div class="text-muted-foreground mb-2 flex items-center gap-2 text-xs">
                    <Badge variant="outline" class="px-1.5 py-0.5 text-[10px]">
                      {{ theme.borderRadius }}
                    </Badge>
                    <span>•</span>
                    <span>Shadow: {{ theme.shadowIntensity }}</span>
                  </div>
                  <button
                    class="text-primary text-xs font-medium hover:underline"
                    @click.stop="handleEditTheme(theme.id)"
                  >
                    Edit →
                  </button>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  </div>
</template>
