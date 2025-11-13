import { computed, ref } from 'vue';
import { useQueries } from './useQueries';

/**
 * Composable to detect if onboarding is needed
 * Returns whether the onboarding should be shown based on project count
 */
export function useFirstRunDetection() {
  const { useProjectsQuery } = useQueries();

  // Query all projects to check if any exist
  const projectsQuery = useProjectsQuery({
    search: ref(''),
    technologies: ref([]),
    includeArchived: ref(false),
  });

  /**
   * Whether onboarding needs to be shown
   * Returns true if no projects exist
   */
  const needsOnboarding = computed(() => {
    return (
      projectsQuery.isSuccess.value &&
      (!projectsQuery.data.value || projectsQuery.data.value.length === 0)
    );
  });

  /**
   * Whether the project query is still loading
   */
  const isLoading = computed(() => projectsQuery.isLoading.value);

  return {
    needsOnboarding,
    isLoading,
  };
}
