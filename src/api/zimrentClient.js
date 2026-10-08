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
// auth
// ---------------------------------------------------------------------------
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
    const result = unwrap(await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }));
    if (result?.access_token) setToken(result.access_token);
    return result;
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
  async sendVerificationEmail() {
    return request('/auth/send-verification-email', { method: 'POST' });
  },
  async confirmEmail(token) {
    return request(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  },
  logout() {
    setToken(null);
    if (typeof window !== 'undefined') window.location.href = '/login';
  },
  redirectToLogin(returnTo = window.location.href) {
    if (typeof window !== 'undefined') {
      window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
    }
  },
  loginWithProvider(provider, returnTo = window.location.href) {
    if (typeof window !== 'undefined') {
      window.location.href =
        `${API_BASE_URL}/auth/${encodeURIComponent(provider)}?returnTo=${encodeURIComponent(returnTo)}`;
    }
  },
  setToken,
  isAuthenticated() {
    return Boolean(getToken());
  },
};

// ---------------------------------------------------------------------------
// verification
// ---------------------------------------------------------------------------
const verification = {
  async sendVerificationEmail() {
    return request('/auth/send-verification-email', { method: 'POST' });
  },
  async confirmEmail(token) {
    return request(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  },
};

// ---------------------------------------------------------------------------
// generic legacy entities proxy
// ---------------------------------------------------------------------------
function createEntityApi(entityName) {
  const base = `/entities/${encodeURIComponent(entityName)}`;
  return {
    async get(id) {
      return unwrap(await request(`${base}/${encodeURIComponent(id)}`));
    },
    async filter(filters = {}, sort = '', limit) {
      const params = new URLSearchParams();
      if (filters && Object.keys(filters).length) params.set('filter', JSON.stringify(filters));
      if (sort) params.set('sort', sort);
      if (limit != null) params.set('limit', String(limit));
      const query = params.toString();
      return unwrap(await request(`${base}${query ? `?${query}` : ''}`));
    },
    async create(data) {
      return unwrap(await request(base, { method: 'POST', body: JSON.stringify(data) }));
    },
    async update(id, data) {
      return unwrap(await request(`${base}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }));
    },
    async delete(id) {
      return request(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    subscribe() {
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

// ---------------------------------------------------------------------------
// properties / listings
// ---------------------------------------------------------------------------
function splitPropertyListingRow(row) {
  if (!row) return { property: null, listing: null };
  const {
    listing_id,
    listing_status,
    available_from,
    availability_confirmed_at,
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
  async list(filters = {}) {
    return unwrap(await request(`/properties${toQuery(filters)}`));
  },
  async mine() {
    const result = await request('/properties/mine');
    return Array.isArray(result?.data) ? result.data : [];
  },
  async search(filters = {}, limit) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
    if (limit != null) params.set('limit', String(limit));
    const query = params.toString();
    const result = await request(`/properties${query ? `?${query}` : ''}`);
    const rows = Array.isArray(result?.data) ? result.data : [];
    return rows.map(splitPropertyListingRow);
  },
  async get(id) {
    return unwrap(await request(`/properties/${encodeURIComponent(id)}`));
  },
  async media(propertyId) {
    return unwrap(await request(`/properties/${encodeURIComponent(propertyId)}/media`));
  },
  async create(data) {
    return normalizeEntity(unwrap(await request('/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    })));
  },
  async update(id, data) {
    return normalizeEntity(unwrap(await request(`/properties/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })));
  },
  async remove(id) {
    return request(`/properties/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  photoUrl(propertyId, mediaId) {
    return `${API_BASE_URL}/media/property/${encodeURIComponent(propertyId)}/${encodeURIComponent(mediaId)}`;
  },
  photoUrlAsOwner(propertyId, mediaId) {
    return `${API_BASE_URL}/media/property/${encodeURIComponent(propertyId)}/${encodeURIComponent(mediaId)}/owner`;
  },
};

const listings = {
  async mine() {
    const result = await request('/listings');
    const rows = Array.isArray(result?.data) ? result.data : [];
    return rows.map(normalizeEntity);
  },
  async create({ property_id, available_from } = {}) {
    return normalizeEntity(unwrap(await request('/listings', {
      method: 'POST',
      body: JSON.stringify({ property_id, available_from }),
    })));
  },
  async update(id, data) {
    return normalizeEntity(unwrap(await request(`/listings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })));
  },
};

// ---------------------------------------------------------------------------
// profiles
// ---------------------------------------------------------------------------
const profiles = {
  async me() {
    try {
      const result = await request('/profiles/me');
      const entity = normalizeEntity(unwrap(result));
      if (entity) {
        entity.capabilities = result.capabilities || [];
        entity.verification = result.verification || null;
      }
      return entity;
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },
  async create(data) {
    return normalizeEntity(unwrap(await request('/profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    })));
  },
  async createIfMissing(data = {}) {
    return normalizeEntity(unwrap(await request('/profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    })));
  },
  async update(data) {
    const result = await request('/profiles/me', { method: 'PATCH', body: JSON.stringify(data) });
    const entity = normalizeEntity(unwrap(result));
    if (entity) entity.capabilities = result.capabilities || [];
    return entity;
  },
  async getByUserId(userId) {
    try {
      return normalizeEntity(unwrap(await request(`/profiles/${encodeURIComponent(userId)}`)));
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },
  async getPublic(userId) {
    try {
      return normalizeEntity(unwrap(await request(`/profiles/${encodeURIComponent(userId)}`)));
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },
};

const capabilities = {
  async mine() {
    const result = await request('/capabilities/me');
    return result?.data || [];
  },
  async grant(capability) {
    const result = await request('/capabilities', {
      method: 'POST',
      body: JSON.stringify({ capability }),
    });
    return result?.data || [];
  },
  async revoke(capability) {
    return request(`/capabilities/${encodeURIComponent(capability)}`, { method: 'DELETE' });
  },
};

const identityVerification = {
  async me() {
    const result = await request('/identity-verification/me');
    return result?.data || { status: 'unverified' };
  },
  async submit(evidenceDocumentId) {
    const result = await request('/identity-verification', {
      method: 'POST',
      body: JSON.stringify({ evidence_document_id: evidenceDocumentId }),
    });
    return result?.data;
  },
};

const propertyAuthority = {
  async mine() {
    const result = await request('/property-authority');
    return result?.data || [];
  },
  async forProperty(propertyId) {
    const result = await request(`/property-authority?property_id=${encodeURIComponent(propertyId)}`);
    return result?.data || null;
  },
  async submit(propertyId, evidenceDocumentId) {
    const result = await request('/property-authority', {
      method: 'POST',
      body: JSON.stringify({
        property_id: propertyId,
        evidence_document_id: evidenceDocumentId,
      }),
    });
    return result?.data;
  },
};

const uploads = {
  async upload(file, kind, { propertyId, documentType } = {}) {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    if (propertyId) form.append('property_id', propertyId);
    if (documentType) form.append('document_type', documentType);
    return unwrap(await request('/uploads', { method: 'POST', body: form }));
  },
};

const integrations = {
  Core: {
    async UploadFile({ file, propertyId, property_id }) {
      return uploads.upload(file, 'photo', { propertyId: propertyId || property_id });
    },
    async UploadPrivateFile({ file, propertyId, property_id, documentType = 'identity', document_type }) {
      return uploads.upload(file, 'document', {
        propertyId: propertyId || property_id,
        documentType: documentType || document_type,
      });
    },
  },
};

// ---------------------------------------------------------------------------
// admin verification
// ---------------------------------------------------------------------------
const admin = {
  async identityQueue() {
    const result = await request('/admin/verification/identity');
    return Array.isArray(result?.data) ? result.data : [];
  },
  async propertyQueue() {
    const result = await request('/admin/verification/properties');
    return Array.isArray(result?.data) ? result.data : [];
  },
  async authorityQueue() {
    const result = await request('/admin/verification/authority');
    return Array.isArray(result?.data) ? result.data : [];
  },
  async listingQueue() {
    const result = await request('/admin/verification/listings');
    return Array.isArray(result?.data) ? result.data : [];
  },
  async reviewIdentity(id, status) {
    return (await request(`/admin/verification/identity/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }))?.data;
  },
  async reviewProperty(id, status, notes) {
    return (await request(`/admin/verification/properties/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(notes != null ? { status, notes } : { status }),
    }))?.data;
  },
  async reviewAuthority(id, status) {
    return (await request(`/admin/verification/authority/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }))?.data;
  },
  async reviewListing(id, status) {
    return (await request(`/admin/verification/listings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }))?.data;
  },
  async documentUrl(kind, documentId) {
    const headers = new Headers();
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(
      `${API_BASE_URL}/media/document/${encodeURIComponent(kind)}/${encodeURIComponent(documentId)}`,
      { headers, credentials: 'include' }
    );
    if (!response.ok) {
      let message = response.statusText || 'Failed to load document';
      try {
        const payload = await response.json();
        message = payload?.message || message;
      } catch {}
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return URL.createObjectURL(await response.blob());
  },
};

const savedProperties = {
  async list() {
    const result = await request('/saved-properties');
    return Array.isArray(result?.data) ? result.data : [];
  },
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
    return request(`/saved-properties/${encodeURIComponent(propertyId)}`, { method: 'DELETE' });
  },
};

const viewings = {
  async create(data) { return request('/viewings', { method: 'POST', body: JSON.stringify(data) }); },
  async list() { return request('/viewings'); },
  async get(id) { return request(`/viewings/${encodeURIComponent(id)}`); },
  async accept(id) { return request(`/viewings/${encodeURIComponent(id)}/accept`, { method: 'POST' }); },
  async decline(id) { return request(`/viewings/${encodeURIComponent(id)}/decline`, { method: 'POST' }); },
  async cancel(id) { return request(`/viewings/${encodeURIComponent(id)}/cancel`, { method: 'POST' }); },
};

const conversations = {
  async list() {
    const result = await request('/messages/conversations');
    return Array.isArray(result?.data) ? result.data : [];
  },
  async get(id) { return unwrap(await request(`/messages/conversations/${encodeURIComponent(id)}`)); },
  async create(data) {
    return unwrap(await request('/messages/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    }));
  },
  async start(data) { return this.create(data); },
  async sendMessage(conversationId, body, extra = {}) {
    return request(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body, ...extra }),
    });
  },
};

const notifications = {
  async list() { return unwrap(await request('/notifications')); },
  async markRead(id) {
    return request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
  },
  async markAllRead() {
    return request('/notifications/read-all', { method: 'PATCH' });
  },
};

const reports = {
  async create({ targetType, targetId, reason, notes } = {}) {
    return unwrap(await request('/reports', {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId, reason, notes }),
    }));
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
    return request('/public-settings');
  },
};

export const zimrent = {
  entities,
  auth,
  verification,
  properties,
  listings,
  profiles,
  savedProperties,
  conversations,
  viewings,
  notifications,
  reports,
  capabilities,
  uploads,
  integrations,
  identityVerification,
  propertyAuthority,
  admin,
  functions,
  app,
};
