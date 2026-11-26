'use client'

import { Printer } from 'lucide-react'
import { useLingui } from '@lingui/react/macro'

export function PrintButton() {
  const { t } = useLingui()
  return (
    <button className="button primary" onClick={() => window.print()}>
      <Printer size={16} /> {t`Print / Save PDF`}
    </button>
  )
}
