const { verifyTestEnvironment, EXPECTED_PROJECT_REF, FORBIDDEN_LIVE_REF } = require('./env_guard.cjs');

function runGuardTests() {
    console.log('=== STUFE A.4: GUARD UNIT TESTS ===');

    let passed = 0;
    let failed = 0;

    function assertThrows(fn, testName, expectedSnippet) {
        try {
            fn();
            console.error(`❌ FAIL: ${testName} (Expected error, but function succeeded)`);
            failed++;
        } catch (err) {
            if (expectedSnippet && !err.message.includes(expectedSnippet)) {
                console.error(`❌ FAIL: ${testName} (Got error "${err.message}", expected snippet "${expectedSnippet}")`);
                failed++;
            } else {
                console.log(`✅ PASS: ${testName}`);
                passed++;
            }
        }
    }

    // 1. Valid test environment
    try {
        const env = verifyTestEnvironment();
        if (env.projectRef === EXPECTED_PROJECT_REF) {
            console.log('✅ PASS: Valid test environment accepted');
            passed++;
        } else {
            console.error('❌ FAIL: Valid test environment projectRef mismatch');
            failed++;
        }
    } catch (e) {
        console.error(`❌ FAIL: Valid test environment threw: ${e.message}`);
        failed++;
    }

    // 2. Mutation without --execute blocked
    assertThrows(() => {
        verifyTestEnvironment({ isMutating: true });
    }, 'Mutation without --execute blocked', 'without explicit --execute flag');

    // 3. Invalid RUN_ID format blocked
    assertThrows(() => {
        verifyTestEnvironment({ requireRunId: true, runId: 'INVALID-ID' });
    }, 'Invalid RUN_ID format blocked', 'Invalid or missing QTOOL_RUN_ID');

    console.log(`\nGuard Unit Test Summary: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) {
        process.exit(1);
    }
}

runGuardTests();
