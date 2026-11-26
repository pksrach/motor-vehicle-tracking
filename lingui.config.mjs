import { formatter } from '@lingui/format-po'

const config = {
  locales: ['en', 'km'],
  sourceLocale: 'en',
  catalogs: [
    {
      path: '<rootDir>/locales/{locale}/messages',
      include: ['<rootDir>/app', '<rootDir>/components', '<rootDir>/lib'],
    },
  ],
  format: formatter(),
  compileNamespace: 'es',
  orderBy: 'messageId',
  macro: {
    corePackage: ['@lingui/core/macro'],
    jsxPackage: ['@lingui/react/macro'],
  },
}

export default config
