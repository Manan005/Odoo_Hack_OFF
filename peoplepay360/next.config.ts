import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack's persistent dev cache compacts its database for minutes at a
    // time on this 4-core laptop, stalling every request behind it (the
    // "stuck skeleton"). In-memory compilation is fast enough for the demo.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
