import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate } from '../src/utils/formatUtils.js';
import { buildDisplayName } from '../src/utils/projectUtils.js';
import { statusColors, ROOM_OPTIONS } from '../src/config/damageFormConfig.js';

const EXPECTED_STATUS_COLORS = {
  Schadenaufnahme: 'bg-gray-100',
  Leckortung: 'bg-blue-100',
  Trocknung: 'bg-yellow-100',
  'Kontrolle*': 'bg-orange-100',
  Instandsetzung: 'bg-green-100',
  Abgeschlossen: 'bg-gray-200',
};

const EXPECTED_ROOM_OPTIONS = [
  'Wohnzimmer',
  'Bad',
  'Dusche',
  'Flur',
  'Schlafzimmer',
  'Treppenhaus',
  'Keller',
  'Garage',
  'Küche',
  'Abstellraum',
  'Gäste-WC',
  'Kinderzimmer 1',
  'Kinderzimmer 2',
  'Esszimmer',
  'Arbeitszimmer / Büro',
  'Hauswirtschaftsraum (HWR)',
  'Reduit',
  'Estrich',
  'Sonstiges / Eigener Name',
];

test('formatDate formatiert ein gültiges ISO-Datum als tt/mm/jj hh:mm', () => {
  const isoDate = new Date(2026, 0, 15, 0, 0).toISOString();
  assert.equal(formatDate(isoDate), '15/01/26 00:00');
});

test('formatDate erhält die Uhrzeit eines ISO-Datums', () => {
  const isoDateTime = new Date(2026, 6, 26, 18, 7).toISOString();
  assert.equal(formatDate(isoDateTime), '26/07/26 18:07');
});

test('formatDate gibt für leeren String, null und undefined einen Bindestrich zurück', () => {
  assert.equal(formatDate(''), '-');
  assert.equal(formatDate(null), '-');
  assert.equal(formatDate(undefined), '-');
});

test('formatDate gibt einen ungültigen Datumswert unverändert zurück', () => {
  assert.equal(formatDate('kein-datum'), 'kein-datum');
});

test('buildDisplayName kombiniert Straße und Ort', () => {
  assert.equal(buildDisplayName({ street: 'Hauptstrasse 1', city: 'Zürich' }), 'Hauptstrasse 1, Zürich');
});

test('buildDisplayName verwendet bei einer Adresse mit Komma nur den ersten Teil', () => {
  assert.equal(buildDisplayName({ address: 'Nebenweg 3, 8000 Zürich' }), 'Nebenweg 3');
});

test('buildDisplayName erhält eine Adresse ohne Komma vollständig', () => {
  assert.equal(buildDisplayName({ address: 'Einzeladresse' }), 'Einzeladresse');
});

test('buildDisplayName verwendet einen vorhandenen Projekttitel', () => {
  assert.equal(buildDisplayName({ projectTitle: 'Projekt Alpha' }), 'Projekt Alpha');
});

test('buildDisplayName verwendet eine vorhandene ID', () => {
  assert.equal(buildDisplayName({ id: 'P-100' }), 'P-100');
});

test('buildDisplayName gibt für ein leeres Objekt den Gedankenstrich zurück', () => {
  assert.equal(buildDisplayName({}), '—');
});

test('buildDisplayName unterstützt null und undefined im aktuellen Stand nicht', () => {
  assert.throws(() => buildDisplayName(null), TypeError);
  assert.throws(() => buildDisplayName(undefined), TypeError);
});

test('buildDisplayName mutiert das Eingabeobjekt nicht', () => {
  const project = { street: 'Hauptstrasse 1', city: 'Zürich', metadata: { source: 'test' } };
  const before = structuredClone(project);
  buildDisplayName(project);
  assert.deepEqual(project, before);
});

test('statusColors enthält exakt die bestehenden Statuszuordnungen', () => {
  assert.deepEqual(statusColors, EXPECTED_STATUS_COLORS);
  assert.deepEqual(Object.keys(statusColors), Object.keys(EXPECTED_STATUS_COLORS));
});

test('ROOM_OPTIONS enthält alle 19 sichtbaren Texte in unveränderter Reihenfolge', () => {
  assert.equal(ROOM_OPTIONS.length, 19);
  assert.deepEqual(ROOM_OPTIONS, EXPECTED_ROOM_OPTIONS);
});

test('ROOM_OPTIONS enthält keine Duplikate und wird durch den Test nicht verändert', () => {
  const before = [...ROOM_OPTIONS];
  assert.equal(new Set(ROOM_OPTIONS).size, ROOM_OPTIONS.length);
  assert.deepEqual(ROOM_OPTIONS, before);
});
