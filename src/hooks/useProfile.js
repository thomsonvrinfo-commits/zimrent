import { useState, useEffect } from "react";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";

// Loads the current user's Profile entity (rental role, verification, trust)
// plus their granted capabilities (renting / listing — see
// workers/api/src/services/capabilities.ts). Capabilities are fetched from
// GET /capabilities/me via zimrent.capabilities.mine(): the backend's
// GET /profiles/me does not actually attach a capabilities field, so
// profile.capabilities from zimrentClient.js's profiles.me() is always empty —
// this hook goes to the real source instead of relying on that.
// The Profile is separate from the built-in User; created during onboarding.
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
        const profile = await zimrent.profiles.me();
        if (active) {
          setProfile(profile);
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
          setCapabilities((rows || []).map((row) => row.capability));
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
      const profile = await zimrent.profiles.me();
      setProfile(profile);
    } catch (e) { /* ignore */ }
    try {
      const rows = await zimrent.capabilities.mine();
      setCapabilities((rows || []).map((row) => row.capability));
    } catch (e) { /* ignore */ }
  };

  const hasCapability = (capability) => capabilities.includes(capability);

  return {
    profile,
    loading,
    refresh,
    isAdmin: user?.role === "admin",
    capabilities,
    capabilitiesLoading,
    hasCapability,
  };
}