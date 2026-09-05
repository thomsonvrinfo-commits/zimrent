import { useState, useEffect } from "react";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";

// Loads the current user's Profile entity (rental role, verification, trust).
// The Profile is separate from the built-in User; created during onboarding.
export function useProfile() {
  const { user, isAuthenticated, authChecked } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authChecked || !isAuthenticated || !user) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const profiles = await zimrent.entities.Profile.filter({ created_by_id: user.id });
        if (active) {
          setProfile(profiles && profiles.length > 0 ? profiles[0] : null);
          setLoading(false);
        }
      } catch (e) {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user, isAuthenticated, authChecked]);

  const refresh = async () => {
    if (!user) return;
    try {
      const profiles = await zimrent.entities.Profile.filter({ created_by_id: user.id });
      setProfile(profiles && profiles.length > 0 ? profiles[0] : null);
    } catch (e) { /* ignore */ }
  };

  return { profile, loading, refresh, isAdmin: user?.role === "admin" };
}