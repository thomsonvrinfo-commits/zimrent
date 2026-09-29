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
// but a few routes (viewings) return the bare value.
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
};

// ---------------------------------------------------------------------------
// auth
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

    if (typeof window !== 'undefined') {
      window.location.href = target;
    }
  },

  loginWithProvider(provider, returnTo = window.location.href) {
    if (typeof window !== 'undefined') {
      window.location.href =
        `${API_BASE_URL}/auth/${encodeURIComponent(provider)}` +
        `?returnTo=${encodeURIComponent(returnTo)}`;
    }
  },

  setToken,

  isAuthenticated() {
    return Boolean(getToken());
  },
};

// ---------------------------------------------------------------------------
// email verification
// ---------------------------------------------------------------------------
const verification = {
  async sendVerificationEmail() {
    return request('/auth/send-verification-email', {
      method: 'POST',
    });
  },

  async confirmEmail(token) {
    return request(
      `/auth/verify-email?token=${encodeURIComponent(token)}`,
      {
        method: 'GET',
      }
    );
  },
};

// ---------------------------------------------------------------------------
// properties
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
    return unwrap(
      await request(
        `/properties/${encodeURIComponent(propertyId)}/media`
      )
    );
  },

  async create(data) {
    return unwrap(
      await request('/properties', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    );
  },

  async update(id, data) {
    return unwrap(
      await request(
        `/properties/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        }
      )
    );
  },

  async remove(id) {
    return request(
      `/properties/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
  },

  photoUrl(propertyId, mediaId) {
    return (
      `${API_BASE_URL}/media/property/` +
      `${encodeURIComponent(propertyId)}/` +
      `${encodeURIComponent(mediaId)}`
    );
  },

  photoUrlAsOwner(propertyId, mediaId) {
    return (
      `${API_BASE_URL}/media/property/` +
      `${encodeURIComponent(propertyId)}/` +
      `${encodeURIComponent(mediaId)}/owner`
    );
  },
};

// ---------------------------------------------------------------------------
// listings
// ---------------------------------------------------------------------------
const listings = {
  async create({ property_id, available_from } = {}) {
    return unwrap(
      await request('/listings', {
        method: 'POST',
        body: JSON.stringify({
          property_id,
          available_from,
        }),
      })
    );
  },

  async mine() {
    return unwrap(await request('/listings'));
  },

  async update(id, data) {
    return unwrap(
      await request(
        `/listings/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        }
      )
    );
  },
};

// ---------------------------------------------------------------------------
// profiles
// ---------------------------------------------------------------------------
const profiles = {
  async me() {
    try {
      return unwrap(await request('/profiles/me'));
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  },

  async getByUserId(userId) {
    return unwrap(
      await request(
        `/profiles/${encodeURIComponent(userId)}`
      )
    );
  },

  async create(data) {
    return unwrap(
      await request('/profiles', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    );
  },

  async update(data) {
    return unwrap(
      await request('/profiles/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
    );
  },
};

// ---------------------------------------------------------------------------
// saved properties
// ---------------------------------------------------------------------------
const savedProperties = {
  async list() {
    return unwrap(await request('/saved-properties'));
  },

  async save(propertyId) {
    return unwrap(
      await request('/saved-properties', {
        method: 'POST',
        body: JSON.stringify({
          property_id: propertyId,
        }),
      })
    );
  },

  async unsave(propertyId) {
    return request(
      `/saved-properties/${encodeURIComponent(propertyId)}`,
      {
        method: 'DELETE',
      }
    );
  },
};

// ---------------------------------------------------------------------------
// conversations / messages
// ---------------------------------------------------------------------------
const conversations = {
  async list() {
    return unwrap(await request('/messages/conversations'));
  },

  async get(id) {
    return request(
      `/messages/conversations/${encodeURIComponent(id)}`
    );
  },

  async start({ property_id, listing_id } = {}) {
    return request('/messages/conversations', {
      method: 'POST',
      body: JSON.stringify({
        property_id,
        listing_id,
      }),
    });
  },

  async sendMessage(conversationId, body, extra = {}) {
    return request(
      `/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          body,
          ...extra,
        }),
      }
    );
  },
};

// ---------------------------------------------------------------------------
// viewings
// ---------------------------------------------------------------------------
const viewings = {
  async list() {
    return request('/viewings');
  },

  async get(id) {
    return request(
      `/viewings/${encodeURIComponent(id)}`
    );
  },

  async create({
    property_id,
    listing_id,
    scheduled_at,
    notes,
  } = {}) {
    return request('/viewings', {
      method: 'POST',
      body: JSON.stringify({
        property_id,
        listing_id,
        scheduled_at,
        notes,
      }),
    });
  },

  async accept(id) {
    return request(
      `/viewings/${encodeURIComponent(id)}/accept`,
      {
        method: 'POST',
      }
    );
  },

  async decline(id) {
    return request(
      `/viewings/${encodeURIComponent(id)}/decline`,
      {
        method: 'POST',
      }
    );
  },

  async cancel(id) {
    return request(
      `/viewings/${encodeURIComponent(id)}/cancel`,
      {
        method: 'POST',
      }
    );
  },
};

// ---------------------------------------------------------------------------
// capabilities
// ---------------------------------------------------------------------------
const capabilities = {
  async mine() {
    return unwrap(await request('/capabilities/me'));
  },

  async grant(capability) {
    return unwrap(
      await request('/capabilities', {
        method: 'POST',
        body: JSON.stringify({
          capability,
        }),
      })
    );
  },

  async revoke(capability) {
    return request(
      `/capabilities/${encodeURIComponent(capability)}`,
      {
        method: 'DELETE',
      }
    );
  },
};

// ---------------------------------------------------------------------------
// uploads
// ---------------------------------------------------------------------------
const uploads = {
  async upload(
    file,
    kind,
    { propertyId, documentType } = {}
  ) {
    const form = new FormData();

    form.append('file', file);
    form.append('kind', kind);

    if (propertyId) {
      form.append('property_id', propertyId);
    }

    if (documentType) {
      form.append('document_type', documentType);
    }

    return unwrap(
      await request('/uploads', {
        method: 'POST',
        body: form,
      })
    );
  },
};

// ---------------------------------------------------------------------------
// integrations
// ---------------------------------------------------------------------------
const integrations = {
  Core: {
    async UploadFile({ file, propertyId }) {
      return uploads.upload(file, 'photo', {
        propertyId,
      });
    },

    async UploadPrivateFile({
      file,
      propertyId,
      documentType = 'identity',
    }) {
      return uploads.upload(file, 'document', {
        propertyId,
        documentType,
      });
    },
  },
};

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------
const notifications = {
  async list() {
    return unwrap(await request('/notifications'));
  },

  async markRead(id) {
    return request(
      `/notifications/${encodeURIComponent(id)}/read`,
      {
        method: 'PATCH',
      }
    );
  },

  async markAllRead() {
    return request('/notifications/read-all', {
      method: 'PATCH',
    });
  },
};

// ---------------------------------------------------------------------------
// reports
// ---------------------------------------------------------------------------
const reports = {
  async create({
    targetType,
    targetId,
    reason,
    notes,
  } = {}) {
    return unwrap(
      await request('/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          notes,
        }),
      })
    );
  },
};

// ---------------------------------------------------------------------------
// DEPRECATED — legacy generic entity proxy.
// ---------------------------------------------------------------------------
function createEntityApi(entityName) {
  const base = `/entities/${encodeURIComponent(entityName)}`;

  return {
    async get(id) {
      return unwrap(
        await request(
          `${base}/${encodeURIComponent(id)}`
        )
      );
    },

    async filter(filters = {}, sort = '', limit) {
      const params = new URLSearchParams();

      if (filters && Object.keys(filters).length) {
        params.set('filter', JSON.stringify(filters));
      }

      if (sort) {
        params.set('sort', sort);
      }

      if (limit != null) {
        params.set('limit', String(limit));
      }

      const query = params.toString();

      return unwrap(
        await request(
          `${base}${query ? `?${query}` : ''}`
        )
      );
    },

    async create(data) {
      return unwrap(
        await request(base, {
          method: 'POST',
          body: JSON.stringify(data),
        })
      );
    },

    async update(id, data) {
      return unwrap(
        await request(
          `${base}/${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify(data),
          }
        )
      );
    },

    async delete(id) {
      return request(
        `${base}/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        }
      );
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
    if (
      typeof entityName !== 'string' ||
      entityName === 'then'
    ) {
      return undefined;
    }

    if (!entityCache.has(entityName)) {
      entityCache.set(
        entityName,
        createEntityApi(entityName)
      );
    }

    return entityCache.get(entityName);
  },
});

const functions = {
  async invoke(name, payload = {}) {
    return unwrap(
      await request(
        `/functions/${encodeURIComponent(name)}`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      )
    );
  },
};

const app = {
  async getPublicSettings() {
    return request('/public-settings');
  },
};

export const zimrent = {
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
  app,

  // deprecated — see notice above
  entities,
  functions,
};
