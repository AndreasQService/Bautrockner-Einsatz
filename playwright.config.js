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
        headless: true,          // Auf true setzen für CI/CD
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

        // ── iPad A1934 (iPad 6. Gen, 9.7") ──
        {
            name: 'ipad-a1934-portrait',
            testMatch: '**/messen-ipad-a1934.spec.js',
            use: {
                viewport: { width: 768, height: 1024 },
                userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                isMobile: true,
                hasTouch: true,
                deviceScaleFactor: 2,
            },
        },
        {
            name: 'ipad-a1934-landscape',
            testMatch: '**/messen-ipad-a1934.spec.js',
            use: {
                viewport: { width: 1024, height: 768 },
                userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                isMobile: true,
                hasTouch: true,
                deviceScaleFactor: 2,
            },
        },
    ],

    // Automatischer Dev-Server-Start (startet nur wenn noch nicht läuft)
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true, // Nutzt laufenden Server falls vorhanden
        timeout: 30 * 1000,
    },
});

