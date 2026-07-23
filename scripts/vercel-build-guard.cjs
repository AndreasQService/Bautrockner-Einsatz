const fs = require('fs');
const path = require('path');

console.log('[BUILD GUARD] 🛡️ Starting pre-build security checks...');

// Helper to parse .env files
function loadEnv() {
    const env = {};
    const paths = ['.env', '.env.local', '.env.production', '.env.development'];
    for (const p of paths) {
        const fullPath = path.join(__dirname, '..', p);
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            content.split('\n').forEach(line => {
                const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
                if (match) {
                    const key = match[1];
                    let value = match[2] || '';
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.substring(1, value.length - 1);
                    } else if (value.startsWith("'") && value.endsWith("'")) {
                        value = value.substring(1, value.length - 1);
                    }
                    env[key] = value.trim();
                }
            });
        }
    }
    // Also mix in process.env
    return { ...env, ...process.env };
}

const env = loadEnv();

// 1. Mandatory Environment Variables Checks
const expectedProjectId = 'aoxduqspiezzyqeqyzzl';
const forbiddenLiveId = 'yxdoecdqttgdncgbzyus';
const expectedOneDriveRoot = 'QTool_TEST_ONLY';

console.log('[BUILD GUARD] Environment variables loaded:', {
    VITE_EXPECTED_SUPABASE_PROJECT_ID: env.VITE_EXPECTED_SUPABASE_PROJECT_ID || env.EXPECTED_SUPABASE_PROJECT_ID,
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
    VITE_ONEDRIVE_TEST_ROOT: env.VITE_ONEDRIVE_TEST_ROOT,
    QTOOL_ENVIRONMENT: env.QTOOL_ENVIRONMENT || env.VITE_QTOOL_ENVIRONMENT,
    ONEDRIVE_TEST_ROOT: env.ONEDRIVE_TEST_ROOT || env.VITE_ONEDRIVE_TEST_ROOT,
});

const currentProjectId = env.VITE_EXPECTED_SUPABASE_PROJECT_ID || env.EXPECTED_SUPABASE_PROJECT_ID;
if (currentProjectId !== expectedProjectId) {
    console.error(`[BUILD GUARD] ❌ ABORT: Expected Supabase Project ID must be exactly "${expectedProjectId}". Found: "${currentProjectId}"`);
    process.exit(1);
}

const supabaseUrl = env.VITE_SUPABASE_URL || '';
if (!supabaseUrl.includes(expectedProjectId)) {
    console.error(`[BUILD GUARD] ❌ ABORT: Supabase URL must belong to project "${expectedProjectId}". Found: "${supabaseUrl}"`);
    process.exit(1);
}

if (supabaseUrl.includes(forbiddenLiveId)) {
    console.error(`[BUILD GUARD] ❌ ABORT: Supabase URL belongs to forbidden Live ID "${forbiddenLiveId}"!`);
    process.exit(1);
}

const oneDriveRoot = env.ONEDRIVE_TEST_ROOT || env.VITE_ONEDRIVE_TEST_ROOT;
if (oneDriveRoot !== expectedOneDriveRoot) {
    console.error(`[BUILD GUARD] ❌ ABORT: OneDrive test root must be exactly "${expectedOneDriveRoot}". Found: "${oneDriveRoot}"`);
    process.exit(1);
}

const qtoolEnv = env.QTOOL_ENVIRONMENT || env.VITE_QTOOL_ENVIRONMENT;
if (qtoolEnv !== 'test') {
    console.error(`[BUILD GUARD] ❌ ABORT: QTOOL_ENVIRONMENT must be exactly "test". Found: "${qtoolEnv}"`);
    process.exit(1);
}

// 2. Scan codebase for hardcoded forbidden Live ID
const srcDir = path.join(__dirname, '..', 'src');
let violationsFound = false;

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDirectory(fullPath);
        } else if (stat.isFile() && /\.(js|jsx|ts|tsx|html|css)$/.test(file)) {
            // Ignore supabaseClient.js since it defines the lock check and comparison constants
            if (file === 'supabaseClient.js') continue;

            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes(forbiddenLiveId)) {
                // If it is in a file, print line and abort
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (line.includes(forbiddenLiveId)) {
                        console.error(`[BUILD GUARD] ❌ VIOLATION: Forbidden Live ID found in ${fullPath}:${index + 1}`);
                        console.error(`   > ${line.trim()}`);
                    }
                });
                violationsFound = true;
            }
        }
    }
}

if (fs.existsSync(srcDir)) {
    scanDirectory(srcDir);
}

if (violationsFound) {
    console.error('[BUILD GUARD] ❌ ABORT: Source code contains forbidden hardcoded production IDs!');
    process.exit(1);
}

console.log('[BUILD GUARD] ✅ All pre-build security checks passed successfully.');
process.exit(0);
