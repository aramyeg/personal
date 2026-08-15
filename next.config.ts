import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      { source: '/labs/ps1', destination: '/labs/memory-card', permanent: true },
    ]
  },
}

export default nextConfig
