import { Analytics } from '@vercel/analytics/next'
import { msg } from '@lingui/core/macro'
import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { AppI18nProvider } from '@/components/i18n-provider'
import { createI18n, isLocale, type Locale } from '@/lib/i18n'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const localeValue = cookieStore.get('locale')?.value ?? 'en'
  const locale: Locale = isLocale(localeValue) ? localeValue : 'en'
  const i18n = createI18n(locale)

  return {
    title: i18n._(msg`Motor & Vehicle Tracking`),
    description: i18n._(
      msg`Keep every vehicle service, part replacement, and maintenance cost in one place.`,
    ),
    generator: 'v0.app',
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: 'Motive',
      statusBarStyle: 'black-translucent',
    },
  }
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#10141b',
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const localeValue = cookieStore.get('locale')?.value ?? 'en'
  const locale: Locale = isLocale(localeValue) ? localeValue : 'en'

  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body className="antialiased">
        <AppI18nProvider initialLocale={locale}>
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </AppI18nProvider>
      </body>
    </html>
  )
}
