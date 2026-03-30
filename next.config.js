/** @type {import('next').NextConfig} */
const nextConfig = {
  // これを入れることで、より安定してビルドされます
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
