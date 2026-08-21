import { supabase } from '../supabaseClient.js';

const normalizeDirectoryUser = (user) => ({
  id: String(user.id),
  supabaseUserId: String(user.id),
  auth_user_id: String(user.id),
  email: String(user.email || '').trim().toLowerCase(),
  authEmail: String(user.email || '').trim().toLowerCase(),
  name: String(user.displayName || user.name || '').trim(),
  displayName: String(user.displayName || user.name || '').trim(),
  role: String(user.role || 'technician').toLowerCase(),
  isActive: user.isActive !== false,
});

async function invokeAdminUsers(body) {
  if (!supabase?.functions?.invoke) throw new Error('Supabase ist nicht verfügbar.');
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    let serverMessage = '';
    try {
      const response = error.context;
      if (response && typeof response.clone === 'function') {
        const payload = await response.clone().json();
        serverMessage = String(payload?.error || '');
      }
    } catch {
      // Keep the transport message when the response has no JSON body.
    }
    throw new Error(serverMessage || error.message || 'Benutzerverwaltung nicht erreichbar.');
  }
  if (!data?.ok) throw new Error(data?.error || 'Benutzerverwaltung fehlgeschlagen.');
  return data;
}

export async function listDirectoryUsers() {
  const data = await invokeAdminUsers({ action: 'list' });
  return (Array.isArray(data.users) ? data.users : []).map(normalizeDirectoryUser);
}

export async function createDirectoryUser({ email, displayName, password, role }) {
  await invokeAdminUsers({ action: 'create', email, displayName, password, role });
  return listDirectoryUsers();
}

export async function updateDirectoryUser(userId, { email, displayName, password, role }) {
  await invokeAdminUsers({ action: 'update', userId, email, displayName, password: password || undefined, role });
  return listDirectoryUsers();
}

export async function deleteDirectoryUser(userId) {
  await invokeAdminUsers({ action: 'delete', userId });
  return listDirectoryUsers();
}

export function stripLegacyPasswords(users) {
  return (Array.isArray(users) ? users : []).map(({ password: _password, ...user }) => user);
}
