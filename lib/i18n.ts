import { setupI18n } from '@lingui/core'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { messages as kmMessages } from '@/locales/km/messages.mjs'

export const locales = ['en', 'km'] as const
export type Locale = (typeof locales)[number]

export const isLocale = (locale: string): locale is Locale => locale === 'en' || locale === 'km'

export function createI18n(locale: Locale) {
  return setupI18n({
    locale,
    messages: {
      en: enMessages,
      km: kmMessages,
    },
  })
}
