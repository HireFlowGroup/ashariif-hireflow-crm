import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    files: [
      "**/*-client.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
      "src/lib/supabase/client.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "async_hooks",
              message:
                "async_hooks is Node.js-only and must not be imported in client code.",
            },
          ],
          patterns: [
            {
              group: [
                "@/features/provider-vault/server",
                "@/features/provider-vault/server/**",
              ],
              message:
                "Provider vault server modules are server-only. Use @/features/provider-vault/client or @/features/provider-vault/shared.",
            },
            {
              group: ["@/platform/config/env", "@/lib/env"],
              message:
                "Server env module pulls provider vault. Use @/platform/config/public-env in client code.",
            },
            {
              group: [
                "@/features/intelligent-search/server",
                "@/features/intelligent-search/server/**",
                "@/features/intelligent-search/services/intelligent-search-parser.service",
              ],
              message:
                "Intelligent search parser is server-only. Use @/features/intelligent-search for client-safe types.",
            },
            {
              group: [
                "@/features/lead-intelligence/providers/manager/provider-env",
              ],
              message: "provider-env is server-only (org context + vault credentials).",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
