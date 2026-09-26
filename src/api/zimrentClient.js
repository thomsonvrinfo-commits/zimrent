const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

const TOKEN_KEY = 'zimrent_access_token';

function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (typeof window !== 'undefined') {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  }
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(
      (payload && payload.message) || response.statusText || 'Request failed'
    );
    error.status = response.status;
    error.data = payload;
    throw error;
  }

  return payload;
}

// The live Worker wraps most list/single-resource responses as { data: ... },
// but a few routes (viewings) return the bare value. `unwrap` handles both
// without guessing wrong on a route that legitimately has a `data` field of
// its own (none currently do, but this keeps the assumption explicit).
const unwrap = (payload) => {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data;
  return payload;
};

function toQuery(params = {}) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

// ---------------------------------------------------------------------------
// auth — matches the real /auth/* routes. Unlike the rest of this file these
// were already correct except register() not persisting its token.
// ---------------------------------------------------------------------------
const auth = {
  async me() {
    return request('/auth/me');
  },
  async loginViaEmailPassword(email, password) {
    const result = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (result?.access_token) setToken(result.access_token);
    return result;
  },
  async register({ email, password, display_name } = {}) {
    // NOTE: the backend never issues an OTP — register() returns an
    // access_token directly, same as login. There is no /auth/verify-otp or
    // /auth/resend-otp route; do not call them.
    const result = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name }),
    });
    if (result?.access_token) setToken(result.access_token);
    return result;
  },
  async resetPasswordRequest(email) {
    return request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  async resetPassword(payload) {
    return request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  logout() {
    setToken(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },
  redirectToLogin(returnTo = window.location.href) {
    const target = `/login?returnTo=${encodeURIComponent(returnTo)}`;
    if (typeof window !== 'undefined') window.location.href = target;
  },
  loginWithProvider(provider, returnTo = window.location.href) {
    if (typeof window !== 'undefined') {
      window.location.href = `${API_BASE_URL}/auth/${encodeURIComponent(provider)}?returnTo=${encodeURIComponent(returnTo)}`;
    }
  },
  setToken,
  isAuthenticated() {
    return Boolean(getToken());
  },
};

// ---------------------------------------------------------------------------
// properties — matches /properties/*
// Server-side filtering: city, suburb, property_type, min_rent, max_rent,
// bedrooms, pets_allowed, furnished, gated, limit. The list route only ever
// returns properties with an ACTIVE listing (INNER JOIN) — until listing
// activation (Phase 2) is built, this will legitimately return an empty
// array. That is not a bug in this client.
// ---------------------------------------------------------------------------
const properties = {
  async list(filters = {}) {
    return unwrap(await request(`/properties${toQuery(filters)}`));
  },
  async mine() {
    return unwrap(await request('/properties/mine'));
  },
  async get(id) {
    return unwrap(await request(`/properties/${encodeURIComponent(id)}`));
  },
  async media(propertyId) {
    return unwrap(await request(`/properties/${encodeURIComponent(propertyId)}/media`));
  },
  async create(data) {
    return unwrap(await request('/properties', { method: 'POST', body: JSON.stringify(data) }));
  },
  async update(id, data) {
    return unwrap(await request(`/properties/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }));
  },
  async remove(id) {
    return request(`/properties/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  // Builds a servable image URL from a property_media row's id + property_id.
  // The public route only serves media for properties with an ACTIVE listing;
  // use photoUrlAsOwner while the listing isn't active yet.
  photoUrl(propertyId, mediaId) {
    return `${API_BASE_URL}/media/property/${encodeURIComponent(propertyId)}/${encodeURIComponent(mediaId)}`;
  },
  photoUrlAsOwner(propertyId, mediaId) {
    return `${API_BASE_URL}/media/property/${encodeURIComponent(propertyId)}/${encodeURIComponent(mediaId)}/owner`;
  },
};

// ---------------------------------------------------------------------------
// listings — matches /listings/* (create.ts mounted at POST /, manage.ts at
// GET / and PATCH /:id). Owners can only ever set status to draft,
// pending_verification, or inactive — the backend rejects "active" here
// with a 403; only an admin route can activate a listing, and as of this
// audit no such route exists yet (Phase 2 work).
// ---------------------------------------------------------------------------
const listings = {
  async create({ property_id, available_from } = {}) {
    return unwrap(await request('/listings', {
      method: 'POST',
      body: JSON.stringify({ property_id, available_from }),
    }));
  },
  async mine() {
    return unwrap(await request('/listings'));
  },
  async update(id, data) {
    return unwrap(await request(`/listings/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }));
  },
};

// ---------------------------------------------------------------------------
// profiles — matches /profiles/*. Note the real `profiles` table only has:
// id, created_by_id, display_name, phone, authority_status, identity_status,
// verification_status, avatar_url, bio, preferences_json, created_date,
// updated_date. Tenant-preference-style fields (budget, household size,
// desired move-in date, etc.) have nowhere dedicated to live — this client
// stores/reads them as a JSON blob in preferences_json rather than inventing
// columns that don't exist.
// ---------------------------------------------------------------------------
const profiles = {
  async me() {
    try {
      return unwrap(await request('/profiles/me'));
    } catch (e) {
      if (e.status === 404) return null; // no profile row yet — not an error
      throw e;
    }
  },
  async getByUserId(userId) {
    return unwrap(await request(`/profiles/${encodeURIComponent(userId)}`));
  },
  async create(data) {
    return unwrap(await request('/profiles', { method: 'POST', body: JSON.stringify(data) }));
  },
  async update(data) {
    return unwrap(await request('/profiles/me', { method: 'PATCH', body: JSON.stringify(data) }));
  },
};

// ---------------------------------------------------------------------------
// savedProperties — matches /saved-properties/*
// ---------------------------------------------------------------------------
const savedProperties = {
  async list() {
    return unwrap(await request('/saved-properties'));
  },
  async save(propertyId) {
    return unwrap(await request('/saved-properties', {
      method: 'POST',
      body: JSON.stringify({ property_id: propertyId }),
    }));
  },
  async unsave(propertyId) {
    return request(`/saved-properties/${encodeURIComponent(propertyId)}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// conversations / messages — matches /messages/conversations/*
// ---------------------------------------------------------------------------
const conversations = {
  async list() {
    return unwrap(await request('/messages/conversations'));
  },
  async get(id) {
    // Returns { conversation, messages } — not wrapped in { data }.
    return request(`/messages/conversations/${encodeURIComponent(id)}`);
  },
  async start({ property_id, listing_id } = {}) {
    return request('/messages/conversations', {
      method: 'POST',
      body: JSON.stringify({ property_id, listing_id }),
    });
  },
  async sendMessage(conversationId, body, extra = {}) {
    return request(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body, ...extra }),
    });
  },
};

// ---------------------------------------------------------------------------
// viewings — matches /viewings/*. Unlike almost everything else these routes
// return bare arrays/objects, not { data: ... }.
// ---------------------------------------------------------------------------
const viewings = {
  async list() {
    return request('/viewings');
  },
  async get(id) {
    return request(`/viewings/${encodeURIComponent(id)}`);
  },
  async create({ property_id, listing_id, scheduled_at, notes } = {}) {
    return request('/viewings', {
      method: 'POST',
      body: JSON.stringify({ property_id, listing_id, scheduled_at, notes }),
    });
  },
  async accept(id) {
    return request(`/viewings/${encodeURIComponent(id)}/accept`, { method: 'POST' });
  },
  async decline(id) {
    return request(`/viewings/${encodeURIComponent(id)}/decline`, { method: 'POST' });
  },
  async cancel(id) {
    return request(`/viewings/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
  },
};

// ---------------------------------------------------------------------------
// capabilities — matches /capabilities/*. Self-declared, no approval gate.
// A user needs the "listing" capability before they can create a property.
// ---------------------------------------------------------------------------
const capabilities = {
  async mine() {
    return unwrap(await request('/capabilities/me'));
  },
  async grant(capability) {
    return unwrap(await request('/capabilities', {
      method: 'POST',
      body: JSON.stringify({ capability }),
    }));
  },
  async revoke(capability) {
    return request(`/capabilities/${encodeURIComponent(capability)}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// uploads — matches POST /uploads. The backend REQUIRES a `kind` field
// ('photo' | 'document') and, for photos and authority documents, a
// `property_id`. It never returns a file_url — only a storage_key; use
// properties.photoUrl()/photoUrlAsOwner() to build a servable URL from the
// returned id + property_id.
// ---------------------------------------------------------------------------
const uploads = {
  /**
   * @param {File} file
   * @param {'photo'|'document'} kind
   * @param {object} [opts]
   * @param {string} [opts.propertyId] required for kind:'photo', and for
   *   kind:'document' with documentType:'authority'
   * @param {'identity'|'authority'} [opts.documentType] required for kind:'document'
   */
  async upload(file, kind, { propertyId, documentType } = {}) {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    if (propertyId) form.append('property_id', propertyId);
    if (documentType) form.append('document_type', documentType);
    return unwrap(await request('/uploads', { method: 'POST', body: form }));
  },
};

// ---------------------------------------------------------------------------
// integrations — kept for backward compatibility with call sites not yet
// migrated. These now correctly send `kind`, but only work for the simple
// "identity document" case where no property_id is required; anything
// involving a property should call `uploads.upload()` directly instead.
// ---------------------------------------------------------------------------
const integrations = {
  Core: {
    async UploadFile({ file, propertyId }) {
      return uploads.upload(file, 'photo', { propertyId });
    },
    async UploadPrivateFile({ file, propertyId, documentType = 'identity' }) {
      return uploads.upload(file, 'document', { propertyId, documentType });
    },
  },
};

// ---------------------------------------------------------------------------
// DEPRECATED — legacy generic-entity proxy. The Worker has never implemented
// /entities/* or /functions/*; every call through these throws a 404. Kept
// ONLY so that pages not yet migrated to the real methods above fail exactly
// as they did before (a caught error, not a crash from an undefined import)
// rather than behaving differently mid-migration.
//
// See PHASE-1-IMPLEMENTATION-NOTES.md for the full list of files still
// depending on this and the exact real-method replacement for each call.
// Do not build new features against `entities` or `functions` — every entity
// type below currently has NO backing route on the live Worker.
// ---------------------------------------------------------------------------
function createEntityApi(entityName) {
  const base = `/entities/${encodeURIComponent(entityName)}`;
  return {
    async get(id) { return unwrap(await request(`${base}/${encodeURIComponent(id)}`)); },
    async filter(filters = {}, sort = '', limit) {
      const params = new URLSearchParams();
      if (filters && Object.keys(filters).length) params.set('filter', JSON.stringify(filters));
      if (sort) params.set('sort', sort);
      if (limit != null) params.set('limit', String(limit));
      const query = params.toString();
      return unwrap(await request(`${base}${query ? `?${query}` : ''}`));
    },
    async create(data) { return unwrap(await request(base, { method: 'POST', body: JSON.stringify(data) })); },
    async update(id, data) { return unwrap(await request(`${base}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) })); },
    async delete(id) { return request(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    subscribe() { return () => {}; },
    async schema() { return request(`${base}/schema`); },
  };
}
const entityCache = new Map();
const entities = new Proxy({}, {
  get(_target, entityName) {
    if (typeof entityName !== 'string' || entityName === 'then') return undefined;
    if (!entityCache.has(entityName)) entityCache.set(entityName, createEntityApi(entityName));
    return entityCache.get(entityName);
  },
});
const functions = {
  async invoke(name, payload = {}) {
    return unwrap(await request(`/functions/${encodeURIComponent(name)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }));
  },
};

const app = {
  async getPublicSettings() {
    return request('/public-settings');
  },
};

export const zimrent = {
  auth,
  properties,
  listings,
  profiles,
  savedProperties,
  conversations,
  viewings,
  capabilities,
  uploads,
  integrations,
  app,
  // deprecated — see notice above
  entities,
  functions,
};
