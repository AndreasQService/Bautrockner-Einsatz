const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./env_guard.cjs');

function getTestIdentities() {
    const env = loadEnv();

    const requiredEnvVars = [
        'VITE_TEST_USER_DESKTOP_EMAIL',
        'VITE_TEST_USER_IPAD_EMAIL',
        'VITE_TEST_USER_ADMIN_EMAIL',
        'VITE_TEST_USER_TECH_EMAIL'
    ];

    const missing = requiredEnvVars.filter(v => !env[v]);

    const identities = {
        desktopUser: {
            id: env.VITE_TEST_USER_DESKTOP_ID || 'usr-desktop-test',
            name: env.VITE_TEST_USER_DESKTOP_NAME || 'Andreas Strehler (Desktop)',
            email: env.VITE_TEST_USER_DESKTOP_EMAIL || 'a.strehler@q-service.ch',
            role: 'admin',
            storageStatePath: path.join(__dirname, 'profiles', 'desktop_user_state.json')
        },
        ipadUser: {
            id: env.VITE_TEST_USER_IPAD_ID || 'usr-ipad-test',
            name: env.VITE_TEST_USER_IPAD_NAME || 'Marco Rossi (iPad Tech)',
            email: env.VITE_TEST_USER_IPAD_EMAIL || 'm.rossi@q-service.ch',
            role: 'technician',
            storageStatePath: path.join(__dirname, 'profiles', 'ipad_user_state.json')
        },
        adminUser: {
            id: env.VITE_TEST_USER_ADMIN_ID || 'usr-admin-test',
            name: env.VITE_TEST_USER_ADMIN_NAME || 'Andreas Strehler',
            email: env.VITE_TEST_USER_ADMIN_EMAIL || 'a.strehler@q-service.ch',
            role: 'admin',
            storageStatePath: path.join(__dirname, 'profiles', 'admin_user_state.json')
        },
        techUser: {
            id: env.VITE_TEST_USER_TECH_ID || 'usr-tech-test',
            name: env.VITE_TEST_USER_TECH_NAME || 'Sarah Lehner (Innendienst)',
            email: env.VITE_TEST_USER_TECH_EMAIL || 's.lehner@q-service.ch',
            role: 'office',
            storageStatePath: path.join(__dirname, 'profiles', 'tech_user_state.json')
        }
    };

    return {
        identities,
        missingEnvVars: missing,
        hasAllConfigured: missing.length === 0
    };
}

module.exports = {
    getTestIdentities
};
