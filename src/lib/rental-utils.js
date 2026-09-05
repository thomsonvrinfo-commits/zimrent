// Shared frontend constants and helpers for the rental platform.

export const PROPERTY_TYPES = {
  room: "Room",
  bedsitter: "Bedsitter",
  cottage: "Cottage",
  apartment: "Apartment",
  "1bedroom": "1-Bedroom",
  "2bedroom": "2-Bedroom",
  "3bedroom": "3-Bedroom",
  house: "House"
};

export const LISTING_STATUS = {
  draft: { label: "Draft", color: "secondary" },
  pending_verification: { label: "Pending Verification", color: "warning" },
  active: { label: "Available", color: "success" },
  reservation_pending: { label: "Reservation Pending", color: "warning" },
  reserved: { label: "Reserved", color: "warning" },
  application_pending: { label: "Application Pending", color: "warning" },
  lease_pending: { label: "Lease Pending", color: "warning" },
  rented: { label: "Rented", color: "secondary" },
  inactive: { label: "Inactive", color: "secondary" },
  suspended: { label: "Suspended", color: "destructive" }
};

export const RESERVATION_STATUS = {
  created: { label: "Created", color: "secondary" },
  payment_pending: { label: "Payment Pending", color: "warning" },
  active: { label: "Active", color: "success" },
  completed: { label: "Completed", color: "success" },
  expired: { label: "Expired", color: "secondary" },
  cancelled: { label: "Cancelled", color: "destructive" },
  refunded: { label: "Refunded", color: "secondary" }
};

export const APPLICATION_STATUS = {
  submitted: { label: "Submitted", color: "warning" },
  under_review: { label: "Under Review", color: "warning" },
  more_information: { label: "More Info Needed", color: "warning" },
  approved: { label: "Approved", color: "success" },
  rejected: { label: "Not Accepted", color: "destructive" },
  withdrawn: { label: "Withdrawn", color: "secondary" }
};

export const VIEWING_STATUS = {
  requested: { label: "Requested", color: "warning" },
  accepted: { label: "Accepted", color: "success" },
  declined: { label: "Declined", color: "destructive" },
  rescheduled: { label: "Reschedule Requested", color: "warning" },
  cancelled: { label: "Cancelled", color: "secondary" },
  completed: { label: "Completed", color: "success" },
  no_show: { label: "No Show", color: "destructive" }
};

export const MAINTENANCE_STATUS = {
  submitted: { label: "Submitted", color: "warning" },
  acknowledged: { label: "Acknowledged", color: "warning" },
  assigned: { label: "Assigned", color: "warning" },
  in_progress: { label: "In Progress", color: "warning" },
  resolved: { label: "Resolved", color: "success" },
  closed: { label: "Closed", color: "secondary" },
  disputed: { label: "Disputed", color: "destructive" }
};

export const IDENTITY_STATUS = {
  unverified: { label: "Unverified", color: "secondary" },
  phone_verified: { label: "Phone Verified", color: "warning" },
  identity_pending: { label: "Verification Pending", color: "warning" },
  identity_verified: { label: "Identity Verified", color: "success" },
  verification_failed: { label: "Verification Failed", color: "destructive" },
  verification_review: { label: "Under Review", color: "warning" }
};

export const VERIFICATION_STATUS = {
  unverified: { label: "Unverified", color: "secondary" },
  pending: { label: "Verification Pending", color: "warning" },
  verified: { label: "Property Verified", color: "success" },
  rejected: { label: "Verification Rejected", color: "destructive" }
};

export const WATER_SOURCES = {
  council: "Council Water",
  borehole: "Borehole",
  well: "Well",
  none: "None",
  mixed: "Mixed"
};

export const WATER_RELIABILITY = {
  reliable: "Reliable",
  intermittent: "Intermittent",
  unreliable: "Unreliable"
};

export const ELECTRICITY_OPTIONS = {
  zesa: "ZESA",
  solar: "Solar",
  none: "None",
  mixed: "Mixed"
};

export const BACKUP_POWER = {
  none: "None",
  solar: "Solar",
  generator: "Generator",
  inverter: "Inverter",
  mixed: "Mixed"
};

export function formatCurrency(amount, currency = "USD") {
  if (amount == null || isNaN(amount)) return "—";
  return `${currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return dateStr; }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return dateStr; }
}

export function timeRemaining(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

export function isStaleAvailability(confirmedAt) {
  if (!confirmedAt) return true;
  const days = (Date.now() - new Date(confirmedAt).getTime()) / 86400000;
  return days > 7;
}