import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** Optional runtime crawlers — avoid Turbopack resolving missing packages at dev/build time. */
  serverExternalPackages: ["playwright"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
