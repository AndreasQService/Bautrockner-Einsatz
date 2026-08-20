import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRentalDeviceAssignment, endRentalDeviceAssignment, isRentalTypeSelectionValid, normalizeRentalNumber } from '../src/lib/rentalDevices.js';

test('rental numbers are normalized without inventing an M prefix', () => {
    assert.equal(normalizeRentalNumber('  ab-12 '), 'AB-12');
});

test('a catalog selection or a new on-site type is mandatory', () => {
    assert.equal(isRentalTypeSelectionValid({ catalogId: '', newTypeName: '' }), false);
    assert.equal(isRentalTypeSelectionValid({ catalogId: 'catalog-1', newTypeName: '' }), true);
    assert.equal(isRentalTypeSelectionValid({ catalogId: '', newTypeName: 'Spezialtrockner' }), true);
});

test('assignment is accepted only with complete database evidence', async () => {
    const calls = [];
    const supabase = {
        rpc: async (name, params) => {
            calls.push({ name, params });
            return { data: [{ rental_device_id: 'rental-1', catalog_id: 'catalog-1', device_type: 'Turbine', catalog_status: 'approved' }], error: null };
        }
    };
    const result = await createRentalDeviceAssignment({
        supabase, reportId: 'project-1', deviceNumber: ' 42 ', catalogId: 'catalog-1',
        startDate: '2026-08-20', apartment: 'EG', room: 'Keller', counterStart: '10', runtimeHours: '2'
    });
    assert.equal(result.rental_device_id, 'rental-1');
    assert.equal(calls[0].name, 'create_rental_device_assignment');
    assert.equal(calls[0].params.p_device_number, '42');
});

test('incomplete or duplicate database results fail closed', async () => {
    const incomplete = { rpc: async () => ({ data: [{}], error: null }) };
    await assert.rejects(() => createRentalDeviceAssignment({
        supabase: incomplete, reportId: 'p', deviceNumber: '1', newTypeName: 'Neu'
    }), /nicht vollständig bestätigt/);

    const duplicate = { rpc: async () => ({ data: null, error: { code: '23505', message: 'RENTAL_NUMBER_ALREADY_ACTIVE' } }) };
    await assert.rejects(() => createRentalDeviceAssignment({
        supabase: duplicate, reportId: 'p', deviceNumber: '1', newTypeName: 'Neu'
    }), /bereits aktiv vergeben/);
});

test('rental unregister waits for exact database confirmation', async () => {
    const calls = [];
    const query = {
        update: value => { calls.push(['update', value]); return query; },
        eq: (name, value) => { calls.push(['eq', name, value]); return query; },
        is: (name, value) => { calls.push(['is', name, value]); return query; },
        select: value => { calls.push(['select', value]); return query; },
        maybeSingle: async () => ({ data: { id: 'rental-1', report_id: 'project-1', end_date: '2026-08-20', runtime_hours: '12' }, error: null })
    };
    const supabase = { from: table => { calls.push(['from', table]); return query; } };
    const result = await endRentalDeviceAssignment({
        supabase, rentalDeviceId: 'rental-1', reportId: 'project-1', endDate: '2026-08-20', runtimeHours: '12'
    });
    assert.equal(result.end_date, '2026-08-20');
    assert.deepEqual(calls[0], ['from', 'rental_devices']);
    assert.ok(calls.some(call => call[0] === 'is' && call[1] === 'end_date' && call[2] === null));

    const unconfirmedQuery = {
        update: () => unconfirmedQuery,
        eq: () => unconfirmedQuery,
        is: () => unconfirmedQuery,
        select: () => unconfirmedQuery,
        maybeSingle: async () => ({ data: null, error: null })
    };
    await assert.rejects(() => endRentalDeviceAssignment({
        supabase: { from: () => unconfirmedQuery }, rentalDeviceId: 'rental-1', reportId: 'project-1', endDate: '2026-08-20'
    }), /nicht bestätigt/);
});

test('migration separates rental uniqueness from owned inventory and secures the RPC', () => {
    const sql = fs.readFileSync(new URL('../supabase/migrations/20260820183000_separate_rental_device_assignments.sql', import.meta.url), 'utf8');
    assert.match(sql, /unique index[\s\S]*on public\.rental_devices[\s\S]*where end_date is null/i);
    assert.doesNotMatch(sql, /unique index[\s\S]*on public\.devices[\s\S]*rental_devices_active_number_uidx/i);
    assert.match(sql, /public\.qtool_has_project_write_lock\(p_report_id\)/);
    assert.match(sql, /catalog_status in \('approved', 'provisional'\)/);
    assert.match(sql, /revoke all on function public\.create_rental_device_assignment[\s\S]*from public, anon/i);
    assert.match(sql, /grant execute on function public\.create_rental_device_assignment[\s\S]*to authenticated/i);
});

test('DamageForm uses rental table RPC and never infers rentals from an M prefix', () => {
    const source = fs.readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
    assert.match(source, /createRentalDeviceAssignment\(/);
    assert.match(source, /Mietgerät \(separates Mietinventar\)/);
    assert.match(source, /Gerätetyp vor Ort neu erfassen/);
    assert.doesNotMatch(source, /newDevice\.deviceNumber\.trim\(\)\.toUpperCase\(\)\.startsWith\('M'\)/);
});

test('DeviceManager reads the separate rental table and does not create rentals in owned inventory', () => {
    const source = fs.readFileSync(new URL('../src/components/DeviceManager.jsx', import.meta.url), 'utf8');
    assert.match(source, /\.from\('rental_devices'\)/);
    assert.match(source, /filteredRentalDevices\.map/);
    assert.match(source, /activeTab === 'mietgeraete' \? 'Im Auftrag erfassen'/);
    assert.doesNotMatch(source, /Mietgeräte-Inventarnummern müssen mit 'M' beginnen/);
    assert.doesNotMatch(source, /String\(d\.number\)\.trim\(\)\.toUpperCase\(\)\.startsWith\('M'\)/);
});
