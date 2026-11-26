import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Motive · Vehicle Care',
    short_name: 'Motive',
    description: 'Track vehicle service history, parts, and maintenance costs.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#10141b',
    theme_color: '#10141b',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
