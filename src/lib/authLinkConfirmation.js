const INVALID_LINK_MESSAGE = 'Dieser Anmeldelink ist unvollständig oder ungültig.';

export const readAuthLinkConfirmation = (locationLike) => {
  if (!locationLike) return { active: false };

  const params = new URLSearchParams(locationLike.search || '');
  if (params.get('qtool_auth_confirm') !== '1') return { active: false };

  const type = params.get('type');
  const tokenHash = params.get('token_hash') || '';
  const tokenIsValid = tokenHash.length > 0
    && tokenHash.length <= 4096
    && !/\s/.test(tokenHash);

  if (!['invite', 'recovery'].includes(type) || !tokenIsValid) {
    return { active: true, valid: false, error: INVALID_LINK_MESSAGE };
  }

  return { active: true, valid: true, type, tokenHash };
};

export const confirmAuthLink = async (supabase, request) => {
  if (!supabase?.auth?.verifyOtp || !request?.valid) {
    throw new Error(INVALID_LINK_MESSAGE);
  }

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: request.tokenHash,
    type: request.type,
  });
  if (error) throw error;

  const session = data?.session;
  if (!session?.user?.id || !session?.access_token) {
    throw new Error('Der Anmeldelink konnte nicht sicher bestätigt werden.');
  }
  return session;
};

