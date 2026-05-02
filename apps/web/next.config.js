/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@groupspeak/shared"],
  experimental: {
    typedRoutes: false,
  },
};
module.exports = nextConfig;
