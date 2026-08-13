const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const EXPECTED_PROJECT_REF = 'aoxduqspiezzyqeqyzzl';
const FORBIDDEN_LIVE_REF = 'yxdoecdqttgdncgbzyus';
const EXPECTED_ONEDRIVE_ROOT = 'QTool_TEST_ONLY';

function loadEnv() {
    const env = {};
    const rootDir = path.resolve(__dirname, '..', '..');
    const envFiles = ['.env', '.env.local', '.env.development'];
    for (const f of envFiles) {
        const p = path.join(rootDir, f);
        if (fs.existsSync(p)) {
            const content = fs.readFileSync(p, 'utf8');
            content.split('\n').forEach(line => {
                const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
                if (match) {
                    let val = (match[2] || '').trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.substring(1, val.length - 1);
                    }
                    env[match[1]] = val;
                }
            });
        }
    }
    return { ...env, ...process.env };
}

function verifyTestEnvironment(options = {}) {
    const { requireRunId = false, requireExecute = false, isMutating = false } = options;
    const env = loadEnv();

    const envMode = env.QTOOL_ENVIRONMENT || process.env.QTOOL_ENVIRONMENT || 'test';
    if (envMode !== 'test') {
        throw new Error(`[SECURITY GUARD] ❌ ABORT: QTOOL_ENVIRONMENT is "${envMode}", expected "test"!`);
    }

    const supabaseUrl = env.VITE_SUPABASE_URL || '';
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseUrl.trim()) {
        throw new Error('[SECURITY GUARD] ❌ ABORT: Supabase URL is empty or missing!');
    }

    const currentRef = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

    if (!currentRef) {
        throw new Error('[SECURITY GUARD] ❌ ABORT: Cannot extract Supabase project reference from URL!');
    }

    if (currentRef === FORBIDDEN_LIVE_REF || supabaseUrl.includes(FORBIDDEN_LIVE_REF)) {
        throw new Error(`[SECURITY GUARD] 🔴 CRITICAL SAFETY LOCKOUT: Detected Live Production Supabase Project ID "${FORBIDDEN_LIVE_REF}". Test execution immediately halted!`);
    }

    if (currentRef !== EXPECTED_PROJECT_REF) {
        throw new Error(`[SECURITY GUARD] ❌ ABORT: Target project reference "${currentRef}" does not match expected test reference "${EXPECTED_PROJECT_REF}".`);
    }

    const oneDriveTarget = env.VITE_ONEDRIVE_TEST_ROOT || EXPECTED_ONEDRIVE_ROOT;
    if (oneDriveTarget !== EXPECTED_ONEDRIVE_ROOT) {
        throw new Error(`[SECURITY GUARD] ❌ ABORT: OneDrive target root "${oneDriveTarget}" does not match expected "${EXPECTED_ONEDRIVE_ROOT}".`);
    }

    const isExecute = process.argv.includes('--execute');
    if (requireExecute && !isExecute) {
        throw new Error('[SECURITY GUARD] ❌ ABORT: Action requires explicit --execute flag!');
    }

    if (isMutating && !isExecute) {
        throw new Error('[SECURITY GUARD] ❌ ABORT: Database mutation attempted without explicit --execute flag! Dry-run is standard.');
    }

    const runId = process.env.QTOOL_RUN_ID || (options.runId ? options.runId : null);
    if (requireRunId && (!runId || !runId.startsWith('QTOOL-E2E-2026'))) {
        throw new Error(`[SECURITY GUARD] ❌ ABORT: Invalid or missing QTOOL_RUN_ID ("${runId}"). Must follow format "QTOOL-E2E-2026..."`);
    }

    return {
        supabaseUrl,
        supabaseKey,
        projectRef: currentRef,
        oneDriveRoot: oneDriveTarget,
        isExecute,
        runId,
        createSupabaseClient: () => createClient(supabaseUrl, supabaseKey)
    };
}

module.exports = {
    loadEnv,
    verifyTestEnvironment,
    EXPECTED_PROJECT_REF,
    FORBIDDEN_LIVE_REF,
    EXPECTED_ONEDRIVE_ROOT
};
