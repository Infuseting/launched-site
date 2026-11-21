'use client';

import type { ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';

export const DashboardModalTitle = Dialog.Title;

/** Share focus trapping, Escape, scroll locking and focus restoration across forms. */
export function DashboardModal({
  open,
  onClose,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="dashboard-modal-layer fixed inset-0 bg-black/80 backdrop-blur-sm" />
        <Dialog.Viewport className="dashboard-modal-layer fixed inset-0 overflow-y-auto flex items-center justify-center p-4">
          <Dialog.Popup className={className} aria-describedby={undefined}>
            {children}
            <Dialog.Close className="sr-only" tabIndex={-1}>
              Fermer la fenêtre
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
