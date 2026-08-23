export function isOneDrivePopupCallback(locationLike, hasOpener) {
  if (!locationLike) return false;

  const hashParams = new URLSearchParams(
    String(locationLike.hash || '').replace(/^#/, '')
  );
  const searchParams = new URLSearchParams(
    String(locationLike.search || '').replace(/^\?/, '')
  );
  const hasValue = (params, name) => Boolean(params.get(name));
  const hasHashResponse = (
    hasValue(hashParams, 'code') ||
    hasValue(hashParams, 'error') ||
    hasValue(hashParams, 'error_description')
  );
  const hasSearchResponse = (
    hasValue(searchParams, 'code') ||
    hasValue(searchParams, 'error') ||
    hasValue(searchParams, 'error_description')
  );
  const hasState = (
    hasValue(hashParams, 'state') ||
    hasValue(searchParams, 'state')
  );

  // MSAL popup responses arrive as a URL fragment. Browsers may sever
  // window.opener (for example through opener isolation), so the fragment is
  // the authoritative callback signal. Query responses stay restricted to an
  // actual opener or an OAuth state value to avoid swallowing normal routes.
  return hasHashResponse || (
    hasSearchResponse && (Boolean(hasOpener) || hasState)
  );
}
