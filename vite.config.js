import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  envDir: __dirname,
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg', 'logo.png'],
      manifest: {
        name: 'QTool – Q-Service (Test)',
        short_name: 'QTool-Test',
        description: 'Bautrockner-Einsatz Dokumentation – Testumgebung',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        orientation: 'any',
        lang: 'de',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'app-icon.png', sizes: '192x192', type: 'image/png' },
          { src: 'app-icon.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        cacheId: 'qtool-ipad-test-v5',
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Do not cache any API requests or database calls
            urlPattern: /supabase\.co/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/rest\/v1\//i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/auth\/v1\//i,
            handler: 'NetworkOnly',
          }
        ]
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  esbuild: {
    target: 'safari14',
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        mockup: 'mockup.html',
        handwerker: 'handwerker.html',
        disponent: 'disponent.html'
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    open: false,
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
      '/carto-tile': {
        target: 'https://basemaps.cartocdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/carto-tile/, ''),
        headers: { 'User-Agent': 'QTool/1.0 (q-service.ch)' },
      },
      '/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ''),
        headers: { 'User-Agent': 'QTool/1.0 (q-service.ch)', 'Accept-Language': 'de' },
      },
      '/google-staticmap': {
        target: 'https://maps.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/google-staticmap/, '/maps/api/staticmap'),
      },
    }
  }
})
