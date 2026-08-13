const fs = require('fs');
const path = require('path');
const { verifyTestEnvironment } = require('./env_guard.cjs');

async function seedData() {
    const isExecute = process.argv.includes('--execute');

    console.log('=== STUFE A.2: 100 PROJECTS & 1,000 TODOS SEEDING SUITE ===');
    console.log(`MODE: ${isExecute ? '🟢 EXECUTE (Writing to Supabase Test DB)' : '🟡 DRY-RUN (Simulation & Manifest Generation)'}`);

    const envGuard = verifyTestEnvironment();
    console.log(`[SAFETY CHECK] Target Supabase URL: ${envGuard.supabaseUrl} (Ref: ${envGuard.projectRef})`);

    const projectBatch = [];
    const todoBatch = [];

    const users = [
        { id: 'usr-andreas-strehler', name: 'Andreas Strehler', email: 'a.strehler@q-service.ch', role: 'admin' },
        { id: 'usr-techniker-1', name: 'Marco Rossi', email: 'm.rossi@q-service.ch', role: 'technician' },
        { id: 'usr-innendienst-1', name: 'Sarah Lehner', email: 's.lehner@q-service.ch', role: 'office' }
    ];

    for (let i = 1; i <= 100; i++) {
        const numStr = String(i).padStart(3, '0');
        const projId = `TMP-SOAK-PROJ-${numStr}`;
        const projNum = `2026${String(i + 8000).padStart(4, '0')}`;

        const assignedUser = users[i % users.length];

        const equipmentList = [
            { id: `EQ-INV-${numStr}-1`, type: 'Luftentfeuchter', model: 'Trotec TTK 200', serial: `SN-TR-200-${numStr}`, inInventory: true, room: 'Wohnzimmer', startDate: '2026-08-10', startCounter: 100 },
            { id: `EQ-INV-${numStr}-2`, type: 'Seitenkanalverdichter', model: 'Corroventa CTR 3000', serial: `SN-CV-3000-${numStr}`, inInventory: true, room: 'Flur', startDate: '2026-08-11', startCounter: 50 }
        ];

        if (i % 5 === 0) {
            equipmentList.push({
                id: `EQ-SITE-${numStr}-3`,
                type: 'Baustellengerät (Unbekannt)',
                model: 'Kondenstrockner S1',
                serial: `SN-UNLISTED-SITE-${numStr}`,
                inInventory: false,
                room: 'Keller / Reduit',
                startDate: '2026-08-12',
                startCounter: 0,
                notes: 'Vor Ort erfasst – noch nicht im Inventar'
            });
        }

        projectBatch.push({
            id: projId,
            project_title: `Soak Project ${numStr} (${assignedUser.name})`,
            client: `Muster-Client ${i} AG`,
            address: `Bahnhofstrasse ${i}, 8000 Zürich`,
            status: i % 4 === 0 ? 'abgeschlossen' : 'in_bearbeitung',
            assigned_to: assignedUser.name,
            report_data: {
                projectNumber: projNum,
                equipment: equipmentList,
                dryingData: { equipment: equipmentList },
                rooms: ['Wohnzimmer', 'Schlafzimmer', 'Küche', 'Badezimmer', 'Keller'],
                measurements: [
                    { room: 'Wohnzimmer', point: 'M1 Estrich', temp: 21.5, humidity: 55, val1: 45, val2: 42 },
                    { room: 'Badezimmer', point: 'M2 Fliese', temp: 22.0, humidity: 68, val1: 78, val2: 72 }
                ]
            }
        });
    }

    for (let j = 1; j <= 1000; j++) {
        const todoNum = String(j).padStart(4, '0');
        const targetProj = projectBatch[(j - 1) % projectBatch.length];
        const assignedUser = users[j % users.length];

        todoBatch.push({
            id: `TMP-SOAK-TODO-${todoNum}`,
            project_id: targetProj.id,
            text: `Soak Task #${todoNum} for ${targetProj.project_title}`,
            status: j % 3 === 0 ? 'done' : 'open',
            assigned_user_id: assignedUser.id,
            assigned_user_name: assignedUser.name,
            due_date: '2026-08-15'
        });
    }

    console.log(`[DRY-RUN] Prepared ${projectBatch.length} projects and ${todoBatch.length} todos.`);

    const manifestPath = path.join(__dirname, 'seed_manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
        dryRunDate: new Date().toISOString(),
        mode: isExecute ? 'EXECUTE' : 'DRY_RUN',
        targetProjectRef: envGuard.projectRef,
        projectCount: projectBatch.length,
        todoCount: todoBatch.length,
        sampleProject: projectBatch[0],
        sampleTodo: todoBatch[0]
    }, null, 2));

    console.log(`[DRY-RUN] Seed manifest successfully generated: ${manifestPath} ✅`);

    if (isExecute) {
        console.log('[EXECUTE] Inserting 100 projects into Supabase Test DB...');
        const supabase = envGuard.createSupabaseClient();
        const { data, error } = await supabase.from('damage_reports').upsert(projectBatch);
        if (error) {
            console.error('[EXECUTE] DB Error inserting projects:', error.message);
        } else {
            console.log('[EXECUTE] Successfully inserted 100 projects. Now inserting 1,000 todos...');
            const { error: tErr } = await supabase.from('project_todos').upsert(todoBatch);
            if (tErr) console.error('[EXECUTE] DB Error inserting todos:', tErr.message);
            else console.log('[EXECUTE] Successfully inserted 1,000 todos ✅');
        }
    } else {
        console.log('[DRY-RUN PASSED] 100 Projects & 1,000 Todos validated without DB mutations.');
    }
}

seedData();
