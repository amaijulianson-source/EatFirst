import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
const base = process.env.BASE_PATH || "/";
export default defineConfig({
  base,
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-cloud": ["@supabase/supabase-js"],
          "vendor-database": ["dexie"],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      scope: base,
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "EatFirst",
        short_name: "EatFirst",
        description: "Make good food go further",
        theme_color: "#225c43",
        background_color: "#f7f8f2",
        display: "standalone",
        id: base,
        scope: base,
        start_url: base,
        icons: [
          { src: `${base}icon-192.png`, sizes: "192x192", type: "image/png" },
          {
            src: `${base}icon-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${base}icon-maskable.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist:
          base === "/EatFirst/" ? [/\/v2-preview(?:\/|$)/] : [],
      },
    }),
  ],
});
