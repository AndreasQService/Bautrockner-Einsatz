import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOneDrivePath, validateCleanupTarget, validateTestRunId } from '../src/lib/uploads/oneDriveTestGuard.js';

process.env.ONEDRIVE_TEST_ROOT = 'QTool_TEST_ONLY';
const VALID_RUN_ID = 'TESTRUN_2026-07-21_143000_A7K2';

test('1. Valider Testpfad', () => {
  assert.equal(validateOneDrivePath(`QTool_TEST_ONLY/${VALID_RUN_ID}/TEST__P001/Fotos/TEST__bild.jpg`, VALID_RUN_ID), true);
});

test('2. Produktiver Live-Pfad', () => {
  assert.throws(() => validateOneDrivePath(`QTool/20260236_Muster/Fotos/bild.jpg`, VALID_RUN_ID), /Stammordner muss exakt 'QTool_TEST_ONLY' sein/);
});

test('3. Leere testRunId', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY/${VALID_RUN_ID}/TEST__P001/Fotos/TEST__b.jpg`, ''), /Ungültiges testRunId Format/);
});

test('4. Ungültige/manipulierte testRunId', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY/TESTRUN_INVALID/TEST__P001/Fotos/TEST__b.jpg`, 'TESTRUN_INVALID'), /Ungültiges testRunId Format/);
});

test('5. Path Traversal ..', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY/${VALID_RUN_ID}/../QTool/file.jpg`, VALID_RUN_ID), /Path Traversal/);
});

test('6. Backslashes in Pfad', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY\\${VALID_RUN_ID}\\file.jpg`, VALID_RUN_ID), /Illegales Sonderzeichen/);
});

test('7. Prozentkodierung %2f', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY%2f${VALID_RUN_ID}/file.jpg`, VALID_RUN_ID), /Illegales Sonderzeichen/);
});

test('8. Unicode-Slash \\u2044', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY\u2044${VALID_RUN_ID}/file.jpg`, VALID_RUN_ID), /Illegales Sonderzeichen/);
});

test('9. Query String ?foo=bar', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY/${VALID_RUN_ID}/TEST__P01/Fotos/TEST__b.jpg?foo=bar`, VALID_RUN_ID), /Illegales Sonderzeichen/);
});

test('10. Hash Fragment #x', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY/${VALID_RUN_ID}/TEST__P01/Fotos/TEST__b.jpg#x`, VALID_RUN_ID), /Illegales Sonderzeichen/);
});

test('11. Fehlendes TEST__ am Projektordner', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY/${VALID_RUN_ID}/P001/Fotos/TEST__b.jpg`, VALID_RUN_ID), /Projektordner 'P001' muss mit 'TEST__' beginnen/);
});

test('12. Fehlendes TEST__ an Dateiname', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY/${VALID_RUN_ID}/TEST__P001/Fotos/bild.jpg`, VALID_RUN_ID), /Dateiname 'bild.jpg' muss mit 'TEST__' beginnen/);
});

test('13. Manifest am falschen Ort', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY/${VALID_RUN_ID}/TEST__P001/TEST_MANIFEST.json`, VALID_RUN_ID), /Dateiname 'TEST_MANIFEST.json' muss mit 'TEST__' beginnen/);
});

test('14. Unzulässiger Unterordner', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY/${VALID_RUN_ID}/TEST__P001/Unbekannt/TEST__b.jpg`, VALID_RUN_ID), /Unzulässiger Unterordner 'Unbekannt'/);
});

test('15. Doppelter Slash //', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY//${VALID_RUN_ID}/TEST__P001/Fotos/TEST__b.jpg`, VALID_RUN_ID), /Pfadtiefe|Segment/);
});

test('16. Reservierter Windows-Name CON.jpg', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY/${VALID_RUN_ID}/TEST__P001/Fotos/TEST__CON.jpg`, VALID_RUN_ID), /Reservierter Systemname/);
});

test('17. Abschließender Punkt', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY/${VALID_RUN_ID}/TEST__P001/Fotos/TEST__bild.jpg.`, VALID_RUN_ID), /Segment .* darf nicht auf Punkt/);
});

test('18. Abschließendes Leerzeichen', () => {
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY/${VALID_RUN_ID}/TEST__P001/Fotos/TEST__bild.jpg `, VALID_RUN_ID), /Segment .* darf nicht auf Punkt/);
});

test('19. Überlanges Pfadsegment (>150 Zeichen)', () => {
  const longSeg = 'TEST__' + 'a'.repeat(160);
  assert.throws(() => validateOneDrivePath(`QTool_TEST_ONLY/${VALID_RUN_ID}/${longSeg}/Fotos/TEST__b.jpg`, VALID_RUN_ID), /Segment zu lang/);
});

test('20. Überlanger Gesamtpfad (>400 Zeichen)', () => {
  const longPath = `QTool_TEST_ONLY/${VALID_RUN_ID}/` + 'a'.repeat(450);
  assert.throws(() => validateOneDrivePath(longPath, VALID_RUN_ID), /Gesamtpfad überschreitet Maximallänge/);
});

test('21. Root Löschziel QTool_TEST_ONLY', () => {
  assert.throws(() => validateCleanupTarget(VALID_RUN_ID, 'QTool_TEST_ONLY', 'item123'), /Löschziel/);
});

test('22. Live Löschziel QTool', () => {
  assert.throws(() => validateCleanupTarget(VALID_RUN_ID, 'QTool/20260236_Muster', 'item123'), /Löschziel/);
});

test('23. Fehlende ItemID bei Löschung', () => {
  assert.throws(() => validateCleanupTarget(VALID_RUN_ID, `QTool_TEST_ONLY/${VALID_RUN_ID}`, ''), /Ziel-ItemId fehlt/);
});
