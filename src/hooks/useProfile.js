import { useState, useEffect } from "react";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";

// Loads the current user's Profile row (display name, phone, bio,
// verification statuses). Separate from the built-in User row; created
// during onboarding via POST /profiles.
//
// Returns the profile FLAT (profile.display_name, not profile.data.display_name)
// — matches the real /profiles/me response shape. Any consuming component
// still written against the old `.data.*` shape needs updating; see
// PHASE-1-IMPLEMENTATION-NOTES.md.
export function useProfile() {
  const { user, isAuthenticated, authChecked } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [capabilities, setCapabilities] = useState([]);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);

  useEffect(() => {
    if (!authChecked || !isAuthenticated || !user) {
      setLoading(false);
      setCapabilitiesLoading(false);
      return;
    }
    let active = true;

    (async () => {
      try {
        const p = await zimrent.profiles.me();
        if (active) {
          setProfile(p);
          setLoading(false);
        }
      } catch (e) {
        if (active) setLoading(false);
      }
    })();

    (async () => {
      try {
        const rows = await zimrent.capabilities.mine();
        if (active) {
          // /capabilities/me returns [{ capability, granted_at }, ...];
          // AppLayout's buildCapabilityNav does capabilities.includes("renting")
          // against plain strings, so map down to just the capability names.
          setCapabilities(Array.isArray(rows) ? rows.map((r) => r.capability) : []);
          setCapabilitiesLoading(false);
        }
      } catch (e) {
        if (active) setCapabilitiesLoading(false);
      }
    })();

    return () => { active = false; };
  }, [user, isAuthenticated, authChecked]);

  const refresh = async () => {
    if (!user) return;
    try {
      const p = await zimrent.profiles.me();
      setProfile(p);
    } catch (e) { /* ignore */ }
  };

  // Fixed: the backend gates admin access via a separate `is_admin` flag on
  // the users table, never the `role` column. /auth/me already returns
  // is_admin (see AuthContext's user object), so this now reflects reality
  // instead of always being false.
  return { profile, loading, refresh, capabilities, capabilitiesLoading, isAdmin: Boolean(user?.is_admin) };
}
