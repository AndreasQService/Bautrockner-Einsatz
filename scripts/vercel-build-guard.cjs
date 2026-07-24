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
    return { ...env, ...process.env };
}

const env = loadEnv();

const testProjectId = 'aoxduqspiezzyqeqyzzl';
const liveProjectId = 'yxdoecdqttgdncgbzyus';
const expectedOneDriveRoot = 'QTool_TEST_ONLY';

const vercelEnv = env.VERCEL_ENV; // 'production', 'preview', 'development'
const isVercel = !!env.VERCEL || !!vercelEnv;

const currentProjectId = env.VITE_EXPECTED_SUPABASE_PROJECT_ID || env.EXPECTED_SUPABASE_PROJECT_ID;
const supabaseUrl = env.VITE_SUPABASE_URL || '';

console.log('[BUILD GUARD] Environment variables loaded:', {
    VERCEL_ENV: vercelEnv,
    isVercel: isVercel,
    VITE_EXPECTED_SUPABASE_PROJECT_ID: currentProjectId,
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_ONEDRIVE_TEST_ROOT: env.VITE_ONEDRIVE_TEST_ROOT || env.ONEDRIVE_TEST_ROOT,
    QTOOL_ENVIRONMENT: env.QTOOL_ENVIRONMENT || env.VITE_QTOOL_ENVIRONMENT,
});

// 1. Determine environment type
let targetEnv = 'unknown'; // 'production' or 'test'
if (vercelEnv === 'production') {
    targetEnv = 'production';
} else if (vercelEnv === 'preview' || vercelEnv === 'development') {
    targetEnv = 'test';
} else {
    // Local build - determine by database URL or currentProjectId
    if (supabaseUrl.includes(liveProjectId) || currentProjectId === liveProjectId) {
        targetEnv = 'production';
    } else if (supabaseUrl.includes(testProjectId) || currentProjectId === testProjectId) {
        targetEnv = 'test';
    }
}

console.log(`[BUILD GUARD] Detected target environment: ${targetEnv.toUpperCase()}`);

// 2. Validate Supabase configuration based on target environment
if (targetEnv === 'production') {
    // In production mode, only live ID is allowed
    if (!supabaseUrl.includes(liveProjectId)) {
        console.error(`[BUILD GUARD] ❌ ABORT: Production build must use Supabase URL belonging to project "${liveProjectId}". Found: "${supabaseUrl}"`);
        process.exit(1);
    }
    if (supabaseUrl.includes(testProjectId)) {
        console.error(`[BUILD GUARD] ❌ ABORT: Production build cannot use test Supabase ID "${testProjectId}"!`);
        process.exit(1);
    }
    // If VITE_EXPECTED_SUPABASE_PROJECT_ID is provided, it must match the live ID
    if (currentProjectId && currentProjectId !== liveProjectId) {
        console.error(`[BUILD GUARD] ❌ ABORT: Vertauschte Zuordnung! VITE_EXPECTED_SUPABASE_PROJECT_ID is "${currentProjectId}" but Supabase URL is Production.`);
        process.exit(1);
    }
} else if (targetEnv === 'test') {
    // In test mode, only test ID is allowed
    if (!supabaseUrl.includes(testProjectId)) {
        console.error(`[BUILD GUARD] ❌ ABORT: Test build must use Supabase URL belonging to project "${testProjectId}". Found: "${supabaseUrl}"`);
        process.exit(1);
    }
    if (supabaseUrl.includes(liveProjectId)) {
        console.error(`[BUILD GUARD] ❌ ABORT: Test build cannot use live Supabase ID "${liveProjectId}"!`);
        process.exit(1);
    }
    // If VITE_EXPECTED_SUPABASE_PROJECT_ID is provided, it must match the test ID
    if (currentProjectId && currentProjectId !== testProjectId) {
        console.error(`[BUILD GUARD] ❌ ABORT: Vertauschte Zuordnung! VITE_EXPECTED_SUPABASE_PROJECT_ID is "${currentProjectId}" but Supabase URL is Test.`);
        process.exit(1);
    }

    // In Vercel Test/Preview builds, we mandate the correct project ID to be set
    if (isVercel && currentProjectId !== testProjectId) {
        console.error(`[BUILD GUARD] ❌ ABORT: Vercel Preview build requires VITE_EXPECTED_SUPABASE_PROJECT_ID to be exactly "${testProjectId}". Found: "${currentProjectId}"`);
        process.exit(1);
    }

    // These checks only apply in test environment
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
} else {
    // Local build with no clear environment indicators
    console.log('[BUILD GUARD] ⚠️ Ambiguous local environment, skipping strict checks.');
}

// 3. Scan codebase for hardcoded forbidden Live ID in test environment
if (targetEnv === 'test') {
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
                if (file === 'supabaseClient.js') continue;

                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes(liveProjectId)) {
                    const lines = content.split('\n');
                    lines.forEach((line, index) => {
                        if (line.includes(liveProjectId)) {
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
}

console.log('[BUILD GUARD] ✅ All pre-build security checks passed successfully.');
process.exit(0);
