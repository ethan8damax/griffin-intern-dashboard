import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Each git worktree under .worktrees/ has its own .next/node_modules;
    // the patterns above don't match nested paths, so they'd otherwise lint
    // every worktree's build output too.
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
