'use client'

import { useLingui } from '@lingui/react/macro'
import { isLocale } from '@/lib/i18n'
import { useLanguage } from '@/components/i18n-provider'

export function LanguageSwitcher() {
  const { t } = useLingui()
  const { locale, setLocale } = useLanguage()

  return (
    <label className="language-control">
      <span className="sr-only">{t`Language`}</span>
      <select
        className="language-select"
        aria-label={t`Language`}
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value)
        }}
      >
        <option value="en">English</option>
        <option value="km">ភាសាខ្មែរ</option>
      </select>
    </label>
  )
}
