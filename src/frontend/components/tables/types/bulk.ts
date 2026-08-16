/**
 * The rows a bulk action should act on.
 *
 * Augustus's equivalent passes the raw all/include/exclude selection plus the
 * active filters, because its Laravel backend has to reconstruct the row set
 * server-side. Barnacles holds every row in memory, so the selection is
 * resolved to concrete ids before the action ever runs — an action just gets
 * the list it operates on.
 */
export interface BulkPayload {
  ids: string[];
}

export interface BulkResult {
  affected: number;
  skipped?: number;
  failed?: Array<{ id: string; reason: string }>;
  message: string;
}

export interface BulkActionConfirm {
  title: string;
  description: (count: number) => string;
  confirmLabel?: string;
  variant?: 'default' | 'destructive';
}

export interface BulkAction {
  key: string;
  label: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  confirm?: BulkActionConfirm;
  run: (payload: BulkPayload) => Promise<BulkResult>;
}
