import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMeasurementRooms, chunkMeasurementRows } from '../src/components/pdf/measurementPdfModel.js';

test('uses history instead of duplicating the current measurement', () => {
    const rooms = buildMeasurementRooms({ rooms: [{
        id: 'room-1',
        name: 'Keller',
        measurementData: { measurements: [{ pointName: 'current', w_value: 99 }] },
        measurementHistory: [{
            id: 'history-1',
            globalSettings: { date: '2026-08-20', device: 'Gann' },
            measurements: [{ pointName: 'MP 1', w_value: 12, b_value: 7, notes: 'Aussenwand' }],
        }],
    }] });

    assert.equal(rooms.length, 1);
    assert.equal(rooms[0].series.length, 1);
    assert.equal(rooms[0].series[0].rows[0].point, 'MP 1');
    assert.equal(rooms[0].series[0].rows[0].wall, 12);
    assert.equal(rooms[0].series[0].rows[0].floor, 7);
    assert.equal(rooms[0].series[0].device, 'Gann');
});

test('uses current measurement when no history exists and preserves aliases', () => {
    const rooms = buildMeasurementRooms({ rooms: [{
        name: 'Wohnzimmer',
        measurementData: {
            canvasImage: 'data:image/png;base64,real',
            globalSettings: { temperature: 21, humidity: 48 },
            measurements: [{ mp: 'A', wall: 3, floor: 4, notizen: 'real note' }],
        },
    }] });

    const series = rooms[0].series[0];
    assert.equal(series.sketch, 'data:image/png;base64,real');
    assert.deepEqual(series.rows[0], { id: '0-0', point: 'A', wall: 3, floor: 4, notes: 'real note' });
    assert.equal(series.temperature, 21);
    assert.equal(series.humidity, 48);
});

test('does not create rooms without stored measurement rows', () => {
    assert.deepEqual(buildMeasurementRooms({ rooms: [{ name: 'Leer' }] }), []);
});

test('splits twenty values into two deterministic continuation pages', () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({ id: index }));
    const chunks = chunkMeasurementRows(rows, 10);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].length, 10);
    assert.equal(chunks[1].length, 10);
    assert.equal(chunks[1][0].id, 10);
});
