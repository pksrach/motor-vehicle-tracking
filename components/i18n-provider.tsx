'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { I18nProvider } from '@lingui/react'
import { createI18n, type Locale } from '@/lib/i18n'

const LanguageContext = createContext<{
  locale: Locale
  setLocale: (locale: Locale) => void
} | null>(null)

export function AppI18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale
  children: ReactNode
}) {
  const [locale, setCurrentLocale] = useState(initialLocale)
  const [i18n] = useState(() => createI18n(initialLocale))

  function setLocale(nextLocale: Locale) {
    i18n.activate(nextLocale)
    setCurrentLocale(nextLocale)
    document.cookie = `locale=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`
    document.documentElement.lang = nextLocale
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      <I18nProvider i18n={i18n}>{children}</I18nProvider>
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within AppI18nProvider')
  return context
}
