import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "pwa-icon.svg", "og-default.svg", "placeholder.svg"],
        manifest: {
          name: "Silsilah Keluarga Digital",
          short_name: "Silsilah",
          description:
            "Bangun, visualisasikan, dan kelola pohon silsilah keluarga secara kolaboratif maupun offline.",
          theme_color: "#2e5a36",
          background_color: "#fbf9f5",
          display: "standalone",
          orientation: "any",
          start_url: "/",
          scope: "/",
          lang: "id",
          icons: [
            {
              src: "/pwa-icon.svg",
              sizes: "192x192 512x512",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: "/pwa-icon.svg",
              sizes: "192x192 512x512",
              type: "image/svg+xml",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Explicitly define environment variables to ensure they're available in local and production builds
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY),
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(env.VITE_SUPABASE_PROJECT_ID ?? process.env.VITE_SUPABASE_PROJECT_ID),
    },
  };
});
