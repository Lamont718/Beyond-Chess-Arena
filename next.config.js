/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lint is run separately; don't let lint-rule noise block a deploy.
  eslint: { ignoreDuringBuilds: true },
  // Type errors DO block the build now that the tree is type-clean — this is our
  // safety net against shipping real bugs (was previously disabled).
  typescript: { ignoreBuildErrors: false },
};

module.exports = nextConfig;
