export const isAdministrator = (user) => String(user?.role || '').toLowerCase() === 'admin';

export const canDeleteData = isAdministrator;

export const canUnregisterDevice = (user) => ['admin', 'technician', 'handwerker', 'user']
  .includes(String(user?.role || '').toLowerCase());
