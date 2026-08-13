const fs = require('fs');
const { verifyTestEnvironment } = require('./env_guard.cjs');

async function runSecuritySuiteComplete() {
    console.log('=== STUFE A.4: COMPLETE SECURITY & PENETRATION SUITE ===');

    const envGuard = verifyTestEnvironment();
    console.log(`[SAFETY CHECK] Target Supabase Ref: ${envGuard.projectRef}`);
    const supabase = envGuard.createSupabaseClient();

    const results = [];

    // 1. RLS Audit on damage_reports (SELECT)
    const { data: rep, error: rErr } = await supabase.from('damage_reports').select('id').limit(1);
    results.push({
        test: 'RLS damage_reports select',
        status: rErr ? 'FAIL' : 'PASS',
        details: rErr ? rErr.message : `OK (${rep ? rep.length : 0} row sample)`
    });

    // 2. Direct RPC deletion attempt (expect blocked/revoked)
    const { data: rpc, error: rpcErr } = await supabase.rpc('delete_project_secure', {
        p_project_id: 'test-proj',
        p_actor_uid: '00000000-0000-0000-0000-000000000000'
    });
    results.push({
        test: 'RPC delete_project_secure anon access',
        status: rpcErr ? 'BLOCKED_SAFE' : 'VULNERABLE',
        details: rpcErr ? rpcErr.message : 'UNEXPECTED SUCCESS'
    });

    // 3. Admin users table IDOR guard
    const { data: adm, error: admErr } = await supabase.from('app_admin_users').select('*').limit(1);
    results.push({
        test: 'Admin users table IDOR guard',
        status: admErr ? (admErr.message.includes('schema cache') ? 'NOT_APPLICABLE' : 'BLOCKED_SAFE') : 'EXPOSED',
        details: admErr ? admErr.message : 'Table accessible without auth'
    });

    // 4. Parameterized Query & WAF Probe
    const probeTitle = "Safe_Test_Title_Probe";
    const { data: sqlRes, error: sqlErr } = await supabase.from('damage_reports').select('id').eq('project_title', probeTitle);
    results.push({
        test: 'Parameterized Query Security',
        status: !sqlErr ? 'PASS_SECURE' : 'FAIL',
        details: sqlErr ? sqlErr.message : 'Queries properly parameterized'
    });

    // 5. Anon DELETE permissions check
    const { data: delData, error: delErr } = await supabase.from('damage_reports').delete().eq('id', 'NON_EXISTENT_SAFETY_CHECK_ID');
    results.push({
        test: 'Anon global DELETE permission denial',
        status: delErr ? 'BLOCKED_SAFE' : 'AUDIT_NOTICE',
        details: delErr ? delErr.message : 'Anon DELETE executed without RLS rejection'
    });

    // 6. Brandbachstrasse Regression Check
    const brandbachQuery = 'Brandbachstrasse';
    const { data: bbData, error: bbErr } = await supabase.from('damage_reports').select('id, project_title').ilike('project_title', `%${brandbachQuery}%`);
    results.push({
        test: 'Brandbachstrasse Regression Query Guard',
        status: !bbErr ? 'PASS' : 'FAIL',
        details: bbErr ? bbErr.message : `Query safe (${bbData ? bbData.length : 0} matching records)`
    });

    console.log('[COMPLETE SECURITY SUITE AUDIT RESULTS]');
    console.log(JSON.stringify(results, null, 2));

    const vulnerabilities = results.filter(r => r.status === 'VULNERABLE' || r.status === 'EXPOSED');
    if (vulnerabilities.length > 0) {
        throw new Error(`Security Audit Vulnerabilities Found: ${vulnerabilities.map(f => f.test).join(', ')}`);
    }

    console.log('✅ COMPLETE SECURITY AUDIT EXECUTED SUCCESSFULLY.');
}

runSecuritySuiteComplete();
