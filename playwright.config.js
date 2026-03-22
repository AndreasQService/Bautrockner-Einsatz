import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Konfiguration für QTool
 * Läuft gegen den lokalen Vite Dev Server (http://localhost:5173)
 * 
 * Starte zuerst den Dev Server: npm run dev
 * Dann Tests ausführen: npx playwright test
 */
export default defineConfig({
    // Testverzeichnis
    testDir: './tests',

    // Maximale Wartezeit pro Test
    timeout: 30 * 1000,

    // Maximale Wartezeit auf Assertions
    expect: {
        timeout: 5000,
    },

    // Reporter: HTML + Terminal
    reporter: [
        ['html', { outputFolder: 'playwright-report', open: 'on-failure' }],
        ['list'],
    ],

    // Globale Einstellungen für alle Tests
    use: {
        // Basis-URL des Dev Servers
        baseURL: 'http://localhost:5173',

        // Browser-Einstellungen
        headless: false,          // Auf true setzen für CI/CD
        viewport: { width: 1280, height: 800 },

        // ✅ Mikrofon & Kamera automatisch erlauben
        // (die App ruft beim Start navigator.mediaDevices.getUserMedia() auf)
        permissions: ['microphone', 'camera'],

        // Automatischer Screenshot bei Fehlern
        screenshot: 'only-on-failure',

        // Video: bei Fehlern behalten
        video: 'retain-on-failure',

        // Tracing für besseres Debugging
        trace: 'on-first-retry',

        // Locale
        locale: 'de-DE',
    },

    // Nur Chromium (schnell, stabil)
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        // Auskommentiert - bei Bedarf aktivieren:
        // {
        //   name: 'firefox',
        //   use: { ...devices['Desktop Firefox'] },
        // },
        // {
        //   name: 'mobile',
        //   use: { ...devices['iPhone 13'] },
        // },
    ],

    // KEIN automatischer Dev-Server-Start - manuell starten mit: npm run dev
    // webServer: {
    //   command: 'npm run dev',
    //   url: 'http://localhost:5173',
    //   reuseExistingServer: true,
    // },
});
