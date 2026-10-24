import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The sim saves references as `[${constructor.name}:id]` and restores them by name,
  // so its class names must survive: bundling minifies them (`[A:p1a]`, not `[Pokemon:p1a]`).
  serverExternalPackages: ["@pkmn/sim"],
};

export default nextConfig;
