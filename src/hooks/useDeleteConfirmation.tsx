import React, { useCallback, useState } from 'react';
import { DeleteConfirmationModal, DeleteConfirmationModalProps } from '../components/common/DeleteConfirmationModal';

type ConfirmationOptions = Omit<DeleteConfirmationModalProps, 'visible' | 'onConfirm' | 'onCancel'>;

interface ConfirmationState extends ConfirmationOptions {
  resolve: (result: boolean) => void;
}

export const useDeleteConfirmation = () => {
  const [state, setState] = useState<ConfirmationState | null>(null);

  const confirmDelete = useCallback(
    (options?: ConfirmationOptions) => {
      return new Promise<boolean>((resolve) => {
        setState({
          title: options?.title ?? 'Delete item',
          message:
            options?.message ??
            'Are you sure you want to delete this item? This action cannot be undone.',
          confirmText: options?.confirmText ?? 'Delete',
          cancelText: options?.cancelText ?? 'Cancel',
          resolve,
        });
      });
    },
    []
  );

  const closeModal = useCallback((confirmed: boolean) => {
    setState((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const DeleteConfirmationElement = (
    <DeleteConfirmationModal
      visible={!!state}
      title={state?.title}
      message={state?.message}
      confirmText={state?.confirmText}
      cancelText={state?.cancelText}
      onConfirm={() => closeModal(true)}
      onCancel={() => closeModal(false)}
    />
  );

  return {
    confirmDelete,
    DeleteConfirmationModal: DeleteConfirmationElement,
  };
};
