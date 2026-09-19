import { useState, useEffect } from "react";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";

// Loads the current user's Profile entity (rental role, verification, trust)
// and their real capabilities (user_capabilities: "renting" / "listing"),
// which drive AppLayout's additive nav. Profile and capabilities are two
// separate backend concepts (see workers/api/src/routes/capabilities/) so
// they're fetched independently, in parallel.
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
      const profile = await zimrent.profiles.me();
      setProfile(profile);
    } catch (e) { /* ignore */ }
  };

  return {
    profile,
    loading,
    refresh,
    capabilities,
    capabilitiesLoading,
    isAdmin: Boolean(user?.is_admin),
  };
}
