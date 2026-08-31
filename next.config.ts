import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Dev and production builds get separate output directories, so running a
  // build never disturbs a dev server that is already serving.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // An unrelated package-lock.json in the home directory makes Next infer the
  // wrong workspace root; pin it to this project.
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
}

export default nextConfig
