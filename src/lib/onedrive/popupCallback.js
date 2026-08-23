export function isOneDrivePopupCallback(locationLike, hasOpener) {
  if (!hasOpener || !locationLike) return false;

  const hashParams = new URLSearchParams(
    String(locationLike.hash || '').replace(/^#/, '')
  );
  const searchParams = new URLSearchParams(
    String(locationLike.search || '').replace(/^\?/, '')
  );
  const has = (name) => hashParams.has(name) || searchParams.has(name);

  return has('state') && (
    has('code') ||
    has('error') ||
    has('error_description')
  );
}
