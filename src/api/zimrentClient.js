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

const unwrap = (payload) => {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data;
  return payload;
};

function normalizeEntity(entity) {
  if (!entity || typeof entity !== 'object' || Array.isArray(entity)) return entity;
  if (entity.data !== undefined) return entity;
  if (!entity.id) return entity;

  const builtIn = new Set(['id', 'created_date', 'updated_date', 'created_by_id', 'is_sample']);
  const data = {};
  for (const [key, value] of Object.entries(entity)) {
    if (!builtIn.has(key)) data[key] = value;
  }
  return {
    id: entity.id,
    created_date: entity.created_date,
    updated_date: entity.updated_date,
    created_by_id: entity.created_by_id,
    is_sample: entity.is_sample,
    data,
  };
}

function normalizeResult(result) {
  const value = unwrap(result);
  return Array.isArray(value) ? value.map(normalizeEntity) : normalizeEntity(value);
}

function createEntityApi(entityName) {
  const base = `/entities/${encodeURIComponent(entityName)}`;
  return {
    async get(id) {
      return normalizeResult(await request(`${base}/${encodeURIComponent(id)}`));
    },
    async filter(filters = {}, sort = '', limit) {
      const params = new URLSearchParams();
      if (filters && Object.keys(filters).length) params.set('filter', JSON.stringify(filters));
      if (sort) params.set('sort', sort);
      if (limit != null) params.set('limit', String(limit));
      const query = params.toString();
      return normalizeResult(await request(`${base}${query ? `?${query}` : ''}`));
    },
    async create(data) {
      return normalizeResult(await request(base, {
        method: 'POST',
        body: JSON.stringify(data),
      }));
    },
    async update(id, data) {
      return normalizeResult(await request(`${base}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }));
    },
    async delete(id) {
      return request(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    subscribe(callback) {
      // Real-time subscriptions will be supplied by the independent API layer.
      // Returning an unsubscribe function keeps the existing UI contract intact.
      return () => {};
    },
    async schema() {
      return request(`${base}/schema`);
    },
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

// --- Purpose-built endpoints (as opposed to the generic /entities/* proxy
// above, which has no backend implementation). Each of these hits a real
// route and is normalized to the same { id, data: {...} } shape so existing
// components (PropertyCard, etc.) don't need to change. ---

// GET /properties and GET /properties/:id return one joined row (property
// columns + listing_id/listing_status/available_from/availability_confirmed_at).
// Split that back into the { property, listing } pair the rest of the app expects.
function splitPropertyListingRow(row) {
  if (!row) return { property: null, listing: null };
  const {
    listing_id, listing_status, available_from, availability_confirmed_at,
    ...propertyFields
  } = row;
  const property = normalizeEntity(propertyFields);
  const listing = listing_id
    ? normalizeEntity({
      id: listing_id,
      property_id: propertyFields.id,
      created_by_id: propertyFields.created_by_id,
      status: listing_status,
      available_from,
      availability_confirmed_at,
      created_date: propertyFields.created_date,
      updated_date: propertyFields.updated_date,
    })
    : null;
  return { property, listing };
}

const properties = {
  async search(filters = {}, limit) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }
    if (limit != null) params.set('limit', String(limit));
    const query = params.toString();
    const result = await request(`/properties${query ? `?${query}` : ''}`);
    const rows = Array.isArray(result?.data) ? result.data : [];
    return rows.map(splitPropertyListingRow);
  },
  async get(id) {
    const result = await request(`/properties/${encodeURIComponent(id)}`);
    return splitPropertyListingRow(unwrap(result));
  },
  async create(data) {
    return normalizeEntity(await request('/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    }));
  },
  async update(id, data) {
    const result = await request(`/properties/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return normalizeEntity(unwrap(result));
  },
};

const listings = {
  async mine() {
    const result = await request('/listings');
    const rows = Array.isArray(result?.data) ? result.data : [];
    return rows.map(normalizeEntity);
  },
  async create(data) {
    return normalizeEntity(await request('/listings', {
      method: 'POST',
      body: JSON.stringify(data),
    }));
  },
  async update(id, data) {
    const result = await request(`/listings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return normalizeEntity(unwrap(result));
  },
};

const profiles = {
  async me() {
    try {
      const result = await request('/profiles/me');
      return normalizeEntity(unwrap(result));
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },
  async createIfMissing(data = {}) {
    return normalizeEntity(await request('/profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    }));
  },
  async update(data) {
    const result = await request('/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return normalizeEntity(unwrap(result));
  },
  async getPublic(userId) {
    try {
      const result = await request(`/profiles/${encodeURIComponent(userId)}`);
      return normalizeEntity(unwrap(result));
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },
};

const savedProperties = {
  async mine() {
    const result = await request('/saved-properties');
    const rows = Array.isArray(result?.data) ? result.data : [];
    return rows.map(normalizeEntity);
  },
  async save(propertyId) {
    return normalizeEntity(await request('/saved-properties', {
      method: 'POST',
      body: JSON.stringify({ property_id: propertyId }),
    }));
  },
  async unsave(propertyId) {
    return request(`/saved-properties/${encodeURIComponent(propertyId)}`, {
      method: 'DELETE',
    });
  },
};

const conversations = {
  async list() {
    const result = await request('/messages/conversations');
    return Array.isArray(result?.data) ? result.data : [];
  },
  async start(data) {
    return request('/messages/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async get(id) {
    // Returns { conversation, messages } — not entity-normalized, since
    // nothing else in the app consumes these as generic entities.
    return request(`/messages/conversations/${encodeURIComponent(id)}`);
  },
  async sendMessage(id, body) {
    return request(`/messages/conversations/${encodeURIComponent(id)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },
};

const auth = {
  async me() {
    return unwrap(await request('/auth/me'));
  },
  async loginViaEmailPassword(email, password) {
    const result = unwrap(await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }));
    if (result?.access_token) setToken(result.access_token);
    return result;
  },
  async register(payload) {
    return unwrap(await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }));
  },
  async verifyOtp(payload) {
    const result = unwrap(await request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    }));
    if (result?.access_token) setToken(result.access_token);
    return result;
  },
  async resendOtp(email) {
    return request('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
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

const integrations = {
  Core: {
    async UploadFile({ file }) {
      const form = new FormData();
      form.append('file', file);
      return unwrap(await request('/uploads', { method: 'POST', body: form }));
    },
    async UploadPrivateFile({ file }) {
      const form = new FormData();
      form.append('file', file);
      form.append('visibility', 'private');
      return unwrap(await request('/uploads', { method: 'POST', body: form }));
    },
  },
};

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
    return unwrap(await request('/public-settings'));
  },
};

export const zimrent = { entities, auth, integrations, functions, app, properties, listings, profiles, savedProperties, conversations };
