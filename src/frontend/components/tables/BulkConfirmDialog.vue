<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BulkActionConfirm } from './types/bulk';

defineProps<{
  open: boolean;
  confirm: BulkActionConfirm;
  count: number;
}>();

const emit = defineEmits<{
  'update:open': [open: boolean];
  confirm: [];
  cancel: [];
}>();

function handleOpenChange(open: boolean) {
  emit('update:open', open);
  if (!open) {
    emit('cancel');
  }
}
</script>

<template>
  <AlertDialog :open="open" @update:open="handleOpenChange">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ confirm.title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ confirm.description(count) }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="emit('cancel')">Cancel</AlertDialogCancel>
        <AlertDialogAction
          :class="
            confirm.variant === 'destructive' ? cn(buttonVariants({ variant: 'destructive' })) : ''
          "
          @click="emit('confirm')"
        >
          {{ confirm.confirmLabel ?? 'Confirm' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
