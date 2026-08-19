import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const headerStart = app.indexOf('<header className="app-header"')
const headerEnd = app.indexOf('</header>', headerStart)
const header = app.slice(headerStart, headerEnd)
const providerStart = header.indexOf('id="provider-status-group"')
const providerEnd = header.indexOf("{view !== 'dashboard'", providerStart)
const providers = header.slice(providerStart, providerEnd)

test('Supabase and OneDrive status are global header controls', () => {
  assert.ok(headerStart >= 0 && headerEnd > headerStart)
  assert.ok(providerStart >= 0 && providerEnd > providerStart)
  assert.match(providers, /id="supabase-status-badge"/)
  assert.match(providers, /id="onedrive-status-badge"/)
  assert.match(providers, /id="onedrive-connect-button"/)
})

test('provider success remains evidence-based and independent', () => {
  assert.match(providers, /isOnline && supabaseStatus\?\.ok === true/)
  assert.match(providers, /isOnline && oneDriveServiceStatus\.ok === true/)
  assert.doesNotMatch(providers, /syncPending|localStorage|setTimeout/)
})

test('dashboard-only actions do not contain provider statuses', () => {
  const dashboardActions = header.slice(header.indexOf("{view === 'dashboard'"))
  assert.doesNotMatch(dashboardActions, /supabase-status-badge|onedrive-status-badge|onedrive-connect-button/)
})
