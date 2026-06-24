export function statusColorClass(statusCode: number | null): string {
  if (statusCode === null) return 'text-slate-400';
  if (statusCode < 300) return 'text-success-500';
  if (statusCode < 400) return 'text-secondary-500';
  return 'text-danger-500';
}
