import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const form = readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8')

test('inspection date is optional and backward compatible', () => {
  assert.match(form, /inspectionDate:\s*initialData\.inspectionDate\s*\|\|\s*''/)
  assert.match(form, /inspectionDate:\s*''/)
})

test('desktop and technician views edit the same canonical field', () => {
  assert.match(form, /id="technician-inspection-date"[\s\S]*?value=\{formData\.inspectionDate \|\| ''\}/)
  assert.match(form, /id="desktop-inspection-date"[\s\S]*?value=\{formData\.inspectionDate \|\| ''\}/)
  assert.equal((form.match(/inspectionDate: e\.target\.value/g) || []).length, 2)
})

test('inspection date is included in the generated report only when present', () => {
  assert.match(form, /formData\.cause \|\| formData\.inspectionDate/)
  assert.match(form, /Datum der Begehung:<\/strong>/)
  assert.match(form, /toLocaleDateString\('de-CH'\)/)
})
