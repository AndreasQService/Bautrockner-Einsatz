import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Service Worker wird automatisch aktualisiert wenn neue Version verfügbar

      // Welche Dateien gecached werden (Precache = sofort beim ersten Laden)
      includeAssets: ['vite.svg', 'logo.png'],

      // Web App Manifest (für "Zum Homescreen hinzufügen")
      manifest: {
        name: 'QTool – Q-Service',
        short_name: 'QTool',
        description: 'Bautrockner-Einsatz Dokumentation – auch offline',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        orientation: 'any',
        lang: 'de',
        icons: [
          {
            src: 'vite.svg',
            sizes: '48x48',
            type: 'image/svg+xml',
          }
        ]
      },

      // Workbox Konfiguration: Caching-Strategie
      workbox: {
        // Alle JS/CSS/HTML/Assets sofort precachen
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],

        // Das App-Bundle ist groß (react-pdf, exceljs etc.) → Limit erhöhen
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        // Cache-Strategien für verschiedene Request-Typen:
        runtimeCaching: [
          {
            // Google Fonts → Cache First (offline verfügbar)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // App-eigene Assets → StaleWhileRevalidate (offline OK, im Hintergrund aktualisiert)
            urlPattern: /\/src\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'qtool-assets',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // OpenAI API → NetworkOnly (kein Cache – funktioniert nur online)
            // Wenn offline: App zeigt Fehlermeldung, aber stürzt nicht ab
            urlPattern: /^https:\/\/api\.openai\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Supabase → NetworkOnly (Daten kommen aus localStorage wenn offline)
            urlPattern: /supabase\.co/i,
            handler: 'NetworkOnly',
          },
        ],
      },

      // Entwicklungsmodus: Service Worker auch beim `npm run dev` aktiv
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    proxy: {
      '/openai-api': {
        target: 'https://api.openai.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openai-api/, ''),
      },
      '/osm-tile': {
        target: 'https://tile.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/osm-tile/, ''),
        headers: { 'User-Agent': 'QTool/1.0 (q-service.ch)' },
      },
      '/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ''),
        headers: { 'User-Agent': 'QTool/1.0 (q-service.ch)', 'Accept-Language': 'de' },
      },
    }
  }
})
