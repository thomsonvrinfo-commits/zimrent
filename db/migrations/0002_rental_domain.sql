PRAGMA foreign_keys = ON;

-- ============================================================
-- ZimRent Rental Domain
-- Migration 0002
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_properties (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    created_date TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    UNIQUE(user_id, property_id)
);

CREATE TABLE IF NOT EXISTS viewings (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    listing_id TEXT,
    scheduled_at TEXT,
    status TEXT NOT NULL DEFAULT 'requested',
    notes TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    listing_id TEXT,
    reservation_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    message TEXT,
    household_size INTEGER,
    employment_status TEXT,
    monthly_income REAL,
    move_in_date TEXT,
    decision_reason TEXT,
    decided_at TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TEXT,
    reserved_at TEXT,
    released_at TEXT,
    reservation_amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    payment_status TEXT DEFAULT 'pending',
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    property_id TEXT,
    reservation_id TEXT,
    tenancy_id TEXT,
    payment_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    provider TEXT,
    provider_reference TEXT,
    idempotency_key TEXT UNIQUE,
    metadata_json TEXT,
    paid_at TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS rental_agreements (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    owner_id TEXT,
    property_id TEXT NOT NULL,
    tenancy_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    agreement_url TEXT,
    start_date TEXT,
    end_date TEXT,
    monthly_rent REAL,
    deposit_amount REAL,
    currency TEXT DEFAULT 'USD',
    tenant_signed_at TEXT,
    owner_signed_at TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenancies (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    owner_id TEXT,
    property_id TEXT NOT NULL,
    listing_id TEXT,
    reservation_id TEXT,
    agreement_id TEXT,
    status TEXT NOT NULL DEFAULT 'application',
    start_date TEXT,
    end_date TEXT,
    monthly_rent REAL,
    deposit_amount REAL,
    currency TEXT DEFAULT 'USD',
    move_in_date TEXT,
    move_out_date TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
    FOREIGN KEY (agreement_id) REFERENCES rental_agreements(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS maintenance_requests (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    tenancy_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    priority TEXT DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'open',
    assigned_to_id TEXT,
    resolved_at TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (tenancy_id) REFERENCES tenancies(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    tenancy_id TEXT NOT NULL,
    created_by_id TEXT NOT NULL,
    notice_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    effective_date TEXT,
    reason TEXT,
    message TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    FOREIGN KEY (tenancy_id) REFERENCES tenancies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    property_id TEXT,
    tenancy_id TEXT,
    target_user_id TEXT,
    rating INTEGER NOT NULL,
    comment TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
    FOREIGN KEY (tenancy_id) REFERENCES tenancies(id) ON DELETE SET NULL,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_saved_properties_user
    ON saved_properties(user_id);

CREATE INDEX IF NOT EXISTS idx_viewings_tenant
    ON viewings(tenant_id, created_date);

CREATE INDEX IF NOT EXISTS idx_viewings_property
    ON viewings(property_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_applications_tenant
    ON applications(tenant_id, created_date);

CREATE INDEX IF NOT EXISTS idx_applications_property
    ON applications(property_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_listing
    ON reservations(listing_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_tenant
    ON reservations(tenant_id, created_date);

CREATE INDEX IF NOT EXISTS idx_reservations_expiry
    ON reservations(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_payments_user
    ON payments(user_id, created_date);

CREATE INDEX IF NOT EXISTS idx_payments_reservation
    ON payments(reservation_id);

CREATE INDEX IF NOT EXISTS idx_payments_tenancy
    ON payments(tenancy_id);

CREATE INDEX IF NOT EXISTS idx_tenancies_tenant
    ON tenancies(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_tenancies_property
    ON tenancies(property_id, status);

CREATE INDEX IF NOT EXISTS idx_maintenance_tenant
    ON maintenance_requests(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_maintenance_tenancy
    ON maintenance_requests(tenancy_id, status);

CREATE INDEX IF NOT EXISTS idx_notices_tenancy
    ON notices(tenancy_id, created_date);

CREATE INDEX IF NOT EXISTS idx_reviews_property
    ON reviews(property_id, status);

CREATE INDEX IF NOT EXISTS idx_reviews_target_user
    ON reviews(target_user_id, status);