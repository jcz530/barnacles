import { useRouter } from 'vue-router';
import { useQueries } from './useQueries';

const getGitProviderInfo = (remoteUrl: string): { name: string; webUrl: string } | null => {
  if (!remoteUrl) return null;

  // Convert SSH URLs to HTTPS format for processing
  let url = remoteUrl;
  if (url.startsWith('git@')) {
    url = url.replace('git@', 'https://').replace('.com:', '.com/');
  }

  // Remove .git suffix
  url = url.replace(/\.git$/, '');

  if (url.includes('github.com')) {
    return { name: 'GitHub', webUrl: url.replace(/^git\+/, '').replace(/^ssh:\/\//, '') };
  } else if (url.includes('gitlab.com')) {
    return { name: 'GitLab', webUrl: url.replace(/^git\+/, '').replace(/^ssh:\/\//, '') };
  } else if (url.includes('bitbucket.org')) {
    return { name: 'Bitbucket', webUrl: url.replace(/^git\+/, '').replace(/^ssh:\/\//, '') };
  }

  return null;
};

export const useProjectActions = () => {
  const router = useRouter();
  const {
    useDeleteProjectMutation,
    useRescanProjectMutation,
    useArchiveProjectMutation,
    useUnarchiveProjectMutation,
    useToggleFavoriteMutation,
    useDeleteThirdPartyPackagesMutation,
  } = useQueries();
  const deleteMutation = useDeleteProjectMutation();
  const rescanMutation = useRescanProjectMutation();
  const archiveMutation = useArchiveProjectMutation();
  const unarchiveMutation = useUnarchiveProjectMutation();
  const favoriteMutation = useToggleFavoriteMutation();
  const deletePackagesMutation = useDeleteThirdPartyPackagesMutation();

  const deleteProject = async (projectId: string, projectName: string) => {
    if (confirm(`Are you sure you want to delete "${projectName}"?`)) {
      try {
        await deleteMutation.mutateAsync(projectId);
        router.push('/projects');
      } catch (error) {
        console.error('Failed to delete project:', error);
        alert('Failed to delete project. Please try again.');
      }
    }
  };

  const rescanProject = async (projectId: string) => {
    try {
      await rescanMutation.mutateAsync(projectId);
    } catch (error) {
      console.error('Failed to rescan project:', error);
      alert('Failed to rescan project. Please try again.');
    }
  };

  const archiveProject = async (projectId: string) => {
    try {
      await archiveMutation.mutateAsync(projectId);
    } catch (error) {
      console.error('Failed to archive project:', error);
      alert('Failed to archive project. Please try again.');
    }
  };

  const unarchiveProject = async (projectId: string) => {
    try {
      await unarchiveMutation.mutateAsync(projectId);
    } catch (error) {
      console.error('Failed to unarchive project:', error);
      alert('Failed to unarchive project. Please try again.');
    }
  };

  const toggleFavorite = async (projectId: string) => {
    try {
      await favoriteMutation.mutateAsync(projectId);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      alert('Failed to toggle favorite. Please try again.');
    }
  };

  const openInFinder = (projectPath: string) => {
    window.electron?.shell.openPath(projectPath);
  };

  const copyPath = async (projectPath: string) => {
    try {
      await navigator.clipboard.writeText(projectPath);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy path:', error);
      alert('Failed to copy path to clipboard.');
    }
  };

  const openGitRemote = (remoteUrl: string) => {
    const provider = getGitProviderInfo(remoteUrl);
    if (provider) {
      window.electron?.shell.openExternal(provider.webUrl);
    } else {
      console.error('Could not determine git provider from URL:', remoteUrl);
    }
  };

  const getGitProvider = (remoteUrl: string | null | undefined) => {
    if (!remoteUrl) return null;
    return getGitProviderInfo(remoteUrl);
  };

  const deleteThirdPartyPackages = async (projectId: string, thirdPartySize?: number | null) => {
    const sizeText = thirdPartySize ? ` (${formatBytes(thirdPartySize)})` : '';
    if (
      confirm(
        `Are you sure you want to delete all third-party packages${sizeText}? This action cannot be undone.`
      )
    ) {
      try {
        const result = await deletePackagesMutation.mutateAsync(projectId);
        const deletedSizeText = formatBytes(result?.deletedSize || 0);
        alert(`Successfully deleted ${deletedSizeText} of third-party packages.`);
      } catch (error) {
        console.error('Failed to delete packages:', error);
        alert('Failed to delete packages. Please try again.');
      }
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return {
    deleteProject,
    rescanProject,
    archiveProject,
    unarchiveProject,
    toggleFavorite,
    openInFinder,
    copyPath,
    openGitRemote,
    getGitProvider,
    deleteThirdPartyPackages,
    isDeleting: deleteMutation.isPending,
    isRescanning: rescanMutation.isPending,
    isArchiving: archiveMutation.isPending,
    isUnarchiving: unarchiveMutation.isPending,
    isTogglingFavorite: favoriteMutation.isPending,
    isDeletingPackages: deletePackagesMutation.isPending,
  };
};
