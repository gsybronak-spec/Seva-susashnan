// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { cloudflare } from "@cloudflare/vite-plugin";

const isVercelBuild = process.env.BUILD_TARGET === "vercel";

export default defineConfig({
  plugins: isVercelBuild
    ? []
    : [
        cloudflare({
          viteEnvironment: { name: "ssr" },
        }),
      ],
  tanstackStart: isVercelBuild
    ? {
        server: { entry: "server" },
      }
    : undefined,
  nitro: isVercelBuild
    ? {
        preset: "vercel",
      }
    : false,
});
