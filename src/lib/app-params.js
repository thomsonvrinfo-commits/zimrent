const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
  !isNode && new URLSearchParams(window.location.search).get('clear_access_token') === 'true';

const clearStoredAccessToken = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('zimrent_access_token');
    window.localStorage.removeItem('token');
  }
};

const getAppParams = () => {
  if (isClearAccessTokenRequested()) clearStoredAccessToken();

  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
    token: !isNode ? window.localStorage.getItem('zimrent_access_token') : null,
  };
};

export const appParams = getAppParams();
