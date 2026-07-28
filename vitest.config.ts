import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // Mirrors tsconfig.json's "@/*" -> "./src/*" path mapping, which vitest
  // doesn't read on its own. Needed now that a tested module
  // (src/lib/auth/ownership.ts) imports another src file via "@/...".
  //
  // ponytail: outside Next's RSC build, "server-only" throws unconditionally
  // on import (it relies on a webpack/turbopack resolve condition vitest
  // doesn't set). Alias it straight to the package's own no-op stub
  // (node_modules/server-only/empty.js — the same file Next resolves to
  // server-side via its "react-server" export condition) instead of
  // reimplementing that stub as a custom Vite plugin.
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    // Each git worktree under .worktrees/ has its own copy of every *.test.ts
    // file; vitest's defaults don't exclude it, so tests would otherwise run
    // twice (once here, once from the worktree's own file).
    exclude: [...configDefaults.exclude, ".worktrees/**"],
  },
});
