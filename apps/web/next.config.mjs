/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@inssnapp/engine", "@inssnapp/auth"],
};

export default nextConfig;
