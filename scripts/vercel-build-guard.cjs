const fs = require('fs');
const path = require('path');

console.log('[BUILD GUARD] 🛡️ Starting pre-build security checks...');

// Helper to parse .env files
function loadEnv() {
    const env = {};
    const paths = ['.env', '.env.local', '.env.production', '.env.development'];
    const isVercel = !!process.env.VERCEL || !!process.env.VERCEL_ENV;
    if (isVercel) {
        paths.push('.env.vercel-preview');
    }
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

const vercelEnv = env.VERCEL_ENV;
const vercelProjectName = env.VERCEL_PROJECT_NAME;
const isVercel = !!env.VERCEL || !!vercelEnv;

const currentProjectId = env.VITE_EXPECTED_SUPABASE_PROJECT_ID || env.EXPECTED_SUPABASE_PROJECT_ID;
const supabaseUrl = env.VITE_SUPABASE_URL || '';

console.log('[BUILD GUARD] Environment variables loaded:', {
    VERCEL_ENV: vercelEnv,
    VERCEL_PROJECT_NAME: vercelProjectName,
    isVercel: isVercel,
    VITE_EXPECTED_SUPABASE_PROJECT_ID: currentProjectId,
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_ONEDRIVE_TEST_ROOT: env.VITE_ONEDRIVE_TEST_ROOT || env.ONEDRIVE_TEST_ROOT,
    QTOOL_ENVIRONMENT: env.QTOOL_ENVIRONMENT || env.VITE_QTOOL_ENVIRONMENT,
});

// 1. Determine expected target environment based on Vercel environment variables
let expectedProjectIdForEnv = null;

if (isVercel) {
    if (vercelEnv === 'production' && (vercelProjectName === 'bautrockner-einsatz-by7w' || vercelProjectName === 'bautrockner-einsatz')) {
        expectedProjectIdForEnv = liveProjectId;
    } else {
        // Any other project (like qtool-test) or preview builds are TEST
        expectedProjectIdForEnv = testProjectId;
    }
} else {
    // Local build - determine by current local configuration
    if (supabaseUrl.includes(liveProjectId) || currentProjectId === liveProjectId) {
        expectedProjectIdForEnv = liveProjectId;
    } else if (supabaseUrl.includes(testProjectId) || currentProjectId === testProjectId) {
        expectedProjectIdForEnv = testProjectId;
    }
}

if (!expectedProjectIdForEnv) {
    console.log('[BUILD GUARD] ⚠️ Ambiguous environment, skipping strict checks.');
    process.exit(0);
}

console.log(`[BUILD GUARD] Expected Supabase Project ID for this environment: "${expectedProjectIdForEnv}"`);

// 2. Validate configuration against the expected environment
if (expectedProjectIdForEnv === liveProjectId) {
    // PRODUCTION checks
    if (supabaseUrl && !supabaseUrl.includes(liveProjectId)) {
        console.error(`[BUILD GUARD] ❌ ABORT: Production build must use Supabase URL belonging to project "${liveProjectId}". Found: "${supabaseUrl}"`);
        process.exit(1);
    }
    if (supabaseUrl.includes(testProjectId)) {
        console.error(`[BUILD GUARD] ❌ ABORT: Production build cannot use test Supabase ID "${testProjectId}"!`);
        process.exit(1);
    }
    if (currentProjectId && currentProjectId !== liveProjectId) {
        console.error(`[BUILD GUARD] ❌ ABORT: Vertauschte Zuordnung! VITE_EXPECTED_SUPABASE_PROJECT_ID is "${currentProjectId}" but Supabase URL is Production.`);
        process.exit(1);
    }
} else if (expectedProjectIdForEnv === testProjectId) {
    // TEST checks
    if (supabaseUrl && !supabaseUrl.includes(testProjectId)) {
        console.error(`[BUILD GUARD] ❌ ABORT: Test build must use Supabase URL belonging to project "${testProjectId}". Found: "${supabaseUrl}"`);
        process.exit(1);
    }
    if (supabaseUrl.includes(liveProjectId)) {
        console.error(`[BUILD GUARD] ❌ ABORT: Test build cannot use live Supabase ID "${liveProjectId}"!`);
        process.exit(1);
    }
    if (currentProjectId && currentProjectId !== testProjectId) {
        console.error(`[BUILD GUARD] ❌ ABORT: Vertauschte Zuordnung! VITE_EXPECTED_SUPABASE_PROJECT_ID is "${currentProjectId}" but Supabase URL is Test.`);
        process.exit(1);
    }

    // In Vercel Test/Preview builds, mandate that the project ID is explicitly set
    if (isVercel && currentProjectId !== testProjectId) {
        console.error(`[BUILD GUARD] ❌ ABORT: Vercel Preview build requires VITE_EXPECTED_SUPABASE_PROJECT_ID to be exactly "${testProjectId}". Found: "${currentProjectId}"`);
        process.exit(1);
    }

    // Additional strict checks for test environment
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
}

// 3. Scan codebase for hardcoded forbidden Live ID (only in test environment)
if (expectedProjectIdForEnv === testProjectId) {
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
