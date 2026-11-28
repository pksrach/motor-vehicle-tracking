'use client'

import { useId, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { useLingui } from '@lingui/react/macro'

type ConfirmDialogProps = {
  title: ReactNode
  description: ReactNode
  confirmLabel: ReactNode
  confirmVariant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useLingui()
  const titleId = useId()
  const descriptionId = useId()

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onCancel()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') onCancel()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={handleBackdropClick}>
      <section
        className="modal confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
      >
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
        </header>
        <div className="modal-actions">
          <button type="button" className="button quiet" onClick={onCancel} autoFocus>
            {t`Cancel`}
          </button>
          <button
            type="button"
            className={`button ${confirmVariant === 'danger' ? 'confirm-danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
