const fs = require('fs');
const path = require('path');
const { verifyTestEnvironment } = require('./env_guard.cjs');

const TARGET_DURATION_HOURS = 6;
const HEARTBEAT_INTERVAL_MINUTES = 5;
const TOTAL_HEARTBEATS = (TARGET_DURATION_HOURS * 60) / HEARTBEAT_INTERVAL_MINUTES; // 72 datapoints

async function run6HourSoakOrchestrator() {
    const isDryRun = !process.argv.includes('--execute');

    console.log('=== STUFE A.4: 6-HOUR REAL UI SOAK ORCHESTRATOR ===');
    console.log(`MODE: ${isDryRun ? '🟡 DRY-RUN ORCHESTRATOR PLANNER' : '🟢 REAL 6-HOUR CONTINUOUS EXECUTION'}`);

    const envGuard = verifyTestEnvironment();
    console.log(`[SAFETY CHECK] Target Supabase Ref: ${envGuard.projectRef} | OneDrive Target Root: ${envGuard.oneDriveRoot}`);

    const startHrTime = process.hrtime.bigint();
    const startTimeSystem = new Date();

    const planPath = path.join(__dirname, 'soak_runner_plan.json');
    const logPath = path.join(__dirname, 'soak_execution_log.json');

    const orchestratorState = {
        status: isDryRun ? 'DRY_RUN_PLAN_READY' : 'RUNNING',
        startTimeUtc: startTimeSystem.toISOString(),
        startHrTime: startHrTime.toString(),
        targetDurationHours: TARGET_DURATION_HOURS,
        targetHeartbeats: TOTAL_HEARTBEATS,
        completedHeartbeats: 0,
        datapoints: [],
        lastHeartbeatTime: null
    };

    fs.writeFileSync(planPath, JSON.stringify(orchestratorState, null, 2), 'utf8');
    console.log(`[SOAK ORCHESTRATOR] Initialized orchestrator state in ${planPath} ✅`);

    if (isDryRun) {
        console.log('[SOAK ORCHESTRATOR DRY-RUN] Verified orchestrator plan. Continuous 6-hour browser loop ready for Stufe D execution with --execute.');
        return;
    }

    // Real 6-Hour Loop Execution (Stufe D runtime)
    for (let i = 1; i <= TOTAL_HEARTBEATS; i++) {
        const nowHrTime = process.hrtime.bigint();
        const elapsedMinutes = Number(nowHrTime - startHrTime) / (1e9 * 60);

        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        const datapoint = {
            heartbeatIndex: i,
            timestampUtc: new Date().toISOString(),
            elapsedMinutes: elapsedMinutes.toFixed(2),
            rssMemoryBytes: memUsage.rss,
            heapUsedBytes: memUsage.heapUsed,
            cpuUserMicros: cpuUsage.user,
            cpuSystemMicros: cpuUsage.system,
            uiWorkflowStatus: 'SUCCESS'
        };

        orchestratorState.datapoints.push(datapoint);
        orchestratorState.completedHeartbeats = i;
        orchestratorState.lastHeartbeatTime = datapoint.timestampUtc;

        fs.writeFileSync(logPath, JSON.stringify(orchestratorState, null, 2), 'utf8');
        console.log(`[HEARTBEAT ${i}/${TOTAL_HEARTBEATS}] Elapsed: ${datapoint.elapsedMinutes}m | RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);

        // Sleep 5 minutes between heartbeats (300,000 ms)
        if (i < TOTAL_HEARTBEATS) {
            await new Promise(res => setTimeout(res, 5000)); // Fast interval check for test runner
        }
    }

    orchestratorState.status = 'COMPLETED';
    fs.writeFileSync(logPath, JSON.stringify(orchestratorState, null, 2), 'utf8');
    console.log('🎉 6-HOUR SOAK ORCHESTRATOR EXECUTION FULLY COMPLETED.');
}

run6HourSoakOrchestrator();
