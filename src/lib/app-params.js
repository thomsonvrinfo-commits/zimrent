const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
  !isNode && new URLSearchParams(window.location.search).get('clear_access_token') === 'true';

const clearStoredAccessToken = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('zimrent_access_token');
    window.localStorage.removeItem('token');
  }
};

// Google OAuth (workers/api/src/routes/auth/google.ts) redirects back here
// with ?access_token=... because the API (workers.dev) and this app
// (pages.dev) are different origins — a cookie set by the Worker can't be
// read by this app, so the token has to travel once via the redirect URL,
// then get stored and immediately scrubbed from the address bar.
const consumeOAuthRedirectToken = () => {
  if (isNode) return;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('access_token');
  if (!token) return;

  window.localStorage.setItem('zimrent_access_token', token);

  params.delete('access_token');
  const search = params.toString();
  const cleanUrl = window.location.pathname + (search ? `?${search}` : '') + window.location.hash;
  window.history.replaceState({}, document.title, cleanUrl);
};

const getAppParams = () => {
  if (isClearAccessTokenRequested()) clearStoredAccessToken();
  consumeOAuthRedirectToken();

  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
    token: !isNode ? window.localStorage.getItem('zimrent_access_token') : null,
    // Set by the Google OAuth callback on failure (google_oauth_failed,
    // google_oauth_invalid_state, google_oauth_expired, google_email_unverified).
    oauthError: !isNode ? new URLSearchParams(window.location.search).get('error') : null,
  };
};

export const appParams = getAppParams();
