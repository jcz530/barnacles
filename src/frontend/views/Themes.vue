<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { Palette, Plus } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import Card from '@/components/ui/card/Card.vue';
import CardHeader from '@/components/ui/card/CardHeader.vue';
import CardTitle from '@/components/ui/card/CardTitle.vue';
import CardDescription from '@/components/ui/card/CardDescription.vue';
import CardContent from '@/components/ui/card/CardContent.vue';
import ThemeCard from '@/components/settings/molecules/ThemeCard.vue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const { setBreadcrumbs } = useBreadcrumbs();
const { themes, activeTheme, deleteTheme, isLoading } = useTheme();

const defaultThemes = computed(() => themes.value.filter(t => t.isDefault));
const customThemes = computed(() => themes.value.filter(t => !t.isDefault));

const deleteDialogOpen = ref(false);
const themeToDelete = ref<string | null>(null);
const themeToDeleteName = computed(() => {
  if (!themeToDelete.value) return '';
  const theme = themes.value.find(t => t.id === themeToDelete.value);
  return theme?.name || '';
});

onMounted(() => {
  setBreadcrumbs([{ label: 'Settings', href: '/settings' }, { label: 'Themes' }]);
});

function handleDeleteTheme(themeId: string) {
  themeToDelete.value = themeId;
  deleteDialogOpen.value = true;
}

async function confirmDelete() {
  if (!themeToDelete.value) return;

  try {
    await deleteTheme(themeToDelete.value);
    deleteDialogOpen.value = false;
    themeToDelete.value = null;
  } catch (error) {
    console.error('Failed to delete theme:', error);
  }
}

function cancelDelete() {
  deleteDialogOpen.value = false;
  themeToDelete.value = null;
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
          <RouterLink :to="{ name: 'ThemeNew' }">
            <Button variant="default" size="sm">
              <Plus class="mr-2 h-4 w-4" />
              Create Theme
            </Button>
          </RouterLink>
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
              <ThemeCard
                v-for="theme in defaultThemes"
                :key="theme.id"
                :theme="theme"
                :is-active="activeTheme?.id === theme.id"
              />
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
              <RouterLink :to="{ name: 'ThemeNew' }">
                <Button variant="outline">
                  <Plus class="mr-1.5 h-4 w-4" />
                  New Theme
                </Button>
              </RouterLink>
            </div>
          </CardHeader>
          <CardContent>
            <div v-if="customThemes.length === 0" class="py-12 text-center">
              <Palette class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 class="mb-2 text-lg font-semibold">No custom themes yet</h3>
              <p class="text-muted-foreground mb-6 text-sm">
                Create your first custom theme to match your style
              </p>
              <RouterLink :to="{ name: 'ThemeNew' }">
                <Button>
                  <Plus class="mr-2 h-4 w-4" />
                  Create Your First Theme
                </Button>
              </RouterLink>
            </div>

            <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <ThemeCard
                v-for="theme in customThemes"
                :key="theme.id"
                :theme="theme"
                :is-active="activeTheme?.id === theme.id"
                @delete="handleDeleteTheme"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="deleteDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Theme</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{{ themeToDeleteName }}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="cancelDelete">Cancel</Button>
          <Button variant="destructive" @click="confirmDelete">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
