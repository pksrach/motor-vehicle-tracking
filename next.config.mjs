import { linguiMacroSwcPlugin } from '@lingui/swc-plugin/options'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    swcPlugins: [linguiMacroSwcPlugin()],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
