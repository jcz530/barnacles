import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';

// Configure dayjs plugins
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

export const useFormatters = () => {
  const formatSize = (bytes: number | null | undefined): string => {
    if (!bytes) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return 'Unknown';
    return dayjs(date).format('MMMM D, YYYY, h:mm A');
  };

  const formatShortDate = (date: Date | null | undefined): string => {
    if (!date) return 'Unknown';
    return dayjs(date).format('MMM D, YYYY');
  };

  const formatRelativeDate = (date: Date | null | undefined): string => {
    if (!date) return 'Unknown';
    return dayjs(date).fromNow();
  };

  return {
    formatSize,
    formatDate,
    formatShortDate,
    formatRelativeDate,
  };
};
