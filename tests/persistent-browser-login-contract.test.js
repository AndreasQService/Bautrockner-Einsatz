import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const client = readFileSync(new URL('../src/supabaseClient.js', import.meta.url), 'utf8')
const login = readFileSync(new URL('../src/components/LoginScreen.jsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

test('Supabase sessions persist and refresh automatically', () => {
  assert.match(client, /persistSession:\s*true/)
  assert.match(client, /autoRefreshToken:\s*true/)
  assert.match(client, /detectSessionInUrl:\s*true/)
  assert.match(app, /supabase\.auth\.getSession\(\)/)
  assert.match(app, /supabase\.auth\.onAuthStateChange/)
})

test('login form supports password managers and biometric unlock', () => {
  assert.match(login, /type="email"/)
  assert.match(login, /name="username"/)
  assert.match(login, /autoComplete="username"/)
  assert.match(login, /type="password"/)
  assert.match(login, /name="password"/)
  assert.match(login, /autoComplete="current-password"/)
})

test('QTool never stores the plaintext password itself', () => {
  assert.doesNotMatch(login, /localStorage\.setItem\([^\n]*password/i)
  assert.doesNotMatch(login, /sessionStorage\.setItem\([^\n]*password/i)
})
