import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Dollar Since 1995",
        short_name: "Dollar 1995",
        description: "Explore US inflation and convert dollar values between dates.",
        theme_color: "#0b2c33",
        background_color: "#edf4f2",
        display: "standalone",
        start_url: "/",
        scope: "/",
        orientation: "any",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}", "data/inflation.json"],
        globIgnores: ["data/coeff-map/**/*"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: /\/data\/coeff-map\/.*\.(?:json|geojson)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "coefficient-map-data",
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /\/data\/inflation\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "inflation-data",
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 45 }
            }
          }
        ]
      }
    })
  ]
});
